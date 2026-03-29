// disk_io.rs — Per-drive disk I/O via WMI
// Queries Win32_PerfFormattedData_PerfDisk_LogicalDisk for read/write bytes per second.
// Works without elevation.
//
// KEY FIX: WMI/COM requires a dedicated thread with proper apartment state.
// Calling from async tokio tasks causes COM init failures.
// We run the query in a std::thread and cache the result behind a Mutex.
// The metrics poller calls get_disk_io() which returns the cached value instantly.
// A background thread refreshes the cache every 2 seconds.
// On failure we keep the last good value — no permanent disable.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use serde::Deserialize;

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct DiskPerfData {
    Name: String,
    DiskReadBytesPersec: u64,
    DiskWriteBytesPersec: u64,
}

static IO_CACHE: OnceLock<Mutex<HashMap<String, (u64, u64)>>> = OnceLock::new();

fn cache() -> &'static Mutex<HashMap<String, (u64, u64)>> {
    IO_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Start a background thread that refreshes disk I/O every 2 seconds.
/// Call once at startup from main.rs.
pub fn start_disk_io_thread() {
    std::thread::spawn(|| {
        loop {
            match query_wmi() {
                Ok(map) => {
                    *cache().lock().unwrap() = map;
                }
                Err(e) => {
                    log::debug!("[disk_io] WMI query failed: {}", e);
                    // Keep last good value — don't wipe the cache on failure
                }
            }
            std::thread::sleep(Duration::from_secs(2));
        }
    });
}

/// Return the latest cached I/O map. Always instant — never blocks on WMI.
pub fn get_disk_io() -> HashMap<String, (u64, u64)> {
    cache().lock().unwrap().clone()
}

fn query_wmi() -> Result<HashMap<String, (u64, u64)>, Box<dyn std::error::Error>> {
    use wmi::{COMLibrary, WMIConnection};

    let com_lib = COMLibrary::without_security()?;
    let wmi_con = WMIConnection::new(com_lib)?;

    let results: Vec<DiskPerfData> = wmi_con.query()?;

    let mut map = HashMap::new();
    for entry in results {
        let name = entry.Name.trim().to_string();

        // Skip aggregate "_Total" and non-drive-letter entries
        if name == "_Total" || name.contains("HarddiskVolume") || name.is_empty() {
            continue;
        }

        // Normalise: "C:" -> "C", "c:" -> "C", bare "C" -> "C"
        let drive_letter = name.trim_end_matches(':').to_uppercase();

        if drive_letter.len() == 1
            && drive_letter
                .chars()
                .next()
                .map(|c| c.is_ascii_alphabetic())
                .unwrap_or(false)
        {
            map.insert(
                drive_letter,
                (entry.DiskReadBytesPersec, entry.DiskWriteBytesPersec),
            );
        }
    }

    Ok(map)
}
