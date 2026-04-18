# AEGIS

**AI-Native Process Intelligence for Windows**

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-Tauri%202-orange)](https://tauri.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-Node.js%20sidecar-blue)](https://www.typescriptlang.org/)

AEGIS is a desktop process monitor that goes beyond Task Manager — it understands
what your processes *mean* and acts on that understanding. Built as a Tauri 2
desktop app with a Node.js intelligence sidecar, it provides real-time CPU and
memory monitoring, context-aware process management, and a native WebView cockpit.

---

## What It Does

Most process monitors show you numbers. AEGIS shows you meaning.

It maintains a catalog of known processes, learns your normal resource usage
patterns, detects deviations, and can take intelligent action — not because a
threshold was crossed, but because it understands what's running and why.

**Core capabilities:**

- Real-time CPU/RAM monitoring with 2-second polling
- Process catalog with per-process knowledge base (SQLite)
- Context detection — understands what workload mode you're in
- Baseline engine with deviation alerts
- Composable policy and overlay system for process rules
- System tray integration (native Tauri tray, always available)
- Native WebView cockpit — not a browser tab, a desktop app

---

## Architecture

AEGIS has three components that work together as a single Tauri desktop app:

```
src-tauri/          Rust app shell (Tauri 2)
├── main.rs         Entry point, Tauri setup
├── commands.rs     Tauri IPC commands
├── metrics.rs      2s poll loop, CPU/RAM/process data
├── sidecar.rs      Sidecar lifecycle management
├── tray.rs         System tray (native Tauri)
└── profiles.rs     Profile switching

sidecar/            Node.js intelligence engine
├── catalog/        Process knowledge base (SQLite)
├── context/        Context detection and policies
├── sniper/         Baseline engine and deviation rules
└── learning/       Feedback loop and cognitive load

ui/
└── index.html      Native WebView cockpit (not a browser page)
```

The Rust shell handles OS integration and polling. The Node.js sidecar provides
the intelligence layer — catalog lookups, baseline comparison, context detection,
and learning. The WebView cockpit is a task-manager style interface rendered
natively inside the Tauri window.

---

## Build

```bash
# 1. Build the Node.js sidecar
cd sidecar
npm install --include=dev
npm run build-and-bundle
# Produces: src-tauri/binaries/aegis-sidecar-x86_64-pc-windows-msvc.exe

# 2. Build the Tauri app
cargo tauri build
# Binary: <CARGO_TARGET_DIR>/release/aegis.exe
# Installer: <CARGO_TARGET_DIR>/release/bundle/nsis/AEGIS_x64-setup.exe
```

> **Note:** Set `CARGO_TARGET_DIR` to redirect build output. The binary does not
> land at `src-tauri/target/` by default if this env var is set.

---

## Intelligence Stack

```
Catalog     →  What is this process? (SQLite knowledge base)
Baseline    →  What's normal for this process?
Context     →  What workload mode am I in?
Sniper      →  Is this process deviating from baseline?
Learning    →  Update baseline from observed patterns
```

Each layer is independent and composable. Context detection changes what
"normal" means — a dev workload has different baselines than an idle desktop.

---

## Status

| Component | Status |
|-----------|--------|
| Rust shell + tray | ✅ Shipped |
| Sidecar lifecycle | ✅ Shipped |
| Metrics polling | ✅ Shipped |
| Process catalog | ✅ Shipped |
| Baseline engine | ✅ Shipped |
| Context detection | ✅ Shipped |
| WebView cockpit | ✅ Shipped |
| Learning feedback loop | 🚧 In progress |
| Orphan process reaper | 📋 Planned |

---

## Platform

Windows only (Tauri 2 with Windows-native sidecar binary). Rust + Node.js
required to build from source.

---

## License

MIT

## Author

[@duke-of-beans](https://github.com/duke-of-beans)
