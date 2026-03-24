# AEGIS — STATUS

**Status:** active
**Phase:** v3.0 — core complete, UI shipped, installer shipped
**Last Sprint:** AEGIS-UI-01
**Last Updated:** 2026-03-24
**Completion:** v3 100% core / installer ready

---

## Architectural Direction

AEGIS is a Cognitive Resource OS. All five intelligences are live, wired, and published.
The cockpit UI is the command surface — every metric adjacent to its action.
The MCP publisher exposes the full intelligence stack to GREGORE and GregLite.
Full vision: D:\Projects\AEGIS\VISION.md (locked 2026-03-24).

## Open Work

- [ ] **[P2]** AEGIS-LEARN-02: Action outcome analysis — surface patterns from LearningStore
      (which rules fire most, which get negative feedback, confidence drift over time)
- [ ] **[P2]** AEGIS-CATALOG-02: Live identification queue UI in cockpit — unknown processes
      that need cataloging shown inline with quick-resolve form
- [ ] **[P3]** AEGIS-SNIPER-02: Custom sniper rules — user-defined rules via config or cockpit UI
- [ ] **[P3]** AEGIS-INSTALLER-02: Signed installer / NSIS package (single .exe, no ps1 execution policy)
- [ ] **[P3]** AEGIS-CONTEXT-02: Manual context override from cockpit — force context, lock it

## Completed

- [x] AEGIS-UI-01: Command surface redesign — full HTML cockpit builder (src/status/html.ts).
      3-column layout: left (vitals/context/profile/timer), center (process tree + tabs),
      right (action log permanent + confidence). Process spawn tree with │ ├─ └─ hierarchy.
      Cognitive load score as hero element with phosphor glow. CRT scanlines, grid atmosphere.
      JetBrains Mono → Consolas cascade. ASCII structural box-drawing (┌─ SECTION ───).
      Installer: rich PowerShell with 6-line block-art AEGIS banner, 6-step ceremony,
      pm2 daemon, startup task, Claude Desktop MCP auto-config. (0e35683, 2026-03-24)
- [x] AEGIS-MCP-02: Rich MCP publisher — 14 tools, setIntelligence() wires all v3 engines.
      aegis_preflight() is the GREGORE entry point. (b0c416a, 2026-03-24)
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
| `src/status/html.ts` | Cockpit HTML builder — full command surface |
| `src/status/server.ts` | Express server + all HTTP routes |
| `src/mcp/server.ts` | Rich MCP publisher — 14 tools |
| `src/learning/store.ts` | LearningStore — sessions, outcomes, confidence |
| `src/learning/load.ts` | CognitiveLoadEngine — 0-100 composite score |
| `src/sniper/baseline.ts` | Welford baseline engine |
| `src/sniper/engine.ts` | Sniper rules engine |
| `src/context/engine.ts` | Context detection |
| `src/context/policies.ts` | Composable policy stack |
| `src/catalog/manager.ts` | Process knowledge base |
| `src/tray/lifecycle.ts` | Main orchestration — all engine init |
| `installer/install.ps1` | Rich PowerShell installer — v3.0.0 |

## Sprint Commit Log

| Sprint | Commit | Date | Summary |
|--------|--------|------|---------|
| AEGIS-UI-01 | 0e35683 | 2026-03-24 | Cockpit redesign + installer |
| AEGIS-MCP-02 | b0c416a | 2026-03-24 | 14-tool MCP publisher |
| AEGIS-LEARN-01 | 8d3b4cd | 2026-03-24 | LearningStore + CognitiveLoad |
| AEGIS-SNIPER-01 | ad95dd0 | 2026-03-24 | Baseline + Sniper engines |
| AEGIS-CONTEXT-01 | 2bf86be | 2026-03-24 | Context + Policy stack |
| AEGIS-MONITOR-01 | f88a926 | 2026-03-24 | Extended monitoring surface |
| AEGIS-CATALOG-01 | 1c4df3f | 2026-03-24 | Process knowledge base |
