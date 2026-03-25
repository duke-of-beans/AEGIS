# AEGIS — STATUS
Status: Active Development
Phase: Intelligence Layer Build-Out
Last Sprint: AEGIS-AMBIENT-01 — profiles demoted, ambient-first (CLOSED 2026-03-25)
Last Updated: 2026-03-25

## Open Work
- [x] AEGIS-DEVOPS-01 — pre-push lint hook (9428d99)
- [x] AEGIS-INTEL-01 — per-drive disk I/O via WMI (closed in parallel session)
- [x] AEGIS-INTEL-02 — wire cognitive load engine (CLOSED 2026-03-25)
- [x] AEGIS-INTEL-03 — sniper + baseline operational (CLOSED 2026-03-25)
- [x] AEGIS-INTEL-04 — learning store feedback loop (CLOSED 2026-03-25)
- [x] AEGIS-AMBIENT-01 — profiles demoted, ambient-first (CLOSED 2026-03-25)
- [ ] AEGIS-INTEL-05 — context engine full integration (unblocked)
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

## Next Track
  AEGIS-INTEL-05 — context engine full integration (ready to start)
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

## Fixed by AEGIS-AMBIENT-01
- Tray menu: ✓ ambient-first, profiles in Manual Override submenu
- Tray tooltip: ✓ "AEGIS — ambient" or "AEGIS — override: [name]"
- Cockpit pill: ✓ AMBIENT dim / OVERRIDE amber, clickable to release
- Right panel: ✓ override section with state dot + release button
- Per-process pin: ✓ pin button on hover, modal with priority + implication text
- Sidecar get_state: ✓ override_active field exposed
- Sidecar heartbeat: ✓ override_active included
- npm run lint: ✓ 0 errors
- cargo check: ✓ 0 errors, 3 pre-existing warnings only
