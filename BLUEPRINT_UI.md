# AEGIS v2.0 — UI/UX Specification
## Every interface element, every interaction, every state

---

## Design System

**Theme:** Dark. Windows 11 aesthetic. Not web-looking.  
**Font:** Segoe UI (system font — native, zero overhead)  
**Accent color:** Shifts per active profile (defined in profile YAML `color` field)  
**Motion:** Subtle. 120-150ms ease-out. Nothing bouncy, nothing slow.  
**Iconography:** Simple geometric. Profile indicator = filled circle in profile color.  

**Profile color palette (defaults):**
```
idle          #6b7280  (gray)
build-mode    #22c55e  (green)
deep-research #3b82f6  (blue)
performance   #f59e0b  (amber)
wartime       #ef4444  (red)
presentation  #a855f7  (purple)

Custom profiles cycle through:
#14b8a6 (teal) → #f97316 (orange) → #ec4899 (pink) → #84cc16 (lime) → repeat
```

---

## 1. TRAY ICON

### Visual States

| State | Icon appearance |
|---|---|
| Normal | Solid colored shield in profile color |
| Profile switching | Shield pulses (opacity 100%→40%→100%, 150ms, 3x) |
| Worker offline | Shield desaturated (grayscale) + small orange dot bottom-right |
| Worker crashed/fatal | Shield turns orange, slow flash (1s on/off) until acknowledged |
| Hot-reloading profile | Shield + small spinning arc overlay (300ms) |

### Hover Tooltip
Updates every 2 seconds. Format:
```
AEGIS · Wartime · CPU 72% · RAM 54%
```
If worker offline:
```
AEGIS · Worker offline · Click for details
```

### Click Behavior
- **Left click:** Toggle status window open/closed
- **Right click:** Open tray context menu
- **Double click:** Same as left click (status window)

---

## 2. TRAY CONTEXT MENU (Right-click)

### Full menu structure:
```
┌────────────────────────────────────┐
│  AEGIS  ·  Wartime  ·  CPU 72%     │  ← non-clickable header, live, bold
├────────────────────────────────────┤
│  ○  Idle                           │  ← gray dot + name (inactive)
│  ○  Deep Research                  │
│  ○  Build Mode                     │
│  ✓ ●  Wartime                      │  ← checkmark + colored dot (active)
│  ○  Performance                    │
│  ○  Presentation                   │
├────────────────────────────────────┤
│  Timer                         ▶   │  ← submenu trigger
├────────────────────────────────────┤
│  Status Window                     │
│  Settings                          │
├────────────────────────────────────┤
│  Quit AEGIS                        │
└────────────────────────────────────┘
```

### Timer Submenu:
```
  Switch to... (current profile shown if timer active) ▶
  ──────────────────────────────
  30 minutes
  1 hour
  2 hours
  Custom...
  ──────────────────────────────
  Clear Timer                    ← grayed out if no timer active
```

Clicking "Custom..." opens the inline timer picker in the status window (opens it if not already open).

### Hover behavior:
Hovering a profile name shows its `description` as a tooltip after 400ms delay.

### Profile list ordering:
Profiles appear in the order defined in `aegis-config.yaml` under `profile_order:`. Unspecified profiles append alphabetically.

---

## 3. STATUS WINDOW

**Implementation:** HTML Application (mshta.exe) running `%PROGRAMFILES64%\AEGIS\assets\status.hta`.  
The HTA communicates with AEGIS via polling `http://localhost:8743/status` every 2 seconds.  
Profile switches and timer commands go via `POST http://localhost:8743/switch` etc.

**Window properties:**
- Width: 320px, height: auto (min 380px, max 560px)
- Frameless (no Windows titlebar chrome)
- Custom drag handle (the header bar)
- Always on top: yes
- No taskbar entry
- No focus steal on open

**Positioning:**
On open, calculate position based on system tray location:
- Taskbar bottom-right → window anchors to bottom-right, above tray
- Taskbar bottom-left → bottom-left
- Taskbar top → top-right
- Add 8px margin from taskbar edge
- Clamp to screen bounds (never partially off-screen)

**Open animation:** Slides in from the taskbar edge, 120ms ease-out.  
**Close animation:** Slides back out, 100ms ease-in.  
**Close trigger:** Click anywhere outside the window OR press Escape.

---

### Status Window Layout (annotated)

```
┌────────────────────────────────────┐
│  ⬡ AEGIS                    2.0  ✕ │  [A] Header
├────────────────────────────────────┤
│  ● WARTIME                         │  [B] Profile badge
│  Everything runs full speed.       │      (click = inline switcher)
├────────────────────────────────────┤
│  CPU  ████████████░░  72%           │  [C] System vitals
│  RAM  ████████░░░░░░  54%  8.7 GB  │
│  PWR  High Performance             │
├────────────────────────────────────┤
│  ELEVATED                   3      │  [D] Elevated processes
│  Claude.exe   High  High  ● live   │
│  chrome.exe   High  High  ● live   │
│  node.exe     High  High  ○ idle   │
├────────────────────────────────────┤
│  THROTTLED                  2      │  [E] Throttled processes
│  OneDrive.exe  Idle  BG   ● live   │
│  MsMpEng.exe   Idle  BG   ○ idle   │
├────────────────────────────────────┤
│  Worker   ● Online                 │  [F] System health
│  KERNL    ○ Offline                │      (green=ok, gray=offline, orange=error)
├────────────────────────────────────┤
│  ⏱ No timer active    [Set Timer]  │  [G] Timer row
├────────────────────────────────────┤
│  ● ● ● ● ● ●                       │  [H] Quick-switch dots (one per profile)
├────────────────────────────────────┤
│  ← build  →  wartime  10m ago      │  [I] Profile history strip
├────────────────────────────────────┤
│  Settings                  About   │  [J] Footer links
└────────────────────────────────────┘
```

---

### [A] Header Bar
- App icon (16px shield) + "AEGIS" text + version number right-aligned + ✕ close button
- Acts as drag handle — click+drag moves the window
- Background: very dark, slightly lighter than body
- ✕ closes window (does NOT quit AEGIS)

### [B] Profile Badge
- Large colored dot + profile display_name in 18px bold
- Profile description in 12px muted text below
- Full row is clickable → expands inline profile switcher (see below)
- Background accent: faint tint of profile color (5% opacity)
- Smooth color transition on profile change (300ms)

**Inline profile switcher (expanded state):**  
When user clicks the profile badge, the badge area expands downward to show all profiles as a stacked list with colored dots. Click one → switch + collapse. Click badge again or press Escape → collapse without switching.

### [C] System Vitals
- CPU bar: animated fill, updates every 2s, label shows percentage right-aligned
- RAM bar: shows `used%` fill, label shows `used% used GB` right-aligned
- Color coding: green <70%, amber 70-85%, red >85%
- PWR row: current power plan friendly name (not GUID)
- All three rows always visible, never collapse

### [D] Elevated Processes
- Section header "ELEVATED" + count badge (e.g. `3`)
- Each row: process name | CPU priority label | IO priority label | ● live or ○ idle dot
- `● live` = process is currently running (bright green dot)
- `○ idle` = process is not currently running (dim gray dot) — NOT an error, just not running
- If no elevated processes in active profile: section hidden
- Max 6 rows shown. If more: "+ N more" expander link

### [E] Throttled Processes
- Same structure as Elevated section
- If no throttled processes in active profile: section hidden

### [F] System Health
- Worker: `● Online` (green) / `⚠ Restarting` (orange) / `✕ Failed` (red)
- KERNL: `● Connected` (green) / `○ Offline` (gray — not alarming, KERNL is optional)
- If worker is Failed: shows [Restart Worker] button

### [G] Timer Row
**No timer active:**
```
⏱ No timer active                    [Set Timer]
```

**Timer active:**
```
⏱ 1:23:44 remaining → idle           [Cancel]
```
Countdown ticks every second. Profile target shown after arrow.

**Setting a timer (inline, no new window):**
Click [Set Timer] → row expands to:
```
Switch to  [Wartime ▾]  for  [90]  min    [Set]  [Cancel]
```
Profile dropdown shows all profiles. Number field: type or arrow keys. [Set] commits. [Cancel] collapses row back.

### [H] Quick-Switch Dots
- One colored circle per profile, in profile_order sequence
- Hover: tooltip shows profile display_name
- Click: switch immediately (no confirmation)
- Active profile: ring/outline indicator around its dot
- 28px diameter circles, 8px gap between

### [I] Profile History Strip
- Shows last 3 profile names as a breadcrumb with arrows and relative time
- Example: `deep-research → build-mode → wartime · 12m ago`
- Muted, smallest text in the window
- Taps into `state.json` profile_history array

### [J] Footer
- "Settings" left-aligned — opens settings window
- "About" right-aligned — opens About view within status window (or settings)
- Separator line above footer

---

## 4. SETTINGS WINDOW

**Implementation:** Separate HTA (`settings.hta`) — opens as a new window, not a panel within the status window.

**Window size:** 540px × 600px. Resizable with min constraints.  
**Has standard titlebar** (unlike status window — this is a proper app window).  
**Taskbar entry:** Yes, while open.

### Tab structure:
```
[General]  [Profiles]  [Integrations]  [Startup]  [About]
```

---

### General Tab

**Default Profile**
> Default profile: [Idle ▾]  
> Applied on startup and when no timer/auto-detection is active.

**Status Window**
> [✓] Open status window on startup  
> Status window port: [8743]  (advanced — most users never touch this)

**Auto-Detection**
> [  ] Enable auto-detection  
> Mode: (○) Suggest with notification  (●) Switch automatically  
> Cooldown after manual switch: [──────●──] 15 min  (range: 5–60)  
> After enabling, a brief explanation: "AEGIS watches running apps and suggests or switches profiles automatically."

**Notifications**
> [✓] Profile switch notifications  
> [✓] Timer expired notifications  
> [✓] Watchdog restart notifications  
> [✓] Worker crash notifications  
> [  ] KERNL connect/disconnect notifications  

---

### Profiles Tab

List of all loaded profiles. Each row:
```
●  Wartime          Everything runs full speed.         [Edit]  [Reset]
●  Build Mode       Claude + VSCode get priority.       [Edit]  [Reset]
```

- Colored dot = profile color
- [Edit] → opens profile YAML in default `.yaml` associated application (VSCode, Notepad++)
  - Below the button: small note "AEGIS auto-reloads on save — no restart needed"
- [Reset to Default] → copies the original default profile from install dir → overwrites user copy → reloads
  - Confirmation dialog: "Reset Wartime to default? Your customizations will be lost."
- [+ Import Profile...] button at bottom → file picker for .yaml → validates → copies to profiles dir
- [Open Profiles Folder] link → opens `%APPDATA%\AEGIS\profiles\` in Explorer

---

### Integrations Tab

**KERNL**
> [✓] Enable KERNL integration  
> Host: [localhost]  Port: [3001]  
> [Test Connection] → shows "● Connected to KERNL v5.0.1" or "✕ Connection failed: [error]"

**AEGIS MCP Server**
> [✓] Enable MCP Server  
> Port: [3742]  
> Claude Desktop config (copy this into claude_desktop_config.json):  
> ```json
> "aegis": {
>   "command": "C:\\Program Files\\AEGIS\\AEGIS.exe",
>   "args": ["--mcp"]
> }
> ```
> [Copy to Clipboard] button

---

### Startup Tab

**Task Scheduler**
> Startup task: ● Installed  
> Task name: AEGIS_Startup  
> Runs as: [current user] with elevation  
> [Verify Task] → checks task exists and is enabled  
> [Repair Task] → re-runs install-task.ps1  
> [Remove Task] → removes startup task (AEGIS still runs manually)

**Worker**
> Transport: (●) stdin/stdout  (○) Named pipe (advanced)  
> [Test Worker] → sends ping, shows round-trip latency: "Worker responded in 12ms"

---

### About Tab

```
AEGIS Cognitive Resource Manager
Version 2.0.0
Build 2026-02-26

[Check for Updates]  →  "✓ You're up to date" OR "v2.1.0 available → Download"

GitHub: https://github.com/duke-of-beans/AEGIS

[Open Log Folder]
[Copy Debug Info]  ← copies version, config, profile list, last 20 log lines to clipboard
```

---

## 5. WINDOWS TOAST NOTIFICATIONS

Used sparingly. Each notification type is toggleable in Settings → General.

### Profile switch (optional, default OFF):
```
AEGIS
Switched to Build Mode
```
Duration: 3s, no action buttons, auto-dismiss.

### Timer expired (default ON):
```
AEGIS — Timer Expired
Returned to Idle after 2 hours in Wartime.
```
Duration: 5s, no buttons.

### Auto-detection suggestion (always ON when auto-detect enabled):
```
AEGIS — Profile Suggestion
Code.exe and Claude.exe are running.
Switch to Build Mode?
[Switch]  [Dismiss]  [Don't ask again]
```
Duration: 10s. [Switch] → switches. [Dismiss] → closes. [Don't ask again] → disables suggestion for that trigger combination.

### Watchdog restart (default ON):
```
AEGIS — Process Restarted
Claude.exe was restarted (attempt 1 of 5).
```
Duration: 4s. Shows only if `watchdog_escalation: true` in config.

### Worker offline (always ON):
```
AEGIS ⚠ — Worker Offline
Resource management is paused. Attempting to reconnect...
```
Duration: persistent (stays until dismissed or worker recovers).

### Auto-detection paused (always ON):
```
AEGIS — Auto-Detection Paused
Too many profile switches in 10 minutes.
[Resume]
```
[Resume] button re-enables detection immediately.

---

## 6. UX PRINCIPLES

**Never block.** Profile switches, stat polling, worker restarts — all async. The tray never hangs.

**Never be alarming about things that aren't alarming.** KERNL being offline is not an error — it's shown in gray, not red. The user doesn't need to know or care if KERNL isn't running.

**No modal dialogs for non-destructive actions.** Switching profiles, setting timers, opening settings — all happen without confirmation. Destructive actions (reset profile, remove task) get a single inline confirmation.

**The status window is information-dense but not cluttered.** Every element earns its space. If it can be removed without losing important information, remove it.

**Fast.** Profile switch should feel instant. The tray menu should open without perceivable lag. The status window should show data immediately on open (not a loading spinner). Pre-fetch the stats before the window opens on left-click.

**Keyboard accessible.** Tab navigation throughout settings window. Escape closes status window and inline pickers.

