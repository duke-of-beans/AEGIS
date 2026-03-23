# AEGIS MORNING BRIEFING — AEGIS-BRAVE-02
**Date:** 2026-03-22
**Sprint:** AEGIS-BRAVE-02 — Status Window Tab Panel + Brave Launch Helper + Per-Profile Config

---

## SHIPPED

**Tab panel in status window**
- `getTabList()` added to `TabManager` — returns per-tab array with id, title (40-char truncated), suspended flag, suspended_ago_min.
- `BrowserTabsSnapshot` + `BrowserTabEntry` added to `types.ts`. `SystemSnapshot.browser_tabs` is now an optional field on every status response.
- `StatsCollector.setTabManager()` wires live `TabManager` state into the 2s poll cycle. `browser_tabs` field appears in every `/status` response when `browser_manager.enabled = true`.
- `assets/status.hta` — `[K]` browser section div added above quick-switch dots.
- `assets/status.js` — `renderBrowserTabs()` renders BRAVE header with active/suspended counts, MB freed badge, per-tab rows. Suspended tabs show ⏸ prefix + dim italic styling. Matches existing HTA aesthetic (same colors, same section structure as elevated/throttled panels).

**Brave launch helper**
- `launchBrave(port)` exported from `tab-manager.ts`. Searches LOCALAPPDATA, PROGRAMFILES, PROGRAMFILES(X86) for brave.exe. Spawns detached + unref'd. Shows toast if not found.
- `isCdpConnected()` added to `TabManager`, delegates to `CdpClient.isConnected()`.
- `TrayDependencies.onLaunchBrave` wired in `tray/index.ts` click handler and `lifecycle.ts`. CDP-already-connected guard shows toast instead of double-launching.
- `MenuBuildOptions` extended with `browserCdpPort` + `browserCdpConnected`. Browser submenu shows "Launch Brave (with CDP)" as first item, disabled + relabelled when CDP is already active.

**Per-profile suspension config**
- `BrowserSuspensionOverride` interface added to `types.ts`. `LoadedProfile.browser_suspension` optional field added. `profileSchema` zod validation extended (all three fields optional).
- `TabManager.updateSuspensionConfig()` merges profile override into active config — only defined fields overwritten.
- `onProfileSwitch` in `lifecycle.ts` calls `updateSuspensionConfig` when the new profile defines `browser_suspension`.
- `profiles/wartime.yaml` — `browser_suspension: enabled: true, inactivity_threshold_min: 5, memory_pressure_threshold_mb: 2000`
- `profiles/idle.yaml` — `browser_suspension: enabled: false`

**StatsCollector wired (bonus fix)**
- `StatsCollector` existed as dead code since BRAVE-01 — never instantiated. Status window would have returned 503 on every poll request. Fixed by wiring collector into `lifecycle.ts` after worker start, with `onStatsUpdated` pushing to `StatusServer.updateSnapshot`. Status window is now live.

---

## QUALITY GATES

- `npx tsc --noEmit` → **0 errors** ✅
- `browser_suspension` present in `wartime.yaml` and `idle.yaml` ✅
- "Launch Brave (with CDP)" present in `menu.ts` Browser submenu ✅
- `/status` endpoint response includes `browser_tabs` field (via `collector.ts`) ✅
- `getTabList()` and `launchBrave()` exported from `tab-manager.ts` ✅
- `STATUS.md` Last Sprint = AEGIS-BRAVE-02 ✅

---

## DECISIONS MADE BY AGENT

**StatsCollector wiring included in scope**
The sprint spec targeted `browser_tabs` in the `/status` response. Implementing this revealed that `StatsCollector` was never instantiated — the status window would have returned 503 regardless. Wiring the collector was the only correct path to deliver the spec. Treated as in-scope, not a scope expansion.

**`launchBrave` placed as module-level export, not class method**
`launchBrave` doesn't need access to `TabManager` internal state — it's a pure spawn helper. Exporting it as a standalone function keeps the class surface clean and lets `lifecycle.ts` import it directly without requiring a `TabManager` instance.

**Menu item disabled (not hidden) when CDP already connected**
The spec said "show toast instead" for the already-running case. The menu item is kept visible but disabled with a relabelled title ("Brave already running (CDP active)"). This gives users feedback without hiding the item, which would be confusing on re-open.

---

## UNEXPECTED FINDINGS

**Elevation gate is absent**
`manager.ts` spawns `pwsh.exe` directly — no UAC elevation, no `Start-Process -Verb RunAs`. The BRAVE-02 sprint spec flagged this as a possible gap from BRAVE-01. Confirmed: missing. Win32 priority API calls on protected system processes (MsMpEng.exe, SgrmBroker.exe) will silently fail under a standard user token. The browser tab manager (BRAVE-02 scope) is unaffected — it uses HTTP/WebSocket only. Elevation fix is architectural (requires UAC prompt design, credential caching strategy) and belongs in a dedicated sprint.

---

## FRICTION LOG

| # | Issue | Triage |
|---|-------|--------|
| 1 | `read_file` MCP tool returns metadata object only — content never populated. Required `start_process + Get-Content` fallback for every single file read. ~8 extra round-trips. | BACKLOG (environment issue, not agent-fixable) |
| 2 | `StatsCollector` never wired from BRAVE-01 — dead code. Silent 503 on status window. | LOG ONLY (fixed in this sprint) |
| 3 | Elevation gate absent in `manager.ts` | BACKLOG — AEGIS-BRAVE-03 or dedicated AEGIS-ELEV-01 sprint |
| 4 | Brief wrong-turn: imported `launchBrave` into `menu.ts` (pure builder). Caught before tsc, reverted cleanly. | LOG ONLY |

---

## NEXT QUEUE

**AEGIS-BRAVE-03 (spec'd)**
- Tab restoration UX: click suspended tab row in status window to restore it
- Whitelist editor in settings.hta
- Suspension statistics persistence across AEGIS restarts (state.json)
- Profile-aware launch: if wartime active, set aggressive thresholds on Brave launch

**AEGIS-ELEV-01 (new — from findings)**
- Design and implement PowerShell worker elevation gate
- Options: UAC prompt on startup, scheduled task with highest privileges, manifest elevation
- Must not block tray startup or show UAC dialog on every restart
