# AEGIS — STATUS
# READ ARCHITECTURE.md BEFORE TOUCHING THIS PROJECT.

**Status:** active
**Phase:** v4.0 — Tauri app shell compiles, UI-01 next
**Last Sprint:** AEGIS-MCP-02 (rich MCP publisher)
**Last Updated:** 2026-03-25

## Architecture

AEGIS is a **Tauri 2 desktop application** with a **Node.js sidecar**.
See ARCHITECTURE.md for the definitive reference.

## What's Built

### Tauri App Shell (src-tauri/)
- [x] TAURI-01: Tauri 2 scaffold + Rust metrics core (18f3812)
- [x] TAURI-02-04: tray, live metrics, sidecar, cockpit WebView (d7967f5)
- [x] TAURI-05: NSIS installer with ASCII art boot sequence (36772a2)
- [x] Custom icon — concentric rings mark (7c6e7d8)
- [x] COCKPIT-01: tabs, tooltips, process management, light mode (c04c469)
- [x] COCKPIT-02: complete cockpit rewrite — all systems functional (0cc5e0c)
- [x] AMBIENT-01: ambient-first tray, profiles demoted to override (0c63805)
- [x] tray.rs compiles cleanly (TRAY-FIX resolved — was missing binaries/ dir + @types/node)

### Intelligence Sidecar (sidecar/)
- [x] CATALOG-01: 210-process knowledge base, canActOn gate (1c4df3f)
- [x] INTEL-01: per-drive disk I/O via WMI (4579e48)
- [x] INTEL-02: cognitive load engine wired to cockpit (ae76492)
- [x] INTEL-03: sniper engine with baseline fully operational (10fc32e)
- [x] INTEL-04: learning store feedback loop operational (f75968c)
- [x] LEARN-01: learning loop complete — sacred context weighting, confidence relay, periodic emission
- [x] MCP-02: rich MCP publisher — 8 tools, stdio transport, Claude Desktop / GregLite / GREGORE integration
- [x] INTEL-05: context engine full integration (bf59ef7)
- [x] INTEL-06: catalog wiring — constructor fix, cockpit counts (7dca86f)
- [x] PROCS-01: process management with implications (685dd89)

### Cockpit UI (ui/)
- [x] Task Manager-style layout: CPU/RAM/Disk/Net/GPU panels
- [x] Sniper animation canvas
- [x] Context detection panel with confidence
- [x] Action log with color-coded entries
- [x] Process management with risk-aware UX (pause/priority/end/pin)
- [x] Light/dark theme toggle
- [x] Cognitive load score display
- [x] Catalog panel (known/unknown/suspicious counts)
- [x] Profile override panel (manual, demoted from primary)

## Open Work

- [ ] **[P1]** AEGIS-RUNTIME-01: Fix tray toggle bounce, metrics→cockpit wiring, perMachine installer
- [ ] **[P2]** AEGIS-UI-01: Command surface redesign (cockpit polish)

## Blockers

None. cargo check and cargo build --release pass with 0 errors.
Runtime issues (tray bounce, metrics zeros) identified — sprint prompt ready.

## Key Files

| File | Purpose |
|------|---------|
| ARCHITECTURE.md | **READ THIS FIRST** — definitive architecture reference |
| src-tauri/src/commands.rs | All Tauri IPC commands (569 lines) |
| src-tauri/src/metrics.rs | 2s poll loop, CPU/RAM/process data |
| src-tauri/src/sidecar.rs | Sidecar lifecycle management |
| src-tauri/src/tray.rs | System tray (compiles cleanly) |
| sidecar/src/main.ts | Intelligence sidecar entry point |
| sidecar/src/catalog/ | Process knowledge base |
| sidecar/src/context/ | Context detection + composable policies |
| sidecar/src/sniper/ | Baseline engine + deviation rules |
| sidecar/src/learning/ | Feedback loop + cognitive load |
| sidecar/src/mcp/server.ts | MCP tool server (8 tools, stdio) |
| MCP_INTEGRATION.md | MCP integration guide (3 paths) |
| ui/index.html | Cockpit UI (422 lines, Task Manager layout) |
| profiles/*.yaml | 6 profiles (manual override only) |
