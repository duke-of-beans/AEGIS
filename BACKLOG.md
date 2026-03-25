# AEGIS — MASTER BACKLOG
# Updated: 2026-03-25
# Philosophy: Foundation-out. No MVPs. Nothing ships half-built.
# Every sprint: acceptance criteria define DONE. No partial closes.

---

## WHAT ACTUALLY EXISTS TODAY (honest audit)

### Working
- Rust metrics core: CPU, RAM, network, processes — emits every 2s via Tauri events ✓
- Sidecar binary: compiles, spawns, stays alive, JSON-RPC over stdio ✓
- Context engine: spawns PowerShell, watches foreground window, detects context ✓
- Rust → WebView relay: sidecar events flow to cockpit ✓
- Tray icon: appears, menu works, left-click shows/hides cockpit ✓
- NSIS installer: builds, installs clean ✓
- CI: lint and typecheck passing (0 errors) ✓
- Custom mark icon: generated in make_icons.py ✓

### NOT Working / Never Built
- Sniper engine: wired in sidecar but SniperEngine constructor fails silently (missing baseline param)
- Cognitive load score: always 0, nothing updates it
- Learning store: feedback handler imported but never called
- Disk I/O per drive: hardcoded 0 in Rust — sysinfo doesn't expose it without WMI
- Tab navigation in cockpit: broken (scoping issue with sel())
- Light mode toggle: broken
- Process action buttons (pause/priority/end): not executing
- Desktop/taskbar icon: still Tauri default — installer needs rebuild with new icon
- Profile as ambient intelligence: not built — currently just manual profile switching

---

## P0 — COCKPIT: COMPLETE THE REWRITE (AEGIS-COCKPIT-02)

The AEGIS-COCKPIT-01 commit (c04c469) introduced the right architecture but the
index.html rewrite was interrupted mid-session and left in a broken state.
This sprint completes it completely and correctly.

- [ ] **AEGIS-COCKPIT-02** — Complete cockpit rewrite
  Fixes from this session's feedback:
  · Tab navigation: sel() must be globally scoped, not inside IIFE. All onclick= attributes
    call global functions. Verify every tab switches the detail panel correctly.
  · Light mode toggle: button wired with addEventListener, not onclick=. localStorage
    persists preference across sessions.
  · Process action buttons: pause/priority/end must invoke Tauri commands and give
    visual feedback (success state or error message inline in the modal — not silent).
  · Font sizes: everything up. Base 14px, process list 12px, stat values 17px+, headers 30px.
    Current state is too small vs comparable apps (see screenshot comparison).
  · Color palette: less blue, warmer neutrals. Replace --cyan as primary with a warmer
    accent. Cyan reserved for active/highlight states only. Dark bg warmer (#06080f ok,
    surface colors shift warmer).
  · Tooltip delay: 900ms (not 300ms). Tooltips should feel deliberate, not nervous.
  · Disk view: show accurate drive table. Note WMI limitation for IO. Show what IS
    accurate (free space, percent used, drive letters, labels).
  · Network view: values above 0.1 MB/s highlighted. Near-zero explained in footer note.
  · Sniper panel: live animated graph replacing "sniper watching" static text. Slow
    random-walk line with crosshair, fading trail, bright current dot. Tasteful, not gimmicky.
  · Profile section: demoted to bottom of right panel, labeled "MANUAL OVERRIDE."
    Not prominent. AEGIS should feel ambient, not profile-driven.
  · Process management modal: must execute AND confirm. On success show green "Done."
    On failure show red error with reason. No silent failures.
  · Tray/desktop icon: rebuild installer after icon fix. BUILD.bat.
  _Acceptance: Every tab switches. Light mode works and persists. Process actions
  execute and confirm. Font readable at arm's length. Sniper shows animation.
  Profile buried at bottom. Build installs with correct icon._

---

## P0 — DEVOPS: LINT GATE (AEGIS-DEVOPS-01) ✓ DONE 2026-03-25

- [x] **AEGIS-DEVOPS-01** — Pre-push lint gate (commit: 9428d99)
  `.git/hooks/pre-push` written and marked executable. Runs `npm run lint` on every
  push. Blocks with clear error output if lint fails. Emergency bypass documented.
  `CONTRIBUTING.md` created with Development section covering lint, typecheck, commit
  message workflow. Hook verified: injected lint error blocked correctly, removed clean.
  _Acceptance: MET — lint error blocks push. CI never receives broken commit._

---

## P1 — INTELLIGENCE LAYER: THE REAL BRAIN (foundation-out order)

These are the sprints that were always supposed to exist. Building in dependency order.
Nothing in this list is optional. This IS the product.

### AEGIS-INTEL-01 — Disk I/O via WMI

- [x] **AEGIS-INTEL-01** — Per-drive I/O metrics via WMI (DONE 2026-03-25 — see CHANGELOG)
  The sysinfo crate does not expose per-disk read/write bytes per second on Windows
  without WMI. This sprint adds WMI queries from Rust using the `wmi` crate.
  Queries: Win32_PerfFormattedData_PerfDisk_LogicalDisk for DiskReadBytesPersec
  and DiskWriteBytesPersec per drive letter.
  Wire into DiskMetrics struct (replace the hardcoded 0s).
  Update cockpit disk view to show live read/write MB/s per drive.
  Handle multiple drives (2, 3, 4+) — all shown in table, all in nav subtitle count.
  _Acceptance: Disk tab shows non-zero read/write when files are being copied.
  Adding a new drive is detected automatically on next refresh cycle._

### AEGIS-INTEL-02 — Cognitive Load Engine: Wire It

- [ ] **AEGIS-INTEL-02** — Wire cognitive load score to cockpit
  The CognitiveLoadEngine exists in the sidecar src but `cognitiveLoad` in main.ts
  is never updated. This sprint:
  · Instantiates CognitiveLoadEngine in initEngines()
  · Feeds it CPU, memory, and context state on each heartbeat
  · Emits `load_score_updated` event with current score
  · Rust relays to cockpit via `intelligence_update` event
  · Cockpit load number (currently always --) shows live 0-100 score
  · Color states: green <40, amber 40-70, red >70 with red-crit glow
  _Acceptance: Load number in header animates as CPU/memory changes.
  Sustained heavy load shows amber then red._

### AEGIS-INTEL-03 — Sniper Engine: Wire Baseline

- [ ] **AEGIS-INTEL-03** — Sniper engine with baseline — fully operational
  Currently SniperEngine fails silently because it receives no baseline parameter.
  This sprint:
  · Instantiates BaselineEngine in sidecar with correct db path
  · Passes baseline to SniperEngine constructor
  · Feeds process snapshots to baseline on each metrics event (from Rust via RPC)
  · SniperEngine evaluates deviation on every sample after MIN_SAMPLES (20) are gathered
  · On deviation above threshold: emits sniper_action_requested to Rust
  · Rust executes via set_process_priority or kill_process_cmd as appropriate
  · Action logged to cockpit action log with: process name, action taken, reason in
    plain English ("node.exe was 3.2× its normal CPU for this context — throttled")
  · Sniper animation in cockpit reacts: spike on action, normal oscillation at rest
  _Acceptance: After ~10 minutes of normal use, baseline has samples. A runaway
  process (can test by running a CPU stress script) triggers a logged sniper action._

### AEGIS-INTEL-04 — Learning Store: Wire Feedback

- [ ] **AEGIS-INTEL-04** — Learning store feedback loop operational
  LearningStore exists and starts but feedback is never recorded.
  This sprint:
  · Tray notification appears ~90 seconds after each sniper action:
    "AEGIS throttled [process]. Good call? [✓ Yes] [→ Neutral] [✗ No]"
  · User response recorded via LearningStore.recordExplicitFeedback()
  · Implicit approval: if no undo within 60s, record as mild positive
  · Strong negative feedback during sacred contexts (meeting, deep_work) worth 10×
  · Confidence score visible in cockpit context panel
  · Manual → Suggest → Auto progression: Auto mode offered only when
    confidence score exceeds threshold (configurable, default 75)
  _Acceptance: After 20 sniper actions with feedback, confidence score moves.
  At threshold, cockpit offers to enable Auto mode._

### AEGIS-INTEL-05 — Context Engine: Full Integration

- [ ] **AEGIS-INTEL-05** — Context engine fully wired to all systems
  Context engine is running but context changes don't influence sniper thresholds
  or produce meaningful cockpit output.
  This sprint:
  · Context changes update sniper evaluation thresholds (build context = higher
    tolerance for node.exe; idle context = stricter)
  · Context view in cockpit shows: detected context, confidence bar, focus weights
    (which apps are driving this detection), time in context
  · Context history: last 5 context transitions with timestamps
  · Manual context override: button in cockpit to lock context for 30/60/120 min
  · Context feeds into cognitive load calculation
  _Acceptance: Switching to a code editor for 2 minutes changes context to deep_work
  or build. Cockpit shows it. Sniper respects the context in its thresholds._

### AEGIS-INTEL-06 — Process Catalog: Live Unknown Queue

- [ ] **AEGIS-INTEL-06** — Process catalog with live identification queue
  Unknown processes are observed but never surfaced to the user.
  This sprint:
  · Cockpit catalog tab (or section in system view): shows unknown/suspicious processes
  · Each entry: process name, path, first seen, observation count, network connections
  · Inline resolve form: mark as trusted / suspicious / block with trust tier
  · Catalog API call via Claude (through MCP): "What is [process]?" — returns
    description, publisher, expected behavior, suggested trust tier
  · Suspicious processes (unknown + external network + suspicious path): shown with
    red-crit indicator. User notified via tray notification.
  _Acceptance: A never-before-seen process appears in the catalog queue within
  2 minutes of first observation. Claude can identify it on demand._

---

## P1 — AMBIENT INTELLIGENCE: PROFILES → OVERRIDE (AEGIS-AMBIENT-01)

- [ ] **AEGIS-AMBIENT-01** — Profiles demoted to manual override, ambient mode primary
  Profiles are currently the primary feature. They should be the escape hatch.
  This sprint:
  · Tray menu restructured: profiles moved to "Manual Override" submenu
  · Default state: "AMBIENT — AEGIS managing automatically"
  · Override active state: "OVERRIDE: wartime — click to release"
  · Cockpit right panel: profile override section at bottom, collapsed by default
  · Ambient mode: AEGIS decides resource allocation based on context + sniper + load
  · Individual process overrides: right-click any process row → set permanent priority
    override for this process. Stored in user config. Overrides survive restarts.
  · Override implications: before applying any individual override, modal explains
    "Setting node.exe to high priority will deprioritize everything else. AEGIS will
    not touch node.exe automatically while this override is active."
  _Acceptance: AEGIS launches in ambient mode. No profile shown. Smart allocation
  runs automatically. User can still force wartime via override submenu._

---

## P2 — PROCESS MANAGEMENT: COMPLETE (AEGIS-PROCS-01)

- [ ] **AEGIS-PROCS-01** — Process management fully operational with implications
  Process action buttons exist in cockpit but don't work.
  This sprint makes them work AND explains every action before and after:
  · Pause (suspend): freezes process, shows "PAUSED" badge on row, resume button appears
  · Priority change: submenu with 5 levels, each with plain-English explanation of
    what it does to other processes on the machine
  · End task: confirmation modal with process description, what will break, unsaved data
    warning where applicable. Critical processes (svchost, lsass, dwm) flagged red with
    "Do not end unless Windows says it's not responding"
  · After action: inline feedback in modal. Green "Done — [process] paused" or
    red "Failed — [reason in plain English]"
  · Action logged to AEGIS action log with timestamp and outcome
  · All process knowledge drawn from PROC_INFO lookup table (expandable by catalog data)
  _Acceptance: Pausing a process shows it frozen. Ending a process removes it from list.
  Setting priority changes it (verifiable in Task Manager). Every action produces
  visible confirmation or error. No silent failures._

---

## P2 — UI: HOVER HELP COMPLETE (AEGIS-HELP-01)

- [ ] **AEGIS-HELP-01** — Hover help system complete
  Every metric, every control, every panel section needs a tooltip.
  Plain English. What it is, why it matters, what high/low means.
  Coverage checklist:
  · All 6 nav items (CPU, Memory, Disk, Network, GPU, Context)
  · All stat cells in the 3-column stats bar
  · Header pills (CTX, NATIVE, AMBIENT)
  · Cognitive load number
  · Confidence bar
  · All table column headers
  · Sniper panel
  · Action log entries (what does "throttle" mean?)
  · Profile override section
  · All process action buttons
  · Light mode toggle
  _Acceptance: Hovering any meaningful UI element for ~1 second shows a tooltip
  with a title and 1-3 sentences of plain-English explanation._

---

## P2 — DEVOPS: COMPLETE CI PIPELINE (AEGIS-DEVOPS-02)

- [ ] **AEGIS-DEVOPS-02** — CI pipeline complete
  Current CI runs typecheck + lint only. build-and-release is broken (uses old
  NSIS path, not Tauri bundler, missing sidecar binary compilation step).
  This sprint:
  · CI check: typecheck + lint (already working)
  · CI build: `cargo tauri build` — produces NSIS installer
  · Sidecar build step: `npm run build:ts` + `pkg` in sidecar/ before Tauri build
  · Release artifact: AEGIS_4.x.x_x64-setup.exe uploaded to GitHub Release
  · Version bump automation: tag triggers release
  _Acceptance: Pushing a git tag vX.X.X triggers a full build and produces
  a downloadable installer in GitHub Releases._

---

## P3 — GPU MONITORING COMPLETE (AEGIS-GPU-01)

- [ ] **AEGIS-GPU-01** — GPU monitoring properly implemented
  Current GPU shows "--" because no GPU data is coming from Rust.
  nvidia-smi shell-out from Rust: parse utilization, VRAM used/total, temperature.
  AMD fallback: attempt WMI query for AMD GPU data.
  Intel integrated: attempt WMI for Intel GPU metrics.
  Cockpit GPU tab: utilization, VRAM bar, temperature, clock speed if available.
  _Acceptance: NVIDIA GPU shows live utilization % and VRAM. AMD best-effort.
  GPU tab shows "--" with explanation if no supported GPU found (not silent blank)._

---

## P3 — SNIPER: USER-DEFINED RULES (AEGIS-SNIPER-02)

- [ ] **AEGIS-SNIPER-02** — Custom sniper rules via cockpit UI
  Currently all sniper behavior is driven by baseline deviation defaults.
  This sprint adds user-defined rules:
  · Cockpit rules editor: add/edit/delete rules
  · Rule definition: target process, trigger condition (CPU > X for Y minutes),
    context exemptions, action (throttle/suspend/kill), cooldown
  · Each rule shows: last triggered, total triggers, outcome history
  · AEGIS suggests rules based on observed deviation patterns:
    "node.exe spikes during deep_work context. Want a rule?"
  _Acceptance: User can define a rule that fires when chrome.exe exceeds 40% CPU
  for 5 minutes outside a media context. Rule fires and logs._

---

## P3 — MCP SERVER: GREGLITE INTEGRATION (AEGIS-MCP-01)

- [ ] **AEGIS-MCP-01** — MCP server fully operational for GregLite
  Currently MCP uses stdio transport. GregLite integration requires this to work.
  The 14 MCP tools from v2/v3 need to be verified against v4 architecture.
  Each tool: verify it works, wire to correct v4 API, test from GregLite.
  _Acceptance: GregLite can call AEGIS MCP tools and get real data back._

---

## ICEBOX

- Code signing (SmartScreen bypass) — post revenue, needs EV cert
- AMD/Intel GPU monitoring beyond basic WMI — out of scope until requested
- AEGIS embedded in GregLite — was considered (Option A), decided against.
  AEGIS stays standalone. GregLite calls it via MCP. This decision is final.
- Settings UI (YAML editor in cockpit) — nice to have post-intelligence-layer
- Export / import baseline data — future sprint
