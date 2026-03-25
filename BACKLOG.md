# AEGIS — BACKLOG

## P0 — Ship Blockers

- [ ] **AEGIS-TAURI-05** — NSIS installer with ASCII art welcome screen, Task Scheduler
      entry at logon (runs as normal user token), Add/Remove Programs entry, Start Menu
      shortcut. Tauri bundler NSIS target. Single .exe distributable.
      _Acceptance: AEGIS-Setup-4.0.0.exe installs clean, tray appears at next logon_

## P2 — Intelligence Layer Completion

- [ ] **AEGIS-LEARN-02** — Action outcome analysis UI. Surface patterns from LearningStore:
      which rules fire most, which get negative feedback, confidence drift over time.
      Show in cockpit Action Log tab.

- [ ] **AEGIS-CATALOG-02** — Live identification queue in cockpit. Unknown processes that
      need cataloging shown inline with quick-resolve form (name, trust tier, blast radius).

## P3 — Polish

- [ ] **AEGIS-SNIPER-02** — Custom sniper rules. User-defined rules via YAML config or
      cockpit UI. Per-process overrides on top of catalog defaults.

- [ ] **AEGIS-CONTEXT-02** — Manual context override from cockpit. Force a context, lock
      it for a duration, unlock. Currently context is auto-detected only.

- [ ] **AEGIS-ICON-01** — Custom AEGIS icon. Replace Tauri default. Needs .ico at 16x16,
      32x32, 48x48, 256x256. Design: shield + circuit motif, dark bg.

- [ ] **AEGIS-PKG-01** — Upgrade sidecar bundler from pkg@5.8.1 (node18 target) to
      @yao-pkg/pkg (node20+ targets). Reduces sidecar binary size, adds Node 20 support.

- [ ] **AEGIS-SIGN-01** — Code signing. SmartScreen bypass for distribution. Self-signed
      path documented. Post-MVP.

## Icebox

- MCP server port: currently MCP uses stdio transport (KERNL calls via stdio).
  If HTTP transport needed for GregLite integration, add as separate sprint.
- GPU monitoring: nvidia-smi shell-out working for NVIDIA. AMD/Intel requires
  different APIs. Out of scope until GPU monitoring is a requested feature.
- AEGIS-TAURI-05 installer: signed binary path. Self-signed documented post-ship.
