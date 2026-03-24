# AEGIS — BACKLOG
Last Updated: 2026-03-24 (v3 vision locked, sprint queue established)

---

## P0 — Foundation (prerequisite for all intelligence work)

- [ ] AEGIS-MONITOR-01: Extended monitoring surface
      Worker: disk I/O per-drive delta (10s rolling), SMART health per drive,
      network per-adapter delta, GPU (nvidia-smi → WMI fallback), DPC/interrupt rate,
      hard fault rate, spawn tree via WMI ParentProcessId, handle/thread counts.
      TypeScript: new snapshot fields, collector updates, server exposure.
      Depends on: nothing. Runs in parallel with CATALOG-01.

---

## P1 — Intelligence Core

- [ ] AEGIS-UI-01: Command surface redesign
      Full HTML rebuild. Cockpit — every metric adjacent to its action.
      Spawn tree as default process view (indented, deviation indicators per node).
      Action log as permanent right panel (reasoning, not conclusions).
      Policy stack live panel (base + active overlays).
      Cognitive load score in header. Tier color system (gray/amber/red).
      Depends on: AEGIS-MONITOR-01.

- [ ] AEGIS-CONTEXT-01: Context detection engine
      WinEvent hook — foreground window tracking, weighted focus time accumulation.
      Named contexts: Deep Work, Build, Research, Meeting, Idle, Media, Gaming.
      Composable policy layer — replace static profiles with stackable policy objects.
      Overlay system — temporary stack on top of base, auto-pop on context change.
      Depends on: AEGIS-CATALOG-01.

- [ ] AEGIS-SNIPER-01: Sniper rules engine v1
      Per-process baseline engine — rolling mean + stddev per context per time bucket.
      Deviation detection — personal baseline trigger, not absolute values.
      Graduated action: throttle → suspend → kill with configurable thresholds.
      Context exemption rules. TESSRYX blast radius preview before Tier 3.
      Cooldown tracking per process per rule.
      Depends on: AEGIS-CATALOG-01, AEGIS-CONTEXT-01.

---

## P2 — Learning + MCP

- [ ] AEGIS-LEARN-01: Learning loop + cognitive load score
      SQLite: sessions, process_snapshots, action_outcomes, context_transitions.
      Weighted feedback: implicit (no undo 60s) + measurable (CPU wait delta) +
      explicit (tray toast — thumbs up/sideways/down, weighted by intensity).
      Confidence score — visible milestone toward Auto mode unlock.
      Cognitive load composite: weighted sum, equal weights at start, learns over time.
      Depends on: AEGIS-SNIPER-01, AEGIS-CONTEXT-01.

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

- [x] AEGIS-CATALOG-01: Process knowledge base — SQLite catalog.db, 210-process seed,
      CatalogDb + CatalogManager, canActOn gate, suspicion heuristics, Claude ID bridge,
      /catalog/identify + /catalog/resolve endpoints, catalog HTML section in status window,
      wired into lifecycle + collector (2026-03-24)
- [x] AEGIS-BRAVE-03: tab suspension UI, HTML command surface v1, per-profile CDP port (ca936bc, 2026-03-24)
- [x] AEGIS-ELEV-01: elevation gate, startup toast, amber indicator (2026-03-22)
- [x] AEGIS-PM2-01: pm2 migration, bounce.bat, startup resurrect (2026-03-22)
- [x] ESLint gate: all 26 source files clean (2026-03-22)
- [x] BRAVE-02: status window tab panel, Brave launch helper, per-profile suspension config
- [x] BRAVE-01: CDP client, tab tracking, suspension engine
- [x] v2.0.0 installer
- [x] Startup task removal
