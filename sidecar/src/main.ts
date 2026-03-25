// AEGIS Intelligence Sidecar — entry point
// JSON-RPC 2.0 over stdin/stdout
// Engines: context detection, sniper, learning store, catalog, MCP server

import * as readline from 'readline'

const VERSION = '4.0.0'

// Heartbeat every 30s so Rust knows we're alive
setInterval(() => {
  writeEvent({ type: 'heartbeat', timestamp: new Date().toISOString(), pid: process.pid })
}, 30_000)

// Announce startup
writeEvent({
  type: 'started',
  version: VERSION,
  pid: process.pid,
  timestamp: new Date().toISOString(),
})

// Read JSON-RPC requests from Rust core on stdin
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })

rl.on('line', (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return
  try {
    const req = JSON.parse(trimmed)
    handleRequest(req)
  } catch (e) {
    writeError('', -32700, `Parse error: ${e}`)
  }
})

rl.on('close', () => {
  process.exit(0)
})

function handleRequest(req: any) {
  const { id, method, params } = req
  switch (method) {
    case 'version':
      writeResponse(id, { version: VERSION, pid: process.pid })
      break
    case 'get_state':
      writeResponse(id, {
        context: 'unknown',
        confidence: 0,
        cognitive_load: 0,
        active_watches: 0,
      })
      break
    case 'shutdown':
      writeResponse(id, { ok: true })
      process.exit(0)
      break
    default:
      writeError(id, -32601, `Method not found: ${method}`)
  }
}

function writeEvent(payload: object) {
  process.stdout.write(JSON.stringify(payload) + '\n')
}

function writeResponse(id: string, result: object) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}

function writeError(id: string, code: number, message: string) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n')
}

// Graceful shutdown
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
