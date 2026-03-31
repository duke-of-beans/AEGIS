AEGIS MEGA-SPRINT — Full Feature Parity + Intelligence Completion
25 sprints across 5 phases. Parallel where possible, sequential otherwise.
This is a Cowork orchestration document — each phase section maps to simultaneous sessions.

Read these files FIRST before doing anything in any phase:
  Filesystem:read_file D:\Dev\aegis\ARCHITECTURE.md
  Filesystem:read_file D:\Dev\aegis\STATUS.md
  Filesystem:read_file D:\Dev\aegis\VISION.md
  Filesystem:read_file D:\Dev\aegis\IMPROVEMENTS_SPEC.md
  Filesystem:read_file D:\Dev\aegis\COMPETITIVE_ANALYSIS.md
  Filesystem:read_file D:\Dev\aegis\BACKLOG.md
  Filesystem:read_file D:\Dev\aegis\sidecar\src\main.ts
  Filesystem:read_file D:\Dev\aegis\sidecar\src\sniper\engine.ts
  Filesystem:read_file D:\Dev\aegis\sidecar\src\sniper\baseline.ts
  Filesystem:read_file D:\Dev\aegis\sidecar\src\catalog\manager.ts
  Filesystem:read_file D:\Dev\aegis\sidecar\src\context\engine.ts
  Filesystem:read_file D:\Dev\aegis\src-tauri\src\commands.rs
  Filesystem:read_file D:\Dev\aegis\src-tauri\src\main.rs
  Filesystem:read_file D:\Dev\aegis\src-tauri\src\metrics.rs
  Filesystem:read_file D:\Dev\aegis\ui\index.html

Summary: After all phases complete, AEGIS is feature-complete vs Task Manager and
Process Lasso on every non-skipped capability, while retaining its unique intelligence
advantages that neither tool has. The cockpit has been redesigned utilitarian-first,
all five intelligences are augmented, GPU/thermal/disk/network monitoring is live,
persistent rules are implemented, process detail depth matches Task Manager's Details
tab, and every gap identified in the 2026-03-30 incident has been closed by automated
enforcement rather than manual fix.

═══════════════════════════════════════════════════════════════════
PHASE 0 — SERIAL (1 session) — prerequisite for everything
Run: FIRST. Nothing else starts until this passes.
═══════════════════════════════════════════════════════════════════

SPRINT: AEGIS-BUILD-01
Session model: haiku
Full prompt: D:\Dev\aegis\sprints\AEGIS-BUILD-01.md

Summary: Build sidecar, cargo tauri build, runtime verify.
Gate: aegis.exe exists + tray appears + cockpit shows real data.
Nothing in Phase 1 starts until this gate passes.

═══════════════════════════════════════════════════════════════════
PHASE 1 — SERIAL (1 session) — design system prerequisite
Run: After BUILD-01 gate passes.
═══════════════════════════════════════════════════════════════════

SPRINT: AEGIS-UI-01
Session model: opus (design system decisions require judgment)
Full prompt: D:\Dev\aegis\sprints\AEGIS-UI-01.md

Summary: Full cockpit redesign. Utilitarian aesthetic. Task Manager sidebar layout.
Establishes SIDEBAR_SECTIONS extension array. All Phase 2+ UI work builds into this.
Gate: sidebar renders from SIDEBAR_SECTIONS array. No glow. Proportional bars.
Nothing in Phase 2 starts until this gate passes and ui/index.html is committed.

═══════════════════════════════════════════════════════════════════
PHASE 2 — 8 PARALLEL TRACKS (8 simultaneous sessions)
Run: All 8 after UI-01 commits. Independent of each other.
Each track commits its own branch or directly to main — coordinate with David.
═══════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────────────────
TRACK A — Intelligence: Sniper + Policy
Session model: sonnet
Runs: AEGIS-SNP-05 then AEGIS-POL-01 (serial within this track)
Independent of all other Phase 2 tracks.
────────────────────────────────────────────────────────────────

SPRINT A1: AEGIS-SNP-05
Full prompt: D:\Dev\aegis\sprints\AEGIS-SNP-05.md
Sidecar-only. No Rust changes. No ui/index.html changes.

Additional tasks not in existing prompt:
- Add instance_count to ProcessSample, ProcessBaseline, DeviationReport in baseline.ts
- Welford online update for instance_count in updateBaseline()
- DB migration: ALTER TABLE to add instance_mean, instance_stddev, instance_m2 columns
- engine.ts ingest(): pre-aggregate instance counts into Map<string, number>
- engine.ts findRule(): support pipe-separated OR patterns in target_pattern
- Add DEFAULT_RULES: msmpeng-spike, searchhost-inflation, electron-process-sprawl
- seed.json: add msmpeng, searchhost, searchindexer, litestream entries if missing
Gate: npx tsc --noEmit in sidecar/ passes 0 errors.

SPRINT A2: AEGIS-POL-01 (after A1 commits)
Full prompt: D:\Dev\aegis\sprints\AEGIS-POL-01.md
Amendment: D:\Dev\aegis\sprints\AEGIS-POL-01-AMENDMENT.md

PolicyEngine handles TWO types: registry (DWORD/STRING) and json_file.
json_file type reads JSON at file_path, navigates dot-notation key, checks value,
re-writes with no-BOM UTF-8 preserving all other keys.
Default policies: 5 registry (Defender) + 1 json_file (Claude GPU acceleration off).
Power plan policy: enforce High Performance (HKLM registry, powercfg.exe fallback).
Add to DEFAULT_POLICY.yaml:
  - id: power-plan-high-performance
    description: "Power plan set to High Performance"
    type: powercfg
    scheme_guid: "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"
    auto_enforce: true
    requires_elevation: false
PolicyEngine for type: powercfg runs:
  powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c
Cockpit Policy tab via SIDEBAR_SECTIONS push: { id: 'policy', label: 'Policy', icon: '🛡' }
Gate: npx tsc --noEmit passes. cargo check passes. Policy tab visible in cockpit.

────────────────────────────────────────────────────────────────
TRACK B — GPU + Thermal
Session model: sonnet
Runs: AEGIS-GPU-01 (Phase 2), AEGIS-THERMAL-01 (Phase 3 — depends on GPU-01)
Only GPU-01 runs in Phase 2.
────────────────────────────────────────────────────────────────

SPRINT B1: AEGIS-GPU-01
New module: sidecar/src/gpu/monitor.ts

GpuMetrics interface:
  utilization_pct: number
  vram_used_mb: number
  vram_total_mb: number
  vram_pct: number
  temp_c: number | null
  power_w: number | null
  per_process: Array<{ pid: number; name: string; vram_mb: number }>
  source: 'nvidia-smi' | 'wmi-fallback'

GpuMonitor class:
- Poll every 10s via nvidia-smi one-shot:
    nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw
      --format=csv,noheader,nounits
  Parse CSV. Store as GpuMetrics.
- Per-process VRAM (best-effort):
    nvidia-smi --query-compute-apps=pid,used_memory --format=csv,noheader,nounits
  Cross-reference against process name map. Top 5 consumers stored.
- WMI fallback if nvidia-smi not found: Win32_VideoController for name/driver/total only.
  vram_used_mb = null in fallback. source = 'wmi-fallback'.
- VRAM thresholds → SniperEvents:
    > 75%: cockpit amber status only (no event)
    > 90%: emit SniperEvent type='flagged', reason='vram_pressure',
           action='notify'. List top VRAM processes in reason string.
    > 95%: emit SniperEvent type='flagged', reason='vram_critical'.
           Tray notification: "VRAM critical — Claude GPU acceleration may need disabling"
- getLatestMetrics(): GpuMetrics | null
- Wire into sidecar/src/main.ts: instantiate after catalog, start polling,
  expose via IPC 'get_gpu_metrics' message

Rust commands.rs: add get_gpu_metrics() command following existing pattern.
main.rs: register in invoke_handler.

Cockpit GPU item in SIDEBAR_SECTIONS (push to 'performance' section):
  { id: 'gpu', label: 'GPU', icon: '🎮' }
GPU detail pane:
  - Large utilization % + VRAM used / total (monospace)
  - VRAM % bar (horizontal, proportional)
  - VRAM % sparkline (last 60 points)
  - Bar color: green < 75%, amber 75-90%, red > 90%
  - Temperature + power draw in secondary row
  - Per-process VRAM table: rank / process name / VRAM MB
  - "GPU acceleration data unavailable" message if wmi-fallback mode

Gate: npx tsc --noEmit passes. cargo check passes. GPU item in cockpit sidebar.
      VRAM % shown with correct color threshold.

────────────────────────────────────────────────────────────────
TRACK C — Process Detail (largest track)
Session model: sonnet
Runs: AEGIS-PROCS-01 (Phase 2)
Spawns Phase 3 sprints: WATCHDOG-01, RULES-01, TREE-01, PORT-01
────────────────────────────────────────────────────────────────

SPRINT C1: AEGIS-PROCS-01
Extends existing process metrics in metrics.rs and the cockpit.
Goal: match Task Manager Details tab depth.

Rust metrics.rs additions (extend SystemProcess struct):
  disk_read_bytes_sec: u64
  disk_write_bytes_sec: u64
  net_recv_bytes_sec: u64
  net_send_bytes_sec: u64
  gpu_memory_mb: u64        (from GPU monitor — 0 if not available)
  gpu_util_pct: f32          (0.0 if not available)
  thread_count: u32
  handle_count: u32          (already tracked in baseline — confirm in Rust)
  cpu_time_secs: u64
  page_faults: u64
  user_name: String
  architecture: String       ("x64" | "x86" | "Unknown")
  command_line: String
  image_path: String
  base_priority: i32
  io_priority: i32           (0=Very Low, 1=Low, 2=Normal, 3=High)
  status: String             ("running" | "suspended" | "unknown")

Sysinfo provides: cpu_usage, memory, disk_usage, virtual_memory, status.
For per-process network: use WMI Win32_PerfFormattedData_Tcpip_TCPv4 (best-effort).
For thread_count: sysinfo Process::tasks().
For command_line: Win32_Process CommandLine via WMI (one-shot on process start).
For user_name: OpenProcessToken + GetTokenInformation (Rust winapi).
For architecture: IsWow64Process — false = x64, true = x86.

New Tauri commands (commands.rs):
  get_process_detail(pid: u32) → JSON ProcessDetail (all fields above)
  set_io_priority(pid: u32, priority: i32) → Result
  set_cpu_affinity(pid: u32, mask: u64) → Result  (mask = bitmask of allowed cores)
  set_hard_cpu_limit(pid: u32, pct: u32) → Result (Windows Job Object CPU rate control)
  kill_process_tree(pid: u32) → Result  (kills process + all children recursively)
  open_file_location(path: String) → Result  (shell execute explorer /select)
  restart_process(pid: u32) → Result  (record command_line, kill, relaunch)

Cockpit Processes pane updates (ui/index.html):
  Add columns: Disk MB/s | Network Mbps | GPU% | Threads | Status
  All columns: proportional bar behind number (same as CPU/Memory)
  Click row → expand inline: shows command_line, image_path, user_name, architecture,
    I/O priority selector (dropdown: Very Low/Low/Normal/High),
    CPU affinity grid (checkbox per core),
    [Kill Tree] button, [Open File Location] button,
    Per-process CPU sparkline (last 60 points, 200px wide)
  Filter input: already specced in UI-01 — confirm it's implemented
  Column header click: re-sort by that column

Gate: npx tsc --noEmit passes. cargo check passes.
      Process rows show Disk/Network columns. Row expansion shows command line.
      Kill Tree and Open File Location functional.

────────────────────────────────────────────────────────────────
TRACK D — Memory Deep Dive
Session model: sonnet
Runs: AEGIS-MEM-01 (Phase 2), AEGIS-MEM-02 (Phase 4 — depends on MEM-01)
────────────────────────────────────────────────────────────────

SPRINT D1: AEGIS-MEM-01
New memory metrics in metrics.rs:
  Extend SystemMetrics to include MemoryDetail:
    committed_mb: u64       (total commit charge)
    commit_limit_mb: u64    (commit limit)
    cached_mb: u64          (system file cache)
    paged_pool_mb: u64      (paged kernel pool)
    nonpaged_pool_mb: u64   (non-paged kernel pool)
    page_file_used_mb: u64
    page_file_total_mb: u64
    modified_mb: u64        (modified working sets)
    standby_mb: u64         (standby list)
    free_mb: u64            (free / zeroed)

  Source: GlobalMemoryStatusEx + GetPerformanceInfo (Rust kernel32 calls).

Working set trim command (commands.rs):
  trim_working_set(pid: u32) → Result
  Calls SetProcessWorkingSetSize(handle, usize::MAX, usize::MAX) — forces Windows
  to reclaim standby memory from the target process.
  trim_all_working_sets() → Result  (applies to all non-critical processes)

Cockpit Memory detail pane updates:
  RAM composition bar (horizontal, full-width, stacked segments):
    [  In Use (blue)  |  Modified (amber)  |  Standby (gray-blue)  |  Free (dark)  ]
    Each segment labeled with MB value
  Committed charge: large monospace "X.X GB / Y.Y GB"
  Paged / Non-paged pool: secondary row
  Page file: bar + "X.X GB used of Y.Y GB"
  [Trim All Working Sets] button — invokes trim_all_working_sets, shows "Trimmed" for 3s

Gate: npx tsc --noEmit passes. cargo check passes.
      Memory pane shows composition bar with 4 segments.
      Trim button functional.

────────────────────────────────────────────────────────────────
TRACK E — Storage + Network + Hardware Info
Session model: sonnet (DISK-01, NET-01), haiku (HW-01)
All three run simultaneously within this track.
────────────────────────────────────────────────────────────────

SPRINT E1: AEGIS-DISK-01
Fix WMI disk I/O (currently one-shot disabled due to HRESULT 0x80041010).
Use Win32_PerfFormattedData_PerfDisk_PhysicalDisk instead of LogicalDisk.

Extend DiskInfo in metrics.rs:
  active_time_pct: f32     (% time disk was busy)
  avg_response_ms: f32     (average read+write response time)
  read_bytes_sec: u64      (already exists — verify)
  write_bytes_sec: u64     (already exists — verify)
  queue_length: f32        (average queue depth)
  total_bytes: u64
  free_bytes: u64
  disk_type: String        ("SSD" | "HDD" | "NVMe" | "Unknown")

Disk growth rate tracking in sidecar (new module sidecar/src/disk/monitor.ts):
  DiskMonitor class:
  - Record free_bytes every 5 minutes per disk
  - growthRate(diskId): MB/hour over last 24h
  - alert if any disk projected full within 7 days → SniperEvent type='flagged'
    reason='disk_growth: D:\ projected full in 4.2 days at current rate'
  - getStats(): { disks: DiskStat[] } where DiskStat includes growth_rate_mb_per_hr

Cockpit Disk detail pane updates:
  Active time % bar (large, prominent — this is what TM shows biggest)
  Read / Write MB/s dual-line graph (fix the broken WMI data)
  Average response time ms
  Queue length
  Growth rate: "Growing at 1.2 GB/hr — 4.2 days remaining" (amber if < 7 days)
  [Purge Dupes Trash] quick action button if D:\Media\_dupes_trash\ exists
    and contains files → shows count + size, invokes shell open of that folder

Gate: WMI disk data flows (not all-zeros). Active time % renders. Growth rate shown.

SPRINT E2: AEGIS-NET-01
Extend NetworkAdapter in metrics.rs:
  ipv4_address: String
  ipv6_address: String
  connection_type: String   ("Ethernet" | "WiFi" | "Loopback" | "Unknown")
  wifi_signal_dbm: i32 | null  (null if not WiFi)
  wifi_signal_pct: u32 | null  (mapped from dBm: -50→100%, -100→0%)
  dns_suffix: String
  mac_address: String
  speed_mbps: u64           (adapter link speed)

Source: GetAdaptersAddresses (iphlpapi.dll) for IPs + MAC.
        WlanQueryInterface for WiFi signal (if connection_type=WiFi).

Sync storm detection in sidecar (sidecar/src/net/monitor.ts):
  NetMonitor class:
  - Track total outbound bytes/sec across all adapters
  - Detect sync storms: OneDrive + GoogleDriveFS + litestream all writing simultaneously
    → if combined disk write > 50MB/s AND combined net send > 10MB/s for > 30s:
    SniperEvent type='flagged', reason='sync_storm: OneDrive+GoogleDriveFS+litestream
    competing — consider staggering sync schedules'
  - Expose via IPC 'get_net_stats'

Cockpit Network detail pane updates:
  Per-adapter: IP address (v4 + v6), MAC, speed, connection type
  WiFi signal strength bar (if WiFi adapter)
  Sync storm indicator: amber banner when storm detected

Gate: Network pane shows IPv4/IPv6. WiFi adapters show signal %. Sync storm detects.

SPRINT E3: AEGIS-HW-01
Read-only hardware info. Runs once at startup. No polling.

New module: sidecar/src/hw/info.ts
HardwareInfo interface:
  cpu:
    name: String
    cores_physical: number
    cores_logical: number
    cache_l1_kb: number | null
    cache_l2_kb: number | null
    cache_l3_kb: number | null
    base_speed_ghz: number
    socket: String
  ram:
    total_mb: number
    speed_mhz: number | null
    form_factor: String | null   ("DIMM" | "SODIMM" | "Unknown")
    slots_used: number | null
    slots_total: number | null
  gpu:
    name: String
    driver_version: String
    driver_date: String
    vram_mb: number
    directx_version: String | null
  disks: Array<{ name, type, total_mb, model }>
  os:
    name: String
    version: String
    build: String
    install_date: String

Source: WMI Win32_Processor (cache, socket), Win32_PhysicalMemory (speed, form),
        Win32_VideoController (driver), Win32_DiskDrive (model).
Runs once on AEGIS start. Cached. Exposed via IPC 'get_hardware_info'.

Cockpit: new 'hardware' section in SIDEBAR_SECTIONS intelligence group:
  { id: 'hardware', label: 'Hardware', icon: '💻' }
Hardware detail pane: read-only table. CPU section / RAM section / GPU section / Disks.
No graphs. No actions. Pure reference.

Gate: Hardware pane shows CPU cache sizes, RAM speed, GPU driver version.

────────────────────────────────────────────────────────────────
TRACK F — Startup Auditor
Session model: sonnet
Full prompt: D:\Dev\aegis\sprints\AEGIS-STA-01.md
Spawns Phase 3 sprints: SRV-01, BOT-01, LOG-01
────────────────────────────────────────────────────────────────

SPRINT F1: AEGIS-STA-01
Full prompt: D:\Dev\aegis\sprints\AEGIS-STA-01.md
No changes from existing prompt.
Gate: Startup section in sidebar. LitestreamBrain and OneDrive visible.
      Disable button functional and reversible.

────────────────────────────────────────────────────────────────
TRACK G — Tray Live Gauge
Session model: sonnet
Runs independently. No Phase 3 dependents.
────────────────────────────────────────────────────────────────

SPRINT G1: AEGIS-TRAY-01
Update tray icon to show live CPU % gauge.

Approach: Generate tray icon dynamically from PNG template with overlaid text/bar.
Tauri 2 supports set_icon() on the tray — can be called with a DynamicImage.

Implementation (Rust, src-tauri/src/tray.rs):
- Keep static AEGIS icon as base
- Every 2s (on metrics update), generate a small overlay:
    16x16 or 32x32 pixel buffer
    Bottom 4px: green/amber/red bar based on CPU %
    If CPU > 80%: icon tint shifts to amber
    If CPU > 95%: icon tint shifts to red
- Use image crate (already likely in Cargo.toml) to manipulate pixels
- Call tray_handle.set_icon() with new DynamicImage
- Tooltip: "AEGIS — CPU: 34% | RAM: 61% | VRAM: 45%"
  Update tooltip every 2s alongside icon

Cargo.toml: add image = "0.24" if not present.

Tray right-click menu additions:
  Current: [Show/Hide Cockpit] [Quit]
  New: [Show/Hide Cockpit] [---] [CPU: 34%] [RAM: 61%] [VRAM: 45%] [---] [Quit]
  The CPU/RAM/VRAM items are disabled MenuItems (display only, not clickable)
  Update every 10s

Gate: cargo check passes. Tray icon has colored bottom bar. Tooltip shows live stats.
      Tray menu shows current CPU/RAM/VRAM.

────────────────────────────────────────────────────────────────
TRACK H — CPU Per-Core
Session model: sonnet
Runs independently. No Phase 3 dependents.
────────────────────────────────────────────────────────────────

SPRINT H1: AEGIS-CPU-01
Extend metrics.rs to include per-core data:
  Add to SystemMetrics: per_core_cpu: Vec<f32>  (one entry per logical core, 0-100)
  sysinfo CpuExt::cpu_usage() per CPU in system.cpus()

Extend SystemMetrics: thread_count_total: u32 (sum of all process threads)

Cockpit CPU detail pane update (ui/index.html):
  Per-core grid: render one bar per core in a responsive grid
  Grid layout: 4 columns if ≤ 8 cores, 8 columns if > 8 cores
  Each cell: core label (C0, C1...) + % number + vertical bar
  Bar height proportional to usage. Color: green/amber/red by threshold.
  Grid appears below the main CPU line graph.
  Thread count total: add to secondary metrics row ("Threads: 2,847")

Gate: CPU detail pane shows per-core bars. Thread count displayed.
      Per-core data updates every 2s with metrics.

═══════════════════════════════════════════════════════════════════
PHASE 3 — PARALLEL WITHIN DEPENDENCY GROUPS
Run: Each sprint starts as soon as its Phase 2 parent commits.
Groups run in parallel with each other.
═══════════════════════════════════════════════════════════════════

────────────────────────────────────────────────────────────────
GROUP 1: After PROCS-01 commits (Tracks C spawns)
3 sprints, all parallel.
────────────────────────────────────────────────────────────────

SPRINT C2: AEGIS-WATCHDOG-01
Session model: sonnet
New module: sidecar/src/watchdog/monitor.ts

WatchdogEntry:
  id: string
  process_pattern: string   (substring match on name)
  restart_command: string   (full command to relaunch)
  restart_delay_sec: number (default: 5)
  max_restarts: number      (within 10 minutes before giving up)
  notify_on_crash: boolean
  enabled: boolean

WatchdogMonitor class:
- Watches registered processes every 5s
- If process matching pattern disappears:
    wait restart_delay_sec
    re-check (may have been intentional kill)
    if still gone and max_restarts not hit: spawn restart_command
    emit SniperEvent type='action_taken', action='notify',
      reason='Watchdog restarted postgresql — crashed at 17:43'
    if max_restarts hit: emit 'flagged', reason='watchdog gave up after 5 restarts'
- notify_on_crash=true: tray notification immediately on crash regardless of restart

Default registrations (aegis-config.yaml watchdog section):
  - id: postgresql
    process_pattern: postgres
    restart_command: "net start postgresql-x64-17"
    restart_delay_sec: 10
    max_restarts: 3
    notify_on_crash: true
    enabled: true

  - id: kernl-mcp
    process_pattern: kernl-mcp
    restart_command: "node D:/Projects/Project Mind/kernl-mcp/dist/index.js"
    restart_delay_sec: 5
    max_restarts: 5
    notify_on_crash: true
    enabled: true

  - id: litestream
    process_pattern: litestream
    restart_command: "wscript.exe D:\\Tools\\litestream\\run-silent.vbs"
    restart_delay_sec: 30
    max_restarts: 3
    notify_on_crash: true
    enabled: true

Cockpit: push to 'intelligence' SIDEBAR_SECTIONS:
  { id: 'watchdog', label: 'Watchdog', icon: '🔁' }
Watchdog pane: table of registrations with status (watching/crashed/restarting/gave-up)
  + recent event log (last 10 crash/restart events)
  Enable/disable toggle per entry.

Gate: npx tsc --noEmit passes. Watchdog pane renders. PostgreSQL entry shown.

SPRINT C3: AEGIS-RULES-01
Session model: opus (rule editor UI is architectural)
New module: sidecar/src/rules/engine.ts

PersistentRule interface:
  id: string
  name: string              (user-visible label)
  target_pattern: string    (process name substring or exact)
  trigger: 'on_launch' | 'always' | 'schedule'
  schedule_cron?: string    (if trigger='schedule')
  conditions: Array<{
    metric: 'cpu_pct' | 'memory_mb' | 'instance_count' | 'vram_mb' | 'disk_mbs'
    operator: 'gt' | 'lt' | 'eq'
    value: number
  }>
  actions: Array<{
    type: 'set_priority' | 'set_io_priority' | 'set_affinity' |
          'suspend' | 'kill' | 'notify' | 'run_script' | 'set_hard_cpu_limit'
    params: Record<string, unknown>
  }>
  context_exemptions: ContextName[]
  enabled: boolean
  user_defined: true        (all persistent rules are user_defined)

PersistentRulesEngine class:
- Loads rules from %APPDATA%\AEGIS\rules.json on startup
- On every process metrics update: evaluate all enabled rules against running processes
- For trigger='on_launch': watch for new PIDs, apply immediately
- For trigger='always': apply on every poll (re-applies if process restores priority)
- For trigger='schedule': cron evaluation (use node-cron or manual interval)
- For action='run_script': spawn the script with process name + PID as env vars
- All rule applications logged to action log
- saveRules(): persists to rules.json (no-BOM UTF-8)

IPC: 'get_rules' → PersistentRule[]
     'save_rule' (payload: PersistentRule) → { success }
     'delete_rule' (id: string) → { success }
     'toggle_rule' (id: string, enabled: boolean) → { success }

Cockpit: push to 'intelligence' SIDEBAR_SECTIONS:
  { id: 'rules', label: 'Rules', icon: '📋' }
Rules pane: rule editor
  Top: [+ New Rule] button
  Rule list: each row shows name, target, trigger, actions summary, enabled toggle, [Edit] [Delete]
  Rule editor (inline expand or modal):
    Target process: text input with autocomplete from running processes
    Trigger: dropdown (On Launch / Always / Schedule)
    Schedule: cron input (if Schedule selected) with human-readable preview
    Conditions: add/remove rows (metric selector, operator, value)
    Actions: add/remove rows (action type selector, params)
    Context exemptions: multi-select checkboxes
    [Save] [Cancel]
  No action on unknown processes (catalog gate still applies)

Default built-in rule suggestions (shown as templates, not auto-enabled):
  "Throttle Defender on deep_work context"
  "Suspend SearchIndexer during Build context"
  "Notify on Claude instance count > 8"

Gate: npx tsc --noEmit passes. Rules pane renders. New rule can be created and saved.
      Saved rules persist across AEGIS restart. On-launch trigger applies to new processes.

SPRINT C4: AEGIS-TREE-01
Session model: sonnet
Process tree as an alternative view in the Processes pane.

New Rust command: get_process_tree() → JSON tree structure
Build spawn tree: for each process, find parent by ppid.
sysinfo Process has parent_pid(). Build adjacency list. Serialize as nested JSON:
  { pid, name, cpu_pct, memory_mb, children: [...] }

Cockpit Processes pane update:
  Add view toggle: [Tree] [Flat] (default: Tree, matching Process Hacker/Lasso)
  Tree view:
    Rows indented by depth (16px per level)
    Collapse/expand button (▶/▼) on rows with children
    Root nodes: System, services.exe, explorer.exe, etc.
    AEGIS own processes: dimmed (we know what we are)
    Unknown processes: amber highlight
    Suspicious processes: red highlight
  Flat view: existing sorted table (unchanged)
  Persist tree/flat preference to localStorage

Gate: Tree view renders with correct parent-child relationships.
      Collapse/expand functional. Explorer.exe shows Claude as child.

────────────────────────────────────────────────────────────────
GROUP 2: After GPU-01 commits
────────────────────────────────────────────────────────────────

SPRINT B2: AEGIS-THERMAL-01
Session model: sonnet
New module: sidecar/src/thermal/monitor.ts

ThermalMetrics interface:
  cpu_temp_c: number | null
  gpu_temp_c: number | null      (from GPU monitor if available)
  cpu_throttling: boolean         (detected via sustained freq drop below rated)
  thermal_status: 'normal' | 'warm' | 'hot' | 'throttling'

CPU temperature source (Windows):
  Option 1: WMI MSAcpi_ThermalZoneTemperature (requires admin, often 0 on laptops)
  Option 2: OpenHardwareMonitor WMI bridge (if installed)
  Option 3: nvidia-smi already provides GPU temp (already in GPU monitor)
  Strategy: attempt MSAcpi first, fall back to 'unavailable' if all 0.
  Note in cockpit if temp unavailable: "CPU temp requires admin or HWiNFO bridge"

Throttle detection (no temp needed):
  Compare current CPU freq against rated base speed from HardwareInfo.
  If current_ghz < (base_ghz * 0.8) sustained for > 30s: throttling = true.
  This works without temperature access.

Thresholds:
  < 70°C: normal
  70-85°C: warm (amber tray indicator)
  85-95°C: hot (SniperEvent type='flagged', reason='cpu_temperature: 89°C')
  > 95°C: critical (tray notification: "CPU critically hot — check cooling")
  throttling = true: SniperEvent regardless of temp
    reason: 'thermal_throttle: CPU running at 1.2GHz vs 2.6GHz base — cooling issue'

Cockpit CPU detail pane update:
  Add temperature row: "CPU: 71°C" with color coding
  Throttle indicator: amber banner "⚠ CPU throttling detected" if active
  Thermal history: 60-point temperature sparkline alongside CPU % graph

Gate: npx tsc --noEmit passes. CPU pane shows temp (or "unavailable" message).
      Throttle detection works based on freq comparison.

────────────────────────────────────────────────────────────────
GROUP 3: After STA-01 commits
────────────────────────────────────────────────────────────────

SPRINT F2: AEGIS-SRV-01
Session model: sonnet
New module: sidecar/src/health/monitor.ts
(Full spec in IMPROVEMENTS_SPEC.md GAP 4)

ServiceHealthMonitor: tails log files + detects error pattern loops.
Initial registered services:
  - litestream: log at %APPDATA%\AEGIS\logs\litestream.log (if exists) OR
    pattern-match stderr from the process (via watcher on brainsignalwatcher.out.log)
    error patterns: ['sync error', 'compaction failed', 'checksum mismatch']
    loop threshold: 3 errors in 60s → SniperEvent
  - postgresql: watch Windows Event Log Application for source PostgreSQL
    error patterns: ['FATAL', 'ERROR']
    loop threshold: 2 errors in 30s → SniperEvent

Cockpit STA-01 Services section: add health column to startup entries that are services.
  Green dot = healthy. Amber = recent errors. Red = loop detected.

Gate: npx tsc --noEmit passes. Litestream checksum loop triggers SniperEvent within 90s.

SPRINT F3: AEGIS-BOT-01
Session model: haiku (configuration + sequencing, no novel code)
New module: sidecar/src/boot/sequencer.ts

BootSequencer: replaces manual VBScript launcher for litestream.
aegis-config.yaml boot_sequence section:
  boot_sequence:
    - id: litestream
      command: '"D:\Tools\litestream\litestream.exe" replicate -config "D:\Meta\litestream.yml"'
      boot_delay_sec: 30
      boot_after: []
      window: hidden
      enabled: true

BootSequencer.start():
- On AEGIS boot, read boot_sequence entries
- For each entry in dependency order:
    wait boot_delay_sec
    spawn command with CREATE_NO_WINDOW flag (windowsHide: true in Node spawn)
    log: "[BOOT] Started litestream at +30s"
- Removes need for external VBScript/bat

Update HKCU Run registry: LitestreamBrain entry should be removed once AEGIS itself
starts litestream. AEGIS must be the only thing in HKCU Run for this (add AEGIS
to startup if not present, remove LitestreamBrain).
BUT: do not auto-modify registry in this sprint. Flag in MORNING_BRIEFING for
manual action — David must decide when to cut over.

Gate: npx tsc --noEmit passes. Boot sequencer starts litestream at +30s with no window.

SPRINT F4: AEGIS-LOG-01
Session model: sonnet
Unified process event log — all starts, stops, crashes, rule fires, watchdog events.

New module: sidecar/src/log/event-log.ts
ProcessEvent:
  timestamp: string          (ISO)
  type: 'start' | 'stop' | 'crash' | 'rule_fired' | 'watchdog' | 'sniper' | 'policy'
  process_name: string
  pid: number | null
  detail: string             (human-readable summary)
  severity: 'info' | 'warn' | 'error'

EventLog class:
- Ring buffer: last 1000 events in memory
- Persist to %APPDATA%\AEGIS\event-log.jsonl (append)
- Detects process starts: new PIDs in metrics not seen last poll → log 'start'
- Detects process stops: PIDs from last poll missing → log 'stop'
- Detects crashes: process stop AND watchdog had it registered → log 'crash'
- Receives events from: SniperEngine, WatchdogMonitor, PolicyEngine, PersistentRulesEngine
- getEvents(filter?: { type?, severity?, since?, process? }): ProcessEvent[]
- IPC: 'get_event_log' (payload: filter) → ProcessEvent[]

Cockpit: push to 'intelligence' SIDEBAR_SECTIONS:
  { id: 'log', label: 'Event Log', icon: '📜' }
Event Log pane:
  Filter bar: type dropdown + severity dropdown + process name text input
  Table: timestamp | severity dot | type badge | process | detail
  Auto-scroll to bottom (newest). Pause-on-hover.
  [Export CSV] button: download event-log.jsonl as CSV

Gate: npx tsc --noEmit passes. Event log pane shows process starts/stops in real time.
      PostgreSQL crash from today would appear as 'crash' severity='error'.

═══════════════════════════════════════════════════════════════════
PHASE 4 — FINAL LAYER (parallel within dependencies)
Run: As Phase 3 parents commit.
═══════════════════════════════════════════════════════════════════

SPRINT RULES-01 → SCHED-01: AEGIS-SCHED-01
Session model: sonnet
Depends on: RULES-01 (uses PersistentRulesEngine for context-based scheduling)

Three capabilities:

1. Hard CPU % cap via Windows Job Object:
   set_hard_cpu_limit() in commands.rs:
     OpenProcess → AssignProcessToJobObject → SetInformationJobObject with
     JOBOBJECT_CPU_RATE_CONTROL_INFORMATION (CpuRate in units of 1/10000)
     E.g. 25% = CpuRate 2500. Enforced by kernel — process cannot exceed cap.

2. Foreground process boosting:
   When context engine detects context change (deep_work, build, etc.):
     Get foreground process PID from context engine
     SetPriorityClass(handle, ABOVE_NORMAL_PRIORITY_CLASS)
     All other non-system processes: SetPriorityClass(handle, BELOW_NORMAL_PRIORITY_CLASS)
   On context change away: restore all to NORMAL_PRIORITY_CLASS
   This is analogous to Lasso's ProBalance but context-driven, not threshold-driven.

3. Gaming context: suspend registered background processes
   Gaming context detected → automatically suspend: OneDrive, SearchIndexer,
     WindowsUpdate, SoftwareFX (if running)
   On gaming context exit: resume all suspended processes
   Registered list editable in Rules pane (gaming_suspend_list in aegis-config.yaml)

New Tauri command: apply_scheduling_policy(context: String) → Result
Called by context engine on every context transition.

Gate: npx tsc --noEmit passes. cargo check passes.
      Hard CPU cap applied: target process cannot exceed specified %.
      Foreground boost: foreground process shows ABOVE_NORMAL in process detail.

SPRINT RULES-01 → CATALOG-02: AEGIS-CATALOG-02
Session model: sonnet
Depends on: RULES-01 (uses persistent rules infrastructure for enforcement)

Two capabilities:

1. Prevent execution (blacklist):
   New catalog action_permission value: 'block'
   If catalog.canActOn(name, 'block') = true:
     On process launch detection: immediately kill the process
     Log: "[CATALOG] Blocked execution of known-bad.exe (catalog: blocked)"
     Tray notification: "AEGIS blocked [process] — flagged as blocked in catalog"
   Add 'block' to seed.json schema. No processes blocked by default.
   User can add from Catalog pane: right-click process → [Block execution]

2. Instance count enforcement (not just notify):
   When electron-process-sprawl rule fires (SNP-05, currently notify-only):
     If instance count > user-configured limit: kill youngest instances until at limit
     Default limit: 8 for Claude, Discord, Slack, Code
     User-configurable per-app in Rules pane
     Kills youngest PIDs first (lowest age = most recently spawned)
   New SniperAction type: 'enforce_instance_limit'
   Graduated: notify first at threshold, enforce at threshold + 3

Gate: npx tsc --noEmit passes. Blocked process cannot launch. Instance limit enforced.

SPRINT MEM-01 → MEM-02: AEGIS-MEM-02
Session model: sonnet
Depends on: MEM-01 (uses RAM time-series data)

Slow memory leak trend detector — distinct from zscore baseline deviation.

Problem: a process growing 400MB over 6 hours won't spike above zscore threshold
because the Welford mean adapts with it. Need a separate linear regression detector.

Implementation in sidecar/src/sniper/baseline.ts (extend):
  leakScore(name: string, context: ContextName, windowHours: number): number | null
    Queries last (windowHours * 3600 / 30) baseline samples (flushed every 30s).
    Fits simple linear regression to memory_mb over time.
    Returns slope in MB/hour. Positive and significant = leak candidate.
    Returns null if insufficient data (< 20 samples).

SniperEngine: new evaluation path alongside zscore:
  Every 30 minutes, evaluate leakScore for all baselined processes.
  If slope > 50 MB/hour for > 2 hours: SniperEvent type='flagged'
    reason='memory_leak_trend: node.exe growing at 87 MB/hr over 3 hours'
  action: 'notify' only (never auto-kill a leaking process — blast radius unknown)

Cockpit Memory pane: add leak candidates section:
  "Suspected leaks" table: process name | growth rate | duration | [Review]
  [Review] opens process detail pane for that process

Gate: npx tsc --noEmit passes. Sustained process growth triggers leak detection event.

SPRINT PROCS-01 → PORT-01: AEGIS-PORT-01
Session model: sonnet
Depends on: PROCS-01 (uses per-process data)

Port occupancy monitor for registered services.

PortMonitor (sidecar/src/net/ports.ts):
  Registered ports (aegis-config.yaml ports section):
    - id: postgresql, port: 5432, process_pattern: postgres, protocol: tcp
    - id: kernl-mcp, port: varies, process_pattern: node, protocol: tcp
    - id: litestream-metrics, port: 9090, process_pattern: litestream, protocol: tcp

  Every 30s: run netstat equivalent via PowerShell one-shot:
    Get-NetTCPConnection -State Listen | Select-Object LocalPort,OwningProcess
  Cross-reference: does port X have the expected process owning it?
  Cases:
    Expected process owns port: healthy (green)
    Port open but wrong process owns it: conflict (red) → SniperEvent
      reason='port_conflict: port 5432 owned by PID 1234 (python) not postgres'
    Expected process running but port not open: service not listening → warn (amber)
      reason='port_not_listening: postgresql running but port 5432 not open'
    Port closed and process not running: offline (gray) — not an alert

Cockpit STA-01 Startup pane: add port status column to service entries that have
registered ports. Shows: 5432 (green) / 5432 ⚠ CONFLICT / not listening.

Gate: npx tsc --noEmit passes. Port status shown for PostgreSQL entry.
      Port conflict detected and surfaced as SniperEvent.

═══════════════════════════════════════════════════════════════════
PHASE 5 — BUILD-02 (serial, after all Rust-touching sprints)
═══════════════════════════════════════════════════════════════════

SPRINT: AEGIS-BUILD-02
Session model: haiku
Run: After all Phase 2-4 sprints that modified src-tauri/ have committed.

Rust-touching sprints: GPU-01, PROCS-01, MEM-01, DISK-01, NET-01, CPU-01, TRAY-01,
SCHED-01, CATALOG-02, HW-01, WATCHDOG-01 (if Rust commands added)

Tasks:
1. cd /d D:\Dev\aegis\sidecar && npm install --include=dev && npm run build-and-bundle
   Verify: src-tauri/binaries/aegis-sidecar-x86_64-pc-windows-msvc.exe updated.

2. cd /d D:\Dev\aegis && cargo tauri build
   Must complete with 0 errors. If errors: fix + retry once. If fails: BLOCKED.md.
   Output: D:\Tools\.cargo-target\release\aegis.exe

3. Full runtime verification:
   Launch aegis.exe. Verify:
   - Tray shows live CPU gauge (TRAY-01)
   - Tray tooltip: "AEGIS — CPU: X% | RAM: Y% | VRAM: Z%"
   - Cockpit sidebar: Performance section has CPU/Memory/GPU/Disk/Network items
   - Cockpit sidebar: Intelligence section has Context/Sniper/Catalog/Learning/Rules/Watchdog/Log
   - Cockpit sidebar: Policy section exists
   - Cockpit sidebar: Startup section exists
   - Cockpit sidebar: Hardware section exists
   - CPU pane: per-core bars visible
   - Memory pane: composition bar (4 segments)
   - GPU pane: VRAM % with color threshold
   - Processes pane: Tree view default, Flat toggle works
   - Processes pane: Disk/Network columns present
   - Policy pane: 6 policies listed with compliance status
   - Startup pane: real entries from current machine
   - Rules pane: rule editor functional
   - Watchdog pane: PostgreSQL + KERNL entries shown
   - Event Log pane: showing real process start/stop events
   Document every item: PASS or FAIL with detail.

4. Update ARCHITECTURE.md: full component map with all new modules.
5. Update STATUS.md: mega-sprint complete. All sprints closed.
6. Update BACKLOG.md: all items closed. Add any runtime findings as new items.

7. Quality gate (all must pass):
   cargo check in src-tauri/: 0 errors
   npx tsc --noEmit in sidecar/: 0 errors
   aegis.exe launches and tray appears
   All 15+ sidebar items render with real data
   No all-zeros anywhere in monitoring data

8. Portfolio compliance check — D:\Dev\aegis (10 minutes max)

9. Session close:
   FRICTION PASS — triage FIX NOW / BACKLOG / LOG ONLY.
   Present: "Mega-sprint complete. [summary of what shipped vs blocked]
     [A] Fix now  [B] Just log  [C] Skip"
   Execute chosen path.

   MORNING_BRIEFING.md — write to D:\Dev\aegis\ BEFORE git add.
   Schema: D:\Dev\TEMPLATES\MORNING_BRIEFING_SCHEMA.md

   Final commit: git add all. Commit via commit-msg.txt. Push.
   Tag: git tag v5.0.0 -m "AEGIS v5 — full parity + intelligence complete"

═══════════════════════════════════════════════════════════════════
PARALLELISM SUMMARY (operator reference)
═══════════════════════════════════════════════════════════════════

Phase 0: 1 session (BUILD-01)                         → wait for gate
Phase 1: 1 session (UI-01, opus)                      → wait for gate
Phase 2: 8 simultaneous sessions:
  Session 1 — Track A: SNP-05 then POL-01 (sonnet)
  Session 2 — Track B: GPU-01 (sonnet)
  Session 3 — Track C: PROCS-01 (sonnet)
  Session 4 — Track D: MEM-01 (sonnet)
  Session 5 — Track E: DISK-01 + NET-01 + HW-01 (sonnet/haiku, serial within)
  Session 6 — Track F: STA-01 (sonnet)
  Session 7 — Track G: TRAY-01 (sonnet)
  Session 8 — Track H: CPU-01 (sonnet)
Phase 3: Up to 7 simultaneous sessions (start as Phase 2 parents complete):
  When PROCS-01 done: WATCHDOG-01, RULES-01 (opus), TREE-01 (parallel)
  When GPU-01 done: THERMAL-01
  When STA-01 done: SRV-01, BOT-01, LOG-01 (parallel)
Phase 4: Up to 4 simultaneous sessions (start as Phase 3 parents complete):
  When RULES-01 done: SCHED-01, CATALOG-02 (parallel)
  When MEM-01 done: MEM-02
  When PROCS-01 done: PORT-01
Phase 5: 1 session (BUILD-02, haiku)                  → final gate

Total parallel sessions at peak (Phase 2): 8
Estimated wall-clock time (parallel): ~12-16 hours of Cowork time
Estimated serial time (if run single-threaded): ~60-80 hours

═══════════════════════════════════════════════════════════════════
CRITICAL CONSTRAINTS (apply to ALL sessions in ALL phases)
═══════════════════════════════════════════════════════════════════

- READ D:\Dev\aegis\ARCHITECTURE.md BEFORE TOUCHING ANYTHING IN ANY SESSION.
- AEGIS is a Tauri 2 desktop app. Three components: src-tauri/, sidecar/, ui/. Nothing else.
- Dead v2 artifacts — STOP if you see: src/, assets/, scripts/, installer/, dist/,
  release/, build-release.mjs, root package.json, systray2, pkg, mshta.
- PHANTOM EDITS RULE: Filesystem:write_file or Filesystem:edit_file ONLY for all edits.
  str_replace, create_file, Desktop Commander write to Claude's container, NOT disk.
  Verify every write with Filesystem:read_text_file after writing.
- Build output: D:\Tools\.cargo-target\release\aegis.exe — NOT src-tauri/target/.
- Install target: D:\Program Files\AEGIS\ — NEVER C:\.
- Sidecar quality gate: npx tsc --noEmit in sidecar/ must pass 0 errors.
- Rust quality gate: cargo check in src-tauri/ must pass 0 errors.
- UI aesthetic: utilitarian. No glow. No neon. Dense tables. SIDEBAR_SECTIONS array.
- PolicyEngine: NEVER crash AEGIS on policy failure. All errors caught, logged, continue.
- WatchdogMonitor: NEVER restart a process more than max_restarts times in 10 minutes.
- PersistentRulesEngine: NEVER apply rules to processes not in catalog (gate applies).
- MORNING_BRIEFING.md written to D:\Dev\aegis\ BEFORE each session's git add.
  Each session commits its own MORNING_BRIEFING with sprint ID prefix.
- Version bump required: Cargo.toml + tauri.conf.json → 5.0.0 in BUILD-02.

MODEL ROUTING:
  Phase 0 (BUILD-01): haiku
  Phase 1 (UI-01): opus — design system decisions
  Phase 2 Track A (SNP-05, POL-01): sonnet
  Phase 2 Track B (GPU-01): sonnet
  Phase 2 Track C (PROCS-01): sonnet
  Phase 2 Track D (MEM-01): sonnet
  Phase 2 Track E (DISK-01, NET-01): sonnet; HW-01: haiku
  Phase 2 Track F (STA-01): sonnet
  Phase 2 Track G (TRAY-01): sonnet
  Phase 2 Track H (CPU-01): sonnet
  Phase 3 (WATCHDOG-01, TREE-01, THERMAL-01, SRV-01, BOT-01, LOG-01): sonnet
  Phase 3 (RULES-01): opus — rule editor is architectural UI
  Phase 4 (SCHED-01, CATALOG-02, MEM-02, PORT-01): sonnet
  Phase 5 (BUILD-02): haiku

ACCEPTANCE CRITERIA (mega-sprint complete when ALL pass):
  aegis.exe v5.0.0 launches, tray shows live CPU gauge
  Cockpit sidebar has 15+ items across Performance/Intelligence/Policy/Startup/Hardware
  CPU pane: per-core bars, thread count, temperature (or "unavailable" message)
  Memory pane: 4-segment composition bar, page file, trim button
  GPU pane: VRAM % with color thresholds, per-process VRAM table
  Disk pane: active time %, response time, growth rate
  Network pane: IPv4/IPv6, WiFi signal if applicable
  Hardware pane: CPU cache, RAM speed, GPU driver version
  Processes pane: Tree view default, Disk/Network/GPU columns, row expansion with command line
  Policy pane: 6 policies (5 registry + 1 json_file) with compliance status
  Startup pane: real entries, risk-rated, disable functional
  Rules pane: rule editor functional, rules persist across restart
  Watchdog pane: PostgreSQL + KERNL entries, event log
  Event Log pane: real-time process starts/stops visible
  Thermal detection: throttle detection working (freq-based fallback)
  Sync storm detection: fires when OneDrive+GDrive+litestream overlap
  Port monitor: PostgreSQL port status shown in startup pane
  Instance count enforcement: Claude instances capped at configurable limit
  npx tsc --noEmit in sidecar/: 0 errors
  cargo check in src-tauri/: 0 errors
  git tag v5.0.0 exists and pushed
