# fix-startup.ps1
# 1. Remove both legacy AEGIS scheduled tasks
# 2. Add dashboard-7171 startup task

$ErrorActionPreference = 'SilentlyContinue'

# --- Remove AEGIS tasks ---
$legacyTasks = @('AEGIS_Startup', 'AEGIS Cognitive Resource Manager')
foreach ($name in $legacyTasks) {
    $t = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if ($null -ne $t) {
        Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction Stop
        Write-Host "REMOVED: $name"
    } else {
        Write-Host "NOT FOUND (already gone): $name"
    }
}

# --- Add dashboard-server startup task ---
$dashTaskName = 'Dashboard-7171'
$nodeExe = 'node'
$serverScript = 'D:\Meta\dashboard-server.js'

# Remove if already exists
$existing = Get-ScheduledTask -TaskName $dashTaskName -ErrorAction SilentlyContinue
if ($null -ne $existing) {
    Unregister-ScheduledTask -TaskName $dashTaskName -Confirm:$false
    Write-Host "Replaced existing: $dashTaskName"
}

$action   = New-ScheduledTaskAction -Execute $nodeExe -Argument $serverScript -WorkingDirectory 'D:\Meta'
$trigger  = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0)

$task = Register-ScheduledTask `
    -TaskName $dashTaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description 'Starts Portfolio Dashboard server on port 7171 at login' `
    -Force

if ($null -ne $task) {
    Write-Host "ADDED: $dashTaskName — node D:\Meta\dashboard-server.js will start at login"
} else {
    Write-Host "FAILED to register $dashTaskName"
}
