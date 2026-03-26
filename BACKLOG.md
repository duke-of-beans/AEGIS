# AEGIS — BACKLOG
# READ ARCHITECTURE.md BEFORE TOUCHING THIS PROJECT.
Last Updated: 2026-03-25

## COMPLETED

- [x] ~~Fix tray.rs~~ — TRAY-FIX complete (2026-03-25). Root cause: missing
  `src-tauri/binaries/` directory (sidecar stub) and `@types/node` not installing
  due to npm `omit=dev` global config. tray.rs API was already correct for Tauri 2.
  cargo check: 0 errors. cargo build --release: compiles. npx tsc --noEmit: 0 errors.

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

## P2 — Release

- [ ] Full cargo tauri build + NSIS installer test
  Depends on: tray.rs fix ✅ (resolved)
  Remaining: bundle sidecar (npm run build-and-bundle), run cargo tauri build, test NSIS
