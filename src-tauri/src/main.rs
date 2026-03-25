// AEGIS v4 — Cognitive Resource OS
// Tauri 2 native Windows application
// Rust core: system metrics, process control, tray, sidecar orchestration

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod metrics;
mod profiles;
mod sidecar;
mod tray;

use std::sync::{Arc, Mutex};
use tauri::Emitter;

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

            // Start metrics polling — emits "metrics" events to cockpit every 2s
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
            commands::kill_process_cmd,
            commands::get_active_profile,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("AEGIS failed to start");
}
