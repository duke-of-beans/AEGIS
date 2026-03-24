#Requires -Version 7.0
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:VERSION = '2.0.0'
$script:STARTED_AT = [DateTime]::UtcNow.ToString('o')
$script:PID_SELF = $PID
$script:HEARTBEAT_INTERVAL = 30
$script:LAST_HEARTBEAT = [DateTime]::UtcNow

$script:ALLOWED_SERVICES = @('WSearch', 'SysMain', 'DiagTrack', 'BITS', 'wuauserv')

function Get-Param {
    param($Object, [string]$Name, $Default = $null)
    if ($null -eq $Object) { return $Default }
    if ($Object.PSObject.Properties.Match($Name).Count -gt 0) {
        $val = $Object.$Name
        if ($null -eq $val) { return $Default }
        return $val
    }
    return $Default
}

function Write-Response {
    param([string]$Id, $Result)
    $response = @{
        jsonrpc = '2.0'
        id = $Id
        result = $Result
    } | ConvertTo-Json -Compress -Depth 10
    Write-Output $response
    [Console]::Out.Flush()
}

function Write-ErrorResponse {
    param([string]$Id, [int]$Code, [string]$Message)
    $response = @{
        jsonrpc = '2.0'
        id = $Id
        error = @{ code = $Code; message = $Message }
    } | ConvertTo-Json -Compress
    Write-Output $response
    [Console]::Out.Flush()
}

function Write-Heartbeat {
    $hb = @{
        type = 'heartbeat'
        timestamp = [DateTime]::UtcNow.ToString('o')
        pid = $script:PID_SELF
    } | ConvertTo-Json -Compress
    Write-Output $hb
    [Console]::Out.Flush()
}

function Invoke-Ping {
    param($Id, $Params)
    Write-Response -Id $Id -Result @{
        pong = $true
        timestamp = [DateTime]::UtcNow.ToString('o')
        pid = $script:PID_SELF
        version = $script:VERSION
        ps_version = $PSVersionTable.PSVersion.ToString()
    }
}

function Invoke-GetVersion {
    param($Id, $Params)
    Write-Response -Id $Id -Result @{
        version = $script:VERSION
        ps_version = $PSVersionTable.PSVersion.ToString()
        started_at = $script:STARTED_AT
        pid = $script:PID_SELF
    }
}

function Invoke-SetCpuPriority {
    param($Id, $Params)
    $processName = Get-Param $Params 'processName' $null
    $priority = Get-Param $Params 'priority' 'normal'
    
    if ($null -eq $processName) {
        Write-ErrorResponse -Id $Id -Code -32602 -Message 'processName is required'
        return
    }
    
    $priorityMap = @{
        'high' = 'High'
        'above_normal' = 'AboveNormal'
        'normal' = 'Normal'
        'below_normal' = 'BelowNormal'
        'idle' = 'Idle'
    }
    $wsPriority = if ($priorityMap.ContainsKey($priority)) { $priorityMap[$priority] } else { 'Normal' }
    
    $errors = [System.Collections.Generic.List[string]]::new()
    $affected = 0
    
    try {
        $procs = Get-Process -Name ($processName -replace '\.exe$', '') -ErrorAction SilentlyContinue
        foreach ($proc in $procs) {
            try {
                $proc.PriorityClass = $wsPriority
                $affected++
            } catch {
                $errors.Add("PID $($proc.Id): $_")
            }
        }
    } catch {
        $errors.Add("$_")
    }
    
    Write-Response -Id $Id -Result @{
        success = ($errors.Count -eq 0)
        processesAffected = $affected
        errors = @($errors)
    }
}

function Invoke-SetIoPriority {
    param($Id, $Params)
    $processName = Get-Param $Params 'processName' $null
    $priority = Get-Param $Params 'priority' 'normal'
    
    if ($null -eq $processName) {
        Write-ErrorResponse -Id $Id -Code -32602 -Message 'processName is required'
        return
    }
    
    $ioMap = @{ 'background' = 0; 'low' = 1; 'normal' = 2; 'high' = 3 }
    $ioValue = if ($ioMap.ContainsKey($priority)) { $ioMap[$priority] } else { 2 }
    
    if (-not ('AEGIS.NtApi' -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace AEGIS {
    public class NtApi {
        [DllImport("ntdll.dll")] public static extern int NtSetInformationProcess(IntPtr processHandle, int processInformationClass, ref int processInformation, int processInformationLength);
    }
}
"@ -ErrorAction SilentlyContinue
    }
    
    $errors = [System.Collections.Generic.List[string]]::new()
    $affected = 0
    $procs = Get-Process -Name ($processName -replace '\.exe$', '') -ErrorAction SilentlyContinue
    foreach ($proc in $procs) {
        try {
            $val = $ioValue
            [AEGIS.NtApi]::NtSetInformationProcess($proc.Handle, 0x21, [ref]$val, 4) | Out-Null
            $affected++
        } catch {
            $errors.Add("PID $($proc.Id): $_")
        }
    }
    
    Write-Response -Id $Id -Result @{
        success = ($errors.Count -eq 0)
        processesAffected = $affected
        errors = @($errors)
    }
}

function Invoke-SetMemoryPriority {
    param($Id, $Params)
    $processName = Get-Param $Params 'processName' $null
    $priority = Get-Param $Params 'priority' 'normal'
    
    if ($null -eq $processName) {
        Write-ErrorResponse -Id $Id -Code -32602 -Message 'processName is required'
        return
    }
    
    $memMap = @{ 'idle' = 1; 'below_normal' = 3; 'normal' = 5; 'above_normal' = 6; 'high' = 6 }
    $memValue = if ($memMap.ContainsKey($priority)) { $memMap[$priority] } else { 5 }
    
    if (-not ('AEGIS.NtMemApi' -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace AEGIS {
    public class NtMemApi {
        [DllImport("ntdll.dll")] public static extern int NtSetInformationProcess(IntPtr processHandle, int processInformationClass, ref int processInformation, int processInformationLength);
    }
}
"@ -ErrorAction SilentlyContinue
    }
    
    $errors = [System.Collections.Generic.List[string]]::new()
    $affected = 0
    $procs = Get-Process -Name ($processName -replace '\.exe$', '') -ErrorAction SilentlyContinue
    foreach ($proc in $procs) {
        try {
            $val = $memValue
            [AEGIS.NtMemApi]::NtSetInformationProcess($proc.Handle, 0x27, [ref]$val, 4) | Out-Null
            $affected++
        } catch {
            $errors.Add("PID $($proc.Id): $_")
        }
    }
    
    Write-Response -Id $Id -Result @{
        success = ($errors.Count -eq 0)
        processesAffected = $affected
        errors = @($errors)
    }
}

function Invoke-SetAffinity {
    param($Id, $Params)
    $processName = Get-Param $Params 'processName' $null
    $affinity = Get-Param $Params 'affinity' $null
    
    if ($null -eq $processName) {
        Write-ErrorResponse -Id $Id -Code -32602 -Message 'processName is required'
        return
    }
    
    $mask = if ($null -eq $affinity) {
        [int][Math]::Pow(2, [System.Environment]::ProcessorCount) - 1
    } else {
        $cores = $affinity -split ',' | ForEach-Object { [int]$_.Trim() }
        $bitmask = 0
        foreach ($core in $cores) { $bitmask = $bitmask -bor (1 -shl $core) }
        $bitmask
    }
    
    $errors = [System.Collections.Generic.List[string]]::new()
    $affected = 0
    $procs = Get-Process -Name ($processName -replace '\.exe$', '') -ErrorAction SilentlyContinue
    foreach ($proc in $procs) {
        try {
            $proc.ProcessorAffinity = $mask
            $affected++
        } catch {
            $errors.Add("PID $($proc.Id): $_")
        }
    }
    
    Write-Response -Id $Id -Result @{
        success = ($errors.Count -eq 0)
        processesAffected = $affected
        affinityMask = "0x$([Convert]::ToString($mask, 16))"
        errors = @($errors)
    }
}

function Invoke-SetPowerThrottling {
    param($Id, $Params)
    $processName = Get-Param $Params 'processName' $null
    $disable = Get-Param $Params 'disable' $false
    
    if ($null -eq $processName) {
        Write-ErrorResponse -Id $Id -Code -32602 -Message 'processName is required'
        return
    }
    
    if (-not ('AEGIS.PowerThrottle' -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace AEGIS {
    public class PowerThrottle {
        [DllImport("kernel32.dll")] public static extern bool SetProcessInformation(IntPtr hProcess, int ProcessInformationClass, IntPtr ProcessInformation, int ProcessInformationSize);
    }
}
"@ -ErrorAction SilentlyContinue
    }
    
    $errors = [System.Collections.Generic.List[string]]::new()
    $affected = 0
    $procs = Get-Process -Name ($processName -replace '\.exe$', '') -ErrorAction SilentlyContinue
    foreach ($proc in $procs) {
        try {
            if ($disable) {
                [AEGIS.PowerThrottle]::SetProcessInformation($proc.Handle, 4, [IntPtr]::Zero, 0) | Out-Null
            }
            $affected++
        } catch {
            $errors.Add("PID $($proc.Id): $_")
        }
    }
    
    Write-Response -Id $Id -Result @{
        success = ($errors.Count -eq 0)
        processesAffected = $affected
        errors = @($errors)
    }
}

function Invoke-SetAllPriorities {
    param($Id, $Params)
    $processName = Get-Param $Params 'processName' $null
    
    if ($null -eq $processName) {
        Write-ErrorResponse -Id $Id -Code -32602 -Message 'processName is required'
        return
    }
    
    $results = @{}
    
    Invoke-SetCpuPriority -Id '' -Params @{ processName = $processName; priority = (Get-Param $Params 'cpuPriority' 'high') }
    Invoke-SetIoPriority -Id '' -Params @{ processName = $processName; priority = (Get-Param $Params 'ioPriority' 'high') }
    Invoke-SetMemoryPriority -Id '' -Params @{ processName = $processName; priority = (Get-Param $Params 'memoryPriority' 'high') }
    Invoke-SetAffinity -Id '' -Params @{ processName = $processName; affinity = (Get-Param $Params 'affinity' $null) }
    
    Write-Response -Id $Id -Result @{
        success = $true
        processName = $processName
        message = 'All priorities set'
    }
}

function Invoke-TrimWorkingSet {
    param($Id, $Params)
    $processName = Get-Param $Params 'processName' $null
    
    if ($null -eq $processName) {
        Write-ErrorResponse -Id $Id -Code -32602 -Message 'processName is required'
        return
    }
    
    if (-not ('AEGIS.PsApi' -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace AEGIS {
    public class PsApi {
        [DllImport("kernel32.dll")] public static extern bool SetProcessWorkingSetSize(IntPtr h, IntPtr min, IntPtr max);
    }
}
"@ -ErrorAction SilentlyContinue
    }
    
    $freed = 0L
    $affected = 0
    $errors = [System.Collections.Generic.List[string]]::new()
    
    $procs = Get-Process -Name ($processName -replace '\.exe$', '') -ErrorAction SilentlyContinue
    foreach ($proc in $procs) {
        try {
            $before = $proc.WorkingSet64
            [AEGIS.PsApi]::SetProcessWorkingSetSize($proc.Handle, [IntPtr](-1), [IntPtr](-1)) | Out-Null
            $proc.Refresh()
            $after = $proc.WorkingSet64
            $freed += [Math]::Max(0, $before - $after)
            $affected++
        } catch {
            $errors.Add("PID $($proc.Id): $_")
        }
    }
    
    Write-Response -Id $Id -Result @{
        success = ($errors.Count -eq 0)
        processesAffected = $affected
        memoryFreedBytes = $freed
        errors = @($errors)
    }
}

function Invoke-SetPowerPlan {
    param($Id, $Params)
    $plan = Get-Param $Params 'plan' 'balanced'
    
    $guidMap = @{
        'high_performance' = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
        'balanced'         = '381b4222-f694-41f0-9685-ff5bb260df2e'
        'power_saver'      = 'a1841308-3541-4fab-bc81-f71556f20b4a'
    }
    
    $guid = if ($guidMap.ContainsKey($plan)) { $guidMap[$plan] } else { $plan }
    
    try {
        powercfg /setactive $guid 2>&1 | Out-Null
        Write-Response -Id $Id -Result @{ success = $true; plan = $plan; guid = $guid }
    } catch {
        Write-ErrorResponse -Id $Id -Code -32000 -Message "Failed to set power plan: $_"
    }
}

function Invoke-GetActivePowerPlan {
    param($Id, $Params)
    try {
        $output = powercfg /getactivescheme
        if ($output -match 'GUID:\s+([0-9a-f-]{36})\s+\((.+)\)') {
            Write-Response -Id $Id -Result @{ guid = $matches[1]; name = $matches[2] }
        } else {
            Write-Response -Id $Id -Result @{ guid = ''; name = 'Unknown' }
        }
    } catch {
        Write-ErrorResponse -Id $Id -Code -32000 -Message "$_"
    }
}

function Invoke-SetQosPolicy {
    param($Id, $Params)
    $policyName = Get-Param $Params 'policyName' $null
    $app = Get-Param $Params 'app' $null
    $priority = Get-Param $Params 'priority' 'normal'
    $dscp = Get-Param $Params 'dscp' $null
    
    if ($null -eq $policyName) {
        Write-ErrorResponse -Id $Id -Code -32602 -Message 'policyName is required'
        return
    }
    
    $dscpValue = if ($null -ne $dscp) {
        [int]$dscp
    } else {
        switch ($priority) {
            'critical' { 46 }
            'high' { 34 }
            'background' { 8 }
            default { 0 }
        }
    }
    
    try {
        Remove-NetQosPolicy -Name $policyName -Confirm:$false -ErrorAction SilentlyContinue
        $params = @{ Name = $policyName; DSCPAction = $dscpValue; Confirm = $false }
        if ($null -ne $app) { $params['AppPathNameMatchCondition'] = $app }
        New-NetQosPolicy @params | Out-Null
        Write-Response -Id $Id -Result @{ success = $true; policyName = $policyName; dscp = $dscpValue }
    } catch {
        Write-ErrorResponse -Id $Id -Code -32000 -Message "$_"
    }
}

function Invoke-RemoveQosPolicies {
    param($Id, $Params)
    $prefix = Get-Param $Params 'prefix' 'AEGIS_'
    $errors = [System.Collections.Generic.List[string]]::new()
    $removed = 0
    
    try {
        $policies = Get-NetQosPolicy -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "$prefix*" }
        foreach ($pol in $policies) {
            try {
                Remove-NetQosPolicy -Name $pol.Name -Confirm:$false
                $removed++
            } catch {
                $errors.Add("$($pol.Name): $_")
            }
        }
    } catch {
        $errors.Add("$_")
    }
    
    Write-Response -Id $Id -Result @{
        success = ($errors.Count -eq 0)
        policiesRemoved = $removed
        errors = @($errors)
    }
}

function Invoke-ListQosPolicies {
    param($Id, $Params)
    $prefix = Get-Param $Params 'prefix' 'AEGIS_'
    
    try {
        $policies = Get-NetQosPolicy -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "$prefix*" }
        $result = @($policies | ForEach-Object {
            @{
                name = $_.Name
                app = $_.AppPathNameMatchCondition
                dscp = $_.DSCPAction
            }
        })
        Write-Response -Id $Id -Result @{ policies = $result }
    } catch {
        Write-Response -Id $Id -Result @{ policies = @() }
    }
}

function Invoke-GetSystemStats {
    param($Id, $Params)
    try {
        $cpu = (Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Measure-Object -Property LoadPercentage -Average).Average
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
        
        if ($null -eq $cpu) { $cpu = 0 }
        $totalMB = if ($null -ne $os) { [Math]::Round($os.TotalVisibleMemorySize / 1024) } else { 0 }
        $freeMB = if ($null -ne $os) { [Math]::Round($os.FreePhysicalMemory / 1024) } else { 0 }
        $usedMB = $totalMB - $freeMB
        $usedPct = if ($totalMB -gt 0) { [Math]::Round(($usedMB / $totalMB) * 100, 1) } else { 0 }
        
        $powerOutput = powercfg /getactivescheme 2>$null
        $powerName = if ($powerOutput -match '\((.+)\)') { $matches[1] } else { 'Unknown' }
        
        Write-Response -Id $Id -Result @{
            cpu = @{ loadPercent = [float]$cpu }
            memory = @{
                totalMB = $totalMB
                usedMB = $usedMB
                freeMB = $freeMB
                usedPercent = $usedPct
            }
            activePowerPlan = $powerName
            timestamp = [DateTime]::UtcNow.ToString('o')
        }
    } catch {
        Write-ErrorResponse -Id $Id -Code -32000 -Message "$_"
    }
}

function Invoke-GetProcessList {
    param($Id, $Params)
    $processNames = @(Get-Param $Params 'processNames' @())
    
    $result = @($processNames | ForEach-Object {
        $name = $_
        $baseName = $name -replace '\.exe$', ''
        $procs = Get-Process -Name $baseName -ErrorAction SilentlyContinue
        $running = ($null -ne $procs -and $procs.Count -gt 0)
        $first = if ($running) { $procs[0] } else { $null }
        
        @{
            name = $name
            pid = if ($null -ne $first) { $first.Id } else { 0 }
            running = $running
            cpuPriority = if ($null -ne $first) { $first.PriorityClass.ToString() } else { '' }
            workingSetMB = if ($null -ne $first) { [Math]::Round($first.WorkingSet64 / 1MB, 1) } else { 0 }
            executablePath = if ($null -ne $first) {
                try { $first.MainModule.FileName } catch { '' }
            } else {
                ''
            }
        }
    })
    
    Write-Response -Id $Id -Result @{
        processes = $result
        timestamp = [DateTime]::UtcNow.ToString('o')
    }
}

function Invoke-StartProcess {
    param($Id, $Params)
    $execPath = Get-Param $Params 'executablePath' $null
    $workDir = Get-Param $Params 'workingDirectory' $null
    $args = @(Get-Param $Params 'arguments' @())
    
    if ($null -eq $execPath) {
        Write-ErrorResponse -Id $Id -Code -32602 -Message 'executablePath is required'
        return
    }
    
    try {
        $startInfo = @{ FilePath = $execPath; WindowStyle = 'Normal' }
        if ($null -ne $workDir) { $startInfo['WorkingDirectory'] = $workDir }
        if ($args.Count -gt 0) { $startInfo['ArgumentList'] = $args }
        $proc = Start-Process @startInfo -PassThru
        Write-Response -Id $Id -Result @{ success = $true; pid = $proc.Id }
    } catch {
        Write-Response -Id $Id -Result @{ success = $false; error = "$_" }
    }
}

function Invoke-RunScript {
    param($Id, $Params)
    $scriptPath = Get-Param $Params 'scriptPath' $null
    $scriptArgs = @(Get-Param $Params 'arguments' @())
    
    if ($null -eq $scriptPath) {
        Write-ErrorResponse -Id $Id -Code -32602 -Message 'scriptPath is required'
        return
    }
    
    try {
        $result = & pwsh.exe -NonInteractive -ExecutionPolicy Bypass -File $scriptPath @scriptArgs 2>&1
        Write-Response -Id $Id -Result @{
            success = $true
            exitCode = $LASTEXITCODE
            output = ($result -join "`n")
            error = ''
        }
    } catch {
        Write-Response -Id $Id -Result @{
            success = $false
            exitCode = -1
            output = ''
            error = "$_"
        }
    }
}

function Invoke-PurgeStandbyMemory {
    param($Id, $Params)
    try {
        if (-not ('AEGIS.MemApi' -as [type])) {
            Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace AEGIS {
    public class MemApi {
        [DllImport("ntdll.dll")] public static extern uint NtSetSystemInformation(int SystemInformationClass, IntPtr SystemInformation, int SystemInformationLength);
    }
}
"@ -ErrorAction SilentlyContinue
        }
        
        $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal(4)
        [System.Runtime.InteropServices.Marshal]::WriteInt32($ptr, 4)
        $status = [AEGIS.MemApi]::NtSetSystemInformation(80, $ptr, 4)
        [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
        
        Write-Response -Id $Id -Result @{ success = ($status -eq 0); ntstatus = $status }
    } catch {
        Write-Response -Id $Id -Result @{ success = $false; ntstatus = -1 }
    }
}

function Invoke-ManageService {
    param($Id, $Params)
    $serviceName = Get-Param $Params 'serviceName' $null
    $action = Get-Param $Params 'action' $null
    
    if ($null -eq $serviceName) {
        Write-ErrorResponse -Id $Id -Code -32602 -Message 'serviceName is required'
        return
    }
    if ($null -eq $action) {
        Write-ErrorResponse -Id $Id -Code -32602 -Message 'action is required'
        return
    }
    
    if ($script:ALLOWED_SERVICES -notcontains $serviceName) {
        Write-ErrorResponse -Id $Id -Code -32603 -Message "Service '$serviceName' not in allowlist"
        return
    }
    
    try {
        $svc = Get-Service -Name $serviceName -ErrorAction Stop
        $prevStatus = $svc.Status.ToString()
        
        if ($action -eq 'stop') {
            Stop-Service -Name $serviceName -Force -ErrorAction Stop
        } elseif ($action -eq 'start') {
            Start-Service -Name $serviceName -ErrorAction Stop
        } else {
            Write-ErrorResponse -Id $Id -Code -32602 -Message "Unknown action: $action"
            return
        }
        
        $svc.Refresh()
        Write-Response -Id $Id -Result @{
            success = $true
            status = $svc.Status.ToString()
            previousStatus = $prevStatus
        }
    } catch {
        Write-ErrorResponse -Id $Id -Code -32000 -Message "$_"
    }
}

function Invoke-FlushTempFiles {
    param($Id, $Params)
    $removed = 0
    $freedBytes = 0L
    $errors = [System.Collections.Generic.List[string]]::new()
    $tempPaths = @($env:TEMP, $env:TMP, 'C:\Windows\Temp') | Select-Object -Unique | Where-Object { $null -ne $_ }
    
    foreach ($tempPath in $tempPaths) {
        try {
            $files = Get-ChildItem -Path $tempPath -Recurse -Force -ErrorAction SilentlyContinue |
                     Where-Object { -not $_.PSIsContainer }
            
            foreach ($file in $files) {
                try {
                    $size = $file.Length
                    Remove-Item -Path $file.FullName -Force -ErrorAction Stop
                    $freedBytes += $size
                    $removed++
                } catch {
                    # Skip locked files silently
                }
            }
        } catch {
            $errors.Add("$tempPath`: $_")
        }
    }
    
    Write-Response -Id $Id -Result @{
        success = $true
        filesRemoved = $removed
        freedMB = [Math]::Round($freedBytes / 1MB, 2)
        errors = @($errors)
    }
}

function Invoke-GetDiskStats {
    param($Id, $Params)
    try {
        $drives = @()
        $logicalDisks = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfDisk_LogicalDisk -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -ne '_Total' }
        foreach ($d in $logicalDisks) {
            $vol = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='$($d.Name)'" -ErrorAction SilentlyContinue
            $drives += @{
                letter          = $d.Name
                label           = if ($null -ne $vol -and $vol.VolumeName) { $vol.VolumeName } else { '' }
                size_gb         = if ($null -ne $vol -and $vol.Size) { [Math]::Round($vol.Size / 1GB, 1) } else { 0 }
                free_gb         = if ($null -ne $vol -and $vol.FreeSpace) { [Math]::Round($vol.FreeSpace / 1GB, 1) } else { 0 }
                read_bytes_sec  = [long]($d.DiskReadBytesPersec)
                write_bytes_sec = [long]($d.DiskWriteBytesPersec)
                queue_depth     = [float]($d.CurrentDiskQueueLength)
            }
        }
        $physicalDisks = @()
        $pdisks = Get-PhysicalDisk -ErrorAction SilentlyContinue
        foreach ($pd in $pdisks) {
            $physicalDisks += @{
                device_id          = $pd.DeviceId
                friendly_name      = $pd.FriendlyName
                media_type         = if ($pd.MediaType -eq 'SSD') { 'SSD' } elseif ($pd.MediaType -eq 'HDD') { 'HDD' } else { 'Unspecified' }
                operational_status = $pd.OperationalStatus
                health_status      = if ($pd.HealthStatus -eq 'Healthy') { 'Healthy' } elseif ($pd.HealthStatus -eq 'Warning') { 'Warning' } elseif ($pd.HealthStatus -eq 'Unhealthy') { 'Unhealthy' } else { 'Unknown' }
                size_gb            = [Math]::Round($pd.Size / 1GB, 1)
            }
        }
        Write-Response -Id $Id -Result @{
            drives        = $drives
            physical_disks = $physicalDisks
            timestamp     = [DateTime]::UtcNow.ToString('o')
        }
    } catch {
        Write-ErrorResponse -Id $Id -Code -32000 -Message "$_"
    }
}

function Invoke-GetNetworkStats {
    param($Id, $Params)
    try {
        $adapters = @()
        $perfAdapters = Get-CimInstance -ClassName Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notmatch 'Loopback' }
        foreach ($pa in $perfAdapters) {
            # Skip adapters that are completely silent
            if ($pa.BytesTotalPersec -eq 0 -and $pa.PacketsSentPersec -eq 0 -and $pa.PacketsReceivedPersec -eq 0) { continue }
            # Match to Get-NetAdapter by sanitising the name (WMI replaces special chars with _)
            $netAdapter = $null
            try {
                $netAdapter = Get-NetAdapter -ErrorAction SilentlyContinue |
                    Where-Object { ($_.InterfaceDescription -replace '[^A-Za-z0-9]', '_') -eq ($pa.Name -replace '[^A-Za-z0-9]', '_') } |
                    Select-Object -First 1
            } catch {}
            $adapters += @{
                name                 = $pa.Name
                bytes_sent_sec       = [long]($pa.BytesSentPersec)
                bytes_recv_sec       = [long]($pa.BytesReceivedPersec)
                packets_sent_sec     = [long]($pa.PacketsSentPersec)
                packets_recv_sec     = [long]($pa.PacketsReceivedPersec)
                status               = if ($null -ne $netAdapter) { $netAdapter.Status } else { 'Unknown' }
                link_speed_mbps      = if ($null -ne $netAdapter -and $netAdapter.LinkSpeed -gt 0) { [Math]::Round($netAdapter.LinkSpeed / 1MB) } else { 0 }
            }
        }
        Write-Response -Id $Id -Result @{
            adapters  = $adapters
            timestamp = [DateTime]::UtcNow.ToString('o')
        }
    } catch {
        Write-ErrorResponse -Id $Id -Code -32000 -Message "$_"
    }
}

function Invoke-GetGpuStats {
    param($Id, $Params)
    # Try nvidia-smi first
    $nvidiaSmi = $null
    try {
        $nvidiaSmi = Get-Command 'nvidia-smi.exe' -ErrorAction SilentlyContinue
        if ($null -eq $nvidiaSmi) {
            $candidates = @(
                'C:\Windows\System32\nvidia-smi.exe',
                'C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe'
            )
            foreach ($c in $candidates) {
                if (Test-Path $c) { $nvidiaSmi = $c; break }
            }
        } else {
            $nvidiaSmi = $nvidiaSmi.Source
        }
    } catch {}

    if ($null -ne $nvidiaSmi) {
        try {
            $raw = & $nvidiaSmi --query-gpu=utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits 2>$null
            if ($LASTEXITCODE -eq 0 -and $null -ne $raw) {
                $gpus = @()
                foreach ($line in @($raw)) {
                    $parts = $line -split ','
                    if ($parts.Count -ge 6) {
                        $gpus += @{
                            gpu_util_percent  = [float]($parts[0].Trim())
                            mem_util_percent  = [float]($parts[1].Trim())
                            vram_used_mb      = [float]($parts[2].Trim())
                            vram_total_mb     = [float]($parts[3].Trim())
                            temp_celsius      = [float]($parts[4].Trim())
                            power_watts       = [float]($parts[5].Trim())
                        }
                    }
                }
                Write-Response -Id $Id -Result @{
                    available = $true
                    source    = 'nvidia-smi'
                    gpus      = $gpus
                    timestamp = [DateTime]::UtcNow.ToString('o')
                }
                return
            }
        } catch {}
    }

    # WMI fallback
    try {
        $wmiGpus = Get-CimInstance -ClassName Win32_VideoController -ErrorAction SilentlyContinue
        if ($null -ne $wmiGpus -and @($wmiGpus).Count -gt 0) {
            $gpus = @()
            foreach ($g in @($wmiGpus)) {
                $gpus += @{
                    gpu_util_percent = 0
                    mem_util_percent = 0
                    vram_used_mb     = 0
                    vram_total_mb    = if ($g.AdapterRAM -gt 0) { [Math]::Round($g.AdapterRAM / 1MB) } else { 0 }
                    temp_celsius     = 0
                    power_watts      = 0
                    name             = $g.VideoProcessor
                }
            }
            Write-Response -Id $Id -Result @{
                available = $true
                source    = 'wmi'
                gpus      = $gpus
                timestamp = [DateTime]::UtcNow.ToString('o')
            }
            return
        }
    } catch {}

    Write-Response -Id $Id -Result @{
        available = $false
        source    = 'none'
        gpus      = @()
        timestamp = [DateTime]::UtcNow.ToString('o')
    }
}

function Invoke-GetSystemExtended {
    param($Id, $Params)
    try {
        $cpuPerf = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'" -ErrorAction SilentlyContinue
        $memPerf = Get-CimInstance -ClassName Win32_PerfFormattedData_PerfOS_Memory -ErrorAction SilentlyContinue
        $os      = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue

        $dpcRate    = if ($null -ne $cpuPerf) { [long]($cpuPerf.DPCsQueuedPersec) } else { 0 }
        $intrRate   = if ($null -ne $cpuPerf) { [long]($cpuPerf.InterruptsPersec) } else { 0 }
        $pageFaults = if ($null -ne $memPerf) { [long]($memPerf.PageFaultsPersec) } else { 0 }
        $pageReads  = if ($null -ne $memPerf) { [long]($memPerf.PageReadsPersec) } else { 0 }
        $uptimeSec  = if ($null -ne $os) { [long](([DateTime]::UtcNow - $os.LastBootUpTime.ToUniversalTime()).TotalSeconds) } else { 0 }

        Write-Response -Id $Id -Result @{
            dpc_rate       = $dpcRate
            interrupt_rate = $intrRate
            page_faults_sec = $pageFaults
            page_reads_sec = $pageReads
            uptime_sec     = $uptimeSec
            timestamp      = [DateTime]::UtcNow.ToString('o')
        }
    } catch {
        Write-ErrorResponse -Id $Id -Code -32000 -Message "$_"
    }
}

function Invoke-GetProcessTree {
    param($Id, $Params)
    try {
        $wmiProcs = Get-CimInstance -ClassName Win32_Process -ErrorAction SilentlyContinue |
            Where-Object { $_.WorkingSetSize -gt 0 } |
            Sort-Object WorkingSetSize -Descending |
            Select-Object -First 300

        $entries = @()
        foreach ($p in $wmiProcs) {
            $entries += @{
                pid           = [int]($p.ProcessId)
                parent_pid    = [int]($p.ParentProcessId)
                name          = $p.Name
                memory_mb     = [Math]::Round($p.WorkingSetSize / 1MB, 2)
                cpu_user_ms   = [long]($p.UserModeTime / 10000)
                cpu_kernel_ms = [long]($p.KernelModeTime / 10000)
                handle_count  = [int]($p.HandleCount)
                thread_count  = [int]($p.ThreadCount)
                path          = if ($p.ExecutablePath) { $p.ExecutablePath } else { $null }
            }
        }

        Write-Response -Id $Id -Result @{
            processes = $entries
            timestamp = [DateTime]::UtcNow.ToString('o')
        }
    } catch {
        Write-ErrorResponse -Id $Id -Code -32000 -Message "$_"
    }
}

function Invoke-Shutdown {
    param($Id, $Params)
    Write-Response -Id $Id -Result @{ success = $true }
    $script:RUNNING = $false
}

$handshake = @{
    type = 'version'
    version = $script:VERSION
    ps_version = $PSVersionTable.PSVersion.ToString()
    started_at = $script:STARTED_AT
    pid = $script:PID_SELF
} | ConvertTo-Json -Compress
Write-Output $handshake
[Console]::Out.Flush()

$script:RUNNING = $true
while ($script:RUNNING) {
    $now = [DateTime]::UtcNow
    $elapsed = ($now - $script:LAST_HEARTBEAT).TotalSeconds
    
    if ($elapsed -ge $script:HEARTBEAT_INTERVAL) {
        Write-Heartbeat
        $script:LAST_HEARTBEAT = $now
    }
    
    if ([Console]::In.Peek() -ge 0) {
        $line = [Console]::In.ReadLine()
        if ($null -ne $line -and $line.Trim().Length -gt 0) {
            try {
                $request = $line | ConvertFrom-Json
                $id = Get-Param $request 'id' ''
                $method = Get-Param $request 'method' ''
                $params = if ($request.PSObject.Properties.Match('params').Count -gt 0) {
                    $request.params
                } else {
                    $null
                }
                
                switch ($method) {
                    'ping' { Invoke-Ping -Id $id -Params $params }
                    'get_version' { Invoke-GetVersion -Id $id -Params $params }
                    'set_cpu_priority' { Invoke-SetCpuPriority -Id $id -Params $params }
                    'set_io_priority' { Invoke-SetIoPriority -Id $id -Params $params }
                    'set_memory_priority' { Invoke-SetMemoryPriority -Id $id -Params $params }
                    'set_affinity' { Invoke-SetAffinity -Id $id -Params $params }
                    'set_power_throttling' { Invoke-SetPowerThrottling -Id $id -Params $params }
                    'set_all_priorities' { Invoke-SetAllPriorities -Id $id -Params $params }
                    'trim_working_set' { Invoke-TrimWorkingSet -Id $id -Params $params }
                    'set_power_plan' { Invoke-SetPowerPlan -Id $id -Params $params }
                    'get_active_power_plan' { Invoke-GetActivePowerPlan -Id $id -Params $params }
                    'set_qos_policy' { Invoke-SetQosPolicy -Id $id -Params $params }
                    'remove_qos_policies' { Invoke-RemoveQosPolicies -Id $id -Params $params }
                    'list_qos_policies' { Invoke-ListQosPolicies -Id $id -Params $params }
                    'get_system_stats' { Invoke-GetSystemStats -Id $id -Params $params }
                    'get_process_list' { Invoke-GetProcessList -Id $id -Params $params }
                    'start_process' { Invoke-StartProcess -Id $id -Params $params }
                    'run_script' { Invoke-RunScript -Id $id -Params $params }
                    'purge_standby_memory' { Invoke-PurgeStandbyMemory -Id $id -Params $params }
                    'manage_service' { Invoke-ManageService -Id $id -Params $params }
                    'flush_temp_files' { Invoke-FlushTempFiles -Id $id -Params $params }
                    'get_disk_stats' { Invoke-GetDiskStats -Id $id -Params $params }
                    'get_network_stats' { Invoke-GetNetworkStats -Id $id -Params $params }
                    'get_gpu_stats' { Invoke-GetGpuStats -Id $id -Params $params }
                    'get_system_extended' { Invoke-GetSystemExtended -Id $id -Params $params }
                    'get_process_tree' { Invoke-GetProcessTree -Id $id -Params $params }
                    'shutdown' { Invoke-Shutdown -Id $id -Params $params }
                    default {
                        Write-ErrorResponse -Id $id -Code -32601 -Message "Method not found: $method"
                    }
                }
            } catch {
                Write-ErrorResponse -Id '' -Code -32700 -Message "Parse error: $_"
            }
        }
    } else {
        Start-Sleep -Milliseconds 100
    }
}
