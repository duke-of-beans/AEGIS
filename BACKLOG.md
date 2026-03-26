# AEGIS — BACKLOG
# READ ARCHITECTURE.md BEFORE TOUCHING THIS PROJECT.
Last Updated: 2026-03-25

## COMPLETED

- [x] ~~Fix tray.rs~~ — TRAY-FIX complete (2026-03-25). Root cause: missing
  `src-tauri/binaries/` directory (sidecar stub) and `@types/node` not installing
  due to npm `omit=dev` global config. tray.rs API was already correct for Tauri 2.
  cargo check: 0 errors. cargo build --release: compiles. npx tsc --noEmit: 0 errors.

## P1 — Intelligence Completion

- [x] ~~AEGIS-LEARN-01: Learning loop + cognitive load score~~ (shipped 2026-03-25)
  Sacred context weighting (10x), confidence relay to cockpit, periodic emission,
  getConfidenceScore() + recordActionOutcome() convenience APIs, computeLoad() with tiers.

- [x] ~~AEGIS-MCP-02: Rich MCP publisher~~ (shipped 2026-03-25)
  8 tools: get_system_snapshot, get_cognitive_load, get_context, get_process_tree,
  get_action_log, get_confidence, get_session_summary, apply_policy_overlay.
  Stdio transport, --mcp flag. MCP_INTEGRATION.md with 3 integration paths
  (Claude Desktop, GregLite, GREGORE).

## P2 — Polish

- [ ] AEGIS-UI-01: Command surface redesign (cockpit polish)
  Depends on: AEGIS-MONITOR-01 (shipped)

## P2 — Release

- [ ] Full cargo tauri build + NSIS installer test
  Depends on: tray.rs fix ✅ (resolved)
  Remaining: bundle sidecar (npm run build-and-bundle), run cargo tauri build, test NSIS
