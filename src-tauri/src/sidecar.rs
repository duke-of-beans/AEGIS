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

/// Send a JSON-RPC request to the sidecar's stdin.
/// Best-effort — logs on failure, never panics.
/// Called from metrics.rs on each poll cycle to push CPU/memory data.
pub fn send_to_sidecar<R: Runtime>(app: &AppHandle<R>, method: &str, params: serde_json::Value) {
    if let Some(state) = app.try_state::<crate::AppState>() {
        let mut guard = state.sidecar_tx.lock().unwrap();
        if let Some(child) = guard.as_mut() {
            let req = serde_json::json!({
                "jsonrpc": "2.0",
                "id": 0,
                "method": method,
                "params": params
            });
            let mut line = req.to_string();
            line.push('\n');
            if let Err(e) = child.write(line.as_bytes()) {
                log::warn!("send_to_sidecar({}) write failed: {}", method, e);
            }
        }
    }
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

                // Clear the child handle on exit so send_to_sidecar fails gracefully
                if let Some(state) = app.try_state::<crate::AppState>() {
                    *state.sidecar_tx.lock().unwrap() = None;
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
    let action_id = json.get("action_id").and_then(|a| a.as_str()).unwrap_or("").to_string();
    let reason = json.get("reason").and_then(|r| r.as_str()).unwrap_or("").to_string();
    let timestamp = json.get("timestamp").and_then(|t| t.as_str()).unwrap_or("").to_string();

    if pid == 0 { return; }

    log::info!("Sniper action requested: {} on PID {} ({})", action, pid, name);

    match action.as_str() {
        "throttle" => {
            let _ = crate::commands::set_process_priority(pid, "idle".to_string());
        }
        "suspend" => {
            let _ = crate::commands::suspend_process(pid);
        }
        "kill" => {
            let _ = crate::commands::kill_process_cmd(pid);
        }
        _ => {}
    }

    // Emit action to cockpit for display in action log (includes reason from sidecar)
    let _ = app.emit("sniper_action", json);

    // Schedule a feedback_prompt notification 90 seconds later (non-blocking)
    if !action_id.is_empty() {
        let app_clone = app.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(90)).await;
            let payload = serde_json::json!({
                "action_id": action_id,
                "process_name": name,
                "action": action,
                "reason": reason,
                "timestamp": timestamp,
            });
            let _ = app_clone.emit("feedback_prompt", payload);
            log::debug!("feedback_prompt emitted for action {}", action_id);
        });
    }
}
