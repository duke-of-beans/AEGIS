# AEGIS — CHANGELOG

All notable changes to AEGIS are documented here.
Format: [Sprint] Date — Summary

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
