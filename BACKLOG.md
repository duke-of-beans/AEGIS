# AEGIS — BACKLOG
# READ ARCHITECTURE.md BEFORE TOUCHING THIS PROJECT.
Last Updated: 2026-03-30

## COMPLETED

- [x] ~~AEGIS-REFACTOR-01: MCP server separated into standalone binary~~ (2026-03-30, dfce302)
- [x] ~~AEGIS-UI-01: Cockpit redesign — utilitarian, sidebar layout~~ (2026-03-30, 6715ead)
- [x] ~~Fix tray.rs~~ (2026-03-25)
- [x] ~~AEGIS-LEARN-01~~ (2026-03-25)
- [x] ~~AEGIS-MCP-02~~ (2026-03-25)
- [x] ~~AEGIS-RUNTIME-01, DEBUG-01, EVENTS-01~~ (2026-03-26)
- [x] ~~AEGIS-COCKPIT-REWRITE~~ (2026-03-26)

## SPRINT QUEUE

- [ ] **AEGIS-BUILD-02** [P0] — Compile binary with UI-01 cockpit.
  Run in terminal with Claude Desktop CLOSED. `cd /d D:\Dev\aegis && cargo tauri build`
  cargo config: jobs=4 already set at ~/.cargo/config.toml — safe to run.
  Depends on: nothing (source is clean).

- [ ] **AEGIS-HW-PROFILE-01** [P1] — Hardware discovery + safe operating envelope.
  Parallel with: SNP-05, POL-01.
  Spec: D:\Dev\aegis\IMPROVEMENTS_SPEC.md — PRODUCT PHILOSOPHY section.
  Summary: one-time hardware discovery → safe envelope → PolicyEngine auto-policies.
  Includes: adaptive polling state machine (IDLE/WATCH/ACTION), 3-tier user control
  (Automatic/Balanced/Manual), ~/.cargo/config.toml auto-written with derived job count.
  This is what makes AEGIS a product, not just a tool.

- [ ] **AEGIS-SNP-05** [P1] — Instance count baseline + 3 new Sniper rules.
  Depends on: BUILD-02. Sidecar-only.
  Sprint prompt: D:\Dev\aegis\sprints\AEGIS-SNP-05.md

- [ ] **AEGIS-POL-01** [P1] — Policy Enforcement Engine (Defender + Claude GPU + hardware policies).
  Depends on: BUILD-02.
  Sprint prompt: D:\Dev\aegis\sprints\AEGIS-POL-01.md
  Amendment: D:\Dev\aegis\sprints\AEGIS-POL-01-AMENDMENT.md

- [ ] **AEGIS-GPU-01** [P1] — GPU metrics + VRAM monitor.
  Depends on: BUILD-02.

- [ ] **AEGIS-PROCS-01** [P1] — Per-process disk/net/GPU, command line, affinity, kill tree.
  Depends on: BUILD-02.

- [ ] **AEGIS-MEM-01** [P1] — RAM composition + page file + working set trim.
  Depends on: BUILD-02.

- [ ] **AEGIS-WATCHDOG-01** [P1] — Per-process keep-running watchdog (PostgreSQL, MCP servers).
  Depends on: PROCS-01.

- [ ] **AEGIS-RULES-01** [P1] — Persistent rules editor (survives restart, time-based, script action).
  Depends on: PROCS-01.

- [ ] **AEGIS-STA-01** [P2] — Startup Auditor (everything at boot, risk-rated, disable from cockpit).
  Depends on: BUILD-02.
  Sprint prompt: D:\Dev\aegis\sprints\AEGIS-STA-01.md

- [ ] **AEGIS-TREE-01** [P2] — Process tree as default view.
  Depends on: PROCS-01.

- [ ] **AEGIS-ADAPTIVE-01** [P2] — Adaptive polling state machine (IDLE/WATCH/ACTION).
  Depends on: HW-PROFILE-01. Refines the polling intervals set in HW-PROFILE-01.
  Expected: idle CPU <0.2%, idle RAM <60MB.

- [ ] **AEGIS-SCHED-01** [P2] — Hard CPU cap, foreground boost, gaming suspend.
  Depends on: RULES-01.

- [ ] **AEGIS-CPU-01** [P2] — Per-core graphs + thread count.
- [ ] **AEGIS-THERMAL-01** [P2] — CPU/GPU thermal monitoring + throttle detection.
- [ ] **AEGIS-DISK-01** [P2] — Disk active time %, response time, growth rate.
- [ ] **AEGIS-NET-01** [P2] — IPv4/IPv6, WiFi signal, sync storm detection.
- [ ] **AEGIS-TRAY-01** [P2] — Live CPU gauge in tray icon.
- [ ] **AEGIS-LOG-01** [P2] — Unified process event log.
- [ ] **AEGIS-HW-01** [P2] — Hardware info tab (CPU cache, RAM speed, GPU driver).

- [ ] **AEGIS-SRV-01** [P3] — Service Health Monitor (error loop detection).
- [ ] **AEGIS-BOT-01** [P3] — Boot Sequencer (AEGIS owns startup order, hidden windows).
- [ ] **AEGIS-CATALOG-02** [P3] — Prevent execution + instance count enforcement.
- [ ] **AEGIS-MEM-02** [P3] — Slow memory leak trend detector.
- [ ] **AEGIS-PORT-01** [P3] — Port occupancy monitor.

## KNOWN ISSUES
- [ ] [P2] Fix better-sqlite3 native module in sidecar pkg bundle
- [ ] [P3] Fix WMI disk I/O class (HRESULT 0x80041010)
- [ ] [P2] Two litestream instances on boot — VBScript + BrainSignalWatcher both launching it

## INCIDENT LOG
2026-03-30 — 4× VIDEO_MEMORY_MANAGEMENT_INTERNAL BSODs
  Causes: (1) Jan 2026 GRD unstable on GTX 1060 under mixed workloads
           (2) cargo tauri build spawning 12 rustc jobs × 600MB = OOM
  Fixes: Studio Driver 581.57, HAGS disabled, TDR=10, cargo jobs=4 cap
  Note: face_recognition pipeline is CPU-only — NOT a GPU contributor

2026-03-30 — Defender re-enabled, C:\ full, SoftLanding silent tasks
  All addressed. See IMPROVEMENTS_SPEC for prevention sprints.

## KEY DECISIONS
2026-03-30 — MCP server separated into standalone binary
  Doc: D:\Dev\aegis\MCP_SEPARATION_DECISION.md
2026-03-30 — Hardware-aware adaptive polling + 3-tier control model
  Doc: D:\Dev\aegis\IMPROVEMENTS_SPEC.md — PRODUCT PHILOSOPHY section

## REFERENCE DOCS
Mega-sprint orchestration: D:\Dev\aegis\sprints\AEGIS-MEGA-SPRINT.md
Competitive analysis: D:\Dev\aegis\COMPETITIVE_ANALYSIS.md
Improvements spec: D:\Dev\aegis\IMPROVEMENTS_SPEC.md
MCP separation: D:\Dev\aegis\MCP_SEPARATION_DECISION.md
