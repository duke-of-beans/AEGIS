Execute Sprint AEGIS-COCKPIT-02 — Complete Cockpit Rewrite for AEGIS.
Run in parallel with AEGIS-DEVOPS-01 and AEGIS-INTEL-01.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\AEGIS\STATUS.md
  Filesystem:read_file D:\Projects\AEGIS\BACKLOG.md
  Filesystem:read_file D:\Projects\AEGIS\ui\index.html
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\commands.rs
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\metrics.rs
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\tray.rs

Summary: After this sprint the AEGIS cockpit is fully functional. Every tab
switches correctly. Light mode works and persists. Process action buttons
(pause/priority/end) execute Tauri commands and show inline success or error
feedback — no silent failures. Font sizes are readable. The sniper panel shows
a live animation. The color palette is warmer and less aggressively cyan.
Profile override is demoted to a small section at the bottom of the right panel.
BUILD.bat is run at the end to produce a new installer with the correct icon.

Tasks:

1. Audit the current ui/index.html for broken state:
   Read the full file. Identify:
   - Which functions are globally scoped vs inside IIFEs (root cause of tab breakage)
   - Whether toggleTheme is wired via addEventListener or onclick=
   - Whether showProcModal/execProcAction are globally accessible
   - Whether window._aegisInvoke is set before process actions are called
   - Any syntax errors or unclosed blocks
   Document findings as inline comments before rewriting. Do not fix yet.

2. Rewrite ui/index.html — complete, working, no broken state:

   DESIGN TOKENS (replace the all-cyan palette):
   - Primary bg: #06080f (keeps the dark feel)
   - Surface: #0d1117 (warmer, less blue-shifted)
   - Accent: #00e5ff (cyan — reserved for active/highlight states ONLY)
   - Warm accent: #c8a060 (amber-warm — used for non-critical emphasis)
   - Text primary: #dce6f0 (slightly warm white)
   - Text secondary: #7a8fa8 (muted, less blue)
   - Text dim: #445566
   - Border: #1c2535 (less blue)
   - Red critical: #e8192c (logo red — critical states only)
   - Green: #4ade80
   - Amber: #ffbb00

   LIGHT MODE: Full CSS variable override on body.light. Warm paper tones, not
   clinical white. Persist to localStorage. toggleTheme() must be globally scoped
   and wired via document.getElementById('theme-btn').addEventListener('click', toggleTheme).

   TAB NAVIGATION: sel(m) must be a top-level function declaration (function sel(m){...})
   NOT inside an IIFE or var block. All onclick= attributes in HTML call sel(), which
   must be accessible on the global scope. Verify each tab switches the detail panel:
   CPU/Memory/Disk/Network/GPU/Context each show different content in #dbody.

   FONT SIZES (everything up from current — current is too small):
   - Base body: 14px
   - Nav metric value (.mcv): 18px
   - Detail header value (.dv): 32px
   - Stat values (.sv): 18px
   - Process list rows: 12px
   - Table cells: 12px
   - Tooltip text: 11px
   - Monospace labels: 10px (section headers, badges)
   - Footer: 10px

   PROCESS ACTION BUTTONS — MUST WORK:
   Every process row shows pause/priority/end buttons on hover.
   - pause: calls window._aegisInvoke('suspend_process', {pid}) — on success shows
     green "Paused ✓" text inline in the modal for 2 seconds, then closes.
     On failure: shows red "Failed: [reason]" inline. Modal stays open on failure.
   - priority: opens submenu with 5 levels. Selecting a level opens the implications
     modal, then calls window._aegisInvoke('set_process_priority', {pid, priority}).
     Same success/failure feedback pattern.
   - end: opens implications modal with process description from PROC_INFO lookup.
     Critical processes (svchost, lsass, csrss, dwm, msedgewebview2) show red
     "SYSTEM CRITICAL" warning. On confirm: calls
     window._aegisInvoke('kill_process_cmd', {pid}).
     Same success/failure feedback pattern.
   window._aegisInvoke is set inside the Tauri IPC init block. Process actions
   must check if window._aegisInvoke exists before calling — if not, show
   "AEGIS not connected" in the modal instead of silently failing.

   SNIPER PANEL — RIGHT PANEL TOP:
   Replace the static "sniper watching…" text with a canvas animation:
   - Canvas: full width of right panel, 72px tall
   - Animation: slow random-walk line (adds a new point every 80ms, ±4px drift,
     clamped to 10%-90% of canvas height)
   - Rendering: trailing line fading from 5% to 90% opacity (oldest to newest),
     1.2px stroke width in var(--accent) color
   - Current position: bright dot (r=2.5) at the latest point
   - Crosshair: faint dashed lines (3px dash, 4px gap, 35% opacity) through
     the current point — horizontal and vertical
   - Scan grid: horizontal lines every 12px at 4% opacity
   - When a sniper action fires (sniper_action event from Tauri): animate a
     spike — jump the line to 20% of canvas height, then decay back over
     8 frames. This gives visual confirmation that sniper acted.
   - Label: "SNIPER" in top-left (9px mono uppercase, dim color)
   - Status: "watching" or "N actions" in top-right (9px, accent color)
   Animation must use requestAnimationFrame with a 80ms setTimeout throttle.
   Must work correctly in both dark and light mode.

   TOOLTIP SYSTEM:
   - Delay: 900ms (not 300ms — tooltips appear deliberately, not nervously)
   - Every nav item, header pill, stat cell, table column header, confidence
     panel, sniper panel, and process action button has a tooltip.
   - Tooltip content is plain English: what it is, why it matters, what
     high/low means. See BACKLOG.md AEGIS-HELP-01 for coverage list.

   PROFILE SECTION — DEMOTED:
   Remove profile from header pills entirely.
   Add a small "MANUAL OVERRIDE" section at the very bottom of the right panel:
   - One line: "profile: [current or 'auto']" with a small "change" button
   - "change" opens the existing profile modal
   - Label: "override" in 9px mono uppercase
   - This section should feel like an advanced setting, not a primary feature
   - When no override is active, show "AMBIENT — auto-managing"
   - When override is active, show "OVERRIDE: [profile name]" in amber

   DISK TAB:
   Drive table shows: mount point, drive name/label, total GB, free GB, %used,
   read MB/s, write MB/s. Note at bottom: "Per-drive I/O requires WMI (coming in
   AEGIS-INTEL-01). Space and health data accurate now."
   Color: free space below 10% = red-crit, below 20% = amber.

   NETWORK TAB:
   Adapter table shows: adapter name (truncated at 24 chars), status (Up/Down),
   sent MB/s, recv MB/s. Values above 0.1 highlighted in accent color.
   Note at bottom: "Values near 0.00 = no traffic. Above 0.1 MB/s = active transfer."

   SPARKLINES in nav: use read/write sum for disk (not queue depth).
   Network sparkline: use total bytes/sec / 1048576. Scale: 20 MB/s = full bar.

3. Tauri IPC wiring verification:
   The IPC block (waitForTauri → listen → invoke) must set window._aegisInvoke = invoke
   BEFORE any process action can be called. Verify this is in the correct order.
   The metrics listener must correctly map Rust field names to SNAP fields:
   - m.cpu.percent → SNAP.cpu_percent
   - m.memory.used_mb → SNAP.memory_mb_used
   - m.memory.available_mb → SNAP.memory_mb_available
   - m.processes[i].cpu_percent → process_tree[i].cpu_percent (not cpu_user_ms)
   - m.processes[i].memory_mb → process_tree[i].memory_mb (already in MB from Rust)
   - m.disks → disk_stats.drives (mount, name, total_gb, available_gb,
     read_bytes_sec, write_bytes_sec)
   - m.networks → network_stats.adapters (name, received_bytes_sec,
     transmitted_bytes_sec — map to bytes_recv_sec and bytes_sent_sec)
   Process CPU display: use p.cpu_percent (0-100 float from Rust), not cpu_user_ms.
   Format: "14.2%" not "0.0s" — cpu_user_ms was never sent from Rust.

<!-- phase:execute -->

4. Build the installer:
   After ui/index.html is complete and verified, run BUILD.bat:
     cmd /c "D:\Projects\AEGIS\BUILD.bat"
   This runs cargo tauri build (~7 minutes). Wait for completion.
   If build fails: read the error output, fix the specific issue, retry once.
   If it fails twice: note in MORNING_BRIEFING and proceed to close without installer.
   On success: installer at D:\Tools\.cargo-target\release\bundle\nsis\AEGIS_4.0.0_x64-setup.exe

5. Quality gate:
   - npm run lint — 0 errors
   - npx tsc --noEmit — 0 errors
   - Open ui/index.html in a browser (file:///) to visually verify:
     · All 6 nav tabs switch the detail panel correctly
     · Light mode toggle changes colors and persists on reload
     · Sniper canvas animation is visible and moving
     · Profile override section is at the bottom of right panel, not prominent
     · Font sizes are visibly larger than before (compare to screenshot in BACKLOG)
   - Tauri IPC: if AEGIS is running, verify process action buttons appear on hover
     and the modal opens with correct process description

6. Portfolio compliance check — D:\Projects\AEGIS:
   - STATUS.md: update with AEGIS-COCKPIT-02 closed, next sprint opened
   - BACKLOG.md: mark AEGIS-COCKPIT-02 done with commit hash
   - CHANGELOG.md: add entry

7. Session close:
   FRICTION PASS: collect all friction. Triage FIX NOW / BACKLOG / LOG ONLY.
   Present to user before MORNING_BRIEFING.

   MORNING_BRIEFING.md — write to D:\Projects\AEGIS\ BEFORE git add.
   Sections: SHIPPED, QUALITY GATES, DECISIONS MADE BY AGENT,
   UNEXPECTED FINDINGS, FRICTION LOG, NEXT QUEUE.

   git add + commit + push (include ui/index.html, MORNING_BRIEFING.md,
   STATUS.md, BACKLOG.md, CHANGELOG.md).
   Commit via D:\Projects\AEGIS\commit-msg.txt.
   Use: "D:\Program Files\Git\cmd\git.exe" commit -F commit-msg.txt

CRITICAL CONSTRAINTS:
- ui/index.html is the ONLY file being modified. No Rust files touched.
- Shell: cmd (not PowerShell).
- Git: "D:\Program Files\Git\cmd\git.exe" full path.
- npm run lint must pass before git commit. 0 errors, 0 warnings.
- npx tsc --noEmit must pass. 0 errors.
- All onclick= attributes in HTML must call globally scoped functions.
  No function is inside an IIFE unless it is a pure utility (draw, ag, es, etc.).
  sel(), toggleTheme(), showProcModal(), execProcAction(), openPriMenu(),
  openPM(), closePM(), doSwitch() — all must be window-accessible.
- Process action buttons MUST give visible feedback. Silent failure is not acceptable.
- MORNING_BRIEFING.md written to D:\Projects\AEGIS\ BEFORE git add.

Project: D:\Projects\AEGIS
Shell: cmd (not PowerShell). cd /d D:\Projects\AEGIS
Git: "D:\Program Files\Git\cmd\git.exe" — full path required.

ACCEPTANCE CRITERIA:
  All 6 nav tabs switch the detail panel (CPU/Memory/Disk/Network/GPU/Context)
  Light mode toggle works and persists to localStorage
  Sniper canvas animation visible and moving in right panel top
  Process hover buttons appear; clicking each opens modal with correct content
  Process actions (pause/priority/end) call Tauri invoke and show success/error feedback
  Profile override is at the bottom of right panel, small, not prominent
  Font sizes visibly larger than the previous version
  npm run lint: 0 errors
  npx tsc --noEmit: 0 errors
  MORNING_BRIEFING.md written to D:\Projects\AEGIS\
  BACKLOG.md: AEGIS-COCKPIT-02 marked done
