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

#[derive(Serialize)]
pub struct ProcessInfo {
    pub name: String,
    pub description: String,
    pub publisher: String,
    pub risk_label: String,    // "SAFE" | "CAUTION" | "DO_NOT_TOUCH" | "CRITICAL_SYSTEM"
    pub blast_radius: String,  // "none" | "low" | "medium" | "high" | "critical"
    pub safe_to_end: bool,
    pub safe_to_suspend: bool,
    pub implication: String,
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
        use windows::Win32::System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Thread32First, Thread32Next,
            THREADENTRY32, TH32CS_SNAPTHREAD,
        };
        use windows::Win32::System::Threading::{OpenThread, SuspendThread, THREAD_SUSPEND_RESUME};
        use windows::Win32::Foundation::CloseHandle;

        let mut suspended = 0u32;

        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0)
                .map_err(|e| format!("CreateToolhelp32Snapshot failed: {:?}", e))?;

            let mut entry = THREADENTRY32 {
                dwSize: std::mem::size_of::<THREADENTRY32>() as u32,
                ..Default::default()
            };

            if Thread32First(snapshot, &mut entry).is_ok() {
                loop {
                    if entry.th32OwnerProcessID == pid {
                        if let Ok(thread) = OpenThread(THREAD_SUSPEND_RESUME, false, entry.th32ThreadID) {
                            SuspendThread(thread);
                            let _ = CloseHandle(thread);
                            suspended += 1;
                        }
                    }
                    entry.dwSize = std::mem::size_of::<THREADENTRY32>() as u32;
                    if Thread32Next(snapshot, &mut entry).is_err() {
                        break;
                    }
                }
            }
            let _ = CloseHandle(snapshot);
        }

        if suspended == 0 {
            return Err(format!("No threads found for PID {} — process may have exited", pid));
        }

        return Ok(format!("PID {} suspended ({} threads frozen)", pid, suspended));
    }

    #[cfg(not(windows))]
    Ok(format!("PID {} suspended (stub — non-Windows)", pid))
}

#[tauri::command]
pub fn resume_process(pid: u32) -> Result<String, String> {
    #[cfg(windows)]
    {
        use windows::Win32::System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Thread32First, Thread32Next,
            THREADENTRY32, TH32CS_SNAPTHREAD,
        };
        use windows::Win32::System::Threading::{OpenThread, ResumeThread, THREAD_SUSPEND_RESUME};
        use windows::Win32::Foundation::CloseHandle;

        let mut resumed = 0u32;

        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPTHREAD, 0)
                .map_err(|e| format!("CreateToolhelp32Snapshot failed: {:?}", e))?;

            let mut entry = THREADENTRY32 {
                dwSize: std::mem::size_of::<THREADENTRY32>() as u32,
                ..Default::default()
            };

            if Thread32First(snapshot, &mut entry).is_ok() {
                loop {
                    if entry.th32OwnerProcessID == pid {
                        if let Ok(thread) = OpenThread(THREAD_SUSPEND_RESUME, false, entry.th32ThreadID) {
                            ResumeThread(thread);
                            let _ = CloseHandle(thread);
                            resumed += 1;
                        }
                    }
                    entry.dwSize = std::mem::size_of::<THREADENTRY32>() as u32;
                    if Thread32Next(snapshot, &mut entry).is_err() {
                        break;
                    }
                }
            }
            let _ = CloseHandle(snapshot);
        }

        if resumed == 0 {
            return Err(format!("No threads found for PID {} — process may have exited", pid));
        }

        return Ok(format!("PID {} resumed ({} threads unfrozen)", pid, resumed));
    }

    #[cfg(not(windows))]
    Ok(format!("PID {} resumed (stub — non-Windows)", pid))
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
pub fn get_process_info(name: String) -> ProcessInfo {
    let key = name.to_lowercase();
    let key = key.trim_end_matches(".exe");

    match key {
        "lsass" => ProcessInfo {
            name,
            description: "Local Security Authority Subsystem — manages all Windows login, authentication, and security tokens.".into(),
            publisher: "Microsoft".into(),
            risk_label: "CRITICAL_SYSTEM".into(),
            blast_radius: "critical".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "Ending lsass will immediately trigger a Windows BSOD and force a hard reboot. There is no recovery path.".into(),
        },
        "csrss" => ProcessInfo {
            name,
            description: "Client/Server Runtime Subsystem — core Windows process that manages console windows and shutdown.".into(),
            publisher: "Microsoft".into(),
            risk_label: "CRITICAL_SYSTEM".into(),
            blast_radius: "critical".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "Ending csrss immediately crashes Windows. The system will BSOD or freeze with no warning.".into(),
        },
        "winlogon" => ProcessInfo {
            name,
            description: "Windows Logon — handles the Ctrl+Alt+Del secure attention sequence and user login/logout lifecycle.".into(),
            publisher: "Microsoft".into(),
            risk_label: "CRITICAL_SYSTEM".into(),
            blast_radius: "critical".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "Ending winlogon crashes your session immediately. You will lose all unsaved work and Windows will restart.".into(),
        },
        "wininit" => ProcessInfo {
            name,
            description: "Windows Initialization — starts core system services during boot. Cannot be ended safely.".into(),
            publisher: "Microsoft".into(),
            risk_label: "CRITICAL_SYSTEM".into(),
            blast_radius: "critical".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "Ending wininit will crash Windows immediately. The system will BSOD.".into(),
        },
        "smss" => ProcessInfo {
            name,
            description: "Session Manager Subsystem — the first user-mode process started by the Windows kernel.".into(),
            publisher: "Microsoft".into(),
            risk_label: "CRITICAL_SYSTEM".into(),
            blast_radius: "critical".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "Ending smss will immediately crash Windows. This is a kernel-level process.".into(),
        },
        "dwm" => ProcessInfo {
            name,
            description: "Desktop Window Manager — composites and renders every window on screen using the GPU.".into(),
            publisher: "Microsoft".into(),
            risk_label: "CRITICAL_SYSTEM".into(),
            blast_radius: "critical".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "Ending dwm crashes the visual desktop entirely and forces a reboot. All open work is lost.".into(),
        },
        "services" => ProcessInfo {
            name,
            description: "Windows Services Control Manager — manages the lifecycle of all Windows background services.".into(),
            publisher: "Microsoft".into(),
            risk_label: "CRITICAL_SYSTEM".into(),
            blast_radius: "critical".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "Ending services stops ALL Windows background services simultaneously and forces a reboot.".into(),
        },
        "svchost" => ProcessInfo {
            name,
            description: "Service Host — a shared container that runs multiple Windows services in a single process.".into(),
            publisher: "Microsoft".into(),
            risk_label: "DO_NOT_TOUCH".into(),
            blast_radius: "high".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "Ending svchost can stop multiple Windows services at once — networking, audio, Windows Update, and more may fail simultaneously.".into(),
        },
        "explorer" => ProcessInfo {
            name,
            description: "Windows Explorer — your desktop shell, taskbar, Start menu, and file manager.".into(),
            publisher: "Microsoft".into(),
            risk_label: "DO_NOT_TOUCH".into(),
            blast_radius: "high".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "Ending explorer removes your taskbar and closes all File Explorer windows. Windows will restart it automatically, but you will lose your desktop state.".into(),
        },
        "audiodg" => ProcessInfo {
            name,
            description: "Windows Audio Device Graph — the isolated process that processes all audio output and effects.".into(),
            publisher: "Microsoft".into(),
            risk_label: "DO_NOT_TOUCH".into(),
            blast_radius: "medium".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "Ending audiodg kills all system audio immediately. Windows will attempt to restart it, but apps playing audio may crash or hang.".into(),
        },
        "searchindexer" => ProcessInfo {
            name,
            description: "Windows Search Indexer — builds and maintains the search index for fast file and email search.".into(),
            publisher: "Microsoft".into(),
            risk_label: "CAUTION".into(),
            blast_radius: "low".into(),
            safe_to_end: true,
            safe_to_suspend: true,
            implication: "Ending searchindexer stops Windows Search temporarily. Search results may be slow or incomplete until it restarts automatically.".into(),
        },
        "msmpeng" => ProcessInfo {
            name,
            description: "Microsoft Defender Antivirus — real-time malware protection and background scanning engine.".into(),
            publisher: "Microsoft".into(),
            risk_label: "CAUTION".into(),
            blast_radius: "medium".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "Ending MsMpEng disables real-time antivirus protection until Windows restarts Defender. Your system is unprotected during this window.".into(),
        },
        "node" => ProcessInfo {
            name,
            description: "Node.js — a JavaScript runtime. Likely running a dev server, build tool, or background script.".into(),
            publisher: "Node.js Foundation".into(),
            risk_label: "SAFE".into(),
            blast_radius: "low".into(),
            safe_to_end: true,
            safe_to_suspend: true,
            implication: "Ending node stops the script or server it is running. Any in-progress network requests or file writes will be interrupted.".into(),
        },
        "chrome" => ProcessInfo {
            name,
            description: "Google Chrome — web browser. Multiple instances are normal; each tab runs in its own process.".into(),
            publisher: "Google".into(),
            risk_label: "SAFE".into(),
            blast_radius: "low".into(),
            safe_to_end: true,
            safe_to_suspend: true,
            implication: "Ending this Chrome process closes the associated tab or window. Unsaved form data and unfinished downloads will be lost.".into(),
        },
        "brave" => ProcessInfo {
            name,
            description: "Brave — privacy-focused web browser built on Chromium.".into(),
            publisher: "Brave Software".into(),
            risk_label: "SAFE".into(),
            blast_radius: "low".into(),
            safe_to_end: true,
            safe_to_suspend: true,
            implication: "Ending this Brave process closes the associated tab or window. Unsaved form data will be lost.".into(),
        },
        "msedge" => ProcessInfo {
            name,
            description: "Microsoft Edge — web browser built on Chromium.".into(),
            publisher: "Microsoft".into(),
            risk_label: "SAFE".into(),
            blast_radius: "low".into(),
            safe_to_end: true,
            safe_to_suspend: true,
            implication: "Ending this Edge process closes the associated tab or window. Unsaved form data will be lost.".into(),
        },
        "firefox" => ProcessInfo {
            name,
            description: "Mozilla Firefox — web browser.".into(),
            publisher: "Mozilla".into(),
            risk_label: "SAFE".into(),
            blast_radius: "low".into(),
            safe_to_end: true,
            safe_to_suspend: true,
            implication: "Ending Firefox closes all open tabs and windows. Session Restore will offer to reopen them on next launch.".into(),
        },
        "code" => ProcessInfo {
            name,
            description: "Visual Studio Code — source code editor and development environment.".into(),
            publisher: "Microsoft".into(),
            risk_label: "SAFE".into(),
            blast_radius: "low".into(),
            safe_to_end: true,
            safe_to_suspend: true,
            implication: "Ending VS Code closes the editor. Unsaved files will be lost, but VS Code offers to restore your workspace layout on next open.".into(),
        },
        "teams" => ProcessInfo {
            name,
            description: "Microsoft Teams — workplace communication and video calling app.".into(),
            publisher: "Microsoft".into(),
            risk_label: "SAFE".into(),
            blast_radius: "low".into(),
            safe_to_end: true,
            safe_to_suspend: false,
            implication: "Ending Teams disconnects any active calls or meetings immediately. You will appear offline to your contacts.".into(),
        },
        "slack" => ProcessInfo {
            name,
            description: "Slack — team messaging and collaboration app.".into(),
            publisher: "Salesforce".into(),
            risk_label: "SAFE".into(),
            blast_radius: "none".into(),
            safe_to_end: true,
            safe_to_suspend: true,
            implication: "Ending Slack closes the app. Messages sent while it is closed will be waiting when you reopen it.".into(),
        },
        "discord" => ProcessInfo {
            name,
            description: "Discord — voice, video, and text communication platform.".into(),
            publisher: "Discord Inc.".into(),
            risk_label: "SAFE".into(),
            blast_radius: "none".into(),
            safe_to_end: true,
            safe_to_suspend: false,
            implication: "Ending Discord disconnects any active voice or video calls and closes the app.".into(),
        },
        "spotify" => ProcessInfo {
            name,
            description: "Spotify — music and podcast streaming service.".into(),
            publisher: "Spotify AB".into(),
            risk_label: "SAFE".into(),
            blast_radius: "none".into(),
            safe_to_end: true,
            safe_to_suspend: true,
            implication: "Ending Spotify stops audio playback immediately and closes the app.".into(),
        },
        "steam" => ProcessInfo {
            name,
            description: "Steam — PC gaming platform and game library manager.".into(),
            publisher: "Valve Corporation".into(),
            risk_label: "SAFE".into(),
            blast_radius: "low".into(),
            safe_to_end: true,
            safe_to_suspend: false,
            implication: "Ending Steam closes the launcher. Running games using Steam DRM may crash or lose progress if ended while actively playing.".into(),
        },
        "obs" | "obs64" => ProcessInfo {
            name,
            description: "OBS Studio — screen recording and live streaming software.".into(),
            publisher: "OBS Project".into(),
            risk_label: "SAFE".into(),
            blast_radius: "low".into(),
            safe_to_end: true,
            safe_to_suspend: false,
            implication: "Ending OBS stops any active recording or live stream immediately. The current recording file may be incomplete or corrupt.".into(),
        },
        "python" | "python3" => ProcessInfo {
            name,
            description: "Python interpreter — running a script, server, or interactive session.".into(),
            publisher: "Python Software Foundation".into(),
            risk_label: "SAFE".into(),
            blast_radius: "low".into(),
            safe_to_end: true,
            safe_to_suspend: true,
            implication: "Ending python stops the script or server it is running. Any in-progress file writes or network requests will be interrupted.".into(),
        },
        "msedgewebview2" => ProcessInfo {
            name,
            description: "WebView2 Runtime — the embedded browser engine used by AEGIS (and many modern apps) to render UI.".into(),
            publisher: "Microsoft".into(),
            risk_label: "DO_NOT_TOUCH".into(),
            blast_radius: "high".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "Ending this WebView2 process will likely close AEGIS or the app using it. You may lose your current session.".into(),
        },
        "system" => ProcessInfo {
            name,
            description: "The Windows kernel itself — not a real user-mode process.".into(),
            publisher: "Microsoft".into(),
            risk_label: "CRITICAL_SYSTEM".into(),
            blast_radius: "critical".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "This is the OS kernel. It cannot be ended. Any attempt will be silently blocked by Windows.".into(),
        },
        "system idle process" => ProcessInfo {
            name,
            description: "Represents unused CPU capacity — not a real process. Its CPU % is how much of the CPU is idle.".into(),
            publisher: "Microsoft".into(),
            risk_label: "SAFE".into(),
            blast_radius: "none".into(),
            safe_to_end: false,
            safe_to_suspend: false,
            implication: "This is not a real process. It cannot be ended. It simply shows how much CPU time is unused.".into(),
        },
        "taskmgr" => ProcessInfo {
            name,
            description: "Windows Task Manager — the built-in system monitor and process manager.".into(),
            publisher: "Microsoft".into(),
            risk_label: "SAFE".into(),
            blast_radius: "none".into(),
            safe_to_end: true,
            safe_to_suspend: true,
            implication: "Ending Task Manager simply closes the app. It can be reopened at any time.".into(),
        },
        _ => ProcessInfo {
            name,
            description: "Unknown process — not in AEGIS's process knowledge base.".into(),
            publisher: "Unknown".into(),
            risk_label: "SAFE".into(),
            blast_radius: "low".into(),
            safe_to_end: true,
            safe_to_suspend: true,
            implication: "No known critical dependencies. Verify the process path before ending if you are unsure what it does.".into(),
        },
    }
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


#[tauri::command]
pub async fn sidecar_lock_context(
    context: String,
    duration_min: u32,
    app: tauri::AppHandle,
) -> Result<String, String> {
    use crate::sidecar::send_to_sidecar;
    send_to_sidecar(&app, "lock_context", serde_json::json!({
        "context": context,
        "duration_min": duration_min,
    }));
    Ok(format!("Context locked to {} for {}min", context, duration_min))
}

#[tauri::command]
pub fn get_latest_metrics() -> Option<crate::metrics::SystemMetrics> {
    crate::metrics::get_cached_snapshot()
}

#[tauri::command]
pub async fn get_policy_status(app: tauri::AppHandle) -> Result<String, String> {
    use crate::sidecar::send_to_sidecar;
    send_to_sidecar(&app, "get_policy_status", serde_json::json!({}));
    Ok("policy_status_requested".to_string())
}

#[tauri::command]
pub async fn audit_policies(app: tauri::AppHandle) -> Result<String, String> {
    use crate::sidecar::send_to_sidecar;
    send_to_sidecar(&app, "audit_policies", serde_json::json!({}));
    Ok("policy_audit_started".to_string())
}
