# AEGIS — BACKLOG
Last Updated: 2026-03-25 (AEGIS-CDP-01 closed — P2 queue empty)

## P1 — High Priority
(none)

## P2 — Normal Queue
(empty — AEGIS v2 functionally complete)

## P3 — Eventually
- [ ] Visual rule editor for profiles
- [ ] Historical performance graphs (CPU/RAM over time)
- [ ] pm2 boot health-check — verify resurrect succeeded at logon

## Friction / Dev Environment
- [ ] Desktop Commander read_file returns empty for text files in Cowork. Workaround:
  start_process + Get-Content or node helper script pattern.
- [ ] node/npm via Start-Process in PS profile: always specify cmd shell explicitly.
- [ ] cmd pipe syntax fails in DC shell — use start_process with shell: cmd.
- [ ] Unicode stdout issues in Python scripts via DC — use -Encoding UTF8 or redirect.
- [ ] better-sqlite3 @types package must be installed at both root and sidecar level.
  Root: npm install @types/better-sqlite3. Sidecar: use .d.ts shim (npm refuses install
  there). Note this in any future sprint that touches catalog or sqlite.

## Completed
- [x] AEGIS-CDP-01: per-profile CDP port config — profiles_dir bug fixed, log_dir fixed,
  cdp_port added to browser_suspension in idle/wartime/build-mode profiles, Settings UI
  CDP Port field added to Profiles tab, status.js empty-state de-hardcoded. lint: 0 errors,
  tsc: 0 errors. (2026-03-25)
- [x] AEGIS-INTEL-06: catalog wiring — constructor fix, seedIfEmpty, recordObservation,
  get_state catalog stats, cockpit amber/red counts. 200 clean entries. (7dca86f → e3a5a06) (2026-03-25)
- [x] AEGIS-HELP-01: CSS-only tooltip system — data-tooltip on all 20+ elements (eed64b5) (2026-03-25)
- [x] AEGIS-BRAVE-03: tab suspension UI — per-tab controls, bulk ops, collapsible panel (815b5fb) (2026-03-25)
- [x] AEGIS-PROCS-01: process management — suspend/resume/end/priority, risk-aware UX (685dd89) (2026-03-25)
- [x] AEGIS-INTEL-05: PolicyManager, context overlays, cockpit context panel, manual lock (bf59ef7 + 4a35f91) (2026-03-25)
- [x] AEGIS-AMBIENT-01: ambient-first tray, per-process pin, override panel (0c63805) (2026-03-25)
- [x] AEGIS-INTEL-04: LearningStore, feedback RPC, confidence panel, auto mode (f75968c) (2026-03-25)
- [x] AEGIS-INTEL-03: BaselineEngine + SniperEngine wired, update_processes RPC (10fc32e) (2026-03-25)
- [x] AEGIS-ELEV-01: elevation gate (2026-03-22)
- [x] AEGIS-PM2-01: pm2 migration — ecosystem.config.cjs, bounce.bat, startup resurrect (2026-03-22)
- [x] ESLint gate: tab-manager.ts, cdp-client.ts, menu.ts, lifecycle.ts, index.ts (2026-03-22)
- [x] BRAVE-02: status window tab panel, Brave launch helper, per-profile suspension config
- [x] BRAVE-01: Brave tab manager — CDP client, tab tracking, suspension engine
- [x] v2.0.0: installer built (AEGIS-Setup-2.0.0.exe)
- [x] Startup tasks removed
