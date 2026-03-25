# AEGIS — STATUS

**Status:** active
**Phase:** v2.x feature development — process intelligence + UI layer
**Last Sprint:** AEGIS-HELP-01
**Last Updated:** 2026-03-25
**Completion:** 87%

## Architectural Direction — Independent Daemon (March 23, 2026)

GregLite's browser-native pivot decouples AEGIS from the GregLite window lifecycle entirely.
AEGIS becomes (and in practice already is) an independent daemon — it runs whether or not
the GregLite UI is open. This is the correct architecture: AEGIS monitors the system, not a
window. Under Tauri, AEGIS was coupled to window events. Under browser-native, AEGIS
communicates with the GregLite sidecar via local HTTP/socket. The daemon pattern also means
AEGIS can serve multiple consumers (GregLite, GREGORE, standalone CLI queries, dashboard).
pm2 lifecycle management already in place validates this direction.

## Current State

Process management is fully operational — pause/resume, priority, and end task with risk-aware
implications. The intelligence engine is fully integrated: PolicyManager fires context overlays
on every transition, sniper respects build context (2× threshold, node/cargo/rustc/tsc/python
exempt), and context history persists across restarts. The cockpit context panel is live with
confidence bar, time-in-context, focus-driving processes, and manual lock modal. Ambient mode
is the default tray posture — profiles are manual overrides. The feedback/learning loop is
wired end-to-end with implicit approval and auto mode at ≥75% confidence. Brave tab
suspension is fully operational with per-tab and bulk controls from the status window.
All cockpit interactive elements now have hover tooltips.

ESLint gate: 0 errors across all source files. Quality gates passing on all recent sprints.

Known friction: Desktop Commander read_file returns empty for text files in the Cowork
environment — workaround is start_process + Get-Content. Logged to backlog.

## What's Complete

- [x] AEGIS-HELP-01: CSS-only tooltip system (data-tooltip + ::after) across all interactive
  elements in status.hta, settings.hta, and dynamically-rendered elements in status.js (ecfd292)
- [x] AEGIS-BRAVE-03: tab suspension UI — per-tab SUSPENDED/ACTIVE badges, per-tab
  Suspend/Restore buttons, bulk Suspend All / Restore All, collapsible panel,
  localStorage state persistence, browser toast notifications (2026-03-25)
- [x] AEGIS-PROCS-01: process management — suspend_process (CreateToolhelp32Snapshot +
  SuspendThread), resume_process (ResumeThread), get_process_info (30-process lookup,
  risk_label/blast_radius/implication), pause/resume/end modals with risk-branched UX
  (CRITICAL_SYSTEM red dismiss / CAUTION 2s hold / SAFE standard), action log with [Manual]
  prefix and ✓/✗ icons, sidecar outcome/error fields (685dd89)
- [x] AEGIS-INTEL-05: PolicyManager live — applyContextOverlays() on every context transition,
  policies_updated events, timed overlay pruning, sniper context respect (build 2× threshold,
  idle 0.5×, exempt node/cargo/rustc/tsc/python), context_history.jsonl persists to
  %APPDATA%\AEGIS\, cockpit context panel fully live (confidence bar, time-in-context, top
  focus processes, last 5 transitions, manual lock modal 30/60/120 min),
  sidecar_lock_context Tauri command registered (bf59ef7 + 4a35f91)
- [x] AEGIS-AMBIENT-01: tray rebuilt (TrayIconBuilder ambient-first, profiles under Manual
  Override submenu, Release Override conditional), cockpit pill clickable (dim AMBIENT / amber
  OVERRIDE), right-panel override section, per-process pin (localStorage aegis_process_pins,
  applyPinsOnce()), sidecar override_active in get_state/apply_profile/heartbeat (0c63805)
- [x] AEGIS-INTEL-04: LearningStore instantiated on boot, recordAction() on every sniper
  action, feedback RPC wired (recordExplicitFeedback, double-count guard via feedbackReceived
  Set, confidence_updated), implicit approval after 60s, detached tokio task emits
  feedback_prompt at 90s, sidecar_feedback Tauri command, cockpit feedback bar + confidence
  panel (live %, decisions-until-auto, auto mode offer at ≥75%, localStorage persist) (f75968c)
- [x] AEGIS-INTEL-03: BaselineEngine + SniperEngine wired, listens on 'event'/action_taken,
  update_processes RPC from metrics.rs on every 2s poll, suspend action in
  handle_sniper_request, cockpit sniper_action → SNAP + renderAlog() + canvas spike (10fc32e)
- [x] AEGIS-ELEV-01: elevation gate — checkIsElevated(), applyProfile() guard, startup toast,
  status indicator (2026-03-22)
- [x] AEGIS-PM2-01: pm2 ecosystem config, bounce.bat, startup resurrect
- [x] ESLint gate: tab-manager.ts, cdp-client.ts, menu.ts, lifecycle.ts, index.ts
- [x] BRAVE-02: status window tab panel, Brave launch helper, per-profile suspension config
- [x] BRAVE-01: Brave tab manager — CDP client, tab tracking, suspension engine
- [x] v2.0.0: installer built, installed to D:\Dev\aegis\
- [x] Startup tasks removed

## Open Work

- [ ] **[P2]** AEGIS-INTEL-06: blocked — needs v4 spec rewrite before execution, do not run without it
- [ ] **[P2]** Per-profile CDP port config (currently hardcoded)
- [ ] **[P3]** Visual rule editor for profiles
- [ ] **[P3]** Historical performance graphs (CPU/RAM over time)
- [ ] **[P3]** pm2 boot health-check — verify resurrect succeeded at logon

## Blockers

AEGIS-INTEL-06 blocked on spec rewrite.

## Key Files

| File | Purpose |
|------|---------|
| `src/browser/tab-manager.ts` | Brave tab tracking, suspension engine, launchBrave() |
| `src/browser/cdp-client.ts` | WebSocket CDP client for Brave remote debugging |
| `src/tray/lifecycle.ts` | Main process orchestration, tray wiring |
| `src/tray/index.ts` | TrayDependencies interface, menu dispatch |
| `sidecar/src/main.ts` | LearningStore, SniperEngine, PolicyManager, RPC dispatch |
| `src/status/server.ts` | Status HTTP server, /status /switch /timer /tabs endpoints |
| `assets/status.hta` | Status window HTML — profile badge, vitals, process sections, tabs |
| `assets/settings.hta` | Settings window HTML — General/Profiles/Integrations/Startup/About |
| `assets/status.js` | Shared JS — polling, renderStatus, profile switcher, timer, drag |
| `assets/status.css` | Shared CSS — design system, tooltip system (AEGIS-HELP-01) |
| `D:\Meta\ecosystem.config.cjs` | pm2 process config |
| `D:\Meta\bounce.bat` | pm2 restart dashboard |
