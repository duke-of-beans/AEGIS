#Requires -Version 5.0
# remove-task.ps1
# Removes the AEGIS startup task from Windows Task Scheduler

param(
    [string]$TaskName = "AEGIS_Startup"
)

$ErrorActionPreference = 'SilentlyContinue'

Write-Host "Removing AEGIS startup task: $TaskName"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($null -eq $task) {
    Write-Host "Task '$TaskName' not found. Nothing to remove."
    exit 0
}

try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
    Write-Host "SUCCESS: Task '$TaskName' removed."
} catch {
    Write-Warning "Could not remove task: $_"
    exit 1
}