# AEGIS Changelog

## [3.0.0-alpha.6] — 2026-03-24 (AEGIS-MCP-02)

### Changed
- `src/mcp/server.ts` — Full rewrite. v2 stub (5 tools) replaced with rich v3 publisher
  (14 tools). setIntelligence() method wires all v3 engines post-construction.

### New Tools
- aegis_status: Concise health summary — context, load tier, watches, confidence
- aegis_get_cognitive_load: Score + breakdown + human-readable interpretation
- aegis_get_context: Current context, confidence, active overlays
- aegis_get_system_snapshot: Full SystemSnapshot (all monitors + intelligence fields)
- aegis_get_process_tree: Spawn tree — parent/child relationships, memory, CPU
- aegis_get_runaways: Active sniper watches — z-scores, escalation state, duration
- aegis_get_action_log: Recent sniper actions with reasons and timestamps
- aegis_get_confidence: Confidence score, total decisions, auto mode unlock status
- aegis_get_session_summary: Current/recent session — duration, avg load, actions taken
- aegis_apply_policy_overlay: Programmatically apply context overlays (GREGORE integration)
- aegis_preflight: Audit + optimize machine for a target context (preview or apply)
- aegis_switch_profile: Switch resource profile
- aegis_set_timer / aegis_cancel_timer: Profile timer management

### Architecture
- GREGORE integration protocol: call aegis_get_cognitive_load before spawning intensive
  work. Call aegis_apply_policy_overlay('build') before a build sprint. Call
  aegis_get_runaways to check for active runaway processes before committing work.
- The preflight tool is the GREGORE entry point: aegis_preflight({context: 'build', apply: true})
  pre-configures the machine with one call before the first keystroke.

## [3.0.0-alpha.5] — 2026-03-24 (AEGIS-LEARN-01)

### Added
- `src/learning/store.ts` — LearningStore: SQLite sessions.db with work_sessions,
  action_outcomes, cognitive_load_samples, confidence_state tables. startSession/endSession
  lifecycle. recordAction() generates labeled outcome IDs. updateActionOutcome() marks
  implicit approval 60s post-action. recordExplicitFeedback() with signal + intensity weighting
  (strong signals = 5x). Confidence scoring: (approvals - rejections*2) / total, clamped 0-1.
  Auto mode unlocks at >= 30 decisions AND score >= 0.75. getConfidenceState(), getRecentSessions(),
  getBestSession(), getActionSuccessRate(). Singleton initLearningStore()/getLearningStore().
- `src/learning/load.ts` — CognitiveLoadEngine: 6-signal weighted composite score 0-100.
  Signals: CPU %, memory %, disk queue depth, DPC rate, active runaway count, tab count.
  Normalized against reference values. Equal weights at launch, tuneWeights() stub for Phase 2.
  getTier() → 'green' | 'amber' | 'red'. compute() returns full LoadBreakdown.
- `src/config/types.ts` — cognitive_load and confidence fields added to SystemSnapshot
- `src/status/server.ts` — POST /feedback route (action_id, signal, intensity), onFeedback()
  callback registration, renderLoad() (badge in header with tier color), renderConfidence()
  (chip row + progress bar + decisions until auto), both called from render(d)
- `src/tray/lifecycle.ts` — initLearningStore() + CognitiveLoadEngine init, setLearningEngine()
  on collector, session started at startup, context_changed ends/starts sessions,
  onFeedback wired to learningStore.recordExplicitFeedback(), store stopped on shutdown
- `src/status/collector.ts` — setLearningEngine() method, load computed each poll via
  loadEngine.compute(), load sample recorded, confidence state included in snapshot

### Architecture
- Confidence score uses weighted Bayesian-style accumulation. Strong negative signals in sacred
  contexts carry 5x weight. This asymmetry is intentional — false positives from Auto mode
  are more damaging to trust than slow confidence accumulation.
- Equal starting weights for cognitive load signals. Correlation analysis against negative
  feedback will tune them after 30 days. The equation is a beta, not a hardcoded truth.
- Session lifecycle is context-driven, not time-driven. Context changes = session boundary.
  This makes session data segmentable by what the user was actually doing.

## [3.0.0-alpha.4] — 2026-03-24 (AEGIS-SNIPER-01)

### Added
- `src/sniper/baseline.ts` — BaselineEngine: Welford online algorithm for running mean +
  variance per process per context. SQLite baselines.db. getDeviation() returns z-scores
  and ratios vs personal baseline. MIN_SAMPLES=20 before baseline is considered reliable.
  DEVIATION_ZSCORE_THRESHOLD=2.0. Singleton initBaseline()/getBaseline() factory.
- `src/sniper/engine.ts` — SniperEngine: 3 built-in rules (node-runaway, searchindexer-hog,
  generic-runaway), BLAST_DURATION_MULTIPLIER per blast radius category, graduated action
  path (throttle→suspend→kill), catalog gate (canActOn checked before every action),
  context exemptions per rule, cooldown tracking per process, EventEmitter sniper events
  (flagged/action_taken/recovered/deferred). getActiveWatches(), getRules(), addRule().
- `scripts/aegis-worker.ps1` — Three new PID-based IPC methods:
  throttle_process_pid (CPU→Idle + IO→VeryLow), suspend_process_pid (NtSuspendProcess),
  kill_process_pid (Stop-Process -Force)
- `src/config/types.ts` — sniper field added to SystemSnapshot (active_watches,
  recent_actions array)
- `src/status/collector.ts` — setSniperEngine(), recentSniperEvents buffer (last 20),
  sniper.ingest() called each poll with process data, sniper stats merged into snapshot
- `src/tray/lifecycle.ts` — initBaseline() + SniperEngine init, action callbacks wired
  to worker IPC (throttle/suspend/kill), context_changed wires to setContext(),
  engine stopped on shutdown
- `src/status/server.ts` — renderSniper() JS function (watch count + action log with
  color-coded actions), sniper HTML section, called from render(d)

### Architecture
- Baseline engine uses Welford online algorithm — no need to store all historical samples
  for variance computation. Mean + variance updated incrementally each sample.
- Sniper never acts on processes below MIN_SAMPLES baseline reliability threshold.
  "Not enough data" is always the right answer over a false positive.
- Blast radius multiplies duration thresholds: critical = never auto-act.
  The higher the blast radius, the more sustained the deviation must be before action.

## [3.0.0-alpha.3] — 2026-03-24 (AEGIS-CONTEXT-01)

### Added
- `src/context/engine.ts` — ContextEngine: PowerShell subprocess polls foreground window
  via Win32 GetForegroundWindow p/invoke every 2s. Tracks weighted focus time per process.
  8 context types: deep_work, build, research, meeting, media, gaming, idle, unknown.
  Rule evaluator: first rule with sufficient focus seconds wins. 20% weight decay every 30s.
  EventEmitter: emits 'foreground' and 'context_changed' events. Auto-respawns on exit.
- `src/context/policies.ts` — PolicyManager: composable policy stack (base + overlays).
  BUILTIN_POLICIES: browser-default, searchindexer-throttle, diagtrack-throttle.
  CONTEXT_OVERLAY_TEMPLATES: per-context overlay sets (deep_work, build, meeting, gaming).
  Methods: applyContextOverlays, pushOverlay, popOverlay, addBasePolicy, pruneExpired.
  Policy domains: browser, cpu, memory, services, network, watchdog.
- `src/config/types.ts` — context field added to SystemSnapshot (current, previous,
  confidence, switched_at, idle_since, active_overlays)
- `src/status/collector.ts` — setContextEngine() method, context state merged into
  snapshot each poll cycle, policyManager overlays surfaced as active_overlays
- `src/tray/lifecycle.ts` — ContextEngine + PolicyManager instantiated, context_changed
  event applies context overlays, engine started, setContextEngine called post-init,
  engine stopped on shutdown
- `src/status/server.ts` — Context section in HTML (context name, confidence chip,
  active overlay badges), renderContext() JS function, called from main render(d)

### Architecture
- Composable policy layer replaces static profiles. Context detection is event-driven
  (foreground window polling), not polling-based on process lists.
- Policy overlays are temporary and auto-applied on context transition. Base policies
  are permanent. Stack model: base + overlays, merged at action time.
- ContextEngine and PolicyManager are decoupled. Engine emits events; lifecycle.ts
  bridges them to policy application.

## [3.0.0-alpha.2] — 2026-03-24 (AEGIS-MONITOR-01)

### Added
- `scripts/aegis-worker.ps1` — 5 new IPC methods: `get_disk_stats` (per-drive I/O delta via
  Win32_PerfFormattedData_PerfDisk_LogicalDisk + SMART health via Get-PhysicalDisk),
  `get_network_stats` (per-adapter delta via Win32_PerfFormattedData_Tcpip_NetworkInterface +
  Get-NetAdapter metadata), `get_gpu_stats` (nvidia-smi primary with CSV parse, WMI
  Win32_VideoController fallback, silent on nvidia-smi absence), `get_system_extended`
  (DPC rate + interrupt rate via Win32_PerfFormattedData_PerfOS_Processor, page faults +
  reads via Win32_PerfFormattedData_PerfOS_Memory, uptime from Win32_OperatingSystem),
  `get_process_tree` (Win32_Process with ParentProcessId, WorkingSetSize, UserModeTime,
  KernelModeTime, HandleCount, ThreadCount — capped at 300 entries sorted by memory desc)
- `src/config/types.ts` — 6 new interfaces: DriveStats, PhysicalDiskHealth,
  NetworkAdapterStats, GpuStats, SystemExtended, ProcessTreeEntry. SystemSnapshot extended
  with optional fields: disk_stats, network_stats, gpu_stats, system_extended, process_tree
- `src/status/monitor-collector.ts` — MonitorCollector class. Polls extended metrics on
  independent slower cadences (disk/network/gpu 10s, system_extended 5s, process_tree 30s).
  Each metric wrapped in independent try/catch — one WMI failure never blocks others.
  Exposes getLatestExtended(): Partial<SystemSnapshot> merged by StatsCollector each 2s poll.
- `src/status/collector.ts` — setMonitorCollector() method, merge of getLatestExtended()
  into latestStats on every poll cycle
- `src/tray/lifecycle.ts` — MonitorCollector instantiated after worker start, wired to
  StatsCollector, stopped before StatsCollector on shutdown
- `src/status/server.ts` — 5 new HTML sections in status window: Disk (per-drive I/O bars,
  read/write MB/s, queue depth indicator, SMART health badges), Network (per-adapter recv/sent
  rates, status badge, link speed), GPU (hidden when unavailable, util%, VRAM bar, temp,
  power, source badge), System (DPC rate, interrupt rate, page faults/s, uptime — colour
  alerts on thresholds), Process Tree (collapsible, read-only, parent→child indented, 30s
  refresh). CSS for all new sections added inline.

### Architecture
- MonitorCollector is independent of StatsCollector's 2s poll cycle. It runs its own slower
  timers and caches the latest values. StatsCollector merges via Object.assign on every poll.
  No cross-metric dependencies — each metric degrades independently.
- nvidia-smi absence is silent by design. GPU section hidden when available=false. WMI fallback
  provides adapter name and VRAM total; utilisation/temp/power require nvidia-smi.
- Process tree is informational only this sprint. No actions wired to tree nodes (AEGIS-SNIPER-01).

## [3.0.0-alpha.1] — 2026-03-24 (AEGIS-CATALOG-01)

### Added
- `src/catalog/schema.ts` — CatalogDb class with full SQLite schema (process_catalog +
  unknown_processes tables), all interfaces (CatalogEntry, UnknownEntry, SeedEntry, etc.),
  WAL mode, foreign keys, indexed queries
- `src/catalog/seed.json` — 210 pre-seeded processes across all trust tiers:
  CRITICAL_SYSTEM (tier 1, no actions), DO_NOT_TOUCH (tier 2), CAUTION (tier 2, throttle only),
  SAFE apps/dev/browsers (tier 3, full action set). Includes node.exe and claude.exe with
  accurate blast radius ratings.
- `src/catalog/manager.ts` — CatalogManager singleton: recordObservation(), canActOn() gate,
  suspicion heuristics (no publisher + AppData/Temp path + external network + obs > 3),
  requestIdentification() with pending_identifications.json fallback, resolveProcess(),
  seedIfEmpty(), initCatalog() / getCatalog() factory
- `src/status/server.ts` — POST /catalog/identify (queues identification request),
  POST /catalog/resolve (moves unknown to catalog), onIdentificationRequest() +
  onCatalogResolve() callback registration, catalog HTML section with suspicious (red)
  and unresolved (amber) banners + counts
- `src/status/collector.ts` — setCatalog() method, recordObservation() called per process
  in poll loop, unresolved_count + suspicious_count in SystemSnapshot
- `src/config/types.ts` — unresolved_count? and suspicious_count? added to SystemSnapshot
- `src/tray/lifecycle.ts` — initCatalog() at startup, seedIfEmpty(), server callbacks wired
  (onIdentificationRequest → catalog.requestIdentification, onCatalogResolve → catalog.resolveProcess),
  catalog passed to StatsCollector via setCatalog()

### Architecture
- canActOn() is the process action gate — returns false for all unknown and suspicious processes.
  No sniper action can bypass this. The catalog is the prerequisite for all v3 intelligence.
- Catalog = factual knowledge only. Behavioral baselines observed fresh per machine.
  Two databases, never contaminating each other.

## [Unreleased]

### Added — AEGIS-ELEV-01
- `src/system/elevation.ts`: `checkIsElevated()` — async, PowerShell-based, session-cached
- Elevation gate in `ProfileManager.applyProfile()` — all privileged IPC calls guarded
- Startup elevation check in `lifecycle.ts` — one-time toast + warn log when not elevated
- `isElevated?: boolean` added to `SystemSnapshot` type and populated by `StatsCollector`
- Amber elevation warning indicator in status window (hidden when elevated)
- AEGIS-ELEV-01: elevation gate in manager.ts

## [AEGIS-PM2-01] — 2026-03-22
### Shipped — pm2 Migration + ESLint Gate Fix

**Added**
- `D:\Meta\ecosystem.config.cjs` — pm2 process config for dashboard-server.js. Name: `dashboard`, port 7171, autorestart, max_restarts 10, min_uptime 2s, log files at D:\Meta\dashboard-pm2.log / dashboard-pm2-err.log.
- `D:\Meta\bounce.bat` — single-command dashboard restart: `pm2 restart dashboard && pm2 list`.
- `D:\Meta\pm2-startup.bat` — placed in Windows Startup folder for logon-time pm2 resurrect (no elevation needed).
- `D:\Meta\PORTFOLIO_OS.md` — Appendix C: Infrastructure Notes documenting pm2 ownership of dashboard.

**Fixed**
- `src/browser/tab-manager.ts` — `launchBrave()` removed `async` keyword (function uses no `await`; fixes `@typescript-eslint/require-await`).
- `src/browser/cdp-client.ts` — removed unnecessary `as string` type assertion on `debuggerUrl` (introduced `resolvedDebuggerUrl` const after undefined guard); fixed `data.toString()` → `(data as Buffer).toString('utf-8')` to satisfy `no-base-to-string`.
- `src/tray/menu.ts` — removed dead `cdpPort` variable (assigned but never used; fixes `no-unused-vars`).
- `src/tray/lifecycle.ts` — removed `async`/`await` from `onLaunchBrave` callback (cascade from tab-manager fix).
- `src/tray/index.ts` — updated `onLaunchBrave` interface type from `() => Promise<void>` to `() => void`.

**Removed**
- Task Scheduler task `Dashboard-7171` confirmed absent (was already removed before this sprint).

**Design decisions**
- `pm2 startup` is Linux/macOS only — Windows boot integration uses Startup folder bat calling `pm2 resurrect` instead.
- `launchBrave` is synchronous by nature (uses `spawn` with `detached: true` + `unref()`); `async` was never needed and was a BRAVE-02 oversight.
- pm2 will take full port ownership after the pre-existing dashboard process (PID 13444, started outside pm2) is cycled. Dashboard serves correctly in the interim.

## [BRAVE-02] — 2026-03-22 — a364fd3
### Shipped — Status Window Tab Panel + Brave Launch Helper + Per-Profile Config (2026-03-22)

**Added**
- `src/browser/tab-manager.ts` — `getTabList()` returns tab array with id, title (truncated 40 chars), suspended flag, suspended_ago_min. `isCdpConnected()` exposes CDP connection state. `updateSuspensionConfig()` merges per-profile suspension overrides into active config (only defined fields overridden). `launchBrave(port)` exported function: searches standard Brave install locations, spawns with `--remote-debugging-port`, detached + unref'd. Shows toast if Brave not found.
- `src/config/types.ts` — `BrowserSuspensionOverride` interface + `BrowserTabEntry` + `BrowserTabsSnapshot` interfaces. `LoadedProfile` extended with optional `browser_suspension` field. `profileSchema` extended with optional `browser_suspension` zod validation. `SystemSnapshot` extended with optional `browser_tabs` field.
- `src/status/collector.ts` — `setTabManager(tabManager, browserEnabled)` method. `poll()` now builds `browser_tabs` snapshot from live `TabManager` state (stats + tab list + connection status) and injects into `SystemSnapshot`.
- `src/tray/lifecycle.ts` — `StatsCollector` instantiated after worker start, wired to `StatusServer.updateSnapshot`. `onLaunchBrave` callback in `TrayDependencies` wired to `launchBrave()`, with CDP-already-connected guard. `onProfileSwitch` now calls `globalTabManager.updateSuspensionConfig()` when new profile defines `browser_suspension`.
- `src/tray/index.ts` — `onLaunchBrave` added to `TrayDependencies`. `updateMenu` accepts `browserCdpPort` + `browserCdpConnected`. Click handler dispatches "Launch Brave (with CDP)" title.
- `src/tray/menu.ts` — `browserCdpPort` + `browserCdpConnected` added to `MenuBuildOptions`. Browser submenu now shows "Launch Brave (with CDP)" as first item (disabled + relabelled when CDP already active).
- `assets/status.hta` — `[K]` browser-section div added above quick-switch dots.
- `assets/status.js` — `renderBrowserTabs()` function: renders BRAVE header with active/suspended counts + MB freed badge, per-tab rows with ⏸ prefix and dim styling for suspended tabs, "disabled" state when not connected.
- `profiles/wartime.yaml` — `browser_suspension` block: enabled true, inactivity_threshold_min 5, memory_pressure_threshold_mb 2000.
- `profiles/idle.yaml` — `browser_suspension` block: enabled false.

**Design decisions**
- `StatsCollector` wiring closes the gap where `/status` returned 503 — snapshots now pushed on every 2s poll cycle.
- `launchBrave` uses `spawn` with `detached: true` + `child.unref()` — AEGIS never waits on Brave's process lifecycle.
- Per-profile suspension merges only defined fields; undefined fields keep global config values (safe partial override).
- Browser panel hidden when `browser_manager.enabled = false` or `browser_tabs` absent from snapshot — zero noise for non-Brave users.

### AEGIS-BRAVE-01 — Brave Tab Manager (2026-03-22)

**Added**
- `src/browser/cdp-client.ts` — WebSocket-based Chrome DevTools Protocol client. Connects to Brave's remote debugging endpoint, fetches tab targets, navigates tabs via `Page.navigate`, activates tabs via HTTP.
- `src/browser/tab-manager.ts` — Core tab tracking and suspension engine. Polls CDP for tab state, evaluates suspension eligibility by inactivity threshold or memory pressure, suspends tabs by navigating to a data: URI holding page, restores on demand.
- `src/config/types.ts` — Added `TabSuspensionConfig`, `BrowserManagerConfig`, `TabState` interfaces and corresponding Zod schemas (`tabSuspensionConfigSchema`, `browserManagerConfigSchema`). `AegisConfig` extended with `browser_manager` field.
- `aegis-config.yaml` — `browser_manager` section added. `enabled: false` by default (opt-in). Requires Brave launched with `--remote-debugging-port=9222`.
- `src/memory/manager.ts` — `setTabManager()` method, `checkMemoryPressure()` private method, `pressureInterval` for trim-disabled configs. Memory pressure state-change notifications fire to `TabManager`.
- `src/tray/lifecycle.ts` — `MemoryManager` and `TabManager` instantiated at startup. `onSuspendTabs` / `onRestoreTabs` callbacks wired into `TrayManager`.
- `src/tray/menu.ts` — `BrowserMenuStats` interface, optional `browserStats` field on `MenuBuildOptions`. Browser submenu rendered when stats present: tab count label + Suspend/Restore actions.
- `src/tray/index.ts` — `onSuspendTabs` / `onRestoreTabs` added to `TrayDependencies`. `updateMenu` accepts optional `browserStats`. Click dispatch handles both browser actions.
- `ws` + `@types/ws` added to dependencies.

**Design decisions**
- `browser_manager.enabled = false` — feature is fully opt-in, zero impact when disabled.
- All CDP calls wrapped in try/catch; `TabManager` stays running and retries on next poll if Brave is unreachable.
- Memory pressure fires on state *change* only (low→normal, normal→low) to avoid redundant notifications every poll cycle.
- Suspension holding page uses `data:` URI — CDP cannot navigate to custom `chrome://` or `about:` pages.
- `max_suspended_tabs` cap + minimum 1 active tab enforced at all times.
