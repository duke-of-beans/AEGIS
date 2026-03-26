// metrics.rs — System metrics polling via sysinfo crate
// No elevation required. No subprocess. Reads same PDH counters as Task Manager.

use serde::Serialize;
use sysinfo::{Disks, Networks, System, ProcessStatus};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use std::time::Duration;
use tokio::time;

#[derive(Serialize, Clone, Debug)]
pub struct CpuMetrics {
    pub percent: f32,
    pub core_count: usize,
    pub frequency_mhz: u64,
}

#[derive(Serialize, Clone, Debug)]
pub struct MemMetrics {
    pub used_mb: u64,
    pub total_mb: u64,
    pub available_mb: u64,
    pub percent: f32,
}

#[derive(Serialize, Clone, Debug)]
pub struct DiskMetrics {
    pub name: String,
    pub mount: String,
    pub total_gb: f64,
    pub available_gb: f64,
    pub read_bytes_sec: u64,
    pub write_bytes_sec: u64,
    pub percent_used: f32,
}

#[derive(Serialize, Clone, Debug)]
pub struct NetMetrics {
    pub name: String,
    pub received_bytes_sec: u64,
    pub transmitted_bytes_sec: u64,
}

#[derive(Serialize, Clone, Debug)]
pub struct ProcessMetric {
    pub pid: u32,
    pub parent_pid: Option<u32>,
    pub name: String,
    pub cpu_percent: f32,
    pub memory_mb: f64,
    pub status: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct SystemMetrics {
    pub timestamp: String,
    pub cpu: CpuMetrics,
    pub memory: MemMetrics,
    pub disks: Vec<DiskMetrics>,
    pub networks: Vec<NetMetrics>,
    pub processes: Vec<ProcessMetric>,
    pub uptime_sec: u64,
    pub worker_status: String,
}

pub async fn start_polling<R: Runtime>(app: AppHandle<R>) {
    let mut sys = System::new_all();
    let mut disks = Disks::new_with_refreshed_list();
    let mut networks = Networks::new_with_refreshed_list();

    // Warmup: sysinfo needs two refresh cycles to compute CPU percentages.
    // Without this, the first tick returns 0% CPU.
    sys.refresh_all();
    time::sleep(Duration::from_millis(500)).await;
    sys.refresh_all();

    let mut interval = time::interval(Duration::from_secs(2));

    loop {
        interval.tick().await;

        sys.refresh_all();
        disks.refresh(true);
        networks.refresh(true);

        let metrics = collect_metrics(&sys, &disks, &networks);

        // Push CPU + memory to sidecar for cognitive load computation.
        // Best-effort — if sidecar is not running, send_to_sidecar is a no-op.
        crate::sidecar::send_to_sidecar(&app, "update_metrics", serde_json::json!({
            "cpu_percent": metrics.cpu.percent,
            "memory_percent": metrics.memory.percent
        }));

        // Feed process snapshots to sidecar for baseline tracking + sniper evaluation.
        // Best-effort — if sidecar is not running, send_to_sidecar is a no-op.
        let proc_payload: Vec<serde_json::Value> = metrics.processes.iter().map(|p| serde_json::json!({
            "pid": p.pid,
            "name": p.name,
            "cpu_percent": p.cpu_percent,
            "memory_mb": p.memory_mb,
            "handle_count": 0
        })).collect();
        crate::sidecar::send_to_sidecar(&app, "update_processes", serde_json::json!({
            "processes": proc_payload
        }));

        let _ = app.emit("metrics", &metrics);

        // Also emit directly to the cockpit window — ensures delivery even if
        // the window was hidden when the global event fired.
        if let Some(window) = app.get_webview_window("cockpit") {
            let _ = window.emit("metrics", &metrics);
        }

        log::info!("metrics: cpu={:.1}% mem={}/{} MB procs={}",
            metrics.cpu.percent, metrics.memory.used_mb,
            metrics.memory.total_mb, metrics.processes.len());
    }
}

fn collect_metrics(sys: &System, disks: &Disks, networks: &Networks) -> SystemMetrics {
    let cpu_percent = sys.global_cpu_usage();
    let cpu_count = sys.cpus().len();
    let cpu_freq = sys.cpus().first().map(|c| c.frequency()).unwrap_or(0);

    let total_mem = sys.total_memory() / 1024 / 1024;
    let used_mem = sys.used_memory() / 1024 / 1024;
    let avail_mem = sys.available_memory() / 1024 / 1024;
    let mem_pct = if total_mem > 0 { (used_mem as f32 / total_mem as f32) * 100.0 } else { 0.0 };

    // Fetch per-drive I/O from WMI once before the loop; empty map on failure (graceful degradation)
    let io_map = crate::disk_io::get_disk_io();

    let disk_metrics: Vec<DiskMetrics> = disks.list().iter().map(|d| {
        let total = d.total_space();
        let avail = d.available_space();
        let used = total.saturating_sub(avail);
        let pct = if total > 0 { (used as f32 / total as f32) * 100.0 } else { 0.0 };

        // Extract drive letter from mount point (e.g. "C:\\" -> "C")
        let drive_letter = d.mount_point()
            .to_string_lossy()
            .chars()
            .next()
            .map(|c| c.to_ascii_uppercase().to_string())
            .unwrap_or_default();

        let (read_bytes_sec, write_bytes_sec) = io_map
            .get(&drive_letter)
            .copied()
            .unwrap_or((0, 0));

        DiskMetrics {
            name: d.name().to_string_lossy().to_string(),
            mount: d.mount_point().to_string_lossy().to_string(),
            total_gb: total as f64 / 1_073_741_824.0,
            available_gb: avail as f64 / 1_073_741_824.0,
            read_bytes_sec,
            write_bytes_sec,
            percent_used: pct,
        }
    }).collect();

    let net_metrics: Vec<NetMetrics> = networks.list().iter()
        .filter(|(name, _)| !name.contains("Loopback") && !name.contains("lo"))
        .map(|(name, data)| NetMetrics {
            name: name.clone(),
            received_bytes_sec: data.received(),
            transmitted_bytes_sec: data.transmitted(),
        }).collect();

    // Top 60 processes by memory, sorted
    let mut procs: Vec<ProcessMetric> = sys.processes().iter().map(|(pid, p)| {
        let status = match p.status() {
            ProcessStatus::Run => "running",
            ProcessStatus::Sleep => "sleeping",
            ProcessStatus::Stop => "stopped",
            _ => "unknown",
        };
        ProcessMetric {
            pid: pid.as_u32(),
            parent_pid: p.parent().map(|p| p.as_u32()),
            name: p.name().to_string_lossy().to_string(),
            cpu_percent: p.cpu_usage(),
            memory_mb: p.memory() as f64 / 1_048_576.0,
            status: status.to_string(),
        }
    }).collect();
    procs.sort_by(|a, b| b.memory_mb.partial_cmp(&a.memory_mb).unwrap_or(std::cmp::Ordering::Equal));
    procs.truncate(60);

    SystemMetrics {
        timestamp: chrono::Utc::now().to_rfc3339(),
        cpu: CpuMetrics {
            percent: cpu_percent,
            core_count: cpu_count,
            frequency_mhz: cpu_freq,
        },
        memory: MemMetrics {
            used_mb: used_mem,
            total_mb: total_mem,
            available_mb: avail_mem,
            percent: mem_pct,
        },
        disks: disk_metrics,
        networks: net_metrics,
        processes: procs,
        uptime_sec: System::uptime(),
        worker_status: "native".to_string(),
    }
}
