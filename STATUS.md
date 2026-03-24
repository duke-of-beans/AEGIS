# AEGIS — STATUS

**Status:** active
**Phase:** v3.0 — AEGIS-MCP-02 shipped, AEGIS-UI-01 next
**Last Sprint:** AEGIS-MCP-02
**Last Updated:** 2026-03-24
**Completion:** v2 92% / v3 92%

---

## Architectural Direction

AEGIS is a Cognitive Resource OS. All five intelligences are live.
The MCP publisher is the nervous system — GREGORE and GregLite can now query
machine state, cognitive load, context, runaways, and apply overlays.
Full vision: D:\Projects\AEGIS\VISION.md (locked 2026-03-24).

## Open Work — v3

- [ ] **[P1]** AEGIS-UI-01: Command surface redesign — cockpit model, action log centerpiece
- [ ] **[P3]** AEGIS-INSTALLER-01: v3.0.0 installer rebuild
- [ ] **[P3]** Historical performance graphs, pm2 boot health-check

## Completed

- [x] AEGIS-MCP-02: Rich MCP publisher — full server rewrite. 14 tools:
      aegis_status, get_cognitive_load, get_context, get_system_snapshot,
      get_process_tree, get_runaways, get_action_log, get_confidence,
      get_session_summary, apply_policy_overlay, preflight, switch_profile,
      set_timer, cancel_timer. setIntelligence() wires all v3 engines.
      GREGORE/GregLite integration protocol complete. (2026-03-24)
- [x] AEGIS-LEARN-01: LearningStore + CognitiveLoadEngine (8d3b4cd, 2026-03-24)
- [x] AEGIS-SNIPER-01: BaselineEngine + SniperEngine (ad95dd0, 2026-03-24)
- [x] AEGIS-CONTEXT-01: ContextEngine + PolicyManager (2bf86be, 2026-03-24)
- [x] AEGIS-MONITOR-01: Disk/SMART/network/GPU/DPC/spawn tree (f88a926, 2026-03-24)
- [x] AEGIS-CATALOG-01: Process knowledge base, 210-process seed (1c4df3f, 2026-03-24)
- [x] AEGIS-BRAVE-03, AEGIS-ELEV-01, AEGIS-PM2-01, ESLint, BRAVE-02, BRAVE-01, v2.0.0

## Blockers

None.

## Key Files

| File | Purpose |
|------|---------|
| `src/mcp/server.ts` | Rich MCP publisher — 14 tools, all v3 intelligence |
| `src/learning/store.ts` | LearningStore — sessions, outcomes, confidence |
| `src/learning/load.ts` | CognitiveLoadEngine — 0-100 composite score |
| `src/sniper/baseline.ts` | Welford baseline engine |
| `src/sniper/engine.ts` | Sniper rules engine |
| `src/context/engine.ts` | Context detection |
| `src/context/policies.ts` | Composable policy stack |
| `src/catalog/manager.ts` | Process knowledge base |
| `src/status/server.ts` | Express server + full HTML command surface |
| `src/tray/lifecycle.ts` | Main orchestration — all engine init |
