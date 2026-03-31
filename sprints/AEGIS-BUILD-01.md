Execute Sprint AEGIS-BUILD-01 — Compile Clean Build + Runtime Verification for AEGIS.
Run FIRST. No dependencies.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\aegis\ARCHITECTURE.md
  Filesystem:read_file D:\Dev\aegis\STATUS.md
  Filesystem:read_file D:\Dev\aegis\src-tauri\Cargo.toml
  Filesystem:read_file D:\Dev\aegis\src-tauri\src\tray.rs
  Filesystem:read_file D:\Dev\aegis\src-tauri\src\metrics.rs
  Filesystem:read_file D:\Dev\aegis\ui\index.html

Summary: Produce a working AEGIS binary with the verified cockpit UI and all
committed runtime fixes active. After this sprint, aegis.exe runs, the tray
appears, the cockpit opens on click showing real CPU/RAM/process data, and
the sidecar starts without error. The binary at D:\Tools\.cargo-target\release\aegis.exe
is the deliverable.

Tasks:

1. Pre-build gate — verify source integrity:
   - Confirm src-tauri/src/tray.rs contains Arc<Mutex<bool>> CockpitVisible state
     (the tray bounce fix). If missing: STOP and write BLOCKED.md.
   - Confirm src-tauri/src/metrics.rs calls sysinfo refresh_all() twice at startup
     (the metrics zeros fix). If missing: STOP and write BLOCKED.md.
   - Confirm src-tauri/Cargo.toml and src-tauri/tauri.conf.json versions both read "4.0.0"
   - Confirm ui/index.html contains "connectTauri" and "__TAURI__.event.listen"
     (the verified cockpit from COCKPIT-REWRITE). If missing: STOP.
   - Run: cd /d D:\Dev\aegis\src-tauri && cargo check
     Must pass with 0 errors. Warnings are acceptable. If errors: fix before proceeding.

2. Build sidecar — D:\Dev\aegis\sidecar\:
   - cd /d D:\Dev\aegis\sidecar
   - npm install --include=dev
   - npm run build-and-bundle
   - Verify output: src-tauri/binaries/aegis-sidecar-x86_64-pc-windows-msvc.exe exists
   - If build-and-bundle fails: read the error, fix the immediate cause, retry once.
     If fails again: write BLOCKED.md, stop.

<!-- phase:execute -->

3. Build Tauri app — D:\Dev\aegis\:
   - cd /d D:\Dev\aegis
   - cargo tauri build
   - Expected outputs:
       Binary: D:\Tools\.cargo-target\release\aegis.exe
       Installer: D:\Tools\.cargo-target\release\bundle\nsis\AEGIS_4.0.0_x64-setup.exe
   - Build must complete with 0 errors. If it errors: read the full error, fix, retry once.
     If fails again: write BLOCKED.md, stop.

4. Runtime verification — launch and observe:
   - Launch: D:\Tools\.cargo-target\release\aegis.exe
   - Verify tray icon appears in system tray
   - Left-click tray icon — cockpit window must open without bouncing
   - Left-click again — cockpit must hide
   - Cockpit opened: verify CPU%, RAM%, process list are populated (not all zeros)
   - If metrics are all zero after 5 seconds: read %APPDATA%\AEGIS\logs\ for sidecar errors
   - Kill aegis.exe after verification (tray right-click → Quit)
   - Document what worked and what did not in MORNING_BRIEFING UNEXPECTED FINDINGS

5. ARCHITECTURE.md — update KNOWN ISSUES section:
   - Mark tray bounce fix as resolved (rebuilt) or still present (note exact symptom)
   - Mark metrics zeros fix as resolved or still present
   - Add any new runtime findings discovered in task 4
   - PHANTOM EDITS RULE: Use Filesystem:write_file ONLY

6. STATUS.md — update:
   - Add AEGIS-BUILD-01 to completed list with commit hash
   - Mark "Rebuild with new cockpit" P1 item as closed
   - Add any new open items discovered in runtime verification
   - PHANTOM EDITS RULE: Use Filesystem:write_file ONLY

7. Quality gate:
   - cargo check in src-tauri/ passes with 0 errors
   - npx tsc --noEmit in sidecar/ passes with 0 errors
   - aegis.exe exists at D:\Tools\.cargo-target\release\aegis.exe
   - Tray icon appears on launch
   - Cockpit opens with real data (not all zeros)

8. Portfolio compliance check — D:\Dev\aegis:
   Standard: D:\Meta\PORTFOLIO_OS.md §2–§8 (10 minutes max)
   - STATUS.md: verify 4-line machine-readable header
   - BACKLOG.md: verify exists, create from STATUS.md Open Work if missing
   - CHANGELOG.md: verify exists, create stub if missing

9. Session close:

   FRICTION PASS — collect all session friction, triage FIX NOW / BACKLOG / LOG ONLY.
   Present to user:
     "Session complete. [one-line summary]
      Friction: [X] fixable now / [Y] to backlog / [Z] informational
      [A] Fix now + log the rest  ← default
      [B] Just log  [C] Skip"
   Execute chosen path.

   MORNING_BRIEFING.md — write to D:\Dev\aegis\ BEFORE git add.
   Schema: D:\Dev\TEMPLATES\MORNING_BRIEFING_SCHEMA.md
   Sections: SHIPPED, QUALITY GATES, DECISIONS MADE BY AGENT, UNEXPECTED FINDINGS,
   FRICTION LOG, NEXT QUEUE.

   git add + commit + push.
   Commit message via commit-msg.txt. git commit -F commit-msg.txt
   Include: MORNING_BRIEFING.md, STATUS.md, ARCHITECTURE.md, CHANGELOG.md,
   BACKLOG.md, any source fixes applied during build.

CRITICAL CONSTRAINTS:
- READ D:\Dev\aegis\ARCHITECTURE.md BEFORE TOUCHING ANYTHING.
- AEGIS is a Tauri 2 desktop app. Three components: src-tauri/, sidecar/, ui/. Nothing else.
- Dead v2 artifacts — if you see or are tempted to create any of these, STOP:
  src/, assets/, scripts/, installer/, dist/, release/, build-release.mjs,
  root package.json, root tsconfig.json, VERSION file, systray2, pkg, mshta.
- PHANTOM EDITS RULE: To edit files on David's machine use ONLY Filesystem:write_file
  or Filesystem:edit_file. str_replace, create_file, Desktop Commander write to Claude's
  container, NOT disk. Verify every edit with Filesystem:read_text_file after writing.
- Rust quality gate: cargo check must pass 0 errors.
- Sidecar quality gate: npx tsc --noEmit must pass 0 errors.
- Build output: D:\Tools\.cargo-target\release\aegis.exe — NOT src-tauri/target/.
- Install target: D:\Program Files\AEGIS\ — NEVER C:\.
- MORNING_BRIEFING.md written to D:\Dev\aegis\ BEFORE git add. Included in commit.

MODEL ROUTING:
  Default model: sonnet
  Tasks 1-3 (pre-build + sidecar + cargo build): haiku — deterministic build commands
  Task 4 (runtime verification): sonnet — judgment required on what "working" means
  Tasks 5-9 (docs + close): haiku — mechanical updates
  Parallel sessions: No — serial

Project: D:\Dev\aegis
Shell: cmd (not PowerShell). cd /d D:\Dev\aegis
Git: git in PATH. Commit via commit-msg.txt. git commit -F commit-msg.txt
Rust: cargo tauri build from project root (D:\Dev\aegis), not from src-tauri/.
Sidecar: cd /d D:\Dev\aegis\sidecar && npm install --include=dev && npm run build-and-bundle
Build output: D:\Tools\.cargo-target\release\aegis.exe

ACCEPTANCE CRITERIA:
  cargo check in src-tauri/ passes with 0 errors
  npx tsc --noEmit in sidecar/ passes with 0 errors
  D:\Tools\.cargo-target\release\aegis.exe exists and is dated today
  Tray icon appears on launch
  Cockpit opens on tray left-click with real CPU/RAM/process data (not zeros)
  ARCHITECTURE.md KNOWN ISSUES updated with current state of each bug
  MORNING_BRIEFING.md exists in D:\Dev\aegis\
  STATUS.md: AEGIS-BUILD-01 closed with commit hash
