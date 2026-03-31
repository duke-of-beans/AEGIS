Execute Sprint AEGIS-SNP-05 — Instance Count Baseline + Sniper Rule Additions for AEGIS.
Run after AEGIS-POL-01. Can run in parallel with AEGIS-STA-01.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Dev\aegis\ARCHITECTURE.md
  Filesystem:read_file D:\Dev\aegis\STATUS.md
  Filesystem:read_file D:\Dev\aegis\sidecar\src\sniper\baseline.ts
  Filesystem:read_file D:\Dev\aegis\sidecar\src\sniper\engine.ts
  Filesystem:read_file D:\Dev\aegis\sidecar\src\main.ts
  Filesystem:read_file D:\Dev\aegis\IMPROVEMENTS_SPEC.md

Summary: The Sniper baseline engine gains instance_count as a tracked metric,
enabling AEGIS to detect process sprawl (e.g. 12 Claude processes = anomalous,
5 = normal). Three new default Sniper rules are added targeting Defender spikes,
SearchHost inflation, and Electron process sprawl. After this sprint, the scenario
from 2026-03-30 — 12 claude.exe processes consuming 1.4GB on a fresh boot — would
trigger a SniperEvent and tray notification within 30 seconds.

Tasks:

1. Extend baseline.ts — add instance_count tracking:
   File: sidecar/src/sniper/baseline.ts

   Schema additions to ProcessSample interface:
     instance_count: number  // how many instances of this process name are running

   Schema additions to ProcessBaseline interface:
     instance_mean: number
     instance_stddev: number

   Schema additions to DeviationReport interface:
     instance_count: number       // current count
     instance_ratio: number       // current / mean
     instance_zscore: number      // (current - mean) / stddev
     (update max_zscore to include instance_zscore in the Math.max())

   DB schema additions (add migration logic — ALTER TABLE IF column doesn't exist):
     process_baselines: add columns instance_mean REAL, instance_stddev REAL,
       instance_m2 REAL — all DEFAULT 0
     process_samples: add column instance_count INTEGER DEFAULT 1

   Welford update in updateBaseline():
     Add instance_count to the Welford online variance calculation
     (same pattern as cpu_mean/cpu_m2/cpu_stddev already present)

   getDeviation() additions:
     Add instance_count, instance_ratio, instance_zscore to returned DeviationReport
     Update max_zscore: Math.max(cpuZ, memZ, instanceZ)

   DB migration: run a safe ALTER TABLE for each new column inside initSchema()
     using "ALTER TABLE ... ADD COLUMN IF NOT EXISTS" pattern (SQLite ≥ 3.37 supports this,
     but the safer pattern is: check with PRAGMA table_info, add if missing).

   Use Filesystem:write_file ONLY. Read current file first, modify, write back in full.
   Verify with Filesystem:read_text_file after writing.

2. Extend engine.ts — instance count aggregation in ingest():
   File: sidecar/src/sniper/engine.ts

   The ingest() method receives an array of process objects. Currently processes
   are handled individually. Add pre-processing step:

   Before the per-process loop, build a count map:
     const instanceCounts = new Map<string, number>()
     for (const proc of processes) {
       const key = proc.name.toLowerCase().replace(/\.exe$/i, '')
       instanceCounts.set(key, (instanceCounts.get(key) ?? 0) + 1)
     }

   In the per-process loop, pass instance_count to baseline.record():
     const count = instanceCounts.get(normalized) ?? 1
     this.baseline.record({ ...proc, instance_count: count })

   For the deviation check — use the first instance of each process name for
   per-instance metrics, but always use the aggregated count for instance_zscore.
   Deduplicate by name before the deviation check (use a Set<string> already-checked).

   Add three new DEFAULT_RULES (add to DEFAULT_RULES array in engine.ts):
   ```typescript
   {
     id: 'msmpeng-spike',
     target_pattern: 'msmpeng',
     zscore_trigger: 2.0,
     duration_sec: 120,
     action: 'throttle',
     cooldown_min: 30,
     context_exemptions: [],
     enabled: true,
     user_defined: false,
   },
   {
     id: 'searchhost-inflation',
     target_pattern: 'searchhost',
     zscore_trigger: 1.5,
     duration_sec: 60,
     action: 'throttle',
     cooldown_min: 10,
     context_exemptions: [],
     enabled: true,
     user_defined: false,
   },
   {
     id: 'electron-process-sprawl',
     target_pattern: 'claude|discord|slack|code',
     zscore_trigger: 2.0,
     duration_sec: 30,
     action: 'notify',
     cooldown_min: 60,
     context_exemptions: [],
     enabled: true,
     user_defined: false,
   },
   ```

   Note on target_pattern matching for 'electron-process-sprawl': the pattern
   contains pipe characters for OR matching. Update findRule() to support pipe-separated
   alternatives: split on '|', check if normalized matches any segment.

   Use Filesystem:write_file ONLY. Read current file first, modify, write back in full.

3. Update main.ts — pass instance_count in metrics pipe from Rust to sidecar:
   File: sidecar/src/main.ts

   The metrics payload from Rust arrives as SystemMetrics. Check if process entries
   already include instance-level data or if they need to be aggregated.
   The aggregation in engine.ingest() (task 2) handles the counting — no change needed
   to the metrics pipe itself. Verify this is the case by reading how sniper.ingest()
   is called in main.ts. Document finding in MORNING_BRIEFING.

   Use Filesystem:write_file ONLY if any change is needed.

<!-- phase:execute -->

4. Extend process list in catalog — add missing entries for today's flagged processes:
   File: sidecar/src/catalog/seed.json (read first to understand format)

   Add entries if not already present:
   - msmpeng (Microsoft Antimalware Service): trust_tier: 2, blast_radius: high,
     action_permissions: ["throttle"], publisher: "Microsoft"
   - searchhost: trust_tier: 2, blast_radius: medium,
     action_permissions: ["throttle"], publisher: "Microsoft"
   - searchindexer: trust_tier: 2, blast_radius: medium,
     action_permissions: ["throttle"], publisher: "Microsoft"
   - litestream: trust_tier: 1, blast_radius: low,
     action_permissions: ["throttle", "suspend"], publisher: "Litestream"

   Read seed.json first. Add only if not already present. Write back in full.
   Use Filesystem:write_file ONLY.

5. Quality gate:
   - npx tsc --noEmit in sidecar/ passes with 0 errors
   - cargo check in src-tauri/ passes with 0 errors (no Rust changes expected,
     but verify nothing was accidentally touched)
   - Manually verify DEFAULT_RULES count in engine.ts is now 6 (was 3, +3 added)
   - Verify baseline.ts ProcessSample interface includes instance_count field

6. Portfolio compliance check — D:\Dev\aegis (10 minutes max):
   - STATUS.md: add AEGIS-SNP-05 to open work or close if shipped
   - BACKLOG.md: update
   - CHANGELOG.md: add entry

7. Session close:

   FRICTION PASS — triage FIX NOW / BACKLOG / LOG ONLY.
   Present: "Session complete. [summary]
     [A] Fix now  [B] Just log  [C] Skip"
   Execute chosen path.

   MORNING_BRIEFING.md — write to D:\Dev\aegis\ BEFORE git add.
   Schema: D:\Dev\TEMPLATES\MORNING_BRIEFING_SCHEMA.md

   git add + commit + push. Commit via commit-msg.txt.
   Include: all modified files, MORNING_BRIEFING.md, STATUS.md,
   CHANGELOG.md, BACKLOG.md.

CRITICAL CONSTRAINTS:
- READ D:\Dev\aegis\ARCHITECTURE.md BEFORE TOUCHING ANYTHING.
- PHANTOM EDITS RULE: Filesystem:write_file or Filesystem:edit_file ONLY.
  Verify every write with Filesystem:read_text_file after writing.
- baseline.ts DB migration must be safe for existing databases — never DROP or
  ALTER in a way that loses existing baseline data. Always check before adding.
- The electron-process-sprawl rule action is 'notify' ONLY — never throttle or kill
  an Electron app automatically. User must decide.
- Sidecar quality gate: npx tsc --noEmit must pass 0 errors.
- MORNING_BRIEFING.md written to D:\Dev\aegis\ BEFORE git add. Included in commit.

MODEL ROUTING:
  Default model: sonnet
  Task 1 (baseline.ts schema + migration): sonnet — careful schema evolution
  Task 2 (engine.ts aggregation + new rules): sonnet — logic + rule additions
  Task 3 (main.ts verify): haiku — read + verify, minimal change expected
  Task 4 (seed.json additions): haiku — data entry following existing format
  Tasks 5-7 (quality gate + close): haiku — mechanical
  Parallel sessions: No — serial (baseline must be done before engine)

Project: D:\Dev\aegis
Shell: cmd (not PowerShell). cd /d D:\Dev\aegis
Git: git in PATH. Commit via commit-msg.txt. git commit -F commit-msg.txt
Sidecar: npx tsc --noEmit in sidecar/ for type gate.

ACCEPTANCE CRITERIA:
  baseline.ts ProcessSample interface has instance_count: number field
  baseline.ts ProcessBaseline has instance_mean, instance_stddev fields
  baseline.ts DeviationReport has instance_count, instance_ratio, instance_zscore
  engine.ts DEFAULT_RULES count = 6 (3 original + 3 new)
  engine.ts findRule() supports pipe-separated OR patterns
  engine.ts ingest() aggregates instance counts before per-process baseline recording
  seed.json contains entries for msmpeng, searchhost, searchindexer, litestream
  npx tsc --noEmit in sidecar/ passes with 0 errors
  MORNING_BRIEFING.md exists in D:\Dev\aegis\
