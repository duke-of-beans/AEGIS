# AEGIS v2.0 — Blueprint
## Cognitive Resource Manager for the Windows AI Workstation

---

## Why v2 Exists

v1 worked but had compounding problems that turned a routine uninstall into a catastrophe:
- Installed to `Program Files (x86)` (32-bit directory) despite being a 64-bit app
- Profiles only copied on first install — upgrade path silently broken
- Worker crashed on any JSON-RPC request missing a `params` field (strict mode bug)
- No install-location guard — dev source directory was a valid install target
- No settings UI — all config required editing raw YAML
- No live status — tray was opaque, no way to see what was actually happening
- KERNL reconnect spammed logs every 30s with errors, hiding real problems
- systray2 crash with exit code `0x40010004` was treated as fatal restart-loop

v2 is a complete rewrite that fixes all of this and makes AEGIS meaningfully better.

---

## Core Philosophy

AEGIS is a **cognitive resource governor**, not a task manager replacement. Its job is to
ensure your machine dedicates its full capability to whatever you're doing right now — and
gets out of the way of everything else. It should be invisible when working and immediately
useful when you need it.

**Design laws:**
1. Never install to a directory the user would naturally edit or delete
2. Never require YAML editing for any common task
3. Never crash silently — log everything, expose it visibly
4. Never fight the system — work with Windows APIs, not against them
5. Profile switching must feel instant (<200ms perceived)
6. The tray icon must communicate system state at a glance

---

## What's New in v2

### 1. Live Status Window (the biggest addition)
Left-clicking the tray icon opens a small floating status panel near the system tray:

```
┌──────────────────────────────────────┐
│  ⚡ AEGIS v2.0             [—] [×]  │
├──────────────────────────────────────┤
│  Profile:  ◉ WARTIME                │
│  ─────────────────────────────────  │
│  CPU   ████████████░░░░  72%         │
│  RAM   ████████░░░░░░░░  54%  8.7G  │
│  ─────────────────────────────────  │
│  Power:   High Performance           │
│  Worker:  ● Online                  │
│  KERNL:   ● Connected               │
│  ─────────────────────────────────  │
│  ELEVATED                           │
│  Claude.exe   CPU:High  IO:High     │
│  chrome.exe   CPU:High  IO:High     │
│  node.exe     CPU:High  IO:High     │
│  ─────────────────────────────────  │
│  THROTTLED                          │
│  OneDrive.exe   CPU:Idle  IO:BG     │
│  MsMpEng.exe    CPU:Idle  IO:BG     │
│  ─────────────────────────────────  │
│  [idle] [build] [research] [more↓]  │
│  ─────────────────────────────────  │
│  ⏱ Timer: Off          [Set Timer] │
└──────────────────────────────────────┘
```

Implemented as a native Windows HTA (HTML Application) — no Electron, no browser window,
no 150MB runtime. mshta.exe runs a local HTML/CSS/JS file as a frameless floating window.
Stats served by a tiny embedded HTTP server (localhost:8743) that the HTA polls every 2s.

### 2. Better Tray Menu
Right-click menu now shows:
- Current profile with ✓ checkmark
- Live CPU%/RAM% in the menu header  
- All profiles with descriptions on hover
- Separator + Settings + About + Quit

### 3. Animated Tray Icon Per Profile
Each profile has its own tray icon color:
- idle: gray
- deep-research: blue
- build-mode: green  
- performance: yellow
- wartime: red
- presentation: purple
Custom profiles: auto-assigned from a color palette

### 4. Profile Timer
From the status window or tray menu: "Switch to Wartime for 2 hours, then back to idle."
Timer state persists across worker restarts (stored in config).

### 5. Auto-Profile Detection (opt-in)
When enabled, AEGIS watches running processes and suggests (or automatically switches)
profiles based on what's active:
- Claude.exe + Code.exe running → suggest build-mode
- OBS.exe running → suggest presentation
- Idle for 10 min → switch to idle

### 6. Silent KERNL Reconnect
KERNL failures are silent in logs (debug level only). No more 30s error spam.
Exponential backoff from 5s to 5min. UI shows "KERNL: ● Offline" in status window.

### 7. Named-Pipe IPC Option
Worker can use named pipes instead of stdin/stdout (opt-in via config). More reliable
for crash recovery scenarios. Defaults to stdin/stdout (battle-tested).

### 8. Proper Single EXE
Built with `pkg` to a single `AEGIS.exe`. No .cmd launcher. No node.exe in the install dir.
Reduces install size by ~40MB (no bundled node_modules as separate files).

### 9. Installer: 64-bit path + Always-update profiles
- Installs to `$PROGRAMFILES64\AEGIS` (was `$PROGRAMFILES\AEGIS` = 32-bit dir)
- Profiles: on fresh install, copy all defaults. On upgrade, copy NEW profiles only
  (don't overwrite user-modified ones). User can reset to defaults via UI.
- Dev guard: if `$INSTDIR` matches source repo path, installer aborts with error message.

### 10. GitHub Actions CI
On every push to main:
- TypeScript compile check (0 errors required)
- ESLint pass
- Build release
- Create GitHub Release with installer .exe attached

---

## Architecture

```
AEGIS.exe (pkg-bundled Node.js)
├── src/tray/index.ts        — Bootstrap, lifecycle owner
├── src/tray/menu.ts         — Right-click menu builder (live stats)
├── src/tray/status-window.ts — Left-click HTA window launcher
├── src/tray/lifecycle.ts    — Startup/shutdown orchestration
├── src/profiles/
│   ├── loader.ts            — YAML parse + validate
│   ├── manager.ts           — Apply/switch/rollback
│   ├── registry.ts          — All loaded profiles + history
│   └── timer.ts             — Timed profile switching
├── src/worker/
│   ├── manager.ts           — Worker lifecycle + crash recovery
│   └── ipc.ts               — JSON-RPC over stdin/stdout
├── src/watchdog/
│   ├── engine.ts            — Process restart watchdog
│   └── detector.ts          — Auto-profile detection (opt-in)
├── src/status/
│   └── server.ts            — localhost:8743 JSON stats endpoint
├── src/mcp/
│   ├── server.ts            — AEGIS MCP server (expose profiles/stats)
│   └── kernl-client.ts      — KERNL tag → profile bridge (silent)
├── src/memory/manager.ts    — Working set trimmer
├── src/power/manager.ts     — Power plan control
├── src/system/optimizer.ts  — Service pause/throttling/EcoQoS
├── src/logger/index.ts      — Winston logger (daily rotate)
├── src/config/
│   ├── loader.ts            — aegis-config.yaml → typed config
│   └── types.ts             — Full config type definitions
└── scripts/
    └── aegis-worker.ps1     — JSON-RPC resource control bridge

assets/
├── icons/                   — Profile-colored tray icons
│   ├── idle.ico
│   ├── build-mode.ico
│   ├── deep-research.ico
│   ├── performance.ico
│   ├── wartime.ico
│   └── presentation.ico
└── status.hta               — Floating status window (HTML Application)

profiles/                    — Default profiles shipped with installer
installer/
└── aegis.nsi

build-release.mjs
package.json
tsconfig.json
.github/workflows/ci.yml
```

---

## Profile Schema v2

Profiles gain two new optional fields:

```yaml
profile:
  name: wartime
  display_name: "Wartime"
  description: "..."
  icon: wartime          # maps to assets/icons/wartime.ico
  color: "#e53e3e"       # status window accent color (NEW)
  power_plan: high_performance
  auto_detect:           # NEW — optional process triggers
    triggers:
      - process: Claude.exe
      - process: Code.exe
    require_all: false   # any trigger = match
  
  elevated_processes: [...]
  throttled_processes: [...]
  network_qos: [...]
  watchdog: [...]
  memory: {...}
  system: {...}
```

---

## Config Schema v2

```yaml
version: "2.0"
default_profile: idle
install_dir: "%PROGRAMFILES%\\AEGIS"    # auto-populated by installer

status_window:
  enabled: true
  port: 8743
  auto_open_on_launch: false

auto_detect:
  enabled: false                         # opt-in
  mode: suggest                          # suggest | auto
  debounce_sec: 30

kernl:
  enabled: true
  port: 3001
  host: localhost
  reconnect_interval_sec: 5
  reconnect_max_sec: 300                 # caps at 5min (was fixed 30s)
  silent_failures: true                  # NEW — no error spam

profiles_dir: "%APPDATA%\\AEGIS\\profiles"

logging:
  level: info
  log_dir: "%APPDATA%\\AEGIS\\logs"
  rotate: daily
  max_files: 30

notifications:
  tray_alerts: true
  profile_switch: false
  watchdog_escalation: true
```

---

## Worker Improvements

1. **params bug fixed** — strict mode safe property access on every request
2. **Named pipe mode** — optional, configured via `worker.transport: named_pipe`
3. **Heartbeat** — worker sends ping every 30s, manager restarts if missed
4. **Version handshake** — worker reports version on startup, manager validates

---

## Installer Improvements

```nsis
; Install to 64-bit Program Files
InstallDir "$PROGRAMFILES64\${APP_NAME}"

; Dev guard — refuse install to known dev paths
${If} $INSTDIR == "D:\Dev\aegis"
  MessageBox MB_ICONSTOP "Cannot install AEGIS to its source directory.$\n$\nPlease choose a different install location."
  Abort
${EndIf}

; Profile sync strategy:
; - Fresh install: copy all defaults
; - Upgrade: copy only profiles that don't exist yet (preserve user edits)
;   But if /FORCEPROFILES flag set: overwrite all
```

---

## Status: BUILDING
Version: 2.0.0
Started: 2026-02-26
