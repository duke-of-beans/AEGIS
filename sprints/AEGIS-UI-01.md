Execute Sprint AEGIS-UI-01 — Cockpit Redesign: Utilitarian Aesthetic + Task Manager Layout for AEGIS.
Run after AEGIS-BUILD-01. All subsequent UI-bearing sprints (POL-01, STA-01) depend on this.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\aegis\ARCHITECTURE.md
  Filesystem:read_file D:\Dev\aegis\STATUS.md
  Filesystem:read_file D:\Dev\aegis\ui\index.html
  Filesystem:read_file D:\Dev\aegis\VISION.md
  Filesystem:read_file D:\Dev\aegis\IMPROVEMENTS_SPEC.md

Summary: The cockpit gets a full visual and structural reset. The current UI leans
too far into aesthetics — glow, saturated cyan, heavy theme weight. This sprint
pulls it back to the utilitarian balance of Task Manager and Process Lasso: dense,
information-first, almost deliberately plain. After this sprint, the cockpit has a
stable design system that all subsequent tab additions (Policy, Startup, Services)
build into rather than fighting against.

This sprint also fixes all functional UX issues identified on 2026-03-29:
dashboard unification, meaningful metric bars, dark mode readability,
intervention graph markers, and the "I'm handling this" confidence language layer.

---

DESIGN DIRECTION (non-negotiable — agreed 2026-03-29):

Reference: Task Manager + Process Lasso visual language.
"Almost ugly on purpose. Information density over aesthetics.
Every element earns its space. Nothing decorative."

Specific rules:
- NO glow effects. NO box shadows with color. NO animated pulse rings.
- Color used ONLY for status signal: green=ok, amber=watch, red=action, gray=idle.
- Background: near-black (#0f0f0f dark, #f5f5f5 light). No tinted backgrounds.
- Accent: muted blue-gray (#4a6fa5 or similar) — NOT cyan. NOT neon.
- Font: system-ui or Segoe UI. Monospace for numbers only. No display fonts.
- Borders: 1px #2a2a2a dark / #d0d0d0 light. No border-radius > 3px on data tables.
- Typography: dense. Line heights tight. Tables should feel like tables.
- Process Lasso reference: the "list with bars" layout, not a dashboard with cards.

---

Tasks:

1. Design token reset — ui/index.html CSS variables section:
   Replace ALL current CSS variables with the utilitarian token set:

   Dark mode:
     --bg-primary: #0f0f0f
     --bg-secondary: #161616
     --bg-tertiary: #1e1e1e
     --border: #2a2a2a
     --text-primary: #e8e8e8
     --text-secondary: #9a9a9a
     --text-mono: #c8c8c8
     --accent: #4a6fa5
     --status-ok: #3d8b5e
     --status-warn: #b8860b
     --status-danger: #8b3a3a
     --status-info: #4a6fa5
     --bar-fill: #4a6fa5
     --bar-track: #252525

   Light mode:
     --bg-primary: #f5f5f5
     --bg-secondary: #ebebeb
     --bg-tertiary: #e0e0e0
     --border: #c8c8c8
     --text-primary: #1a1a1a
     --text-secondary: #5a5a5a
     --text-mono: #2a2a2a
     --accent: #2d5a8e
     --status-ok: #2d6e47
     --status-warn: #8a6200
     --status-danger: #6e2020
     --status-info: #2d5a8e
     --bar-fill: #2d5a8e
     --bar-track: #d0d0d0

   Remove: all glow variables, all neon variables, all animated gradient variables.
   Use Filesystem:write_file ONLY. Read full current file first.

2. Layout restructure — replace tab model with Task Manager sidebar model:
   Current structure: horizontal tabs across top (CPU / Memory / Disk / Network / Processes)
   New structure (Task Manager-style):

   LEFT SIDEBAR (fixed 180px):
     - Collapsible sections, each section is a resource category
     - Performance section: CPU, Memory, GPU, Disk 0, Disk 1, Network
       Each item: small sparkline (last 60s) + current value
       Click → detail pane opens on right
     - Intelligence section: Context, Sniper, Catalog, Learning
       Click → detail pane opens on right
     - [Future tabs added here: Policy, Startup, Services]

   MAIN PANE (flex: 1):
     - Shows detail for whatever sidebar item is selected
     - Default on open: CPU detail (same as Task Manager default)
     - Detail panes described in task 3

   HEADER (fixed top bar, minimal):
     - AEGIS wordmark left (small, not prominent)
     - Cognitive load score center: "Load: 34% [LOW]" — monospace, no card
     - Context pill right: "CTX: deep_work" — plain text, not glowing
     - Light / Dark toggle button far right — label: "Light" or "Dark" (not "Theme")
     - No other header elements

   BOTTOM STATUS BAR (fixed, 24px):
     - IPC status dot + "Sidecar connected" or "Sidecar offline"
     - Event count: "847 events"
     - Uptime: "4h 12m"
     - No animation. Plain text. Monospace for numbers.

3. Detail pane specifications — build each pane:

   CPU pane:
     - Large % number (48px monospace) + line graph (last 60 data points)
     - Per-core bars below: core 0, core 1... each a horizontal bar with % label
     - Frequency (GHz) + core count below graph
     - Graph line changes color on Sniper intervention:
       normal = var(--bar-fill), during intervention = var(--status-warn)
       A vertical marker line is drawn at the intervention timestamp

   Memory pane:
     - Total / In Use / Available in large monospace
     - Horizontal bar: used vs available (no animation, just width proportion)
     - Composition breakdown: in use / modified / standby / free — stacked bar
     - No donut charts. Horizontal bars only.

   Disk pane (one per detected disk, added dynamically):
     - Read MB/s + Write MB/s in large monospace
     - Dual-line graph: read (blue) + write (amber)
     - Disk name, type (SSD/HDD), total/free space below

   Network pane (one per adapter with traffic):
     - Send Mbps + Receive Mbps in large monospace
     - Dual-line graph: send + receive
     - Adapter name below

   Processes pane:
     - Table: Name | PID | CPU% | Memory (MB) | Disk MB/s | Status | Action
     - CPU% column: proportional bar behind the number (width = value/max * 100%)
       bars MUST scale to actual values — if max CPU% visible is 22.5%, that bar
       is full width and all others proportional to it. NOT all same size.
     - Memory column: same proportional bar treatment
     - Status column: colored dot — green (normal), amber (watching), red (actioned)
     - Action column: [Kill] button for catalog-permitted processes, blank otherwise
     - Sort: CPU descending by default. Click column header to re-sort.
     - Filter input above table: type to filter by name
     - Row height: 22px. Dense. Not padded.

   Context pane (Intelligence section):
     - Current context large + confidence %
     - Focus weight table: process name | focus seconds | weight %
     - Recent context history: list of from→to transitions with timestamps

   Sniper pane:
     - Active watches table: name | deviation σ | sustained (seconds) | state
     - Recent actions log: timestamp | process | action | reason
     - Rule list: all active rules with enable/disable toggle

   Catalog pane:
     - Stats: total known / unknown / suspicious counts
     - Unknown processes table: name | first seen | observation count | path
     - Suspicious processes: highlighted red, network connections shown

   Learning pane:
     - Confidence score: large % with milestone indicator
     - Mode: Manual / Suggest / Auto
     - Recent outcomes: action | process | outcome | weight

4. "I'm handling this" language layer:
   AEGIS should feel like it's working, not waiting. Specific copy changes:

   - Sidecar connected state: "Intelligence active" (not "Sidecar connected")
   - When Sniper has active watches: "Monitoring 3 processes" in status bar
   - When action taken: toast notification — "[AEGIS] Throttled msmpeng.exe —
     running 2.4σ above baseline for 3 minutes. CPU freed for your work."
   - When context switches: small status bar update — "Context: build detected"
   - When catalog has unknowns: "3 unidentified processes — review in Catalog"
   - When in auto mode: "AEGIS is managing resources automatically"
   - Idle state header: "AEGIS monitoring — all systems normal"

   All language: present tense, active, specific. No passive. No hedging.
   Never "Waiting for data." Always tell the user what AEGIS knows.

   Apply these strings throughout ui/index.html — no separate file needed.

5. Fix: proportional metric bars in Processes table:
   The bars under CPU% and Memory columns must scale relative to the maximum
   value visible in the current table view, not an absolute maximum.

   Implementation:
     After rendering process rows, calculate maxCpu and maxMem from visible rows.
     Set each bar's width as: (value / max) * 100 + '%'
     Re-calculate on every metrics update.
     If max is 0, all bars = 0% width.

6. Fix: dark mode text readability:
   Audit every text color in dark mode. Any instance of dark text (#1a1a1a,
   #333, #444, etc.) must be replaced with var(--text-primary) or var(--text-secondary).
   Pay specific attention to: table headers, column labels, sidebar labels,
   status bar text, tooltip content.

7. Fix: intervention graph markers:
   When a SniperEvent of type 'action_taken' arrives via IPC:
     Store {timestamp, processName, action} in an interventionLog array.
     On graph render: draw a vertical line at the x-position matching that timestamp.
     Line color: var(--status-warn) for throttle, var(--status-danger) for kill/suspend.
     On hover: tooltip shows "AEGIS throttled msmpeng.exe — 2.4σ above baseline"

   This applies to all line graphs in CPU, Memory, Disk, Network detail panes.

<!-- phase:execute -->

8. Slot reserved for future tabs — sidebar architecture must support extension:
   The sidebar sections must be defined in a JS array that other sprints can extend:
   ```javascript
   const SIDEBAR_SECTIONS = [
     { id: 'performance', label: 'Performance', items: [...] },
     { id: 'intelligence', label: 'Intelligence', items: [...] },
     // POL-01 adds: { id: 'policy', label: 'Policy', items: [...] }
     // STA-01 adds: { id: 'startup', label: 'Startup', items: [...] }
   ]
   ```
   This is the extension point. Do NOT hardcode section HTML.
   Generate sidebar from this array so future sprints just push to it.

9. Quality gate:
   - ui/index.html opens in Tauri WebView without JS errors
   - All tabs/panes render with real data (verify via aegis.exe launch)
   - No glow effects visible anywhere in dark mode
   - CPU% and Memory bars in process table scale proportionally
   - Light/Dark button label is "Light" or "Dark" (not "Theme")
   - All dark mode text is readable (no dark-on-dark)
   - Intervention marker lines render on graphs when test SniperEvent fired
   - Sidebar renders from SIDEBAR_SECTIONS array (verify by inspecting DOM)

10. Update ARCHITECTURE.md — add UI design system section:
    Document the token set, the sidebar extension pattern, and the aesthetic rules.
    This is the reference for all future cockpit work.
    Use Filesystem:write_file ONLY.

11. STATUS.md update:
    - Add AEGIS-UI-01 to completed list with commit hash
    - Close AEGIS-UI-01 in open work
    - Add AEGIS-POL-01 and AEGIS-STA-01 as next open items (now unblocked)
    Use Filesystem:write_file ONLY.

12. Portfolio compliance check — D:\Dev\aegis (10 minutes max):
    - BACKLOG.md: update with UI-01 closed, POL-01/STA-01/SNP-05 open
    - CHANGELOG.md: add UI-01 entry

13. Session close:

    FRICTION PASS — triage FIX NOW / BACKLOG / LOG ONLY.
    Present: "Session complete. [summary]
      Friction: [X] fixable / [Y] backlog / [Z] info
      [A] Fix now  [B] Just log  [C] Skip"
    Execute chosen path.

    MORNING_BRIEFING.md — write to D:\Dev\aegis\ BEFORE git add.
    Schema: D:\Dev\TEMPLATES\MORNING_BRIEFING_SCHEMA.md

    git add + commit + push. Commit via commit-msg.txt.
    Include: ui/index.html, ARCHITECTURE.md, STATUS.md, BACKLOG.md,
    CHANGELOG.md, MORNING_BRIEFING.md.

CRITICAL CONSTRAINTS:
- READ D:\Dev\aegis\ARCHITECTURE.md BEFORE TOUCHING ANYTHING.
- PHANTOM EDITS RULE: Filesystem:write_file or Filesystem:edit_file ONLY.
  Verify every write with Filesystem:read_text_file. Never use str_replace or DC write_file.
- ui/index.html is a single file. All CSS, HTML, and JS stay in that file.
  No separate CSS files. No separate JS files. This is a Tauri WebView, not a web app.
- The aesthetic direction is LOCKED: utilitarian, dense, Task Manager / Process Lasso.
  No glow. No neon. No cards with shadows. No animated gradients.
  If you find yourself adding visual flair — stop. Every element earns its space.
- DO NOT rebuild the binary in this sprint. Code change only. Binary rebuild = AEGIS-BUILD-02.
- Sidecar is NOT modified in this sprint. Only ui/index.html changes.
  If you think a sidecar change is needed: STOP and write BLOCKED.md.
- MORNING_BRIEFING.md written to D:\Dev\aegis\ BEFORE git add. Included in commit.

MODEL ROUTING:
  Default model: opus
  Tasks 1-4 (design tokens + layout restructure + detail panes + language layer): opus
    — This is a design system decision sprint. Opus for all judgment calls.
  Tasks 5-7 (bar fix + dark mode fix + intervention markers): sonnet
    — Specific implementation with clear specs. Sonnet sufficient.
  Tasks 8-9 (extension pattern + quality gate): sonnet — structured implementation
  Tasks 10-13 (docs + close): haiku — mechanical
  Parallel sessions: No — serial (each task builds on previous)

Project: D:\Dev\aegis
Shell: cmd (not PowerShell). cd /d D:\Dev\aegis
Git: git in PATH. Commit via commit-msg.txt. git commit -F commit-msg.txt
No build step — ui/index.html only. Tauri hot-reloads WebView for verification.

ACCEPTANCE CRITERIA:
  ui/index.html has sidebar layout (not top tabs)
  CSS variables section uses utilitarian token set (no glow vars)
  No visible glow or neon effects in dark mode
  Sidebar renders from SIDEBAR_SECTIONS JS array
  CPU% and Memory bars in process table scale proportionally to max visible value
  Light/Dark toggle button label is "Light" or "Dark" — not "Theme"
  All dark mode text is readable against dark backgrounds
  Intervention graph markers render on SniperEvent action_taken
  SIDEBAR_SECTIONS pattern documented in ARCHITECTURE.md
  MORNING_BRIEFING.md exists in D:\Dev\aegis\
  STATUS.md: AEGIS-UI-01 closed, AEGIS-POL-01 + AEGIS-STA-01 listed as next
