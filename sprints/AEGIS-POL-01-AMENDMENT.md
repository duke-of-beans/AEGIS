## AMENDMENT — 2026-03-30 (add after reading this file)

This sprint was updated after a VRAM BSOD incident (VIDEO_MEMORY_MANAGEMENT_INTERNAL).
PolicyEngine must handle TWO policy types, not just registry:

TYPE: json_file — for app-level settings stored in JSON (e.g. Electron Local State files)

Add to DEFAULT_POLICY.yaml (task 1) alongside the registry policies:
```yaml
     - id: claude-gpu-acceleration-off
       description: "Claude Desktop GPU hardware acceleration disabled"
       type: json_file
       file_path: "%APPDATA%\\Claude\\Local State"
       json_key: hardware_acceleration_mode.enabled
       expected_value: false
       auto_enforce: true
       requires_elevation: false
```

PolicyEngine (task 2) must handle type: json_file:
- Read the JSON file at file_path (expand %APPDATA% etc)
- Navigate nested key using dot notation (hardware_acceleration_mode.enabled)
- Compare to expected_value
- If non-compliant and auto_enforce: read full file, set the key, write back
  using no-BOM UTF-8 (never JSON.stringify with BOM — brain.db write pattern)
- Preserve all other keys in the file

PolicyResult interface: add file_path?: string for json_file policies
checkAll() and enforceAll() must handle both 'registry' (default) and 'json_file' type

Cockpit Policy tab: json_file entries display file path (truncated) instead of registry path

ACCEPTANCE CRITERIA ADDITIONS:
  DEFAULT_POLICY.yaml includes claude-gpu-acceleration-off entry (type: json_file)
  PolicyEngine enforces json_file type policies alongside registry policies
  %APPDATA%\Claude\Local State hardware_acceleration_mode.enabled = false after AEGIS boot
  Policy tab shows Claude GPU policy with compliance status

---
