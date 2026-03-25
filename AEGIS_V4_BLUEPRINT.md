# AEGIS v4 — ARCHITECTURE BLUEPRINT
# "The Cognitive Resource OS — Native Edition"
# Status: BLUEPRINT
# Date: 2026-03-24
# Authors: David + Claude

---

## EXECUTIVE SUMMARY

AEGIS was always a native Windows application. The ASCII art installer spec, the
NSIS packaging work, the systray2 tray icon, the pkg .exe compilation — every
original decision pointed at a native app. The v2/v3 builds drifted into a Node.js
HTTP server with a localhost browser cockpit, which is architecturally incorrect for
a cognitive resource OS that needs to control processes, read hardware counters, and
live in the system tray.

This blueprint describes the migration to the architecture AEGIS was always supposed
to be: a Tauri 2 native desktop application with a Rust backend for all system
operations, a TypeScript sidecar for the intelligence layer, and a native WebView
window for the cockpit UI.

The cockpit HTML/CSS/JS built in v3 requires zero changes. The five intelligence
engines (context, sniper, learning, catalog, MCP) transfer intact as a sidecar.
What gets replaced is the scaffolding — the Node.js HTTP server, the PowerShell
worker subprocess, the pm2 daemon, and the elevation dance.

---

## WHY TAURI 2

Task Manager, Process Lasso, HWiNFO64, and every serious Windows system tool is
a native process. They call Win32 APIs directly in-process with the user's token.
No subprocess. No pipe. No handshake. No pm2 session inheritance.

The specific problems that killed v3:
- `sysinfo` / WMI calls needed a PowerShell subprocess because Node.js has no
  native Windows API access
- That subprocess communicated over stdin/stdout pipes
- pm2 daemonizes and inherits the launching user's session token
- Running pm2 from admin cmd spawns a new daemon that conflicts with the old one
- Elevation was therefore structurally impossible without killing all running processes

In Tauri 2:
- Rust backend runs as the Tauri process, inheriting the user's session token
- `sysinfo` crate (83.9M downloads, actively maintained) gives CPU/RAM/disk/network
  without any elevation whatsoever — it reads the same PDH counters Task Manager uses
- `windows` crate gives `SetPriorityClass`, `NtSetInformationProcess`, power plans
  directly in Rust — no subprocess
- System tray is native via Tauri's `tray-icon` feature — no systray2, no pkg snapshot issues
- The cockpit is a native WebView2 window — same HTML, real app window, taskbar presence,
  minimize/maximize, tray-click to show/hide
- NSIS installer is built-in to the Tauri bundler

GregLite is already Tauri 2. The pattern is established. We're not inventing anything new.

---

## ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│  AEGIS.exe  (Tauri 2 process)                                   │
│                                                                  │
│  ┌──────────────────────────────┐  ┌───────────────────────────┐│
│  │  RUST CORE                   │  │  WEBVIEW WINDOW (Cockpit)  ││
│  │                              │  │                            ││
│  │  • sysinfo — CPU/RAM/disk/   │  │  • Task Manager layout     ││
│  │    network/processes         │  │  • Left nav metric cards   ││
│  │    (no elevation needed)     │  │  • Canvas performance      ││
│  │                              │  │    graphs                  ││
│  │  • windows crate —           │  │  • Profile history         ││
│  │    SetPriorityClass          │  │  • Action log              ││
│  │    NtSetInformationProcess   │  │  • Context view            ││
│  │    powercfg power plans      │  │                            ││
│  │    NtSuspendProcess          │  │  invoke() → Rust commands  ││
│  │                              │  │  listen() ← Rust events    ││
│  │  • Tray icon + menu          │  │                            ││
│  │  • Profile switching         │  └───────────────────────────┘│
│  │  • Metric polling loop       │                                │
│  │  • Event emission to UI      │                                │
│  └──────────────────────────────┘                                │
│                        │ stdio IPC                               │
│  ┌─────────────────────▼────────────────────────────────────────┐│
│  │  INTELLIGENCE SIDECAR  (Node.js compiled with pkg)           ││
│  │                                                              ││
│  │  • Context engine (foreground window → context detection)   ││
│  │  • Sniper engine (baseline + deviation + graduated action)  ││
│  │  • Learning store (SQLite, sessions, outcomes, confidence)  ││
│  │  • Cognitive load engine (0-100 composite score)            ││
│  │  • Process catalog (210+ process knowledge base)            ││
│  │  • MCP server (14 tools, KERNL/GregLite callable)           ││
│  │  • Policy manager (composable context overlays)             ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘

System Tray ← icon state driven by Rust core (profile + load tier)
NSIS Installer ← Tauri bundler produces .exe, ASCII art welcome page
Windows Startup ← Task Scheduler entry, runs AEGIS.exe at logon
GregLite / KERNL ← MCP server in sidecar, same 14 tools, same protocol
```

---

## LAYER DEFINITIONS

### Layer 1: Rust Core (replaces Node.js tray + PowerShell worker)

**What it does:**
- System metrics polling every 2 seconds via `sysinfo` crate
  - CPU usage per core + total
  - RAM used/available/total
  - Disk read/write bytes per drive
  - Network sent/recv bytes per adapter
  - Process list: name, PID, parent PID, CPU time, memory, thread count
  - Uptime
- Process control via `windows` crate
  - `SetPriorityClass` — CPU priority (High, AboveNormal, Normal, BelowNormal, Idle)
  - `NtSetInformationProcess` — I/O priority (via ntdll, same as Process Lasso)
  - `NtSuspendProcess` / `NtResumeProcess` — process suspend
  - `SetProcessAffinityMask` — core affinity
- Power plan switching via `powercfg /setactive` (shell out, one-off command)
- System tray: profile name + cognitive load tier shown as tooltip
- Profile switching: reads YAML profiles, applies to process list via Rust calls
- Metric events pushed to WebView every 2 seconds via `app.emit("metrics", payload)`
- Profile switch events pushed to WebView via `app.emit("profile_changed", name)`
- Watchdog: if sidecar dies, restart it; surface warning in tray tooltip

**What it does NOT do:**
- Intelligence. No context detection, no sniper rules, no learning. That is the sidecar.
- Browser tab management. That requires Chrome DevTools Protocol — stays in sidecar.

**Rust crates:**
```toml
sysinfo = "0.33"          # CPU/RAM/disk/network/processes — no elevation
windows = { version = "0.58", features = [
  "Win32_System_Threading",
  "Win32_Foundation",
  "Win32_System_ProcessStatus",
]}
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
tauri = { version = "2", features = ["tray-icon"] }
```

### Layer 2: Intelligence Sidecar (TypeScript → pkg binary)

**What it is:** The entire v3 intelligence layer, compiled with pkg into a standalone
Windows binary, bundled as a Tauri sidecar. The Rust core spawns it at startup and
communicates over JSON-RPC on stdin/stdout — the same IPC pattern the PowerShell
worker used, but now with a process that actually stays alive.

**What transfers from v3 (unchanged):**
- `src/context/engine.ts` — foreground window detection, context classification
- `src/context/policies.ts` — composable policy overlay stack
- `src/sniper/engine.ts` — deviation detection, graduated action dispatch
- `src/sniper/baseline.ts` — Welford online baseline
- `src/learning/store.ts` — SQLite session store
- `src/learning/load.ts` — cognitive load computation
- `src/catalog/manager.ts` — process knowledge base
- `src/mcp/server.ts` — 14-tool MCP publisher
- All YAML profiles

**What changes:**
- `src/tray/lifecycle.ts` → deleted (Rust owns the tray and lifecycle)
- `src/status/server.ts` → deleted (Tauri WebView replaces the HTTP server)
- `src/worker/` → deleted (Rust core replaces the PowerShell worker)
- `src/status/html.ts` → moved to `ui/` as static HTML served by Tauri WebView
- New `src/sidecar-main.ts` — sidecar entry point, JSON-RPC dispatcher

**Sidecar RPC protocol (JSON-RPC 2.0 over stdin/stdout):**
```
Rust → Sidecar (requests):
  intelligence_get_state     → current context, confidence, overlays, cognitive load
  intelligence_get_actions   → recent sniper actions
  intelligence_get_catalog   → process catalog lookup by name/pid
  intelligence_apply_profile → notify sidecar which profile is active
  intelligence_feedback      → user feedback on a sniper action

Sidecar → Rust (events, push):
  context_changed            → new context detected
  load_score_updated         → cognitive load changed significantly
  sniper_action_requested    → sidecar wants Rust to throttle/suspend/kill a PID
  catalog_unknown_process    → a process hit that needs cataloging
```

### Layer 3: WebView Cockpit (HTML/CSS/JS — zero rewrite)

The entire v3 cockpit UI transfers verbatim. Same HTML, same canvas graphs,
same Task Manager layout, same profile history, same action log.

The only change is the data source:
- v3: `fetch('/status')` polling an Express HTTP server every 2 seconds
- v4: `listen('metrics', handler)` receiving Tauri push events from the Rust core
      `invoke('get_intelligence')` for context/sniper/confidence data from sidecar

This is a find-replace in `html.ts` — roughly 20 lines of JavaScript change.

The cockpit opens as a native Tauri window:
- Real title bar with AEGIS name
- Real taskbar entry
- Minimize to tray behavior (window hides, tray icon remains)
- Opened by left-clicking tray icon or "Open Cockpit" tray menu item
- No localhost URL, no browser required

---

## WHAT STAYS, WHAT GOES, WHAT CHANGES

### Stays (zero modification):
- All five intelligence engines and their test coverage
- The process catalog and 210-process seed data
- All YAML profile definitions
- The cockpit HTML layout and visual design
- The MCP server and its 14 tools
- The aegis-config.yaml schema
- All SQLite schemas (learning store, catalog)

### Goes (deleted entirely):
- `src/tray/lifecycle.ts` — replaced by Rust
- `src/status/server.ts` — replaced by Tauri WebView
- `src/worker/` (ipc.ts, manager.ts) — replaced by Rust core
- `scripts/aegis-worker.ps1` — replaced by Rust core
- `ecosystem.config.cjs` — no more pm2
- `build-release.mjs` — replaced by `cargo tauri build`
- `installer/install.ps1` — replaced by Tauri NSIS bundler

### Changes (adapt, not rewrite):
- `src/status/html.ts` — 20-line JS change: fetch() → invoke()/listen()
- `src/sidecar-main.ts` — new entry point replacing lifecycle.ts
- `package.json` — remove Express, systray2; add pkg build step
- Directory structure — new `src-tauri/` Rust project alongside `sidecar/`

---

## DIRECTORY STRUCTURE (TARGET STATE)

```
D:\Projects\AEGIS\
├── src-tauri/                    ← Rust Tauri project (new)
│   ├── src/
│   │   ├── main.rs               ← Tauri entry, tray setup
│   │   ├── metrics.rs            ← sysinfo polling + event emission
│   │   ├── commands.rs           ← tauri::command handlers (process control)
│   │   ├── profiles.rs           ← YAML profile loader + apply logic
│   │   ├── sidecar.rs            ← spawn + communicate with intelligence sidecar
│   │   └── installer.rs          ← Task Scheduler registration at first run
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/default.json
│   ├── icons/                    ← app icons (ICO for Windows)
│   └── binaries/                 ← compiled sidecar binary goes here
│
├── sidecar/                      ← Intelligence sidecar (TypeScript → pkg)
│   ├── src/
│   │   ├── main.ts               ← JSON-RPC entry point
│   │   ├── context/              ← context engine (v3, unchanged)
│   │   ├── sniper/               ← sniper engine (v3, unchanged)
│   │   ├── learning/             ← learning store (v3, unchanged)
│   │   ├── catalog/              ← process catalog (v3, unchanged)
│   │   └── mcp/                  ← MCP server (v3, unchanged)
│   ├── package.json
│   └── tsconfig.json
│
├── ui/                           ← Cockpit HTML (served by Tauri WebView)
│   └── index.html                ← v3 cockpit HTML (minimal JS changes)
│
├── profiles/                     ← YAML profile definitions (unchanged)
├── aegis-config.yaml             ← Global config (unchanged)
└── installer/
    └── aegis.nsi                 ← ASCII art NSIS (adapted for Tauri bundle)
```

---

## INSTALLER SPEC (RESTORED FROM ORIGINAL INTENT)

The installer was always supposed to have ASCII art. The v1 NSIS script had it.
The v3 PowerShell installer had a 6-line block-art AEGIS banner. This is the
correct design for the target audience — power users who know what Process Lasso
is. They respect the aesthetic.

Tauri 2's NSIS bundler supports custom installer pages and welcome text.

Welcome screen (full width monospace):
```
     ██████╗  ██████╗ ██╗███████╗
     ██╔══██╗██╔════╝ ██║██╔════╝
     ███████║██║  ███╗██║███████╗
     ██╔══██║██║   ██║██║╚════██║
     ██║  ██║╚██████╔╝██║███████║
     ╚═╝  ╚═╝ ╚═════╝ ╚═╝╚══════╝
     COGNITIVE RESOURCE OS  v4.0.0
     ─────────────────────────────
     Installing to your machine.
     This will take a moment.
```

Install actions performed:
1. Copy AEGIS.exe to Program Files\AEGIS\
2. Copy intelligence sidecar binary
3. Copy profiles/, aegis-config.yaml
4. Create Task Scheduler entry (logon trigger, normal user token — not elevated)
5. Create Start Menu shortcut
6. Register Add/Remove Programs entry
7. Write AEGIS version to registry

Elevation note: The installer runs elevated (UAC prompt on launch). AEGIS itself
runs at normal user priority. `SetPriorityClass` for *other processes* requires
`PROCESS_SET_INFORMATION` access — which a normal user has for most non-system
processes. The installer does NOT embed a requireAdministrator manifest in AEGIS.exe.
Users who need elevated process control can run AEGIS elevated manually.
This matches how Process Lasso handles it.

---

## SPRINT PLAN

AEGIS-TAURI-01: Scaffold + Rust metrics
  - `cargo tauri init` in D:\Projects\AEGIS
  - Implement metrics.rs with sysinfo (CPU/RAM/disk/network/processes)
  - Implement tray icon + basic menu (profiles + quit)
  - Push metric events to WebView
  - Verify: `pm2 status` shows nothing, AEGIS runs as a real .exe, tray icon appears

AEGIS-TAURI-02: Process control commands
  - Implement commands.rs: set_priority, set_io_priority, suspend, kill, set_affinity
  - Implement profiles.rs: load YAML, apply profile to process list
  - Wire profile switching to tray menu checkmarks
  - Verify: switching to wartime profile actually throttles background processes

AEGIS-TAURI-03: Sidecar integration
  - Move all intelligence engines to sidecar/ directory
  - Implement sidecar-main.ts JSON-RPC entry point
  - Compile to binary with pkg
  - Implement sidecar.rs in Rust: spawn, read events, handle requests
  - Wire sniper action requests from sidecar → Rust process control
  - Verify: context changes, cognitive load score updates, sniper fires correctly

AEGIS-TAURI-04: Cockpit WebView
  - Move v3 cockpit HTML to ui/index.html
  - Replace fetch('/status') with listen('metrics') + invoke('get_intelligence')
  - Wire tray left-click → show/hide window
  - Window: no taskbar entry when hidden, real entry when visible
  - Verify: cockpit shows live data, profile switches reflect immediately

AEGIS-TAURI-05: Installer + hardening
  - Configure Tauri NSIS bundler
  - ASCII art welcome screen
  - Task Scheduler registration on first run
  - Startup-on-logon behavior
  - cargo tauri build → produces AEGIS-Setup-4.0.0.exe
  - Verify: clean install on fresh machine, tray appears at login

---

## WHAT THIS UNLOCKS THAT v3 COULDN'T DO

1. Live process tree — no elevation required. sysinfo reads process list directly.
2. Disk I/O per drive — no WMI, no elevation. sysinfo reads PDH counters.
3. Network per adapter — same.
4. GPU — nvidia-smi query stays (shell out from Rust), but no longer fragile.
5. `SetPriorityClass` actually works — Rust calls it directly in-process.
6. Tray icon is a real Windows tray icon — not systray2 with pkg snapshot issues.
7. Cockpit is a real app window — appears in Alt+Tab, taskbar, Windows search.
8. No pm2, no elevation dance, no daemon session inheritance.
9. Install size: ~15-20MB (Tauri + sidecar binary + profiles) vs 112MB Node+pkg bundle.
10. Startup time: <500ms vs 3-4 second Node.js cold start.

---

## RELATIONSHIP TO GREGLITE

AEGIS v4 is still a standalone application. It does not live inside GregLite.

GregLite calls AEGIS via the MCP server (port TBD, default 57321).
The 14 MCP tools are unchanged. GregLite invokes them the same way.
When a user purchases GregLite, AEGIS ships as a companion installer.
They are separate processes. AEGIS runs whether or not GregLite is open.
GregLite does not manage AEGIS's lifecycle.

This is consistent with the original spec and with the GregLite conversation
where "Option A — embed AEGIS fully" was discussed. That option was for when
GregLite was Tauri. Now that GregLite is browser-native (Sprint 39+), embedding
AEGIS in it doesn't make sense anyway. AEGIS stays standalone. GregLite calls it.

---

## OPEN QUESTIONS BEFORE BUILD

1. Does the intelligence sidecar need to run at startup even when the cockpit
   window is closed? (Answer: yes — context detection should always be running.)
   This means the sidecar is spawned by the Rust core at tray startup, not
   by the WebView. Confirmed by architecture above.

2. MCP server port — currently 8743 is the status server port. MCP server needs
   its own port. Recommend: MCP stays on stdio (KERNL calls it via stdio),
   not HTTP. The current v3 MCP server already uses stdio transport.

3. Windows code signing — the installer should be signed to avoid SmartScreen.
   This is a post-MVP concern. Document the self-signed path for now.

4. GPU monitoring — nvidia-smi shell-out from Rust is fine for NVIDIA.
   AMD/Intel GPU monitoring requires different APIs. Out of scope for v4.0.
