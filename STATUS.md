# AEGIS — STATUS

**Status:** active
**Phase:** v2.x feature development — browser integration
**Last Sprint:** AEGIS-ELEV-01
**Last Updated:** 2026-03-23
**Completion:** 72%

## Architectural Direction — Independent Daemon (March 23, 2026)

GregLite's browser-native pivot decouples AEGIS from the GregLite window lifecycle entirely.
AEGIS becomes (and in practice already is) an independent daemon — it runs whether or not
the GregLite UI is open. This is the correct architecture: AEGIS monitors the system, not a
window. Under Tauri, AEGIS was coupled to window events. Under browser-native, AEGIS
communicates with the GregLite sidecar via local HTTP/socket. The daemon pattern also means
AEGIS can serve multiple consumers (GregLite, GREGORE, standalone CLI queries, dashboard).
pm2 lifecycle management already in place validates this direction.

## Current State

ESLint pre-commit gate is now clean — zero errors across all 26 source files. The three files flagged after BRAVE-02 (tab-manager.ts, cdp-client.ts, menu.ts) are fixed, plus the lifecycle.ts/index.ts cascade from the async removal. `git commit` without `--no-verify` now succeeds.

Elevation gate is now live. AEGIS detects administrator status at startup and degrades gracefully — privileged ops (priority, services, power plan, QoS, memory trim) are skipped with a warn log + one-time toast when not elevated. Profile switches always complete. Status window shows amber indicator when not elevated.

Dashboard server is managed by pm2 (ecosystem.config.cjs at D:\Meta). Process name: `dashboard`. Bounce is `pm2 restart dashboard` or `D:\Meta\bounce.bat`. A `pm2-resurrect.bat` is in the Windows Startup folder so pm2 restores the process list on logon without elevation.

Note: the existing dashboard-server.js process (PID 13444) that was running pre-sprint could not be killed from the Cowork sandbox (EPERM). pm2 will take full ownership after the next reboot or manual termination of that process. Dashboard is currently serving correctly on port 7171.

## What's Complete

- [x] AEGIS-PM2-01: pm2 ecosystem config, bounce.bat, startup resurrect, Task Scheduler confirmed absent
- [x] ESLint gate: tab-manager.ts (async removed), cdp-client.ts (assertion + toString), menu.ts (dead var), lifecycle.ts + index.ts (interface cascade)
- [x] BRAVE-02: status window tab panel, Brave launch helper, per-profile suspension config (a364fd3)
- [x] BRAVE-01: Brave tab manager — CDP client, tab tracking, suspension engine
- [x] v2.0.0: installer built (AEGIS-Setup-2.0.0.exe), installed to D:\Dev\aegis\
- [x] Startup tasks removed (AEGIS_Startup, AEGIS Cognitive Resource Manager)

## Open Work

- [x] **[P1]** AEGIS-ELEV-01: elevation gate — shipped 2026-03-22
- [ ] **[P2]** AEGIS-BRAVE-03: tab suspension UI — activate/restore from status window
- [ ] **[P2]** Per-profile CDP port config (currently hardcoded)
- [ ] **[P3]** Visual rule editor for profiles
- [ ] **[P3]** Historical performance graphs (CPU/RAM over time)
- [ ] **[P3]** pm2 boot health-check — verify resurrect succeeded at logon (low effort)

## Blockers

None.

## Key Files

| File | Purpose |
|------|---------|
| `src/browser/tab-manager.ts` | Brave tab tracking, suspension engine, launchBrave() |
| `src/browser/cdp-client.ts` | WebSocket CDP client for Brave remote debugging |
| `src/tray/lifecycle.ts` | Main process orchestration, tray wiring |
| `src/tray/index.ts` | TrayDependencies interface, menu dispatch |
| `D:\Meta\ecosystem.config.cjs` | pm2 process config for dashboard-server.js |
| `D:\Meta\bounce.bat` | One-liner restart: pm2 restart dashboard |
| `D:\Meta\dashboard-server.js` | Portfolio dashboard HTTP server (port 7171) |
