Execute Sprint AEGIS-INTEL-05 — Context Engine: Full Integration for AEGIS.
Run after AEGIS-INTEL-04 is complete. Can run in parallel with AEGIS-PROCS-01.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\AEGIS\STATUS.md
  Filesystem:read_file D:\Projects\AEGIS\BACKLOG.md
  Filesystem:read_file D:\Projects\AEGIS\sidecar\src\context\engine.ts
  Filesystem:read_file D:\Projects\AEGIS\sidecar\src\context\policies.ts
  Filesystem:read_file D:\Projects\AEGIS\sidecar\src\main.ts
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\sidecar.rs
  Filesystem:read_file D:\Projects\AEGIS\ui\index.html

Summary: After this sprint the context engine drives real behavior. Context changes
update sniper thresholds so deep_work raises tolerance for dev tools and build raises
tolerance for node/cargo. PolicyManager.applyContextOverlays() — which is fully
implemented but never called — gets wired to the context_changed event and starts
pushing/popping context overlays automatically. The cockpit context panel goes from
a static label to a live view: detected context, confidence bar, which processes are
driving detection, time in context, and the last 5 transitions. A manual context
lock lets the user pin context for 30, 60, or 120 minutes. Context history is
persisted to disk so AEGIS knows what you were doing before a restart.

Tasks:

1. Wire PolicyManager to context_changed in sidecar/src/main.ts:
   File: D:\Projects\AEGIS\sidecar\src\main.ts

   PolicyManager is fully implemented in context/policies.ts but is never
   instantiated or called. Wire it now.

   In initEngines(), after contextEngine is started:
     const { PolicyManager } = require('./context/policies')
     const policyManager = new PolicyManager()
     // Store as module-level variable alongside contextEngine
     // Make it accessible to the get_state and get_policies RPC methods

   Wire to context_changed event (the listener already exists in initEngines —
   extend it):
     contextEngine.on('context_changed', (evt: any) => {
       // existing writeEvent call stays
       // existing sniperEngine.setContext call stays
       // ADD:
       policyManager.applyContextOverlays(evt.to)
       writeEvent({
         type: 'policies_updated',
         context: evt.to,
         overlays: policyManager.getStack().overlays.map(p => ({
           id: p.id,
           name: p.name,
           domain: p.domain,
         })),
         timestamp: new Date().toISOString(),
       })
     })

   Also expire timed overlays on every heartbeat:
   In the existing setInterval heartbeat block, add:
     policyManager.pruneExpired()

   Add new RPC method 'get_policies' to handleRequest():
     case 'get_policies': {
       writeResponse(id, {
         base: policyManager.getStack().base.map(p => ({
           id: p.id, name: p.name, domain: p.domain
         })),
         overlays: policyManager.getStack().overlays.map(p => ({
           id: p.id, name: p.name, domain: p.domain,
           trigger_context: p.trigger_context, expires_at: p.expires_at ?? null
         })),
       })
       break
     }

   Add new RPC method 'lock_context' to handleRequest():
     case 'lock_context': {
       const { context, duration_min } = params ?? {}
       if (!context || !duration_min) {
         writeError(id, -32602, 'context and duration_min required')
         break
       }
       const expiresAt = Date.now() + (duration_min * 60 * 1000)
       // Override the context engine's detection for this duration
       // Approach: push a timed overlay that signals locked state to cockpit,
       // AND call contextEngine.setUserContext(context) to lock detection
       contextEngine.setUserContext(context)
       // Store the lock expiry so we can auto-release it
       policyManager.pushOverlay({
         id: 'manual-context-lock',
         name: `Context lock: ${context} for ${duration_min}min`,
         description: `User-locked context until ${new Date(expiresAt).toLocaleTimeString()}`,
         domain: 'cpu',
         created_at: new Date().toISOString(),
         is_overlay: true,
         trigger_context: context as any,
         expires_at: expiresAt,
       })
       writeEvent({
         type: 'context_locked',
         context,
         duration_min,
         expires_at: expiresAt,
         timestamp: new Date().toISOString(),
       })
       writeResponse(id, { ok: true, context, expires_at: expiresAt })
       // Auto-release: re-enable context detection after expiry
       setTimeout(() => {
         policyManager.popOverlay('manual-context-lock')
         writeEvent({ type: 'context_lock_released', timestamp: new Date().toISOString() })
       }, duration_min * 60 * 1000)
       break
     }

2. Wire context into sniper thresholds in sidecar/src/sniper/engine.ts:
   File: D:\Projects\AEGIS\sidecar\src\sniper\engine.ts

   Read the file first. SniperEngine already has setContext() wired (from INTEL-03).
   Extend the threshold logic so context changes deviation sensitivity:

   Add a method getContextMultiplier(context: string): number that returns:
     'deep_work' → 1.5   (more tolerant: dev tools spike during intense work)
     'build'     → 2.0   (most tolerant: node/cargo/rustc are legitimately busy)
     'meeting'   → 0.7   (tighter: background processes should stay quiet)
     'gaming'    → 0.8   (slightly tighter: games need resources for themselves)
     'media'     → 0.8   (tighter: media processes need stable resources)
     'idle'      → 0.5   (tight: runaway processes more visible when idle)
     default     → 1.0   (normal sensitivity)

   Apply the multiplier when evaluating deviation against threshold.
   Find where the z-score or deviation is compared to a threshold and
   multiply the threshold by getContextMultiplier(this.currentContext).

   If the file uses a fixed threshold constant, make it:
     const effectiveThreshold = BASE_THRESHOLD * this.getContextMultiplier(this.currentContext)

   Additionally: add process-name exemptions per context. When context is 'build',
   processes matching ['node', 'npm', 'cargo', 'rustc', 'tsc', 'msbuild', 'python',
   'python3', 'gradle', 'mvn'] should never be throttled by the sniper — they are
   expected to use resources. Add a shouldExempt(name: string, context: string): boolean
   method and call it before emitting any action. If exempt, skip the action and
   log at debug level.

3. Add context history persistence in sidecar/src/context/engine.ts:
   File: D:\Projects\AEGIS\sidecar\src\context\engine.ts

   Context history is lost on every restart. Add persistence.

   Add a private history array to ContextEngine:
     private history: Array<{from: ContextName, to: ContextName, confidence: number, at: number}>
     (max 50 entries — oldest trimmed on overflow)

   In transitionTo(), push to history on every real transition (not same→same):
     this.history.unshift({ from: previous, to: name, confidence, at: Date.now() })
     if (this.history.length > 50) this.history.pop()

   Add getHistory(): method that returns the last 5 entries:
     getHistory(): Array<{from: ContextName, to: ContextName, confidence: number, at: number}> {
       return this.history.slice(0, 5)
     }

   Persist history to disk on each transition (append-only, max 50 lines):
   Write to: path.join(os.homedir(), 'AppData', 'Roaming', 'AEGIS', 'context_history.jsonl')
   Each line is a JSON object: {from, to, confidence, at}
   On ContextEngine startup, read the last 50 lines and populate this.history.
   Use fs.appendFileSync for writes (sync is fine — these are infrequent, ~minutes apart).
   Use fs.readFileSync + split('\n') on start, filter empty lines, JSON.parse each,
   slice to last 50. Wrap all disk ops in try/catch — never crash on IO errors.

   Update get_state RPC to include history:
   In main.ts handleRequest case 'get_state', add to response:
     context_history: contextEngine?.getHistory?.() ?? []

4. Wire context state to cockpit — ui/index.html:
   File: D:\Projects\AEGIS\ui\index.html

   The cockpit currently shows a static context label. Replace with a live panel.

   a) Context changed event handler (intelligence_update listener already exists):
      When d.type === 'context_changed':
      - Update the context label element with d.context (capitalize first letter)
      - Update confidence bar width: Math.round(d.confidence * 100) + '%'
      - Update "time in context" counter (store switched_at = Date.now(), 
        update every 10s via setInterval: format as "Xm Ys")
      - Update focus weights display: top 3 processes by weight, shown as
        "node · 4m" "code · 12m" etc. — read from focus_weights in get_state response

   b) Context panel HTML (find the context section in right panel, extend it):
      Add these elements if not present:
        <div id="ctx-confidence-bar-wrap" style="...">
          <div id="ctx-confidence-bar" style="height:3px;background:var(--accent-green);transition:width 0.5s;width:0%"></div>
        </div>
        <div id="ctx-time-in" style="font-size:9px;color:var(--text-dim)">—</div>
        <div id="ctx-focus-drivers" style="font-size:9px;color:var(--text-dim)"></div>
        <div id="ctx-history" style="margin-top:6px"></div>

   c) Context history display:
      On get_state response and on context_changed events:
      Render last 5 transitions in #ctx-history as a compact timeline:
        deep_work → build · 14m ago
        build → deep_work · 1h ago
      Each entry: "{from} → {to} · {relative time}"
      Relative time: <1m = "just now", <1h = "Xm ago", else "Xh ago"
      Style: font-size 9px, color var(--text-dim), one line per transition,
      opacity 0.6 on entries older than 1 hour.

   d) Manual context lock button:
      In the context section of the right panel, add a small "lock" control:
        <div id="ctx-lock-wrap">
          <button onclick="openContextLock()" id="ctx-lock-btn">lock context</button>
          <span id="ctx-lock-status" style="display:none"></span>
        </div>
      openContextLock() opens a small modal with:
        - Current detected context shown
        - Select: "lock as [context] for" + dropdown [30 min / 60 min / 120 min]
        - [Lock] button calls: invoke('sidecar_lock_context', {context, duration_min})
          (new Tauri command — see task 5)
      When context_locked event fires: show lock status "🔒 [context] · Xm remaining"
      and hide lock button. Start countdown timer updating every minute.
      When context_lock_released event fires: hide status, show lock button again.

   e) Policies updated display (optional, system zone only):
      When policies_updated event fires: update a small indicator in the system
      zone showing active overlay count: "N overlays active" or hidden if 0.
      Not prominent — just informational. A single line is enough.

5. Add sidecar_lock_context Tauri command — src-tauri/src/commands.rs:
   File: D:\Projects\AEGIS\src-tauri\src\commands.rs

   #[tauri::command]
   pub async fn sidecar_lock_context(
       context: String,
       duration_min: u32,
       app: tauri::AppHandle,
   ) -> Result<String, String> {
       use crate::sidecar::send_to_sidecar;
       send_to_sidecar(&app, "lock_context", serde_json::json!({
           "context": context,
           "duration_min": duration_min,
       }));
       Ok(format!("Context locked to {} for {}min", context, duration_min))
   }

   Register in main.rs invoke handler alongside the other commands.
   Wire context_locked and context_lock_released events in sidecar.rs
   handle_sidecar_line to forward them to the cockpit WebView:
     "context_locked" | "context_lock_released" => {
         let _ = app.emit("intelligence_update", &json);
     }

<!-- phase:execute -->

6. Rebuild sidecar binary:
   cd /d D:\Projects\AEGIS\sidecar
   npm run build
   npx @yao-pkg/pkg . --target node20-win-x64 --output ..\src-tauri\binaries\aegis-sidecar-x86_64-pc-windows-msvc.exe
   Verify the binary has a newer mtime than before.

7. Quality gate:
   cd /d D:\Projects\AEGIS && npm run lint — 0 errors
   cd /d D:\Projects\AEGIS\src-tauri && cargo check — 0 errors
   Sidecar binary exists and is newer.
   Manual verify — if AEGIS is running:
     Switch to VS Code for 2+ minutes. Cockpit context panel should update
     to deep_work (or build if node is active). Confidence bar should be non-zero.
     Context history should show the transition.
   Check %APPDATA%\AEGIS\context_history.jsonl exists and has entries after
   at least one context transition.

8. Portfolio compliance check — D:\Projects\AEGIS:
   STATUS.md: verify 4-line header. Close AEGIS-INTEL-05 with commit hash.
   BACKLOG.md: mark AEGIS-INTEL-05 done.
   CHANGELOG.md: add entry for this sprint.

9. Session close:

   FRICTION PASS (before MORNING_BRIEFING):
   Triage FIX NOW / BACKLOG / LOG ONLY. Present to user:
     "Session complete. Context engine fully integrated — overlays, thresholds, cockpit.
      Friction: [X] fixable now / [Y] to backlog / [Z] informational
      [A] Fix now + log  ← default  [B] Just log  [C] Skip"
   Execute chosen path.

   MORNING_BRIEFING.md — write to D:\Projects\AEGIS\ BEFORE git add:
   Schema: D:\Dev\TEMPLATES\MORNING_BRIEFING_SCHEMA.md
   Sections: SHIPPED, QUALITY GATES, DECISIONS MADE BY AGENT,
   UNEXPECTED FINDINGS, FRICTION LOG, NEXT QUEUE.
   NEXT QUEUE: AEGIS-INTEL-06 (catalog/unknown queue — needs v4 rewrite of
   CATALOG-01 spec before it can be executed). AEGIS-HELP-01 (hover tooltips —
   no dependencies, can run immediately). AEGIS-DEVOPS-02 (CI pipeline).

   git add + commit + push — MORNING_BRIEFING.md included:
   Write commit message to D:\Projects\AEGIS\commit-msg.txt then:
   "D:\Program Files\Git\cmd\git.exe" -C D:\Projects\AEGIS add -A
   "D:\Program Files\Git\cmd\git.exe" -C D:\Projects\AEGIS commit -F D:\Projects\AEGIS\commit-msg.txt
   "D:\Program Files\Git\cmd\git.exe" -C D:\Projects\AEGIS push

CRITICAL CONSTRAINTS:
- Shell: cmd (not PowerShell). GREGORE profile interferes.
- Git: "D:\Program Files\Git\cmd\git.exe" — full path, quoted.
- PolicyManager is already fully implemented — do NOT rewrite it. Just instantiate
  and call applyContextOverlays(). Read policies.ts carefully before touching it.
- The sidecar binary MUST be rebuilt after any TypeScript changes. Source changes
  without binary rebuild will appear to do nothing.
- context_history.jsonl disk writes: always try/catch. A write failure must never
  crash the engine. The in-memory history array is the source of truth.
- The lock_context implementation uses contextEngine.setUserContext() which already
  exists. Do not implement a new locking mechanism — use what's there.
- 'build' context: node/cargo/rustc exemptions must NOT prevent logging. The sniper
  skips acting on these processes but still logs that it observed the deviation.
  The log line: "[exempt: build context] node deviation 2.3σ — no action taken"
- sidecar_lock_context Tauri command: register it in main.rs. If you forget to
  register, the invoke() from the cockpit will silently fail.
- MORNING_BRIEFING.md written BEFORE git add. Included in the commit.

ACCEPTANCE CRITERIA:
  policyManager.applyContextOverlays() called on every context_changed event
  policies_updated event emitted to cockpit on context change
  Sidecar responds to 'get_policies' RPC with base + overlays
  Sidecar responds to 'lock_context' RPC — returns {ok: true, expires_at}
  SniperEngine uses context multiplier: build context = 2.0× threshold
  Build-context process exemptions: node/cargo/rustc never actioned during build
  context_history.jsonl created at %APPDATA%\AEGIS\ after first transition
  context_history.jsonl survives sidecar restart (reads back correctly)
  Cockpit context panel shows: context name, confidence bar, time in context,
    top focus-driving processes, last 5 transitions
  Manual context lock: opens modal, invokes sidecar_lock_context, shows countdown
  context_locked event updates cockpit lock status display
  context_lock_released event restores lock button
  sidecar_lock_context Tauri command registered in main.rs
  npm run lint: 0 errors
  cargo check: 0 errors
  Sidecar binary newer than pre-sprint mtime
  MORNING_BRIEFING.md at D:\Projects\AEGIS\
  BACKLOG.md: AEGIS-INTEL-05 closed with commit hash
  CHANGELOG.md: sprint entry added
