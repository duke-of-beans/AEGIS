// sidecar.rs — Spawn and communicate with the intelligence sidecar
// The sidecar is a compiled Node.js binary (pkg) bundled alongside AEGIS.
// It runs the context engine, sniper, learning store, catalog, and MCP server.
// Communication is JSON-RPC 2.0 over stdin/stdout — same protocol as the old PS worker,
// but now with a process that actually stays alive.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_shell::ShellExt;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct IntelligenceEvent {
    pub event_type: String,
    pub context: Option<String>,
    pub confidence: Option<f32>,
    pub cognitive_load: Option<f32>,
    pub action_requested: Option<SniperRequest>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SniperRequest {
    pub pid: u32,
    pub name: String,
    pub action: String,
    pub reason: String,
}

pub async fn start_sidecar<R: Runtime>(app: AppHandle<R>) {
    loop {
        log::info!("Starting intelligence sidecar...");

        let sidecar_result = app
            .shell()
            .sidecar("aegis-sidecar")
            .map(|cmd| cmd.spawn());

        match sidecar_result {
            Ok(Ok((mut rx, child))) => {
                log::info!("Intelligence sidecar started");

                if let Some(state) = app.try_state::<crate::AppState>() {
                    *state.sidecar_tx.lock().unwrap() = Some(child);
                }

                while let Some(event) = rx.recv().await {
                    use tauri_plugin_shell::process::CommandEvent;
                    match event {
                        CommandEvent::Stdout(line) => {
                            let s = String::from_utf8_lossy(&line);
                            handle_sidecar_line(&app, s.trim());
                        }
                        CommandEvent::Stderr(line) => {
                            log::warn!("Sidecar stderr: {}", String::from_utf8_lossy(&line).trim());
                        }
                        CommandEvent::Error(e) => {
                            log::error!("Sidecar error: {}", e);
                            break;
                        }
                        CommandEvent::Terminated(status) => {
                            log::warn!("Sidecar terminated: {:?}", status);
                            break;
                        }
                        _ => {}
                    }
                }

                log::warn!("Sidecar exited — restarting in 3s");
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            }
            Ok(Err(e)) => {
                log::warn!("Failed to spawn sidecar: {} — running without intelligence layer", e);
                return; // don't retry spawn errors
            }
            Err(e) => {
                log::warn!("Sidecar binary not found: {} — running without intelligence layer", e);
                return; // don't retry missing binary
            }
        }
    }
}

fn handle_sidecar_line<R: Runtime>(app: &AppHandle<R>, line: &str) {
    if line.is_empty() { return; }

    match serde_json::from_str::<serde_json::Value>(line) {
        Ok(json) => {
            let event_type = json.get("type")
                .and_then(|t| t.as_str())
                .unwrap_or("unknown");

            match event_type {
                "context_changed" => {
                    let _ = app.emit("intelligence_update", &json);
                    log::debug!("Context changed: {}", json);
                }
                "load_score_updated" => {
                    let _ = app.emit("intelligence_update", &json);
                }
                "sniper_action_requested" => {
                    // Sidecar wants us to act on a process
                    handle_sniper_request(app, &json);
                }
                "heartbeat" => {
                    log::debug!("Sidecar heartbeat");
                }
                _ => {
                    log::debug!("Sidecar msg ({}): {}", event_type, line);
                }
            }
        }
        Err(_) => {
            log::debug!("Sidecar (non-JSON): {}", line);
        }
    }
}

fn handle_sniper_request<R: Runtime>(app: &AppHandle<R>, json: &serde_json::Value) {
    let pid = json.get("pid").and_then(|p| p.as_u64()).unwrap_or(0) as u32;
    let action = json.get("action").and_then(|a| a.as_str()).unwrap_or("").to_string();
    let name = json.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();

    if pid == 0 { return; }

    log::info!("Sniper action requested: {} on PID {} ({})", action, pid, name);

    match action.as_str() {
        "throttle" => {
            let _ = crate::commands::set_process_priority(pid, "idle".to_string());
        }
        "kill" => {
            let _ = crate::commands::kill_process_cmd(pid);
        }
        _ => {}
    }

    // Emit action to cockpit for display in action log
    let _ = app.emit("sniper_action", json);
}
