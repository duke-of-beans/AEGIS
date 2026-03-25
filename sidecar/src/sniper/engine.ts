// ============================================================
// AEGIS Sniper Rules Engine
// Graduated action engine: throttle → suspend → kill
// Nothing fires on processes AEGIS doesn't understand.
// Blast radius awareness: high-blast processes get longer thresholds.
// ============================================================

import { EventEmitter } from 'events'
import { getLogger } from '../logger/index.js'
import type { ContextName } from '../context/engine.js'
import type { DeviationReport, BaselineEngine } from './baseline.js'
import type { CatalogManager } from '../catalog/manager.js'
import { DEVIATION_ZSCORE_THRESHOLD } from './baseline.js'

// ============================================================
// Types
// ============================================================

export type SniperAction = 'throttle' | 'suspend' | 'kill' | 'notify'

export type BlastRadius = 'none' | 'low' | 'medium' | 'high' | 'critical'

export interface SniperRule {
  id: string
  target_pattern: string       // substring match on process name
  zscore_trigger: number       // deviation threshold (default: DEVIATION_ZSCORE_THRESHOLD)
  duration_sec: number         // must sustain deviation this long before action
  action: SniperAction         // escalation starting point
  cooldown_min: number         // min time between actions on same process
  context_exemptions: ContextName[]  // skip in these contexts
  enabled: boolean
  user_defined: boolean
}

export type EscalationState = 'watching' | 'throttled' | 'suspended' | 'killed'

export interface ProcessWatch {
  name: string
  pid: number
  context: ContextName
  deviation: DeviationReport
  first_flagged_ms: number     // when we first noticed the deviation
  last_action_ms: number | null
  last_action: SniperAction | null
  escalation_state: EscalationState
  action_count: number
}

export interface SniperEvent {
  type: 'flagged' | 'action_taken' | 'recovered' | 'deferred'
  name: string
  pid: number
  context: ContextName
  action?: SniperAction
  reason: string
  deviation: DeviationReport
  blast_radius: BlastRadius
  timestamp: number
}

// ============================================================
// Default built-in rules
// ============================================================

export const DEFAULT_RULES: SniperRule[] = [
  {
    id: 'node-runaway',
    target_pattern: 'node',
    zscore_trigger: DEVIATION_ZSCORE_THRESHOLD,
    duration_sec: 120,   // 2 min sustained — builds are noisy, wait longer
    action: 'throttle',
    cooldown_min: 10,
    context_exemptions: ['build'],  // never fire during build context
    enabled: true,
    user_defined: false,
  },
  {
    id: 'searchindexer-hog',
    target_pattern: 'searchindexer',
    zscore_trigger: 1.5,   // lower bar — this process should never spike
    duration_sec: 60,
    action: 'throttle',
    cooldown_min: 5,
    context_exemptions: [],
    enabled: true,
    user_defined: false,
  },
  {
    id: 'generic-runaway',
    target_pattern: '',    // matches all — catch-all rule
    zscore_trigger: 3.0,   // higher bar for generic
    duration_sec: 300,     // 5 min — very conservative
    action: 'throttle',
    cooldown_min: 15,
    context_exemptions: ['build', 'gaming', 'media'],
    enabled: true,
    user_defined: false,
  },
]

// Blast radius → duration multiplier
// High blast = wait much longer before acting
const BLAST_DURATION_MULTIPLIER: Record<BlastRadius, number> = {
  none: 1.0,
  low: 1.5,
  medium: 2.0,
  high: 3.0,
  critical: 999,   // never auto-act on critical blast radius
}

// ============================================================
// SniperEngine
// ============================================================

export class SniperEngine extends EventEmitter {
  private rules: SniperRule[]
  private watches: Map<string, ProcessWatch> = new Map()  // key: `${name}:${pid}`
  private baseline: BaselineEngine
  private catalog: CatalogManager
  private currentContext: ContextName = 'unknown'
  private isRunning = false
  private evaluateIntervalId: ReturnType<typeof setInterval> | null = null
  private logger = getLogger()

  // Callbacks for performing actual system actions
  private throttleCallback: ((name: string, pid: number) => Promise<void>) | null = null
  private suspendCallback: ((name: string, pid: number) => Promise<void>) | null = null
  private killCallback: ((name: string, pid: number) => Promise<void>) | null = null

  constructor(baseline: BaselineEngine, catalog: CatalogManager) {
    super()
    this.baseline = baseline
    this.catalog = catalog
    this.rules = [...DEFAULT_RULES]
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    // Evaluate watches every 10s
    this.evaluateIntervalId = setInterval(() => this.evaluateAll(), 10_000)
    this.logger.info('SniperEngine started', { ruleCount: this.rules.length })
  }

  stop(): void {
    if (!this.isRunning) return
    this.isRunning = false
    if (this.evaluateIntervalId !== null) {
      clearInterval(this.evaluateIntervalId)
      this.evaluateIntervalId = null
    }
    this.logger.info('SniperEngine stopped')
  }

  setContext(context: ContextName): void {
    if (context !== this.currentContext) {
      this.currentContext = context
      // Clear watches on context change — baselines differ per context
      this.watches.clear()
    }
  }

  // Called by StatsCollector each poll with fresh process data
  ingest(processes: Array<{ name: string; pid: number; cpu_percent: number; memory_mb: number; handle_count: number }>): void {
    for (const proc of processes) {
      // Gate 1: catalog must know this process and allow action
      const catalogEntry = this.catalog.lookup(proc.name)
      if (catalogEntry === 'unknown' || catalogEntry === 'suspicious') continue

      // Gate 2: must have at least one action permitted
      const canThrottle = this.catalog.canActOn(proc.name, 'throttle')
      const canSuspend = this.catalog.canActOn(proc.name, 'suspend')
      const canKill = this.catalog.canActOn(proc.name, 'kill')
      if (!canThrottle && !canSuspend && !canKill) continue

      // Record baseline sample
      this.baseline.record({
        name: proc.name,
        cpu_percent: proc.cpu_percent,
        memory_mb: proc.memory_mb,
        handle_count: proc.handle_count,
        io_read_bytes_sec: 0,
        io_write_bytes_sec: 0,
        context: this.currentContext,
        timestamp: Date.now(),
      })

      // Get deviation vs personal baseline
      const deviation = this.baseline.getDeviation(
        proc.name,
        this.currentContext,
        proc.cpu_percent,
        proc.memory_mb,
        proc.handle_count
      )

      if (deviation === null || !deviation.baseline_reliable) continue
      if (deviation.max_zscore < DEVIATION_ZSCORE_THRESHOLD) {
        // Process recovered — clear watch if it was being watched
        const key = `${proc.name}:${proc.pid}`
        const watch = this.watches.get(key)
        if (watch !== null && watch !== undefined) {
          this.emit('event', {
            type: 'recovered',
            name: proc.name,
            pid: proc.pid,
            context: this.currentContext,
            reason: `Deviation cleared (max z-score: ${deviation.max_zscore.toFixed(1)})`,
            deviation,
            blast_radius: this.getBlastRadius(proc.name),
            timestamp: Date.now(),
          } satisfies SniperEvent)
          this.watches.delete(key)
        }
        continue
      }

      // Deviation detected — update or create watch
      const key = `${proc.name}:${proc.pid}`
      const existing = this.watches.get(key)
      if (existing === undefined) {
        this.watches.set(key, {
          name: proc.name,
          pid: proc.pid,
          context: this.currentContext,
          deviation,
          first_flagged_ms: Date.now(),
          last_action_ms: null,
          last_action: null,
          escalation_state: 'watching',
          action_count: 0,
        })
        this.emit('event', {
          type: 'flagged',
          name: proc.name,
          pid: proc.pid,
          context: this.currentContext,
          reason: `${deviation.max_zscore.toFixed(1)}x above personal baseline in ${this.currentContext} context`,
          deviation,
          blast_radius: this.getBlastRadius(proc.name),
          timestamp: Date.now(),
        } satisfies SniperEvent)
      } else {
        existing.deviation = deviation
      }
    }
  }

  onThrottle(cb: (name: string, pid: number) => Promise<void>): void {
    this.throttleCallback = cb
  }

  onSuspend(cb: (name: string, pid: number) => Promise<void>): void {
    this.suspendCallback = cb
  }

  onKill(cb: (name: string, pid: number) => Promise<void>): void {
    this.killCallback = cb
  }

  addRule(rule: SniperRule): void {
    this.rules = this.rules.filter(r => r.id !== rule.id)
    this.rules.push(rule)
  }

  removeRule(id: string): void {
    this.rules = this.rules.filter(r => r.id !== id)
  }

  getRules(): SniperRule[] {
    return [...this.rules]
  }

  getActiveWatches(): ProcessWatch[] {
    return [...this.watches.values()]
  }

  // ── Private ──────────────────────────────────────────────

  private evaluateAll(): void {
    for (const [key, watch] of this.watches) {
      this.evaluateWatch(key, watch)
    }
  }

  private evaluateWatch(key: string, watch: ProcessWatch): void {
    const now = Date.now()
    const sustainedSec = (now - watch.first_flagged_ms) / 1000
    const blastRadius = this.getBlastRadius(watch.name)

    // Never act on critical blast radius processes automatically
    if (blastRadius === 'critical') {
      this.emitDeferred(watch, 'Critical blast radius — manual action required')
      return
    }

    // Find matching rule
    const rule = this.findRule(watch.name, watch.deviation.max_zscore)
    if (rule === null) return

    // Context exemption check
    if (rule.context_exemptions.includes(this.currentContext)) {
      this.emitDeferred(watch, `Context exemption active: ${this.currentContext}`)
      return
    }

    // Cooldown check
    if (watch.last_action_ms !== null) {
      const cooldownMs = rule.cooldown_min * 60 * 1000
      if (now - watch.last_action_ms < cooldownMs) return
    }

    // Duration check — adjusted by blast radius multiplier
    const multiplier = BLAST_DURATION_MULTIPLIER[blastRadius]
    const requiredSec = rule.duration_sec * multiplier
    if (sustainedSec < requiredSec) return

    // All gates passed — determine action
    const action = this.nextAction(watch, rule)
    if (action === null) return

    // Verify catalog still permits this action
    if (!this.catalog.canActOn(watch.name, action as 'throttle' | 'suspend' | 'kill')) {
      this.emitDeferred(watch, `Catalog gate: ${action} not permitted for ${watch.name}`)
      return
    }

    void this.executeAction(watch, action, blastRadius, rule)
  }

  private findRule(name: string, zscore: number): SniperRule | null {
    const normalized = name.toLowerCase().replace(/\.exe$/i, '')
    // Most specific match first (non-empty pattern), then catch-all
    const specific = this.rules.find(r =>
      r.enabled && r.target_pattern !== '' &&
      normalized.includes(r.target_pattern) &&
      zscore >= r.zscore_trigger
    )
    if (specific !== undefined) return specific

    const catchAll = this.rules.find(r =>
      r.enabled && r.target_pattern === '' && zscore >= r.zscore_trigger
    )
    return catchAll ?? null
  }

  private nextAction(watch: ProcessWatch, rule: SniperRule): SniperAction | null {
    // Graduated escalation: throttle → suspend → kill
    // Each subsequent action requires another full duration cycle
    if (watch.escalation_state === 'watching') {
      return rule.action === 'kill' ? 'kill'
        : rule.action === 'suspend' ? 'suspend'
        : 'throttle'
    }
    if (watch.escalation_state === 'throttled') {
      const canSuspend = this.catalog.canActOn(watch.name, 'suspend')
      return canSuspend ? 'suspend' : null
    }
    if (watch.escalation_state === 'suspended') {
      const canKill = this.catalog.canActOn(watch.name, 'kill')
      return canKill ? 'kill' : null
    }
    return null
  }

  private async executeAction(
    watch: ProcessWatch,
    action: SniperAction,
    blastRadius: BlastRadius,
    rule: SniperRule
  ): Promise<void> {
    const now = Date.now()
    watch.last_action_ms = now
    watch.last_action = action
    watch.action_count += 1
    watch.escalation_state = action === 'throttle' ? 'throttled'
      : action === 'suspend' ? 'suspended'
      : action === 'kill' ? 'killed'
      : watch.escalation_state

    const reason = [
      `${watch.deviation.max_zscore.toFixed(1)}σ above personal baseline`,
      `sustained ${Math.round((now - watch.first_flagged_ms) / 1000)}s`,
      `context: ${watch.context}`,
      `blast radius: ${blastRadius}`,
      `rule: ${rule.id}`,
    ].join(' · ')

    this.emit('event', {
      type: 'action_taken',
      name: watch.name,
      pid: watch.pid,
      context: watch.context,
      action,
      reason,
      deviation: watch.deviation,
      blast_radius: blastRadius,
      timestamp: now,
    } satisfies SniperEvent)

    this.logger.info('Sniper action', { action, name: watch.name, pid: watch.pid, reason })

    try {
      if (action === 'throttle' && this.throttleCallback !== null) {
        await this.throttleCallback(watch.name, watch.pid)
      } else if (action === 'suspend' && this.suspendCallback !== null) {
        await this.suspendCallback(watch.name, watch.pid)
      } else if (action === 'kill' && this.killCallback !== null) {
        await this.killCallback(watch.name, watch.pid)
      }
    } catch (error) {
      this.logger.error('Sniper action failed', { action, name: watch.name, error })
    }
  }

  private emitDeferred(watch: ProcessWatch, reason: string): void {
    this.emit('event', {
      type: 'deferred',
      name: watch.name,
      pid: watch.pid,
      context: watch.context,
      reason,
      deviation: watch.deviation,
      blast_radius: this.getBlastRadius(watch.name),
      timestamp: Date.now(),
    } satisfies SniperEvent)
  }

  private getBlastRadius(name: string): BlastRadius {
    const entry = this.catalog.lookup(name)
    if (entry === 'unknown' || entry === 'suspicious') return 'medium'
    return (entry.blast_radius_category as BlastRadius) ?? 'low'
  }
}
