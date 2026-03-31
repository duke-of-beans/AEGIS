# AEGIS — BACKLOG
# READ ARCHITECTURE.md BEFORE TOUCHING THIS PROJECT.
Last Updated: 2026-03-30

## COMPLETED

- [x] ~~Fix tray.rs~~ — TRAY-FIX complete (2026-03-25).
- [x] ~~AEGIS-LEARN-01: Learning loop + cognitive load score~~ (shipped 2026-03-25)
- [x] ~~AEGIS-MCP-02: Rich MCP publisher~~ (shipped 2026-03-25)
- [x] ~~AEGIS-RUNTIME-01: Three runtime bugs from first Tauri build test~~ (shipped 2026-03-26)
- [x] ~~AEGIS-DEBUG-01: REAL fix for three runtime bugs~~ (shipped 2026-03-26)
- [x] ~~AEGIS-EVENTS-01: Fix WebView event delivery~~ (shipped 2026-03-26)
- [x] ~~AEGIS-COCKPIT-REWRITE: Full cockpit rewrite, verified IPC, real data confirmed~~ (2026-03-26)

## SPRINT QUEUE (ordered — each depends on previous unless noted)

- [ ] **AEGIS-REFACTOR-01** [P0] — Split sidecar and MCP server into two binaries.
  Depends on: nothing. Blocks BUILD-01.
  Decision doc: D:\Dev\aegis\MCP_SEPARATION_DECISION.md
  Sprint prompt: to be written (next session priority).
  Summary:
  - Remove @modelcontextprotocol/sdk + zod from sidecar/package.json
  - Delete sidecar/src/mcp/server.ts
  - Remove MCP mode from sidecar/src/main.ts
  - Add localhost:7474 local query endpoint to sidecar (engine state readable by MCP binary)
  - Create D:\Dev\aegis\mcp-server\ — new separate Node.js package
  - Move 8 MCP tools to mcp-server/src/server.ts (plain ESM, no bundling needed)
  - Update claude_desktop_config.json: AEGIS MCP → node mcp-server/dist/server.js
  - Update ARCHITECTURE.md: two-binary diagram
  - Verify: sidecar builds cleanly with no ESM errors

- [ ] **AEGIS-BUILD-01** [P0] — Compile clean binary + runtime verify.
  Depends on: REFACTOR-01.
  Sprint prompt: D:\Dev\aegis\sprints\AEGIS-BUILD-01.md

- [ ] **AEGIS-UI-01** [P1] — Cockpit redesign: utilitarian aesthetic + Task Manager sidebar.
  Depends on: BUILD-01.
  Sprint prompt: D:\Dev\aegis\sprints\AEGIS-UI-01.md

- [ ] **AEGIS-SNP-05** [P1] — Instance count baseline + 3 new Sniper rules.
  Depends on: UI-01 (sidecar-only, no UI changes needed but wait for UI to land first).
  Sprint prompt: D:\Dev\aegis\sprints\AEGIS-SNP-05.md

- [ ] **AEGIS-POL-01** [P1] — Policy Enforcement Engine (Defender + Claude GPU).
  Depends on: UI-01.
  Sprint prompt: D:\Dev\aegis\sprints\AEGIS-POL-01.md
  Amendment: D:\Dev\aegis\sprints\AEGIS-POL-01-AMENDMENT.md

- [ ] **AEGIS-GPU-01** [P1] — GPU metrics + VRAM monitor.
  Depends on: UI-01.
  Sprint prompt: to be written.

- [ ] **AEGIS-PROCS-01** [P1] — Per-process disk/net/GPU, command line, affinity, kill tree.
  Depends on: UI-01.

- [ ] **AEGIS-MEM-01** [P1] — RAM composition + page file + working set trim.
  Depends on: UI-01.

- [ ] **AEGIS-WATCHDOG-01** [P1] — Per-process keep-running watchdog.
  Depends on: PROCS-01.

- [ ] **AEGIS-RULES-01** [P1] — Persistent rules editor.
  Depends on: PROCS-01.

- [ ] **AEGIS-STA-01** [P2] — Startup Auditor.
  Depends on: UI-01.
  Sprint prompt: D:\Dev\aegis\sprints\AEGIS-STA-01.md

- [ ] **AEGIS-TREE-01** [P2] — Process tree as default view.
  Depends on: PROCS-01.

- [ ] **AEGIS-SCHED-01** [P2] — Hard CPU cap, foreground boost, gaming suspend.
  Depends on: RULES-01.

- [ ] **AEGIS-CPU-01** [P2] — Per-core graphs + thread count.
  Depends on: UI-01.

- [ ] **AEGIS-THERMAL-01** [P2] — CPU/GPU thermal monitoring + throttle detection.
  Depends on: GPU-01.

- [ ] **AEGIS-DISK-01** [P2] — Disk active time %, response time, growth rate.
  Depends on: UI-01.

- [ ] **AEGIS-NET-01** [P2] — IPv4/IPv6, WiFi signal, sync storm detection.
  Depends on: UI-01.

- [ ] **AEGIS-TRAY-01** [P2] — Live CPU gauge in tray icon.
  Depends on: BUILD-01.

- [ ] **AEGIS-LOG-01** [P2] — Unified process event log.
  Depends on: STA-01.

- [ ] **AEGIS-HW-01** [P2] — Hardware info tab (CPU cache, RAM speed, GPU driver).
  Depends on: UI-01.

- [ ] **AEGIS-SRV-01** [P3] — Service Health Monitor.
  Depends on: STA-01.

- [ ] **AEGIS-BOT-01** [P3] — Boot Sequencer.
  Depends on: STA-01.

- [ ] **AEGIS-CATALOG-02** [P3] — Prevent execution + instance count enforcement.
  Depends on: RULES-01.

- [ ] **AEGIS-MEM-02** [P3] — Slow memory leak trend detector.
  Depends on: MEM-01.

- [ ] **AEGIS-PORT-01** [P3] — Port occupancy monitor.
  Depends on: PROCS-01.

- [ ] **AEGIS-BUILD-02** [P1, after each Rust-touching sprint] — Rebuild binary.

## KNOWN ISSUES (from ARCHITECTURE.md)

- [ ] [P2] Fix better-sqlite3 native module in sidecar pkg bundle
- [ ] [P3] Fix WMI disk I/O class (HRESULT 0x80041010) — currently one-shot disabled

## INCIDENT LOG

2026-03-30 — VRAM exhaustion BSOD (VIDEO_MEMORY_MANAGEMENT_INTERNAL, 0x0000010e × 2)
  Root cause: Claude GPU acceleration enabled + 13 Claude + 10 WebView2 + 5 NVContainer > 4GB VRAM
  Manual fixes: Claude Local State GPU off, NVContainer manual-start, BrainSignalWatcher delayed
  Prevention: AEGIS-GPU-01 + AEGIS-POL-01 (json_file policy type)

2026-03-30 — Defender re-enabled by Windows Update
  Manual fix: 7 HKLM policy keys re-applied with elevation
  Prevention: AEGIS-POL-01

2026-03-30 — Litestream checksum retry loop on boot
  Manual fix: 30s startup delay via silent VBScript
  Prevention: AEGIS-SRV-01 + AEGIS-BOT-01

2026-03-30 — SoftLanding tasks running silently
  Manual fix: both tasks disabled
  Prevention: AEGIS-STA-01

## KEY DECISION LOG

2026-03-30 — MCP server separated into standalone binary (AEGIS-REFACTOR-01)
  Reason: sidecar and MCP server have incompatible stdin/stdout ownership.
  Both are correct architecturally — bundling them was the wrong model.
  Decision doc: D:\Dev\aegis\MCP_SEPARATION_DECISION.md

## REFERENCE DOCS

Mega-sprint orchestration: D:\Dev\aegis\sprints\AEGIS-MEGA-SPRINT.md
  (update: prepend REFACTOR-01 before BUILD-01 in Phase 0)
Competitive analysis: D:\Dev\aegis\COMPETITIVE_ANALYSIS.md
Improvements spec: D:\Dev\aegis\IMPROVEMENTS_SPEC.md
MCP separation decision: D:\Dev\aegis\MCP_SEPARATION_DECISION.md
