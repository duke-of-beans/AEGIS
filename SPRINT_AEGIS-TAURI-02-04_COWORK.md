Execute Sprint AEGIS-TAURI-02-04 — Tray + Live Metrics + Sidecar + Cockpit WebView for AEGIS v4.
Run FIRST. This is the first multi-sprint block for the Tauri migration. No dependencies.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\AEGIS\STATUS.md
  Filesystem:read_file D:\Projects\AEGIS\AEGIS_V4_BLUEPRINT.md
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\main.rs
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\metrics.rs
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\commands.rs
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\profiles.rs
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\tray.rs
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\sidecar.rs
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\tauri.conf.json
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\Cargo.toml
  Filesystem:read_file D:\Projects\AEGIS\sidecar\src\main.ts
  Filesystem:read_file D:\Projects\AEGIS\sidecar\package.json
  Filesystem:read_file D:\Projects\AEGIS\ui\index.html
  Filesystem:read_file D:\Projects\AEGIS\profiles\idle.yaml
  Filesystem:read_file D:\Projects\AEGIS\profiles\wartime.yaml

Summary: After this sprint, AEGIS v4 is a fully functional native Windows desktop
application. The tray icon is visible, profile switching works from the tray menu,
the cockpit window shows live CPU/RAM/process data updating every 2 seconds, the
intelligence sidecar is wired (context detection, cognitive load, sniper), and the
full Task Manager-style cockpit UI from v3 is ported to Tauri events. No Node.js
HTTP server. No pm2. No PowerShell worker. No elevation required for metrics.

---

AEGIS-TAURI-02: Tray Icon + Profile Switching + Metrics Verification

Tasks:

1. Run cargo tauri dev and verify tray — D:\Projects\AEGIS\src-tauri\:
   - Run: cd /d D:\Projects\AEGIS && cargo tauri dev
   - Verify AEGIS.exe appears in tasklist
   - Verify tray icon appears in Windows notification area (system tray)
   - Verify tray menu shows profile names (idle, build-mode, deep-research, etc.)
   - Verify left-clicking tray icon shows/hides the cockpit window
   - If tray icon does NOT appear: the issue is likely the icon path in tauri.conf.json
     or the TrayIconBuilder not being called in setup. Fix tray.rs and tauri.conf.json.

2. Fix any tray compilation issues — src-tauri/src/tray.rs:
   - tray.rs currently uses CheckMenuItemBuilder — verify Tauri 2 supports this API
   - If CheckMenuItemBuilder causes errors: use regular MenuItemBuilder with a prefix
     bullet "● " for the active profile, space for inactive
   - The tray must show: header (disabled), separator, 6 profile items, separator,
     Open Cockpit, Quit AEGIS
   - Profile switching via tray must call profiles::load_profile + profiles::apply_profile
     and emit "profile_changed" event to WebView
   - Active profile gets a visible checkmark or bullet indicator in the menu

3. Verify metrics are emitting — src-tauri/src/metrics.rs:
   - The metrics polling loop calls app.emit("metrics", payload) every 2 seconds
   - Verify sysinfo::System::new_all() + refresh_all() works on this machine
   - Verify cpu_percent, memory_percent, memory_mb_used, memory_mb_available all
     return non-zero values
   - Verify process list returns at least 10 entries
   - Verify disk list returns at least 1 entry (C: drive)
   - Debug method: temporarily add log::info!("metrics: cpu={}%", metrics.cpu.percent)
     and check output in cargo tauri dev console. Remove after verification.

4. Fix sysinfo API compatibility — src-tauri/src/metrics.rs + profiles.rs:
   - sysinfo 0.33 API may differ from what was written. Common issues:
     - Disks::new_with_refreshed_list() → may need to be Disks::new() + disks.refresh(false)
     - Networks::new_with_refreshed_list() → may need Networks::new() + networks.refresh(true)
     - sys.refresh_processes_specifics() signature changed between versions
     - ProcessRefreshKind::nothing() may need ProcessRefreshKind::default()
   - Fix any compile errors. cargo check must pass with 0 errors before proceeding.
   - The Disks refresh(bool) parameter: true = remove disappeared disks, false = keep list

<!-- phase:execute -->

---

AEGIS-TAURI-03: Intelligence Sidecar Wired

5. Set up sidecar TypeScript project — D:\Projects\AEGIS\sidecar\:
   - cd /d D:\Projects\AEGIS\sidecar && npm install
   - Create tsconfig.json:
     {
       "compilerOptions": {
         "target": "ES2020", "module": "commonjs", "lib": ["ES2020"],
         "outDir": "./dist", "rootDir": "./src", "strict": true,
         "esModuleInterop": true, "skipLibCheck": true
       },
       "include": ["src/**/*"]
     }
   - Verify npm install succeeds

6. Move intelligence engines to sidecar — D:\Projects\AEGIS\sidecar\src\:
   Copy these directories from src/ to sidecar/src/ (the v3 TypeScript intelligence layer):
     D:\Projects\AEGIS\src\context\     → D:\Projects\AEGIS\sidecar\src\context\
     D:\Projects\AEGIS\src\sniper\      → D:\Projects\AEGIS\sidecar\src\sniper\
     D:\Projects\AEGIS\src\learning\    → D:\Projects\AEGIS\sidecar\src\learning\
     D:\Projects\AEGIS\src\catalog\     → D:\Projects\AEGIS\sidecar\src\catalog\
     D:\Projects\AEGIS\src\logger\      → D:\Projects\AEGIS\sidecar\src\logger\
     D:\Projects\AEGIS\src\config\      → D:\Projects\AEGIS\sidecar\src\config\
     D:\Projects\AEGIS\src\types\       → D:\Projects\AEGIS\sidecar\src\types\
   Do NOT copy: tray/, worker/, status/, browser/, power/, watchdog/, mcp/ (yet)
   Fix any import path issues introduced by the move. All .js extension imports
   must match the actual file structure.

7. Wire full sidecar entry point — D:\Projects\AEGIS\sidecar\src\main.ts:
   Replace the stub with a real entry point that:
   - Initializes the logger (JSON structured, writes to %APPDATA%\AEGIS\sidecar.log)
   - Initializes CatalogManager (db at %APPDATA%\AEGIS\catalog.db)
   - Initializes ContextEngine, starts it
   - Initializes BaselineEngine, LearningStore, CognitiveLoadEngine
   - Initializes SniperEngine, wires it to the engines above
   - Initializes PolicyManager
   - Reads requests from stdin (JSON-RPC 2.0), dispatches to handlers:
       "get_state"       → return current context, confidence, cognitive_load, active_watches
       "apply_profile"   → notify engines which profile is active
       "feedback"        → route feedback to LearningStore
       "version"         → return { version: "4.0.0", pid: process.pid }
       "shutdown"        → clean shutdown
   - Pushes events to stdout proactively:
       context_changed   → when ContextEngine fires context_changed
       load_score_updated → when cognitive load changes by more than 5 points
       sniper_action_requested → when SniperEngine wants to throttle/kill a PID
   - Sends heartbeat every 30 seconds
   The Rust sidecar.rs already reads these events and routes them correctly.
   The sidecar must NOT start an HTTP server. Stdin/stdout only.

8. Compile sidecar to binary — D:\Projects\AEGIS\sidecar\:
   - npm run build (runs tsc)
   - Fix any TypeScript errors. The engines were written for Node 20+ ESM. If
     tsconfig module is "commonjs" and engines use ESM imports, adjust imports or
     use "module": "NodeNext" with .js extensions.
   - Install pkg: npm install -g pkg (if not installed)
   - Run: pkg . --target node20-win-x64 --output ../src-tauri/binaries/aegis-sidecar-x86_64-pc-windows-msvc.exe
   - Verify the binary exists at D:\Projects\AEGIS\src-tauri\binaries\aegis-sidecar-x86_64-pc-windows-msvc.exe
   - Test it runs: .\src-tauri\binaries\aegis-sidecar-x86_64-pc-windows-msvc.exe
     Should print a JSON heartbeat line and wait for stdin. Ctrl+C to kill.

9. Verify sidecar integration end-to-end — cargo tauri dev:
   - Run cargo tauri dev
   - Verify "Intelligence sidecar started" appears in console output (not "not found")
   - Verify heartbeat lines appear in console every 30 seconds
   - Verify context_changed events appear as you switch between apps
   - If sidecar crashes on start: read its stderr output (logged via CommandEvent::Stderr
     in sidecar.rs) and fix the startup error

---

AEGIS-TAURI-04: Full Cockpit WebView

10. Port v3 cockpit HTML to Tauri events — D:\Projects\AEGIS\ui\index.html:
    Replace ui/index.html with the full Task Manager-style cockpit from v3.
    Source: D:\Projects\AEGIS\src\status\html.ts (the buildStatusHtml() function body)
    Extract the HTML string from that function and write it as ui/index.html.

    Required JS changes (the only things that change from v3):
    a) Replace the polling fetch('/status') loop with Tauri event listeners:
       REMOVE:
         function poll() {
           fetch('/status').then(r => r.json()).then(s => { SNAP=s; render(s) })
         }
         setInterval(poll, 2000)
         poll()

       REPLACE WITH:
         import { listen } from '@tauri-apps/api/event'
         import { invoke } from '@tauri-apps/api/core'

         listen('metrics', (event) => {
           const m = event.payload
           if (!SNAP) SNAP = {}
           SNAP.cpu_percent = m.cpu.percent
           SNAP.memory_percent = m.memory.percent
           SNAP.memory_mb_used = m.memory.used_mb
           SNAP.memory_mb_available = m.memory.available_mb
           SNAP.system_extended = { uptime_sec: m.uptime_sec, dpc_rate: 0,
             interrupt_rate: 0, page_faults_sec: 0, page_reads_sec: 0 }
           SNAP.process_tree = m.processes.map(p => ({
             pid: p.pid, parent_pid: p.parent_pid, name: p.name,
             cpu_user_ms: Math.round(p.cpu_percent * 100),
             memory_mb: p.memory_mb, thread_count: 0
           }))
           SNAP.disk_stats = m.disks.length ? {
             drives: m.disks.map(d => ({
               letter: d.mount, label: d.name,
               size_gb: d.total_gb, free_gb: d.available_gb,
               read_bytes_sec: d.read_bytes_sec,
               write_bytes_sec: d.write_bytes_sec,
               queue_depth: 0
             })), physical_disks: []
           } : null
           SNAP.network_stats = m.networks.length ? {
             adapters: m.networks.map(n => ({
               name: n.name, status: 'Up', link_speed_mbps: 0,
               bytes_sent_sec: n.transmitted_bytes_sec,
               bytes_recv_sec: n.received_bytes_sec,
               packets_sent_sec: 0, packets_recv_sec: 0
             }))
           } : null
           SNAP.worker_status = 'native'
           if (!SNAP.active_profile) SNAP.active_profile = 'idle'
           render(SNAP)
         })

         listen('intelligence_update', (event) => {
           const d = event.payload
           if (!SNAP) return
           if (d.context) SNAP.context = { current: d.context,
             previous: '', confidence: d.confidence || 0,
             switched_at: Date.now(), idle_since: null, active_overlays: [] }
           if (d.cognitive_load !== undefined) SNAP.cognitive_load = {
             score: d.cognitive_load, tier: d.cognitive_load < 40 ? 'green' :
             d.cognitive_load < 70 ? 'amber' : 'red',
             cpu_pressure: 0, memory_pressure: 0,
             disk_queue_pressure: 0, dpc_pressure: 0 }
           render(SNAP)
         })

         listen('profile_changed', (event) => {
           if (SNAP) SNAP.active_profile = event.payload
         })

    b) Replace the profile switch fetch with invoke:
       REMOVE: fetch('/switch', { method: 'POST', body: JSON.stringify({profile}) })
       REPLACE WITH: invoke('switch_profile', { name: profile })

    c) Add the Tauri API script tag in <head>:
       <script src="/tauri-init.js"></script>
       OR use the inline CDN approach — check which method Tauri 2 dev mode uses.
       Tauri 2 injects window.__TAURI__ automatically in WebView — no script tag needed.
       The import { listen } from '@tauri-apps/api/event' syntax requires the
       @tauri-apps/api package to be available. For a plain HTML file without a
       bundler, use the CDN approach OR use window.__TAURI__.event.listen() directly:

       Replace all imports with:
         const { listen } = window.__TAURI__.event
         const { invoke } = window.__TAURI__.core

    d) Remove all references to /status, /feedback, /timer/cancel endpoints

    The visual design, layout, graphs, profile history panel, action log, confidence
    meter — all unchanged. Only the data source changes.

11. Verify cockpit renders with live data — cargo tauri dev:
    - Left-click tray icon → cockpit window appears
    - CPU % shows a non-zero number matching actual CPU load
    - RAM shows correct used/total GB (should match Task Manager)
    - Process list populates with 20+ processes
    - Disk and Network cards show actual drive labels and adapter names
    - Profile history panel shows "idle" as initial profile
    - Switch profile via tray → profile name updates in cockpit header pill
    - Context card shows "detecting..." initially, then updates after 60-90s of use
    - No console errors in DevTools (F12 in the cockpit window)

---

SHARED QUALITY GATE (runs after all 3 sprints):

12. Quality gate:
    - cargo check — 0 errors
    - cargo tauri dev — AEGIS.exe launches, tray icon visible in notification area
    - Cockpit window: CPU%, RAM%, process list, disk, network all showing live data
    - Profile switch via tray: applies within 2 seconds, cockpit updates
    - Intelligence sidecar: heartbeat visible in console, context updates after use
    - No PowerShell windows, no pm2, no port 8743, no localhost browser tab
    - tasklist shows aegis.exe only — no aegis_worker or node_modules processes as siblings

13. Portfolio compliance check — D:\Projects\AEGIS:
    Standard: D:\Meta\PORTFOLIO_OS.md §2–§8
    - STATUS.md: 4-line machine-readable header (Status/Phase/Last Sprint/Last Updated)
    - STATUS.md Open Work: TAURI-02 through TAURI-05 as P0 checkbox items
    - BACKLOG.md: verify exists, add TAURI sprint entries if missing
    - CHANGELOG.md: verify exists, add entries for TAURI-01 and TAURI-02-04

14. Session close:

    FRICTION PASS (before MORNING_BRIEFING):
    Collect all friction from this session — Rust compile errors, sysinfo API mismatches,
    sidecar pkg bundling issues, Tauri event API mismatches, any user corrections.
    Triage: FIX NOW / BACKLOG / LOG ONLY
    Present to user:
      "Session complete. AEGIS v4 cockpit showing live native data.
       Friction: [X] fixable now / [Y] to backlog / [Z] informational
       Fixable now: [list]
       Backlog: [list]
       [A] Fix now + log the rest  ← default
       [B] Just log
       [C] Skip"
    Execute chosen path.

    MORNING_BRIEFING.md — write to D:\Projects\AEGIS\ BEFORE git add:
    Schema: D:\Dev\TEMPLATES\MORNING_BRIEFING_SCHEMA.md
    Sections: SHIPPED, QUALITY GATES, DECISIONS MADE BY AGENT,
    UNEXPECTED FINDINGS, FRICTION LOG, NEXT QUEUE

    git add + commit + push:
    Include: src-tauri/, sidecar/, ui/, STATUS.md, BACKLOG.md, CHANGELOG.md,
             MORNING_BRIEFING.md, commit-msg.txt
    MORNING_BRIEFING.md is included in the commit.
    Commit message via commit-msg.txt. git commit -F commit-msg.txt

CRITICAL CONSTRAINTS:
- cargo check: 0 errors before any cargo tauri dev run. Fix errors before proceeding.
- Shell: cmd (not PowerShell). GREGORE PS profile intercepts node/npm calls.
  All npm/node/cargo commands use shell: "cmd" in Desktop Commander.
- sysinfo 0.33 API: use the exact API from the crate docs — do not assume method names
  match between sysinfo 0.29 and 0.33. Common changes: refresh() signatures changed.
- Tauri 2 API: window.__TAURI__.event.listen() and window.__TAURI__.core.invoke()
  are available in WebView without any script tags. No bundler required for ui/index.html.
  Do NOT add a package.json to the ui/ directory.
- pkg bundling: the sidecar uses CommonJS (tsconfig module: "commonjs"). The intelligence
  engines from v3 were written as ESM (import/export). Either convert the sidecar tsconfig
  to NodeNext + .js extensions, OR convert all intelligence engine imports to require().
  Pick one approach and apply it consistently — do not mix.
- sidecar binary path: MUST be named aegis-sidecar-x86_64-pc-windows-msvc.exe and placed
  at D:\Projects\AEGIS\src-tauri\binaries\. Tauri will not bundle it otherwise.
- Never import from the old src/ directory in sidecar code. All intelligence engine
  files must be copied into sidecar/src/ and imports updated to relative paths.
- MORNING_BRIEFING.md written BEFORE git add. Included in the commit.
- "Sync, commit, and push" = STATUS.md + BACKLOG.md + CHANGELOG.md + MORNING_BRIEFING
  all updated, then git add/commit/push.

Project: D:\Projects\AEGIS
Shell: cmd (not PowerShell). cd /d D:\Projects\AEGIS
Git: D:\Program Files\Git\cmd\git.exe — full path required. Commit via commit-msg.txt.
Cargo: cargo in PATH. Target triple: x86_64-pc-windows-msvc
Node: node in PATH (for sidecar pkg build)
Rust: rustc 1.92.0, cargo 1.92.0

ACCEPTANCE CRITERIA:
  cargo check: 0 errors
  aegis.exe runs as native Windows process (verified via tasklist)
  Tray icon visible in notification area
  Tray menu: 6 profiles listed, profile switching works
  Cockpit window: opens via tray left-click, closes to tray on X
  CPU % in cockpit matches Task Manager within 5%
  RAM in cockpit matches Task Manager within 200MB
  Process list: 20+ processes visible
  Disk card: at least C: drive visible
  Network card: at least 1 adapter visible
  Intelligence sidecar: heartbeat visible in cargo tauri dev output
  Context card: updates from "unknown" after 60+ seconds of use
  Profile switch via tray: cockpit header updates within 3 seconds
  No PowerShell popups, no pm2, no port 8743
  MORNING_BRIEFING.md exists at D:\Projects\AEGIS\
  STATUS.md: TAURI-02-04 closed with commit hash
  CHANGELOG.md: entries for TAURI-01 and TAURI-02-04
