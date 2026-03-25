Execute Sprint AEGIS-INTEL-03 — Sniper Engine with Baseline: Fully Operational for AEGIS.
Run after AEGIS-INTEL-02 is complete.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\AEGIS\STATUS.md
  Filesystem:read_file D:\Projects\AEGIS\BACKLOG.md
  Filesystem:read_file D:\Projects\AEGIS\sidecar\src\main.ts
  Filesystem:read_file D:\Projects\AEGIS\sidecar\src\sniper\engine.ts (or wherever SniperEngine is)
  Filesystem:read_file D:\Projects\AEGIS\sidecar\src\sniper\baseline.ts (or wherever BaselineEngine is)
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\sidecar.rs
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\commands.rs
  Filesystem:read_file D:\Projects\AEGIS\ui\index.html

Summary: After this sprint the Sniper Engine is actually running. It builds per-process
behavioral baselines over time and acts when a process deviates significantly from its
baseline for the current context. Actions (throttle/suspend/kill) are executed by Rust
via the existing commands. Every action is logged to the cockpit action log with a plain-
English explanation. The sniper canvas animation spikes visually when an action fires.

Tasks:

1. Audit sidecar sniper state:
   Read sidecar/src/sniper/engine.ts and sidecar/src/sniper/baseline.ts fully.
   Determine:
   - What does SniperEngine's constructor require? (likely a BaselineEngine instance)
   - What method receives process snapshots? (likely record() or feed())
   - What event does it emit when it wants to act? (likely 'action_requested')
   - What does the action payload contain? (pid, name, action, reason)
   - Does BaselineEngine need a db path? What does it write to?
   Document constructor signatures before writing any code.

2. Fix SniperEngine initialization in sidecar/src/main.ts:
   In initEngines(), currently SniperEngine fails silently because it receives
   no baseline parameter. Fix:
   - Instantiate BaselineEngine first with correct db path:
       const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'AEGIS', 'baseline.db')
       const baseline = new BaselineEngine(dbPath)
       baseline.start()
   - Pass baseline to SniperEngine:
       sniperEngine = new SniperEngine(baseline, catalogManager)
       (or whatever the correct constructor signature is — use what was audited in task 1)
   - Start the sniper: if sniperEngine.start exists, call it
   - Wire the action event:
       sniperEngine.on('action_requested', (action: any) => {
         writeEvent({
           type: 'sniper_action_requested',
           pid: action.pid,
           name: action.name,
           action: action.action,
           reason: action.reason,
           timestamp: new Date().toISOString(),
         })
       })

3. Feed process snapshots from Rust to sidecar:
   The sidecar needs per-process CPU/memory data to build baselines. This comes
   from the Rust metrics loop. Add a new RPC method 'update_processes' to
   handleRequest() in sidecar/src/main.ts:
     case 'update_processes': {
       const processes = params?.processes ?? []
       const context = contextEngine?.getState()?.current ?? 'unknown'
       if (sniperEngine?.feed) {
         sniperEngine.feed(processes, context)
       } else if (sniperEngine?.recordSamples) {
         sniperEngine.recordSamples(processes, context)
       }
       // (use whatever method name was found in task 1 audit)
       writeResponse(id, { ok: true })
       break
     }
   In Rust (sidecar.rs or metrics.rs): after each metrics poll, send process data
   to the sidecar via the stdin channel established in AEGIS-INTEL-02:
     send_to_sidecar(child, "update_processes", json!({
       "processes": metrics.processes.iter().map(|p| json!({
         "pid": p.pid,
         "name": p.name,
         "cpu_percent": p.cpu_percent,
         "memory_mb": p.memory_mb
       })).collect::<Vec<_>>()
     })).await

4. Wire sniper_action_requested in Rust — sidecar.rs:
   handle_sidecar_line already has a match arm for "sniper_action_requested".
   Verify it calls the correct Rust commands:
   - action "throttle": crate::commands::set_process_priority(pid, "idle".to_string())
   - action "suspend": crate::commands::suspend_process(pid)
   - action "kill": crate::commands::kill_process_cmd(pid)
   Emit "sniper_action" event to cockpit after executing:
     let _ = app.emit("sniper_action", &json!({
       "name": name,
       "pid": pid,
       "action": action,
       "reason": reason,
       "timestamp": chrono::Utc::now().to_rfc3339()
     }));

5. Wire sniper_action event in cockpit — ui/index.html:
   The 'sniper_action' Tauri event listener must:
   - Add the action to SNAP.sniper.recent_actions (prepend, max 20)
   - Call renderAlog(SNAP) to update the action log
   - Update the sniper canvas status text: "N actions"
   - Trigger the spike animation on the sniper canvas:
     Set a flag _sniperSpike = true; the canvas animation loop checks this
     flag and on the next frame, draws the line at 15% of height then decays
     back over 8 frames. Reset the flag after triggering.
   The action log entry must show in plain English. The 'reason' field from
   the sidecar contains technical text — map it to readable English:
     "X was 3.2× above its normal CPU for this context" stays as-is.
     If reason is empty or cryptic: show "Behavioral deviation detected."

<!-- phase:execute -->

6. Rebuild sidecar binary:
   cd /d D:\Projects\AEGIS\sidecar && npm run build (compile TypeScript)
   Then: npx pkg . --target node20-win-x64 --output ../src-tauri/binaries/aegis-sidecar-x86_64-pc-windows-msvc.exe
   Verify binary exists and has a newer modification time than before.

7. Quality gate:
   cd /d D:\Projects\AEGIS && npm run lint — 0 errors
   cd /d D:\Projects\AEGIS\src-tauri && cargo check — 0 errors, 0 warnings
   Sidecar binary updated.
   To verify sniper is running: wait 5 minutes, check that baseline.db exists
   at %APPDATA%\AEGIS\baseline.db (it will be created as process samples accumulate).
   Note: the sniper will not fire immediately — it needs MIN_SAMPLES (20) observations
   per process before it has a baseline. Document this in MORNING_BRIEFING.

8. Portfolio compliance check — D:\Projects\AEGIS:
   STATUS.md updated, AEGIS-INTEL-03 closed in BACKLOG.md, CHANGELOG.md updated.

9. Session close:
   FRICTION PASS first. Then MORNING_BRIEFING.md to D:\Projects\AEGIS\.
   git add + commit + push all changed files.
   Commit via D:\Projects\AEGIS\commit-msg.txt.

CRITICAL CONSTRAINTS:
- Shell: cmd (not PowerShell).
- Git: "D:\Program Files\Git\cmd\git.exe" full path.
- NEVER crash if sidecar is unavailable. All comms are best-effort.
- Sniper will NOT fire in this sprint under normal conditions — it needs baseline
  samples first. Do not add artificial triggers or timeouts. The architecture
  is correct when baseline.db is being written and sniperEngine is instantiated
  without error. Document expected behavior in MORNING_BRIEFING.
- The sidecar binary MUST be rebuilt after any TypeScript changes.
- MORNING_BRIEFING.md written to D:\Projects\AEGIS\ BEFORE git add.

Project: D:\Projects\AEGIS
Shell: cmd (not PowerShell).
Git: "D:\Program Files\Git\cmd\git.exe" — full path required.

ACCEPTANCE CRITERIA:
  SniperEngine instantiated without error in sidecar (confirmed via sidecar.log)
  BaselineEngine running, baseline.db created at %APPDATA%\AEGIS\baseline.db
  Process snapshots being sent from Rust to sidecar on each metrics cycle
  sniper_action_requested events wired to Rust execute commands
  Cockpit action log displays sniper actions with plain-English descriptions
  Sniper canvas spikes visually when an action fires
  npm run lint: 0 errors
  cargo check: 0 errors
  MORNING_BRIEFING.md written
  BACKLOG.md: AEGIS-INTEL-03 marked done
