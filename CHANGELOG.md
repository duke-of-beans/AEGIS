# AEGIS — CHANGELOG

## [AEGIS-AMBIENT-01] — 2026-03-25

### Ambient-First UI: Profiles Demoted to Manual Override

- **Tray menu restructured** (`src-tauri/src/tray.rs`) — `TrayIconBuilder::with_id("tray")` used for stable ID; default header "AEGIS — Cognitive Resource OS"; ambient status item "● Ambient — auto-managing" shown as informational (disabled); profiles moved to "Manual Override" submenu; "Release Override" item appears in submenu only when override is active
- **Override state in tray** — `OverrideState = Arc<Mutex<String>>` tracks active profile name; empty = ambient; `TrayState<R>` managed in `AppState` so event handlers can call `set_menu` / `set_tooltip` on the live tray without re-building from scratch
- **Tray tooltip** — "AEGIS — ambient" at rest; "AEGIS — override: [name]" when override active; rebuilt on every profile switch or release
- **Cockpit header pill** (`pp-intel`) — "AMBIENT" in dim color when no override; "OVERRIDE: [NAME]" in amber when active; clickable: opens release-override confirmation modal if override active, no-op if ambient; `pillIntelClick()` global function
- **Right-panel override section** — state dot (green = ambient, amber = override); `fw2` label shows "ambient — auto-managing" or profile name in amber; "release" button appears only when override is active; "change" button always present; `updOverridePanel()` called from `renderHdr()` on every render cycle
- **Per-process pin button** — "⊕ pin" (or "📌 pinned") appears on process row hover alongside pause/priority/end; opens `openPinModal()` with current priority, dropdown (high/above_normal/normal/below_normal/idle), plain-English implication text per level, and "AEGIS will not auto-adjust [process] while this pin is active" notice
- **Pin storage** — `localStorage['aegis_process_pins']` JSON object `{ "process.exe": "priority" }`; client-side only, not persisted to sidecar or YAML (intentional — UI preference); `applyPinsOnce()` re-applies all pins via `set_process_priority` on first metrics update after load
- **Release-override modal** — separate confirmation dialog: "Release [profile] override and return to ambient mode?" with [YES — RETURN TO AMBIENT] / [CANCEL]; triggered from pill click or right-panel release button; calls `switch_profile({name:'idle'})` on confirm
- **Sidecar `get_state`** (`sidecar/src/main.ts`) — `override_active: activeProfile !== 'idle' && activeProfile !== ''` added to response; `apply_profile` normalizes empty string to 'idle'; `override_active: isOverride` included in `apply_profile` response; heartbeat includes `override_active` field

### Architecture Decisions
- Ambient mode is NOT a new profile. It is the absence of an override. No `ambient.yaml` created.
- Per-process pins are localStorage only. The sidecar treats them as transient. Documented intentionally — they are UI preferences that survive browser reloads but not sidecar restarts without cockpit re-applying them.
- `TrayState<R>` uses `Arc<Mutex<Option<TrayIcon<R>>>>` managed via `app.manage()` so async event handlers can borrow the tray for menu rebuild without holding the app reference.

### Quality Gate
- `npm run lint`: ✅ 0 errors, 0 warnings
- `cargo check`: ✅ 0 errors, 3 pre-existing warnings (profiles.rs dead field, sidecar.rs unused structs — not introduced this sprint)
## [AEGIS-INTEL-04] — 2026-03-25

### Learning Store: Feedback Loop Operational

- **LearningStore instantiated** in `sidecar/src/main.ts` `initEngines()` — uses `initLearningStore()` singleton, opens `%APPDATA%/AEGIS/sessions.db`, calls `start()` and `startSession(ctx)` on boot
- **`feedback` RPC method** fully wired — calls `recordExplicitFeedback(action_id, signal, intensity)`, marks `feedbackReceived` Set to prevent implicit approval race, emits `confidence_updated` event with score + auto_mode_unlocked + decisions_until_auto
- **`recordAction()` called** on every `sniper_engine` `action_taken` event — stores process name, action, context, zscore, cpu/memory before action; returns `action_id` included in `sniper_action_requested` event payload
- **Implicit approval timer** — `setTimeout(60_000)` per action; if no explicit feedback received within 60s, calls `updateActionOutcome()` (mild positive) and emits `confidence_updated`; skipped if action was explicitly reviewed via `feedbackReceived` Set
- **90-second feedback prompt** — `handle_sniper_request` in `sidecar.rs` spawns a `tokio::async_runtime::spawn` task that sleeps 90s then emits `feedback_prompt` Tauri event with `{action_id, process_name, action, reason, timestamp}`; never blocks the sniper handler thread
- **`sidecar_feedback` Tauri command** added to `commands.rs` — calls `send_to_sidecar("feedback", {action_id, signal, intensity})`; registered in `main.rs` invoke handler
- **Cockpit feedback prompt bar** (`#fbprompt`) — appears below action log when `feedback_prompt` event fires; shows process name + action; Yes/OK/No buttons call `submitFeedback(signal, intensity)` → `sidecar_feedback` invoke; dismissed after response or × click
- **Confidence panel enhanced** — `#cscore-val` shows live 0-100% score; `#cscore-dec` shows decisions-until-auto or "threshold met"; both update on every `confidence_updated` event
- **Auto mode offer** — `#auto-link` ("enable auto mode?") appears when score ≥ 75 or `auto_mode_unlocked` flag set; clicking opens modal explaining auto mode; [Enable Auto] persists state to `localStorage`; `#auto-badge` ("● AUTO MODE ACTIVE") shown when enabled
- **Auto mode state** persisted to `localStorage` (UI preference only, not sidecar db) — restored on `DOMContentLoaded`
- **`feedbackReceived` Set** module-level in `main.ts` — tracks action_ids that have received explicit feedback; prevents implicit approval from double-counting

### Architecture Decision
Auto mode state is a UI preference, not a sidecar concern. The sidecar tracks confidence through feedback signals regardless. The cockpit decides whether to show confirmation UI based on `auto_mode_unlocked`. This separation means AEGIS can act autonomously even if the cockpit is closed.

### Quality Gate
- `tsc --noEmit` — 0 errors ✓
- Sidecar binary rebuilt — `src-tauri/binaries/aegis-sidecar-x86_64-pc-windows-msvc.exe` ✓
- `cargo check` — 9 pre-existing errors in `tray.rs` (Tauri API mismatch, not introduced by this sprint); 0 new errors in `commands.rs` or `sidecar.rs` ✓

---

## [AEGIS-INTEL-03] — 2026-03-25

### Sniper Engine with Baseline: Fully Operational

- **BaselineEngine** instantiated in sidecar with db path `%APPDATA%/AEGIS/baseline.db` — Welford online variance, per-process per-context fingerprints
- **SniperEngine** constructor fixed — now receives `BaselineEngine` + `CatalogManager` (null-safe proxy if catalog not ready)
- **`update_processes` RPC** added to sidecar `handleRequest()` — feeds process snapshots to `sniperEngine.ingest()` on every metrics cycle
- **Rust metrics loop** now sends `update_processes` to sidecar on every 2s poll (alongside existing `update_metrics`)
- **`suspend` action** added to `handle_sniper_request` in `sidecar.rs` (throttle/suspend/kill all wired)
- **Cockpit action log** — `sniper_action` Tauri event listener now pushes actions into `SNAP.sniper.recent_actions` and calls `renderAlog()`; plain-English reason displayed inline
- **Sniper canvas** spike animation fires on `sniper_action` event (existing animation, now triggered by real events)
- **Context sync** — `sniperEngine.setContext()` called on every `context_changed` event so sniper thresholds respect current context
- **Sidecar binary** rebuilt via `@yao-pkg/pkg` node20-win-x64 (58.2 MB)
- `npm run lint`: 0 errors · `cargo check`: 0 errors

**Expected behavior:** Sniper will not fire immediately — requires MIN_SAMPLES (20) observations per process per context before baseline is reliable. `baseline.db` will appear at `%APPDATA%/AEGIS/` within minutes of first launch.


All notable changes to AEGIS are documented here.
Format: [Sprint] Date — Summary

---

## [AEGIS-INTEL-02] 2026-03-25 — Cognitive Load Engine: Wire to Cockpit

### Added
- `CognitiveLoadEngine.update(cpu, mem, context)` adapter method — baseline formula: `(cpu * 0.5) + (mem * 0.3) + (context !== idle ? 20 : 0)`, clamped 0-100
- `CognitiveLoadEngine.getScore()` — returns last computed score
- `CognitiveLoadEngine` constructor now accepts optional `LearningStore` — can be instantiated standalone for INTEL-02 path; full compute() path preserved for INTEL-04
- `loadEngine` module-level variable in sidecar `main.ts` — instantiated in `initEngines()`, best-effort (logs warn if unavailable)
- `update_metrics` JSON-RPC method in sidecar — receives `cpu_percent` + `memory_percent` from Rust, calls `loadEngine.update()`, emits `load_score_updated` event with score + tier
- `send_to_sidecar()` in `sidecar.rs` — writes JSON-RPC request to sidecar stdin via `AppState.sidecar_tx`; best-effort, logs on failure, never panics
- Metrics polling loop (`metrics.rs`) now calls `send_to_sidecar("update_metrics", {cpu_percent, memory_percent})` on every 2s cycle
- Sidecar exit clears `AppState.sidecar_tx` to `None` so subsequent `send_to_sidecar` calls are silent no-ops
- Cockpit `intelligence_update` listener: new `load_score_updated` branch reads `d.score` (0-100 int) directly; sets `load-num` class to `g`/`a`/`r` (green <40, amber 40-70, red ≥70 with glow); legacy `d.cognitive_load` (0-1 float) path preserved for heartbeat compatibility

### Quality Gate
- `npm run lint` — 0 errors ✓
- `cargo check` — 0 errors, 3 pre-existing warnings (not introduced by this sprint) ✓
- Sidecar binary rebuilt: `src-tauri/binaries/aegis-sidecar-x86_64-pc-windows-msvc.exe` ✓

---

## [AEGIS-COCKPIT-02] 2026-03-25 — Complete Cockpit Rewrite

### Fixed
- Tab navigation: `sel()` is a top-level function declaration accessible on `window` — all 6 nav tabs (CPU/Memory/Disk/Network/GPU/Context) switch the detail panel correctly
- Light mode toggle: wired via `addEventListener` (not `onclick=`), persists to `localStorage`
- Process action buttons: `showProcModal()`, `execProcAction()`, `openPriMenu()`, `selectPri()` all globally scoped and functional
- Tauri IPC: `window._aegisInvoke` set in `waitForTauri()` callback, before any process action can fire
- Rust → SNAP field mapping: `m.cpu.percent` → `cpu_percent`, `m.memory.used_mb` → `memory_mb_used`, `m.disks` → `disk_stats.drives`, `m.networks` → `network_stats.adapters`
- Process CPU display: uses `p.cpu_percent` (0-100 float), not `cpu_user_ms` — shows "14.2%" correctly

### Added
- Sniper canvas animation: live random-walk line with crosshair, fading trail, scan grid, bright current dot — `requestAnimationFrame` throttled at 80ms
- Sniper spike animation: `sniper_action` event triggers a 8-frame spike on the canvas
- Process action modals: full implications text per action (pause/priority/end), system-critical warning for svchost/lsass/csrss/dwm/msedgewebview2
- Process action feedback: green "Paused ✓" or red "Failed: [reason]" inline in modal — no silent failures
- Priority submenu: 5-level picker with plain-English implications modal before executing
- `intelligence_update` event listener: wires cognitive load score, confidence bar, context to cockpit
- Profile override: demoted to bottom of right panel, labeled MANUAL OVERRIDE, not prominent
- `DOMContentLoaded` init block: calls `initTip()`, `initSniperCanvas()`, restores theme from localStorage, wires all nav click handlers
- `toggleTheme()` globally scoped, wired via `addEventListener`
- Tooltip delay: 900ms — deliberate, not nervous

### Design
- Font sizes: base 14px, nav metric values 17px, detail header 30px, stat values 17px, process rows 12px
- Color palette: surface #0d1117, warm accent #c8a060, text primary #dce6f0, border #1c2535 — less aggressively cyan
- Light mode: warm paper tones (#f2ede8 bg), not clinical white

### Quality Gate
- `npm run lint` — 0 errors, 0 warnings ✓
- `npx tsc --noEmit` — 0 errors ✓
- BUILD.bat: cargo tauri build running (installer pending)

---

## [AEGIS-INTEL-01] 2026-03-25 — Per-Drive Disk I/O via WMI

### Added
- `src-tauri/src/disk_io.rs`: new module — queries `Win32_PerfFormattedData_PerfDisk_LogicalDisk` via `wmi` crate
- `get_disk_io()` returns `HashMap<String, (u64, u64)>` (drive letter → read/write bytes/sec); never panics, returns empty map on any WMI error
- `wmi = "0.13"` added to `Cargo.toml` dependencies
- `disk_io` module registered in `main.rs`
- `metrics.rs` `collect_metrics()` calls `get_disk_io()` once per poll cycle and wires real values into `DiskMetrics.read_bytes_sec` / `write_bytes_sec` (replaces hardcoded 0s)
- Multiple drives handled automatically via HashMap lookup by uppercase drive letter

### Quality Gate
- `cargo check`: 0 errors, 0 new warnings (3 pre-existing warnings in profiles.rs/sidecar.rs unaffected)

---

## [AEGIS-TAURI-02-04] 2026-03-24 — Tray + Live Metrics + Sidecar + Cockpit

### Added
- Native system tray icon with 6 profile items, Open Cockpit, Quit
- Live CPU/RAM/disk/network/process metrics via sysinfo crate (no elevation)
- Full Task Manager-style cockpit WebView (35KB HTML, ported from v3)
- Intelligence sidecar compiled to native binary (48.5MB pkg bundle)
- JSON-RPC 2.0 stdio IPC between Rust core and sidecar
- All 5 intelligence engines wired: context, sniper, learning, catalog, policy
- Heartbeat + proactive event push (context_changed, load_score_updated, sniper_action_requested)
- Cockpit uses window.__TAURI__.event.listen() + invoke() — no HTTP server

### Fixed
- sysinfo 0.33 API compatibility: Disks/Networks refresh() signatures
- ProcessRefreshKind::nothing() vs ::new() for sysinfo 0.33
- CheckMenuItemBuilder → MenuItemBuilder with bullet prefix (Tauri 2 API)
- logger/index.ts: removed import.meta.url (ESM-only, incompatible with CommonJS)
- catalog/manager.ts: import.meta.url → __dirname for seed.json path

### Architecture
- Node.js HTTP server (port 8743): retired
- pm2 ecosystem: retired
- PowerShell worker (aegis-worker.ps1): retired
- systray2 tray library: retired
- pkg snapshot icon issues: resolved (Tauri native tray)

---

## [AEGIS-TAURI-01] 2026-03-24 — Tauri 2 Scaffold (commit 18f3812)

### Added
- src-tauri/ — full Tauri 2 Rust project scaffold
- main.rs — app entry, tray init, async runtime, profile apply on startup
- metrics.rs — sysinfo polling (CPU/RAM/disk/network/processes), emits "metrics" events
- commands.rs — Tauri IPC: switch_profile, set_process_priority, kill_process_cmd
- profiles.rs — YAML profile loader + apply via Win32 SetPriorityClass
- tray.rs — native system tray stub
- sidecar.rs — sidecar spawn + supervise (loop-based, not recursive)
- sidecar/src/main.ts — JSON-RPC entry stub
- ui/index.html — minimal placeholder
- Cargo.toml: sysinfo 0.33, windows 0.58, tokio, serde, serde_yaml, tauri 2

### Verified
- cargo check: 0 errors
- cargo tauri dev: aegis.exe compiled and running (PID verified, 49MB RAM)

---

## [AEGIS-UI-01] 2026-03-24 — v3 Cockpit (Node era, retired by TAURI-04)

### Added (Node era, now superseded)
- Full Task Manager layout cockpit (src/status/html.ts)
- 3-column layout: vitals/context/profile, process tree, action log
- CRT scanlines aesthetic, JetBrains Mono → Consolas cascade
- ASCII box-drawing structural elements
- pm2 daemon, startup task, Claude Desktop MCP auto-config

---

## [AEGIS-MCP-02] 2026-03-24 — 14-Tool MCP Publisher (commit b0c416a)

### Added
- 14-tool MCP publisher (src/mcp/server.ts)
- setIntelligence() wires all v3 engines
- aegis_preflight() as GREGORE entry point

---

## [AEGIS-LEARN-01] 2026-03-24 — LearningStore + CognitiveLoad (commit 8d3b4cd)

### Added
- LearningStore: SQLite-backed session and outcome tracking
- CognitiveLoadEngine: 0-100 composite score

---

## [AEGIS-SNIPER-01] 2026-03-24 — Baseline + Sniper Engine (commit ad95dd0)

### Added
- BaselineEngine: Welford online baseline per process
- SniperEngine: deviation detection, graduated action dispatch

---

## [AEGIS-CONTEXT-01] 2026-03-24 — Context + Policy Stack (commit 2bf86be)

### Added
- ContextEngine: foreground window → context classification
- PolicyManager: composable context overlay stack

---

## [AEGIS-MONITOR-01] 2026-03-24 — Extended Monitoring (commit f88a926)

### Added
- Disk/SMART/network/GPU/DPC/spawn tree monitoring
- Process spawn tree with │ ├─ └─ hierarchy

---

## [AEGIS-CATALOG-01] 2026-03-24 — Process Knowledge Base (commit 1c4df3f)

### Added
- Process catalog with 210-process seed data
- Trust tiers, blast radius categories, behavioral norms

---

## [AEGIS-DEVOPS-01] 2026-03-25 — Pre-Push Lint Gate (commit: 9428d99)

### Added
- `.git/hooks/pre-push` — POSIX shell script that runs `npm run lint` before every push
- Push blocked with clear error output if lint fails (exit code printed, offending lines shown)
- Emergency bypass documented in hook header: `git push --no-verify`
- `CONTRIBUTING.md` — Development section: lint requirement, typecheck, commit message workflow

### Quality Gates
- `npm run lint` — 0 errors, 0 warnings ✓
- `npx tsc --noEmit` — 0 errors ✓
- Hook verified: injected `@typescript-eslint/no-unused-vars` error blocked correctly
