# AEGIS — CHANGELOG

## [4.0.0] AEGIS-LEARN-01 — 2026-03-25
### Shipped — Learning Loop + Cognitive Load Score

**Context**
INTEL-04 shipped the learning store SQLite schema and basic feedback recording.
LEARN-01 completes the loop: confidence scores now flow to the cockpit in real time,
sacred context weighting penalizes bad actions during deep_work/build/meeting at 10x,
and convenience APIs match the sprint spec signatures.

**Fixed**
- `src-tauri/src/sidecar.rs` — `confidence_updated` events were falling through to the
  catch-all `_` match arm and being silently logged instead of relayed to the cockpit.
  Added `"confidence_updated"` to the `intelligence_update` emit pattern alongside
  `load_score_updated`. This was the root cause of the cockpit confidence panel showing
  zero — data existed in SQLite but never reached the WebView.

**Added**
- `sidecar/src/learning/store.ts` — `getConfidenceScore()` convenience method returning
  `{ score, totalDecisions, autoModeUnlocked, decisionsUntilAuto }`. Sprint spec signature.
- `sidecar/src/learning/store.ts` — `recordActionOutcome(actionId, outcome)` convenience
  method accepting simple `'positive'|'neutral'|'negative'` signal. Sprint spec signature.
- `sidecar/src/learning/store.ts` — Sacred context weighting: `SACRED_CONTEXTS` array
  (`deep_work`, `build`, `meeting`). Strong negative feedback during a sacred context
  now carries 10x weight (vs 5x default strong, vs 1x mild). `recordExplicitFeedback`
  looks up the action's stored context from SQLite before calling `updateConfidence`.
- `sidecar/src/learning/load.ts` — `computeLoad()` convenience method returning
  `{ score, tier, cpu_pressure, memory_pressure, disk_queue_pressure, dpc_pressure }`.
  Sprint spec signature.
- `sidecar/src/main.ts` — Confidence state piggybacks on every 5th metrics poll cycle
  (~10s), emitting `confidence_updated` event with score, auto_mode_unlocked,
  decisions_until_auto, and total_decisions. Cockpit receives continuous updates
  without waiting for user feedback events.
- `sidecar/src/main.ts` — `get_state` RPC response now includes `learning_confidence`
  (score, total_decisions, auto_mode_unlocked, decisions_until_auto) and `load_breakdown`
  (score, tier) fields for initial cockpit hydration on connect.

**Quality Gates**
- `npx tsc --noEmit` (sidecar) — 0 errors ✅
- `cargo check` (src-tauri) — 0 errors (3 warnings: dead code, acceptable) ✅
- Cockpit `intelligence_update` listener handles `confidence_updated` type ✅
- `updateConfidencePanel()` receives live score, auto_mode_unlocked, decisions_until_auto ✅

---

## [4.0.0] AEGIS-TRAY-FIX — 2026-03-25
### Shipped — Tray.rs Compile Blocker Resolved

**Root Cause**
The "9 tray.rs compile errors" were never in tray.rs itself. The Tauri 2 API
calls were already correct. The actual blockers were:
1. Missing `src-tauri/binaries/` directory — Tauri build script requires the
   sidecar binary stub (`aegis-sidecar-x86_64-pc-windows-msvc.exe`) to exist
   at build time. Without it, cargo check fails before reaching Rust compilation.
2. `@types/node` not installing in sidecar — npm global config had `omit=dev`,
   silently skipping all devDependencies including `@types/node`.

**Fixed**
- Created `src-tauri/binaries/` directory with sidecar stub binary placeholder.
- Added `"types": ["node"]` to `sidecar/tsconfig.json` compilerOptions.
- Resolved npm `omit=dev` by using `--include=dev` for sidecar installs.

**Quality Gates**
- `cargo check` — 0 errors (3 warnings: dead code, acceptable) ✅
- `cargo build --release` — compiles to `target/release/aegis.exe` ✅
- `npx tsc --noEmit` (sidecar) — 0 errors ✅
- tray.rs — no API mismatch errors ✅

---

## [2.1.0] AEGIS-POLISH-01 — 2026-03-25
### Shipped — P3 Polish, Cleanup, and Release Build

**Removed**
- `src-tauri/`, `sidecar/`, `ui/` directories — orphaned v4 Tauri architecture, never shipped.
- 23 stale blueprint/sprint docs (SPRINT_*.md, BLUEPRINT_*.md, etc.)
- 40+ agent scratch files (_*.py, git-*.txt, lint-*.txt, tsc-*.txt, etc.)
- 6 redundant build/check scripts (check.mjs, check-html.js, BUILD.bat, etc.)
- 5 stale fix scripts from scripts/ directory
- Settings Profiles tab: CDP port inline editor, Edit button, Reset button removed.
  Profiles are now read-only in the UI — power users use Open Profiles Folder.

**Added**
- `GET /profiles` route in `src/status/server.ts` — returns ordered array of LoadedProfile
  objects. Used by settings.hta General tab dropdown and Profiles tab read-only list.
- `POST /profiles/:name` route — accepts partial profile fields, deep-merges into YAML file.
  ProfileRegistry file watcher detects changes and reloads automatically.
- `GET /history` route — returns ring buffer of CPU/RAM history points (max 30 minutes).
  Optional `?minutes=N` query param for slicing.
- pm2 boot health-check in `src/tray/lifecycle.ts` — runs `pm2 jlist` at startup, stores
  result as `Pm2Health` in SystemSnapshot. Static, not polled.
- `Pm2Health` and `HistoryPoint` interfaces in `src/config/types.ts`.
- `pm2_health` field on `SystemSnapshot` type.
- History ring buffer in `StatsCollector` — 900-point buffer (30 min at 2s intervals).
  `setPm2Health()` and `getHistory()` methods added.
- pm2 health indicator in cockpit (status.hta) — green dot when available + online, gray
  when unavailable. Same pattern as Worker and KERNL indicators.
- Collapsible HISTORY panel in cockpit — CPU line (green) and RAM line (amber) on raw
  Canvas 2D. 296×80px, grid lines at 25/50/75%, time labels at 5-minute intervals.
  Default collapsed. Fetches from GET /history on each 2s poll when open.
- `.gitignore` patterns for agent scratch files: _*.py, _*.txt, git-*.txt, lint-*.txt,
  tsc-*.txt, commit-msg.txt, conflicts.txt, conflicts-err.txt.
- Note in Profiles tab: "Profiles are manual overrides. AEGIS manages resources
  automatically via the intelligence stack."

**Changed**
- Version bumped to 2.1.0 across: VERSION, package.json, installer/aegis.nsi, status.hta
  header + About section, settings.hta About section, lifecycle.ts --version + log strings,
  server.ts /health endpoint, collector.ts default/native versions.

**Quality Gates**
- `npm run lint` — 0 errors, 0 warnings ✅
- `npx tsc --noEmit` — 0 errors ✅
- `src-tauri/` does not exist ✅
- No `SPRINT_*.md` files in project root ✅
- No `_*.py` files in project root ✅
- GET /profiles route exists (server.ts line 147) ✅
- GET /history route exists (server.ts line 206) ✅
- `pm2_health` field exists in SystemSnapshot (types.ts line 414) ✅
- VERSION reads "2.1.0" ✅

**Blocked**
- `pkg` bundling (AEGIS.exe) — GREGORE PS profile intercepts npx/node. Build script
  handles gracefully (warns and skips). David to run manually.
- NSIS installer — `makensis` not on PATH. David to build manually.

---

## [AEGIS-CDP-01] — 2026-03-25
### Shipped — Per-Profile CDP Port Config

**Fixed**
- `aegis-config.yaml` — `profiles_dir` was pointing to `D:\Projects\AEGIS\profiles` (deleted directory). Fixed to `D:\Dev\aegis\profiles`. This was a live bug — AEGIS was silently loading profiles from a nonexistent path.
- `aegis-config.yaml` — `logging.log_dir` fixed to `D:\Dev\aegis\logs` (same stale path issue).
- `assets/status.js` — two empty-state strings in `renderBrowserTabs()` hardcoded `--remote-debugging-port=9222`. Replaced with generic `--remote-debugging-port set` message. No user-visible port assumption in the UI.

**Added**
- `profiles/idle.yaml` — `cdp_port: 9222` added inside `browser_suspension` block.
- `profiles/wartime.yaml` — `cdp_port: 9222` added inside `browser_suspension` block.
- `profiles/build-mode.yaml` — `cdp_port: 9222` added inside `browser_suspension` block.
- `assets/settings.hta` — CDP Port input field added to Profiles tab. Renders per profile where `browser_suspension` is present. Loads from `profile.browser_suspension.cdp_port ?? 9222`. Saves via `saveCdpPort()` POST to `/profiles/{name}/browser-suspension`. Input: `type="number"`, `min="1024"`, `max="65535"`.
- `assets/status.js` — `loadProfilesTab()` and `saveCdpPort()` functions added to shared script (moved from inline settings.hta script block for co-location with other tab-load functions).

**Not touched (per sprint constraints)**
- `src/tray/lifecycle.ts`, `src/browser/tab-manager.ts`, `src/browser/cdp-client.ts`, `types.ts` — wiring chain was already complete; this sprint was config + YAML + UI only.

**Quality Gates**
- `npm run lint` — 0 errors, 0 warnings ✅
- `npx tsc --noEmit` — 0 errors ✅
- `findstr /r "Projects\\AEGIS" aegis-config.yaml` — no results ✅
- `cdp_port` present in `profiles/wartime.yaml` browser_suspension ✅

---

## [AEGIS-INTEL-06] — 2026-03-25
### Shipped — Catalog Wiring (Four Gaps Closed)

**Fixed**
- `sidecar/src/main.ts` — CatalogManager constructor now receives `appDataPath` (Roaming folder) instead of full db path. Manager appends `AEGIS/catalog.db` internally. Root cause of silent catalog failure.
- `sidecar/src/main.ts` — `seedIfEmpty()` called immediately after CatalogManager init. 200-entry seed now loads on first startup.
- `sidecar/src/main.ts` — `recordObservation()` called for every process on each `update_processes` RPC cycle. Unknown processes now accumulate observation counts.
- `sidecar/src/main.ts` — `get_state` RPC response now includes `catalog` stats object (`total`, `unknown`, `suspicious`, `seeded`) and `unresolved_processes` / `suspicious_processes` arrays.
- `ui/index.html` — Catalog panel added to right column after context panel. Shows live `total / unresolved / suspicious` counts. Unknown count turns amber when > 0; suspicious turns red. Collapsible unresolved list (top 10 with observation counts). Suspicious banner renders only when count > 0. Tooltips wired via existing `TIP_CONTENT` system.
- `sidecar/src/catalog/seed.json` — Deduped and extended to 200 entries. `winlogon`/`lsass` duplicate entries removed.
- `sidecar/src/better-sqlite3.d.ts` — Type shim added for `better-sqlite3` module. Resolves sidecar `tsc --noEmit` errors.
- Root `package.json` — `@types/better-sqlite3` installed to devDependencies. Resolves 202 pre-existing ESLint unsafe-any errors.

**Quality Gates**
- `npm run lint` — 0 errors (was 202 pre-existing) ✅
- `npx tsc --noEmit` (sidecar) — 0 errors ✅
- `catalog.db` seeds to 200 rows on first startup ✅

---

## [AEGIS-INTEL-05] — 2026-03-25
### Shipped — PolicyManager, Context Overlays, Cockpit Context Panel

(See prior CHANGELOG entries for full detail)

---

## [AEGIS-BRAVE-03] — 2026-03-25
### Shipped — Tab Suspension UI (Cockpit Operator Surface)

(See prior CHANGELOG entries for full detail)

---

## [AEGIS-HELP-01] — 2026-03-25
### Shipped — CSS-Only Tooltip System

- CSS-only tooltip system in `assets/status.css` — `[data-tooltip]::after` pseudo-element, dark bg, 12px, 200ms fade, max-width 240px
- `data-tooltip` attributes on all interactive elements in `assets/status.hta` and `assets/settings.hta`
- `data-tooltip` on dynamically-rendered elements via `assets/status.js`

---

## [AEGIS-PROCS-01] — 2026-03-25
### Shipped — Process Management with Risk-Aware UX

(See prior CHANGELOG entries for full detail)

---

## [AEGIS-AMBIENT-01] — 2026-03-25
### Shipped — Ambient-First UI

(See prior CHANGELOG entries for full detail)

---

## [AEGIS-INTEL-04] — 2026-03-25
### Shipped — Learning Store + Feedback Loop

(See prior CHANGELOG entries for full detail)

---

## [AEGIS-INTEL-03] — 2026-03-25
### Shipped — Sniper Engine with Baseline

(See prior CHANGELOG entries for full detail)

---

## [AEGIS-ELEV-01] — 2026-03-22
### Shipped — Elevation Gate

(See prior CHANGELOG entries for full detail)

---

## [AEGIS-PM2-01] — 2026-03-22
### Shipped — pm2 Lifecycle

(See prior CHANGELOG entries for full detail)

---

## [AEGIS-DEVOPS-01] — 2026-03-25
### Shipped — Pre-Push Lint Gate

- `.git/hooks/pre-push` — POSIX shell script that runs `npm run lint` before every push
- `CONTRIBUTING.md` — Development section: lint requirement, typecheck, commit message workflow

---

All notable changes to AEGIS are documented here.
Format: [Sprint] Date — Summary
