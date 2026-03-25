# AEGIS — STATUS

**Status:** active
**Phase:** AEGIS-TAURI — Native Windows app migration
**Last Sprint:** AEGIS-TAURI-02-04
**Last Updated:** 2026-03-24

---

## CURRENT STATE

AEGIS v4 Tauri migration is functionally complete through Sprint 04.
aegis.exe and aegis-sidecar.exe both run as native Windows processes.
The cockpit WebView shows live metrics via Tauri events (no HTTP server).
Profile switching works from the tray menu.
The intelligence sidecar (context, sniper, learning, catalog, MCP) is wired.

### What works today:
- cargo check: 0 errors
- aegis.exe running (native Tauri 2 process, ~52MB RAM)
- aegis-sidecar.exe running alongside (pkg bundle, ~45MB RAM)
- Native system tray with 6 profile items + Open Cockpit + Quit
- Full Task Manager-style cockpit WebView (35KB, ported from v3 html.ts)
- Live CPU/RAM/disk/network/process metrics via sysinfo — no elevation
- Profile switching via tray → applies Win32 SetPriorityClass via Rust
- Intelligence engines wired: context, sniper, learning, catalog, policy
- JSON-RPC over stdio between Rust core and sidecar

### Next:
- AEGIS-TAURI-05: NSIS installer with ASCII art, Task Scheduler startup

---

## OPEN WORK

- [ ] **[P0]** AEGIS-TAURI-05: NSIS installer — ASCII art welcome, Task Scheduler at logon,
      single .exe distributable. Tauri bundler target: nsis.
- [ ] **[P2]** AEGIS-LEARN-02: Action outcome analysis — surface patterns from LearningStore
- [ ] **[P2]** AEGIS-CATALOG-02: Live identification queue UI in cockpit
- [ ] **[P3]** AEGIS-SNIPER-02: Custom sniper rules — user-defined via config or cockpit UI
- [ ] **[P3]** AEGIS-CONTEXT-02: Manual context override from cockpit — force/lock context
- [ ] **[P3]** Custom AEGIS icon (replace Tauri default Tauri logo)
- [ ] **[P3]** Code signing (SmartScreen — post-MVP)
- [ ] **[P3]** Upgrade pkg to @yao-pkg/pkg for node20+ target support

## ARCHITECTURE

```
AEGIS.exe (Tauri 2, ~52MB)
├── Rust core (src-tauri/)
│   ├── metrics.rs      — sysinfo polling, no elevation, emits "metrics" events
│   ├── commands.rs     — IPC: switch_profile, set_priority, kill, get_intelligence
│   ├── profiles.rs     — YAML loader + Win32 SetPriorityClass
│   ├── tray.rs         — native system tray, profile menu
│   └── sidecar.rs      — spawn/supervise intelligence sidecar
├── Intelligence sidecar (sidecar/ → pkg binary, ~48.5MB)
│   └── context/sniper/learning/catalog/mcp — JSON-RPC over stdio
└── Cockpit WebView (ui/index.html, 35KB)
    └── window.__TAURI__.event.listen + invoke
```

## KEY FILES

| File | Purpose |
|------|---------|
| `src-tauri/src/main.rs` | Tauri entry + async runtime |
| `src-tauri/src/metrics.rs` | sysinfo polling → WebView events |
| `src-tauri/src/commands.rs` | IPC: switch_profile, set_priority, etc. |
| `src-tauri/src/profiles.rs` | YAML profiles + Win32 apply |
| `src-tauri/src/tray.rs` | System tray + profile menu |
| `src-tauri/src/sidecar.rs` | Intelligence sidecar orchestration |
| `src-tauri/tauri.conf.json` | Tauri config |
| `src-tauri/binaries/aegis-sidecar-*.exe` | Compiled intelligence sidecar (48.5MB) |
| `sidecar/src/main.ts` | Sidecar entry — JSON-RPC dispatcher |
| `ui/index.html` | Cockpit WebView (full Task Manager layout) |
| `AEGIS_V4_BLUEPRINT.md` | Full migration blueprint |
| `MORNING_BRIEFING.md` | Latest session briefing |

## SPRINT LOG

| Sprint | Commit | Date | Summary |
|--------|--------|------|---------|
| AEGIS-TAURI-02-04 | pending | 2026-03-24 | Tray, metrics, sidecar, cockpit |
| AEGIS-TAURI-01 | 18f3812 | 2026-03-24 | Tauri 2 scaffold, first compile |
| AEGIS-UI-01 | d7b8772 | 2026-03-24 | v3 cockpit (Node era, retired) |
| AEGIS-MCP-02 | b0c416a | 2026-03-24 | 14-tool MCP publisher |
