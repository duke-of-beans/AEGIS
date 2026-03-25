Execute Sprint AEGIS-INTEL-04 — Learning Store: Feedback Loop Operational for AEGIS.
Run after AEGIS-INTEL-03 is complete.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\AEGIS\STATUS.md
  Filesystem:read_file D:\Projects\AEGIS\BACKLOG.md
  Filesystem:read_file D:\Projects\AEGIS\sidecar\src\main.ts
  Filesystem:read_file D:\Projects\AEGIS\sidecar\src\learning\store.ts (or wherever LearningStore is)
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\tray.rs
  Filesystem:read_file D:\Projects\AEGIS\ui\index.html

Summary: After this sprint AEGIS learns from its own actions. Every sniper action
generates a feedback opportunity. Tray notifications appear ~90 seconds after each
action asking "Good call?" The user's response is recorded. Implicit approval
(no undo within 60 seconds) is also recorded as mild positive feedback. A confidence
score is visible in the cockpit context panel. At threshold (default 75), the cockpit
offers to enable Auto mode where AEGIS acts without confirmation.

Tasks:

1. Audit LearningStore:
   Read the full LearningStore implementation. Understand:
   - Constructor and initialization requirements
   - recordExplicitFeedback(action_id, signal, intensity) signature and types
   - recordImplicitFeedback(action_id, signal) if it exists
   - getConfidenceScore() or equivalent
   - What does it write to disk? Where?
   If LearningStore is a stub or incomplete, implement the minimum needed:
   - constructor(dbPath: string) — opens a SQLite db
   - recordFeedback(action_id: string, signal: 'positive'|'neutral'|'negative',
     intensity: 'strong'|'mild') — persists to db
   - getConfidenceScore() — returns 0-100 based on feedback history
     Simple formula: (positive_count * weight) / total_actions * 100
     Strong positive = 2, mild positive = 1, neutral = 0, mild negative = -1,
     strong negative = -3, strong negative in sacred context = -10

2. Wire LearningStore in sidecar/src/main.ts:
   In initEngines(), instantiate LearningStore:
     const lsPath = path.join(os.homedir(), 'AppData', 'Roaming', 'AEGIS', 'learning.db')
     learningStore = new LearningStore(lsPath)
     learningStore.start?.()
   Wire the existing 'feedback' RPC method (currently stubbed in main.ts):
     case 'feedback': {
       const { action_id, signal, intensity } = params ?? {}
       if (learningStore && action_id && signal) {
         learningStore.recordFeedback(action_id, signal, intensity ?? 'mild')
       }
       // Emit updated confidence score
       const score = learningStore?.getConfidenceScore?.() ?? 0
       writeEvent({ type: 'confidence_updated', score })
       writeResponse(id, { ok: true })
       break
     }

3. Tray notification after sniper action — src-tauri/src/tray.rs or sidecar.rs:
   When a sniper action fires (sniper_action_requested received in sidecar.rs):
   - Record the action_id (timestamp + pid + action as a string)
   - Schedule a tray notification 90 seconds later
   In Rust, use tokio::time::sleep to delay, then emit a "feedback_prompt" event
   to the cockpit WebView:
     tokio::time::sleep(Duration::from_secs(90)).await;
     let _ = app.emit("feedback_prompt", json!({
       "action_id": action_id,
       "process_name": name,
       "action": action,
       "timestamp": timestamp
     }));
   The cockpit WebView listens for "feedback_prompt" and shows a non-intrusive
   notification bar at the top of the action log:
     "AEGIS throttled [process]. Good call?"
     [✓ Yes] [→ OK] [✗ No] — clicking calls:
       window._aegisInvoke('sidecar_feedback', {action_id, signal, intensity})
     (or directly calls the sidecar via a new Tauri command)
   Implicit approval: in the sidecar, if no feedback is received within 60 seconds
   of an action, record mild positive automatically:
     setTimeout(() => {
       if (!feedbackReceived.has(action_id)) {
         learningStore?.recordFeedback(action_id, 'positive', 'mild')
       }
     }, 60_000)

4. Confidence score visible in cockpit — ui/index.html:
   In the context/confidence panel (right panel bottom):
   - Show confidence score: "X% confident" in small text below the bar
   - confidence_updated event from sidecar (relayed via intelligence_update):
     update the bar width and the text
   - At score >= 75: show a dim "enable auto mode?" link in the panel
     Clicking shows a modal explaining:
     "Auto mode: AEGIS will act on high-confidence sniper decisions without
     asking. You can disable it at any time. This is appropriate when you've
     confirmed 75+ actions with mostly positive feedback."
     [Enable Auto] [Not yet]
   - Auto mode state persists to localStorage.
   - When auto mode is ON: the confidence panel shows "AUTO MODE ACTIVE" in
     green. Actions still appear in the log — nothing becomes invisible.

<!-- phase:execute -->

5. Add sidecar_feedback Tauri command — src-tauri/src/commands.rs:
   #[tauri::command]
   pub async fn sidecar_feedback(action_id: String, signal: String, intensity: String,
     app: tauri::AppHandle) -> Result<String, String> {
     // Send feedback to sidecar via stdin channel
     // Use the same mechanism established in AEGIS-INTEL-02
     // Returns Ok("feedback recorded") or Err(reason)
   }
   Register in main.rs invoke handler.

6. Rebuild sidecar binary:
   cd /d D:\Projects\AEGIS\sidecar && npm run build
   npx pkg . --target node20-win-x64 --output ../src-tauri/binaries/aegis-sidecar-x86_64-pc-windows-msvc.exe

7. Quality gate:
   npm run lint — 0 errors
   cargo check — 0 errors
   Sidecar binary updated.
   learning.db created at %APPDATA%\AEGIS\learning.db after first feedback recorded.

8. Portfolio compliance check + session close (same pattern as previous sprints):
   STATUS.md, BACKLOG.md, CHANGELOG.md updated.
   MORNING_BRIEFING.md written to D:\Projects\AEGIS\ BEFORE git add.
   git add + commit + push. Commit via commit-msg.txt.

CRITICAL CONSTRAINTS:
- Shell: cmd (not PowerShell).
- Git: "D:\Program Files\Git\cmd\git.exe" full path.
- The 90-second notification delay is a tokio::spawn task. Never block the
  sniper action handler thread waiting for this.
- Implicit approval timer: never auto-record feedback if the action was undone.
  The sidecar should track whether 'suspend' or 'kill' was reversed — if the
  process reappeared within 60 seconds, skip implicit approval.
- Auto mode: persisted to localStorage, NOT to the sidecar db. It is a UI
  preference. Document this decision in MORNING_BRIEFING.
- MORNING_BRIEFING.md written BEFORE git add.

Project: D:\Projects\AEGIS
Shell: cmd. Git: "D:\Program Files\Git\cmd\git.exe" full path.

ACCEPTANCE CRITERIA:
  LearningStore instantiated without error (confirmed via sidecar.log)
  feedback RPC method records to learning.db
  Cockpit shows feedback prompt 90 seconds after a sniper action
  Clicking Yes/OK/No records to LearningStore and emits confidence_updated
  Confidence score visible in context panel, updates as feedback accumulates
  At 75+ confidence: "enable auto mode?" link appears in context panel
  npm run lint: 0 errors. cargo check: 0 errors.
  MORNING_BRIEFING.md written. BACKLOG.md: AEGIS-INTEL-04 done.
