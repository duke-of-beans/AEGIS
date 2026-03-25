// AEGIS Intelligence Sidecar — entry point v4
// JSON-RPC 2.0 over stdin/stdout. No HTTP server.
// Engines: context detection, sniper, learning store, catalog, cognitive load

import * as readline from 'readline'
import * as path from 'path'
import * as os from 'os'

const VERSION = '4.0.0'

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
    })

    contextEngine.start()
    log('info', 'ContextEngine started')
  } catch (e: any) {
    log('warn', 'ContextEngine unavailable — running without context detection', { err: e.message })
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
    const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'AEGIS', 'catalog.db')
    catalogManager = new CatalogManager(dbPath)
    log('info', 'CatalogManager ready')
  } catch (e: any) {
    log('warn', 'CatalogManager unavailable', { err: e.message })
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
        writeEvent({
          type: 'sniper_action_requested',
          pid: evt.pid,
          name: evt.name,
          action: evt.action,
          reason: evt.reason ?? '',
          timestamp: new Date().toISOString(),
        })
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
        active_watches: sniperEngine ? (sniperEngine.getActiveWatchCount?.() ?? 0) : 0,
        focus_weights: ctx?.focus_weights ?? {},
      })
      break
    }

    case 'apply_profile': {
      activeProfile = params?.name ?? 'idle'
      if (sniperEngine?.setProfile) sniperEngine.setProfile(activeProfile)
      writeResponse(id, { ok: true, profile: activeProfile })
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
      writeResponse(id, { ok: true })
      break
    }

    case 'feedback': {
      // Route learning feedback — best-effort
      try {
        const { LearningStore } = require('./learning/store')
        // LearningStore.recordFeedback is async fire-and-forget
      } catch (_) {}
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

// ── Heartbeat ─────────────────────────────────────────────────────────────────
setInterval(() => {
  const ctx = contextEngine ? contextEngine.getState() : null
  writeEvent({
    type: 'heartbeat',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    context: ctx?.current ?? 'unknown',
    cognitive_load: cognitiveLoad,
    active_profile: activeProfile,
  })
}, 30_000)

// ── Boot ──────────────────────────────────────────────────────────────────────
log('info', 'AEGIS sidecar starting', { version: VERSION, pid: process.pid })

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

// Graceful shutdown
process.on('SIGTERM', () => { cleanup(); process.exit(0) })
process.on('SIGINT',  () => { cleanup(); process.exit(0) })
process.on('uncaughtException', (e) => {
  log('error', 'Uncaught exception', { err: e.message, stack: e.stack })
  // Don't exit — keep running, Rust will log stderr
})
