# AEGIS Changelog

## [Unreleased]

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
