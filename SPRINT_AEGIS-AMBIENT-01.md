Execute Sprint AEGIS-AMBIENT-01 — Profiles Demoted, Ambient Intelligence Primary for AEGIS.
Run after AEGIS-INTEL-03 is complete (sniper must be running before ambient mode is meaningful).

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\AEGIS\STATUS.md
  Filesystem:read_file D:\Projects\AEGIS\BACKLOG.md
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\tray.rs
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\profiles.rs
  Filesystem:read_file D:\Projects\AEGIS\ui\index.html
  Filesystem:read_file D:\Projects\AEGIS\VISION.md

Summary: After this sprint AEGIS is ambient-first. No profile is shown prominently.
AEGIS manages resources automatically based on context and sniper intelligence.
Profiles become manual overrides — accessible but not the primary feature.
The tray communicates AEGIS's current behavior in plain English. Individual
per-process overrides are available via right-click in the process list.

Tasks:

1. Redesign the tray menu — src-tauri/src/tray.rs:
   New structure:
     AEGIS — Cognitive Resource OS      [disabled header]
     ─────────────────────────────────
     ● Ambient — auto-managing          [shown when no override active, disabled/informational]
     ─────────────────────────────────
     Manual Override ▶                  [submenu]
       · idle
       · performance
       · wartime
       · deep-research
       · presentation
       · build-mode
       [active override has ● prefix]
       Release Override                 [shown only when override is active]
     ─────────────────────────────────
     Open Cockpit
     Quit AEGIS
   When an override is active, the header shows:
     OVERRIDE: [profile name]           [disabled, amber-colored if possible]
   "Release Override" switches back to idle/ambient.
   Tooltip on the tray icon: "AEGIS — ambient" or "AEGIS — override: [name]"

2. Cockpit header pill update — ui/index.html:
   Replace the existing profile pill behavior:
   - When no override: pill shows "AMBIENT" in dim color
   - When override active: pill shows "OVERRIDE: [name]" in amber color, border amber
   - Clicking the pill when override active: opens a modal asking
     "Release [profile] override and return to ambient mode?" [Yes] [Cancel]
   - Clicking when ambient: no action (or show tooltip "AEGIS is managing automatically")

3. Right-panel profile section cleanup — ui/index.html:
   The "MANUAL OVERRIDE" section at the bottom of the right panel:
   - Label: "OVERRIDE" in 9px mono uppercase dim
   - State: "ambient — auto-managing" when none active (green dot)
   - State: "[profile name]" in amber when active (amber dot)
   - "change" button opens profile modal
   - "release" button appears only when override is active — releases to ambient
   This section must feel like an advanced/expert control, not a primary UI.

4. Per-process permanent overrides — ui/index.html:
   In the process row action buttons, add a fourth button: "⊕ pin"
   Pin button opens a modal:
     "Pin [process] — permanent CPU priority override"
     Current setting: [detected from PROC_INFO or 'normal']
     New setting: [priority dropdown: high / above_normal / normal / below_normal / idle]
     What this does: [plain English — same implication text as priority modal]
     "AEGIS will not auto-adjust [process] while this pin is active."
     [Pin it] [Cancel]
   On confirm: calls window._aegisInvoke('set_process_priority', {pid, priority})
   AND stores the pin in localStorage under 'aegis_process_pins':
     { "chrome.exe": "below_normal", "node.exe": "normal" }
   On AEGIS restart, the cockpit reads localStorage and re-applies pins on first
   metrics update. Show a "📌" indicator on pinned process rows.

<!-- phase:execute -->

5. Sidecar awareness of override state — sidecar/src/main.ts:
   When a profile override is applied via the tray or cockpit:
   - The 'apply_profile' RPC method is already called (from existing flow)
   - Add: store the override state and expose via get_state response:
       overrideActive: activeProfile !== 'idle' && activeProfile !== ''
   When override is released: activeProfile = 'idle', sniperEngine?.setProfile?.('idle')

6. Quality gate:
   npm run lint — 0 errors
   cargo check — 0 errors
   Verify tray menu shows "Ambient — auto-managing" when no override active
   Verify switching to wartime via tray shows "OVERRIDE: wartime" in tray tooltip
   and in cockpit pill
   Verify "Release Override" returns to ambient state

7. Portfolio compliance check + session close:
   STATUS.md, BACKLOG.md, CHANGELOG.md updated.
   MORNING_BRIEFING.md written to D:\Projects\AEGIS\ BEFORE git add.
   git add + commit + push. Commit via commit-msg.txt.

CRITICAL CONSTRAINTS:
- Shell: cmd (not PowerShell).
- Git: "D:\Program Files\Git\cmd\git.exe" full path.
- "Ambient mode" is NOT a new profile. It is the absence of an override.
  AEGIS in ambient mode runs context detection, sniper, and baseline — it does
  not apply any profile's CPU priority rules unless the sniper acts.
  Do NOT create an "ambient.yaml" profile.
- Per-process pins in localStorage are client-side only. They are not persisted
  to the sidecar or any YAML file. This is intentional — they are UI preferences.
  The sidecar treats them as transient. Document this decision.
- MORNING_BRIEFING.md written BEFORE git add.

Project: D:\Projects\AEGIS
Shell: cmd. Git: "D:\Program Files\Git\cmd\git.exe" full path.

ACCEPTANCE CRITERIA:
  Tray menu: "Ambient — auto-managing" shown when no override active
  Tray menu: "Manual Override" submenu contains all profiles
  Tray menu: active override shows ● prefix and "Release Override" option
  Cockpit pill: "AMBIENT" in dim when none, "OVERRIDE: [name]" in amber when active
  Right panel: override section shows state, release button works
  Process rows: "⊕ pin" button appears on hover
  Pinning a process calls set_process_priority and shows 📌 on the row
  npm run lint: 0 errors. cargo check: 0 errors.
  MORNING_BRIEFING.md written. BACKLOG.md: AEGIS-AMBIENT-01 done.
