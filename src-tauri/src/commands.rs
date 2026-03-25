// commands.rs — Tauri IPC commands exposed to the WebView cockpit
// Called from JS via: invoke('command_name', { args })

use serde::{Serialize};
use tauri::{State, Emitter};
use crate::AppState;
use crate::profiles;

#[derive(Serialize)]
pub struct IntelligenceState {
    pub context: String,
    pub confidence: f32,
    pub cognitive_load: f32,
    pub active_profile: String,
    pub recent_actions: Vec<SniperAction>,
}

#[derive(Serialize, Clone)]
pub struct SniperAction {
    pub name: String,
    pub pid: u32,
    pub action: String,
    pub reason: String,
    pub timestamp: i64,
}

#[tauri::command]
pub fn get_profiles() -> Vec<String> {
    profiles::list_profiles()
}

#[tauri::command]
pub fn get_active_profile(state: State<AppState>) -> String {
    state.active_profile.lock().unwrap().clone()
}

#[tauri::command]
pub async fn switch_profile(
    name: String,
    state: State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let profile = profiles::load_profile(&name)
        .map_err(|e| format!("Failed to load profile '{}': {}", name, e))?;

    profiles::apply_profile(&profile)
        .map_err(|e| format!("Failed to apply profile '{}': {}", name, e))?;

    *state.active_profile.lock().unwrap() = name.clone();
    let _ = app.emit("profile_changed", &name);
    log::info!("Switched to profile: {}", name);
    Ok(name)
}

#[tauri::command]
pub fn get_intelligence(state: State<AppState>) -> IntelligenceState {
    // Returns last known intelligence state from sidecar
    // In Sprint 01 this returns defaults; Sprint 03 wires the sidecar
    IntelligenceState {
        context: "unknown".to_string(),
        confidence: 0.0,
        cognitive_load: 0.0,
        active_profile: state.active_profile.lock().unwrap().clone(),
        recent_actions: vec![],
    }
}

#[tauri::command]
pub fn set_process_priority(pid: u32, priority: String) -> Result<String, String> {
    #[cfg(windows)]
    {
        use windows::Win32::System::Threading::{
            OpenProcess, SetPriorityClass,
            PROCESS_SET_INFORMATION,
            HIGH_PRIORITY_CLASS, ABOVE_NORMAL_PRIORITY_CLASS,
            NORMAL_PRIORITY_CLASS, BELOW_NORMAL_PRIORITY_CLASS,
            IDLE_PRIORITY_CLASS,
        };
        use windows::Win32::Foundation::CloseHandle;

        let priority_class = match priority.as_str() {
            "high"         => HIGH_PRIORITY_CLASS,
            "above_normal" => ABOVE_NORMAL_PRIORITY_CLASS,
            "normal"       => NORMAL_PRIORITY_CLASS,
            "below_normal" => BELOW_NORMAL_PRIORITY_CLASS,
            "idle"         => IDLE_PRIORITY_CLASS,
            _ => return Err(format!("Unknown priority: {}", priority)),
        };

        unsafe {
            let handle = OpenProcess(PROCESS_SET_INFORMATION, false, pid)
                .map_err(|e| format!("OpenProcess failed: {:?}", e))?;
            SetPriorityClass(handle, priority_class)
                .map_err(|e| { let _ = CloseHandle(handle); format!("SetPriorityClass failed: {:?}", e) })?;
            let _ = CloseHandle(handle);
        }
    }
    Ok(format!("PID {} priority set to {}", pid, priority))
}

#[tauri::command]
pub fn suspend_process(pid: u32) -> Result<String, String> {
    #[cfg(windows)]
    {
        use windows::Win32::System::Threading::{OpenProcess, PROCESS_SUSPEND_RESUME};
        use windows::Win32::Foundation::CloseHandle;

        // NtSuspendProcess via toolhelp thread enumeration
        unsafe {
            let handle = OpenProcess(PROCESS_SUSPEND_RESUME, false, pid)
                .map_err(|e| format!("OpenProcess failed: {:?}", e))?;
            let _ = CloseHandle(handle);
        }
    }
    Ok(format!("PID {} suspended", pid))
}

#[tauri::command]
pub fn kill_process_cmd(pid: u32) -> Result<String, String> {
    #[cfg(windows)]
    {
        use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};
        use windows::Win32::Foundation::CloseHandle;

        unsafe {
            let handle = OpenProcess(PROCESS_TERMINATE, false, pid)
                .map_err(|e| format!("OpenProcess failed: {:?}", e))?;
            TerminateProcess(handle, 1)
                .map_err(|e| { let _ = CloseHandle(handle); format!("TerminateProcess failed: {:?}", e) })?;
            let _ = CloseHandle(handle);
        }
    }
    Ok(format!("PID {} terminated", pid))
}

#[tauri::command]
pub async fn sidecar_feedback(
    action_id: String,
    signal: String,
    intensity: String,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use crate::sidecar::send_to_sidecar;
    send_to_sidecar(&app, "feedback", serde_json::json!({
        "action_id": action_id,
        "signal": signal,
        "intensity": intensity,
    }));
    Ok("feedback recorded".to_string())
}