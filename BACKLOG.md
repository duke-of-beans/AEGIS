# AEGIS — BACKLOG
Last Updated: 2026-03-24 (AEGIS-MONITOR-01 shipped)

---

---

## P1 — Intelligence Core

- [ ] AEGIS-UI-01: Command surface redesign
      Full HTML rebuild. Cockpit — every metric adjacent to its action.
      Spawn tree as default process view (indented, deviation indicators per node).
      Action log as permanent right panel (reasoning, not conclusions).
      Policy stack live panel (base + active overlays).
      Cognitive load score in header. Tier color system (gray/amber/red).
      Depends on: AEGIS-MONITOR-01.

- [ ] AEGIS-UI-01: Command surface redesign
      Per-process baseline engine — rolling mean + stddev per context per time bucket.
      Deviation detection — personal baseline trigger, not absolute values.
      Graduated action: throttle → suspend → kill with configurable thresholds.
      Context exemption rules. TESSRYX blast radius preview before Tier 3.
      Cooldown tracking per process per rule.
      Depends on: AEGIS-CATALOG-01, AEGIS-CONTEXT-01.

---

## P2 — Learning + MCP

- [ ] AEGIS-MCP-02: Rich MCP publisher
      Tools: get_cognitive_load, get_context, get_process_tree, get_system_snapshot,
      apply_policy_overlay, get_runaways, get_action_log, get_session_summary.
      GREGORE + GregLite integration protocols documented.
      Depends on: AEGIS-LEARN-01, AEGIS-SNIPER-01.

---

## P3 — Polish + Distribution

- [ ] AEGIS-INSTALLER-01: v3.0.0 installer rebuild
      NSIS updated for v3. SQLite binary bundled. Aesthetic standard applied.
      v2 → v3 config migration script.
      Depends on: AEGIS-MCP-02.

- [ ] Historical performance graphs (CPU/RAM sparklines over time)
- [ ] pm2 boot health-check — verify resurrect succeeded at logon

---

## Completed

- [x] AEGIS-MONITOR-01: Extended monitoring surface — disk I/O per-drive delta, SMART health,
      network per-adapter, GPU (nvidia-smi + WMI fallback), DPC/interrupt rate, hard page fault rate,
      process spawn tree (WMI ParentProcessId), handle/thread counts. MonitorCollector with independent
      per-metric try/catch, 5 new PowerShell IPC methods, 6 new TypeScript interfaces, 5 new HTML
      sections (disk, network, GPU, system, process tree). (2227b10, 2026-03-24)
- [x] AEGIS-CATALOG-01: Process knowledge base — SQLite catalog.db, 210-process seed,
      CatalogDb + CatalogManager, canActOn gate, suspicion heuristics, Claude ID bridge,
      /catalog/identify + /catalog/resolve endpoints, catalog HTML section in status window,
      wired into lifecycle + collector (2026-03-24)
- [x] AEGIS-CONTEXT-01: Context detection engine — PowerShell WinEvent poller, ContextEngine
      (8 context types, rule evaluator, focus weight decay), PolicyManager (composable stack,
      overlay system, CONTEXT_OVERLAY_TEMPLATES), context field in SystemSnapshot,
      renderContext in status window, wired into collector + lifecycle (2026-03-24)
- [x] AEGIS-LEARN-01: LearningStore (sessions.db, action outcomes, load samples, confidence
      state with weighted feedback scoring), CognitiveLoadEngine (6-signal composite 0-100,
      normalized pressures, equal weights learned over time), POST /feedback + onFeedback,
      renderLoad badge, renderConfidence progress bar, session lifecycle wired to context
      changes, wired into collector + lifecycle (2026-03-24)
- [x] AEGIS-SNIPER-01: BaselineEngine (Welford variance, baselines.db, per-process/context
      fingerprints, getDeviation z-scores, MIN_SAMPLES=20), SniperEngine (3 built-in rules,
      blast radius multipliers, graduated throttle→suspend→kill, catalog gate, context
      exemptions, cooldown tracking), worker PID methods, sniper section in status window,
      wired into collector + lifecycle (2026-03-24)
- [x] AEGIS-BRAVE-03: tab suspension UI, HTML command surface v1, per-profile CDP port (ca936bc, 2026-03-24)
- [x] AEGIS-ELEV-01: elevation gate, startup toast, amber indicator (2026-03-22)
- [x] AEGIS-PM2-01: pm2 migration, bounce.bat, startup resurrect (2026-03-22)
- [x] ESLint gate: all 26 source files clean (2026-03-22)
- [x] BRAVE-02: status window tab panel, Brave launch helper, per-profile suspension config
- [x] BRAVE-01: CDP client, tab tracking, suspension engine
- [x] v2.0.0 installer
- [x] Startup task removal
