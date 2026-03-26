# AEGIS — BACKLOG
# READ ARCHITECTURE.md BEFORE TOUCHING THIS PROJECT.
Last Updated: 2026-03-26

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

- [x] ~~AEGIS-RUNTIME-01: Three runtime bugs from first successful build test~~ (shipped 2026-03-26)
  1. Tray click toggle race — replaced is_visible() with Arc<Mutex<bool>> toggle flag in tray.rs.
     main.rs on_window_event syncs flag on CloseRequested.
  2. Metrics warmup — double refresh_all() with 500ms delay before poll loop in metrics.rs.
  3. Installer perMachine — verified "installMode": "perMachine" in tauri.conf.json.

- [x] ~~AEGIS-DEBUG-01: REAL fix for three runtime bugs~~ (shipped 2026-03-26)
  RUNTIME-01 fixes were insufficient. DEBUG-01 root-caused and fixed properly:
  1. Tray debounce — Tauri fires TrayIconEvent::Click for BOTH mouse-down and mouse-up.
     Arc<Mutex<bool>> toggle flipped twice per physical click. Replaced with CockpitState
     struct containing visible flag + Instant last_toggle. 500ms debounce ignores double-fire.
  2. Metrics emit_to — Hidden WebView may not receive global app.emit(). Added direct
     window.emit("metrics", &metrics) via get_webview_window("cockpit") alongside global emit.
     Added log::info! for runtime diagnostics.
  3. UI scaling — Root font-size 14px→16px (20%+ larger). Tooltip delay 900ms→300ms.

- [x] ~~AEGIS-EVENTS-01: Fix WebView event delivery~~ (shipped 2026-03-26)
  ROOT CAUSE: Tauri 2 does not deliver emit() events to a WebView that starts
  with `visible: false` — the JS context never initializes, so listeners never register.
  FIX 1: Show cockpit briefly on startup (300ms) then hide — JS context initializes.
  FIX 1B: Added static metrics cache + `get_latest_metrics` IPC command as fallback.
  FIX 1C: Extracted `handleMetricsPayload()` function, initial `invoke('get_latest_metrics')`.
  FIX 2: Sidecar `pkg` assets now include `better-sqlite3` native `.node` addon.
  FIX 3: WMI disk I/O `Win32_PerfFormattedData_PerfDisk_LogicalDisk` — class was correct
  but error spammed 30x/min. Added `AtomicBool` one-shot disable on first failure.
  FIX 4: Light mode `toggleTheme()` — added diagnostic logging, resilient `localStorage` try/catch.

## P2 — Polish

- [ ] AEGIS-UI-01: Command surface redesign (cockpit polish)
  UX clarity — too many panels, no visual hierarchy for actionable vs informational.
  Depends on: RUNTIME-01 (metrics must display before polish makes sense)
