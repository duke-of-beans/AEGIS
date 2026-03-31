Execute Sprint AEGIS-STA-01 — Startup Auditor for AEGIS.
Run after AEGIS-UI-01. AEGIS-SNP-05 can run in parallel.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\aegis\ARCHITECTURE.md
  Filesystem:read_file D:\Dev\aegis\STATUS.md
  Filesystem:read_file D:\Dev\aegis\sidecar\src\main.ts
  Filesystem:read_file D:\Dev\aegis\sidecar\src\catalog\manager.ts
  Filesystem:read_file D:\Dev\aegis\src-tauri\src\commands.rs
  Filesystem:read_file D:\Dev\aegis\ui\index.html
  Filesystem:read_file D:\Dev\aegis\IMPROVEMENTS_SPEC.md

Summary: AEGIS gains a Startup Auditor that enumerates everything running at boot —
registry Run keys, scheduled tasks, startup folder — cross-references each entry
against the process Catalog, and surfaces them in the cockpit sidebar under a
"Startup" section. After this sprint, what happened on 2026-03-30 (SoftLanding
tasks running silently, litestream CMD window unknown, cause of boot resource
spike undiagnosed) is impossible: AEGIS knows everything that starts at boot,
risk-rates it, and lets you disable any entry reversibly from the cockpit.

IMPORTANT: This sprint adds a Startup section to the cockpit sidebar established
by AEGIS-UI-01. Read ui/index.html carefully — the SIDEBAR_SECTIONS array is
the extension point. Do NOT add a hardcoded tab. Push into the existing array.

Tasks:

1. Create StartupAuditor — sidecar/src/startup/auditor.ts:

   Interface StartupEntry:
     id: string                    // unique: source + ':' + name
     name: string                  // display name
     source: 'registry_user' | 'registry_machine' | 'scheduled_task' | 'startup_folder'
     command: string | null        // executable path + args
     publisher: string | null      // from authenticode sig or null
     enabled: boolean
     last_run: string | null       // ISO string or null
     catalog_tier: number | null   // null if unknown
     risk: 'trusted' | 'unknown' | 'suspicious'
     notes: string | null

   Class StartupAuditor:
   - constructor(catalog: CatalogManager)
   - async audit(): Promise<StartupEntry[]>
     Four PowerShell one-shot enumerations — spawn, collect stdout, parse JSON, return merged array.
     Sort: suspicious first, then unknown, then trusted. Alpha within each group.

   - async disable(id: string): Promise<{ success: boolean; error?: string }>
     Registry entries: rename value with prefix '_AEGIS_DISABLED_' (HKCU inline, HKLM via RunAs).
     Scheduled tasks: Disable-ScheduledTask via PowerShell.
     Startup folder: rename file to filename + '.aegis-disabled'.
     All operations REVERSIBLE. Never delete.

   - async enable(id: string): Promise<{ success: boolean; error?: string }>
     Reverses disable. Strips prefix / restores extension / re-enables task.

   - getLastAudit(): StartupEntry[] | null

   PowerShell enumeration commands (one-shot each — no persistent process):

   HKCU Run:
   ```
   powershell -NoProfile -NonInteractive -Command ^
     "(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' ^
       -ErrorAction SilentlyContinue) | Select-Object * -ExcludeProperty PS* ^
       | ConvertTo-Json -Compress"
   ```

   HKLM Run:
   ```
   powershell -NoProfile -NonInteractive -Command ^
     "(Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Run' ^
       -ErrorAction SilentlyContinue) | Select-Object * -ExcludeProperty PS* ^
       | ConvertTo-Json -Compress"
   ```

   Scheduled tasks (non-Microsoft):
   ```
   powershell -NoProfile -NonInteractive -Command ^
     "Get-ScheduledTask | Where-Object { $_.TaskPath -notlike '\Microsoft*' } ^
      | ForEach-Object { $i = $_ | Get-ScheduledTaskInfo -EA SilentlyContinue; ^
        [PSCustomObject]@{Name=$_.TaskName;TaskPath=$_.TaskPath;State=[string]$_.State; ^
        LastRun=if($i){$i.LastRunTime.ToString('o')}else{$null}; ^
        Exe=($_.Actions|Select-Object -First 1).Execute; ^
        Args=($_.Actions|Select-Object -First 1).Arguments} } ^
      | ConvertTo-Json -Compress -Depth 3"
   ```

   Startup folder:
   ```
   powershell -NoProfile -NonInteractive -Command ^
     "Get-ChildItem '$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup' ^
      -ErrorAction SilentlyContinue ^
      | Select-Object Name,FullName,@{N='LastWrite';E={$_.LastWriteTime.ToString('o')}} ^
      | ConvertTo-Json -Compress"
   ```

   Risk classification per entry:
   - Extract process name from command path (basename, strip .exe)
   - catalog.lookup(name): CatalogEntry → risk='trusted', catalog_tier=entry.trust_tier
   - 'suspicious' → risk='suspicious'
   - 'unknown':
       If path contains \Temp\, \Downloads\, \AppData\Local\ (non-standard subdir) → risk='suspicious'
       Otherwise → risk='unknown'
   - Publisher: attempt GetAuthenticodeSignature via PowerShell on the exe path.
     If cert subject contains 'CN=Microsoft' → publisher='Microsoft'
     If cert found, extract CN= value → publisher=that value
     If no cert or path not found → publisher=null

   Use Filesystem:write_file ONLY. File may be 150+ lines — write in one call.
   Verify with Filesystem:read_text_file after writing.

2. Wire StartupAuditor into sidecar/src/main.ts:
   - Import { StartupAuditor } from './startup/auditor.js'
   - Instantiate after catalog is initialized: const startupAuditor = new StartupAuditor(catalog)
   - On sidecar start: await startupAuditor.audit() after 10s delay (let boot settle first)
     Log summary: "[STARTUP] X trusted, Y unknown, Z suspicious"
   - IPC message handlers:
       'get_startup_entries' → { entries: startupAuditor.getLastAudit() ?? [] }
       'disable_startup_entry' (payload: { id: string }) →
         startupAuditor.disable(payload.id) → forward result
       'enable_startup_entry' (payload: { id: string }) →
         startupAuditor.enable(payload.id) → forward result
   - Use Filesystem:write_file ONLY — read main.ts first, write back in full.
   - Verify with Filesystem:read_text_file after writing.

3. Wire Tauri IPC — src-tauri/src/commands.rs:
   Add three commands following the existing get_intelligence pattern:
   - get_startup_entries(): returns JSON string of StartupEntry[]
   - disable_startup_entry(id: String): sends to sidecar, returns JSON { success, error? }
   - enable_startup_entry(id: String): sends to sidecar, returns JSON { success, error? }
   Read commands.rs first. Write back the full file with additions.
   Use Filesystem:write_file ONLY. Verify with Filesystem:read_text_file.

4. Register commands in src-tauri/src/main.rs invoke_handler:
   Add: commands::get_startup_entries, commands::disable_startup_entry,
        commands::enable_startup_entry
   Read main.rs first. Add to the generate_handler! macro list.
   Use Filesystem:write_file ONLY. Verify.

5. Cockpit UI — add Startup section to SIDEBAR_SECTIONS in ui/index.html:

   IMPORTANT: Do NOT add a hardcoded tab. The SIDEBAR_SECTIONS array from AEGIS-UI-01
   is the extension point. Push this entry:
   ```javascript
   { id: 'startup', label: 'Startup', icon: '⚡', items: [] }
   ```

   Startup detail pane (rendered when sidebar 'startup' is selected):
   - Header: "Startup Entries — X total, Y unknown, Z suspicious"
   - Table columns: Risk | Name | Source | Command (truncated 50 chars) | Publisher | Last Run | Toggle
   - Risk column: 🔴 suspicious, 🟡 unknown, 🟢 trusted — plain emoji, no extra styling
   - Source: short label — "Registry (User)" / "Registry (Machine)" / "Task" / "Folder"
   - Command: truncated with title attribute for full path on hover
   - Publisher: value or "Unverified" if null (muted color, not red — unverified ≠ malicious)
   - Last Run: formatted date/time or "Never"
   - Toggle: [Disable] button if enabled=true, [Enable] button if enabled=false
     On click: invoke disable_startup_entry or enable_startup_entry, refresh list on response
   - Row height: 22px, consistent with Processes table density
   - Sort: suspicious first by default (matches auditor sort)
   - Refresh button in pane header: re-runs audit on demand

   Aesthetic: follows the utilitarian token set from AEGIS-UI-01. No cards. No borders
   beyond 1px table lines. Risk emoji is the only visual signal.

   Read ui/index.html first. Write back the full file with Startup pane added.
   Use Filesystem:write_file ONLY. Verify with Filesystem:read_text_file.

<!-- phase:execute -->

6. Quality gate:
   - npx tsc --noEmit in sidecar/ passes with 0 errors
   - cargo check in src-tauri/ passes with 0 errors
   - Launch aegis.exe → open cockpit → Startup section visible in sidebar
   - Click Startup → table renders with real entries from current machine
   - At minimum: LitestreamBrain and OneDrive entries should appear (known registry entries)
   - Risk classification correct: known Microsoft entries show trusted (green)
   - [Disable] button present on at least one entry

7. Portfolio compliance check — D:\Dev\aegis (10 minutes max):
   - STATUS.md: add AEGIS-STA-01, update open work
   - BACKLOG.md: close STA-01, open SRV-01 stub
   - CHANGELOG.md: add entry

8. Session close:

   FRICTION PASS — triage FIX NOW / BACKLOG / LOG ONLY.
   Present: "Session complete. [summary]
     [A] Fix now  [B] Just log  [C] Skip"
   Execute chosen path.

   MORNING_BRIEFING.md — write to D:\Dev\aegis\ BEFORE git add.
   Schema: D:\Dev\TEMPLATES\MORNING_BRIEFING_SCHEMA.md

   git add + commit + push. Commit via commit-msg.txt.
   Include: all new/modified files, MORNING_BRIEFING.md, STATUS.md,
   CHANGELOG.md, BACKLOG.md.

   Note: This sprint does NOT rebuild the binary — that is AEGIS-BUILD-02.
   Code written and type-checked. Binary rebuild is a separate step.

CRITICAL CONSTRAINTS:
- READ D:\Dev\aegis\ARCHITECTURE.md BEFORE TOUCHING ANYTHING.
- PHANTOM EDITS RULE: Filesystem:write_file or Filesystem:edit_file ONLY.
  Verify every write with Filesystem:read_text_file after writing.
- StartupAuditor must NEVER crash AEGIS if a PowerShell command fails.
  All subprocess spawns are wrapped in try/catch. Errors → log + return empty array.
- Disable operations are ALWAYS reversible. Never delete registry keys or files.
  Only rename/prefix/disable. This is non-negotiable.
- UI additions follow the AEGIS-UI-01 design system strictly.
  No glow. No cards. 22px row height. Risk emoji only. Use SIDEBAR_SECTIONS extension point.
- Elevation for HKLM registry disable: attempt RunAs. If denied: return { success: false,
  error: 'Elevation required — right-click AEGIS and Run as Administrator' }
- Sidecar quality gate: npx tsc --noEmit must pass 0 errors.
- MORNING_BRIEFING.md written to D:\Dev\aegis\ BEFORE git add. Included in commit.

MODEL ROUTING:
  Default model: sonnet
  Task 1 (StartupAuditor class): sonnet — substantial code with clear spec
  Task 2 (main.ts wiring): sonnet — integration
  Tasks 3-4 (Rust commands + main.rs): sonnet — Rust IPC following existing pattern
  Task 5 (cockpit Startup pane): sonnet — UI following AEGIS-UI-01 design system
  Tasks 6-8 (quality gate + close): haiku — mechanical
  Parallel sessions: No — serial

Project: D:\Dev\aegis
Shell: cmd (not PowerShell). cd /d D:\Dev\aegis
Git: git in PATH. Commit via commit-msg.txt. git commit -F commit-msg.txt
Sidecar: npx tsc --noEmit in sidecar/ for type gate.
Rust: cargo check in src-tauri/ for type gate.

ACCEPTANCE CRITERIA:
  sidecar/src/startup/auditor.ts exists and exports StartupAuditor class
  npx tsc --noEmit in sidecar/ passes with 0 errors
  cargo check in src-tauri/ passes with 0 errors
  Cockpit sidebar has Startup section (via SIDEBAR_SECTIONS push, not hardcoded tab)
  Startup detail pane renders real entries from current machine
  LitestreamBrain and OneDrive appear in the entry list
  Risk classification correct for known Microsoft processes
  Disable/Enable buttons functional (disable renames, enable restores)
  Elevated HKLM disable attempt returns meaningful error if denied
  MORNING_BRIEFING.md exists in D:\Dev\aegis\
