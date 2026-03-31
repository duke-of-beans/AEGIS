# AEGIS — COMPETITIVE FEATURE ANALYSIS
# vs Windows Task Manager + Process Lasso
# Authored: 2026-03-30
# Purpose: Identify every gap. Close every gap or make a deliberate decision to skip.
# ══════════════════════════════════════════════════════════════════════

## LEGEND
# ✅ AEGIS has this — shipped and working
# 🔶 AEGIS has partial — exists but incomplete or broken
# ❌ AEGIS missing — not built, not specced
# 🏆 AEGIS unique — neither TM nor Lasso has this
# ⏭ Deliberate skip — not relevant to AEGIS's use case (document the reason)

---

## SECTION 1: WINDOWS TASK MANAGER

### 1A. Performance Tab — System Metrics

| Feature | TM | AEGIS | Status | Sprint |
|---|---|---|---|---|
| CPU utilization % | ✓ | ✓ | ✅ | shipped |
| CPU speed (GHz current) | ✓ | ✓ | ✅ | shipped |
| CPU core count + logical processors | ✓ | ✓ | ✅ | shipped |
| Per-core utilization graph | ✓ | ❌ | ❌ | NEW: AEGIS-CPU-01 |
| CPU handle count (system total) | ✓ | ✓ | ✅ | shipped |
| CPU thread count (system total) | ✓ | ❌ | ❌ | NEW: AEGIS-CPU-01 |
| CPU uptime | ✓ | ✓ | ✅ | shipped |
| CPU cache sizes (L1/L2/L3) | ✓ | ❌ | ❌ | NEW: AEGIS-HW-01 |
| CPU socket count | ✓ | ❌ | ⏭ | cosmetic — skip |
| Virtualization status | ✓ | ❌ | ⏭ | cosmetic — skip |
| RAM: total / in use / available | ✓ | ✓ | ✅ | shipped |
| RAM: committed (total commit charge) | ✓ | ❌ | ❌ | NEW: AEGIS-MEM-01 |
| RAM: cached | ✓ | ❌ | ❌ | NEW: AEGIS-MEM-01 |
| RAM: paged pool / non-paged pool | ✓ | ❌ | ❌ | NEW: AEGIS-MEM-01 |
| RAM composition bar (in use/modified/standby/free) | ✓ | ❌ | ❌ | NEW: AEGIS-MEM-01 |
| RAM hardware info (speed, slots, form factor) | ✓ | ❌ | ❌ | NEW: AEGIS-HW-01 |
| Disk: read/write speed (MB/s) | ✓ | 🔶 | 🔶 | WMI error — fix in AEGIS-DISK-01 |
| Disk: active time % | ✓ | ❌ | ❌ | NEW: AEGIS-DISK-01 |
| Disk: average response time (ms) | ✓ | ❌ | ❌ | NEW: AEGIS-DISK-01 |
| Disk: capacity / formatted size | ✓ | 🔶 | 🔶 | basic only — expand in AEGIS-DISK-01 |
| Disk: page file usage | ✓ | ❌ | ❌ | NEW: AEGIS-MEM-01 |
| Network: send/receive throughput | ✓ | ✓ | ✅ | shipped |
| Network: adapter name | ✓ | ✓ | ✅ | shipped |
| Network: IPv4/IPv6 addresses | ✓ | ❌ | ❌ | NEW: AEGIS-NET-01 |
| Network: connection type (Ethernet/WiFi) | ✓ | ❌ | ❌ | NEW: AEGIS-NET-01 |
| Network: WiFi signal strength | ✓ | ❌ | ❌ | NEW: AEGIS-NET-01 |
| GPU: utilization % | ✓ | ❌ | ❌ | AEGIS-GPU-01 (queued) |
| GPU: VRAM used / total | ✓ | ❌ | ❌ | AEGIS-GPU-01 (queued) |
| GPU: dedicated vs shared VRAM | ✓ | ❌ | ❌ | AEGIS-GPU-01 (queued) |
| GPU: engine breakdown (3D/Compute/Video/Copy) | ✓ | ❌ | ❌ | AEGIS-GPU-01 extension |
| GPU: temperature | ✓ | ❌ | ❌ | AEGIS-GPU-01 (queued) |
| GPU: DirectX version / driver version | ✓ | ❌ | ❌ | NEW: AEGIS-HW-01 |
| CPU temperature + throttle detection | ❌ | ❌ | ❌ | AEGIS-THERMAL-01 (queued) |

### 1B. Processes Tab

| Feature | TM | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Process name | ✓ | ✓ | ✅ | shipped |
| PID | ✓ | ✓ | ✅ | shipped |
| Status (running/suspended) | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| CPU % | ✓ | ✓ | ✅ | shipped |
| Memory (working set MB) | ✓ | ✓ | ✅ | shipped |
| Disk MB/s per process | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| Network Mbps per process | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| GPU % per process | ✓ | ❌ | ❌ | AEGIS-GPU-01 |
| GPU memory per process | ✓ | ❌ | ❌ | AEGIS-GPU-01 |
| Proportional bars on metrics | ✓ | ❌ | ❌ | AEGIS-UI-01 (queued) |
| Grouped: Apps / Background / Windows | ✓ | ❌ | ⏭ | catalog tiers replace this — deliberate |
| Kill process | ✓ | ✓ | ✅ | shipped |
| Kill process tree | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| Open file location | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| Search online for process | ✓ | 🏆 | 🏆 | catalog + MCP AI identification is superior |
| Properties | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |

### 1C. Details Tab (extended per-process)

| Feature | TM | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Architecture (32/64-bit) | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| Command line | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| Image path | ✓ | ✓ | ✅ | catalog |
| User name (process owner) | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| CPU time (cumulative) | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| Handles | ✓ | ✓ | ✅ | baseline tracks handle_count |
| Threads | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| Page faults | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| I/O read/write bytes (cumulative) | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| I/O read/write operations count | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| GDI objects | ✓ | ❌ | ⏭ | edge case — skip unless requested |
| User objects | ✓ | ❌ | ⏭ | edge case — skip unless requested |
| DEP status | ✓ | ❌ | ⏭ | security info, low value — skip |
| Process description | ✓ | ✓ | ✅ | catalog description field |
| Base priority | ✓ | ✓ | 🔶 | set via throttle, not displayed — add to UI |
| Virtualization status | ✓ | ❌ | ⏭ | skip |

### 1D. Services Tab

| Feature | TM | AEGIS | Status | Sprint |
|---|---|---|---|---|
| List all Windows services | ✓ | ❌ | ❌ | AEGIS-STA-01 covers startup services |
| Service PID | ✓ | ❌ | ❌ | AEGIS-STA-01 |
| Service status (running/stopped) | ✓ | ❌ | ❌ | AEGIS-STA-01 |
| Start/stop service from UI | ✓ | ❌ | ❌ | AEGIS-STA-01 (enable/disable) |
| Service group | ✓ | ❌ | ⏭ | low value — skip |

### 1E. Startup Tab

| Feature | TM | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Enumerate startup items | ✓ | ❌ | ❌ | AEGIS-STA-01 (queued) |
| Publisher / path | ✓ | ❌ | ❌ | AEGIS-STA-01 (queued) |
| Enable/disable startup item | ✓ | ❌ | ❌ | AEGIS-STA-01 (queued) |
| Startup impact rating | ✓ | ❌ | ❌ | AEGIS-STA-01 — AEGIS uses risk tier instead |
| Scheduled task enumeration | ❌ | ❌ | ❌ | AEGIS-STA-01 — AEGIS goes further than TM |

### 1F. App History Tab

| Feature | TM | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Per-app cumulative CPU time | ✓ | 🏆 | 🏆 | baseline DB is superior (per-context history) |
| Per-app cumulative network usage | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 (per-process net stats) |
| Tile update bandwidth | ✓ | ❌ | ⏭ | Windows Store only — skip |

### 1G. Users Tab

| Feature | TM | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Per-user resource usage | ✓ | ❌ | ⏭ | single-user machine — skip |
| Disconnect/sign out user | ✓ | ❌ | ⏭ | skip |

---

## SECTION 2: PROCESS LASSO

### 2A. ProBalance (Lasso's signature feature)

| Feature | Lasso | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Auto-lower priority of CPU-hogging background processes | ✓ | 🏆 | 🏆 | Sniper + Baseline is superior — context-aware, personal baseline, not fixed threshold |
| Foreground process boosting | ✓ | ❌ | ❌ | NEW: AEGIS-SCHED-01 — boost foreground process priority when context switches |
| ProBalance activity log | ✓ | ✓ | ✅ | action log shipped |
| Responsiveness mode (more aggressive ProBalance) | ✓ | 🏆 | 🏆 | context engine replaces this — deep_work context = more aggressive sniper |
| Bitsum Highest Performance power plan | ✓ | ❌ | ❌ | NEW: AEGIS-POL-01 extension — power plan policy |

### 2B. Per-Process Actions

| Feature | Lasso | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Set CPU priority | ✓ | ✓ | ✅ | throttle = Below Normal shipped |
| Set I/O priority | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 — distinct from CPU priority |
| Set memory priority | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| Set CPU affinity (pin to cores) | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| Hard CPU usage % cap | ✓ | ❌ | ❌ | NEW: AEGIS-SCHED-01 — job object CPU rate control |
| Suspend process | ✓ | ✓ | ✅ | shipped |
| Resume process | ✓ | ✓ | ✅ | shipped |
| Kill process | ✓ | ✓ | ✅ | shipped |
| Kill process tree | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| Restart process | ✓ | ❌ | ❌ | NEW: AEGIS-WATCHDOG-01 |
| Working set trim (force release standby RAM) | ✓ | ❌ | ❌ | NEW: AEGIS-MEM-01 |
| Prevent execution (blacklist process) | ✓ | ❌ | ❌ | NEW: AEGIS-CATALOG-02 — catalog action_permission: none |

### 2C. Persistent Rules (Lasso's second signature feature)

| Feature | Lasso | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Rules survive restart, apply immediately on process launch | ✓ | ❌ | ❌ | NEW: AEGIS-RULES-01 — critical gap |
| Per-process persistent CPU priority | ✓ | ❌ | ❌ | AEGIS-RULES-01 |
| Per-process persistent I/O priority | ✓ | ❌ | ❌ | AEGIS-RULES-01 |
| Per-process persistent CPU affinity | ✓ | ❌ | ❌ | AEGIS-RULES-01 |
| Per-process persistent memory priority | ✓ | ❌ | ❌ | AEGIS-RULES-01 |
| Keep process running (restart on crash/kill) | ✓ | ❌ | ❌ | AEGIS-WATCHDOG-01 (PostgreSQL, MCP servers) |
| Instance count limiter | ✓ | 🔶 | 🔶 | SNP-05 notifies — does not enforce limit |
| Time-based rules (scheduled) | ✓ | ❌ | ❌ | NEW: AEGIS-RULES-01 |
| Rule: run script on trigger | ✓ | ❌ | ❌ | NEW: AEGIS-RULES-01 — powerful, enables automation |
| User-created rules via UI | ✓ | ❌ | ❌ | AEGIS-RULES-01 (cockpit rule editor) |

### 2D. Gaming Mode

| Feature | Lasso | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Detect game launch (by process name) | ✓ | 🏆 | 🏆 | context engine detects 'gaming' context already |
| Suspend selected background processes during game | ✓ | ❌ | ❌ | NEW: AEGIS-SCHED-01 — gaming context triggers suspend rules |
| Boost game process priority | ✓ | ❌ | ❌ | NEW: AEGIS-SCHED-01 |
| Per-game configuration | ✓ | 🏆 | 🏆 | context + catalog policies exceed this |

### 2E. Power Plan Management

| Feature | Lasso | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Switch power plan by activity | ✓ | ❌ | ❌ | NEW: AEGIS-POL-01 extension |
| Per-process power plan override | ✓ | ❌ | ❌ | NEW: AEGIS-POL-01 extension |
| High Performance on demand | ✓ | ❌ | ❌ | AEGIS-POL-01 — enforce High Performance as policy |

### 2F. Process Watchdog (Lasso's rule engine)

| Feature | Lasso | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Trigger on CPU % threshold (absolute) | ✓ | 🏆 | 🏆 | AEGIS uses personal baseline zscore — superior |
| Trigger on memory threshold (absolute) | ✓ | 🏆 | 🏆 | same — zscore is better than absolute |
| Trigger on handle count threshold | ✓ | ✓ | ✅ | baseline tracks handle_count deviation |
| Trigger on sustained duration | ✓ | ✓ | ✅ | duration_sec in SniperRule |
| Actions: log / notify / lower priority / kill | ✓ | ✓ | ✅ | graduated actions shipped |
| Action: restart process | ✓ | ❌ | ❌ | AEGIS-WATCHDOG-01 |
| Action: run script | ✓ | ❌ | ❌ | AEGIS-RULES-01 |
| Context-aware rule exemptions | ❌ | 🏆 | 🏆 | AEGIS unique — context_exemptions in SniperRule |

### 2G. Process Tree View

| Feature | Lasso | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Parent-child spawn tree | ✓ | ❌ | ❌ | VISION.md calls this out explicitly — NEW: AEGIS-TREE-01 |
| Tree as default process view | ✓ | ❌ | ❌ | AEGIS-TREE-01 |
| Flat list as secondary view | ✓ | ✓ | ✅ | current default |

### 2H. Monitoring and Graphs

| Feature | Lasso | AEGIS | Status | Sprint |
|---|---|---|---|---|
| CPU history graph (all cores) | ✓ | ✓ | ✅ | shipped |
| Per-process CPU history graph | ✓ | ❌ | ❌ | NEW: AEGIS-PROCS-01 |
| RAM history graph | ✓ | ✓ | ✅ | shipped |
| GPU monitoring (newer versions) | ✓ | ❌ | ❌ | AEGIS-GPU-01 (queued) |
| Tray icon with live CPU gauge | ✓ | ❌ | ❌ | NEW: AEGIS-TRAY-01 — current tray is static icon |
| Process event log (starts/stops/crashes) | ✓ | ❌ | ❌ | NEW: AEGIS-LOG-01 |
| Action log (what AEGIS did) | ❌ | ✓ | 🏆 | AEGIS only |

### 2I. Search and Filter

| Feature | Lasso | AEGIS | Status | Sprint |
|---|---|---|---|---|
| Filter process list by name | ✓ | 🔶 | 🔶 | UI-01 specifies filter input — not yet built |
| Highlight process on search | ✓ | ❌ | ❌ | AEGIS-UI-01 |

---

## SECTION 3: AEGIS UNIQUE — NEITHER TOOL HAS THESE

| Feature | Why it matters |
|---|---|
| Behavioral baselines (personal zscore) | Deviation from YOUR normal, not absolute thresholds |
| Context detection (foreground window tracking) | Knows if you're coding, gaming, in a meeting |
| Learning loop (feedback → confidence → auto mode) | Earns the right to act — no other tool does this |
| Process Catalog (trust tiers, blast radius, action permissions) | Surgical safety — never acts on what it doesn't understand |
| MCP server (machine state queryable by AI) | GREGORE/GregLite/Claude can query machine health |
| Policy Enforcement Engine | Defender stays dead, Claude GPU stays off — permanently |
| Startup Auditor with risk rating | Beats Autoruns by integrating catalog trust tiers |
| Service Health Monitor (error loop detection) | Catches litestream-style retry storms — neither tool does this |
| VRAM pressure monitor with per-process attribution | GPU-01 — actionable, not just informational |
| Thermal throttle detection with action | THERMAL-01 — neither tool acts on thermals |
| Incident memory (IMPROVEMENTS_SPEC) | Every failure mode is codified into prevention |

---

## SECTION 4: NEW SPRINTS IDENTIFIED FROM THIS ANALYSIS

Sprints not previously in the queue:

| Sprint ID | What | Inspired by |
|---|---|---|
| AEGIS-CPU-01 | Per-core utilization graphs + thread count | Task Manager parity |
| AEGIS-MEM-01 | RAM composition (modified/standby/free/commit/pools) + page file + working set trim | Task Manager parity + Process Lasso working set trim |
| AEGIS-HW-01 | Hardware info tab: CPU cache, RAM speed/slots/form factor, GPU driver/DirectX | Task Manager parity — read-only, one-time on boot |
| AEGIS-PROCS-01 | Per-process: disk MB/s, network Mbps, GPU%, per-process CPU graph, command line, user, I/O priority, affinity, threads, kill tree, open file location | Task Manager Details tab + Lasso per-process actions |
| AEGIS-RULES-01 | Persistent rules editor in cockpit — rules survive restart, apply on process launch, time-based scheduling, run-script action | Process Lasso persistent rules — critical gap |
| AEGIS-WATCHDOG-01 | Per-process keep-running watchdog — restart PostgreSQL, MCP servers on crash | Lasso keep-running + today's PostgreSQL crash |
| AEGIS-SCHED-01 | Hard CPU % cap (job object), foreground boosting, gaming context suspends background procs | Lasso gaming mode + CPU cap |
| AEGIS-TREE-01 | Process tree as default view (parent-child spawn relationships) | VISION.md explicitly calls this out + Lasso + Process Hacker |
| AEGIS-TRAY-01 | Live CPU gauge in tray icon (visual at-a-glance without opening cockpit) | Lasso tray gauge |
| AEGIS-LOG-01 | Process event log — all starts, stops, crashes, rule fires in a searchable timeline | Lasso log + today's PostgreSQL silent crash |
| AEGIS-NET-01 | Per-adapter: IPv4/IPv6, connection type, WiFi signal + sync storm detection | Task Manager network details |
| AEGIS-CATALOG-02 | Prevent execution action in catalog (blacklist) + instance count enforcement (not just notify) | Lasso prevent execution + SNP-05 instance count gap |

---

## SECTION 5: DELIBERATE SKIPS (and why)

| Feature | Tool | Reason to skip |
|---|---|---|
| Virtualization status | TM | Cosmetic system info — not actionable |
| CPU socket count | TM | Cosmetic — not actionable |
| DEP status per process | TM | Security info but not in AEGIS threat model |
| GDI/User objects | TM | Edge case debugging — not daily value |
| Per-user resource isolation | TM | Single-user machine |
| Windows Store tile update bandwidth | TM | Store apps irrelevant |
| Service group | TM | Low value column |
| Process grouping (Apps/Background/Windows) | TM | Catalog trust tiers are a superior replacement |

---

## UPDATED SPRINT QUEUE (full ordered list)

| Priority | Sprint | Depends on |
|---|---|---|
| P0 | AEGIS-BUILD-01 | nothing |
| P1 | AEGIS-UI-01 | BUILD-01 |
| P1 | AEGIS-SNP-05 | UI-01 |
| P1 | AEGIS-POL-01 | UI-01 |
| P1 | AEGIS-GPU-01 | UI-01 |
| P1 | AEGIS-PROCS-01 | UI-01 — adds disk/net/GPU per-process, command line, affinity, I/O priority, kill tree |
| P1 | AEGIS-MEM-01 | UI-01 — RAM composition + page file + working set trim |
| P1 | AEGIS-WATCHDOG-01 | PROCS-01 — keep-running per process (PostgreSQL, MCP servers) |
| P1 | AEGIS-RULES-01 | PROCS-01 — persistent rules editor, time-based, script action |
| P2 | AEGIS-STA-01 | UI-01 |
| P2 | AEGIS-TREE-01 | PROCS-01 — process tree as default view |
| P2 | AEGIS-SCHED-01 | RULES-01 — hard CPU cap, foreground boost, gaming suspend |
| P2 | AEGIS-CPU-01 | UI-01 — per-core graphs + thread count |
| P2 | AEGIS-THERMAL-01 | GPU-01 |
| P2 | AEGIS-DISK-01 | UI-01 — active time %, response time, growth rate |
| P2 | AEGIS-NET-01 | UI-01 — IPv4/IPv6, WiFi signal, sync storm |
| P2 | AEGIS-TRAY-01 | BUILD-01 — live CPU gauge in tray icon |
| P2 | AEGIS-LOG-01 | STA-01 — unified process event log |
| P2 | AEGIS-HW-01 | UI-01 — hardware info tab (read-only) |
| P3 | AEGIS-SRV-01 | STA-01 |
| P3 | AEGIS-BOT-01 | STA-01 |
| P3 | AEGIS-CATALOG-02 | RULES-01 — prevent execution + instance count enforcement |
| P3 | AEGIS-MEM-02 | MEM-01 — slow memory leak trend detector |
| P3 | AEGIS-PORT-01 | PROCS-01 — port occupancy monitor |
| Px | AEGIS-BUILD-02 | after any Rust-touching sprint |

Last updated: 2026-03-30
