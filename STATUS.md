# AEGIS — STATUS
# READ ARCHITECTURE.md BEFORE TOUCHING THIS PROJECT.

**Status:** active
**Phase:** v4.0 — REFACTOR-01 complete, BUILD-01 in progress
**Last Sprint:** AEGIS-REFACTOR-01 (2026-03-30, dfce302)
**Last Updated:** 2026-03-30

## Architecture

AEGIS is a **Tauri 2 desktop application** with a **Node.js sidecar** and a **separate MCP server binary**.
See ARCHITECTURE.md for the definitive reference.
See MCP_SEPARATION_DECISION.md for the MCP separation decision.

## What's Built — VERIFIED WORKING

### Tauri App Shell (src-tauri/) — ALL REAL
- [x] TAURI-01 through TAURI-05: full Tauri 2 scaffold, metrics, tray, sidecar, installer
- [x] AMBIENT-01: ambient-first tray, profiles as override
- [x] TRAY-FIX + DEBUG-01 + EVENTS-01: all runtime bugs fixed
- [x] COCKPIT-REWRITE (2026-03-26): verified IPC, real data confirmed

### Intelligence Sidecar (sidecar/) — REFACTORED 2026-03-30
- [x] CATALOG-01: 210-process knowledge base
- [x] INTEL-01 through INTEL-06: full intelligence stack
- [x] LEARN-01: learning loop, sacred context weighting
- [x] MCP-02: now SEPARATE binary at mcp-server/ (see MCP_SEPARATION_DECISION.md)
- [x] PROCS-01: process management with implications
- [x] REFACTOR-01: MCP split, localhost:7474 query endpoint, dead v2 code removed
- [x] sidecar tsc: 0 errors ✓
- [x] sidecar pkg bundle: SUCCESS (58MB, 2026-03-30) ✓

### MCP Server (mcp-server/) — NEW 2026-03-30
- [x] Standalone ESM Node.js package
- [x] 7 MCP tools reading from localhost:7474
- [x] Decoupled from sidecar — separate stdin/stdout, separate binary
- [ ] npm install + tsc build (pending)
- [ ] claude_desktop_config.json update (pending)

### Cockpit UI (ui/index.html)
- [x] Tauri IPC wiring, handleMetrics(), tab switching, process list
- [x] VERIFIED: real data confirmed 2026-03-26

## Open Work
- [ ] **[P0]** cargo tauri build — IN PROGRESS (running now)
- [ ] **[P0]** Runtime verification after build
- [ ] **[P1]** AEGIS-UI-01: Cockpit redesign (utilitarian, sidebar layout)
- [ ] **[P1]** AEGIS-SNP-05: Instance count baseline + 3 new Sniper rules
- [ ] **[P1]** AEGIS-POL-01: Policy Enforcement Engine
- [ ] **[P1]** AEGIS-GPU-01: GPU metrics + VRAM monitor
- [ ] **[P2]** mcp-server: npm install + build + config wiring
- [ ] **[P2]** Python migration C:\→D:\ (separate session)
- [ ] **[P3]** DISM WinSxS cleanup on C:\

## CRITICAL RULE
To edit files on David's machine: ONLY use Filesystem:write_file or Filesystem:edit_file.
str_replace, create_file, Desktop Commander write to Claude's container, NOT disk.

## Key Paths
| What | Path |
|------|------|
| Canonical source | D:\Dev\aegis |
| Sidecar binary | D:\Dev\aegis\src-tauri\binaries\aegis-sidecar-x86_64-pc-windows-msvc.exe |
| Build output | D:\Tools\.cargo-target\release\aegis.exe |
| Installer | D:\Tools\.cargo-target\release\bundle\nsis\AEGIS_4.0.0_x64-setup.exe |
| MCP server | D:\Dev\aegis\mcp-server\ |
| Architecture | D:\Dev\aegis\ARCHITECTURE.md |
| MCP decision | D:\Dev\aegis\MCP_SEPARATION_DECISION.md |
| Competitive analysis | D:\Dev\aegis\COMPETITIVE_ANALYSIS.md |
| Improvements spec | D:\Dev\aegis\IMPROVEMENTS_SPEC.md |
| Mega-sprint | D:\Dev\aegis\sprints\AEGIS-MEGA-SPRINT.md |
