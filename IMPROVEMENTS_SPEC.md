
---

## PRODUCT PHILOSOPHY — LIGHTWEIGHT + HARDWARE-AWARE

### The Core Constraint
AEGIS must never become the problem it solves.
A system optimizer that is itself a resource hog is self-defeating.
Target at idle: <0.5% CPU, <80MB RAM for the full stack.
If AEGIS drifts above this, it is failing its own mission.

### Hardware Profile (AEGIS-HW-PROFILE-01)
On first run, AEGIS performs a one-time hardware discovery:
  - Total RAM + baseline available RAM after normal startup
  - Physical cores + logical threads
  - GPU name + VRAM total + typical idle VRAM usage
  - Disk type (NVMe/SSD/HDD) + benchmark read/write speeds
  - Thermal sensors (if available)

From this it derives a SAFE OPERATING ENVELOPE — calculated ratios, not hardcoded numbers:
  - Compiler parallelism: floor(cores * 0.4) [cargo, MSBuild, tsc, etc.]
  - Sniper RAM threshold: baseline_available_MB * 0.85 before aggressive action
  - GPU acceleration: disabled if VRAM < 4GB (Electron apps)
  - Background process limits: scaled to core count and available RAM
  - Boot sequence delays: scaled to disk speed (NVMe = shorter delays)

The envelope is stored in %APPDATA%\AEGIS\hardware_profile.yaml.
PolicyEngine revalidates it on every boot.
Windows Updates cannot overwrite it without triggering a policy drift alert.

### Adaptive Polling (AEGIS-ADAPTIVE-01)
Three states — not constant 2s polling regardless of activity:

IDLE state (nothing anomalous):
  - Metrics poll: every 8 seconds
  - Sniper evaluation: every 30 seconds
  - Context engine: every 5 seconds
  - Sidecar CPU: <0.3%, RAM: <60MB

WATCH state (process flagged, deviation detected):
  - Metrics poll: every 2 seconds
  - Sniper evaluation: every 10 seconds
  - Context engine: every 2 seconds

ACTION state (active intervention, build running, VRAM pressure):
  - Metrics poll: every 500ms
  - Sniper evaluation: every 5 seconds
  - Full cockpit data stream active

Transition triggers:
  IDLE → WATCH: any Sniper flag, VRAM > 75%, CPU sustained > 80%
  WATCH → ACTION: Sniper action taken, VRAM > 90%, user opens cockpit
  ACTION → WATCH: threat resolved, load drops
  WATCH → IDLE: 5 minutes with no flags

This is the sniper metaphor applied to AEGIS itself.
It waits, watches, and acts precisely. It does not spray.

### Three Control Tiers (UI)
Surfaced in cockpit Settings as a deliberate first-run choice:

AUTOMATIC (default, ships on all installs):
  - Hardware profile drives all limits
  - PolicyEngine enforces silently
  - Sniper acts within learned confidence
  - Zero configuration required
  - Most users never leave this mode and shouldn't need to

BALANCED (intermediate):
  - Same as Automatic but each action is explained before executing
  - User can approve, reject, or modify
  - This is the learning/trust-building mode
  - Recommended for new power users

MANUAL (power users):
  - User sets explicit limits in cockpit
  - AEGIS monitors and alerts only — never acts without instruction
  - Full cockpit visibility into everything
  - David's mode once AEGIS is fully trusted

Safe default is always AUTOMATIC with conservative thresholds.
Machine runs better on day one with zero user effort.
Power users unlock more aggressive behavior with explicit opt-in.

### Sidecar Lightweight Constraints (enforced, not aspirational)
  - SQLite: WAL mode, page_size=4096, cache_size=-2000 (2MB max cache)
  - Baseline DB: prune samples older than 30 days on startup
  - Context engine PowerShell poller: only persistent subprocess
  - All other subprocesses: on-demand, killed after response
  - Learning store: flush to disk every 5 minutes, not every action
  - Catalog: loaded into memory once, not re-read per query
  - Intelligence evaluation loops: gated by lastActivityMs
    If machine quiet for > 5 minutes: skip evaluation entirely

### GregLite / GREGORE Integration
AEGIS as the hardware awareness layer for the whole portfolio.

GregLite query before spawning MCP servers:
  GET localhost:7474/state → { cognitive_load, available_ram_mb, recommended_jobs }

GREGORE pre-build signal:
  "COVOS sprint starting, Node-heavy, 3hr"
  → AEGIS receives intent via MCP apply_policy_overlay
  → AEGIS adjusts thresholds, warns if RAM insufficient, sets compiler limits
  → Build starts in optimal environment without manual configuration

The closed loop: intent flows in, AEGIS configures, work runs at capacity.

### Sprint: AEGIS-HW-PROFILE-01
Priority: P1 — prerequisite for meaningful defaults
Depends on: BUILD-01 (binary must exist)
Parallel with: UI-01

Tasks:
1. Hardware discovery module (sidecar/src/hw/profile.ts)
   - Runs once on first launch
   - Writes hardware_profile.yaml to %APPDATA%\AEGIS\
   - Re-reads on every subsequent start (no re-discovery)
2. Safe envelope calculator
   - compiler_jobs, sniper_thresholds, gpu_accel_enabled, boot_delay_multiplier
3. PolicyEngine extension: hardware_profile policies auto-generated from envelope
4. Adaptive polling state machine in sidecar/src/main.ts
   - IDLE / WATCH / ACTION states with transition logic
5. ~/.cargo/config.toml auto-written with hardware-derived jobs count
6. Cockpit Settings: three-tier control selector (Automatic/Balanced/Manual)
   - First-run modal if no preference set

### Sprint: AEGIS-ADAPTIVE-01
Priority: P2 — depends on HW-PROFILE-01
Refactor sidecar polling from fixed 2s to adaptive state machine.
Expected result: idle CPU drops from ~0.8% to ~0.2%, RAM drops ~15MB.

Last updated: 2026-03-30
