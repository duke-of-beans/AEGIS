# AEGIS — STATUS

**Status:** active
**Phase:** v3.0 — AEGIS-SNIPER-01 shipped, AEGIS-LEARN-01 next
**Last Sprint:** AEGIS-SNIPER-01
**Last Updated:** 2026-03-24
**Completion:** v2 92% / v3 70%

---

## Architectural Direction

AEGIS is transitioning from resource optimizer to Cognitive Resource OS.
Full vision: D:\Projects\AEGIS\VISION.md (locked 2026-03-24).
Project DNA: D:\Projects\AEGIS\PROJECT_DNA.yaml

The v3 architecture replaces static profiles with composable policies, adds five
intelligence systems (Catalog, Baseline, Context, Sniper, Learning), extends the
monitoring surface to cover disk I/O, SMART, network, GPU, DPC, and spawn tree.

## v2 Current State

TypeScript clean. Zero errors. Running independently via pm2.
Tab suspension, CDP integration, per-profile config, elevation gate all live.

## Open Work — v3

- [ ] **[P1]** AEGIS-UI-01: Command surface redesign — cockpit model, spawn tree default,
      action log centerpiece, all safety tiers, policy stack panel
- [ ] **[P2]** AEGIS-LEARN-01: Learning loop + cognitive load score — SQLite sessions/outcomes,
      weighted feedback, confidence score, composite load number
- [ ] **[P2]** AEGIS-MCP-02: Rich MCP publisher — get_cognitive_load, get_context,
      get_process_tree, get_runaways, apply_policy_overlay, get_action_log
- [ ] **[P3]** AEGIS-INSTALLER-01: v3.0.0 installer rebuild
- [ ] **[P3]** Historical performance graphs, pm2 boot health-check

## Completed

- [x] AEGIS-SNIPER-01: BaselineEngine (Welford online variance, baselines.db, per-process
      per-context fingerprints), SniperEngine (3 built-in rules, blast radius multipliers,
      graduated throttle→suspend→kill, catalog gate, context exemptions, cooldown tracking,
      EventEmitter sniper events), worker PID actions (throttle/suspend/kill), sniper section
      in status window (watches + action log) (2026-03-24)
- [x] AEGIS-CONTEXT-01: ContextEngine + PolicyManager, composable policy stack, context
      section in status window (2bf86be, 2026-03-24)
- [x] AEGIS-MONITOR-01: Disk I/O, SMART, network, GPU, DPC, spawn tree (f88a926, 2026-03-24)
- [x] AEGIS-CATALOG-01: Process knowledge base, 210-process seed, canActOn gate (1c4df3f, 2026-03-24)
- [x] AEGIS-BRAVE-03: Tab suspension UI, per-profile CDP port (ca936bc, 2026-03-24)
- [x] AEGIS-ELEV-01, AEGIS-PM2-01, ESLint gate, BRAVE-02, BRAVE-01, v2.0.0 installer

## Blockers

None.

## Key Files

| File | Purpose |
|------|---------|
| `VISION.md` | v3 vision document |
| `PROJECT_DNA.yaml` | Identity, decisions, sprint queue |
| `src/sniper/baseline.ts` | Welford baseline engine, baselines.db |
| `src/sniper/engine.ts` | Sniper rules engine, graduated actions |
| `src/context/engine.ts` | Context detection, foreground tracking |
| `src/context/policies.ts` | Composable policy stack |
| `src/catalog/manager.ts` | Process knowledge base, canActOn gate |
| `src/status/server.ts` | Express server + full HTML command surface |
| `src/tray/lifecycle.ts` | Main orchestration, all engine init |
| `scripts/aegis-worker.ps1` | PowerShell worker — all privileged ops |
