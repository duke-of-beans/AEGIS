# MORNING BRIEFING — AEGIS — 2026-03-25

## Sprint Closed: AEGIS-AMBIENT-01 — Profiles Demoted, Ambient Intelligence Primary

All acceptance criteria met. AEGIS is now ambient-first.

## What Was Done

**Tray menu** is completely restructured. The default state shows "● Ambient — auto-managing" as an informational item. Profiles are no longer top-level — they live inside a "Manual Override" submenu. When an override is active, the tray header changes to "OVERRIDE: [NAME]" and a "Release Override" item appears at the bottom of the submenu. The tooltip updates from "AEGIS — ambient" to "AEGIS — override: [name]" in real time. Menu rebuilds are done by storing the `TrayIcon<R>` in a managed `TrayState<R>` so async event handlers can call `set_menu` / `set_tooltip` without holding an app reference.

**Cockpit header pill** (`pp-intel`) now communicates override state directly. When ambient, it shows "AMBIENT" in dim color. When a profile is active, it shows "OVERRIDE: [NAME]" in amber. It's clickable: clicking when override is active opens a release-override confirmation modal. Clicking when ambient does nothing (the tooltip explains why).

**Right-panel override section** has been rebuilt. It now has a state dot (green = ambient, amber = override), a label that reads "ambient — auto-managing" or the profile name, a "release" button that only appears when an override is active, and a "change" button that's always available. The section still feels like an expert control, not a primary feature.

**Per-process pin button** appears on hover in every process row alongside pause/priority/end. Clicking it opens a modal showing the current priority, a dropdown for the new priority, plain-English implication text for each level, and a notice that AEGIS will not auto-adjust the pinned process. Pins are stored in `localStorage['aegis_process_pins']` as `{ "process.exe": "priority" }`. They are client-side only — intentionally not persisted to the sidecar or any YAML file. On first metrics update after a page load, `applyPinsOnce()` re-applies all pins via `set_process_priority`.

**Sidecar** now exposes `override_active` (boolean) in `get_state` responses, `apply_profile` responses, and heartbeat events. `apply_profile` normalizes empty string to 'idle' so the cockpit and sidecar agree on what "ambient" means.

## Quality Gate
- `npm run lint`: ✅ 0 errors, 0 warnings
- `cargo check`: ✅ 0 errors, 3 pre-existing warnings (profiles.rs dead field, sidecar.rs unused structs — not introduced this sprint)

## Architecture Decisions Made This Sprint

**Ambient mode is not a profile.** It is the absence of an override. There is no `ambient.yaml`. AEGIS in ambient mode runs the context engine, sniper, baseline, and cognitive load engine without applying any profile's CPU priority rules unless the sniper acts. This distinction matters: ambient ≠ idle profile. The idle profile still applies process priority rules. Ambient applies none.

**Per-process pins are localStorage only.** The sidecar treats them as transient state. The cockpit re-applies them on first metrics update. This is intentional: pins are a UI preference. If the user closes and reopens the cockpit without restarting the sidecar, pins are restored. If the sidecar restarts, the cockpit re-applies them automatically within 2 seconds of first data.

## Friction Notes

- `TrayIconBuilder::with_id()` is a constructor variant, not a chained `.id()` method. Tauri 2 docs are sparse on this — had to read the crate source directly.
- Desktop Commander `File::Copy` with overwrite works even when `WriteAllText` is blocked by a shared file lock (WebView2 holding index.html). This is the correct write pattern for files open in the running app.
- PowerShell string interpolation eats `$()` patterns in JS-heavy strings. Workaround: write patch scripts to disk as `.ps1` files and execute them, or use `String.Replace()` instead of `-replace` to avoid regex `$` interpretation.

## Next Sprint

**AEGIS-INTEL-05** — Context engine full integration. Context changes currently don't influence sniper thresholds or produce meaningful cockpit output. This sprint wires context to sniper evaluation, adds context history to the cockpit, and exposes a manual context lock.

**AEGIS-PROCS-01** — Process management complete with implications. Process action buttons work from COCKPIT-02 but feedback UX can be improved. This sprint adds suspend badges, post-action confirmation, and critical process warnings.
