# AEGIS — MORNING BRIEFING
# Sprint: REFACTOR-01 + BUILD-01 (in progress)
# Date: 2026-03-30
# Session type: In-chat (Cowork unavailable)

## SHIPPED

### REFACTOR-01 — MCP Server Separated into Standalone Binary
- sidecar/src/mcp/server.ts: DELETED — moved to mcp-server/
- sidecar/package.json: @modelcontextprotocol/sdk + zod removed
- sidecar/src/main.ts: rewritten clean — no MCP mode, localhost:7474 query endpoint added
- sidecar/src/learning/load.ts: dead config/types import removed, SystemSnapshotMinimal inlined
- sidecar/src/config/types.ts: DELETED (dead v2)
- sidecar/src/config/loader.ts: DELETED (dead v2)
- sidecar/src/config/state.ts: DELETED (dead v2)
- mcp-server/: new standalone ESM package created
  - mcp-server/package.json: ESM, @modelcontextprotocol/sdk + zod deps
  - mcp-server/tsconfig.json: ESM/bundler module resolution
  - mcp-server/src/server.ts: 7 MCP tools, reads state from localhost:7474
- sidecar tsc: 0 errors confirmed
- sidecar pkg bundle: SUCCESS — 58MB binary at src-tauri/binaries/

### Documentation
- COMPETITIVE_ANALYSIS.md: full TM + Process Lasso gap analysis, 25 sprints
- IMPROVEMENTS_SPEC.md: GAP 1-7 + incident log from 2026-03-30 crashes
- MCP_SEPARATION_DECISION.md: architectural decision + rationale documented
- BACKLOG.md: fully updated, REFACTOR-01 as P0, all 25 sprints queued
- sprints/: BUILD-01, UI-01, SNP-05, POL-01, POL-01-AMENDMENT, STA-01 written
- sprints/AEGIS-MEGA-SPRINT.md: full 25-sprint parallel orchestration document
- STATUS.md: updated

### System Stability Work (non-AEGIS, same session)
- NVIDIA driver rolled back: 32.0.15.8228 (Jan 2026 GRD, unstable) → 32.0.15.8157 (Oct 2025 Studio)
- HAGS disabled: HwSchMode=1 ✓
- TDR extended: TdrDelay=10 ✓
- Defender policy keys re-applied with real elevation ✓
- TEMP redirected to D:\Temp ✓
- NvContainer set to manual start ✓
- BrainSignalWatcher set to delayed-auto ✓
- C:\ freed: 2.8GB cleared (temp + Claude cache + pkg cache)
- SoftLanding tasks disabled ✓
- Litestream CMD window fixed → silent VBScript launcher ✓

## QUALITY GATES
- sidecar tsc --noEmit: PASS (0 errors)
- sidecar pkg bundle: PASS (58MB binary produced)
- cargo tauri build: IN PROGRESS at session close

## DECISIONS MADE BY AGENT

1. MCP server separated into standalone binary (mcp-server/)
   Reason: sidecar and MCP server have incompatible stdin/stdout ownership.
   Both are correct architecturally — bundling them was the wrong model.
   The pkg bundling failure was the architecture telling us something true.

2. localhost:7474 as the sidecar query endpoint
   Reason: Clean seam between sidecar and all consumers (MCP binary, GregLite,
   PORTFOL.io). Any process can read AEGIS state without owning stdin/stdout.

3. NVIDIA Studio Driver chosen over Game Ready
   Reason: Studio drivers are built for mixed workloads (CUDA + display).
   GTX 1060 Max-Q with face recognition CUDA + Electron rendering = Studio territory.

## UNEXPECTED FINDINGS

1. Machine had 3× VIDEO_MEMORY_MANAGEMENT_INTERNAL BSODs today (0x0000010e)
   Root cause: Jan 2026 Game Ready driver instability under mixed CUDA/display workloads
   The face recognition pipeline (face_recognition lib + CLIP/PyTorch) is CPU-ONLY —
   it does NOT use CUDA. The driver was the problem, not the workload.

2. C:\ was filling from: Python (3.4GB on C:\), TEMP (2.3GB), Claude cache (103MB),
   pkg node binary cache (117MB). Python migration to D:\ is a future session task.

3. pkg bundler downloads the node20 base binary on first run — takes 3-5 minutes.
   This caused Desktop Commander timeouts. Solution: longer timeout or manual terminal run.

4. NVIDIA Experience app was broken (error -522190847) — bypassed with standalone installer.

5. Python uninstall failed (0x80070643) because installer ran PerUser but package is
   PerMachine. Python migration needs msiexec with elevation — documented for future session.

## FRICTION LOG

Fixed this session:
- pkg ESM bundling failure → fixed by removing MCP SDK from sidecar entirely
- Dead v2 config files causing tsc errors → deleted
- GREGORE PS profile eating $ signs → used .ps1 file workaround throughout

Backlogged:
- Python migration C:\ → D:\ (PerMachine uninstall needs elevated msiexec)
- DISM WinSxS cleanup (~2-4GB recovery, needs admin)
- mcp-server npm install + tsc build + claude_desktop_config.json wiring
- NvContainer reverts to Automatic after driver reinstall → add to AEGIS-POL-01

## NEXT QUEUE

1. Verify cargo tauri build completed successfully
2. Runtime verification: launch aegis.exe, tray appears, cockpit shows real data
3. AEGIS-UI-01: cockpit redesign (utilitarian, Process Lasso aesthetic)
4. mcp-server wiring (npm install + build + config)
5. Python migration to D:\ (separate session)
