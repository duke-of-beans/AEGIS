# AEGIS v2.0 — Cowork Build Prompt

## What you are building

AEGIS is a Windows system tray application that manages CPU/IO/memory priorities, power plans, and network QoS policies for running processes — with the goal of making AI workstations (specifically Claude Desktop) run at full capacity while deprioritizing background noise. It is architecturally a generic process resource manager; the Claude focus is the MVP vertical only.

## Repository

**Remote:** https://github.com/duke-of-beans/AEGIS  
**Local:** D:\Dev\aegis  
**Git is initialized. Remote is set. Build from D:\Dev\aegis.**

## Blueprint documents (read ALL of these before writing any code)

All three blueprints are at D:\Dev\aegis\ — READ THEM COMPLETELY before starting:

- `BLUEPRINT_MASTER.md` — architecture overview, file structure, startup/shutdown sequences, data flows, error handling philosophy
- `BLUEPRINT_UI.md` — every UI surface: tray icon states, tray menu, status window (section by section), settings window (tab by tab), toast notifications, UX principles
- `BLUEPRINT_TECH.md` — TypeScript config, config schema, profile schema, runtime state schema, HTTP API spec, MCP tools, worker commands (complete), profile apply order, build script, installer key sections, CI config, default profiles

## Technology stack

- Node.js 20 + TypeScript 5.3 strict mode
- systray2 (tray), express (status server), js-yaml + zod (config), winston (logging), pkg (bundle to single .exe)
- PowerShell 7 worker (elevated, JSON-RPC over stdin/stdout)
- HTA (mshta.exe) for status window and settings window — NOT Electron, NOT a browser
- NSIS installer

## Parallel agent assignments

Assign agents to build simultaneously:

### Agent 1: TypeScript Core
Build all files in `src/`:
- `src/main.ts` — entry point, CLI parsing (--version, --help, --config, --mcp)
- `src/singleton.ts` — Windows named mutex single-instance guard
- `src/config/loader.ts` + `src/config/types.ts` + `src/config/state.ts`
- `src/logger/index.ts` — Winston, dual log files (tray + worker), structured JSON
- `src/profiles/loader.ts` + `src/profiles/manager.ts` + `src/profiles/registry.ts` + `src/profiles/timer.ts`
- `src/worker/manager.ts` + `src/worker/ipc.ts` — heartbeat, crash recovery, JSON-RPC
- `src/tray/index.ts` + `src/tray/menu.ts` + `src/tray/lifecycle.ts` + `src/tray/notifications.ts`
- `src/status/server.ts` + `src/status/collector.ts`
- `src/watchdog/engine.ts` + `src/watchdog/detector.ts`
- `src/memory/manager.ts` + `src/power/manager.ts` + `src/system/optimizer.ts`
- `src/mcp/server.ts` + `src/mcp/kernl-client.ts`

### Agent 2: PowerShell Worker
Build `scripts/aegis-worker.ps1` — complete JSON-RPC 2.0 resource control bridge.  
All commands from BLUEPRINT_TECH.md must be implemented.  
CRITICAL: ALL property access on `$request` objects must use `$request.PSObject.Properties.Match('field').Count -gt 0` pattern before accessing — Set-StrictMode -Version Latest is active throughout.  
Heartbeat: send `{"type":"heartbeat","timestamp":"...","pid":...}` to stdout every 30 seconds.  
Version handshake: on startup send `{"type":"startup","version":"2.0.0","ps_version":"...","pid":...}` to stdout before entering the main loop.

### Agent 3: Status Window + Settings (HTA)
Build `assets/status.hta`, `assets/settings.hta`, `assets/status.css`, `assets/status.js`.  
The HTA polls `http://localhost:8743/status` every 2 seconds.  
Profile switches: POST to `http://localhost:8743/switch`.  
Timer: POST to `http://localhost:8743/timer/set` and `http://localhost:8743/timer/cancel`.  
Follow BLUEPRINT_UI.md section 3 (status window) and section 4 (settings window) precisely.  
Dark theme, Windows 11 aesthetic, Segoe UI, accent color shifts to match active profile color.  
Frameless status window, standard titlebar for settings window.  
Status window must auto-position above system tray, never go off-screen.

### Agent 4: Default Profiles + Config Template
Build all 6 profile YAML files in `profiles/`:
- idle.yaml, build-mode.yaml, deep-research.yaml, performance.yaml, wartime.yaml, presentation.yaml  
Build `aegis-config.yaml` — the default config template shipped with the installer.  
Follow exact schemas from BLUEPRINT_TECH.md.

### Agent 5: Installer + CI + Build Scripts
Build `installer/aegis.nsi` — full NSIS installer per BLUEPRINT_TECH.md.  
Must include: 64-bit install path ($PROGRAMFILES64), dev directory guard, smart profile upgrade strategy (copy missing only), uninstaller that asks about user data.  
Build `build-release.mjs` — assembles release/ directory.  
Build `.github/workflows/ci.yml` — typecheck + lint gate on PR, full build + GitHub release on main push.  
Build `package.json`, `tsconfig.json`, `.eslintrc.cjs`, `.gitignore`, `VERSION`.  
Build `AEGIS-silent.vbs` — launches AEGIS.exe without a CMD window (wscript launcher).  
Build `scripts/install-task.ps1` + `scripts/remove-task.ps1` — Task Scheduler registration.

### Agent 6: Tray Icons
Generate 7 tray icons in `assets/icons/`:
- idle.ico (#6b7280 gray), build-mode.ico (#22c55e green), deep-research.ico (#3b82f6 blue)
- performance.ico (#f59e0b amber), wartime.ico (#ef4444 red), presentation.ico (#a855f7 purple)
- warning.ico (orange #f97316 — used when worker is offline)

Each icon: simple filled shield shape, 16x16 and 32x32 sizes in the .ico file. The shield silhouette should be clean and geometric — the color fill is what matters most.

## Build verification (run after all agents complete)

1. `npm install` — zero errors
2. `npm run typecheck` — MUST be 0 TypeScript errors
3. `npm run lint` — MUST be 0 ESLint warnings
4. `npm run build:ts` — compiles successfully
5. `node build-release.mjs` — release/ directory assembled
6. Manual smoke test: `node release/dist/main.js --version` returns version number

## Commit and push

After all verification passes:
```
git add -A
git commit -m "feat: AEGIS v2.0.0 initial build

- Complete rewrite from v1
- Status window (HTA) with live system vitals
- Auto-detection engine with process triggers  
- Profile timers with crash-resilient state
- AEGIS MCP server (5 tools for Claude integration)
- 64-bit installer with dev directory guard
- Smart profile upgrade (never overwrites user edits)
- Worker heartbeat protocol
- Silent KERNL reconnect (no log spam)
- Per-profile tray icons with color coding
- Settings UI (no YAML editing required for common tasks)
- GitHub Actions CI with automatic releases"

git push origin main
```

## Quality gates (non-negotiable)

- Zero TypeScript errors (strict mode)
- Zero ESLint warnings
- Every worker command handles missing params safely (no strict mode crashes)
- Status window must show data on open with no loading delay (pre-fetched)
- Profile switch must complete in under 500ms for typical workloads
- No hardcoded strings that say "AEGIS" in the core logic — only in config and assets
- Installer must refuse install to any path containing \Dev\ or \dev\

## What NOT to build in this pass

- Visual rule editor (Settings → Rules tab is a placeholder "Coming in v2.1")
- Process list UI (full process manager — future version)
- Historical performance graphs (future)  
- Cloud sync / profile marketplace (future)
- Gaming profiles (future — architecture supports it already)

