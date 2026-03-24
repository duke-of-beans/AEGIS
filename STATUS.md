# AEGIS — STATUS

**Status:** active
**Phase:** v3.0 — AEGIS-LEARN-01 shipped, AEGIS-MCP-02 next
**Last Sprint:** AEGIS-LEARN-01
**Last Updated:** 2026-03-24
**Completion:** v2 92% / v3 85%

---

## Architectural Direction

AEGIS is a Cognitive Resource OS. All five intelligences are now live.
Full vision: D:\Projects\AEGIS\VISION.md (locked 2026-03-24).

## Open Work — v3

- [ ] **[P2]** AEGIS-MCP-02: Rich MCP publisher — get_cognitive_load, get_context,
      get_process_tree, get_runaways, apply_policy_overlay, get_action_log
- [ ] **[P1]** AEGIS-UI-01: Command surface redesign — cockpit model, action log centerpiece
- [ ] **[P3]** AEGIS-INSTALLER-01: v3.0.0 installer rebuild
- [ ] **[P3]** Historical performance graphs, pm2 boot health-check

## Completed

- [x] AEGIS-LEARN-01: LearningStore (sessions.db, action outcomes, load samples, confidence
      state), CognitiveLoadEngine (6-signal weighted composite 0-100, equal weights →
      learned), feedback endpoint POST /feedback, renderLoad badge in header,
      renderConfidence (progress bar, decisions until auto), wired into collector +
      lifecycle (2026-03-24)
- [x] AEGIS-SNIPER-01: BaselineEngine + SniperEngine + worker PID methods (ad95dd0, 2026-03-24)
- [x] AEGIS-CONTEXT-01: ContextEngine + PolicyManager (2bf86be, 2026-03-24)
- [x] AEGIS-MONITOR-01: Disk/SMART/network/GPU/DPC/spawn tree (f88a926, 2026-03-24)
- [x] AEGIS-CATALOG-01: Process knowledge base, 210-process seed (1c4df3f, 2026-03-24)
- [x] AEGIS-BRAVE-03, AEGIS-ELEV-01, AEGIS-PM2-01, ESLint, BRAVE-02, BRAVE-01, v2.0.0

## Blockers

None.

## Key Files

| File | Purpose |
|------|---------|
| `VISION.md` | v3 vision document |
| `src/learning/store.ts` | LearningStore — sessions, outcomes, confidence |
| `src/learning/load.ts` | CognitiveLoadEngine — 0-100 composite score |
| `src/sniper/baseline.ts` | Welford baseline engine |
| `src/sniper/engine.ts` | Sniper rules engine |
| `src/context/engine.ts` | Context detection |
| `src/context/policies.ts` | Composable policy stack |
| `src/catalog/manager.ts` | Process knowledge base |
| `src/status/server.ts` | Express server + full HTML command surface |
| `src/tray/lifecycle.ts` | Main orchestration — all engine init |
| `scripts/aegis-worker.ps1` | PowerShell worker — all privileged ops |
