# AEGIS — STATUS
Status: Active Development
Phase: Intelligence Layer Build-Out
Last Sprint: AEGIS-COCKPIT-01 (c04c469) — cockpit rewrite attempt (interrupted)
Last Updated: 2026-03-25

## Open Work
- [ ] AEGIS-DEVOPS-01 — pre-push lint hook (SPRINT file written, ready for Cowork)
- [ ] AEGIS-COCKPIT-02 — complete cockpit rewrite (SPRINT file written, ready for Cowork)
- [ ] AEGIS-INTEL-01 — disk I/O via WMI Rust (SPRINT file written, ready for Cowork)
- [ ] AEGIS-INTEL-02 — wire cognitive load engine (SPRINT file written, blocked on INTEL-01+COCKPIT-02)
- [ ] AEGIS-INTEL-03 — sniper + baseline operational (SPRINT file written, blocked on INTEL-02)
- [ ] AEGIS-INTEL-04 — learning store feedback loop (SPRINT file written, blocked on INTEL-03)
- [ ] AEGIS-AMBIENT-01 — profiles demoted, ambient-first (SPRINT file written, blocked on INTEL-03)
- [ ] AEGIS-PROCS-01 — process management complete with feedback
- [ ] AEGIS-HELP-01 — hover help system complete
- [ ] AEGIS-INTEL-05 — context engine full integration
- [ ] AEGIS-INTEL-06 — process catalog live queue
- [ ] AEGIS-DEVOPS-02 — full CI build pipeline
- [ ] AEGIS-GPU-01 — GPU monitoring properly implemented

## Parallel Track A (run now)
  AEGIS-DEVOPS-01 | AEGIS-COCKPIT-02 | AEGIS-INTEL-01
  → All three are independent and can run simultaneously in Cowork

## Serial Track B (after Track A)
  AEGIS-INTEL-02 → AEGIS-INTEL-03 → AEGIS-INTEL-04
  AEGIS-AMBIENT-01 (after INTEL-03)

## Architecture Decision: Profiles → Ambient
Profiles are manual overrides, not primary features.
AEGIS manages resources automatically via context + sniper + baseline.
"Ambient mode" = no override active. Not a new profile — absence of one.
See VISION.md for full philosophy. AEGIS-AMBIENT-01 implements this.

## Known Issues (honest audit 2026-03-25)
- Tab navigation: broken in current build (scoping bug — fixed in AEGIS-COCKPIT-02)
- Light mode toggle: broken (fix in AEGIS-COCKPIT-02)
- Process action buttons: not executing (fix in AEGIS-COCKPIT-02)
- Disk I/O: hardcoded 0 (fix in AEGIS-INTEL-01)
- Cognitive load: always -- (fix in AEGIS-INTEL-02)
- Sniper engine: silently failing on startup (fix in AEGIS-INTEL-03)
- Learning store: never called (fix in AEGIS-INTEL-04)
- Desktop/taskbar icon: still Tauri default (rebuild installer after COCKPIT-02)
