Execute Sprint AEGIS-BRAVE-02 — Status Window Tab Panel + Brave Launch Helper + Per-Profile Config.
Run FIRST. No dependencies.

Read these files FIRST before doing anything:
  Filesystem:read_multiple_files ["D:\\Dev\\aegis\\STATUS.md", "D:\\Dev\\aegis\\aegis-config.yaml"]
  Filesystem:read_multiple_files ["D:\\Dev\\aegis\\src\\tray\\lifecycle.ts", "D:\\Dev\\aegis\\src\\tray\\menu.ts"]
  Filesystem:read_multiple_files ["D:\\Dev\\aegis\\src\\browser\\tab-manager.ts", "D:\\Dev\\aegis\\src\\browser\\cdp-client.ts"]
  Filesystem:read_multiple_files ["D:\\Dev\\aegis\\assets\\status.hta", "D:\\Dev\\aegis\\assets\\status.js"]
  Filesystem:read_multiple_files ["D:\\Dev\\aegis\\src\\config\\types.ts", "D:\\Dev\\aegis\\BLUEPRINT_MASTER.md"]

ELEVATION GATE CHECK — before writing any code:
  Read src/tray/lifecycle.ts in full. AEGIS-BRAVE-01 friction log noted the working
  branch was missing the elevation gate. Verify the shipped lifecycle.ts has the
  correct elevation gate for the PowerShell worker. If it is missing, add it as
  Task 0 before proceeding. Document finding in MORNING_BRIEFING UNEXPECTED FINDINGS.

Summary: Three additions to the Brave tab manager shipped in AEGIS-BRAVE-01.
(1) Status window panel showing live tab list, suspended count, memory estimate.
(2) Tray menu "Launch Brave" option that starts Brave with --remote-debugging-port=9222,
    eliminating the manual shortcut flag requirement.
(3) Per-profile tab suspension config — wartime profile gets aggressive suspension,
    idle profile disables it. After this sprint: tab panel visible in status window,
    Brave launches correctly from tray, suspension behavior changes on profile switch.

Tasks:

1. Add tab panel to status window — assets/status.js + assets/status.hta:
   The status window polls localhost:8743/status every 2 seconds. Extend the
   /status endpoint response (src/status/server.ts + src/status/collector.ts)
   to include a browser_tabs field:

   browser_tabs: {
     enabled: boolean           // browser_manager.enabled from config
     connected: boolean         // CDP connection alive
     total: number
     active: number
     suspended: number
     memory_recovered_mb: number  // suspended * 80 (estimate)
     tabs: Array<{
       id: string
       title: string            // truncated to 40 chars
       suspended: boolean
       suspended_ago_min: number | null  // minutes since suspension
     }>
   }

   TabManager.getStats() already returns total/suspended/active/memory_est_mb.
   Add getTabList() to TabManager returning the tabs array above.

   In assets/status.js, add a "Browser" section below the existing sections.
   Show when enabled=true and connected=true:
     - Header: "BRAVE  {active} active / {suspended} suspended  ~{memory_recovered_mb}MB freed"
     - Tab list: each tab as a row — suspended tabs shown with ⏸ prefix and dim styling
     - When disabled or not connected: show "Browser tab manager: disabled" in dim text
   Match the existing HTA aesthetic exactly (same colors, same font, same section spacing).

2. Add Brave launch helper — src/tray/menu.ts:
   In the Browser submenu (added in BRAVE-01), add a menu item above the existing items:
     "Launch Brave (with CDP)" → calls launchBrave()

   Implement launchBrave() in src/browser/tab-manager.ts:
   export async function launchBrave(port: number): Promise<void>
     // Find Brave executable:
     // Check in order:
     //   process.env['LOCALAPPDATA'] + '\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
     //   process.env['PROGRAMFILES'] + '\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
     //   process.env['PROGRAMFILES(X86)'] + '\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'
     // If not found: notify user (Windows toast via notify()) "Brave not found. Install Brave or update path."
     // If found: spawn(bravePath, ['--remote-debugging-port=' + port], { detached: true, stdio: 'ignore' })
     //           child.unref()  (don't keep AEGIS alive for Brave's sake)
     // Log info: "Launched Brave with --remote-debugging-port={port}"

   If Brave is already running (CDP connected): show "Brave already running (CDP active)" toast instead.

<!-- phase:execute -->

3. Per-profile tab suspension config:
   Extend the profile YAML schema to support a browser_suspension override.
   Add to LoadedProfile in src/config/types.ts:

   browser_suspension?: {
     enabled?: boolean
     inactivity_threshold_min?: number
     memory_pressure_threshold_mb?: number
   } | undefined

   Add to profileSchema zod validation (all fields optional).

   In src/tray/lifecycle.ts, when switching profiles:
   If the new profile has browser_suspension defined AND globalTabManager is not null:
     Call a new method: globalTabManager.updateSuspensionConfig(profile.browser_suspension)
   This method merges the profile override into the active config, overriding only
   the fields that are defined (undefined fields keep the global config value).

   Update profiles/wartime.yaml — add:
   browser_suspension:
     enabled: true
     inactivity_threshold_min: 5
     memory_pressure_threshold_mb: 2000

   Update profiles/idle.yaml — add:
   browser_suspension:
     enabled: false

4. Quality gate:
   npx tsc --noEmit — zero errors.
   Manual check: browser_suspension section present in wartime.yaml and idle.yaml.
   Manual check: "Launch Brave (with CDP)" present in tray Browser submenu (read menu.ts).
   Manual check: /status endpoint response includes browser_tabs field (read server.ts).

5. Portfolio compliance check:
   - STATUS.md: update Last Sprint to AEGIS-BRAVE-02, Last Updated to today
   - CHANGELOG.md: add AEGIS-BRAVE-02 entry
   - aegis-config.yaml: no changes needed (browser_manager block already present)

6. Session close:

   FRICTION PASS — collect, triage FIX NOW / BACKLOG / LOG ONLY, present [A/B/C].

   MORNING_BRIEFING.md — write to D:\Dev\aegis\ BEFORE git add:
   Sections: SHIPPED, QUALITY GATES, DECISIONS MADE BY AGENT (elevation gate finding),
   UNEXPECTED FINDINGS, FRICTION LOG, NEXT QUEUE.

   git add + commit + push — MORNING_BRIEFING.md included.
   Commit message via commit-msg.txt:
     AEGIS-BRAVE-02: tab panel in status window, Brave launch helper,
     per-profile suspension config (wartime/idle)

CRITICAL CONSTRAINTS:
- Elevation gate: verify first, before any code. If missing, fix it before Task 1.
- Status window HTA aesthetic: match existing colors/fonts/spacing exactly.
  The panel must feel native to the status window, not bolted on.
- launchBrave() must use spawn with detached:true and unref() — never block AEGIS.
- All CDP calls remain wrapped in try/catch. CDP unreachable = log warn, no crash.
- TypeScript strict. Zero new errors.
- Shell: cmd (not PowerShell). GREGORE profile intercepts node/npm.
- MORNING_BRIEFING.md written BEFORE git add. Included in commit.

Project: D:\Dev\aegis
Shell: cmd (not PowerShell). cd /d D:\Dev\aegis
Git: D:\Program Files\Git\cmd\git.exe — full path. Commit via commit-msg.txt.
TypeScript: npx tsc --noEmit for quality gate.

ACCEPTANCE CRITERIA:
  Elevation gate: verified present in lifecycle.ts (or fixed if missing)
  assets/status.js: browser_tabs section renders in status window
  src/status/server.ts or collector.ts: browser_tabs field in /status response
  src/browser/tab-manager.ts: getTabList() and launchBrave() exported
  src/tray/menu.ts: "Launch Brave (with CDP)" menu item present
  src/config/types.ts: browser_suspension optional field in LoadedProfile + zod schema
  profiles/wartime.yaml: browser_suspension block with inactivity_threshold_min: 5
  profiles/idle.yaml: browser_suspension block with enabled: false
  npx tsc --noEmit: 0 errors
  STATUS.md: Last Sprint = AEGIS-BRAVE-02
  MORNING_BRIEFING.md: exists at D:\Dev\aegis\

NEXT SPRINT (AEGIS-BRAVE-03 — not in scope here):
  - Tab restoration UX: click suspended tab row in status window to restore it
  - Whitelist editor in settings.hta
  - Suspension statistics persistence across AEGIS restarts (state.json)
  - Profile-aware launch: if wartime active, set aggressive thresholds on Brave launch
