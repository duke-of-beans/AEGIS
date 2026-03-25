Execute Sprint AEGIS-INTEL-02 — Cognitive Load Engine: Wire to Cockpit for AEGIS.
Run after AEGIS-INTEL-01 and AEGIS-COCKPIT-02 are both complete.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\AEGIS\STATUS.md
  Filesystem:read_file D:\Projects\AEGIS\BACKLOG.md
  Filesystem:read_file D:\Projects\AEGIS\sidecar\src\main.ts
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\sidecar.rs
  Filesystem:read_file D:\Projects\AEGIS\ui\index.html

Summary: After this sprint the cognitive load score in the cockpit header is a
live 0-100 number reflecting actual system pressure, not always "--". The
CognitiveLoadEngine in the sidecar calculates load from CPU, memory, and context
state. It emits updates to Rust via stdout, Rust relays to WebView, the cockpit
displays them. Green <40, amber 40-70, red >70 with glow.

Tasks:

1. Read and understand CognitiveLoadEngine:
   Filesystem:read_file D:\Projects\AEGIS\sidecar\src\learning\load.ts
   (or wherever CognitiveLoadEngine is defined — search sidecar/src/ if needed)
   Understand: what inputs does it need, what does it output, how is it constructed.
   If CognitiveLoadEngine does not exist or is a stub, note this and implement
   a minimal version in sidecar/src/learning/load.ts with this interface:
     class CognitiveLoadEngine {
       constructor()
       update(cpuPercent: number, memPercent: number, context: string): void
       getScore(): number  // returns 0-100
     }
   Implementation: score = (cpuPercent * 0.5) + (memPercent * 0.3) +
   (context === 'idle' ? 0 : 20). Clamp to 0-100. Simple baseline — will be
   improved in later sprints.

2. Wire CognitiveLoadEngine in sidecar/src/main.ts:
   In initEngines():
   - Import and instantiate CognitiveLoadEngine
   - Store as module-level variable: let loadEngine: CognitiveLoadEngine | null = null
   Add a new JSON-RPC method 'update_metrics' to handleRequest():
     case 'update_metrics': {
       // Rust sends this on every metrics poll cycle
       const cpu = params?.cpu_percent ?? 0
       const mem = params?.memory_percent ?? 0
       const ctx = contextEngine?.getState()?.current ?? 'unknown'
       if (loadEngine) loadEngine.update(cpu, mem, ctx)
       const score = loadEngine?.getScore() ?? 0
       cognitiveLoad = score  // update the module-level variable
       // Emit load update event to Rust
       writeEvent({
         type: 'load_score_updated',
         score,
         tier: score < 40 ? 'green' : score < 70 ? 'amber' : 'red',
         timestamp: new Date().toISOString(),
       })
       writeResponse(id, { ok: true, score })
       break
     }

3. Wire Rust to call 'update_metrics' on sidecar — src-tauri/src/sidecar.rs:
   The sidecar is communicated with via stdin (send JSON-RPC) and stdout (receive events).
   Currently Rust only reads from the sidecar — it never sends to it.
   Add a function to write a JSON-RPC request to the sidecar's stdin:
     async fn send_to_sidecar(child: &mut CommandChild, method: &str, params: serde_json::Value)
   In the metrics polling loop in metrics.rs (or via a new hook in sidecar.rs):
   After each metrics collection, send the CPU and memory percentages to the sidecar:
     send_to_sidecar(child, "update_metrics", json!({
       "cpu_percent": metrics.cpu.percent,
       "memory_percent": metrics.memory.percent
     })).await
   This requires passing the sidecar child handle to the metrics loop, or using
   a shared channel. Use a tokio::sync::mpsc channel:
   - sidecar.rs exposes a tx handle after spawning
   - metrics.rs receives the tx and sends update_metrics on each poll
   If this architecture is complex, use a simpler approach: store the child's
   stdin writer in AppState as Arc<Mutex<Option<...>>> and write from metrics.rs.
   Choose the cleanest approach and document it in MORNING_BRIEFING.

4. Wire 'load_score_updated' event in cockpit — ui/index.html:
   In the Tauri IPC block, the 'intelligence_update' listener already handles
   load score. Verify the sidecar event type 'load_score_updated' is handled
   in handle_sidecar_line in sidecar.rs:
     "load_score_updated" => {
       let _ = app.emit("intelligence_update", &json);
     }
   In the cockpit JS, the intelligence_update listener must:
   - Read d.score (the load score 0-100)
   - Update the load number element: document.getElementById('ln')
   - Set class: 'load-num g' for green, 'load-num a' for amber, 'load-num r' for red
   - Red tier: text-shadow glow with rgba(232,25,44,.45) — logo red

<!-- phase:execute -->

5. Rebuild the sidecar binary:
   The sidecar runs as a compiled binary (pkg). After changing sidecar/src/main.ts:
   cd /d D:\Projects\AEGIS\sidecar && npm run build (or whatever builds the TS)
   Then recompile the binary:
     npx pkg . --target node20-win-x64 --output ../src-tauri/binaries/aegis-sidecar-x86_64-pc-windows-msvc.exe
   Verify the binary exists at that path after compilation.
   If pkg is not installed: npm install -g @yao-pkg/pkg

6. Quality gate:
   cd /d D:\Projects\AEGIS && npm run lint — 0 errors
   cd /d D:\Projects\AEGIS\src-tauri && cargo check — 0 errors, 0 warnings
   Sidecar binary exists at src-tauri/binaries/aegis-sidecar-x86_64-pc-windows-msvc.exe
   If AEGIS is running: restart it and verify the load number in the header
   changes from "--" to a number, and responds to CPU load changes.

7. Portfolio compliance check — D:\Projects\AEGIS:
   - STATUS.md: update header, AEGIS-INTEL-02 closed
   - BACKLOG.md: AEGIS-INTEL-02 marked done with commit hash
   - CHANGELOG.md: add entry

8. Session close:
   FRICTION PASS: collect all friction. Triage FIX NOW / BACKLOG / LOG ONLY.
   Present to user before MORNING_BRIEFING.

   MORNING_BRIEFING.md — write to D:\Projects\AEGIS\ BEFORE git add.
   Sections: SHIPPED, QUALITY GATES, DECISIONS MADE BY AGENT,
   UNEXPECTED FINDINGS, FRICTION LOG, NEXT QUEUE.

   git add + commit + push (all modified files + MORNING_BRIEFING.md,
   STATUS.md, BACKLOG.md, CHANGELOG.md, sidecar binary if changed).
   Commit via D:\Projects\AEGIS\commit-msg.txt.
   Use: "D:\Program Files\Git\cmd\git.exe" commit -F commit-msg.txt

CRITICAL CONSTRAINTS:
- Shell: cmd (not PowerShell).
- Git: "D:\Program Files\Git\cmd\git.exe" full path.
- The sidecar binary is a compiled artifact. It must be rebuilt after any
  sidecar/src/*.ts changes. Do not commit source changes without the binary.
- All sidecar stdin/stdout communication is JSON-RPC 2.0 over newline-delimited
  JSON. Never write partial lines. Always terminate with \n.
- NEVER crash AEGIS if the sidecar is unavailable. All sidecar comms are
  best-effort. If the channel write fails, log and continue.
- CognitiveLoadEngine score: the formula in task 1 is a BASELINE. Do not
  over-engineer. Make it work first. Sophistication comes in INTEL-04.
- MORNING_BRIEFING.md written to D:\Projects\AEGIS\ BEFORE git add.

Project: D:\Projects\AEGIS
Shell: cmd (not PowerShell).
Git: "D:\Program Files\Git\cmd\git.exe" — full path required.

ACCEPTANCE CRITERIA:
  Cockpit load number shows a number (not "--") after AEGIS starts
  Number changes when CPU load changes (run a stress test to verify)
  Color: green <40, amber 40-70, red >70
  Red state: glow effect visible (text-shadow with red-crit color)
  npm run lint: 0 errors
  cargo check: 0 errors
  Sidecar binary updated at src-tauri/binaries/
  MORNING_BRIEFING.md written to D:\Projects\AEGIS\
  BACKLOG.md: AEGIS-INTEL-02 marked done
