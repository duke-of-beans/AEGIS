# AEGIS — BACKLOG
Last Updated: 2026-03-25 (AEGIS-INTEL-06 closed)

## P1 — High Priority
(none)

## P2 — Normal Queue
- [ ] AEGIS-CDP-01: per-profile CDP port config — currently hardcoded port 9222. Each profile
  should carry its own port so multiple Brave instances can be tracked simultaneously.
  Unblocked, no dependencies.


## P3 — Eventually
- [ ] Visual rule editor for profiles
- [ ] Historical performance graphs (CPU/RAM over time)
- [ ] pm2 boot health-check — verify resurrect succeeded at logon

## Friction / Dev Environment
- [ ] Desktop Commander read_file returns empty for all text files in Cowork environment.
  Workaround: start_process + Get-Content (or node helper script per template workaround
  docs). Investigate if DC allowedDirectories config is the cause.
- [ ] node/npm Start-Process workaround pattern: when DC shell defaults to PS profile,
  node commands must be wrapped via Start-Process or cmd shell explicitly. Document
  in sprint prompts going forward.
- [ ] cmd pipe syntax fails in DC shell — use start_process with explicit cmd shell.
- [ ] DC read_file empty for text files (pre-existing, same as above).
- [ ] Unicode stdout issues in Python scripts run via DC — use -Encoding UTF8 flag or
  redirect to file and read back.

## Completed
- [x] AEGIS-INTEL-06: catalog wiring — constructor fix, seedIfEmpty, recordObservation, get_state stats, cockpit panel, 200-entry seed. Lint gate fixed (8e25562) (2026-03-25)
- [x] AEGIS-HELP-01: CSS-only tooltip system — data-tooltip on all 20+ cockpit elements,
  settings window, dynamic elements via status.js (eed64b5) (2026-03-25)
- [x] AEGIS-BRAVE-03: tab suspension UI — per-tab controls, bulk ops, collapsible panel,
  graceful empty state, toast feedback, StatusServer endpoints (815b5fb) (2026-03-25)
- [x] AEGIS-PROCS-01: process management — suspend/resume/end/priority with risk-aware UX (685dd89) (2026-03-25)
- [x] AEGIS-INTEL-05: PolicyManager, context overlays, sniper context respect, cockpit context panel, manual lock (bf59ef7 + 4a35f91) (2026-03-25)
- [x] AEGIS-AMBIENT-01: ambient-first tray, per-process pin, override panel (0c63805) (2026-03-25)
- [x] AEGIS-INTEL-04: LearningStore, feedback RPC, implicit approval, confidence panel (f75968c) (2026-03-25)
- [x] AEGIS-INTEL-03: BaselineEngine + SniperEngine wired, update_processes RPC, action log (10fc32e) (2026-03-25)
- [x] AEGIS-ELEV-01: elevation gate (2026-03-22)
- [x] AEGIS-PM2-01: pm2 migration — ecosystem.config.cjs, bounce.bat, startup resurrect (2026-03-22)
- [x] ESLint gate: tab-manager.ts, cdp-client.ts, menu.ts, lifecycle.ts, index.ts (2026-03-22)
- [x] BRAVE-02: status window tab panel, Brave launch helper, per-profile suspension config
- [x] BRAVE-01: Brave tab manager — CDP client, tab tracking, suspension engine
- [x] v2.0.0: installer built (AEGIS-Setup-2.0.0.exe)
- [x] Startup tasks removed
