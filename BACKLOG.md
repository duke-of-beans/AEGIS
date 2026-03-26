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

## P1 — Runtime Fixes (from first Tauri build test)

- [ ] AEGIS-RUNTIME-01: Three runtime bugs from first successful build test
  1. Tray click toggle race — window bounces open/closed, needs 5+ clicks.
     Fix: replace is_visible() with Arc<Mutex<bool>> toggle flag.
  2. Metrics showing 0%/-- — sysinfo needs warmup refresh before poll loop.
     Fix: double refresh_all() with 500ms delay before entering loop.
  3. Installer perMachine — tauri.conf.json already changed, verify + rebuild.
  Sprint prompt: AEGIS_SPRINT_RUNTIME-01.md (written, ready for Cowork)

## P2 — Polish

- [ ] AEGIS-UI-01: Command surface redesign (cockpit polish)
  UX clarity — too many panels, no visual hierarchy for actionable vs informational.
  Depends on: RUNTIME-01 (metrics must display before polish makes sense)
