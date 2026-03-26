// AEGIS Intelligence Sidecar — entry point v4
// JSON-RPC 2.0 over stdin/stdout. No HTTP server.
// Engines: context detection, sniper, learning store, catalog, cognitive load

import * as readline from 'readline'
import * as path from 'path'
import * as os from 'os'

const VERSION = '4.0.0'

// MCP server (launched via --mcp flag)
import type { McpEngines } from './mcp/server.js'

// ── Logger setup ─────────────────────────────────────────────────────────────
// Lightweight logger — write JSON lines to stderr (Rust reads it) and file
const logPath = path.join(os.homedir(), 'AppData', 'Roaming', 'AEGIS', 'sidecar.log')

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...data })
  process.stderr.write(entry + '\n')
}

// ── Engine imports ────────────────────────────────────────────────────────────
// Use require-style dynamic imports for CommonJS compatibility
let contextEngine: any = null
let sniperEngine: any = null
let catalogManager: any = null
let loadEngine: any = null
let learningStore: any = null
let policyManager: any = null

// Track which action_ids have received explicit feedback (to skip implicit approval)
const feedbackReceived = new Set<string>()

async function initEngines(): Promise<void> {
  try {
    const { ContextEngine } = require('./context/engine')
    contextEngine = new ContextEngine()

    contextEngine.on('context_changed', (evt: any) => {
      writeEvent({
        type: 'context_changed',
        context: evt.to,
        previous: evt.from,
        confidence: evt.confidence,
        timestamp: new Date().toISOString(),
      })
      // Keep sniper context in sync
      if (sniperEngine?.setContext) sniperEngine.setContext(evt.to)
      // Apply policy overlays for new context
      if (policyManager?.applyContextOverlays) {
        try {
          policyManager.applyContextOverlays(evt.to)
          writeEvent({
            type: 'policies_updated',
            context: evt.to,
            overlays: policyManager.getStack().overlays.map((p: any) => ({
              id: p.id,
              name: p.name,
              domain: p.domain,
            })),
            timestamp: new Date().toISOString(),
          })
        } catch (e: any) {
          log('warn', 'applyContextOverlays failed', { err: e.message })
        }
      }
    })

    contextEngine.start()
    log('info', 'ContextEngine started')
  } catch (e: any) {
    log('warn', 'ContextEngine unavailable — running without context detection', { err: e.message })
  }

  try {
    const { PolicyManager } = require('./context/policies')
    policyManager = new PolicyManager()
    log('info', 'PolicyManager started')
  } catch (e: any) {
    log('warn', 'PolicyManager unavailable', { err: e.message })
  }

  try {
    const { CognitiveLoadEngine } = require('./learning/load')
    loadEngine = new CognitiveLoadEngine()
    log('info', 'CognitiveLoadEngine started')
  } catch (e: any) {
    log('warn', 'CognitiveLoadEngine unavailable', { err: e.message })
  }

  try {
    const { CatalogManager } = require('./catalog/manager')
    const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming')
    catalogManager = new CatalogManager(appDataPath)
    catalogManager.seedIfEmpty()
    log('info', 'CatalogManager ready')
  } catch (e: any) {
    log('warn', 'CatalogManager unavailable', { err: e.message })
  }

  try {
    const { initLearningStore } = require('./learning/store')
    const lsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'AEGIS')
    learningStore = initLearningStore(lsPath)
    learningStore.start()
    // Start a session using current context (or default)
    const ctx = contextEngine?.getState()?.current ?? 'unknown'
    learningStore.startSession(ctx)
    log('info', 'LearningStore started')
  } catch (e: any) {
    log('warn', 'LearningStore unavailable', { err: e.message })
  }

  try {
    const { SniperEngine } = require('./sniper/engine')
    const { BaselineEngine } = require('./sniper/baseline')
    const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'AEGIS', 'baseline.db')
    const baseline = new BaselineEngine(dbPath)
    baseline.start()
    log('info', 'BaselineEngine started', { dbPath })

    // CatalogManager may not be available yet — pass null-safe proxy
    sniperEngine = new SniperEngine(baseline, catalogManager ?? { lookup: () => null, canActOn: () => false })

    sniperEngine.on('event', (evt: any) => {
      if (evt.type === 'action_taken') {
        const actionTimestamp = new Date().toISOString()
        // Record the action in LearningStore if available
        let actionId: string | null = null
        if (learningStore) {
          try {
            const ctx = contextEngine?.getState()?.current ?? 'unknown'
            actionId = learningStore.recordAction({
              processName: evt.name,
              action: evt.action,
              context: ctx,
              zscoreAtAction: evt.zscore ?? 0,
              cpuBefore: evt.cpu_before ?? 0,
              memoryBefore: evt.memory_before ?? 0,
            })
          } catch (e: any) {
            log('warn', 'recordAction failed', { err: e.message })
          }
        }

        const eventPayload = {
          type: 'sniper_action_requested',
          pid: evt.pid,
          name: evt.name,
          action: evt.action,
          reason: evt.reason ?? '',
          action_id: actionId ?? '',
          timestamp: actionTimestamp,
        }
        writeEvent(eventPayload)

        // Implicit approval: if no explicit feedback within 60s, record mild positive
        if (actionId && learningStore) {
          const capturedActionId = actionId
          setTimeout(() => {
            if (!feedbackReceived.has(capturedActionId)) {
              try {
                learningStore.updateActionOutcome(capturedActionId, 0, 0, null)
                log('info', 'Implicit approval recorded', { action_id: capturedActionId })
                const score = Math.round(learningStore.getConfidenceState().confidence_score * 100)
                const state = learningStore.getConfidenceState()
                writeEvent({
                  type: 'confidence_updated',
                  score,
                  auto_mode_unlocked: state.auto_mode_unlocked,
                  decisions_until_auto: state.decisions_until_auto,
                  timestamp: new Date().toISOString(),
                })
              } catch (e: any) {
                log('warn', 'implicit approval failed', { err: e.message })
              }
            }
          }, 60_000)
        }
      }
    })

    sniperEngine.start()
    log('info', 'SniperEngine started', { rules: sniperEngine.getRules().length })
  } catch (e: any) {
    log('warn', 'SniperEngine unavailable', { err: e.message })
  }
}

// ── State ─────────────────────────────────────────────────────────────────────
let activeProfile = 'idle'
let cognitiveLoad = 0
let metricsCount = 0

// ── Stdout event writer ───────────────────────────────────────────────────────
function writeEvent(payload: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(payload) + '\n')
}

function writeResponse(id: string | number, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}

function writeError(id: string | number | null, code: number, message: string): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n')
}

// ── Request handlers ──────────────────────────────────────────────────────────
function handleRequest(req: any): void {
  const { id, method, params } = req

  switch (method) {
    case 'version':
      writeResponse(id, { version: VERSION, pid: process.pid })
      break

    case 'get_state': {
      const ctx = contextEngine ? contextEngine.getState() : null
      writeResponse(id, {
        context: ctx?.current ?? 'unknown',
        confidence: ctx?.confidence ?? 0,
        cognitive_load: cognitiveLoad,
        active_profile: activeProfile,
        override_active: activeProfile !== 'idle' && activeProfile !== '',
        active_watches: sniperEngine ? (sniperEngine.getActiveWatchCount?.() ?? 0) : 0,
        focus_weights: ctx?.focus_weights ?? {},
        context_history: contextEngine?.getHistory?.() ?? [],
        catalog: catalogManager ? {
          total: catalogManager.getStats().total,
          unknown: catalogManager.getStats().unknown,
          suspicious: catalogManager.getStats().suspicious,
          seeded: catalogManager.getStats().total > 0,
        } : null,
        unresolved_processes: catalogManager?.getUnresolved().slice(0, 10).map((u: any) => ({
          name: u.name,
          observation_count: u.observation_count,
          status: u.status,
          first_seen_at: u.first_seen_at,
        })) ?? [],
        suspicious_processes: catalogManager?.getSuspicious().map((u: any) => ({
          name: u.name,
          path: u.path,
          network_connections: u.network_connections,
        })) ?? [],
        learning_confidence: learningStore ? (() => {
          const state = learningStore.getConfidenceState()
          return {
            score: Math.round(state.confidence_score * 100),
            total_decisions: state.total_decisions,
            auto_mode_unlocked: state.auto_mode_unlocked,
            decisions_until_auto: state.decisions_until_auto,
          }
        })() : null,
        load_breakdown: loadEngine ? {
          score: loadEngine.getScore(),
          tier: loadEngine.getScore() < 40 ? 'green' : loadEngine.getScore() < 70 ? 'amber' : 'red',
        } : null,
      })
      break
    }

    case 'apply_profile': {
      const reqProfile = params?.name ?? 'idle'
      // Normalize: empty string treated as idle (ambient mode)
      activeProfile = reqProfile === '' ? 'idle' : reqProfile
      if (sniperEngine?.setProfile) sniperEngine.setProfile(activeProfile)
      const isOverride = activeProfile !== 'idle'
      writeResponse(id, { ok: true, profile: activeProfile, override_active: isOverride })
      break
    }

    case 'update_metrics': {
      // Rust sends this on every metrics poll cycle with current CPU and memory %
      const cpu = params?.cpu_percent ?? 0
      const mem = params?.memory_percent ?? 0
      const ctx = contextEngine?.getState()?.current ?? 'unknown'
      if (loadEngine) {
        loadEngine.update(cpu, mem, ctx)
        const score = loadEngine.getScore()
        cognitiveLoad = score
        // Emit load update event to Rust — relayed to cockpit as intelligence_update
        writeEvent({
          type: 'load_score_updated',
          score,
          tier: score < 40 ? 'green' : score < 70 ? 'amber' : 'red',
          timestamp: new Date().toISOString(),
        })
        // Piggyback confidence state on every 5th metrics cycle (~10s)
        // so cockpit always has a recent reading
        if (learningStore && (metricsCount % 5 === 0)) {
          const state = learningStore.getConfidenceState()
          writeEvent({
            type: 'confidence_updated',
            score: Math.round(state.confidence_score * 100),
            auto_mode_unlocked: state.auto_mode_unlocked,
            decisions_until_auto: state.decisions_until_auto,
            total_decisions: state.total_decisions,
            timestamp: new Date().toISOString(),
          })
        }
        metricsCount++
        writeResponse(id, { ok: true, score })
      } else {
        writeResponse(id, { ok: true, score: 0 })
      }
      break
    }

    case 'update_processes': {
      const processes = params?.processes ?? []
      const context = contextEngine?.getState()?.current ?? 'unknown'
      if (sniperEngine?.ingest) {
        sniperEngine.ingest(processes.map((p: any) => ({
          name: p.name,
          pid: p.pid,
          cpu_percent: p.cpu_percent ?? 0,
          memory_mb: p.memory_mb ?? 0,
          handle_count: p.handle_count ?? 0,
        })))
      }
      if (catalogManager) {
        for (const proc of processes) {
          catalogManager.recordObservation({ name: proc.name })
        }
      }
      writeResponse(id, { ok: true })
      break
    }

    case 'feedback': {
      const { action_id, signal, intensity } = params ?? {}
      if (learningStore && action_id && signal) {
        try {
          learningStore.recordExplicitFeedback(action_id, signal as any, (intensity ?? 'mild') as any)
          feedbackReceived.add(action_id)
        } catch (e: any) {
          log('warn', 'recordExplicitFeedback failed', { err: e.message })
        }
      }
      const score = learningStore ? Math.round(learningStore.getConfidenceState().confidence_score * 100) : 0
      const state = learningStore ? learningStore.getConfidenceState() : null
      writeEvent({
        type: 'confidence_updated',
        score,
        auto_mode_unlocked: state?.auto_mode_unlocked ?? false,
        decisions_until_auto: state?.decisions_until_auto ?? null,
        timestamp: new Date().toISOString(),
      })
      writeResponse(id, { ok: true })
      break
    }

    case 'catalog_lookup': {
      if (!catalogManager) {
        writeResponse(id, { found: false })
        break
      }
      try {
        const result = catalogManager.lookup(params?.name ?? '')
        writeResponse(id, result ?? { found: false })
      } catch (e: any) {
        writeError(id, -32000, e.message)
      }
      break
    }

    case 'get_policies': {
      if (!policyManager) {
        writeResponse(id, { base: [], overlays: [] })
        break
      }
      const stack = policyManager.getStack()
      writeResponse(id, {
        base: stack.base.map((p: any) => ({
          id: p.id, name: p.name, domain: p.domain
        })),
        overlays: stack.overlays.map((p: any) => ({
          id: p.id, name: p.name, domain: p.domain,
          trigger_context: p.trigger_context, expires_at: p.expires_at ?? null
        })),
      })
      break
    }

    case 'lock_context': {
      const { context, duration_min } = params ?? {}
      if (!context || !duration_min) {
        writeError(id, -32602, 'context and duration_min required')
        break
      }
      const expiresAt = Date.now() + (duration_min * 60 * 1000)
      // Override the context engine's detection for this duration
      if (contextEngine?.setUserContext) contextEngine.setUserContext(context)
      // Store the lock expiry as a timed overlay so cockpit can track it
      if (policyManager?.pushOverlay) {
        policyManager.pushOverlay({
          id: 'manual-context-lock',
          name: `Context lock: ${context} for ${duration_min}min`,
          description: `User-locked context until ${new Date(expiresAt).toLocaleTimeString()}`,
          domain: 'cpu',
          created_at: new Date().toISOString(),
          is_overlay: true,
          trigger_context: context as any,
          expires_at: expiresAt,
        })
      }
      writeEvent({
        type: 'context_locked',
        context,
        duration_min,
        expires_at: expiresAt,
        timestamp: new Date().toISOString(),
      })
      writeResponse(id, { ok: true, context, expires_at: expiresAt })
      // Auto-release: re-enable context detection after expiry
      setTimeout(() => {
        if (policyManager?.popOverlay) policyManager.popOverlay('manual-context-lock')
        writeEvent({ type: 'context_lock_released', timestamp: new Date().toISOString() })
      }, duration_min * 60 * 1000)
      break
    }

    case 'shutdown':
      writeResponse(id, { ok: true })
      log('info', 'Shutdown requested')
      cleanup()
      process.exit(0)
      break

    default:
      writeError(id, -32601, `Method not found: ${method}`)
  }
}

function cleanup(): void {
  try { if (contextEngine) contextEngine.stop() } catch (_) {}
  try { if (sniperEngine?.stop) sniperEngine.stop() } catch (_) {}
}

// ── Stdin reader ──────────────────────────────────────────────────────────────
// Stdin reader + heartbeat only in normal sidecar mode (MCP mode uses StdioServerTransport)
const isMcpMode = process.argv.includes('--mcp')

if (!isMcpMode) {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })

  rl.on('line', (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      const req = JSON.parse(trimmed)
      handleRequest(req)
    } catch (e: any) {
      writeError(null, -32700, `Parse error: ${e.message}`)
    }
  })

  rl.on('close', () => {
    log('info', 'stdin closed — exiting')
    cleanup()
    process.exit(0)
  })

  // ── Heartbeat ───────────────────────────────────────────────────────────────
  setInterval(() => {
    const ctx = contextEngine ? contextEngine.getState() : null
    writeEvent({
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      pid: process.pid,
      context: ctx?.current ?? 'unknown',
      cognitive_load: cognitiveLoad,
      active_profile: activeProfile,
      override_active: activeProfile !== 'idle' && activeProfile !== '',
    })
    // Prune expired overlays on each heartbeat
    try { if (policyManager?.pruneExpired) policyManager.pruneExpired() } catch (_) {}
  }, 30_000)
}

// ── Boot ──────────────────────────────────────────────────────────────────────
log('info', 'AEGIS sidecar starting', { version: VERSION, pid: process.pid })

// ── MCP mode: if --mcp flag is present, start MCP stdio server ───────
if (isMcpMode) {
  log('info', 'MCP mode detected — starting MCP tool server')
  initEngines().then(async () => {
    const engines: McpEngines = {
      contextEngine,
      sniperEngine,
      catalogManager,
      loadEngine,
      learningStore,
      policyManager,
    }
    const { startMcpServer } = require('./mcp/server')
    await startMcpServer(engines)
    log('info', 'MCP server connected and ready')
  }).catch((e) => {
    log('error', 'MCP startup failed', { err: e.message })
    process.exit(1)
  })
} else {
  // ── Normal sidecar mode: JSON-RPC over stdin/stdout for Tauri ──────

  // Announce startup immediately
  writeEvent({
    type: 'started',
    version: VERSION,
    pid: process.pid,
    timestamp: new Date().toISOString(),
  })

  // Init engines async — don't block stdin
  initEngines().catch((e) => {
    log('error', 'Engine init failed', { err: e.message })
  })
}

// Graceful shutdown
process.on('SIGTERM', () => { cleanup(); process.exit(0) })
process.on('SIGINT',  () => { cleanup(); process.exit(0) })
process.on('uncaughtException', (e) => {
  log('error', 'Uncaught exception', { err: e.message, stack: e.stack })
  // Don't exit — keep running, Rust will log stderr
})
