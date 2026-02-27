#Requires -Version 5.0
# install-task.ps1
# Creates a Windows Task Scheduler task to start AEGIS on user login
# Must be run as Administrator or with appropriate privileges

param(
    [string]$ExePath = "$env:PROGRAMFILES\AEGIS\AEGIS.exe",
    [string]$TaskName = "AEGIS_Startup",
    [string]$VbsPath = "$env:PROGRAMFILES\AEGIS\AEGIS-silent.vbs"
)

$ErrorActionPreference = 'Stop'

Write-Host "Installing AEGIS startup task: $TaskName"

# Remove existing task if present
try {
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($null -ne $existing) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed existing task."
    }
} catch {
    Write-Warning "Could not check existing task: $_"
}

# Create action: run VBScript silently (no console window)
if (Test-Path $VbsPath) {
    $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$VbsPath`""
} elseif (Test-Path $ExePath) {
    $action = New-ScheduledTaskAction -Execute $ExePath
} else {
    Write-Error "Neither AEGIS.exe nor AEGIS-silent.vbs found. Cannot create task."
    exit 1
}

# Trigger: on user logon
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Principal: current user, highest available privilege
$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

# Settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0)  # no time limit

# Register
$task = Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Starts AEGIS Cognitive Resource Manager at login" `
    -Force

if ($null -ne $task) {
    Write-Host "SUCCESS: Task '$TaskName' installed."
    Write-Host "AEGIS will start automatically on next login."
} else {
    Write-Error "Failed to register scheduled task."
    exit 1
}