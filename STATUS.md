# AEGIS — STATUS

**Status:** active
**Phase:** v3.0 — AEGIS-MONITOR-01 shipped, AEGIS-CONTEXT-01 next
**Last Sprint:** AEGIS-MONITOR-01
**Last Updated:** 2026-03-24
**Completion:** v2 92% / v3 30%

---

## Architectural Direction

AEGIS is transitioning from resource optimizer to Cognitive Resource OS.
Full vision: D:\Projects\AEGIS\VISION.md (locked 2026-03-24).
Project DNA: D:\Projects\AEGIS\PROJECT_DNA.yaml

The v3 architecture replaces static profiles with composable policies, adds five
intelligence systems (Catalog, Baseline, Context, Sniper, Learning), extends the
monitoring surface to cover disk I/O, SMART, network, GPU, DPC, and spawn tree —
and introduces a command surface (cockpit model) replacing the current status window.
The MCP server becomes a first-class feature.

v3 prerequisite: AEGIS-CATALOG-01 (process knowledge base) must ship before any
sniper or learning work begins. Nothing gets targeted before it is understood.

## v2 Current State (ca936bc)

TypeScript clean. Zero errors across 26 source files.
Status window: HTML view at GET / with 2s auto-refresh, per-tab suspend/restore,
process list, elevation warning. Running independently via pm2.
Tab suspension, CDP integration, per-profile config, elevation gate all live.

## Open Work — v3 Sprint Queue

- [x] **[P0]** AEGIS-MONITOR-01: Extended monitoring — disk I/O delta, SMART health,
      network per-adapter, GPU, DPC/interrupt, spawn tree, hard fault rate (COMMIT_HASH_PLACEHOLDER, 2026-03-24)
- [ ] **[P1]** AEGIS-UI-01: Command surface redesign — cockpit model, spawn tree default,
      action log centerpiece, all safety tiers, policy stack panel
- [ ] **[P1]** AEGIS-CONTEXT-01: Context detection engine — WinEvent hooks, foreground
      tracking, named contexts, composable policy layer replacing profiles
- [ ] **[P1]** AEGIS-SNIPER-01: Sniper rules engine — baseline engine, deviation detection,
      graduated throttle/suspend/kill, TESSRYX blast radius integration
- [ ] **[P2]** AEGIS-LEARN-01: Learning loop + cognitive load score — SQLite sessions/outcomes,
      weighted feedback, confidence score, composite load number
- [ ] **[P2]** AEGIS-MCP-02: Rich MCP publisher — get_cognitive_load, get_context,
      get_process_tree, get_runaways, apply_policy_overlay, get_action_log
- [ ] **[P3]** AEGIS-INSTALLER-01: v3.0.0 installer rebuild

## Open Work — v2 Remaining

- [ ] **[P3]** Historical performance graphs (CPU/RAM over time)
- [ ] **[P3]** pm2 boot health-check — verify resurrect succeeded at logon

## Completed

- [x] AEGIS-BRAVE-03: tab suspension UI, per-tab HTML controls, per-profile CDP port (ca936bc, 2026-03-24)
- [x] AEGIS-ELEV-01: elevation gate — checkIsElevated(), applyProfile() guard, toast (2026-03-22)
- [x] AEGIS-PM2-01: pm2 migration, bounce.bat, startup resurrect (2026-03-22)
- [x] ESLint gate: all 26 source files clean (2026-03-22)
- [x] BRAVE-02: status window tab panel, Brave launch helper, per-profile suspension config
- [x] BRAVE-01: Brave tab manager — CDP client, tab tracking, suspension engine
- [x] v2.0.0: installer built (AEGIS-Setup-2.0.0.exe)
- [x] Startup tasks removed

## Blockers

None.

## Key Files

| File | Purpose |
|------|---------|
| `VISION.md` | v3 vision document (locked 2026-03-24) |
| `PROJECT_DNA.yaml` | Project identity, decisions, sprint queue |
| `src/browser/tab-manager.ts` | Brave tab tracking, suspension engine |
| `src/browser/cdp-client.ts` | WebSocket CDP client |
| `src/tray/lifecycle.ts` | Main process orchestration |
| `src/status/server.ts` | Express status server + HTML command surface |
| `scripts/aegis-worker.ps1` | PowerShell worker — all privileged ops |
