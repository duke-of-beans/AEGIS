# AEGIS Changelog

## [Unreleased]

### AEGIS-BRAVE-02 — Status Window Tab Panel + Brave Launch Helper + Per-Profile Config (2026-03-22)

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
