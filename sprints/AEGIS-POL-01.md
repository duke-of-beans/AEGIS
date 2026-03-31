Execute Sprint AEGIS-POL-01 — Policy Enforcement Engine for AEGIS.
Run after AEGIS-BUILD-01.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\aegis\ARCHITECTURE.md
  Filesystem:read_file D:\Dev\aegis\STATUS.md
  Filesystem:read_file D:\Dev\aegis\sidecar\src\main.ts
  Filesystem:read_file D:\Dev\aegis\sidecar\src\config\loader.ts
  Filesystem:read_file D:\Dev\aegis\src-tauri\src\commands.rs
  Filesystem:read_file D:\Dev\aegis\IMPROVEMENTS_SPEC.md

Summary: AEGIS gains a Policy Enforcement Engine that owns persistent OS-level
configuration — starting with Windows Defender disabled and Search web results off.
After this sprint, AEGIS checks policy state on every boot, re-applies any policies
that Windows Updates have reset, logs every enforcement action, and surfaces policy
status in the cockpit. The Defender battle becomes a permanent win, not a recurring fight.

Tasks:

1. Create policy manifest — %APPDATA%\AEGIS\policy.yaml default template:
   Write sidecar/src/policy/DEFAULT_POLICY.yaml (shipped with the sidecar, copied
   to %APPDATA%\AEGIS\ on first run if not present):
   ```yaml
   policies:
     - id: defender-realtime-off
       description: "Windows Defender real-time monitoring disabled"
       hive: HKLM
       path: SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection
       value_name: DisableRealtimeMonitoring
       expected_value: 1
       type: DWORD
       auto_enforce: true
       requires_elevation: true

     - id: defender-antispyware-off
       description: "Windows Defender antispyware disabled"
       hive: HKLM
       path: SOFTWARE\Policies\Microsoft\Windows Defender
       value_name: DisableAntiSpyware
       expected_value: 1
       type: DWORD
       auto_enforce: true
       requires_elevation: true

     - id: defender-antivirus-off
       description: "Windows Defender antivirus disabled"
       hive: HKLM
       path: SOFTWARE\Policies\Microsoft\Windows Defender
       value_name: DisableAntiVirus
       expected_value: 1
       type: DWORD
       auto_enforce: true
       requires_elevation: true

     - id: search-bing-off
       description: "Bing search results disabled in Windows Search"
       hive: HKCU
       path: SOFTWARE\Microsoft\Windows\CurrentVersion\Search
       value_name: BingSearchEnabled
       expected_value: 0
       type: DWORD
       auto_enforce: true
       requires_elevation: false

     - id: search-suggestions-off
       description: "Search box web suggestions disabled"
       hive: HKCU
       path: SOFTWARE\Policies\Microsoft\Windows\Explorer
       value_name: DisableSearchBoxSuggestions
       expected_value: 1
       type: DWORD
       auto_enforce: true
       requires_elevation: false
   ```
   File: sidecar/src/policy/DEFAULT_POLICY.yaml
   Use Filesystem:write_file ONLY.

2. Create PolicyEngine — sidecar/src/policy/engine.ts:
   Interface PolicyDef: id, description, hive (HKLM|HKCU), path, value_name,
   expected_value, type (DWORD|STRING), auto_enforce, requires_elevation.

   Interface PolicyResult: id, description, current_value, expected_value,
   compliant (boolean), enforced_at (string|null), drift_detected (boolean),
   enforcement_blocked (boolean — true if requires_elevation and not elevated).

   Class PolicyEngine:
   - constructor(manifestPath: string): loads yaml, falls back to DEFAULT_POLICY.yaml
   - async checkAll(): Promise<PolicyResult[]>
     Reads each registry key via PowerShell (spawn powershell one-shot per key).
     Returns array of PolicyResult with compliant flag.
   - async enforceAll(): Promise<PolicyResult[]>
     For each non-compliant policy where auto_enforce=true:
       If requires_elevation=false: write registry key directly via PowerShell.
       If requires_elevation=true: attempt via powershell -Verb RunAs one-shot.
         If denied: set enforcement_blocked=true, log warning, continue (don't crash).
     Returns updated PolicyResult array.
   - async auditAndEnforce(): Promise<PolicyResult[]>
     Calls checkAll() then enforceAll() for any non-compliant.
     Logs each enforcement action: "[POLICY] defender-realtime-off: drifted → re-enforced"
     Logs each blocked action: "[POLICY] defender-antispyware-off: drift detected, elevation blocked"
     Returns final state.
   - getLastAudit(): PolicyResult[] | null — returns cached last result

   Registry read via PowerShell (one-shot, no persistent process):
     powershell.exe -NoProfile -NonInteractive -Command
       "(Get-ItemProperty -Path 'HKLM:\...' -Name 'DisableRealtimeMonitoring' -ErrorAction SilentlyContinue).DisableRealtimeMonitoring"
   Registry write via PowerShell (HKCU, no elevation):
     powershell.exe -NoProfile -NonInteractive -Command
       "Set-ItemProperty -Path 'HKCU:\...' -Name '...' -Value 1 -Type DWord -Force"
   File: sidecar/src/policy/engine.ts
   Use Filesystem:write_file ONLY.

3. Wire PolicyEngine into sidecar/src/main.ts:
   - import { PolicyEngine } from './policy/engine.js'
   - Instantiate after other engines init
   - On sidecar start: call auditAndEnforce() once, log results
   - Schedule auditAndEnforce() every 6 hours (setInterval)
   - Expose policy state via existing sidecar IPC message type 'get_policy_status'
     Response: { policies: PolicyResult[] }
   - Use Filesystem:write_file ONLY — verify with Filesystem:read_text_file after

4. Wire Tauri IPC — src-tauri/src/commands.rs:
   Add command: get_policy_status
   - Sends 'get_policy_status' to sidecar via existing sidecar channel
   - Returns JSON string of PolicyResult[]
   - Pattern: follow existing get_intelligence command as template
   - Use Filesystem:write_file on the full commands.rs (read first, modify, write back)
   - Use Filesystem:write_file ONLY

5. Cockpit UI — ui/index.html, add Policy tab:
   - Add "Policy" tab button alongside CPU/Memory/Disk/Network/Processes tabs
   - Policy tab content: table with columns:
       Status (green dot = compliant, red dot = drifted, amber = blocked)
       Policy Name (description field)
       Expected / Current value
       Last Enforced (enforced_at or "never")
   - On tab open: invoke get_policy_status, render results
   - Blocked policies show amber with tooltip: "Requires elevation — run AEGIS as admin"
   - Read ui/index.html first, add Policy tab following existing tab pattern
   - Use Filesystem:write_file ONLY — verify with Filesystem:read_text_file after

<!-- phase:execute -->

6. Quality gate:
   - npx tsc --noEmit in sidecar/ passes with 0 errors
   - cargo check in src-tauri/ passes with 0 errors
   - Manually verify: launch aegis.exe → open cockpit → click Policy tab →
     all 5 policies shown with compliance status

7. Portfolio compliance check — D:\Dev\aegis (10 minutes max):
   - STATUS.md: update header, add AEGIS-POL-01 to open work (or close if shipped)
   - BACKLOG.md: update
   - CHANGELOG.md: add entry

8. Session close:

   FRICTION PASS — collect friction, triage FIX NOW / BACKLOG / LOG ONLY.
   Present: "Session complete. [summary]
     Friction: [X] fixable / [Y] backlog / [Z] info
     [A] Fix now  [B] Just log  [C] Skip"
   Execute chosen path.

   MORNING_BRIEFING.md — write to D:\Dev\aegis\ BEFORE git add.
   Schema: D:\Dev\TEMPLATES\MORNING_BRIEFING_SCHEMA.md

   git add + commit + push. Commit via commit-msg.txt.
   Include: all new/modified files, MORNING_BRIEFING.md, STATUS.md,
   CHANGELOG.md, BACKLOG.md.

   Note: This sprint does NOT rebuild the binary — that is AEGIS-BUILD-02.
   Code is written and type-checked. Binary rebuild is a separate step.

CRITICAL CONSTRAINTS:
- READ D:\Dev\aegis\ARCHITECTURE.md BEFORE TOUCHING ANYTHING.
- AEGIS is a Tauri 2 desktop app. Intelligence lives in sidecar/. Rust relays IPC only.
- Dead v2 artifacts: src/, assets/, scripts/, installer/, dist/, release/,
  build-release.mjs, root package.json, systray2, pkg, mshta — STOP if you see these.
- PHANTOM EDITS RULE: Filesystem:write_file or Filesystem:edit_file ONLY for all file edits.
  Verify every write with Filesystem:read_text_file. str_replace and Desktop Commander
  write to Claude's container, not David's disk.
- PolicyEngine must NEVER crash AEGIS if a registry read fails — all errors are caught,
  logged, and result in enforcement_blocked=true for that policy.
- Elevation for HKLM writes: attempt RunAs, handle denial gracefully. Never block startup.
- Sidecar quality gate: npx tsc --noEmit must pass 0 errors.
- MORNING_BRIEFING.md written to D:\Dev\aegis\ BEFORE git add. Included in commit.

MODEL ROUTING:
  Default model: sonnet
  Tasks 1-2 (policy yaml + engine.ts): sonnet — code generation with clear spec
  Task 3 (main.ts wiring): sonnet — integration wiring
  Task 4 (commands.rs): sonnet — Rust IPC command following existing pattern
  Task 5 (cockpit Policy tab): sonnet — UI following existing tab pattern
  Tasks 6-8 (quality gate + close): haiku — mechanical verification + session close
  Parallel sessions: No — serial

Project: D:\Dev\aegis
Shell: cmd (not PowerShell). cd /d D:\Dev\aegis
Git: git in PATH. Commit via commit-msg.txt. git commit -F commit-msg.txt
Sidecar: npx tsc --noEmit in sidecar/ for type gate.
Rust: cargo check in src-tauri/ for type gate.

ACCEPTANCE CRITERIA:
  sidecar/src/policy/engine.ts exists and exports PolicyEngine class
  sidecar/src/policy/DEFAULT_POLICY.yaml exists with 5 default policies
  npx tsc --noEmit in sidecar/ passes with 0 errors
  cargo check in src-tauri/ passes with 0 errors
  Cockpit has Policy tab showing compliance status for each policy
  PolicyEngine logs enforcement actions to AEGIS log on startup
  Non-compliant HKCU policies are auto-enforced on startup
  MORNING_BRIEFING.md exists in D:\Dev\aegis\
