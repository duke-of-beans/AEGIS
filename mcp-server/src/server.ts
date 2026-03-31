#!/usr/bin/env node
// AEGIS MCP Tool Server — standalone binary
// Reads engine state from the running AEGIS sidecar via localhost:7474
// Communicates with MCP clients (Claude Desktop, GregLite, GREGORE) via stdio
// No bundling needed — plain ESM node script, same pattern as KERNL/SHIM/Oktyv

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const SIDECAR_URL = 'http://127.0.0.1:7474'
const VERSION = '4.0.0'

// ── Fetch state from running sidecar ─────────────────────────────────────────
async function getSidecarState(): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${SIDECAR_URL}/state`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json() as Record<string, unknown>
  } catch (e: any) {
    return { error: `AEGIS sidecar unreachable: ${e.message}`, sidecar_url: SIDECAR_URL }
  }
}

async function checkSidecarHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${SIDECAR_URL}/health`)
    return res.ok
  } catch {
    return false
  }
}

function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

// ── MCP Server ────────────────────────────────────────────────────────────────
const server = new McpServer(
  { name: 'aegis', version: VERSION },
  { capabilities: { tools: {} } }
)

server.tool(
  'get_system_snapshot',
  'Full AEGIS system snapshot: context, cognitive load, catalog stats, confidence score, active sniper watches, and policy stack. Reads from the running AEGIS sidecar.',
  async () => {
    const state = await getSidecarState()
    return jsonResult(state)
  }
)

server.tool(
  'get_cognitive_load',
  'Current cognitive load score (0-100) and tier (green/amber/red). Derived from CPU + memory pressure weighted by context.',
  async () => {
    const state = await getSidecarState()
    const load = (state.cognitive_load as any) ?? { score: 0, tier: 'unknown' }
    return jsonResult({ score: load.score, tier: load.tier, timestamp: state.timestamp })
  }
)

server.tool(
  'get_context',
  'Current detected context (deep_work/build/research/meeting/media/gaming/idle), confidence, and recent focus weights by process.',
  async () => {
    const state = await getSidecarState()
    const ctx = (state.context as any) ?? {}
    return jsonResult({ current: ctx.current ?? 'unknown', previous: ctx.previous ?? 'unknown', confidence: ctx.confidence ?? 0, focus_weights: ctx.focus_weights ?? {}, switched_at: ctx.switched_at ?? null, timestamp: state.timestamp })
  }
)

server.tool(
  'get_process_watches',
  'Processes currently under Sniper observation — deviating from personal baseline. Includes deviation score and escalation state.',
  async () => {
    const state = await getSidecarState()
    return jsonResult({ active_watches: state.active_watches ?? 0, watch_details: state.watch_details ?? [], catalog: state.catalog ?? {}, unresolved_processes: state.unresolved_processes ?? [], suspicious_processes: state.suspicious_processes ?? [], timestamp: state.timestamp })
  }
)

server.tool(
  'get_confidence',
  'AEGIS learning confidence score (0-100), auto mode unlock status, and decision history. Higher score = more trusted to act autonomously.',
  async () => {
    const state = await getSidecarState()
    const conf = (state.confidence as any) ?? {}
    return jsonResult({ confidence_score: conf.score ?? 0, total_decisions: conf.total_decisions ?? 0, auto_mode_unlocked: conf.auto_mode_unlocked ?? false, decisions_until_auto: conf.decisions_until_auto ?? null, timestamp: state.timestamp })
  }
)

server.tool(
  'get_policies',
  'Active policy stack: base policies and temporary context-driven overlays.',
  async () => {
    const state = await getSidecarState()
    return jsonResult({ policies: state.policies ?? { base: 0, overlays: [] }, timestamp: state.timestamp })
  }
)

server.tool(
  'health_check',
  'Check if the AEGIS sidecar is running and responsive. Returns sidecar PID, version, and connection status.',
  async () => {
    const healthy = await checkSidecarHealth()
    if (healthy) {
      const state = await getSidecarState()
      return jsonResult({ ok: true, sidecar_pid: state.pid, sidecar_version: state.version, sidecar_url: SIDECAR_URL })
    } else {
      return jsonResult({ ok: false, error: 'AEGIS sidecar not running or not reachable', sidecar_url: SIDECAR_URL, hint: 'Launch AEGIS from the system tray or run aegis.exe' })
    }
  }
)

;(server as any).tool(
  'apply_policy_overlay',
  'Request AEGIS apply a temporary named policy overlay (e.g. focus_mode for 30 min). The sidecar must be running.',
  {
    name: z.string().describe('Overlay name e.g. "focus_mode", "build_priority"'),
    duration_min: z.number().min(1).max(480).describe('Duration in minutes'),
    domain: z.enum(['cpu', 'memory', 'disk', 'network', 'general']).default('general'),
  },
  async (args: { name: string; duration_min: number; domain: string }) => {
    // For now: inform the client that overlay must be applied via the cockpit
    // Future: POST to sidecar /overlay endpoint once implemented
    return jsonResult({ ok: false, message: 'Policy overlay application via MCP coming in AEGIS-POL-01. Use the AEGIS cockpit Policy tab for now.', requested: args })
  }
)

// ── Start stdio transport ─────────────────────────────────────────────────────
const transport = new StdioServerTransport()
await server.connect(transport)

process.stderr.write(JSON.stringify({
  ts: new Date().toISOString(),
  level: 'info',
  msg: 'AEGIS MCP server started',
  tools: 7,
  transport: 'stdio',
  sidecar_url: SIDECAR_URL
}) + '\n')
