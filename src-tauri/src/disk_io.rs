// disk_io.rs — Per-drive disk I/O via WMI
// Uses Win32_PerfFormattedData_PerfDisk_PhysicalDisk (not LogicalDisk).
// LogicalDisk counters are disabled by default on many Windows machines and return zeros.
// PhysicalDisk counters are always active.
//
// PhysicalDisk Name format: "0 C:" or "0 C: D:" (multi-partition)
// We extract all drive letters from the name string.
//
// Runs on a dedicated std::thread — WMI/COM requires non-async thread apartment.

use std::collections::HashMap;
use std::sync::{OnceLock, Mutex};
use std::time::Duration;
use serde::Deserialize;

#[derive(Deserialize, Debug)]
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
/// Call once at startup from main.rs before the async runtime starts.
pub fn start_disk_io_thread() {
    std::thread::spawn(|| {
        loop {
            match query_wmi() {
                Ok(map) => {
                    if !map.is_empty() {
                        *cache().lock().unwrap() = map;
                    }
                }
                Err(e) => {
                    log::debug!("[disk_io] WMI PhysicalDisk query failed: {}", e);
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

    // PhysicalDisk — always active, unlike LogicalDisk which needs manual enabling
    let results: Vec<DiskPerfData> = wmi_con.raw_query(
        "SELECT Name, DiskReadBytesPersec, DiskWriteBytesPersec FROM Win32_PerfFormattedData_PerfDisk_PhysicalDisk"
    )?;

    let mut map = HashMap::new();

    for entry in results {
        let name = entry.Name.trim().to_string();
        if name == "_Total" || name.is_empty() {
            continue;
        }

        // Name format: "0 D:" or "0 C: D:" (multiple partitions on one physical disk)
        // Extract all drive letters and map each to the same I/O values.
        for part in name.split_whitespace() {
            let letter = part.trim_end_matches(':').to_uppercase();
            if letter.len() == 1
                && letter.chars().next().map(|c| c.is_ascii_alphabetic()).unwrap_or(false)
            {
                map.insert(
                    letter,
                    (entry.DiskReadBytesPersec, entry.DiskWriteBytesPersec),
                );
            }
        }
    }

    Ok(map)
}
