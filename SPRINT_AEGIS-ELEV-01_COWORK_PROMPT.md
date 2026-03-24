Execute Sprint AEGIS-ELEV-01 — Elevation Gate in manager.ts.
Run first. No dependencies.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\aegis\STATUS.md
  Filesystem:read_file D:\Dev\aegis\BACKLOG.md
  Filesystem:read_file D:\Dev\aegis\src\profiles\manager.ts
  Filesystem:read_file D:\Dev\aegis\src\worker\manager.ts
  Filesystem:read_file D:\Dev\aegis\src\worker\ipc.ts
  Filesystem:read_file D:\Dev\aegis\src\config\types.ts
  Filesystem:read_file D:\Dev\aegis\src\tray\lifecycle.ts

---

PROBLEM STATEMENT

manager.ts calls ipc.call('set_all_priorities', ...) for elevated_processes and
ipc.call('manage_service', ...) for pause_services — but these are privileged
Win32 operations. The PowerShell worker (aegis-worker.ps1) is spawned WITHOUT
elevation by WorkerManager.start(). If AEGIS is not running elevated, these calls
silently catch() and log a warn, with zero user feedback.

There is no gate, no check, no toast. A user running AEGIS normally thinks their
profile switched. Nothing actually changed.

---

WHAT TO BUILD

1. ELEVATION CHECK UTILITY — src/system/elevation.ts (new file)

   Export one async function: checkIsElevated(): Promise<boolean>

   Implementation: spawn a short PowerShell one-liner that returns the current
   principal's IsInRole(Administrator) result as JSON. Parse it. Cache the result
   for the session (don't re-check on every profile switch — check once at startup).

   ```typescript
   import { exec } from 'child_process'

   let _elevated: boolean | null = null

   export async function checkIsElevated(): Promise<boolean> {
     if (_elevated !== null) return _elevated
     return new Promise((resolve) => {
       exec(
         'pwsh.exe -NonInteractive -Command "ConvertTo-Json ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"',
         (err, stdout) => {
           _elevated = !err && stdout.trim() === 'true'
           resolve(_elevated)
         }
       )
     })
   }
   ```

2. GATE IN ProfileManager.applyProfile() — src/profiles/manager.ts

   Before executing any privileged IPC calls (set_all_priorities, manage_service,
   set_power_plan, set_qos_policy, purge_standby_memory), check elevation once:

   ```typescript
   import { checkIsElevated } from '../system/elevation.js'

   // At the start of applyProfile(), before the try block:
   const isElevated = await checkIsElevated()
   if (!isElevated) {
     this.logger.warn('Profile applied without elevation — privileged operations skipped', { profile: name })
     // Still apply non-privileged things: update state, fire callback, notify
     // DO NOT throw — profile switch succeeds for non-privileged ops
   }
   ```

   Guard pattern — wrap each privileged call group:

   ```typescript
   if (isElevated) {
     for (const proc of profile.elevated_processes) {
       try {
         await ipc.call('set_all_priorities', { ... })
       } catch { ... }
     }
   }
   ```

   Apply this guard to:
   - elevated_processes loop (set_all_priorities)
   - throttled_processes loop (set_all_priorities + enable_power_throttling)
   - pause_services loop (manage_service stop/start)
   - set_power_plan call
   - set_qos_policy / remove_qos_policies calls
   - purge_standby_memory (if called from profile activate script)

   Non-privileged operations that should ALWAYS run regardless of elevation:
   - updateState() — always runs
   - profileChangedCallback — always fires
   - on_activate / on_deactivate scripts — always run (scripts may or may not need elevation)
   - memory preflight trim — run if elevated only

3. STARTUP ELEVATION NOTICE — src/tray/lifecycle.ts

   After worker starts successfully (after WorkerManager.start()), check elevation
   and surface it in the tray:

   ```typescript
   const elevated = await checkIsElevated()
   if (!elevated) {
     this.logger.warn('AEGIS running without elevation — resource control disabled')
     // Show a one-time toast: "AEGIS is running without elevation.
     //   Process priority and service control are disabled.
     //   Restart as administrator to enable full functionality."
     // Use the existing notifications system
   }
   ```

   Also expose isElevated on the status server snapshot so the status window
   can show an indicator.

4. STATUS WINDOW INDICATOR — assets/status.js + assets/status.hta

   Add a small elevation status indicator to the status window header.
   When not elevated: show a subtle amber warning "⚠ No elevation — resource
   control inactive" near the profile badge.
   When elevated: show nothing (clean UI, no green checkmark clutter).

5. TYPE ADDITION — src/config/types.ts

   Add isElevated?: boolean to SystemSnapshot so the status server can include it:

   ```typescript
   isElevated?: boolean
   ```

   Populate it in status/collector.ts via checkIsElevated().

---

WHAT NOT TO DO

- Do NOT auto-relaunch as administrator. Never shell-exec a UAC prompt silently.
  That's a security anti-pattern. Inform and let the user decide.
- Do NOT make the elevation check block startup. It's a fire-and-forget check that
  resolves async; startup proceeds regardless.
- Do NOT throw from applyProfile() when not elevated. Degrade gracefully — apply
  what you can, skip what you can't, log the gap.
- Do NOT add the elevation check to every ipc.call(). One check at applyProfile()
  entry, cached for session.

---

TASKS

1. Create src/system/elevation.ts with checkIsElevated() — cached, async, PS-based
2. Import and call in ProfileManager.applyProfile() — guard all privileged ops
3. Import and call in lifecycle.ts startup — log + toast if not elevated
4. Add isElevated to SystemSnapshot type in types.ts
5. Populate isElevated in collector.ts
6. Add amber indicator to status.hta/status.js when not elevated
7. Run ESLint: npx eslint src/ --max-warnings 0 — must pass clean
8. Run TypeScript: npx tsc --noEmit — must pass clean

---

FRICTION PASS (before git)

Collect all friction from this sprint. Triage FIX NOW / BACKLOG / LOG ONLY.
Present:
  "Session complete. [summary]
   Friction: [X] fixable now / [Y] to backlog / [Z] informational
   [A] Fix now + log the rest  ← default
   [B] Just log
   [C] Skip"

---

SESSION CLOSE

MORNING_BRIEFING.md — write to D:\Dev\aegis\ BEFORE git add.
Schema: Sections: SHIPPED, QUALITY GATES, DECISIONS MADE, UNEXPECTED FINDINGS,
FRICTION LOG, NEXT QUEUE.

STATUS.md — update Last Sprint: AEGIS-ELEV-01, Last Updated, Completion.
BACKLOG.md — close AEGIS-ELEV-01, move to Completed.
CHANGELOG.md — add [ELEV-01] entry under [Unreleased].

Git commit — D:\Dev\aegis\:
  "D:\Program Files\Git\cmd\git.exe" add -A
  Write commit message to D:\Dev\aegis\commit-msg.txt
  "D:\Program Files\Git\cmd\git.exe" commit -F commit-msg.txt
  "D:\Program Files\Git\cmd\git.exe" push

CRITICAL CONSTRAINTS:
- Shell: cmd (not PowerShell). All node/npm commands via cmd.
- Git: D:\Program Files\Git\cmd\git.exe — full path
- Commit via temp file, not inline -m
- ESLint + tsc must pass before commit
- MORNING_BRIEFING.md written BEFORE git add

ACCEPTANCE CRITERIA:
  npx tsc --noEmit — 0 errors
  npx eslint src/ --max-warnings 0 — 0 warnings
  AEGIS running non-elevated → startup toast fires once
  AEGIS running non-elevated → profile switch completes (state updates) but
    privileged ops silently skipped with warn log
  Status window shows amber indicator when not elevated
  MORNING_BRIEFING.md committed
