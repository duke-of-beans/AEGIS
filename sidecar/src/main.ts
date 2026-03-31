// AEGIS Intelligence Sidecar — entry point v4
// JSON-RPC 2.0 over stdin/stdout. No HTTP server.
// MCP server is a SEPARATE binary at mcp-server/ — not bundled here.
// Local state query endpoint: localhost:7474 for MCP binary + other consumers.

import * as readline from 'readline'
import * as path from 'path'
import * as os from 'os'
import * as http from 'http'

const VERSION = '4.0.0'

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...data })
  process.stderr.write(entry + '\n')
}

let contextEngine: any = null
let sniperEngine: any = null
let catalogManager: any = null
let loadEngine: any = null
let learningStore: any = null
let policyManager: any = null
let activeProfile = 'idle'
let cognitiveLoad = 0
let metricsCount = 0
const feedbackReceived = new Set<string>()

function writeEvent(payload: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(payload) + '\n')
}
function writeResponse(id: string | number, result: unknown): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}
function writeError(id: string | number | null, code: number, message: string): void {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n')
}

function cleanup(): void {
  try { if (contextEngine) contextEngine.stop() } catch (_) {}
  try { if (sniperEngine?.stop) sniperEngine.stop() } catch (_) {}
}

async function initEngines(): Promise<void> {
  try {
    const { ContextEngine } = require('./context/engine')
    contextEngine = new ContextEngine()
    contextEngine.on('context_changed', (evt: any) => {
      writeEvent({ type: 'context_changed', context: evt.to, previous: evt.from, confidence: evt.confidence, timestamp: new Date().toISOString() })
      if (sniperEngine?.setContext) sniperEngine.setContext(evt.to)
      if (policyManager?.applyContextOverlays) {
        try {
          policyManager.applyContextOverlays(evt.to)
          writeEvent({ type: 'policies_updated', context: evt.to, overlays: policyManager.getStack().overlays.map((p: any) => ({ id: p.id, name: p.name, domain: p.domain })), timestamp: new Date().toISOString() })
        } catch (e: any) { log('warn', 'applyContextOverlays failed', { err: e.message }) }
      }
    })
    contextEngine.start()
    log('info', 'ContextEngine started')
  } catch (e: any) { log('warn', 'ContextEngine unavailable', { err: e.message }) }

  try {
    const { PolicyManager } = require('./context/policies')
    policyManager = new PolicyManager()
    log('info', 'PolicyManager started')
  } catch (e: any) { log('warn', 'PolicyManager unavailable', { err: e.message }) }

  try {
    const { CognitiveLoadEngine } = require('./learning/load')
    loadEngine = new CognitiveLoadEngine()
    log('info', 'CognitiveLoadEngine started')
  } catch (e: any) { log('warn', 'CognitiveLoadEngine unavailable', { err: e.message }) }

  try {
    const { CatalogManager } = require('./catalog/manager')
    const appDataPath = path.join(os.homedir(), 'AppData', 'Roaming')
    catalogManager = new CatalogManager(appDataPath)
    catalogManager.seedIfEmpty()
    log('info', 'CatalogManager ready')
  } catch (e: any) { log('warn', 'CatalogManager unavailable', { err: e.message }) }

  try {
    const { initLearningStore } = require('./learning/store')
    const lsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'AEGIS')
    learningStore = initLearningStore(lsPath)
    learningStore.start()
    const ctx = contextEngine?.getState()?.current ?? 'unknown'
    learningStore.startSession(ctx)
    log('info', 'LearningStore started')
  } catch (e: any) { log('warn', 'LearningStore unavailable', { err: e.message }) }

  try {
    const { SniperEngine } = require('./sniper/engine')
    const { BaselineEngine } = require('./sniper/baseline')
    const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'AEGIS', 'baseline.db')
    const baseline = new BaselineEngine(dbPath)
    baseline.start()
    sniperEngine = new SniperEngine(baseline, catalogManager ?? { lookup: () => null, canActOn: () => false })
    sniperEngine.on('event', (evt: any) => {
      if (evt.type === 'action_taken') {
        let actionId: string | null = null
        if (learningStore) {
          try {
            const ctx = contextEngine?.getState()?.current ?? 'unknown'
            actionId = learningStore.recordAction({ processName: evt.name, action: evt.action, context: ctx, zscoreAtAction: evt.zscore ?? 0, cpuBefore: evt.cpu_before ?? 0, memoryBefore: evt.memory_before ?? 0 })
          } catch (e: any) { log('warn', 'recordAction failed', { err: e.message }) }
        }
        writeEvent({ type: 'sniper_action_requested', pid: evt.pid, name: evt.name, action: evt.action, reason: evt.reason ?? '', action_id: actionId ?? '', timestamp: new Date().toISOString() })
        if (actionId && learningStore) {
          const capturedId = actionId
          setTimeout(() => {
            if (!feedbackReceived.has(capturedId)) {
              try {
                learningStore.updateActionOutcome(capturedId, 0, 0, null)
                const state = learningStore.getConfidenceState()
                writeEvent({ type: 'confidence_updated', score: Math.round(state.confidence_score * 100), auto_mode_unlocked: state.auto_mode_unlocked, decisions_until_auto: state.decisions_until_auto, timestamp: new Date().toISOString() })
              } catch (e: any) { log('warn', 'implicit approval failed', { err: e.message }) }
            }
          }, 60_000)
        }
      }
    })
    sniperEngine.start()
    log('info', 'SniperEngine started', { rules: sniperEngine.getRules().length })
  } catch (e: any) { log('warn', 'SniperEngine unavailable', { err: e.message }) }
}

function buildStateSnapshot(): Record<string, unknown> {
  const ctx = contextEngine?.getState() ?? null
  const loadScore = loadEngine?.getScore() ?? 0
  const catStats = catalogManager?.getStats() ?? { total: 0, unknown: 0, suspicious: 0 }
  const confidence = learningStore?.getConfidenceState() ?? null
  const activeWatches = sniperEngine?.getActiveWatches() ?? []
  const policies = policyManager?.getStack() ?? { base: [], overlays: [] }
  return {
    version: VERSION,
    pid: process.pid,
    context: { current: ctx?.current ?? 'unknown', previous: ctx?.previous ?? 'unknown', confidence: ctx?.confidence ?? 0, focus_weights: ctx?.focus_weights ?? {}, switched_at: ctx?.switched_at ?? 0 },
    cognitive_load: { score: loadScore, tier: loadScore < 40 ? 'green' : loadScore < 70 ? 'amber' : 'red' },
    catalog: catStats,
    confidence: confidence ? { score: Math.round(confidence.confidence_score * 100), total_decisions: confidence.total_decisions, auto_mode_unlocked: confidence.auto_mode_unlocked, decisions_until_auto: confidence.decisions_until_auto } : null,
    active_watches: activeWatches.length,
    watch_details: activeWatches.slice(0, 20).map((w: any) => ({ name: w.name, pid: w.pid, context: w.context, escalation_state: w.escalation_state, max_zscore: w.deviation?.max_zscore ?? 0 })),
    policies: { base: policies.base?.length ?? 0, overlays: policies.overlays?.map((p: any) => ({ id: p.id, name: p.name, domain: p.domain })) ?? [] },
    unresolved_processes: catalogManager?.getUnresolved().slice(0, 10).map((u: any) => ({ name: u.name, observation_count: u.observation_count, status: u.status })) ?? [],
    suspicious_processes: catalogManager?.getSuspicious().map((u: any) => ({ name: u.name, path: u.path, network_connections: u.network_connections })) ?? [],
    timestamp: new Date().toISOString(),
  }
}

function startLocalQueryServer(): void {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(buildStateSnapshot()))
    } else if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, pid: process.pid, version: VERSION }))
    } else {
      res.writeHead(404)
      res.end('Not found')
    }
  })
  server.listen(7474, '127.0.0.1', () => log('info', 'Local query server listening', { port: 7474 }))
  server.on('error', (e: any) => log('warn', 'Local query server failed', { err: e.message }))
}

function handleRequest(req: any): void {
  const { id, method, params } = req
  switch (method) {
    case 'version':
      writeResponse(id, { version: VERSION, pid: process.pid })
      break

    case 'get_state':
      writeResponse(id, buildStateSnapshot())
      break

    case 'apply_profile': {
      const reqProfile = params?.name ?? 'idle'
      activeProfile = reqProfile === '' ? 'idle' : reqProfile
      if (sniperEngine?.setProfile) sniperEngine.setProfile(activeProfile)
      writeResponse(id, { ok: true, profile: activeProfile, override_active: activeProfile !== 'idle' })
      break
    }

    case 'update_metrics': {
      const cpu = params?.cpu_percent ?? 0
      const mem = params?.memory_percent ?? 0
      const ctx = contextEngine?.getState()?.current ?? 'unknown'
      if (loadEngine) {
        loadEngine.update(cpu, mem, ctx)
        const score = loadEngine.getScore()
        cognitiveLoad = score
        writeEvent({ type: 'load_score_updated', score, tier: score < 40 ? 'green' : score < 70 ? 'amber' : 'red', timestamp: new Date().toISOString() })
        if (learningStore && (metricsCount % 5 === 0)) {
          const state = learningStore.getConfidenceState()
          writeEvent({ type: 'confidence_updated', score: Math.round(state.confidence_score * 100), auto_mode_unlocked: state.auto_mode_unlocked, decisions_until_auto: state.decisions_until_auto, total_decisions: state.total_decisions, timestamp: new Date().toISOString() })
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
      if (sniperEngine?.ingest) {
        sniperEngine.ingest(processes.map((p: any) => ({ name: p.name, pid: p.pid, cpu_percent: p.cpu_percent ?? 0, memory_mb: p.memory_mb ?? 0, handle_count: p.handle_count ?? 0 })))
      }
      if (catalogManager) {
        for (const proc of processes) catalogManager.recordObservation({ name: proc.name })
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
        } catch (e: any) { log('warn', 'recordExplicitFeedback failed', { err: e.message }) }
      }
      const score = learningStore ? Math.round(learningStore.getConfidenceState().confidence_score * 100) : 0
      const state = learningStore ? learningStore.getConfidenceState() : null
      writeEvent({ type: 'confidence_updated', score, auto_mode_unlocked: state?.auto_mode_unlocked ?? false, decisions_until_auto: state?.decisions_until_auto ?? null, timestamp: new Date().toISOString() })
      writeResponse(id, { ok: true })
      break
    }

    case 'catalog_lookup':
      if (!catalogManager) { writeResponse(id, { found: false }); break }
      try { writeResponse(id, catalogManager.lookup(params?.name ?? '') ?? { found: false }) }
      catch (e: any) { writeError(id, -32000, e.message) }
      break

    case 'get_policies': {
      if (!policyManager) { writeResponse(id, { base: [], overlays: [] }); break }
      const stack = policyManager.getStack()
      writeResponse(id, {
        base: stack.base.map((p: any) => ({ id: p.id, name: p.name, domain: p.domain })),
        overlays: stack.overlays.map((p: any) => ({ id: p.id, name: p.name, domain: p.domain, trigger_context: p.trigger_context, expires_at: p.expires_at ?? null })),
      })
      break
    }

    case 'lock_context': {
      const { context, duration_min } = params ?? {}
      if (!context || !duration_min) { writeError(id, -32602, 'context and duration_min required'); break }
      const expiresAt = Date.now() + (duration_min * 60 * 1000)
      if (contextEngine?.setUserContext) contextEngine.setUserContext(context)
      if (policyManager?.pushOverlay) {
        policyManager.pushOverlay({ id: 'manual-context-lock', name: `Context lock: ${context} for ${duration_min}min`, description: `Locked until ${new Date(expiresAt).toLocaleTimeString()}`, domain: 'cpu', created_at: new Date().toISOString(), is_overlay: true, trigger_context: context as any, expires_at: expiresAt })
      }
      writeEvent({ type: 'context_locked', context, duration_min, expires_at: expiresAt, timestamp: new Date().toISOString() })
      writeResponse(id, { ok: true, context, expires_at: expiresAt })
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

// ── Boot ──────────────────────────────────────────────────────────────────────
log('info', 'AEGIS sidecar starting', { version: VERSION, pid: process.pid })
writeEvent({ type: 'started', version: VERSION, pid: process.pid, timestamp: new Date().toISOString() })

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
rl.on('line', (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return
  try { handleRequest(JSON.parse(trimmed)) }
  catch (e: any) { writeError(null, -32700, `Parse error: ${e.message}`) }
})
rl.on('close', () => { log('info', 'stdin closed — exiting'); cleanup(); process.exit(0) })

setInterval(() => {
  const ctx = contextEngine ? contextEngine.getState() : null
  writeEvent({ type: 'heartbeat', timestamp: new Date().toISOString(), pid: process.pid, context: ctx?.current ?? 'unknown', cognitive_load: cognitiveLoad, active_profile: activeProfile, override_active: activeProfile !== 'idle' && activeProfile !== '' })
  try { if (policyManager?.pruneExpired) policyManager.pruneExpired() } catch (_) {}
}, 30_000)

initEngines().catch((e) => log('error', 'Engine init failed', { err: e.message }))
startLocalQueryServer()

process.on('SIGTERM', () => { cleanup(); process.exit(0) })
process.on('SIGINT', () => { cleanup(); process.exit(0) })
process.on('uncaughtException', (e) => log('error', 'Uncaught exception', { err: e.message, stack: e.stack }))
