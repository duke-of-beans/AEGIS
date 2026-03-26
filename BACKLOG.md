# AEGIS — BACKLOG
# READ ARCHITECTURE.md BEFORE TOUCHING THIS PROJECT.
Last Updated: 2026-03-25

## BLOCKER — Must Fix First

- [ ] Fix tray.rs — 9 Tauri API compile errors blocking cargo tauri build
  Errors: .id("tray") method, closure type inference, Tauri 2 API mismatch.
  These were identified in the Cowork sprint batch (DEVOPS-01 through AMBIENT-01)
  but never resolved. This is the ONLY thing preventing a working Tauri build.
  Sprint: AEGIS-TRAY-FIX

## P1 — Intelligence Completion

- [ ] AEGIS-LEARN-01: Learning loop + cognitive load score
  SQLite schema: sessions, snapshots, outcomes, transitions.
  Weighted feedback: implicit (no undo 60s), measurable (CPU wait delta),
  explicit (tray toast). Confidence score → Auto mode unlock.
  Depends on: AEGIS-SNIPER-01 (shipped), AEGIS-CONTEXT-01 (shipped)

- [ ] AEGIS-MCP-02: Rich MCP publisher
  Tools: get_cognitive_load, get_context, get_process_tree, get_snapshot,
  apply_policy_overlay, get_runaways, get_action_log, get_session_summary.
  GREGORE + GregLite integration protocols.
  Depends on: AEGIS-LEARN-01

## P2 — Polish

- [ ] AEGIS-UI-01: Command surface redesign (cockpit polish)
  Depends on: AEGIS-MONITOR-01 (shipped)

## P3 — Release

- [ ] Full cargo tauri build + installer test
  Depends on: tray.rs fix
