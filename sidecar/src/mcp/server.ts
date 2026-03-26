// ============================================================
// AEGIS MCP Tool Server
// Exposes machine state, context, cognitive load, and resource
// actions to any MCP client (Claude Desktop, GregLite, GREGORE).
// Stdio transport — launched via --mcp flag on sidecar.
// ============================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import type { ContextEngine } from '../context/engine.js'
import type { SniperEngine } from '../sniper/engine.js'
import type { CatalogManager } from '../catalog/manager.js'
import type { CognitiveLoadEngine } from '../learning/load.js'
import type { LearningStore } from '../learning/store.js'

// ============================================================
// Engine references — injected at startup
// ============================================================

export interface McpEngines {
  contextEngine: ContextEngine | null
  sniperEngine: SniperEngine | null
  catalogManager: CatalogManager | null
  loadEngine: CognitiveLoadEngine | null
  learningStore: LearningStore | null
  policyManager: any | null
}

// Helper: wrap a JSON object as MCP text content
function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

// ============================================================
// startMcpServer — called from main.ts when --mcp flag present
// ============================================================

export async function startMcpServer(engines: McpEngines): Promise<void> {
  const server = new McpServer(
    { name: 'aegis', version: '4.0.0' },
    { capabilities: { tools: {} } },
  )

  // ── Tool 1: get_system_snapshot ──────────────────────────
  server.tool(
    'get_system_snapshot',
    'Full system snapshot: context, cognitive load, catalog stats, confidence, active watches, policies',
    async () => {
      const ctx = engines.contextEngine?.getState() ?? null
      const loadScore = engines.loadEngine?.getScore() ?? 0
      const tier = loadScore < 40 ? 'green' : loadScore < 70 ? 'amber' : 'red'
      const catStats = engines.catalogManager?.getStats() ?? { total: 0, unknown: 0, suspicious: 0 }
      const confidence = engines.learningStore?.getConfidenceState() ?? null
      const activeWatches = engines.sniperEngine?.getActiveWatches() ?? []
      const policies = engines.policyManager?.getStack() ?? { base: [], overlays: [] }
      return jsonResult({
        context: {
          current: ctx?.current ?? 'unknown',
          previous: ctx?.previous ?? 'unknown',
          confidence: ctx?.confidence ?? 0,
          focus_weights: ctx?.focus_weights ?? {},
          switched_at: ctx?.switched_at ?? 0,
        },
        cognitive_load: { score: loadScore, tier },
        catalog: catStats,
        confidence: confidence ? {
          score: Math.round(confidence.confidence_score * 100),
          total_decisions: confidence.total_decisions,
          auto_mode_unlocked: confidence.auto_mode_unlocked,
          decisions_until_auto: confidence.decisions_until_auto,
        } : null,
        active_watches: activeWatches.length,
        watch_details: activeWatches.slice(0, 20).map(w => ({
          name: w.name, pid: w.pid, context: w.context,
          escalation_state: w.escalation_state,
          max_zscore: w.deviation?.max_zscore ?? 0,
        })),
        policies: {
          base: policies.base?.length ?? 0,
          overlays: policies.overlays?.map((p: any) => ({
            id: p.id, name: p.name, domain: p.domain,
          })) ?? [],
        },
        timestamp: new Date().toISOString(),
      })
    },
  )

  // ── Tool 2: get_cognitive_load ────────────────────────────
  server.tool(
    'get_cognitive_load',
    'Current cognitive load score (0-100), tier (green/amber/red), and pressure breakdown',
    async () => {
      const load = engines.loadEngine?.computeLoad() ?? {
        score: 0, tier: 'green' as const, cpu_pressure: 0,
        memory_pressure: 0, disk_queue_pressure: 0, dpc_pressure: 0,
      }
      return jsonResult({
        score: load.score, tier: load.tier,
        pressures: {
          cpu: load.cpu_pressure, memory: load.memory_pressure,
          disk_queue: load.disk_queue_pressure, dpc: load.dpc_pressure,
        },
        timestamp: new Date().toISOString(),
      })
    },
  )

  // ── Tool 3: get_context ───────────────────────────────────
  server.tool(
    'get_context',
    'Current detected context (deep_work/build/research/meeting/media/gaming/idle), confidence, and focus weights',
    async () => {
      const ctx = engines.contextEngine?.getState() ?? null
      const history = engines.contextEngine?.getHistory() ?? []
      return jsonResult({
        current: ctx?.current ?? 'unknown',
        previous: ctx?.previous ?? 'unknown',
        confidence: ctx?.confidence ?? 0,
        focus_weights: ctx?.focus_weights ?? {},
        switched_at: ctx?.switched_at ? new Date(ctx.switched_at).toISOString() : null,
        idle_since: ctx?.idle_since ? new Date(ctx.idle_since).toISOString() : null,
        recent_transitions: history.map(h => ({
          from: h.from, to: h.to, confidence: h.confidence,
          at: new Date(h.at).toISOString(),
        })),
        timestamp: new Date().toISOString(),
      })
    },
  )

  // ── Tool 4: get_process_tree ──────────────────────────────
  server.tool(
    'get_process_tree',
    'Running processes under sniper watch with catalog info and deviation data',
    async () => {
      const watches = engines.sniperEngine?.getActiveWatches() ?? []
      const catStats = engines.catalogManager?.getStats() ?? { total: 0, unknown: 0, suspicious: 0 }
      const unresolved = engines.catalogManager?.getUnresolved().slice(0, 20) ?? []
      const suspicious = engines.catalogManager?.getSuspicious() ?? []
      return jsonResult({
        catalog: catStats,
        active_watches: watches.map(w => ({
          name: w.name, pid: w.pid, context: w.context,
          escalation_state: w.escalation_state,
          deviation: { max_zscore: w.deviation?.max_zscore ?? 0, baseline_reliable: w.deviation?.baseline_reliable ?? false },
          first_flagged: new Date(w.first_flagged_ms).toISOString(),
          action_count: w.action_count, last_action: w.last_action,
        })),
        unresolved_processes: unresolved.map((u: any) => ({
          name: u.name, observation_count: u.observation_count, status: u.status,
        })),
        suspicious_processes: suspicious.map((s: any) => ({
          name: s.name, path: s.path, network_connections: s.network_connections,
        })),
        timestamp: new Date().toISOString(),
      })
    },
  )

  // ── Tool 5: get_action_log ────────────────────────────────
  // Cast to any: Zod schema triggers TS2589 (deep type instantiation) in MCP SDK generics
  ;(server as any).tool(
    'get_action_log',
    'Recent sniper actions with reasoning, escalation state, and outcomes',
    { limit: z.number().min(1).max(100).default(20).describe('Max actions to return') },
    async (args: { limit: number }) => {
      const watches = engines.sniperEngine?.getActiveWatches() ?? []
      const rules = engines.sniperEngine?.getRules() ?? []
      return jsonResult({
        active_watches: watches.map(w => ({
          name: w.name, pid: w.pid, context: w.context,
          escalation_state: w.escalation_state,
          first_flagged: new Date(w.first_flagged_ms).toISOString(),
          last_action: w.last_action,
          last_action_at: w.last_action_ms ? new Date(w.last_action_ms).toISOString() : null,
          action_count: w.action_count,
          deviation_zscore: w.deviation?.max_zscore ?? 0,
        })).slice(0, args.limit),
        rules_active: rules.filter(r => r.enabled).length,
        rules_total: rules.length,
        timestamp: new Date().toISOString(),
      })
    },
  )

  // ── Tool 6: get_confidence ────────────────────────────────
  server.tool(
    'get_confidence',
    'Learning confidence score, auto mode status, and decision history stats',
    async () => {
      const state = engines.learningStore?.getConfidenceState() ?? null
      const score = engines.learningStore?.getConfidenceScore() ?? null
      return jsonResult({
        confidence_score: score?.score ?? 0,
        total_decisions: state?.total_decisions ?? 0,
        approvals: state?.approvals ?? 0,
        rejections: state?.rejections ?? 0,
        strong_rejections: state?.strong_rejections ?? 0,
        auto_mode_unlocked: state?.auto_mode_unlocked ?? false,
        decisions_until_auto: state?.decisions_until_auto ?? null,
        raw_confidence: state?.confidence_score ?? 0,
        timestamp: new Date().toISOString(),
      })
    },
  )

  // ── Tool 7: get_session_summary ───────────────────────────
  server.tool(
    'get_session_summary',
    'Current session stats: duration, context, actions taken, cognitive load averages',
    async () => {
      const sessionId = engines.learningStore?.getCurrentSessionId() ?? null
      const ctx = engines.contextEngine?.getState() ?? null
      const loadScore = engines.loadEngine?.getScore() ?? 0
      const confidence = engines.learningStore?.getConfidenceScore() ?? null
      const watches = engines.sniperEngine?.getActiveWatches() ?? []
      const recentSessions = engines.learningStore?.getRecentSessions(5) ?? []
      return jsonResult({
        current_session_id: sessionId,
        context: ctx?.current ?? 'unknown',
        context_confidence: ctx?.confidence ?? 0,
        cognitive_load: loadScore,
        cognitive_load_tier: loadScore < 40 ? 'green' : loadScore < 70 ? 'amber' : 'red',
        active_watches: watches.length,
        confidence_score: confidence?.score ?? 0,
        auto_mode_unlocked: confidence?.autoModeUnlocked ?? false,
        recent_sessions: recentSessions.map(s => ({
          id: s.id, context: s.context,
          started_at: s.started_at, ended_at: s.ended_at,
          duration_min: s.duration_min,
          avg_cognitive_load: s.avg_cognitive_load,
          peak_cognitive_load: s.peak_cognitive_load,
          actions_taken: s.actions_taken,
        })),
        timestamp: new Date().toISOString(),
      })
    },
  )

  // ── Tool 8: apply_policy_overlay ──────────────────────────
  // Cast to any: Zod schema triggers TS2589 (deep type instantiation) in MCP SDK generics
  ;(server as any).tool(
    'apply_policy_overlay',
    'Push a temporary policy overlay (e.g. "focus mode" for 30 min). Overlays auto-expire after duration.',
    {
      name: z.string().describe('Policy overlay name (e.g. "focus_mode", "build_priority")'),
      duration_min: z.number().min(1).max(480).describe('Duration in minutes before auto-expiry'),
      domain: z.enum(['cpu', 'memory', 'disk', 'network', 'general']).default('general').describe('Resource domain'),
      description: z.string().optional().describe('Human-readable description'),
    },
    async (args: { name: string; duration_min: number; domain: string; description?: string }) => {
      if (!engines.policyManager?.pushOverlay) {
        return jsonResult({ ok: false, error: 'PolicyManager not available' })
      }
      const expiresAt = Date.now() + (args.duration_min * 60 * 1000)
      const overlayId = `mcp-${args.name}-${Date.now()}`
      try {
        engines.policyManager.pushOverlay({
          id: overlayId,
          name: args.name,
          description: args.description ?? `MCP overlay: ${args.name} for ${args.duration_min}min`,
          domain: args.domain ?? 'general',
          created_at: new Date().toISOString(),
          is_overlay: true,
          expires_at: expiresAt,
        })
        return jsonResult({
          ok: true, overlay_id: overlayId, name: args.name,
          domain: args.domain ?? 'general',
          expires_at: new Date(expiresAt).toISOString(),
          duration_min: args.duration_min,
        })
      } catch (e: any) {
        return jsonResult({ ok: false, error: e.message })
      }
    },
  )

  // ── Connect stdio transport ───────────────────────────────
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Log to stderr (stdout is MCP protocol)
  process.stderr.write(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'info',
    msg: 'AEGIS MCP server started',
    tools: 8,
    transport: 'stdio',
  }) + '\n')
}
