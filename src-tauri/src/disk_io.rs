// disk_io.rs — Per-drive disk I/O via WMI
// Queries Win32_PerfFormattedData_PerfDisk_LogicalDisk for read/write bytes per second.
// Works without elevation. Returns empty map on any WMI error — never panics.
//
// Returned HashMap key: uppercase drive letter without colon (e.g. "C", "D")
// Returned HashMap value: (read_bytes_sec, write_bytes_sec)

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use serde::Deserialize;

/// Once WMI fails, stop retrying to avoid log spam (30x/min).
static WMI_DISABLED: AtomicBool = AtomicBool::new(false);

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct DiskPerfData {
    Name: String,
    DiskReadBytesPersec: u64,
    DiskWriteBytesPersec: u64,
}

/// Query WMI for per-drive I/O rates.
/// Returns an empty map on any error — caller treats missing entries as 0.
pub fn get_disk_io() -> HashMap<String, (u64, u64)> {
    // If WMI previously failed, return empty immediately — no log spam
    if WMI_DISABLED.load(Ordering::Relaxed) {
        return HashMap::new();
    }
    match query_wmi() {
        Ok(map) => map,
        Err(e) => {
            log::warn!("[disk_io] WMI query failed: {} — disabling disk I/O polling", e);
            WMI_DISABLED.store(true, Ordering::Relaxed);
            HashMap::new()
        }
    }
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
        let drive_letter = name
            .trim_end_matches(':')
            .to_uppercase();

        if drive_letter.len() == 1 && drive_letter.chars().next().map(|c| c.is_ascii_alphabetic()).unwrap_or(false) {
            map.insert(drive_letter, (entry.DiskReadBytesPersec, entry.DiskWriteBytesPersec));
        }
    }

    Ok(map)
}
