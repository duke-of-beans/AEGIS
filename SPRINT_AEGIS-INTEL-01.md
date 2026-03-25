Execute Sprint AEGIS-INTEL-01 — Per-Drive Disk I/O via WMI for AEGIS.
Run in parallel with AEGIS-DEVOPS-01 and AEGIS-COCKPIT-02.

Read these files FIRST before doing anything:
  Filesystem:read_file D:\Projects\AEGIS\STATUS.md
  Filesystem:read_file D:\Projects\AEGIS\BACKLOG.md
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\src\metrics.rs
  Filesystem:read_file D:\Projects\AEGIS\src-tauri\Cargo.toml

Summary: After this sprint AEGIS shows real disk read/write MB/s per drive in the
cockpit. Currently read_bytes_sec and write_bytes_sec are hardcoded to 0 in Rust
because sysinfo does not expose per-disk IO on Windows without WMI. This sprint
adds WMI queries via the `wmi` crate to read DiskReadBytesPersec and
DiskWriteBytesPersec per logical disk, and wires them into the existing DiskMetrics
struct. Multiple drives are handled automatically.

Tasks:

1. Add wmi crate to Cargo.toml:
   In src-tauri/Cargo.toml, add to [dependencies]:
     wmi = "0.13"
     serde = { version = "1", features = ["derive"] }  (likely already present)
   Run: cd /d D:\Projects\AEGIS\src-tauri && cargo add wmi
   If cargo add is unavailable, edit Cargo.toml directly.
   Verify cargo check passes after adding the dependency.

2. Create src-tauri/src/disk_io.rs — WMI disk I/O reader:
   This module queries Win32_PerfFormattedData_PerfDisk_LogicalDisk via WMI.
   The struct to deserialize:
     #[derive(Deserialize)]
     struct DiskPerfData {
       Name: String,                  // e.g. "C:", "D:"
       DiskReadBytesPersec: u64,
       DiskWriteBytesPersec: u64,
     }
   Function signature:
     pub fn get_disk_io() -> HashMap<String, (u64, u64)>
     // Returns: drive letter (uppercase, no colon) -> (read_bytes_sec, write_bytes_sec)
     // Returns empty map on any WMI error — never panics
   Implementation:
   - Create a WMI connection: WMIConnection::new(COMLibrary::new()?)?
   - Query: wmi_con.query::<DiskPerfData>()
   - Filter out "_Total" and entries where Name contains "HarddiskVolume" (not drive letters)
   - Normalize Name to uppercase drive letter without colon (e.g. "C:" -> "C")
   - Return the HashMap
   - All WMI errors caught and logged via log::warn — function returns empty map on error
   - COMLibrary must be initialized per-call or stored. WMI on Windows requires COM
     to be initialized on the calling thread. Use COMLibrary::without_security()
     for non-admin access.
   Add the module to src-tauri/src/main.rs: mod disk_io;

3. Wire disk_io into metrics.rs — update collect_metrics():
   In the existing disk_metrics collection loop:
     - Call disk_io::get_disk_io() once before the loop, store result
     - For each disk, extract the drive letter from d.mount_point()
       (e.g. "C:\\" -> "C")
     - Look up (read_bytes_sec, write_bytes_sec) from the HashMap
     - If found: use those values. If not found: use 0 (graceful degradation)
   The DiskMetrics struct already has read_bytes_sec and write_bytes_sec fields.
   This replaces the hardcoded 0s with real values.

   Performance note: WMI queries take 5-50ms. The metrics polling loop runs
   every 2 seconds. get_disk_io() is called once per poll cycle — this is
   acceptable. If latency becomes a problem in a future sprint, move to a
   background thread with a shared cache. Not needed now.

<!-- phase:execute -->

4. Verify disk I/O is non-zero:
   Build the sidecar and run cargo check first:
     cd /d D:\Projects\AEGIS\src-tauri && cargo check
   If cargo check passes, run a test via Desktop Commander:
     Start a file copy operation (e.g. copy a large file in Windows Explorer)
     While copy is running, trigger a metrics read and check the output
   Alternatively: add a temporary test in main.rs or a separate test file
   that calls disk_io::get_disk_io() and prints results.
   Confirm that at least one drive returns non-zero read or write values
   during disk activity.

5. Quality gate:
   cd /d D:\Projects\AEGIS\src-tauri && cargo check — 0 errors, 0 warnings
   cd /d D:\Projects\AEGIS && npm run lint — 0 errors (TypeScript not changed but verify)
   cargo build --release only if explicitly requested — it takes 7+ minutes.
   For this sprint, cargo check is the gate. Full build happens via BUILD.bat later.

6. Portfolio compliance check — D:\Projects\AEGIS:
   - STATUS.md: update header, mark AEGIS-INTEL-01 in progress or closed
   - BACKLOG.md: mark AEGIS-INTEL-01 done with commit hash
   - CHANGELOG.md: add entry

7. Session close:
   FRICTION PASS: collect all friction. Triage FIX NOW / BACKLOG / LOG ONLY.
   Present to user before MORNING_BRIEFING.

   MORNING_BRIEFING.md — write to D:\Projects\AEGIS\ BEFORE git add.
   Sections: SHIPPED, QUALITY GATES, DECISIONS MADE BY AGENT,
   UNEXPECTED FINDINGS, FRICTION LOG, NEXT QUEUE.

   git add + commit + push (include src-tauri/src/disk_io.rs,
   src-tauri/src/metrics.rs, src-tauri/Cargo.toml, src-tauri/Cargo.lock,
   MORNING_BRIEFING.md, STATUS.md, BACKLOG.md, CHANGELOG.md).
   Commit via D:\Projects\AEGIS\commit-msg.txt.
   Use: "D:\Program Files\Git\cmd\git.exe" commit -F commit-msg.txt

CRITICAL CONSTRAINTS:
- Shell: cmd (not PowerShell). cd /d D:\Projects\AEGIS\src-tauri for cargo commands.
- Git: "D:\Program Files\Git\cmd\git.exe" full path.
- NEVER PANIC in get_disk_io(). All WMI errors must be caught and logged.
  The function must return an empty HashMap on any error — never propagate.
  AEGIS must continue working even if WMI is unavailable.
- COMLibrary requires initialization on the calling thread. Use
  COMLibrary::without_security() for normal user access.
- Do NOT attempt to query Win32_DiskDrive or Win32_PhysicalDisk — those require
  elevation. Win32_PerfFormattedData_PerfDisk_LogicalDisk works without elevation.
- cargo build --release is NOT required for this sprint. cargo check is the gate.
  Full build happens separately via BUILD.bat.
- MORNING_BRIEFING.md written to D:\Projects\AEGIS\ BEFORE git add.

Project: D:\Projects\AEGIS
Shell: cmd (not PowerShell).
Cargo: run from D:\Projects\AEGIS\src-tauri (cd /d D:\Projects\AEGIS\src-tauri)
Git: "D:\Program Files\Git\cmd\git.exe" — full path required.

ACCEPTANCE CRITERIA:
  src-tauri/src/disk_io.rs exists with get_disk_io() returning HashMap<String,(u64,u64)>
  disk_io module registered in main.rs
  metrics.rs collect_metrics() calls get_disk_io() and uses real values
  cargo check passes: 0 errors, 0 warnings
  At least one drive returns non-zero bytes during disk activity (verified manually)
  MORNING_BRIEFING.md written to D:\Projects\AEGIS\
  BACKLOG.md: AEGIS-INTEL-01 marked done
