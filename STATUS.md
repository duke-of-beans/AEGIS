# AEGIS — STATUS
Status: Active Development
Phase: Intelligence Layer Build-Out
Last Sprint: AEGIS-INTEL-05 — context engine full integration (CLOSED 2026-03-25)
Last Updated: 2026-03-25

## Open Work
- [x] AEGIS-DEVOPS-01 — pre-push lint hook (9428d99)
- [x] AEGIS-INTEL-01 — per-drive disk I/O via WMI (closed in parallel session)
- [x] AEGIS-INTEL-02 — wire cognitive load engine (CLOSED 2026-03-25)
- [x] AEGIS-INTEL-03 — sniper + baseline operational (CLOSED 2026-03-25)
- [x] AEGIS-INTEL-04 — learning store feedback loop (CLOSED 2026-03-25)
- [x] AEGIS-AMBIENT-01 — profiles demoted, ambient-first (CLOSED 2026-03-25)
- [x] AEGIS-INTEL-05 — context engine full integration (CLOSED 2026-03-25)
- [ ] AEGIS-INTEL-06 — process catalog live queue
- [ ] AEGIS-PROCS-01 — process management complete with feedback
- [ ] AEGIS-HELP-01 — hover help system complete
- [ ] AEGIS-DEVOPS-02 — full CI build pipeline
- [ ] AEGIS-GPU-01 — GPU monitoring properly implemented

## Closed
- [x] AEGIS-COCKPIT-02 — complete cockpit rewrite (2026-03-25)
- [x] AEGIS-DEVOPS-01 — pre-push lint hook (9428d99)
- [x] AEGIS-INTEL-01 — per-drive disk I/O via WMI (closed in parallel session)
- [x] AEGIS-INTEL-02 — cognitive load engine wired (2026-03-25)
- [x] AEGIS-INTEL-03 — sniper + baseline operational (2026-03-25)
- [x] AEGIS-INTEL-04 — learning store feedback loop (2026-03-25)
- [x] AEGIS-AMBIENT-01 — ambient-first UI, profiles demoted to override (2026-03-25)
- [x] AEGIS-INTEL-05 — context engine full integration (2026-03-25)

## Next Track
  AEGIS-INTEL-06 — process catalog live queue (needs v4 spec rewrite before execution)
  AEGIS-HELP-01 — hover tooltips (no dependencies, can run immediately)
  AEGIS-PROCS-01 — process management complete (parallel, no dependencies)

## Architecture Decision: Profiles → Ambient
Profiles are manual overrides, not primary features.
AEGIS manages resources automatically via context + sniper + baseline.
"Ambient mode" = no override active. Not a new profile — absence of one.
Tray: "● Ambient — auto-managing" by default. Override submenu available.
Cockpit pill: AMBIENT (dim) or OVERRIDE: [name] (amber).
Per-process pins: localStorage only, intentionally not persisted to sidecar.

## Known Issues (updated 2026-03-25)
- Disk I/O: hardcoded 0 (fix in AEGIS-INTEL-01 — closed in parallel session, needs merge check)
- Desktop/taskbar icon: still Tauri default (rebuild installer after COCKPIT-02)
- Sidecar dead-code warnings: IntelligenceEvent, SniperRequest (pre-existing, not introduced this sprint)

## Fixed by AEGIS-INTEL-05
- PolicyManager: ✓ instantiated in sidecar, wired to context_changed event
- Context overlays: ✓ applyContextOverlays() called on every context transition
- policies_updated event: ✓ emitted to cockpit on context change
- get_policies RPC: ✓ returns base + overlays with metadata
- lock_context RPC: ✓ user context lock with auto-release timer
- Sniper context multiplier: ✓ build=2.0x, deep_work=1.5x, idle=0.5x, etc.
- Build context exemptions: ✓ node/cargo/rustc/tsc never actioned, logged at debug
- Context history: ✓ in-memory + persisted to %APPDATA%/AEGIS/context_history.jsonl
- History survives restart: ✓ loaded from disk on ContextEngine startup
- Cockpit context panel: ✓ confidence bar, time in context, focus drivers, last 5 transitions
- Manual context lock UI: ✓ opens modal, invokes sidecar_lock_context, countdown shown
- context_locked/released events: ✓ forwarded to cockpit via intelligence_update
- sidecar_lock_context Tauri command: ✓ registered in main.rs
- npm run lint: ✓ 0 errors
- cargo check: ✓ 0 errors, 3 pre-existing warnings only
