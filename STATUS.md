# AEGIS — STATUS

**Status:** active
**Phase:** v2.x — complete (P2 queue empty)
**Last Sprint:** AEGIS-CDP-01
**Last Updated:** 2026-03-25
**Completion:** 100%

## Architectural Direction — Independent Daemon (March 23, 2026)

GregLite's browser-native pivot decouples AEGIS from the GregLite window lifecycle entirely.
AEGIS is an independent daemon communicating with the GregLite sidecar via local HTTP/socket.
The daemon pattern means AEGIS can serve multiple consumers (GregLite, GREGORE, standalone
CLI queries, dashboard). pm2 lifecycle management already in place validates this direction.

## Current State

Intelligence stack fully operational end-to-end: catalog gate (200 seeded processes,
unknown observation active, cockpit counts live) → baseline engine → sniper with context
multipliers and build exemptions → policy overlays → learning feedback loop → auto mode.
Full cockpit tooltip coverage. Brave tab panel with per-tab and bulk suspend/restore.
Process management with risk-aware UX. Ambient mode default tray posture.
Per-profile CDP port config live — each profile carries explicit cdp_port in browser_suspension.

Known friction: Desktop Commander read_file returns empty for text files in Cowork —
workaround is start_process + Get-Content (documented in BACKLOG).

## What's Complete

- [x] AEGIS-CDP-01: per-profile CDP port config — profiles_dir bug fixed (was pointing to
  deleted D:\Projects\AEGIS\profiles, now D:\Dev\aegis\profiles), log_dir fixed likewise.
  cdp_port: 9222 added to browser_suspension in idle, wartime, build-mode profiles (only
  profiles that had browser_suspension blocks). Settings UI Profiles tab now renders CDP Port
  input field per profile, loads from profile data, saves via POST. status.js empty-state
  strings no longer hardcode 9222 — use generic "--remote-debugging-port set" message.
  lint: 0 errors. tsc: 0 errors. (TBD commit hash)
- [x] AEGIS-INTEL-06: catalog wiring — constructor bug fixed (appDataPath not dbPath),
  seedIfEmpty() fires on startup (200 clean entries, 2 dupes removed), recordObservation()
  wired into update_processes 2s poll, get_state returns catalog.total/unknown/suspicious +
  unresolved_processes + suspicious_processes arrays, cockpit panel with amber/red live
  counts. Root lint fixed (@types/better-sqlite3 installed). Sidecar tsc fixed via .d.ts
  shim. Stale catalog.db directory at %APPDATA%\AEGIS deleted and recreated as file.
  (7dca86f → e3a5a06)
- [x] AEGIS-HELP-01: CSS-only tooltip system, all 20+ cockpit elements (eed64b5)
- [x] AEGIS-BRAVE-03: tab suspension UI, bulk ops, collapsible panel, toast feedback (815b5fb)
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

- [ ] **[P3]** Visual rule editor for profiles
- [ ] **[P3]** Historical performance graphs (CPU/RAM over time)
- [ ] **[P3]** pm2 boot health-check — verify resurrect succeeded at logon

## Blockers

None.

## Key Files

| File | Purpose |
|------|---------|
| `sidecar/src/catalog/manager.ts` | CatalogManager — lookup, canActOn, recordObservation |
| `sidecar/src/catalog/schema.ts` | CatalogDb — better-sqlite3 schema, seed |
| `sidecar/src/catalog/seed.json` | 200 seeded Windows processes |
| `sidecar/src/main.ts` | Engine init, RPC dispatch, catalog wiring |
| `assets/status.css` | CSS-only tooltip system (data-tooltip) |
| `assets/status.hta` | Main cockpit |
| `assets/settings.hta` | Settings window |
| `assets/status.js` | Dynamic tooltip assignment |
| `src/browser/tab-manager.ts` | Brave tab tracking, suspension engine |
| `src/browser/cdp-client.ts` | WebSocket CDP client |
| `src/tray/lifecycle.ts` | Main process orchestration |
| `src-tauri/src/metrics.rs` | 2s poll loop, update_processes feed |
| `src-tauri/src/sidecar.rs` | handle_sniper_request, events |
| `src-tauri/src/commands.rs` | All Tauri commands |
| `D:\Meta\ecosystem.config.cjs` | pm2 process config |
| `D:\Meta\bounce.bat` | pm2 restart dashboard |
