# AEGIS — STATUS
# READ ARCHITECTURE.md BEFORE TOUCHING THIS PROJECT.

**Status:** active
**Phase:** v4.0 — Cockpit rewritten with verified IPC, first live data confirmed
**Last Sprint:** AEGIS-COCKPIT-REWRITE (2026-03-26, in-chat, Filesystem:write_file)
**Last Updated:** 2026-03-26

## Architecture

AEGIS is a **Tauri 2 desktop application** with a **Node.js sidecar**.
See ARCHITECTURE.md for the definitive reference.

## What's Built — VERIFIED WORKING

### Tauri App Shell (src-tauri/) — ALL REAL
- [x] TAURI-01: Tauri 2 scaffold + Rust metrics core (18f3812)
- [x] TAURI-02-04: tray, live metrics, sidecar, cockpit WebView (d7967f5)
- [x] TAURI-05: NSIS installer (36772a2)
- [x] Custom icon (7c6e7d8)
- [x] AMBIENT-01: ambient-first tray, profiles as override (0c63805)
- [x] TRAY-FIX: CockpitState debounce — fixes Windows double-fire (5b91c2c)
- [x] DEBUG-01 Rust portions: tray debounce struct, metrics emit_to cockpit (c796043)
- [x] EVENTS-01 Rust portions: show-then-hide WebView init, metrics cache, get_latest_metrics IPC, WMI one-shot disable (326b18c)

### Intelligence Sidecar (sidecar/) — ALL REAL
- [x] CATALOG-01: 210-process knowledge base (1c4df3f)
- [x] INTEL-01 through INTEL-06: full intelligence stack
- [x] LEARN-01: learning loop, sacred context weighting
- [x] MCP-02: 8 MCP tools, stdio transport
- [x] PROCS-01: process management with implications (685dd89)

### Cockpit UI (ui/index.html) — REWRITTEN 2026-03-26
- [x] Tauri IPC wiring (connectTauri + __TAURI__.event.listen)
- [x] handleMetrics() maps Rust SystemMetrics to UI
- [x] Tab switching (CPU, Memory, Disk, Network, Processes)
- [x] Process list sorted by CPU or memory
- [x] Disk table with free/total/used
- [x] Network adapter table with recv/sent
- [x] Sidebar with uptime, cores, freq, IPC status, event count
- [x] get_latest_metrics invoke fallback
- [x] VERIFIED: debug page confirmed TAURI FOUND + 72 events with real data

## WASTED SPRINTS — Phantom Edits (wrote to Claude container, not disk)
- RUNTIME-01 UI portions — never reached disk
- DEBUG-01 UI portions — never reached disk
- EVENTS-01 UI portions — never reached disk
- See: D:\Meta\BUG_REPORT_CLAUDE_PHANTOM_EDITS_2026-03-26.md

## Open Work
- [ ] **[P1]** Rebuild with new cockpit (cargo tauri build) — cockpit on disk, needs compile
- [ ] **[P2]** AEGIS-UI-01: Visual polish pass (the new cockpit is functional but minimal)
- [ ] **[P2]** Fix better-sqlite3 native module in sidecar pkg bundle
- [ ] **[P3]** Fix WMI disk I/O class (HRESULT 0x80041010)

## Key Paths
| What | Path |
|------|------|
| Canonical source | D:\Dev\aegis |
| Build output | D:\Tools\.cargo-target\release\aegis.exe |
| Installer | D:\Tools\.cargo-target\release\bundle\nsis\AEGIS_4.0.0_x64-setup.exe |
| Cockpit UI | D:\Dev\aegis\ui\index.html |
| Architecture | D:\Dev\aegis\ARCHITECTURE.md |
| Bug report | D:\Meta\BUG_REPORT_CLAUDE_PHANTOM_EDITS_2026-03-26.md |

## CRITICAL RULE
To edit files on David's machine: ONLY use Filesystem:write_file or Filesystem:edit_file.
str_replace, create_file, Desktop Commander:edit_block write to Claude's container, NOT disk.
