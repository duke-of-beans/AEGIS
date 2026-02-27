# AEGIS v2.0 — Master Blueprint
## Cognitive Resource Manager for the Windows AI Workstation

**Version:** 2.0.0  
**Status:** Pre-build  
**Remote:** https://github.com/duke-of-beans/AEGIS  
**Install target:** D:\Dev\aegis  

---

## Strategic Context

AEGIS is a Windows process resource manager. MVP is focused entirely on optimizing the AI workstation experience — specifically Claude Desktop and its supporting processes (KERNL MCP server, Chrome, VSCode). The architecture is built generically so the product can grow into a full Process Lasso replacement with richer UI, a visual rule editor, gaming profiles, and cross-machine sync without any architectural rework.

**The name "AEGIS" is not baked deeply into the codebase.** All user-facing strings come from config. The core logic is product-name-agnostic. Future rebrand = find/replace in config + swap assets.

**MVP scope:** Tray app, status window, profile switching, worker, watchdog, timer, auto-detection, KERNL/MCP integration, installer.  
**Not in MVP:** Visual rule editor, process list UI, historical graphs, cloud sync, marketplace.

---

## Architecture Overview

```
AEGIS.exe  (pkg-bundled Node.js 20, single executable)
│
├── Tray Process (main)
│   ├── src/main.ts              Entry point, CLI parsing
│   ├── src/tray/index.ts        Tray init, left/right click handlers
│   ├── src/tray/menu.ts         Right-click menu builder (live stats injected)
│   ├── src/tray/lifecycle.ts    Full startup/shutdown orchestration
│   └── src/tray/notifications.ts  Windows toast notifications
│
├── Core Systems
│   ├── src/config/loader.ts     aegis-config.yaml → typed, validated config
│   ├── src/config/types.ts      All TypeScript types for config + state
│   ├── src/config/state.ts      Runtime state (active profile, timer) → state.json
│   ├── src/logger/index.ts      Winston structured logger, dual log files
│   └── src/singleton.ts         Single-instance guard (named mutex)
│
├── Profile System
│   ├── src/profiles/loader.ts   YAML parse + zod validate all profiles
│   ├── src/profiles/manager.ts  Apply/switch/rollback with ordered execution
│   ├── src/profiles/registry.ts All loaded profiles + hot-reload watcher
│   └── src/profiles/timer.ts    Timed profile switching with state persistence
│
├── Worker Bridge
│   ├── src/worker/manager.ts    Worker lifecycle: spawn, crash recovery, heartbeat
│   └── src/worker/ipc.ts        JSON-RPC 2.0 over stdin/stdout
│
├── Engines
│   ├── src/watchdog/engine.ts   Process crash detection + restart
│   ├── src/watchdog/detector.ts Auto-profile detection (process triggers)
│   ├── src/memory/manager.ts    Working set trimmer + standby purger
│   ├── src/power/manager.ts     Power plan control
│   └── src/system/optimizer.ts  Service pause, EcoQoS, temp flush
│
├── Status & Control
│   ├── src/status/server.ts     localhost:8743 HTTP — feeds HTA, MCP, external tools
│   └── src/status/collector.ts  Polls system stats (CPU%, RAM, active processes)
│
├── Integrations
│   ├── src/mcp/server.ts        AEGIS MCP server (port 3742, stdio mode)
│   └── src/mcp/kernl-client.ts  KERNL tag → profile bridge (silent reconnect)
│
├── PowerShell Worker (elevated, separate process)
│   └── scripts/aegis-worker.ps1  JSON-RPC resource control bridge
│
├── Status Window (HTA)
│   └── assets/status.hta        Floating dashboard (HTML Application)
│   └── assets/settings.hta      Settings window (HTML Application)
│   └── assets/status.css        Shared styles
│   └── assets/status.js         HTA logic, API polling, interactions
│
├── Tray Icons
│   └── assets/icons/
│       ├── idle.ico, build-mode.ico, deep-research.ico
│       ├── performance.ico, wartime.ico, presentation.ico
│       ├── warning.ico          (worker offline overlay)
│       └── template.ico         (base for custom profiles)
│
└── Default Profiles
    └── profiles/
        ├── idle.yaml, build-mode.yaml, deep-research.yaml
        ├── performance.yaml, wartime.yaml, presentation.yaml

Installer:
    installer/aegis.nsi
    installer/license.txt

Build:
    package.json
    tsconfig.json
    build-release.mjs
    .eslintrc.cjs
    .github/workflows/ci.yml
    .gitignore
    VERSION
```

---

## Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 20 | Async, systray2 native addon |
| Language | TypeScript 5.3 strict | Zero runtime surprises |
| Tray | systray2 | Battle-tested, native Windows tray |
| Config parse | js-yaml + zod | Parse YAML, validate schema |
| HTTP server | express | Status endpoint, simple |
| Logging | winston + daily-rotate | Structured JSON, rotation built in |
| Bundling | pkg | Single .exe, no visible node.exe |
| Worker | PowerShell 7 | Win32 API access, runs elevated |
| Status UI | HTA (mshta.exe) | Native Windows, no Electron, zero footprint |
| Installer | NSIS | Standard Windows installer, scriptable |
| CI | GitHub Actions | Free, integrates with releases |

---

## Data Flow: Profile Switch

```
User clicks "Wartime" in tray menu
    ↓
tray/menu.ts: onProfileSelect("wartime")
    ↓
profiles/manager.ts: switchProfile("wartime")
    ├── Load profile from registry
    ├── Call worker/ipc.ts: batch set_all_priorities for elevated processes
    ├── Call worker/ipc.ts: batch set_all_priorities for throttled processes  
    ├── Call worker/ipc.ts: set_power_plan "high_performance"
    ├── Call worker/ipc.ts: set_qos_policy for each network rule
    ├── Call system/optimizer.ts: pause services, disable power throttling
    ├── Call memory/manager.ts: preflight trim if configured
    ├── Update config/state.ts: activeProfile = "wartime"
    ├── Rebuild tray menu (new checkmark position)
    ├── Update tray icon to wartime.ico
    └── Notify status/server.ts: push updated snapshot
    ↓
status/server.ts: clients polling /status receive new state within 2s
    ↓
assets/status.hta: UI updates with new profile badge, color accent, process list
```

---

## Data Flow: Auto-Detection

```
watchdog/detector.ts polls process list every 5s
    ↓
For each profile with auto_detect.triggers:
    Check if trigger conditions met against running process names
    ↓
If match found AND current profile != triggered profile
AND manual switch cooldown not active:
    ↓
    mode = "suggest": fire Windows toast notification
        "Switch to Build Mode? [Switch] [Dismiss]"
    mode = "auto": call profiles/manager.ts switchProfile() silently
        + brief toast "Switched to Build Mode (auto)"
    ↓
Anti-flap: if > 3 auto-switches in 10min → pause detector
    toast: "Auto-detection paused. Too many profile changes. [Resume]"
```

---

## File Locations (Runtime)

```
Install dir:    $PROGRAMFILES64\AEGIS\
                ├── AEGIS.exe
                ├── scripts\aegis-worker.ps1
                ├── assets\*.hta, *.css, *.js, icons\*.ico
                └── Uninstall.exe

User data:      %APPDATA%\AEGIS\
                ├── aegis-config.yaml     (user config, never overwritten on upgrade)
                ├── state.json            (runtime state: active profile, timer)
                ├── profiles\             (user's profile YAMLs)
                │   ├── idle.yaml
                │   ├── wartime.yaml
                │   └── [custom].yaml
                └── logs\
                    ├── aegis-tray-YYYY-MM-DD.log
                    └── aegis-worker-YYYY-MM-DD.log
```

---

## Single-Instance Guard

On startup, AEGIS attempts to acquire a Windows named mutex: `Global\AEGIS_SingleInstance`.

- Success → proceed with normal startup
- Failure (already running) → send a signal to the running instance to open the status window, then exit 0

This prevents accidental double-launch from Task Scheduler + manual start.

---

## Startup Sequence

```
1. Acquire single-instance mutex
2. Parse CLI args (--version, --config, --help)
3. Resolve config path (%APPDATA%\AEGIS\aegis-config.yaml)
4. Load + validate config (zod) — fatal if invalid
5. Init logger
6. Load all profile YAMLs from profiles_dir — warn on invalid, skip (don't crash)
7. Start file watcher on profiles_dir (hot-reload)
8. Load runtime state from state.json
9. Start status HTTP server (localhost:8743)
10. Start AEGIS MCP server (port 3742, if enabled)
11. Spawn PowerShell worker — await version handshake (timeout 10s, fatal)
12. Start KERNL tag monitor (silent failures from here)
13. Apply default profile (or resume from state.json if timer was active)
14. Start watchdog engine
15. Start auto-detection engine (if enabled)
16. Register tray icon
17. Build initial tray menu
18. Log: "AEGIS started — profile: [name]"
```

---

## Shutdown Sequence

```
1. Stop auto-detection
2. Stop watchdog
3. Save runtime state to state.json
4. Switch to idle profile (restore defaults)
    ├── Restore all process priorities
    ├── Restore power plan to balanced
    ├── Remove QoS policies
    └── Resume paused services
5. Stop KERNL monitor
6. Stop MCP server
7. Stop status server
8. Send shutdown command to worker → await clean exit (timeout 3s) → kill
9. Release single-instance mutex
10. Log: "AEGIS stopped cleanly"
11. Exit 0
```

---

## Error Handling Philosophy

- **Never crash the tray process.** Catch everything at the top level. Log errors. Show a notification for user-visible failures. Keep running.
- **Worker crash is recoverable.** Restart immediately (up to max_restarts). During restart window, profile switches are queued and replayed after reconnect.
- **Profile apply failure is recoverable.** If a process isn't running, log info and skip (not an error). If a system call fails, log warn and continue with remaining steps.
- **Config load failure is fatal.** Can't operate without valid config. Show error dialog, write crash log, exit.
- **Profile YAML parse failure is non-fatal.** Log warn, skip that profile, continue with the rest.

---

## Versioning

`package.json` is the single source of version truth.  
`build-release.mjs` stamps the version into `VERSION` file and NSIS installer.  
GitHub Actions creates a release tag matching the version on every main push.

