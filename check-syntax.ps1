$errors = $null
$tokens = $null
$null = [System.Management.Automation.Language.Parser]::ParseFile(
    'D:\Dev\aegis\scripts\aegis-worker.ps1',
    [ref]$tokens,
    [ref]$errors
)
if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Host "Line $($_.Extent.StartLineNumber): $($_.Message)" }
    exit 1
} else {
    Write-Host "Syntax OK"
    exit 0
}
