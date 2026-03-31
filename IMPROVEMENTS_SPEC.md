
---

## GAP 6: GPU ACCELERATION POLICY (PolicyEngine Extension — 2026-03-30)

### Problem
Claude Desktop's GPU hardware acceleration is enabled by default and survives
app updates. On a 4GB VRAM card with 13 Electron processes, this caused VRAM
exhaustion and a VIDEO_MEMORY_MANAGEMENT_INTERNAL kernel panic (BSOD stop code
0x0000010e) — twice in one day.

The fix (writing hardware_acceleration_mode: false to Local State) is a one-time
patch. App updates can overwrite Local State or reset it. Same drift problem as
Defender.

### What's needed
Extend PolicyEngine (AEGIS-POL-01) with app-level policy entries that check
and enforce JSON file settings, not just registry keys.

New policy type in policy manifest:
```yaml
- id: claude-gpu-acceleration-off
  description: "Claude Desktop GPU hardware acceleration disabled"
  type: json_file
  path: "%APPDATA%\\Claude\\Local State"
  json_key: hardware_acceleration_mode.enabled
  expected_value: false
  auto_enforce: true
  requires_elevation: false
```

PolicyEngine needs a second enforcement path alongside registry:
- json_file type: read the file, parse JSON, check nested key, rewrite if drifted
- Use the no-BOM UTF-8 write pattern (never JSON.stringify with BOM)
- Preserve all other keys in the file — only modify the target key

Additional json_file policies to add for the same reason:
```yaml
- id: claude-gpu-local-state
  description: "Claude Local State GPU acceleration off"
  type: json_file
  path: "%APPDATA%\\Claude\\Local State"
  json_key: hardware_acceleration_mode.enabled
  expected_value: false
  auto_enforce: true
  requires_elevation: false
```

### Acceptance criteria
- PolicyEngine handles type: json_file in addition to type: DWORD/STRING
- On boot, AEGIS checks Claude's Local State and re-applies GPU disable if drifted
- Policy tab in cockpit shows this entry with current value and compliance status
- Works for any Electron app with a similar Local State pattern

---

## GAP 7: GPU METRICS + VRAM MONITOR (New Subsystem — 2026-03-30)

### Problem
AEGIS has no GPU visibility. Today's BSOD was caused by VRAM exhaustion —
13 Claude Electron processes + 10 WebView2 processes + 5 NVIDIA Container
processes collectively exceeded the 4GB VRAM limit on a Max-Q card.

The Sniper saw normal CPU/RAM and did nothing. VRAM was never measured.
The kernel panic was the first signal AEGIS received.

VISION.md explicitly lists GPU-Z and MSI Afterburner as tools AEGIS should
absorb. Neither has been implemented. This is the sprint that does it.

### What's needed
A `GpuMonitor` module in the sidecar that:
1. Polls GPU metrics every 10s via NVIDIA-SMI (if available) or WMI
2. Tracks: GPU utilization %, VRAM used MB, VRAM total MB, VRAM % used,
   GPU temperature, GPU power draw
3. Feeds VRAM % into the Sniper as a machine-level alert threshold
4. Surfaces GPU data in the cockpit Performance sidebar (GPU item)

### VRAM alert thresholds
- VRAM > 75%: warn (amber in cockpit GPU item)
- VRAM > 90%: alert — SniperEvent type 'flagged', reason 'vram_pressure'
  Action: notify only. Identify top VRAM-consuming processes and list them.
- VRAM > 95%: critical — SniperEvent type 'flagged', reason 'vram_critical'
  Tray notification: "VRAM critical (95%). Claude GPU acceleration may need
  disabling. Open cockpit to review."

### NVIDIA-SMI query (preferred path)
```
nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits
```
Output: `8, 2847, 4096, 71, 42.3`
Parse CSV, store as GpuMetrics object.

Fallback path (if nvidia-smi not in PATH):
WMI class `Win32_VideoController` — provides AdapterRAM but not live VRAM usage.
In fallback mode: report AdapterRAM as total, flag as "usage unavailable",
still show GPU name and driver version.

### Per-process VRAM attribution (best-effort)
nvidia-smi can report per-process VRAM:
```
nvidia-smi --query-compute-apps=pid,used_memory --format=csv,noheader,nounits
```
Cross-reference with running process list to name the consumers.
Show top 5 VRAM consumers in cockpit GPU detail pane.

### Implementation targets
- New module: sidecar/src/gpu/monitor.ts
- GpuMetrics interface: utilization, vram_used_mb, vram_total_mb, vram_pct,
  temp_c, power_w, per_process: Array<{pid, name, vram_mb}>
- Poll every 10s via nvidia-smi one-shot spawn
- Feed into Sniper via new ingestGpu(metrics: GpuMetrics) method
- Cockpit GPU item in sidebar: sparkline of VRAM % + current utilization
- GPU detail pane: full metrics + per-process VRAM table
- ARCHITECTURE.md: add GpuMonitor to component map

### Sprint ID: AEGIS-GPU-01
Depends on: AEGIS-UI-01 (sidebar GPU item uses SIDEBAR_SECTIONS extension point)
Priority: P1 — VRAM exhaustion caused kernel panics. This is not cosmetic.

---

## UPDATED SPRINT QUEUE

| Sprint | Subsystem | Effort | Value |
|--------|-----------|--------|-------|
| AEGIS-BUILD-01 | Clean binary compile + runtime verify | Small | Prerequisite |
| AEGIS-UI-01 | Cockpit redesign — utilitarian + sidebar | Large | Prerequisite for all UI |
| AEGIS-SNP-05 | Instance count baseline + 3 new rules | Small | Immediate — catches sprawl |
| AEGIS-POL-01 | Policy Engine (Defender + Claude GPU) | Medium | Immediate — stops drift |
| AEGIS-GPU-01 | GPU metrics + VRAM monitor | Medium | P1 — prevented today's BSOD |
| AEGIS-STA-01 | Startup Auditor | Medium | High — boot visibility |
| AEGIS-SRV-01 | Service Health Monitor | Medium | High — catches retry loops |
| AEGIS-BOT-01 | Boot Sequencer | Small | Medium — replaces bat hacks |
| AEGIS-BUILD-02 | Rebuild binary after code sprints | Small | Required after each Rust change |

---

## INCIDENT LOG — 2026-03-30

What happened:
- 12 Claude processes on fresh boot → 1.4GB RAM, VRAM consumed by GPU rendering
- Windows Defender re-enabled by update → 300MB RAM overhead, disk scan activity
- Litestream checksum retry loop on startup → disk spike, failed S3 uploads
- SoftLanding scheduled tasks running silently → unknown Microsoft content delivery
- BrainSignalWatcher racing with litestream at boot → both hammering brain.db
- VRAM exhaustion (Claude×13 + WebView2×10 + NVIDIA Container×5 > 4GB) → 2× BSOD
  Stop code: 0x0000010e VIDEO_MEMORY_MANAGEMENT_INTERNAL

Manual fixes applied 2026-03-30:
- Claude Local State: hardware_acceleration_mode disabled (GPU off)
- LitestreamBrain startup: bat → silent VBScript, 30s delay
- BrainSignalWatcher: AUTO → DELAYED-AUTO service start
- NVIDIA Container telemetry: AUTO → MANUAL service start
- Defender policy keys: all 7 re-applied with real elevation
- Search web results: Bing disabled, suggestions disabled
- SoftLanding tasks: both disabled
- litestream run.bat: replaced with silent VBScript

All manual fixes above should become AEGIS-enforced policies.
The incident was preventable with SNP-05 + POL-01 + GPU-01 in place.

Last updated: 2026-03-30
