# AEGIS Changelog

## [3.0.0-alpha.1] — 2026-03-24 (AEGIS-CATALOG-01)

### Added
- `src/catalog/schema.ts` — CatalogDb class with full SQLite schema (process_catalog +
  unknown_processes tables), all interfaces (CatalogEntry, UnknownEntry, SeedEntry, etc.),
  WAL mode, foreign keys, indexed queries
- `src/catalog/seed.json` — 210 pre-seeded processes across all trust tiers:
  CRITICAL_SYSTEM (tier 1, no actions), DO_NOT_TOUCH (tier 2), CAUTION (tier 2, throttle only),
  SAFE apps/dev/browsers (tier 3, full action set). Includes node.exe and claude.exe with
  accurate blast radius ratings.
- `src/catalog/manager.ts` — CatalogManager singleton: recordObservation(), canActOn() gate,
  suspicion heuristics (no publisher + AppData/Temp path + external network + obs > 3),
  requestIdentification() with pending_identifications.json fallback, resolveProcess(),
  seedIfEmpty(), initCatalog() / getCatalog() factory
- `src/status/server.ts` — POST /catalog/identify (queues identification request),
  POST /catalog/resolve (moves unknown to catalog), onIdentificationRequest() +
  onCatalogResolve() callback registration, catalog HTML section with suspicious (red)
  and unresolved (amber) banners + counts
- `src/status/collector.ts` — setCatalog() method, recordObservation() called per process
  in poll loop, unresolved_count + suspicious_count in SystemSnapshot
- `src/config/types.ts` — unresolved_count? and suspicious_count? added to SystemSnapshot
- `src/tray/lifecycle.ts` — initCatalog() at startup, seedIfEmpty(), server callbacks wired
  (onIdentificationRequest → catalog.requestIdentification, onCatalogResolve → catalog.resolveProcess),
  catalog passed to StatsCollector via setCatalog()

### Architecture
- canActOn() is the process action gate — returns false for all unknown and suspicious processes.
  No sniper action can bypass this. The catalog is the prerequisite for all v3 intelligence.
- Catalog = factual knowledge only. Behavioral baselines observed fresh per machine.
  Two databases, never contaminating each other.

## [Unreleased]

### Added — AEGIS-ELEV-01
- `src/system/elevation.ts`: `checkIsElevated()` — async, PowerShell-based, session-cached
- Elevation gate in `ProfileManager.applyProfile()` — all privileged IPC calls guarded
- Startup elevation check in `lifecycle.ts` — one-time toast + warn log when not elevated
- `isElevated?: boolean` added to `SystemSnapshot` type and populated by `StatsCollector`
- Amber elevation warning indicator in status window (hidden when elevated)
- AEGIS-ELEV-01: elevation gate in manager.ts

## [AEGIS-PM2-01] — 2026-03-22
### Shipped — pm2 Migration + ESLint Gate Fix

**Added**
- `D:\Meta\ecosystem.config.cjs` — pm2 process config for dashboard-server.js. Name: `dashboard`, port 7171, autorestart, max_restarts 10, min_uptime 2s, log files at D:\Meta\dashboard-pm2.log / dashboard-pm2-err.log.
- `D:\Meta\bounce.bat` — single-command dashboard restart: `pm2 restart dashboard && pm2 list`.
- `D:\Meta\pm2-startup.bat` — placed in Windows Startup folder for logon-time pm2 resurrect (no elevation needed).
- `D:\Meta\PORTFOLIO_OS.md` — Appendix C: Infrastructure Notes documenting pm2 ownership of dashboard.

**Fixed**
- `src/browser/tab-manager.ts` — `launchBrave()` removed `async` keyword (function uses no `await`; fixes `@typescript-eslint/require-await`).
- `src/browser/cdp-client.ts` — removed unnecessary `as string` type assertion on `debuggerUrl` (introduced `resolvedDebuggerUrl` const after undefined guard); fixed `data.toString()` → `(data as Buffer).toString('utf-8')` to satisfy `no-base-to-string`.
- `src/tray/menu.ts` — removed dead `cdpPort` variable (assigned but never used; fixes `no-unused-vars`).
- `src/tray/lifecycle.ts` — removed `async`/`await` from `onLaunchBrave` callback (cascade from tab-manager fix).
- `src/tray/index.ts` — updated `onLaunchBrave` interface type from `() => Promise<void>` to `() => void`.

**Removed**
- Task Scheduler task `Dashboard-7171` confirmed absent (was already removed before this sprint).

**Design decisions**
- `pm2 startup` is Linux/macOS only — Windows boot integration uses Startup folder bat calling `pm2 resurrect` instead.
- `launchBrave` is synchronous by nature (uses `spawn` with `detached: true` + `unref()`); `async` was never needed and was a BRAVE-02 oversight.
- pm2 will take full port ownership after the pre-existing dashboard process (PID 13444, started outside pm2) is cycled. Dashboard serves correctly in the interim.

## [BRAVE-02] — 2026-03-22 — a364fd3
### Shipped — Status Window Tab Panel + Brave Launch Helper + Per-Profile Config (2026-03-22)

**Added**
- `src/browser/tab-manager.ts` — `getTabList()` returns tab array with id, title (truncated 40 chars), suspended flag, suspended_ago_min. `isCdpConnected()` exposes CDP connection state. `updateSuspensionConfig()` merges per-profile suspension overrides into active config (only defined fields overridden). `launchBrave(port)` exported function: searches standard Brave install locations, spawns with `--remote-debugging-port`, detached + unref'd. Shows toast if Brave not found.
- `src/config/types.ts` — `BrowserSuspensionOverride` interface + `BrowserTabEntry` + `BrowserTabsSnapshot` interfaces. `LoadedProfile` extended with optional `browser_suspension` field. `profileSchema` extended with optional `browser_suspension` zod validation. `SystemSnapshot` extended with optional `browser_tabs` field.
- `src/status/collector.ts` — `setTabManager(tabManager, browserEnabled)` method. `poll()` now builds `browser_tabs` snapshot from live `TabManager` state (stats + tab list + connection status) and injects into `SystemSnapshot`.
- `src/tray/lifecycle.ts` — `StatsCollector` instantiated after worker start, wired to `StatusServer.updateSnapshot`. `onLaunchBrave` callback in `TrayDependencies` wired to `launchBrave()`, with CDP-already-connected guard. `onProfileSwitch` now calls `globalTabManager.updateSuspensionConfig()` when new profile defines `browser_suspension`.
- `src/tray/index.ts` — `onLaunchBrave` added to `TrayDependencies`. `updateMenu` accepts `browserCdpPort` + `browserCdpConnected`. Click handler dispatches "Launch Brave (with CDP)" title.
- `src/tray/menu.ts` — `browserCdpPort` + `browserCdpConnected` added to `MenuBuildOptions`. Browser submenu now shows "Launch Brave (with CDP)" as first item (disabled + relabelled when CDP already active).
- `assets/status.hta` — `[K]` browser-section div added above quick-switch dots.
- `assets/status.js` — `renderBrowserTabs()` function: renders BRAVE header with active/suspended counts + MB freed badge, per-tab rows with ⏸ prefix and dim styling for suspended tabs, "disabled" state when not connected.
- `profiles/wartime.yaml` — `browser_suspension` block: enabled true, inactivity_threshold_min 5, memory_pressure_threshold_mb 2000.
- `profiles/idle.yaml` — `browser_suspension` block: enabled false.

**Design decisions**
- `StatsCollector` wiring closes the gap where `/status` returned 503 — snapshots now pushed on every 2s poll cycle.
- `launchBrave` uses `spawn` with `detached: true` + `child.unref()` — AEGIS never waits on Brave's process lifecycle.
- Per-profile suspension merges only defined fields; undefined fields keep global config values (safe partial override).
- Browser panel hidden when `browser_manager.enabled = false` or `browser_tabs` absent from snapshot — zero noise for non-Brave users.

### AEGIS-BRAVE-01 — Brave Tab Manager (2026-03-22)

**Added**
- `src/browser/cdp-client.ts` — WebSocket-based Chrome DevTools Protocol client. Connects to Brave's remote debugging endpoint, fetches tab targets, navigates tabs via `Page.navigate`, activates tabs via HTTP.
- `src/browser/tab-manager.ts` — Core tab tracking and suspension engine. Polls CDP for tab state, evaluates suspension eligibility by inactivity threshold or memory pressure, suspends tabs by navigating to a data: URI holding page, restores on demand.
- `src/config/types.ts` — Added `TabSuspensionConfig`, `BrowserManagerConfig`, `TabState` interfaces and corresponding Zod schemas (`tabSuspensionConfigSchema`, `browserManagerConfigSchema`). `AegisConfig` extended with `browser_manager` field.
- `aegis-config.yaml` — `browser_manager` section added. `enabled: false` by default (opt-in). Requires Brave launched with `--remote-debugging-port=9222`.
- `src/memory/manager.ts` — `setTabManager()` method, `checkMemoryPressure()` private method, `pressureInterval` for trim-disabled configs. Memory pressure state-change notifications fire to `TabManager`.
- `src/tray/lifecycle.ts` — `MemoryManager` and `TabManager` instantiated at startup. `onSuspendTabs` / `onRestoreTabs` callbacks wired into `TrayManager`.
- `src/tray/menu.ts` — `BrowserMenuStats` interface, optional `browserStats` field on `MenuBuildOptions`. Browser submenu rendered when stats present: tab count label + Suspend/Restore actions.
- `src/tray/index.ts` — `onSuspendTabs` / `onRestoreTabs` added to `TrayDependencies`. `updateMenu` accepts optional `browserStats`. Click dispatch handles both browser actions.
- `ws` + `@types/ws` added to dependencies.

**Design decisions**
- `browser_manager.enabled = false` — feature is fully opt-in, zero impact when disabled.
- All CDP calls wrapped in try/catch; `TabManager` stays running and retries on next poll if Brave is unreachable.
- Memory pressure fires on state *change* only (low→normal, normal→low) to avoid redundant notifications every poll cycle.
- Suspension holding page uses `data:` URI — CDP cannot navigate to custom `chrome://` or `about:` pages.
- `max_suspended_tabs` cap + minimum 1 active tab enforced at all times.
