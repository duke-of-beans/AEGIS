# AEGIS — STATUS

**Version:** 4.0.0 (Tauri migration in progress)
**Phase:** AEGIS-TAURI — Native Windows app migration
**Last Sprint:** AEGIS-TAURI-01
**Last Updated:** 2026-03-24
**Architecture:** Tauri 2 + Rust core + TypeScript sidecar

---

## CURRENT STATE

AEGIS v4 is being migrated from Node.js/pm2/PowerShell-worker to a proper
native Tauri 2 Windows desktop application. The first build compiles and
runs successfully as aegis.exe with a native process window and system tray.

### What works today (AEGIS-TAURI-01 complete):
- cargo check: 0 errors
- cargo tauri dev: compiles and runs as aegis.exe (PID verified, 49MB RAM)
- Rust core scaffold: main.rs, metrics.rs, commands.rs, profiles.rs, tray.rs, sidecar.rs
- sysinfo polling wired (CPU/RAM/disk/network/processes — no elevation)
- Tauri IPC commands registered
- Sidecar spawn architecture ready
- ui/index.html placeholder in place

### What's next:
- AEGIS-TAURI-02: Verify tray icon appears, profile switching works, metrics emit to WebView
- AEGIS-TAURI-03: Wire full intelligence sidecar (context, sniper, learning, catalog, MCP)
- AEGIS-TAURI-04: Full cockpit WebView (v3 HTML ported to invoke/listen)
- AEGIS-TAURI-05: NSIS installer with ASCII art

---

## OPEN WORK

- [ ] **[P0]** AEGIS-TAURI-02: Verify tray + profile switching + metrics live
- [ ] **[P0]** AEGIS-TAURI-03: Intelligence sidecar wired (context/sniper/learning/MCP)
- [ ] **[P0]** AEGIS-TAURI-04: Full cockpit WebView — v3 UI ported to Tauri events
- [ ] **[P0]** AEGIS-TAURI-05: NSIS installer, ASCII art welcome, Task Scheduler startup
- [ ] **[P2]** Custom AEGIS icon (replace Tauri default)
- [ ] **[P3]** Code signing for SmartScreen

---

## ARCHITECTURE

```
AEGIS.exe (Tauri 2)
├── Rust core (src-tauri/)
│   ├── metrics.rs      — sysinfo polling, no elevation
│   ├── commands.rs     — IPC commands to WebView
│   ├── profiles.rs     — YAML loader + Win32 SetPriorityClass
│   ├── tray.rs         — native system tray
│   └── sidecar.rs      — spawn/supervise intelligence sidecar
├── Intelligence sidecar (sidecar/) — JSON-RPC over stdio
│   └── context/sniper/learning/catalog/MCP (Sprint 03)
└── Cockpit WebView (ui/)
    └── Task Manager layout HTML (Sprint 04)
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
| `sidecar/src/main.ts` | Sidecar entry (Sprint 03) |
| `ui/index.html` | Cockpit WebView (Sprint 04) |
| `AEGIS_V4_BLUEPRINT.md` | Full migration blueprint |

## SPRINT LOG

| Sprint | Commit | Summary |
|--------|--------|---------|
| AEGIS-TAURI-01 | 18f3812 | Tauri 2 scaffold, Rust core, first compile |
| AEGIS-UI-01 | d7b8772 | v3 cockpit (Node era, retired) |
| AEGIS-MCP-02 | b0c416a | 14-tool MCP publisher |
