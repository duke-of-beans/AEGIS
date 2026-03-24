Execute Sprint AEGIS-BRAVE-01 — Brave Tab Manager (CDP-based tab suspension).
Run FIRST. No dependencies.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\aegis\src\config\types.ts
  Filesystem:read_file D:\Dev\aegis\src\memory\manager.ts
  Filesystem:read_file D:\Dev\aegis\src\status\collector.ts
  Filesystem:read_file D:\Dev\aegis\src\tray\menu.ts
  Filesystem:read_file D:\Dev\aegis\src\tray\lifecycle.ts
  Filesystem:read_file D:\Dev\aegis\aegis-config.yaml
  Filesystem:read_file D:\Dev\aegis\BLUEPRINT_MASTER.md

Summary: AEGIS gains a Brave browser tab manager that suspends inactive tabs to
reclaim memory. Brave exposes Chrome DevTools Protocol (CDP) on a configurable port
when launched with --remote-debugging-port=N. AEGIS connects via WebSocket, tracks
tab activity, suspends inactive tabs by navigating them to a holding page (storing
original URL in state), and restores on focus. Memory integration: when available
RAM drops below low_memory_threshold_mb, suspension triggers immediately regardless
of inactivity timer. After this sprint: tab suspension is functional, configured via
aegis-config.yaml, visible in tray menu, and triggered automatically under memory
pressure.

Tasks:

1. Add BrowserManagerConfig type — D:\Dev\aegis\src\config\types.ts:
   Add these interfaces and extend AegisConfig:

   export interface TabSuspensionConfig {
     enabled: boolean
     cdp_port: number                     // Brave --remote-debugging-port value
     inactivity_threshold_min: number     // Minutes before eligible for suspension
     max_suspended_tabs: number           // Cap — never suspend all tabs
     whitelist: string[]                  // URL patterns never suspended (e.g. "localhost", "claude.ai")
     memory_pressure_threshold_mb: number // Override inactivity timer below this RAM
     poll_interval_sec: number            // How often to check tab activity
   }

   export interface BrowserManagerConfig {
     enabled: boolean
     browser: 'brave' | 'chrome' | 'chromium'
     tab_suspension: TabSuspensionConfig
   }

   Export interface TabState {
     id: string
     url: string
     title: string
     suspended: boolean
     original_url: string | null          // Set when suspended, null otherwise
     last_active_ms: number               // Date.now() at last activation
     suspended_at_ms: number | null
   }

   Extend AegisConfig with:
     browser_manager: BrowserManagerConfig

   Add Zod schemas for all new types following the existing pattern in the file.
   Add browserManagerConfigSchema to the aegisConfigSchema z.object() call.

2. Create CDP client — D:\Dev\aegis\src\browser\cdp-client.ts:
   WebSocket-based CDP connection to Brave's remote debugging endpoint.

   export class CdpClient {
     constructor(port: number) {}

     async connect(): Promise<void>
     // GET http://localhost:{port}/json → parse tab list
     // Establish WebSocket to each tab's webSocketDebuggerUrl as needed

     async getTargets(): Promise<CdpTarget[]>
     // GET http://localhost:{port}/json/list
     // Returns array of { id, url, title, type, webSocketDebuggerUrl }
     // Filter type === 'page' only (exclude extensions, service workers)

     async navigateTab(targetId: string, url: string): Promise<void>
     // Open WebSocket to tab's debugger URL
     // Send Page.navigate({ url }) command
     // Close WebSocket after response

     async activateTab(targetId: string): Promise<void>
     // GET http://localhost:{port}/json/activate/{targetId}

     isConnected(): boolean
     disconnect(): void
   }

   export interface CdpTarget {
     id: string
     url: string
     title: string
     type: string
     webSocketDebuggerUrl: string | undefined
   }

   Use Node.js built-in fetch (Node 18+) for HTTP calls.
   Use the 'ws' package for WebSocket — check if already in package.json;
   if not present, add it: npm install ws @types/ws
   CDP Page.navigate expects: { method: "Page.navigate", params: { url }, id: N }
   Response format: { id: N, result: { frameId, ... } }
   Timeout all CDP calls at 5000ms. Log failures as warn, do not throw.

3. Create tab manager — D:\Dev\aegis\src\browser\tab-manager.ts:
   Core tab tracking and suspension logic.

   export class TabManager {
     private config: BrowserManagerConfig
     private cdp: CdpClient
     private tabs: Map<string, TabState> = new Map()
     private pollInterval: NodeJS.Timeout | null = null
     private logger = getLogger()
     private suspensionPageUrl = 'about:blank#aegis-suspended'

     constructor(config: BrowserManagerConfig) {}

     start(): void
     // Start poll loop at config.tab_suspension.poll_interval_sec interval
     // First poll: populate initial tab map, all tabs start as active (last_active_ms = now)

     stop(): void
     // Clear poll interval

     async poll(): Promise<void>
     // 1. getTargets() from CDP
     // 2. For each returned target:
     //    - If new (not in tabs map): add with last_active_ms = now
     //    - If existing and URL changed from suspension page back to real URL:
     //      mark as restored, update last_active_ms = now
     //    - If existing and URL matches suspension page: keep suspended state
     //    - If existing and URL unchanged and not suspended: no change to last_active_ms
     //      (last_active_ms only updates on URL change or new tab)
     // 3. Remove tabs from map that no longer appear in target list (closed)
     // 4. Run suspension evaluation (see below)

     async evaluateSuspensions(memoryPressure: boolean): Promise<void>
     // Called from poll() with current memory pressure flag
     // Eligible for suspension if ALL:
     //   - tab.suspended === false
     //   - tab.url not matching any whitelist pattern (substring match)
     //   - tab.url not starting with 'chrome://', 'brave://', 'about:'
     //   - Either: memoryPressure === true (ignore inactivity timer)
     //     Or: (Date.now() - tab.last_active_ms) > threshold_min * 60 * 1000
     // Sort eligible by last_active_ms ascending (oldest first)
     // Suspend up to (total_active_tabs - max_suspended_tabs) tabs
     // Never leave fewer than 1 active tab

     async suspendTab(tabId: string): Promise<void>
     // Store original URL in tab state
     // CDP navigate to suspensionPageUrl + '&title=' + encodeURIComponent(tab.title)
     // Update tab.suspended = true, tab.suspended_at_ms = Date.now()
     // Log info: "Suspended tab: [title]"

     async restoreTab(tabId: string): Promise<void>
     // CDP navigate back to tab.original_url
     // Update tab.suspended = false, tab.original_url = null, tab.last_active_ms = now
     // Log info: "Restored tab: [title]"

     async suspendAll(): Promise<void>
     // Force suspend all eligible tabs regardless of inactivity timer
     // Respect whitelist and max_suspended_tabs

     async restoreAll(): Promise<void>
     // Restore all currently suspended tabs

     getStats(): { total: number; suspended: number; active: number; memory_est_mb: number }
     // memory_est_mb: suspended * 80 (rough estimate — 80MB per suspended tab freed)

     notifyMemoryPressure(pressureActive: boolean): void
     // Called by MemoryManager when pressure threshold is crossed
     // If pressureActive === true: trigger immediate evaluateSuspensions(true)
   }

   Suspension holding page content: tabs navigated to about:blank (CDP doesn't
   allow navigating to custom chrome:// pages). Instead use a data: URI:
     data:text/html,<html><body style="background:#111;color:#888;font-family:sans-serif;
     display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
     <div style="text-align:center"><p style="font-size:2rem">⏸</p>
     <p>Tab suspended by AEGIS</p><p style="font-size:.8rem;opacity:.5">
     Click to restore</p></div></body></html>
   Store this as a constant in the file. URL-encode it for use in Page.navigate.

<!-- phase:execute -->

4. Add browser_manager section to aegis-config.yaml:
   D:\Dev\aegis\aegis-config.yaml — append after the notifications block:

   browser_manager:
     enabled: false
     browser: brave
     tab_suspension:
       enabled: true
       cdp_port: 9222
       inactivity_threshold_min: 30
       max_suspended_tabs: 10
       whitelist:
         - "localhost"
         - "127.0.0.1"
         - "claude.ai"
         - "about:newtab"
       memory_pressure_threshold_mb: 1500
       poll_interval_sec: 60

   enabled: false by default — user opts in. Brave must be launched with
   --remote-debugging-port=9222 for this to function.

5. Wire TabManager into MemoryManager — D:\Dev\aegis\src\memory\manager.ts:
   Add optional TabManager dependency:

   private tabManager: TabManager | null = null

   Add method:
     setTabManager(tm: TabManager): void {
       this.tabManager = tm
     }

   In the existing trim loop and in a new memory pressure check:
   After getting current memory stats, if memory_mb_available <
   config.low_memory_threshold_mb AND tabManager is set:
     this.tabManager.notifyMemoryPressure(true)
   When memory recovers above threshold:
     this.tabManager.notifyMemoryPressure(false)

   Add a pressure tracking boolean (private pressureActive = false) so the
   notification only fires on state CHANGE (low→normal, normal→low), not every poll.

   The memory pressure check runs on the existing trim interval cycle.
   If trim_interval_min is 0 (disabled), add a separate 60s pressure-check interval
   that only does the memory check + tab notification, no working set trim.

6. Wire TabManager into lifecycle — D:\Dev\aegis\src\tray\lifecycle.ts:
   After MemoryManager.start() call, if config.browser_manager.enabled:
     const tabMgr = new TabManager(config.browser_manager)
     tabMgr.start()
     memoryManager.setTabManager(tabMgr)
     Store reference for shutdown + tray menu use.
   On shutdown: tabMgr.stop()

7. Add tray menu items — D:\Dev\aegis\src\tray\menu.ts:
   If browser_manager.enabled, add a "Browser" submenu section showing:
   - "Tabs: {active} active / {suspended} suspended" (disabled label)
   - "Suspend Inactive Tabs Now" → calls tabMgr.suspendAll()
   - "Restore All Tabs" → calls tabMgr.restoreAll()
   Follow the existing menu builder pattern exactly.

8. Quality gate:
   npx tsc --noEmit — zero new TypeScript errors.
   If 'ws' was added: verify node_modules/ws exists.
   Manual verification: browser_manager section present in aegis-config.yaml.
   Verify TabState and BrowserManagerConfig exported from types.ts.

9. Portfolio compliance check:
   - Verify CHANGELOG.md exists at D:\Dev\aegis\CHANGELOG.md — create stub if missing
   - Add AEGIS-BRAVE-01 entry to CHANGELOG.md
   - Note: No STATUS.md found in AEGIS — create one with 4-line header if missing:
     Status: active
     Phase: v2.x feature development
     Last Sprint: AEGIS-BRAVE-01
     Last Updated: [today]

10. Session close:

    FRICTION PASS:
    Collect friction from this session. Triage FIX NOW / BACKLOG / LOG ONLY.
    Present to user:
      "Session complete. [one-line summary]
       Friction: [X] fixable now / [Y] to backlog / [Z] informational
       [A] Fix now + log the rest  ← default
       [B] Just log
       [C] Skip"
    Execute chosen path.

    MORNING_BRIEFING.md — write to D:\Dev\aegis\ BEFORE git add:
    Sections: SHIPPED, QUALITY GATES, DECISIONS MADE BY AGENT,
    UNEXPECTED FINDINGS, FRICTION LOG, NEXT QUEUE.

    git add + commit + push — MORNING_BRIEFING.md included.
    Commit message via commit-msg.txt:
      AEGIS-BRAVE-01: Brave tab manager — CDP client, suspension engine,
      memory pressure integration, tray menu

CRITICAL CONSTRAINTS:
- All new code is ADDITIVE. src/memory/manager.ts gets two small additions
  (setTabManager method + pressure check). Touch nothing else in existing files
  except the wiring in lifecycle.ts and menu.ts.
- TabManager does NOT crash AEGIS if Brave is not running or CDP is unreachable.
  All CDP calls are wrapped in try/catch. If getTargets() fails, log warn and
  return empty array. The manager stays running and retries on the next poll.
- TypeScript strict mode. Zero new errors before session close.
- All new code follows existing patterns: getLogger(), same import style, same
  class structure as MemoryManager.
- browser_manager.enabled = false in config — feature is opt-in.
- MORNING_BRIEFING.md written BEFORE git add. Included in commit.
- Shell: cmd (not PowerShell).

Project: D:\Dev\aegis
Shell: cmd (not PowerShell). cd /d D:\Dev\aegis
Git: D:\Program Files\Git\cmd\git.exe — full path. Commit via commit-msg.txt.
TypeScript: npx tsc --noEmit for quality gate.

ACCEPTANCE CRITERIA:
  src/browser/cdp-client.ts: exists, CdpClient class exported
  src/browser/tab-manager.ts: exists, TabManager class exported
  src/config/types.ts: BrowserManagerConfig, TabSuspensionConfig, TabState exported
  src/config/types.ts: browserManagerConfigSchema present, wired into aegisConfigSchema
  src/memory/manager.ts: setTabManager() method present, pressure check present
  src/tray/lifecycle.ts: TabManager instantiated when browser_manager.enabled
  src/tray/menu.ts: Browser submenu section present (conditional on enabled)
  aegis-config.yaml: browser_manager section present with all fields
  npx tsc --noEmit: zero errors
  CHANGELOG.md: AEGIS-BRAVE-01 entry present
  MORNING_BRIEFING.md: exists at D:\Dev\aegis\

NEXT SPRINT (AEGIS-BRAVE-02 — not in scope here):
  - Status window panel showing tab list, suspended state, memory recovered
  - Brave launch helper: AEGIS tray option to launch Brave with --remote-debugging-port
  - Per-profile tab suspension config (wartime = aggressive, idle = disabled)
  - Tab restore on AEGIS profile switch away from wartime
