# AEGIS — STATUS
# READ ARCHITECTURE.md BEFORE TOUCHING THIS PROJECT.

**Status:** active
**Phase:** v4.0 — Tauri app shell built, tray.rs blocker, LEARN-01 next
**Last Sprint:** AEGIS-COCKPIT-02 / INTEL-04 / AMBIENT-01 (Cowork batch)
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
- [ ] **BLOCKER**: tray.rs — 9 compile errors (Tauri API mismatch)

### Intelligence Sidecar (sidecar/)
- [x] CATALOG-01: 210-process knowledge base, canActOn gate (1c4df3f)
- [x] INTEL-01: per-drive disk I/O via WMI (4579e48)
- [x] INTEL-02: cognitive load engine wired to cockpit (ae76492)
- [x] INTEL-03: sniper engine with baseline fully operational (10fc32e)
- [x] INTEL-04: learning store feedback loop operational (f75968c)
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

- [ ] **[BLOCKER]** Fix tray.rs — 9 Tauri API compile errors
- [ ] **[P1]** AEGIS-LEARN-01: Learning loop + cognitive load score (sidecar)
- [ ] **[P1]** AEGIS-MCP-02: Rich MCP publisher (sidecar)
- [ ] **[P2]** AEGIS-UI-01: Command surface redesign (cockpit polish)
- [ ] **[P3]** Full Tauri build + installer test

## Blockers

- tray.rs: 9 compile errors from Tauri API mismatch (.id("tray"), closure
  type inference). Must be resolved before cargo tauri build succeeds.

## Key Files

| File | Purpose |
|------|---------|
| ARCHITECTURE.md | **READ THIS FIRST** — definitive architecture reference |
| src-tauri/src/commands.rs | All Tauri IPC commands (569 lines) |
| src-tauri/src/metrics.rs | 2s poll loop, CPU/RAM/process data |
| src-tauri/src/sidecar.rs | Sidecar lifecycle management |
| src-tauri/src/tray.rs | System tray (BLOCKED — 9 errors) |
| sidecar/src/main.ts | Intelligence sidecar entry point |
| sidecar/src/catalog/ | Process knowledge base |
| sidecar/src/context/ | Context detection + composable policies |
| sidecar/src/sniper/ | Baseline engine + deviation rules |
| sidecar/src/learning/ | Feedback loop + cognitive load |
| ui/index.html | Cockpit UI (422 lines, Task Manager layout) |
| profiles/*.yaml | 6 profiles (manual override only) |
