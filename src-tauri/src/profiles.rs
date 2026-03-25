// profiles.rs — Load and apply YAML profiles
// Profiles live in resources/profiles/ after installation,
// or in ../../profiles/ during development

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Profile {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub processes: Vec<ProcessRule>,
    #[serde(default)]
    pub power_plan: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ProcessRule {
    pub name: String,
    #[serde(default = "default_priority")]
    pub cpu_priority: String,
    #[serde(default = "default_priority")]
    pub io_priority: String,
}

fn default_priority() -> String { "normal".to_string() }

fn profiles_dir() -> PathBuf {
    // Dev: relative to src-tauri
    let dev_path = PathBuf::from("../profiles");
    if dev_path.exists() { return dev_path; }
    // Installed: next to exe
    let exe_path = std::env::current_exe()
        .unwrap_or_default()
        .parent()
        .unwrap_or(&PathBuf::new())
        .join("profiles");
    exe_path
}

pub fn list_profiles() -> Vec<String> {
    let dir = profiles_dir();
    let mut names = vec![];
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("yaml") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    names.push(stem.to_string());
                }
            }
        }
    }
    names.sort();
    names
}

pub fn load_profile(name: &str) -> Result<Profile, String> {
    let path = profiles_dir().join(format!("{}.yaml", name));
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Cannot read profile '{}': {}", name, e))?;
    let mut profile: Profile = serde_yaml::from_str(&content)
        .map_err(|e| format!("Cannot parse profile '{}': {}", name, e))?;
    profile.name = name.to_string();
    Ok(profile)
}

pub fn apply_profile(profile: &Profile) -> Result<(), String> {
    // Apply power plan if specified
    if let Some(ref plan) = profile.power_plan {
        let guid = match plan.as_str() {
            "high_performance" => "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c",
            "balanced"         => "381b4222-f694-41f0-9685-ff5bb260df2e",
            "power_saver"      => "a1841308-3541-4fab-bc81-f71556f20b4a",
            other              => other,
        };
        let _ = std::process::Command::new("powercfg")
            .args(["/setactive", guid])
            .output();
    }

    // Apply process priorities
    for rule in &profile.processes {
        apply_process_rule(rule);
    }

    log::info!("Profile '{}' applied ({} rules)", profile.name, profile.processes.len());
    Ok(())
}

fn apply_process_rule(rule: &ProcessRule) {
    use sysinfo::{System, ProcessRefreshKind};
    let mut sys = System::new();
    sys.refresh_processes_specifics(
        sysinfo::ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing(),
    );

    let target = rule.name.to_lowercase().replace(".exe", "");
    for (pid, proc) in sys.processes() {
        let proc_name = proc.name().to_string_lossy().to_lowercase().replace(".exe", "");
        if proc_name == target {
            set_priority_for_pid(pid.as_u32(), &rule.cpu_priority);
        }
    }
}

fn set_priority_for_pid(pid: u32, priority: &str) {
    #[cfg(windows)]
    {
        use windows::Win32::System::Threading::{
            OpenProcess, SetPriorityClass, PROCESS_SET_INFORMATION,
            HIGH_PRIORITY_CLASS, ABOVE_NORMAL_PRIORITY_CLASS,
            NORMAL_PRIORITY_CLASS, BELOW_NORMAL_PRIORITY_CLASS, IDLE_PRIORITY_CLASS,
        };
        use windows::Win32::Foundation::CloseHandle;

        let class = match priority {
            "high"         => HIGH_PRIORITY_CLASS,
            "above_normal" => ABOVE_NORMAL_PRIORITY_CLASS,
            "below_normal" => BELOW_NORMAL_PRIORITY_CLASS,
            "idle"         => IDLE_PRIORITY_CLASS,
            _              => NORMAL_PRIORITY_CLASS,
        };

        unsafe {
            if let Ok(handle) = OpenProcess(PROCESS_SET_INFORMATION, false, pid) {
                let _ = SetPriorityClass(handle, class);
                let _ = CloseHandle(handle);
            }
        }
    }
}
