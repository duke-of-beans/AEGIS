// ============================================================
// AEGIS Rich MCP Publisher — v3
// Exposes the full intelligence stack to GREGORE, GregLite,
// and any other MCP consumer.
// AEGIS is the sensory organ. This is the nervous system.
// ============================================================

import { getLogger } from '../logger/index.js'
import { StatusServer } from '../status/server.js'
import { ProfileManager } from '../profiles/manager.js'
import { ProfileTimer } from '../profiles/timer.js'
import type { ContextEngine } from '../context/engine.js'
import type { PolicyManager } from '../context/policies.js'
import type { SniperEngine } from '../sniper/engine.js'
import type { LearningStore } from '../learning/store.js'
import type { CognitiveLoadEngine } from '../learning/load.js'
import type { WorkerRequest, WorkerResponse } from '../config/types.js'

// ============================================================
// Tool Definitions
// ============================================================

const TOOLS = [
  {
    name: 'aegis_get_cognitive_load',
    description: 'Get the current cognitive load score (0-100) and breakdown. Use this to understand machine pressure before spawning resource-intensive work.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'aegis_get_context',
    description: 'Get the current detected context (deep_work, build, research, meeting, gaming, idle, unknown) and active policy overlays.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'aegis_get_system_snapshot',
    description: 'Get a full system snapshot including CPU, RAM, disk, network, GPU, process tree, browser tabs, and sniper watch status.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'aegis_get_process_tree',
    description: 'Get the full process spawn tree. Shows parent-child relationships, memory, CPU, handle counts. Essential for identifying runaway node processes.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'aegis_get_runaways',
    description: 'Get all processes currently flagged as deviating from their personal baseline. Includes deviation z-score, context, and current escalation state.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'aegis_get_action_log',
    description: 'Get recent sniper actions taken by AEGIS — what was throttled, suspended, or killed, why, and when.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max entries to return (default: 10)' },
      },
    },
  },
  {
    name: 'aegis_get_confidence',
    description: 'Get AEGIS confidence state — current score, total decisions, auto mode unlock status, and decisions remaining.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'aegis_get_session_summary',
    description: 'Get the current or most recent work session summary — duration, average cognitive load, actions taken, memory recovered.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'aegis_apply_policy_overlay',
    description: 'Programmatically apply a named context overlay. Useful for GREGORE to pre-configure the machine before starting a sprint.',
    input_schema: {
      type: 'object',
      properties: {
        context: {
          type: 'string',
          description: 'Context name to apply overlays for: deep_work, build, research, meeting, gaming, idle',
        },
      },
      required: ['context'],
    },
  },
  {
    name: 'aegis_preflight',
    description: 'Request a preflight optimization for a given context. Returns what AEGIS would do and applies it. Use before starting intensive work.',
    input_schema: {
      type: 'object',
      properties: {
        context: { type: 'string', description: 'Target context: deep_work, build, research, meeting' },
        apply: { type: 'boolean', description: 'If true, apply the changes. If false, just preview.' },
      },
      required: ['context'],
    },
  },
  {
    name: 'aegis_status',
    description: 'Get a concise AEGIS health summary — version, context, cognitive load tier, sniper watches, confidence score.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'aegis_switch_profile',
    description: 'Switch to a named resource profile.',
    input_schema: {
      type: 'object',
      properties: { profile_name: { type: 'string' } },
      required: ['profile_name'],
    },
  },
  {
    name: 'aegis_set_timer',
    description: 'Set a profile timer that switches back after a duration.',
    input_schema: {
      type: 'object',
      properties: {
        target_profile: { type: 'string' },
        return_profile: { type: 'string' },
        duration_min: { type: 'number' },
      },
      required: ['target_profile', 'return_profile', 'duration_min'],
    },
  },
  {
    name: 'aegis_cancel_timer',
    description: 'Cancel active profile timer.',
    input_schema: { type: 'object', properties: {} },
  },
]

// ============================================================
// McpServer
// ============================================================

export class McpServer {
  private statusServer: StatusServer
  private profileManager: ProfileManager
  private timer: ProfileTimer
  private contextEngine: ContextEngine | null = null
  private policyManager: PolicyManager | null = null
  private sniperEngine: SniperEngine | null = null
  private learningStore: LearningStore | null = null
  private loadEngine: CognitiveLoadEngine | null = null
  private logger = getLogger()

  constructor(
    statusServer: StatusServer,
    profileManager: ProfileManager,
    timer: ProfileTimer
  ) {
    this.statusServer = statusServer
    this.profileManager = profileManager
    this.timer = timer
  }

  // Wire in v3 intelligence engines after construction
  setIntelligence(deps: {
    contextEngine: ContextEngine
    policyManager: PolicyManager
    sniperEngine: SniperEngine
    learningStore: LearningStore
    loadEngine: CognitiveLoadEngine
  }): void {
    this.contextEngine = deps.contextEngine
    this.policyManager = deps.policyManager
    this.sniperEngine = deps.sniperEngine
    this.learningStore = deps.learningStore
    this.loadEngine = deps.loadEngine
  }

  startStdio(): void {
    let inputBuffer = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk): void => {
      void (async (): Promise<void> => {
        inputBuffer += String(chunk)
        const lines = inputBuffer.split('\n')
        inputBuffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.trim() === '') continue
          try {
            const request = JSON.parse(line) as WorkerRequest
            const response = await this.handle(request)
            process.stdout.write(JSON.stringify(response) + '\n')
          } catch (error) {
            this.logger.error('MCP stdio error', { error })
          }
        }
      })()
    })
    this.logger.info('MCP stdio started — v3 tools active')
  }

  async stop(): Promise<void> {
    // nothing to clean up for stdio mode
  }

  // ── Request handler ───────────────────────────────────────

  private async handle(req: WorkerRequest): Promise<WorkerResponse> {
    try {
      switch (req.method) {
        case 'initialize':
          return this.ok(req.id, {
            capabilities: { tools: true },
            server_info: { name: 'AEGIS', version: '3.0.0' },
          })

        case 'tools/list':
          return this.ok(req.id, { tools: TOOLS })

        case 'tools/call': {
          const p = req.params as Record<string, unknown> | undefined
          const name = p?.name as string | undefined
          const args = (p?.arguments ?? {}) as Record<string, unknown>
          return await this.callTool(req.id, name ?? '', args)
        }

        default:
          return this.err(req.id, -32601, 'Method not found')
      }
    } catch (error) {
      this.logger.error('MCP handle error', { method: req.method, error })
      return this.err(req.id, -32603, 'Internal error')
    }
  }

  private async callTool(id: string, name: string, args: Record<string, unknown>): Promise<WorkerResponse> {
    const snapshot = (this.statusServer as unknown as { snapshot: unknown })['snapshot'] as Record<string, unknown> | null

    switch (name) {

      case 'aegis_status': {
        const cl = snapshot?.['cognitive_load'] as { score: number; tier: string } | undefined
        const ctx = snapshot?.['context'] as { current: string; confidence: number } | undefined
        const sn = snapshot?.['sniper'] as { active_watches: number } | undefined
        const conf = snapshot?.['confidence'] as { score: number; auto_mode_unlocked: boolean } | undefined
        return this.ok(id, {
          version: '3.0.0',
          context: ctx?.current ?? 'unknown',
          context_confidence: ctx?.confidence ?? 0,
          cognitive_load: cl?.score ?? 0,
          cognitive_load_tier: cl?.tier ?? 'green',
          active_watches: sn?.active_watches ?? 0,
          confidence_score: conf?.score ?? 0,
          auto_mode_unlocked: conf?.auto_mode_unlocked ?? false,
        })
      }

      case 'aegis_get_cognitive_load': {
        const cl = snapshot?.['cognitive_load'] as Record<string, unknown> | undefined
        if (!cl) return this.ok(id, { available: false })
        return this.ok(id, {
          available: true,
          score: cl['score'],
          tier: cl['tier'],
          cpu_pressure: cl['cpu_pressure'],
          memory_pressure: cl['memory_pressure'],
          disk_queue_pressure: cl['disk_queue_pressure'],
          dpc_pressure: cl['dpc_pressure'],
          interpretation: this.interpretLoad(cl['score'] as number),
        })
      }

      case 'aegis_get_context': {
        const ctx = snapshot?.['context'] as Record<string, unknown> | undefined
        if (!ctx) return this.ok(id, { available: false })
        return this.ok(id, {
          available: true,
          current: ctx['current'],
          previous: ctx['previous'],
          confidence: ctx['confidence'],
          switched_at: ctx['switched_at'],
          idle_since: ctx['idle_since'],
          active_overlays: ctx['active_overlays'],
        })
      }

      case 'aegis_get_system_snapshot': {
        return this.ok(id, snapshot ?? {})
      }

      case 'aegis_get_process_tree': {
        const tree = snapshot?.['process_tree'] as unknown[] | undefined
        return this.ok(id, {
          available: (tree?.length ?? 0) > 0,
          count: tree?.length ?? 0,
          tree: tree ?? [],
        })
      }

      case 'aegis_get_runaways': {
        const watches = this.sniperEngine?.getActiveWatches() ?? []
        return this.ok(id, {
          count: watches.length,
          runaways: watches.map(w => ({
            name: w.name,
            pid: w.pid,
            context: w.context,
            zscore: w.deviation.max_zscore,
            cpu_ratio: w.deviation.cpu_ratio,
            memory_ratio: w.deviation.memory_ratio,
            escalation_state: w.escalation_state,
            sustained_sec: Math.round((Date.now() - w.first_flagged_ms) / 1000),
            last_action: w.last_action,
          })),
        })
      }

      case 'aegis_get_action_log': {
        const limit = typeof args['limit'] === 'number' ? args['limit'] : 10
        const sn = snapshot?.['sniper'] as { recent_actions: unknown[] } | undefined
        const actions = (sn?.recent_actions ?? []).slice(0, limit)
        return this.ok(id, {
          count: actions.length,
          actions,
        })
      }

      case 'aegis_get_confidence': {
        if (!this.learningStore) return this.ok(id, { available: false })
        const conf = this.learningStore.getConfidenceState()
        return this.ok(id, { available: true, ...conf })
      }

      case 'aegis_get_session_summary': {
        if (!this.learningStore) return this.ok(id, { available: false })
        const sessions = this.learningStore.getRecentSessions(1)
        const best = this.learningStore.getBestSession()
        const current = sessions[0] ?? null
        return this.ok(id, {
          available: current !== null,
          current_session: current,
          best_session: best,
        })
      }

      case 'aegis_apply_policy_overlay': {
        const context = args['context'] as string | undefined
        if (!context || !this.policyManager) {
          return this.err(id, -32602, 'Missing context or policy manager not available')
        }
        const validContexts = ['deep_work', 'build', 'research', 'meeting', 'gaming', 'idle', 'unknown']
        if (!validContexts.includes(context)) {
          return this.err(id, -32602, `Invalid context. Valid: ${validContexts.join(', ')}`)
        }
        this.policyManager.applyContextOverlays(context as import('../context/engine.js').ContextName)
        const stack = this.policyManager.getStack()
        return this.ok(id, {
          success: true,
          context,
          active_overlays: stack.overlays.map(o => ({ id: o.id, name: o.name, domain: o.domain })),
        })
      }

      case 'aegis_preflight': {
        const context = args['context'] as string | undefined
        const apply = args['apply'] !== false  // default true
        if (!context) return this.err(id, -32602, 'Missing context')

        const snapshot_ = snapshot ?? {}
        const cl = snapshot_['cognitive_load'] as { score: number } | undefined
        const tabs = snapshot_['browser_tabs'] as { active: number; suspended: number } | undefined
        const watches = this.sniperEngine?.getActiveWatches() ?? []

        const proposed: string[] = []
        if ((tabs?.active ?? 0) > 5) proposed.push(`Suspend ${(tabs?.active ?? 0) - 2} inactive browser tabs`)
        if (watches.length > 0) proposed.push(`${watches.length} runaway processes being monitored — sniper active`)
        if ((cl?.score ?? 0) > 50) proposed.push('Cognitive load elevated — recommend closing non-essential apps')
        if (context === 'build' || context === 'deep_work') {
          proposed.push('Apply SearchIndexer throttle')
          proposed.push('Apply DiagTrack (telemetry) throttle')
        }

        if (apply && this.policyManager) {
          this.policyManager.applyContextOverlays(context as import('../context/engine.js').ContextName)
        }

        return this.ok(id, {
          context,
          applied: apply,
          cognitive_load_before: cl?.score ?? 0,
          proposed_actions: proposed,
          overlays_applied: apply ? (this.policyManager?.getStack().overlays.map(o => o.name) ?? []) : [],
        })
      }

      case 'aegis_switch_profile': {
        const profileName = args['profile_name']
        if (typeof profileName !== 'string') return this.err(id, -32602, 'Missing profile_name')
        await this.profileManager.switchProfile(profileName)
        return this.ok(id, { success: true, profile: profileName })
      }

      case 'aegis_set_timer': {
        const target = args['target_profile']
        const ret = args['return_profile']
        const dur = args['duration_min']
        if (typeof target !== 'string' || typeof ret !== 'string' || typeof dur !== 'number') {
          return this.err(id, -32602, 'Missing required parameters')
        }
        this.timer.start(target, ret, dur)
        return this.ok(id, { success: true })
      }

      case 'aegis_cancel_timer': {
        this.timer.cancel()
        return this.ok(id, { success: true })
      }

      default:
        return this.err(id, -32601, `Unknown tool: ${name}`)
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  private ok(id: string, result: unknown): WorkerResponse {
    return { jsonrpc: '2.0', id, result: result as Record<string, unknown> }
  }

  private err(id: string, code: number, message: string): WorkerResponse {
    return { jsonrpc: '2.0', id, error: { code, message } }
  }

  private interpretLoad(score: number): string {
    if (score <= 20) return 'Machine is idle — good time to spawn intensive work'
    if (score <= 40) return 'Machine is healthy — normal operation'
    if (score <= 60) return 'Moderate load — proceed with care'
    if (score <= 80) return 'High load — consider deferring non-essential tasks'
    return 'Critical load — machine is under significant pressure'
  }
}
