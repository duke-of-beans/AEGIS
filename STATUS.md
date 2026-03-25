# AEGIS — STATUS

**Status:** active
**Phase:** v2.x feature development — CDP config
**Last Sprint:** AEGIS-INTEL-06
**Last Updated:** 2026-03-25
**Completion:** 90%

## Architectural Direction — Independent Daemon (March 23, 2026)

GregLite's browser-native pivot decouples AEGIS from the GregLite window lifecycle entirely.
AEGIS becomes (and in practice already is) an independent daemon — it runs whether or not
the GregLite UI is open. AEGIS communicates with the GregLite sidecar via local HTTP/socket.
The daemon pattern means AEGIS can serve multiple consumers (GregLite, GREGORE, standalone
CLI queries, dashboard). pm2 lifecycle management already in place validates this direction.

## Current State

Full cockpit tooltip coverage across all 20+ interactive elements (status.hta, settings.hta,
status.js dynamic elements) via CSS-only data-tooltip system. Brave tab panel live with
per-tab and bulk suspend/restore, collapsible panel, graceful CDP-unavailable empty state,
and toast feedback. Process management, ambient mode, context engine, PolicyManager, and
learning feedback loop all operational. Quality gates clean across all recent sprints.

Known friction: Desktop Commander read_file returns empty for text files in Cowork —
workaround is start_process + Get-Content (documented in BACKLOG).

## What's Complete

- [x] AEGIS-INTEL-06: catalog wiring — constructor fix, seedIfEmpty, recordObservation, get_state stats, cockpit panel, 200-entry seed (8e25562) (2026-03-25)
- [x] AEGIS-HELP-01: CSS-only tooltip system (assets/status.css data-tooltip), tooltips on
  all 20+ interactive elements across status.hta + settings.hta, setAttribute at render
  time for all dynamic elements in status.js (eed64b5)
- [x] AEGIS-BRAVE-03: per-tab SUSPENDED/ACTIVE badge + Suspend/Restore buttons, bulk
  Suspend All / Restore All, collapsible panel (localStorage persist), graceful empty state,
  toast feedback on HTTP error, POST /tabs/suspend-all + /tabs/restore-all on StatusServer,
  route ordering fixed (815b5fb, rebased with HELP-01)
- [x] AEGIS-PROCS-01: suspend/resume/end/priority with risk-aware UX (685dd89)
- [x] AEGIS-INTEL-05: PolicyManager, context overlays, sniper context respect, cockpit
  context panel, manual lock (bf59ef7 + 4a35f91)
- [x] AEGIS-AMBIENT-01: ambient-first tray, per-process pin, override panel (0c63805)
- [x] AEGIS-INTEL-04: LearningStore, feedback RPC, implicit approval, confidence panel (f75968c)
- [x] AEGIS-INTEL-03: BaselineEngine + SniperEngine wired, update_processes RPC (10fc32e)
- [x] AEGIS-ELEV-01: elevation gate (2026-03-22)
- [x] AEGIS-PM2-01: pm2 ecosystem config, bounce.bat, startup resurrect
- [x] ESLint gate: tab-manager.ts, cdp-client.ts, menu.ts, lifecycle.ts, index.ts
- [x] BRAVE-02: status window tab panel, Brave launch helper, per-profile suspension config
- [x] BRAVE-01: Brave tab manager — CDP client, tab tracking, suspension engine
- [x] v2.0.0: installer built, installed to D:\Dev\aegis\
- [x] Startup tasks removed

## Open Work

- [ ] **[P2]** AEGIS-CDP-01: per-profile CDP port config — currently hardcoded, unblocked
- [ ] **[P3]** Visual rule editor for profiles
- [ ] **[P3]** Historical performance graphs (CPU/RAM over time)
- [ ] **[P3]** pm2 boot health-check — verify resurrect succeeded at logon

## Blockers

None.

## Key Files

| File | Purpose |
|------|---------|
| `assets/status.css` | CSS-only tooltip system (data-tooltip) |
| `assets/status.hta` | Main cockpit — tooltips, tab panel, process table |
| `assets/settings.hta` | Settings window — all tab tooltips |
| `assets/status.js` | Dynamic tooltip assignment for rendered elements |
| `src/browser/tab-manager.ts` | Brave tab tracking, suspension engine, launchBrave() |
| `src/browser/cdp-client.ts` | WebSocket CDP client for Brave remote debugging |
| `src/tray/lifecycle.ts` | Main process orchestration, tray wiring |
| `sidecar/src/main.ts` | LearningStore, SniperEngine, PolicyManager, RPC dispatch |
| `src-tauri/src/metrics.rs` | 2s poll loop, update_processes feed to sidecar |
| `src-tauri/src/sidecar.rs` | handle_sniper_request, sniper_action, feedback_prompt |
| `src-tauri/src/commands.rs` | All Tauri commands including tab suspend/restore |
| `D:\Meta\ecosystem.config.cjs` | pm2 process config |
| `D:\Meta\bounce.bat` | pm2 restart dashboard |
