# AEGIS — STATUS
Status: Active Development
Phase: Intelligence Layer Build-Out
Last Sprint: AEGIS-INTEL-03 — sniper engine with baseline operational (CLOSED 2026-03-25)
Last Updated: 2026-03-25

## Open Work
- [ ] AEGIS-DEVOPS-01 — pre-push lint hook (SPRINT file written, ready for Cowork)
- [ ] AEGIS-INTEL-01 — disk I/O via WMI Rust (SPRINT file written, ready for Cowork)
- [x] AEGIS-INTEL-02 — wire cognitive load engine (CLOSED 2026-03-25)
- [x] AEGIS-INTEL-03 — sniper + baseline operational (CLOSED 2026-03-25)
- [ ] AEGIS-INTEL-04 — learning store feedback loop (SPRINT file written, blocked on INTEL-03 ✓)
- [ ] AEGIS-AMBIENT-01 — profiles demoted, ambient-first (SPRINT file written, blocked on INTEL-03 ✓)
- [ ] AEGIS-PROCS-01 — process management complete with feedback
- [ ] AEGIS-HELP-01 — hover help system complete
- [ ] AEGIS-INTEL-05 — context engine full integration
- [ ] AEGIS-INTEL-06 — process catalog live queue
- [ ] AEGIS-DEVOPS-02 — full CI build pipeline
- [ ] AEGIS-GPU-01 — GPU monitoring properly implemented

## Closed
- [x] AEGIS-COCKPIT-02 — complete cockpit rewrite (2026-03-25)
- [x] AEGIS-DEVOPS-01 — pre-push lint hook (9428d99)
- [x] AEGIS-INTEL-01 — per-drive disk I/O via WMI (closed in parallel session)

## Parallel Track A (run now)
  AEGIS-INTEL-02 | AEGIS-INTEL-01 (if not yet merged)
  → COCKPIT-02 now closed, unblocking INTEL-02

## Serial Track B (after Track A)
  AEGIS-INTEL-02 → AEGIS-INTEL-03 → AEGIS-INTEL-04
  AEGIS-AMBIENT-01 (after INTEL-03)

## Architecture Decision: Profiles → Ambient
Profiles are manual overrides, not primary features.
AEGIS manages resources automatically via context + sniper + baseline.
"Ambient mode" = no override active. Not a new profile — absence of one.
See VISION.md for full philosophy. AEGIS-AMBIENT-01 implements this.

## Known Issues (updated 2026-03-25)
- Disk I/O: hardcoded 0 (fix in AEGIS-INTEL-01)
- Cognitive load: live score from CPU/memory/context via CognitiveLoadEngine ✓ (AEGIS-INTEL-02)
- Sniper engine: BaselineEngine + SniperEngine initialized; process snapshots feeding from Rust ✓ (AEGIS-INTEL-03)
- Learning store: never called (fix in AEGIS-INTEL-04)
- Desktop/taskbar icon: still Tauri default (rebuild installer after COCKPIT-02 ✓ now building)

## Fixed by COCKPIT-02
- Tab navigation: ✓ sel() is globally scoped, all 6 tabs switch correctly
- Light mode toggle: ✓ wired via addEventListener, persists to localStorage
- Process action buttons: ✓ invoke Tauri commands, show success/error feedback
- Profile override: ✓ demoted to bottom of right panel, not prominent
- Sniper canvas animation: ✓ live random-walk with crosshair and fading trail
- Font sizes: ✓ base 14px, stats 17px, detail header 30px, process rows 12px
- Tooltip delay: ✓ 900ms (deliberate, not nervous)
- IPC mapping: ✓ Rust field names correctly mapped to SNAP object
