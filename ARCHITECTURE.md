# AEGIS — ARCHITECTURE
# ══════════════════════════════════════════════════════════════════════
# THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR WHAT AEGIS IS.
# READ THIS BEFORE TOUCHING ANYTHING.
# IF YOUR PLANNED CHANGE CONTRADICTS THIS FILE, STOP.
# ══════════════════════════════════════════════════════════════════════

## WHAT AEGIS IS

AEGIS is a **Tauri 2 desktop application** with a **Node.js sidecar**.

It is NOT:
- A standalone Node.js daemon
- A browser-based status page
- An HTA application
- A systray2 tray app
- A pkg-bundled single executable
- An Express server you open in Chrome

## THE THREE COMPONENTS

```
┌──────────────────────────────────────────────────────────┐
│  src-tauri/          RUST APP SHELL (Tauri 2)            │
│  ├── src/main.rs     Entry point, Tauri setup            │
│  ├── src/commands.rs Tauri IPC commands (569 lines)      │
│  ├── src/metrics.rs  2s poll loop, CPU/RAM/process data  │
│  ├── src/sidecar.rs  Sidecar lifecycle management        │
│  ├── src/tray.rs     System tray (Tauri native, NOT      │
│  │                   systray2)                           │
│  ├── src/profiles.rs Profile switching                   │
│  └── Cargo.toml      Rust dependencies                  │
├──────────────────────────────────────────────────────────┤
│  sidecar/            NODE.JS INTELLIGENCE ENGINE         │
│  ├── src/main.ts     Sidecar entry point                 │
│  ├── src/catalog/    Process knowledge base (SQLite)     │
│  ├── src/context/    Context detection + policies        │
│  ├── src/sniper/     Baseline engine + deviation rules   │
│  ├── src/learning/   Feedback loop + cognitive load      │
│  ├── src/config/     Types, loader, state                │
│  ├── src/logger/     Winston logging                     │
│  ├── package.json    Sidecar's own Node dependencies     │
│  └── tsconfig.json   Sidecar's own TS config             │
├──────────────────────────────────────────────────────────┤
│  ui/                 COCKPIT (Tauri WebView)             │
│  └── index.html      Task Manager-style native cockpit   │
│                      NOT a browser page. Rendered in      │
│                      Tauri's embedded WebView.            │
└──────────────────────────────────────────────────────────┘
```

## BUILD COMMANDS

```
cd D:\Dev\aegis

# Build the sidecar (Node.js intelligence engine):
cd sidecar && npm install && npm run build-and-bundle
# This produces: src-tauri/binaries/aegis-sidecar-x86_64-pc-windows-msvc.exe

# Build the Tauri app (Rust shell + bundled sidecar + WebView cockpit):
cargo tauri build
# This produces: src-tauri/target/release/bundle/nsis/AEGIS-Setup-X.Y.Z.exe
```

There is NO separate build-release.mjs. There is NO pkg bundling. There is NO
NSIS installer directory. Tauri handles ALL of this through cargo tauri build.

## WHAT DOES NOT EXIST IN THIS REPO

The following directories and files are DEAD. They belonged to the v2 Node.js
daemon architecture that was replaced by Tauri in March 2025. If any of these
appear, they are WRONG and must be deleted immediately:

- `src/`              — v2 Node.js daemon (replaced by sidecar/ + src-tauri/)
- `assets/`           — v2 HTA files (replaced by ui/index.html in WebView)
- `scripts/`          — v2 PowerShell worker (replaced by Rust metrics)
- `installer/`        — v2 NSIS installer (replaced by Tauri bundler)
- `dist/`             — v2 compiled output (sidecar compiles to sidecar/dist/)
- `release/`          — v2 release staging (Tauri builds to src-tauri/target/)
- `build-release.mjs` — v2 build script (replaced by cargo tauri build)
- `AEGIS-silent.vbs`  — v2 launcher (Tauri app launches natively)
- `AEGIS.cmd`         — v2 launcher
- `AEGIS-Setup-*.exe` — v2 installer (Tauri produces its own)
- Root `package.json`  — v2 package (sidecar has its own at sidecar/package.json)
- Root `tsconfig.json` — v2 TS config (sidecar has its own)
- Root `.eslintrc.cjs` — v2 lint config
- `VERSION`           — v2 version (Tauri uses Cargo.toml + tauri.conf.json)
- Any `systray2` reference — v2 tray (Tauri has native tray)
- Any `pkg` reference  — v2 bundling (not used)
- Any `mshta` or `.hta` reference — v2 UI (not used)

## ARCHITECTURAL DECISIONS (LOCKED)

These decisions are final. They were made deliberately across multiple sessions.
Do not revisit, do not "simplify back to Node.js", do not add Express servers.

1. AEGIS is a Tauri 2 desktop app (decided ~Mar 6, 2026)
2. AEGIS runs as an independent daemon via pm2 — NOT coupled to GregLite
   (decided Mar 23, 2026)
3. Static profiles replaced by composable policies + overlays
   (decided Mar 24, 2026 — profiles remain as manual fallback only)
4. Intelligence stack: Catalog → Baseline → Context → Sniper → Learning
   (designed Mar 24, 2026 — Catalog through Sniper shipped)
5. Cockpit is a native Tauri WebView (ui/index.html), NOT a browser tab
   (decided Mar 25, 2026 — COCKPIT-01 and COCKPIT-02 shipped)
6. The sidecar is a pkg-bundled Node.js binary managed by Tauri
   (decided in TAURI-02 sprint)

## KNOWN ISSUES (from first Tauri build test, 2026-03-25)

1. Tray click toggle race — window bounces. Sprint RUNTIME-01 queued.
2. Metrics show 0% — sysinfo needs warmup refresh. Sprint RUNTIME-01 queued.
3. Installer was currentUser — changed to perMachine, needs rebuild.

## FILE LOCATIONS

| What | Where |
|------|-------|
| Rust source | src-tauri/src/ |
| Sidecar source | sidecar/src/ |
| Cockpit UI | ui/index.html |
| Profiles | profiles/*.yaml |
| Runtime config | aegis-config.yaml |
| Tauri config | src-tauri/tauri.conf.json |
| Sidecar deps | sidecar/package.json |
| Rust deps | src-tauri/Cargo.toml |
| pm2 config | ecosystem.config.cjs |
| Vision doc | VISION.md |
| Project DNA | PROJECT_DNA.yaml |

## VERSION

The version lives in TWO places, both must match:
- `src-tauri/Cargo.toml` → `version = "4.0.0"`
- `src-tauri/tauri.conf.json` → `"version": "4.0.0"`

There is no `VERSION` file. There is no root `package.json` version.
