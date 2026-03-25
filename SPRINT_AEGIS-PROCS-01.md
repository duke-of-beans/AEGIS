Execute Sprint AEGIS-PROCS-01 — Process Management: Complete with Implications for AEGIS.
Run after AEGIS-COCKPIT-02 is complete. Can run in parallel with AEGIS-INTEL-05.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\AEGIS\STATUS.md
  Filesystem:read_file D:\Projects\AEGIS\BACKLOG.md
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\commands.rs
  Filesystem:read_file D:\Projects\AEGIS\ui\index.html

Summary: After this sprint, every process action button in the cockpit works end-to-end.
Pause freezes a process and shows a PAUSED badge with a resume button. Priority change
opens a submenu with five levels and plain-English implications before applying. End task
shows a confirmation modal with a description of what the process does and what will break.
Every action produces visible confirmation or an inline error message — nothing is silent.
Actions are logged with timestamps and outcomes. suspend_process in commands.rs is currently
a stub (opens handle, immediately closes it without suspending) — this sprint fixes it.

Tasks:

1. Fix suspend_process in src-tauri/src/commands.rs — it is currently a stub:
   File: D:\Projects\AEGIS\src-tauri\src\commands.rs

   The current implementation opens a PROCESS_SUSPEND_RESUME handle and immediately
   closes it — it does not actually suspend the process.

   Replace with NtSuspendProcess via the ntapi crate, OR use the thread enumeration
   approach via CreateToolhelp32Snapshot + Thread32First/Next + SuspendThread.
   The thread enumeration approach does not require ntapi:

   #[tauri::command]
   pub fn suspend_process(pid: u32) -> Result<String, String> {
     #[cfg(windows)]
     {
       use windows::Win32::System::Diagnostics::ToolHelp::{
         CreateToolhelp32Snapshot, Thread32First, Thread32Next,
         THREADENTRY32, TH32CS_SNAPTHREAD,
       };
       use windows::Win32::System::Threading::{OpenThread, SuspendThread, THREAD_SUSPEND_RESUME};
       use windows::Win32::Foundation::CloseHandle;
       unsafe {
         let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0)
           .map_err(|e| format!("Snapshot failed: {:?}", e))?;
         let mut entry = THREADENTRY32 {
           dwSize: std::mem::size_of::<THREADENTRY32>() as u32,
           ..Default::default()
         };
         let mut suspended = 0u32;
         if Thread32First(snapshot, &mut entry).is_ok() {
           loop {
             if entry.th32OwnerProcessID == pid {
               if let Ok(thread) = OpenThread(THREAD_SUSPEND_RESUME, false, entry.th32ThreadID) {
                 SuspendThread(thread);
                 let _ = CloseHandle(thread);
                 suspended += 1;
               }
             }
             entry.dwSize = std::mem::size_of::<THREADENTRY32>() as u32;
             if Thread32Next(snapshot, &mut entry).is_err() { break; }
           }
         }
         let _ = CloseHandle(snapshot);
         if suspended == 0 {
           return Err(format!("No threads found for PID {}", pid));
         }
       }
     }
     Ok(format!("PID {} suspended ({} threads)", pid, 0u32))
   }

   Add a matching resume_process command using ResumeThread:
   #[tauri::command]
   pub fn resume_process(pid: u32) -> Result<String, String> {
     #[cfg(windows)]
     {
       // Same thread enumeration pattern, call ResumeThread instead of SuspendThread
       // Import ResumeThread from windows::Win32::System::Threading
     }
     Ok(format!("PID {} resumed", pid))
   }

   If the windows crate does not expose Thread32First/Thread32Next directly,
   check Cargo.toml for the exact feature flags needed and add them.
   Alternatively, use the ntapi approach if the crate is already available —
   check Cargo.toml before deciding. Document the approach chosen in MORNING_BRIEFING.

   Register resume_process in main.rs alongside the other commands.

2. Add get_process_info Tauri command — src-tauri/src/commands.rs:
   File: D:\Projects\AEGIS\src-tauri\src\commands.rs

   The cockpit needs to show what a process IS before allowing actions on it.
   Add a simple lookup that returns a description and safety classification:

   #[derive(Serialize)]
   pub struct ProcessInfo {
       pub name: String,
       pub description: String,
       pub publisher: String,
       pub risk_label: String,    // "SAFE" | "CAUTION" | "DO_NOT_TOUCH" | "CRITICAL_SYSTEM"
       pub blast_radius: String,  // "none" | "low" | "medium" | "high" | "critical"
       pub safe_to_end: bool,
       pub safe_to_suspend: bool,
       pub implication: String,   // plain English: "Ending this will close all Explorer windows."
   }

   #[tauri::command]
   pub fn get_process_info(name: String) -> ProcessInfo {
     // Hardcode a lookup table for the most common processes.
     // This does not need to be the full catalog — just the 30 most common processes
     // that a user might accidentally try to kill.
     // For anything not in the table: return a safe default with safe_to_end: true,
     // safe_to_suspend: true, risk_label: "SAFE", and a generic implication.
     match name.to_lowercase().trim_end_matches(".exe") {
       "lsass"    => ProcessInfo { description: "Windows security authentication".into(),
                    publisher: "Microsoft".into(), risk_label: "CRITICAL_SYSTEM".into(),
                    blast_radius: "critical".into(), safe_to_end: false, safe_to_suspend: false,
                    implication: "Ending lsass will immediately crash Windows and force a reboot.".into(),
                    name },
       "csrss"    => ProcessInfo { /* Client/Server Runtime — same severity */ ... },
       "winlogon" => ProcessInfo { /* Windows login — same severity */ ... },
       "svchost"  => ProcessInfo { description: "Windows service host (multiple services share this process)".into(),
                    publisher: "Microsoft".into(), risk_label: "DO_NOT_TOUCH".into(),
                    blast_radius: "high".into(), safe_to_end: false, safe_to_suspend: false,
                    implication: "Ending svchost can stop multiple Windows services simultaneously.".into(),
                    name },
       "explorer" => ProcessInfo { description: "Windows desktop and file manager".into(),
                    publisher: "Microsoft".into(), risk_label: "DO_NOT_TOUCH".into(),
                    blast_radius: "high".into(), safe_to_end: false, safe_to_suspend: false,
                    implication: "Ending explorer closes all open File Explorer windows and hides the taskbar. It restarts automatically.".into(),
                    name },
       "dwm"      => ProcessInfo { description: "Desktop Window Manager — renders all window visuals".into(),
                    publisher: "Microsoft".into(), risk_label: "CRITICAL_SYSTEM".into(),
                    blast_radius: "critical".into(), safe_to_end: false, safe_to_suspend: false,
                    implication: "Ending dwm will crash the visual desktop and force a reboot.".into(),
                    name },
       // Cover at minimum: services, smss, wininit, audiodg, searchindexer,
       // node, chrome, brave, code, teams, slack, discord, spotify, steam, obs
       _ => ProcessInfo { description: "Unknown process".into(), publisher: "Unknown".into(),
              risk_label: "SAFE".into(), blast_radius: "low".into(),
              safe_to_end: true, safe_to_suspend: true,
              implication: "No known critical dependencies. Use caution with unfamiliar processes.".into(),
              name }
     }
   }

   Fill in all the named processes listed above — do not use `...` placeholders.
   Every match arm must have a complete ProcessInfo struct.
   Register get_process_info in main.rs.

3. Wire process action modals in ui/index.html:
   File: D:\Projects\AEGIS\ui\index.html

   The cockpit has process rows with Pause / Priority / End buttons. Currently
   they either do nothing or show a modal that doesn't execute the action.
   This task makes them work completely.

   a) Pause / Resume:
      openPauseModal(pid, name) → shows:
        "Pause [name]?"
        "All threads will be frozen. The process cannot run until resumed.
         Memory is preserved. Other apps that depend on this process may hang."
        [PAUSE — [name]]  [CANCEL]
      On confirm: invoke('suspend_process', {pid})
        On success: add PAUSED badge to the process row, swap Pause button → Resume button
        On error: inline error in the modal: "⚠ [error message from Rust]" in red
      Resume button: invoke('resume_process', {pid})
        On success: remove PAUSED badge, swap Resume → Pause button
        On error: inline error

      PAUSED badge styling: small amber pill "⏸ PAUSED" appended to process name cell.
      Track paused PIDs in a module-level Set: pausedPids = new Set()
      On every metrics refresh, re-apply pause badges to paused PIDs (they survive
      the row re-render). Remove from pausedPids if the process disappears from the list.

   b) Priority change:
      openPriorityModal(pid, name, currentPriority) → shows:
        "Set priority for [name]"
        Five radio options with plain-English implications:
          High         — "Prioritized above almost everything. Use for time-critical tasks."
          Above Normal — "Given preference over most background processes."
          Normal       — "Default Windows allocation. No special treatment." (default)
          Below Normal — "Yields to most other processes. Good for background tasks."
          Idle         — "Only runs when nothing else needs the CPU. Near-invisible."
        Current priority shown as pre-selected.
        "AEGIS will not auto-adjust [name]'s priority while a pin is active." notice
          (only if the process has an active pin in localStorage['aegis_process_pins'])
        [APPLY]  [CANCEL]
      On [APPLY]: invoke('set_process_priority', {pid, priority: selectedValue})
        On success: update the priority badge on the process row. Green flash on the row.
        On error: inline error in red.

   c) End task:
      openEndModal(pid, name) → first calls invoke('get_process_info', {name}) to
      fetch the process description, THEN shows the modal.
      Modal content:
        If risk_label === 'CRITICAL_SYSTEM' or risk_label === 'DO_NOT_TOUCH':
          Red header: "⚠ Do not end this process"
          "[description]"
          "[implication]"
          [OK — I won't]  (only this button — no confirm option)
        If risk_label === 'CAUTION':
          Amber header: "End [name]?"
          "[description]" — "[publisher]"
          "[implication]"
          [END ANYWAY]  [CANCEL]
          [END ANYWAY] requires a 2-second hold (button shows countdown) to prevent
          accidental clicks.
        If risk_label === 'SAFE':
          Standard confirmation:
          "End [name]?"
          "[description]"
          "The process will be terminated immediately. Any unsaved work in [name]
           will be lost."
          [END [name]]  [CANCEL]
      On confirm: invoke('kill_process_cmd', {pid})
        On success: remove the process row immediately (no wait for next metrics refresh).
                    Show brief green toast: "[name] ended."
        On error: inline error in red within the modal.

   d) Action log entries:
      Every action (pause, resume, priority change, end) adds an entry to the
      action log with: timestamp, process name, action taken, outcome (✓ success / ✗ error).
      Use the existing renderAlog() infrastructure. The action log already renders
      sniper actions — format manual process actions the same way, with a different
      icon or prefix to distinguish them: "[Manual] node.exe → priority: idle ✓"

4. Handle process action results in sidecar.rs — emit to cockpit:
   File: D:\Projects\AEGIS\src-tauri\src\sidecar.rs

   Currently set_process_priority, suspend_process, and kill_process_cmd are called
   from handle_sniper_request but their results are not forwarded to the cockpit
   for sniper-triggered actions. Add result forwarding:

   After each action in handle_sniper_request:
     let result = crate::commands::set_process_priority(pid, "idle".to_string());
     let outcome = match result {
       Ok(_) => "success",
       Err(ref e) => { log::warn!("Sniper action failed: {}", e); "failed" }
     };
     let _ = app.emit("sniper_action", serde_json::json!({
       ...existing fields...,
       "outcome": outcome,
       "error": result.err().unwrap_or_default(),
     }));

   This ensures the action log shows whether sniper actions actually succeeded.

<!-- phase:execute -->

5. Quality gate:
   cd /d D:\Projects\AEGIS && npm run lint — 0 errors
   cd /d D:\Projects\AEGIS\src-tauri && cargo check — 0 errors
   Manual verify for each action type:
     Find a low-risk background process (e.g. searchindexer, notepad if open).
     Test Pause: process appears frozen in Task Manager (CPU drops to 0%).
     Test Resume: process CPU activity returns.
     Test Priority: visible in Task Manager Details tab > Priority column.
     Test End: process disappears from AEGIS list and Task Manager.
     Verify DO_NOT_TOUCH modal: try to End 'explorer' — should show red warning only.
   Verify action log receives entries for all manual actions.

6. Portfolio compliance check — D:\Projects\AEGIS:
   STATUS.md: verify 4-line header. Close AEGIS-PROCS-01 with commit hash.
   BACKLOG.md: mark AEGIS-PROCS-01 done.
   CHANGELOG.md: add sprint entry.

7. Session close:

   FRICTION PASS (before MORNING_BRIEFING):
   Triage FIX NOW / BACKLOG / LOG ONLY. Present to user:
     "Session complete. Process management fully operational — pause/resume, priority,
      end task with implications. suspend_process stub fixed.
      Friction: [X] fixable now / [Y] to backlog / [Z] informational
      [A] Fix now + log  ← default  [B] Just log  [C] Skip"
   Execute chosen path.

   MORNING_BRIEFING.md — write to D:\Projects\AEGIS\ BEFORE git add:
   Schema: D:\Dev\TEMPLATES\MORNING_BRIEFING_SCHEMA.md
   Sections: SHIPPED, QUALITY GATES, DECISIONS MADE BY AGENT,
   UNEXPECTED FINDINGS, FRICTION LOG, NEXT QUEUE.
   NEXT QUEUE: AEGIS-HELP-01 (hover tooltips — unblocked, no dependencies).
   AEGIS-INTEL-06 (process catalog — needs spec rewrite for v4 architecture first).

   git add + commit + push — MORNING_BRIEFING.md included:
   Write commit message to D:\Projects\AEGIS\commit-msg.txt then:
   "D:\Program Files\Git\cmd\git.exe" -C D:\Projects\AEGIS add -A
   "D:\Program Files\Git\cmd\git.exe" -C D:\Projects\AEGIS commit -F D:\Projects\AEGIS\commit-msg.txt
   "D:\Program Files\Git\cmd\git.exe" -C D:\Projects\AEGIS push

CRITICAL CONSTRAINTS:
- Shell: cmd (not PowerShell). GREGORE profile interferes.
- Git: "D:\Program Files\Git\cmd\git.exe" — full path, quoted.
- suspend_process FIX IS MANDATORY. Do not skip it or leave it stubbed.
  Verify with Task Manager that the process actually freezes (CPU → 0%).
- The DO_NOT_TOUCH / CRITICAL_SYSTEM modal must offer NO confirm option for
  lsass, csrss, winlogon, dwm. A user clicking End on lsass should see a
  red warning and a single "OK — I won't" button. Nothing else.
- The 2-second hold on [END ANYWAY] for CAUTION processes is not optional.
  Implement it: button shows "Hold 2s..." with a CSS width animation. If the
  user releases before 2 seconds, cancel. Only fire the invoke on held completion.
- get_process_info must have complete ProcessInfo structs for every named process
  in the match. No `...` placeholders left in the shipped code.
- pausedPids Set must survive process list re-renders. If you re-render the full
  process table on each metrics update (which is likely), re-apply PAUSED badges
  after each render using the pausedPids Set.
- All Tauri commands added in this sprint must be registered in main.rs.
  Unregistered commands fail silently from the JS side — the invoke() returns
  nothing and no error is shown. Double-check registration before closing.
- cargo check: the windows crate feature flags for Thread32First/Thread32Next
  may not be enabled. Check src-tauri/Cargo.toml [dependencies.windows] features
  and add "Win32_System_Diagnostics_ToolHelp" if missing.
- MORNING_BRIEFING.md written BEFORE git add. Included in the commit.

ACCEPTANCE CRITERIA:
  suspend_process actually freezes a process (verified in Task Manager)
  resume_process unfreezes the process (CPU activity returns)
  resume_process registered as Tauri command in main.rs
  get_process_info returns correct risk_label for lsass (CRITICAL_SYSTEM)
  get_process_info returns correct risk_label for node (SAFE)
  get_process_info registered in main.rs
  Pause modal: shows implication, confirm invokes suspend_process, PAUSED badge appears
  Resume button: invokes resume_process, PAUSED badge removed
  Priority modal: 5 options with plain-English text, APPLY invokes set_process_priority
  End modal: CRITICAL_SYSTEM processes show red warning + no confirm option
  End modal: CAUTION processes require 2-second hold on confirm button
  End modal: SAFE processes show standard confirmation, invoke fires on click
  Action log: manual actions logged with "[Manual]" prefix, timestamp, outcome
  Sniper actions in sidecar.rs: outcome field included in sniper_action event
  npm run lint: 0 errors
  cargo check: 0 errors
  MORNING_BRIEFING.md at D:\Projects\AEGIS\
  BACKLOG.md: AEGIS-PROCS-01 closed with commit hash
  CHANGELOG.md: sprint entry added
