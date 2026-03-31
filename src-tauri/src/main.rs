// AEGIS v4 — Cognitive Resource OS
// Tauri 2 native Windows application
// Rust core: system metrics, process control, tray, sidecar orchestration

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod disk_io;
mod metrics;
mod profiles;
mod sidecar;
mod tray;

use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

pub struct AppState {
    pub active_profile: Arc<Mutex<String>>,
    pub sidecar_tx: Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>,
}

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            active_profile: Arc::new(Mutex::new("idle".to_string())),
            sidecar_tx: Arc::new(Mutex::new(None)),
        })
        .setup(|app| {
            // Build tray
            tray::setup_tray(app)?;

            // ── FIX: Briefly show cockpit so WebView JS context initializes ──
            if let Some(window) = app.get_webview_window("cockpit") {
                let _ = window.show();
                let w = window.clone();
                let app_handle_vis = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
                    let _ = w.hide();
                    if let Some(vis) = app_handle_vis.try_state::<tray::CockpitVisible>() {
                        let mut state = vis.lock().unwrap();
                        state.visible = false;
                    }
                });
            }

            // Start disk I/O background thread
            disk_io::start_disk_io_thread();

            // Start metrics polling
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                metrics::start_polling(app_handle).await;
            });

            // Start intelligence sidecar
            let app_handle2 = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                sidecar::start_sidecar(app_handle2).await;
            });

            // Load and apply default profile
            let app_handle3 = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
                if let Ok(profile) = profiles::load_profile("idle") {
                    let _ = profiles::apply_profile(&profile);
                    log::info!("Applied default profile: idle");
                    let _ = app_handle3.emit("profile_changed", "idle");
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_profiles,
            commands::switch_profile,
            commands::get_intelligence,
            commands::set_process_priority,
            commands::suspend_process,
            commands::resume_process,
            commands::kill_process_cmd,
            commands::get_process_info,
            commands::get_active_profile,
            commands::sidecar_feedback,
            commands::sidecar_lock_context,
            commands::get_latest_metrics,
            commands::get_policy_status,
            commands::audit_policies,
        ])
        .on_window_event(|window, event| {
            if window.label() == "cockpit" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                    if let Some(vis) = window.app_handle().try_state::<tray::CockpitVisible>() {
                        let mut state = vis.inner().lock().unwrap();
                        state.visible = false;
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("AEGIS failed to start");
}
