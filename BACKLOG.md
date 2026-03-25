# AEGIS — BACKLOG
Last Updated: 2026-03-25 (AEGIS-BRAVE-03 closed)

## P1 — High Priority
(none)

## P2 — Normal Queue
- [ ] AEGIS-INTEL-06: context engine next phase — BLOCKED on v4 spec rewrite. Do not execute without updated spec.
- [ ] Per-profile CDP port config (currently hardcoded)

## P3 — Eventually
- [ ] Visual rule editor for profiles
- [ ] Historical performance graphs (CPU/RAM over time)
- [ ] pm2 boot health-check — verify resurrect succeeded at logon

## Friction / Dev Environment
- [ ] Desktop Commander read_file returns empty for all text files in Cowork environment.
  Workaround: start_process + Get-Content. Investigate if DC allowedDirectories config is the cause.
- [ ] node/npm invocation in PowerShell pipeline context blocked by GREGORE profile ("Could not determine Node.js install directory"). Workaround: Start-Process with -RedirectStandardOutput. Node lives at D:\Program Files\nodejs\node.exe.

## Completed
- [x] AEGIS-HELP-01: hover tooltips — CSS-only data-tooltip system (status.css), all interactive elements in status.hta, settings.hta, and dynamically-rendered elements in status.js (ecfd292) (2026-03-25)
- [x] AEGIS-BRAVE-03: tab suspension UI — per-tab + bulk suspend/restore, collapsible panel, localStorage persistence (2026-03-25)
- [x] AEGIS-PROCS-01: process management — suspend/resume/end/priority with risk-aware UX (685dd89) (2026-03-25)
- [x] AEGIS-INTEL-05: PolicyManager, context overlays, sniper context respect, cockpit context panel, manual lock (bf59ef7 + 4a35f91) (2026-03-25)
- [x] AEGIS-AMBIENT-01: ambient-first tray, per-process pin, override panel, sidecar override_active (0c63805) (2026-03-25)
- [x] AEGIS-INTEL-04: LearningStore, feedback RPC, implicit approval, confidence panel, auto mode (f75968c) (2026-03-25)
- [x] AEGIS-INTEL-03: BaselineEngine + SniperEngine wired, update_processes RPC, cockpit action log (10fc32e) (2026-03-25)
- [x] AEGIS-ELEV-01: elevation gate — checkIsElevated(), applyProfile() guard, startup toast, status indicator (2026-03-22)
- [x] AEGIS-PM2-01: pm2 migration — ecosystem.config.cjs, bounce.bat, startup resurrect (2026-03-22)
- [x] ESLint gate: tab-manager.ts, cdp-client.ts, menu.ts, lifecycle.ts, index.ts (2026-03-22)
- [x] BRAVE-02: status window tab panel, Brave launch helper, per-profile suspension config (a364fd3)
- [x] BRAVE-01: Brave tab manager — CDP client, tab tracking, suspension engine
- [x] v2.0.0: installer built (AEGIS-Setup-2.0.0.exe), installed to D:\Dev\aegis\
- [x] Startup tasks removed (AEGIS_Startup, AEGIS Cognitive Resource Manager)
