// ============================================================
// AEGIS Sniper Rules Engine — SNP-05
// Adds: instance count deviation, OR-pattern rules, 3 new default rules.
// ============================================================

import { EventEmitter } from 'events'
import { getLogger } from '../logger/index.js'
import type { ContextName } from '../context/engine.js'
import type { DeviationReport, BaselineEngine } from './baseline.js'
import type { CatalogManager } from '../catalog/manager.js'
import { DEVIATION_ZSCORE_THRESHOLD } from './baseline.js'

export type SniperAction = 'throttle' | 'suspend' | 'kill' | 'notify'
export type BlastRadius = 'none' | 'low' | 'medium' | 'high' | 'critical'

export interface SniperRule {
  id: string
  target_pattern: string       // substring OR pipe-separated alternatives e.g. "claude|discord|slack"
  zscore_trigger: number
  duration_sec: number
  action: SniperAction
  cooldown_min: number
  context_exemptions: ContextName[]
  enabled: boolean
  user_defined: boolean
}

export type EscalationState = 'watching' | 'throttled' | 'suspended' | 'killed'

export interface ProcessWatch {
  name: string; pid: number; context: ContextName
  deviation: DeviationReport
  first_flagged_ms: number; last_action_ms: number | null
  last_action: SniperAction | null; escalation_state: EscalationState
  action_count: number
}

export interface SniperEvent {
  type: 'flagged' | 'action_taken' | 'recovered' | 'deferred'
  name: string; pid: number; context: ContextName
  action?: SniperAction; reason: string
  deviation: DeviationReport; blast_radius: BlastRadius; timestamp: number
}

// ── Default rules (6 total — 3 original + 3 new from SNP-05) ──────────────
export const DEFAULT_RULES: SniperRule[] = [
  {
    id: 'node-runaway',
    target_pattern: 'node',
    zscore_trigger: DEVIATION_ZSCORE_THRESHOLD,
    duration_sec: 120,
    action: 'throttle',
    cooldown_min: 10,
    context_exemptions: ['build'],
    enabled: true, user_defined: false,
  },
  {
    id: 'searchindexer-hog',
    target_pattern: 'searchindexer',
    zscore_trigger: 1.5,
    duration_sec: 60,
    action: 'throttle',
    cooldown_min: 5,
    context_exemptions: [],
    enabled: true, user_defined: false,
  },
  {
    id: 'generic-runaway',
    target_pattern: '',
    zscore_trigger: 3.0,
    duration_sec: 300,
    action: 'throttle',
    cooldown_min: 15,
    context_exemptions: ['build', 'gaming', 'media'],
    enabled: true, user_defined: false,
  },
  // ── SNP-05 additions ────────────────────────────────────
  {
    id: 'msmpeng-spike',
    target_pattern: 'msmpeng',
    zscore_trigger: 2.0,
    duration_sec: 120,
    action: 'throttle',
    cooldown_min: 30,
    context_exemptions: [],
    enabled: true, user_defined: false,
  },
  {
    id: 'searchhost-inflation',
    target_pattern: 'searchhost',
    zscore_trigger: 1.5,
    duration_sec: 60,
    action: 'throttle',
    cooldown_min: 10,
    context_exemptions: [],
    enabled: true, user_defined: false,
  },
  {
    id: 'electron-process-sprawl',
    target_pattern: 'claude|discord|slack|code',  // OR pattern — SNP-05
    zscore_trigger: 2.0,
    duration_sec: 30,
    action: 'notify',   // NEVER auto-kill Electron apps — user must decide
    cooldown_min: 60,
    context_exemptions: [],
    enabled: true, user_defined: false,
  },
]

const BLAST_DURATION_MULTIPLIER: Record<BlastRadius, number> = {
  none: 1.0, low: 1.5, medium: 2.0, high: 3.0, critical: 999,
}

const CONTEXT_THRESHOLD_MULTIPLIER: Record<string, number> = {
  deep_work: 1.5, build: 2.0, meeting: 0.7,
  gaming: 0.8, media: 0.8, idle: 0.5,
}

const BUILD_EXEMPT_PROCESSES = [
  'node', 'npm', 'npx', 'cargo', 'rustc', 'tsc', 'msbuild', 'python', 'python3', 'gradle', 'mvn',
]

export class SniperEngine extends EventEmitter {
  private rules: SniperRule[]
  private watches: Map<string, ProcessWatch> = new Map()
  private baseline: BaselineEngine
  private catalog: CatalogManager
  private currentContext: ContextName = 'unknown'
  private isRunning = false
  private evaluateIntervalId: ReturnType<typeof setInterval> | null = null
  private logger = getLogger()
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
    this.evaluateIntervalId = setInterval(() => this.evaluateAll(), 10_000)
    this.logger.info('SniperEngine started', { ruleCount: this.rules.length })
  }

  stop(): void {
    if (!this.isRunning) return
    this.isRunning = false
    if (this.evaluateIntervalId !== null) { clearInterval(this.evaluateIntervalId); this.evaluateIntervalId = null }
    this.logger.info('SniperEngine stopped')
  }

  setContext(context: ContextName): void {
    if (context !== this.currentContext) { this.currentContext = context; this.watches.clear() }
  }

  getContextMultiplier(context: string): number {
    return CONTEXT_THRESHOLD_MULTIPLIER[context] ?? 1.0
  }

  shouldExempt(name: string, context: string): boolean {
    if (context !== 'build') return false
    const normalized = name.toLowerCase().replace(/\.exe$/i, '')
    return BUILD_EXEMPT_PROCESSES.some(p => normalized === p || normalized.startsWith(p))
  }

  // SNP-05: ingest now aggregates instance counts before per-process baseline recording
  ingest(processes: Array<{ name: string; pid: number; cpu_percent: number; memory_mb: number; handle_count: number }>): void {
    // Pre-aggregate instance counts
    const instanceCounts = new Map<string, number>()
    for (const proc of processes) {
      const key = proc.name.toLowerCase().replace(/\.exe$/i, '')
      instanceCounts.set(key, (instanceCounts.get(key) ?? 0) + 1)
    }

    // Deduplicate by name for deviation check (use first instance per name)
    const seen = new Set<string>()

    for (const proc of processes) {
      const catalogEntry = this.catalog.lookup(proc.name)
      if (catalogEntry === 'unknown' || catalogEntry === 'suspicious') continue
      const canThrottle = this.catalog.canActOn(proc.name, 'throttle')
      const canSuspend  = this.catalog.canActOn(proc.name, 'suspend')
      const canKill     = this.catalog.canActOn(proc.name, 'kill')
      if (!canThrottle && !canSuspend && !canKill) continue

      const normalized = proc.name.toLowerCase().replace(/\.exe$/i, '')
      const instanceCount = instanceCounts.get(normalized) ?? 1

      // Record baseline sample with instance count
      this.baseline.record({
        name: proc.name,
        cpu_percent: proc.cpu_percent,
        memory_mb: proc.memory_mb,
        handle_count: proc.handle_count,
        instance_count: instanceCount,
        io_read_bytes_sec: 0,
        io_write_bytes_sec: 0,
        context: this.currentContext,
        timestamp: Date.now(),
      })

      // Only check deviation once per process name per ingest cycle
      if (seen.has(normalized)) continue
      seen.add(normalized)

      const deviation = this.baseline.getDeviation(
        proc.name, this.currentContext,
        proc.cpu_percent, proc.memory_mb, proc.handle_count, instanceCount
      )
      if (deviation === null || !deviation.baseline_reliable) continue

      const effectiveThreshold = DEVIATION_ZSCORE_THRESHOLD * this.getContextMultiplier(this.currentContext)

      if (deviation.max_zscore < effectiveThreshold) {
        const key = `${proc.name}:${proc.pid}`
        const watch = this.watches.get(key)
        if (watch !== null && watch !== undefined) {
          this.emit('event', { type: 'recovered', name: proc.name, pid: proc.pid, context: this.currentContext, reason: `Deviation cleared (max z-score: ${deviation.max_zscore.toFixed(1)})`, deviation, blast_radius: this.getBlastRadius(proc.name), timestamp: Date.now() } satisfies SniperEvent)
          this.watches.delete(key)
        }
        continue
      }

      const key = `${proc.name}:${proc.pid}`
      const existing = this.watches.get(key)
      if (existing === undefined) {
        this.watches.set(key, { name: proc.name, pid: proc.pid, context: this.currentContext, deviation, first_flagged_ms: Date.now(), last_action_ms: null, last_action: null, escalation_state: 'watching', action_count: 0 })
        const isSprawl = deviation.instance_zscore > DEVIATION_ZSCORE_THRESHOLD
        const reason = isSprawl
          ? `${instanceCount} instances (${deviation.instance_zscore.toFixed(1)}σ above baseline of ${deviation.instance_ratio > 0 ? (instanceCount / deviation.instance_ratio).toFixed(1) : '?'})`
          : `${deviation.max_zscore.toFixed(1)}σ above personal baseline in ${this.currentContext} context`
        this.emit('event', { type: 'flagged', name: proc.name, pid: proc.pid, context: this.currentContext, reason, deviation, blast_radius: this.getBlastRadius(proc.name), timestamp: Date.now() } satisfies SniperEvent)
      } else {
        existing.deviation = deviation
      }
    }
  }

  onThrottle(cb: (name: string, pid: number) => Promise<void>): void { this.throttleCallback = cb }
  onSuspend(cb: (name: string, pid: number) => Promise<void>): void { this.suspendCallback = cb }
  onKill(cb: (name: string, pid: number) => Promise<void>): void { this.killCallback = cb }
  addRule(rule: SniperRule): void { this.rules = this.rules.filter(r => r.id !== rule.id); this.rules.push(rule) }
  removeRule(id: string): void { this.rules = this.rules.filter(r => r.id !== id) }
  getRules(): SniperRule[] { return [...this.rules] }
  getActiveWatches(): ProcessWatch[] { return [...this.watches.values()] }

  private evaluateAll(): void {
    for (const [key, watch] of this.watches) this.evaluateWatch(key, watch)
  }

  private evaluateWatch(key: string, watch: ProcessWatch): void {
    const now = Date.now()
    const sustainedSec = (now - watch.first_flagged_ms) / 1000
    const blastRadius = this.getBlastRadius(watch.name)
    if (blastRadius === 'critical') { this.emitDeferred(watch, 'Critical blast radius — manual action required'); return }
    if (this.shouldExempt(watch.name, this.currentContext)) { this.emitDeferred(watch, `[exempt: build context]`); return }
    const rule = this.findRule(watch.name, watch.deviation.max_zscore)
    if (rule === null) return
    if (rule.context_exemptions.includes(this.currentContext)) { this.emitDeferred(watch, `Context exemption: ${this.currentContext}`); return }
    if (watch.last_action_ms !== null && now - watch.last_action_ms < rule.cooldown_min * 60 * 1000) return
    const requiredSec = rule.duration_sec * BLAST_DURATION_MULTIPLIER[blastRadius]
    if (sustainedSec < requiredSec) return
    const action = this.nextAction(watch, rule)
    if (action === null) return
    if (action !== 'notify' && !this.catalog.canActOn(watch.name, action as 'throttle' | 'suspend' | 'kill')) { this.emitDeferred(watch, `Catalog gate: ${action} not permitted`); return }
    void this.executeAction(watch, action, blastRadius, rule)
  }

  // SNP-05: supports pipe-separated OR patterns e.g. "claude|discord|slack"
  private findRule(name: string, zscore: number): SniperRule | null {
    const normalized = name.toLowerCase().replace(/\.exe$/i, '')
    const effectiveZscore = zscore / this.getContextMultiplier(this.currentContext)

    // Specific rules first (non-empty, non-catch-all)
    const specific = this.rules.find(r => {
      if (!r.enabled || r.target_pattern === '') return false
      const patterns = r.target_pattern.split('|')
      return patterns.some(p => normalized.includes(p)) && effectiveZscore >= r.zscore_trigger
    })
    if (specific !== undefined) return specific

    // Catch-all
    return this.rules.find(r => r.enabled && r.target_pattern === '' && effectiveZscore >= r.zscore_trigger) ?? null
  }

  private nextAction(watch: ProcessWatch, rule: SniperRule): SniperAction | null {
    if (watch.escalation_state === 'watching') return rule.action === 'kill' ? 'kill' : rule.action === 'suspend' ? 'suspend' : rule.action === 'notify' ? 'notify' : 'throttle'
    if (watch.escalation_state === 'throttled') return this.catalog.canActOn(watch.name, 'suspend') ? 'suspend' : null
    if (watch.escalation_state === 'suspended') return this.catalog.canActOn(watch.name, 'kill') ? 'kill' : null
    return null
  }

  private async executeAction(watch: ProcessWatch, action: SniperAction, blastRadius: BlastRadius, rule: SniperRule): Promise<void> {
    const now = Date.now()
    watch.last_action_ms = now; watch.last_action = action; watch.action_count += 1
    watch.escalation_state = action === 'throttle' ? 'throttled' : action === 'suspend' ? 'suspended' : action === 'kill' ? 'killed' : watch.escalation_state
    const reason = [`${watch.deviation.max_zscore.toFixed(1)}σ above personal baseline`, `sustained ${Math.round((now - watch.first_flagged_ms) / 1000)}s`, `context: ${watch.context}`, `blast: ${blastRadius}`, `rule: ${rule.id}`].join(' · ')
    this.emit('event', { type: 'action_taken', name: watch.name, pid: watch.pid, context: watch.context, action, reason, deviation: watch.deviation, blast_radius: blastRadius, timestamp: now } satisfies SniperEvent)
    this.logger.info('Sniper action', { action, name: watch.name, pid: watch.pid, reason })
    try {
      if (action === 'throttle' && this.throttleCallback) await this.throttleCallback(watch.name, watch.pid)
      else if (action === 'suspend' && this.suspendCallback) await this.suspendCallback(watch.name, watch.pid)
      else if (action === 'kill' && this.killCallback) await this.killCallback(watch.name, watch.pid)
      // notify: event already emitted above — Rust relays to cockpit toast
    } catch (error) {
      this.logger.error('Sniper action failed', { action, name: watch.name, error })
    }
  }

  private emitDeferred(watch: ProcessWatch, reason: string): void {
    this.emit('event', { type: 'deferred', name: watch.name, pid: watch.pid, context: watch.context, reason, deviation: watch.deviation, blast_radius: this.getBlastRadius(watch.name), timestamp: Date.now() } satisfies SniperEvent)
  }

  private getBlastRadius(name: string): BlastRadius {
    const entry = this.catalog.lookup(name)
    if (entry === 'unknown' || entry === 'suspicious') return 'medium'
    return (entry.blast_radius_category as BlastRadius) ?? 'low'
  }
}
