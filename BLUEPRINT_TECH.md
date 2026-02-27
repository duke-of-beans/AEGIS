# AEGIS v2.0 — Technical Build Specification
## Module interfaces, schemas, APIs, worker commands — everything Cowork needs to build

---

## TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "release"]
}
```

**Zero TypeScript errors is a hard build gate.** CI fails on any error.

---

## Config Schema (aegis-config.yaml)

Full typed schema. All fields validated by zod on startup.

```yaml
version: "2.0"

# Profile shown on startup and after timer/auto-detection
default_profile: idle

# Order profiles appear in tray menu and status window
# Any profile not listed here is appended alphabetically
profile_order:
  - idle
  - build-mode
  - deep-research
  - performance
  - wartime
  - presentation

profiles_dir: "%APPDATA%\\AEGIS\\profiles"

status_window:
  enabled: true
  port: 8743
  auto_open_on_launch: false
  prefetch_on_tray_hover: true   # start loading stats before window opens

mcp_server:
  enabled: true
  port: 3742

kernl:
  enabled: true
  port: 3001
  host: "localhost"
  reconnect_interval_sec: 5      # initial backoff
  reconnect_max_sec: 300         # caps at 5 minutes
  silent_failures: true          # log at debug level only (no error spam)

auto_detect:
  enabled: false
  mode: suggest                  # suggest | auto
  debounce_sec: 30               # how long triggers must be true before acting
  cooldown_min: 15               # pause auto-detect this long after manual switch
  anti_flap_max_switches: 3      # pause if more than N switches in...
  anti_flap_window_min: 10       # ...this many minutes

worker:
  transport: stdio               # stdio | named_pipe
  heartbeat_interval_sec: 30     # worker sends heartbeat every N seconds
  heartbeat_timeout_sec: 45      # restart if no heartbeat for N seconds
  max_restarts: 10               # before giving up and showing fatal error
  restart_delay_sec: 2

logging:
  level: info                    # debug | info | warn | error
  log_dir: "%APPDATA%\\AEGIS\\logs"
  rotate: daily
  max_files: 30

notifications:
  profile_switch: false
  timer_expired: true
  watchdog_restart: true
  worker_crash: true
  kernl_state_change: false

startup:
  task_name: "AEGIS_Startup"

# Always-on rules (independent of profiles) — MVP: YAML only
# rules:
#   - name: "Example rule"
#     process: OneDrive.exe
#     cpu_priority: idle
#     io_priority: background
#     permanent: true
```

---

## Profile Schema (per-profile YAML)

```yaml
profile:
  name: wartime                          # machine identifier (filename must match)
  display_name: "Wartime"               # shown in UI
  description: "Everything runs full speed. Claude, Chrome, builds get top priority."
  icon: wartime                         # maps to assets/icons/{icon}.ico
  color: "#ef4444"                      # hex, used in status window accent

  power_plan: high_performance          # high_performance | balanced | power_saver | {GUID}

  # Optional: process triggers for auto-detection
  auto_detect:
    triggers:
      - process: Claude.exe
      - process: chrome.exe
    require_all: false                  # false=any match, true=all must be running
    mode: suggest                       # suggest | auto (overrides global setting)

  # Optional: PowerShell scripts to run on switch
  on_activate:
    script: null                        # path to .ps1 or null
  on_deactivate:
    script: null

  elevated_processes:
    - name: Claude.exe
      cpu_priority: high                # high | above_normal | normal | below_normal | idle
      io_priority: high                 # high | normal | low | background
      memory_priority: high            # high | above_normal | normal | below_normal | idle
      cpu_affinity: null               # null=all cores | "0,1,2,3" | bitmask integer
      disable_power_throttling: true   # true=disable EcoQoS for this process

    - name: chrome.exe
      cpu_priority: high
      io_priority: high
      memory_priority: normal
      cpu_affinity: null
      disable_power_throttling: true

    - name: node.exe
      cpu_priority: high
      io_priority: high
      memory_priority: normal
      cpu_affinity: null
      disable_power_throttling: true

    - name: Code.exe
      cpu_priority: above_normal
      io_priority: normal
      memory_priority: normal
      cpu_affinity: null
      disable_power_throttling: false

  throttled_processes:
    - name: OneDrive.exe
      cpu_priority: idle
      io_priority: background
      memory_priority: idle
      cpu_affinity: null
      disable_power_throttling: false

    - name: SearchIndexer.exe
      cpu_priority: idle
      io_priority: background
      memory_priority: idle
      cpu_affinity: null
      disable_power_throttling: false

    - name: MsMpEng.exe
      cpu_priority: idle
      io_priority: background
      memory_priority: idle
      cpu_affinity: null
      disable_power_throttling: false

    - name: Teams.exe
      cpu_priority: idle
      io_priority: background
      memory_priority: below_normal
      cpu_affinity: null
      disable_power_throttling: false

  network_qos:
    - app: Claude.exe
      priority: critical
      dscp: 46
    - app: chrome.exe
      priority: critical
      dscp: 46
    - app: node.exe
      priority: high
      dscp: 34
    - app: OneDrive.exe
      priority: background
      dscp: 8
    - app: Teams.exe
      priority: background
      dscp: 8

  watchdog:
    - process: Claude.exe
      restart_on_crash: true
      restart_delay_sec: 2
      max_restarts: 5
      backoff: exponential              # fixed | exponential
      pre_restart_script: null
      post_restart_script: null
    - process: node.exe
      restart_on_crash: true
      restart_delay_sec: 1
      max_restarts: 10
      backoff: fixed
      pre_restart_script: null
      post_restart_script: null

  memory:
    trim_background_working_sets: true
    trim_interval_min: 3
    low_memory_threshold_mb: 3072      # trigger trim when free RAM below this
    preflight_trim_on_activate: true   # trim immediately on profile switch

  system:
    purge_standby_memory: true
    standby_purge_interval_min: 5
    reenforce_priorities: true         # re-apply priorities on interval (new processes)
    reenforce_interval_sec: 60
    pause_services:
      - WSearch
      - SysMain
      - DiagTrack
    disable_power_throttling: true     # system-wide EcoQoS opt-out for elevated procs
    flush_temp_on_activate: true
```

---

## Runtime State (state.json)

Written to `%APPDATA%\AEGIS\state.json` every 30 seconds and on clean shutdown.

```json
{
  "version": "2.0",
  "active_profile": "wartime",
  "previous_profile": "idle",
  "profile_history": [
    { "profile": "idle",     "switched_at": "2026-02-26T14:00:00Z" },
    { "profile": "build-mode", "switched_at": "2026-02-26T15:30:00Z" },
    { "profile": "wartime",  "switched_at": "2026-02-26T21:00:00Z" }
  ],
  "timer": {
    "active": true,
    "target_profile": "wartime",
    "return_profile": "idle",
    "started_at": "2026-02-26T21:00:00Z",
    "duration_min": 90,
    "expires_at": "2026-02-26T22:30:00Z"
  },
  "auto_detect": {
    "paused": false,
    "paused_at": null,
    "manual_override_until": null
  },
  "worker": {
    "last_heartbeat": "2026-02-26T21:45:00Z",
    "restart_count": 0
  }
}
```

On startup: if `timer.active === true` and `expires_at` is in the past → switch to `return_profile` immediately. If in the future → resume countdown.

---

## Status HTTP Server API (localhost:8743)

### GET /status
Full system snapshot. Polled by HTA every 2 seconds.

```json
{
  "aegis": {
    "version": "2.0.0",
    "uptime_sec": 3620
  },
  "profile": {
    "active": "wartime",
    "display_name": "Wartime",
    "color": "#ef4444",
    "icon": "wartime"
  },
  "system": {
    "cpu_percent": 72.4,
    "ram_used_mb": 8704,
    "ram_total_mb": 16384,
    "ram_percent": 53.1,
    "power_plan": "High Performance",
    "power_plan_guid": "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"
  },
  "processes": {
    "elevated": [
      { "name": "Claude.exe",   "cpu_priority": "High",        "io_priority": "High",       "running": true  },
      { "name": "chrome.exe",   "cpu_priority": "High",        "io_priority": "High",       "running": true  },
      { "name": "node.exe",     "cpu_priority": "High",        "io_priority": "High",       "running": false }
    ],
    "throttled": [
      { "name": "OneDrive.exe", "cpu_priority": "Idle",        "io_priority": "Background", "running": true  },
      { "name": "MsMpEng.exe",  "cpu_priority": "Idle",        "io_priority": "Background", "running": false }
    ]
  },
  "health": {
    "worker": "online",      // online | restarting | failed
    "kernl": "offline",      // connected | offline
    "mcp": "running"         // running | stopped
  },
  "timer": {
    "active": false,
    "target_profile": null,
    "return_profile": null,
    "remaining_sec": null,
    "expires_at": null
  },
  "history": [
    { "profile": "build-mode", "display_name": "Build Mode", "switched_at": "2026-02-26T15:30:00Z" },
    { "profile": "wartime",    "display_name": "Wartime",    "switched_at": "2026-02-26T21:00:00Z" }
  ]
}
```

### GET /profiles
```json
[
  { "name": "idle",         "display_name": "Idle",         "description": "...", "color": "#6b7280", "active": false },
  { "name": "wartime",      "display_name": "Wartime",      "description": "...", "color": "#ef4444", "active": true  }
]
```

### POST /switch
Request: `{ "profile": "build-mode" }`  
Response: `{ "success": true, "profile": "build-mode" }` or `{ "success": false, "error": "Profile not found" }`

### POST /timer/set
Request: `{ "profile": "wartime", "duration_min": 90 }`  
Response: `{ "success": true, "expires_at": "2026-02-26T22:30:00Z" }`

### POST /timer/cancel
Request: `{}`  
Response: `{ "success": true }`

### GET /health
Response: `{ "alive": true, "version": "2.0.0" }`

---

## AEGIS MCP Server (port 3742)

Runs in stdio mode for Claude Desktop integration (pass `--mcp` flag).  
Also runs in HTTP mode on port 3742 for KERNL.

### Tools:

**aegis_status**
```
Description: Get current AEGIS system status including active profile, CPU/RAM usage, and health indicators.
Parameters: none
Returns: Same schema as GET /status
```

**aegis_switch_profile**
```
Description: Switch to a different resource profile.
Parameters:
  profile (string, required): Profile name to switch to
Returns: { success: boolean, profile: string, error?: string }
```

**aegis_list_profiles**
```
Description: List all available AEGIS profiles.
Parameters: none
Returns: Array of { name, display_name, description, color, active }
```

**aegis_set_timer**
```
Description: Switch to a profile for a set duration, then automatically return to the current profile.
Parameters:
  profile (string, required): Profile to switch to
  duration_min (number, required): Duration in minutes (1-480)
Returns: { success: boolean, expires_at: string }
```

**aegis_cancel_timer**
```
Description: Cancel the active profile timer and return to the previous profile.
Parameters: none
Returns: { success: boolean }
```

---

## Worker JSON-RPC Commands (complete)

All requests: `{ "jsonrpc": "2.0", "id": "string", "method": "command_name", "params": {...} }`  
All responses: `{ "jsonrpc": "2.0", "id": "string", "result": {...} }` or `{ "error": {...} }`

The worker handles missing `params` safely (does NOT throw under Set-StrictMode).

### ping
`params`: none  
`result`: `{ pong: true, timestamp: string, pid: number, version: string, ps_version: string }`

### get_version
`params`: none  
`result`: `{ version: "2.0.0", ps_version: "7.4.0", started_at: string }`

### set_cpu_priority
`params`: `{ processName: string, priority: "high"|"above_normal"|"normal"|"below_normal"|"idle" }`  
`result`: `{ success: boolean, processesAffected: number, errors: string[] }`

### set_io_priority
`params`: `{ processName: string, priority: "high"|"normal"|"low"|"background" }`  
`result`: `{ success: boolean, processesAffected: number, errors: string[] }`

### set_memory_priority
`params`: `{ processName: string, priority: "high"|"above_normal"|"normal"|"below_normal"|"idle" }`  
`result`: `{ success: boolean, processesAffected: number, errors: string[] }`

### set_affinity
`params`: `{ processName: string, affinity: string|null }`  — null = all cores  
`result`: `{ success: boolean, processesAffected: number, affinityMask: string, errors: string[] }`

### set_power_throttling
`params`: `{ processName: string, disable: boolean }`  
`result`: `{ success: boolean, processesAffected: number, errors: string[] }`

### set_all_priorities (NEW — batch, reduces IPC round-trips)
`params`: `{ processName: string, cpuPriority: string, ioPriority: string, memoryPriority: string, disablePowerThrottling: boolean }`  
`result`: `{ success: boolean, processesAffected: number, cpu: object, io: object, memory: object, errors: string[] }`

### trim_working_set
`params`: `{ processName: string }`  
`result`: `{ success: boolean, processesAffected: number, memoryFreedBytes: number, errors: string[] }`

### set_power_plan
`params`: `{ plan: "high_performance"|"balanced"|"power_saver"|string }` — string = GUID  
`result`: `{ success: boolean, plan: string, guid: string }`

### get_active_power_plan (NEW)
`params`: none  
`result`: `{ guid: string, name: string }`

### set_qos_policy
`params`: `{ policyName: string, app: string, priority: "critical"|"high"|"normal"|"background", dscp?: number }`  
`result`: `{ success: boolean, policyName: string, dscp: number }`

### remove_qos_policies
`params`: `{ prefix?: string }` — default prefix "AEGIS_"  
`result`: `{ success: boolean, policiesRemoved: number, errors: string[] }`

### list_qos_policies (NEW)
`params`: `{ prefix?: string }`  
`result`: `{ policies: Array<{ name: string, app: string, dscp: number }> }`

### get_system_stats
`params`: none  
`result`: `{ cpu: { loadPercent: number }, memory: { totalMB, usedMB, freeMB, usedPercent }, activePowerPlan: string, timestamp: string }`

### get_process_list
`params`: `{ processNames: string[] }`  
`result`: `{ processes: Array<{ name, pid, running, cpuPriority, workingSetMB, executablePath }>, timestamp: string }`

### start_process
`params`: `{ executablePath: string, workingDirectory?: string, arguments?: string[] }`  
`result`: `{ success: boolean, pid?: number, error?: string }`

### run_script
`params`: `{ scriptPath: string, arguments?: string[] }`  
`result`: `{ success: boolean, exitCode: number, output: string, error?: string }`

### purge_standby_memory
`params`: none  
`result`: `{ success: boolean, ntstatus: number }`

### manage_service
`params`: `{ serviceName: string, action: "start"|"stop" }`  — allowlist enforced  
`result`: `{ success: boolean, status: string, previousStatus: string }`

### set_power_throttling
`params`: `{ processName: string, disable: boolean }`  
`result`: `{ success: boolean, processesAffected: number, errors: string[] }`

### flush_temp_files
`params`: none  
`result`: `{ success: boolean, filesRemoved: number, freedMB: number, errors: string[] }`

### shutdown (NEW)
`params`: none  
`result`: `{ success: true }` — worker then exits cleanly

---

## Worker Heartbeat Protocol

Worker sends unsolicited heartbeat frames to stdout every 30 seconds:
```json
{ "type": "heartbeat", "timestamp": "2026-02-26T21:00:00Z", "pid": 12345 }
```

Manager side (worker/manager.ts):
- Tracks `lastHeartbeat` timestamp
- Polls every 5 seconds: if `Date.now() - lastHeartbeat > 45000` → restart worker
- On restart: logs `warn`, sends watchdog toast notification

---

## Profile Apply Order

When switching profiles, operations execute in this exact order to avoid conflicts:

```
1. Run on_deactivate script (previous profile), if any
2. Remove all AEGIS QoS policies (clean slate)
3. Resume any paused services (from previous profile)
4. Re-enable power throttling on all previously throttled processes
5. Set power plan to new profile's power_plan
6. Apply throttled_processes (CPU, IO, memory, affinity, power throttling)
7. Apply elevated_processes (CPU, IO, memory, affinity, power throttling)
8. Apply network_qos policies
9. Pause services defined in system.pause_services
10. If memory.preflight_trim_on_activate: trim elevated process working sets
11. If system.flush_temp_on_activate: flush temp files
12. Update watchdog engine with new profile's watchdog rules
13. Update auto-detect engine with new profile's trigger rules
14. Save state.json
15. Update tray icon + menu
16. Run on_activate script (new profile), if any
17. Log profile switch at info level
```

---

## Build Release Script (build-release.mjs)

```javascript
// Orchestrates everything needed before makensis

import { execSync } from 'child_process'
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const VERSION = pkg.version

// 1. Clean and create release/
rmSync('release', { recursive: true, force: true })
mkdirSync('release/dist', { recursive: true })
mkdirSync('release/scripts', { recursive: true })
mkdirSync('release/assets/icons', { recursive: true })
mkdirSync('release/profiles', { recursive: true })

// 2. Copy compiled dist
cpSync('dist', 'release/dist', { recursive: true })

// 3. Copy scripts (PowerShell worker)
copyFileSync('scripts/aegis-worker.ps1', 'release/scripts/aegis-worker.ps1')

// 4. Copy assets (HTA, icons)
cpSync('assets', 'release/assets', { recursive: true })

// 5. Copy default profiles
cpSync('profiles', 'release/profiles', { recursive: true })

// 6. Copy config template
copyFileSync('aegis-config.yaml', 'release/aegis-config.yaml')

// 7. Stamp VERSION file
writeFileSync('release/VERSION', VERSION)

// 8. Copy launcher scripts
copyFileSync('AEGIS-silent.vbs', 'release/AEGIS-silent.vbs')

// 9. pkg: bundle Node.js + dist into single AEGIS.exe
execSync(`npx pkg dist/main.js --target node20-win-x64 --output release/AEGIS.exe`, { stdio: 'inherit' })

// 10. Copy node_modules for scripts that need them (none in v2 — worker is pure PS1)

console.log(`Release built: v${VERSION}`)
```

---

## Installer (installer/aegis.nsi) — Key Sections

```nsis
Unicode True
SetCompressor /SOLID lzma

!define APP_NAME        "AEGIS"
!define APP_VERSION     "2.0.0"         ; stamped by build-release.mjs
!define APP_PUBLISHER   "David K"
!define RELEASE_DIR     "..\release"

; 64-BIT PROGRAM FILES — never the (x86) directory
InstallDir "$PROGRAMFILES64\${APP_NAME}"

; DEV GUARD — refuse install to source directories
Function .onVerifyInstDir
  StrStr $0 $INSTDIR "\Dev\"
  StrCmp $0 "" check2 devError
  check2:
  StrStr $0 $INSTDIR "\dev\"
  StrCmp $0 "" check3 devError
  check3:
  StrStr $0 $INSTDIR "\source\"
  StrCmp $0 "" done devError
  devError:
    MessageBox MB_ICONSTOP "Cannot install AEGIS to a development directory.$\r$\nThis would overwrite your source code.$\r$\n$\r$\nPlease choose a different install location."
    Abort
  done:
FunctionEnd

; PROFILE INSTALL STRATEGY
; Fresh install: copy all. Upgrade: copy missing only.
Section "User Data" SecData
  ${IfNot} ${FileExists} "$APPDATA\${APP_NAME}\aegis-config.yaml"
    ; Fresh install
    CreateDirectory "$APPDATA\${APP_NAME}\profiles"
    CreateDirectory "$APPDATA\${APP_NAME}\logs"
    SetOutPath "$APPDATA\${APP_NAME}"
    File "${RELEASE_DIR}\aegis-config.yaml"
    SetOutPath "$APPDATA\${APP_NAME}\profiles"
    File /r "${RELEASE_DIR}\profiles\*.*"
  ${Else}
    ; Upgrade — only copy profiles that don't already exist
    SetOutPath "$APPDATA\${APP_NAME}\profiles"
    !macro CopyIfMissing profile
      ${IfNot} ${FileExists} "$APPDATA\${APP_NAME}\profiles\${profile}.yaml"
        File "${RELEASE_DIR}\profiles\${profile}.yaml"
      ${EndIf}
    !macroend
    !insertmacro CopyIfMissing idle
    !insertmacro CopyIfMissing build-mode
    !insertmacro CopyIfMissing deep-research
    !insertmacro CopyIfMissing performance
    !insertmacro CopyIfMissing wartime
    !insertmacro CopyIfMissing presentation
  ${EndIf}
SectionEnd

; UNINSTALLER — ask about user data
Section "Uninstall"
  ; Kill running AEGIS
  ExecWait 'taskkill /f /im AEGIS.exe'
  
  ; Remove scheduled task
  ExecWait 'powershell.exe -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\scripts\remove-task.ps1"'
  
  ; Remove install dir
  RMDir /r "$INSTDIR"
  
  ; Remove Start Menu
  RMDir /r "$SMPROGRAMS\${APP_NAME}"
  
  ; Remove registry
  DeleteRegKey HKLM "${REG_KEY}"
  
  ; Ask about user data
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Delete your AEGIS configuration and profiles?$\r$\n$\r$\n\
    Choosing No preserves your profiles and settings at:$\r$\n\
    $APPDATA\AEGIS" \
    IDNO done
  RMDir /r "$APPDATA\${APP_NAME}"
  done:
SectionEnd
```

---

## GitHub Actions (/.github/workflows/ci.yml)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint

  build-and-release:
    needs: check
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build:ts
      - run: node build-release.mjs
      - name: Install NSIS
        run: choco install nsis -y
      - name: Build installer
        run: makensis installer/aegis.nsi
      - name: Get version
        id: version
        run: echo "version=$(node -e "console.log(require('./package.json').version)")" >> $env:GITHUB_OUTPUT
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: v${{ steps.version.outputs.version }}
          name: AEGIS v${{ steps.version.outputs.version }}
          files: AEGIS-Setup-${{ steps.version.outputs.version }}.exe
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## .gitignore

```
node_modules/
dist/
release/
*.exe
!installer/
*.log
.env
state.json
```

---

## Default Profiles to Ship

Six profiles in `profiles/` directory. All following the schema above.

1. **idle.yaml** — power_plan: balanced. No elevated/throttled. Minimal watchdog. Services running. This is the "do nothing" state.

2. **build-mode.yaml** — Claude.exe + Code.exe + node.exe elevated. OneDrive/Teams throttled. high_performance power. WSearch + SysMain paused.

3. **deep-research.yaml** — Claude.exe + chrome.exe + firefox.exe elevated. Teams/OneDrive throttled. high_performance. Aggressive memory management. Network QoS critical for Claude + Chrome.

4. **performance.yaml** — General high-performance mode. No specific app focus. EcoQoS disabled system-wide. All background services throttled.

5. **wartime.yaml** — Everything in elevated_processes gets maximum priority. Maximum services paused. Aggressive temp flush. Most aggressive profile.

6. **presentation.yaml** — OBS.exe + chrome.exe elevated. All notifications suppressed (system.suppress_notifications: true — add this field). Balanced power (we want predictable, not maximum). Watchdog for OBS.

