#Requires -Version 5.1
# AEGIS INSTALLER v3.0.0
# Cognitive Resource OS — Installation Protocol
# Run once as Administrator. Everything gets wired.

Set-StrictMode -Off
$ErrorActionPreference = 'SilentlyContinue'
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = "AEGIS INSTALLATION PROTOCOL v3.0.0"

# ─── COLOR HELPER ────────────────────────────────────────────────────────────
function C {
    param([string]$Text, [string]$Color = "White", [switch]$NoNewline)
    if ($NoNewline) { Write-Host $Text -ForegroundColor $Color -NoNewline }
    else            { Write-Host $Text -ForegroundColor $Color }
}

# ─── BANNER ──────────────────────────────────────────────────────────────────
function Show-Banner {
    Clear-Host
    C ""
    C "  ╔══════════════════════════════════════════════════════════════════════╗" "Cyan"
    C "  ║" "Cyan"
    C "  ║  " "Cyan" -NoNewline; C " █████╗ ███████╗ ██████╗ ██╗███████╗" "White"
    C "  ║  " "Cyan" -NoNewline; C "██╔══██╗██╔════╝██╔════╝ ██║██╔════╝" "White"
    C "  ║  " "Cyan" -NoNewline; C "███████║█████╗  ██║  ███╗██║███████╗" "White"
    C "  ║  " "Cyan" -NoNewline; C "██╔══██║██╔══╝  ██║   ██║██║╚════██║" "White"
    C "  ║  " "Cyan" -NoNewline; C "██║  ██║███████╗╚██████╔╝██║███████║" "White"
    C "  ║  " "Cyan" -NoNewline; C "╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝" "White"
    C "  ║" "Cyan"
    C "  ║       " "Cyan" -NoNewline; C "cognitive resource os  ·  v3.0.0  ·  windows" "DarkCyan"
    C "  ║" "Cyan"
    C "  ║   " "Cyan" -NoNewline; C "▓▒░  INSTALLATION PROTOCOL  ░▒▓" "Yellow"
    C "  ║" "Cyan"
    C "  ║   " "Cyan" -NoNewline; C "process catalog  ·  context engine  ·  sniper  ·  learning" "DarkCyan"
    C "  ║   " "Cyan" -NoNewline; C "cognitive load scoring  ·  mcp publisher  ·  cockpit ui" "DarkCyan"
    C "  ║" "Cyan"
    C "  ╚══════════════════════════════════════════════════════════════════════╝" "Cyan"
    C ""
}

# ─── STEP HELPER ─────────────────────────────────────────────────────────────
function Show-Step {
    param([int]$Step, [int]$Total, [string]$Label)
    C ""
    C "  ╔══ STEP $Step of $Total ══════════════════════════════════════════════╗" "DarkCyan"
    C "  ║  $Label" "DarkCyan"
    C "  ╚════════════════════════════════════════════════════════════════════╝" "DarkCyan"
    C ""
}

function OK   { param([string]$m); C "  ✓  $m" "Green" }
function INFO { param([string]$m); C "  ·  $m" "DarkCyan" }
function WARN { param([string]$m); C "  !  $m" "Yellow" }
function FAIL { param([string]$m); C "  ✗  $m" "Red" }

# ─── PREREQUISITE CHECK ───────────────────────────────────────────────────────
function Check-Prerequisites {
    C "  ╔══ PREREQUISITE CHECK ══════════════════════════════════════════════╗" "Yellow"
    C "  ║" "Yellow"

    $nodeOk = $false; $npmOk = $false; $gitOk = $false; $pm2Ok = $false

    # Node.js
    try {
        $nodeVer = (node --version 2>&1)
        if ($nodeVer -match '^v(\d+)') {
            $major = [int]$Matches[1]
            if ($major -ge 18) { C "  ║  " "Yellow" -NoNewline; OK "Node.js $nodeVer"; $nodeOk = $true }
            else { C "  ║  " "Yellow" -NoNewline; WARN "Node.js $nodeVer found — v18+ required" }
        }
    } catch { C "  ║  " "Yellow" -NoNewline; FAIL "Node.js not found — install from nodejs.org" }

    # npm
    try {
        $npmVer = (npm --version 2>&1)
        if ($npmVer -match '^\d') { C "  ║  " "Yellow" -NoNewline; OK "npm $npmVer"; $npmOk = $true }
    } catch { C "  ║  " "Yellow" -NoNewline; FAIL "npm not found" }

    # Git
    try {
        $gitVer = (git --version 2>&1)
        if ($gitVer -match 'git version') { C "  ║  " "Yellow" -NoNewline; OK "$gitVer"; $gitOk = $true }
    } catch { C "  ║  " "Yellow" -NoNewline; FAIL "Git not found — install from git-scm.com" }

    # pm2
    try {
        $pm2Ver = (pm2 --version 2>&1)
        if ($pm2Ver -match '^\d') { C "  ║  " "Yellow" -NoNewline; OK "pm2 $pm2Ver"; $pm2Ok = $true }
        else { C "  ║  " "Yellow" -NoNewline; INFO "pm2 not found — will install globally" }
    } catch { C "  ║  " "Yellow" -NoNewline; INFO "pm2 not found — will install globally" }

    C "  ║" "Yellow"
    C "  ╚════════════════════════════════════════════════════════════════════╝" "Yellow"
    C ""

    if (-not $nodeOk -or -not $npmOk -or -not $gitOk) {
        FAIL "Missing prerequisites. Install Node.js 18+ and Git, then re-run."
        C ""
        exit 1
    }

    return $pm2Ok
}

# ─── INSTALL PATH ─────────────────────────────────────────────────────────────
function Get-InstallPath {
    C "  ╔══ INSTALL LOCATION ════════════════════════════════════════════════╗" "Yellow"
    C "  ║" "Yellow"
    C "  ║  AEGIS is a background daemon. It needs a permanent home." "Yellow"
    C "  ║" "Yellow"
    C "  ║  Default:  C:\AEGIS" "Yellow"
    C "  ║  Custom:   Enter any absolute Windows path" "Yellow"
    C "  ║" "Yellow"
    C "  ║  Press ENTER to use the default." "Yellow"
    C "  ╚════════════════════════════════════════════════════════════════════╝" "Yellow"
    C ""
    C "  Install path: " "White" -NoNewline
    $raw = Read-Host
    if ([string]::IsNullOrWhiteSpace($raw)) { return "C:\AEGIS" }
    if ($raw -match '^[A-Za-z]:\\') { return $raw.TrimEnd('\') }
    WARN "Invalid path — falling back to C:\AEGIS"
    Start-Sleep -Milliseconds 800
    return "C:\AEGIS"
}

# ─── CONFIRMATION ─────────────────────────────────────────────────────────────
function Confirm-Install {
    param([string]$Path)
    C ""
    C "  ╔══ READY ═══════════════════════════════════════════════════════════╗" "Cyan"
    C "  ║" "Cyan"
    C "  ║  Installing AEGIS to: " "Cyan" -NoNewline; C $Path "White"
    C "  ║" "Cyan"
    C "  ║  What will happen:" "Cyan"
    C "  ║  · Source files copied to install directory" "Cyan"
    C "  ║  · npm install + npm run build" "Cyan"
    C "  ║  · pm2 start — AEGIS runs as a persistent background daemon" "Cyan"
    C "  ║  · Startup task — AEGIS survives reboots" "Cyan"
    C "  ║  · claude_desktop_config.json updated with MCP server entry" "Cyan"
    C "  ║" "Cyan"
    C "  ╚════════════════════════════════════════════════════════════════════╝" "Cyan"
    C ""
    C "  Proceed? [Y/N]: " "White" -NoNewline
    $ans = Read-Host
    return ($ans -match '^[Yy]')
}

# ─── MAIN ─────────────────────────────────────────────────────────────────────

Show-Banner
Start-Sleep -Milliseconds 600

$pm2Present = Check-Prerequisites
$InstallPath = Get-InstallPath

if (-not (Confirm-Install -Path $InstallPath)) {
    C ""; WARN "Installation cancelled."; C ""; exit 0
}

# ── Step 1: Copy source files ──────────────────────────────────────────────
Show-Step -Step 1 -Total 6 -Label "Copying source files"

$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent

try {
    if (-not (Test-Path $InstallPath)) {
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
        OK "Created $InstallPath"
    }

    # Copy all project files except installer output
    $exclude = @('.git','node_modules','dist','*.log')
    Get-ChildItem $SourceDir -Force | Where-Object {
        $name = $_.Name
        -not ($exclude | Where-Object { $name -like $_ })
    } | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $InstallPath -Recurse -Force
        OK "Copied: $($_.Name)"
    }
} catch {
    FAIL "File copy failed: $_"
    exit 1
}

# ── Step 2: npm install + build ────────────────────────────────────────────
Show-Step -Step 2 -Total 6 -Label "Installing dependencies and building"

Push-Location $InstallPath
try {
    C "  · Running npm install…" "DarkCyan"
    $npmOut = & npm install 2>&1
    if ($LASTEXITCODE -ne 0) { FAIL "npm install failed"; exit 1 }
    OK "Dependencies installed"

    C "  · Running npm run build…" "DarkCyan"
    $buildOut = & npm run build 2>&1
    if ($LASTEXITCODE -ne 0) { FAIL "Build failed:`n$buildOut"; exit 1 }
    OK "Build complete"
} finally {
    Pop-Location
}

# ── Step 3: pm2 ───────────────────────────────────────────────────────────
Show-Step -Step 3 -Total 6 -Label "Starting AEGIS as a persistent daemon"

if (-not $pm2Present) {
    C "  · Installing pm2 globally…" "DarkCyan"
    & npm install -g pm2 2>&1 | Out-Null
    $pm2Present = $true
    OK "pm2 installed"
}

$distEntry = Join-Path $InstallPath "dist\main.js"
if (-not (Test-Path $distEntry)) {
    WARN "dist\main.js not found — trying dist\index.js"
    $distEntry = Join-Path $InstallPath "dist\index.js"
}

try {
    # Stop existing instance if running
    & pm2 stop aegis 2>&1 | Out-Null
    & pm2 delete aegis 2>&1 | Out-Null

    # Start in tray mode (no MCP stdio)
    & pm2 start $distEntry --name aegis --interpreter node -- --tray 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        OK "AEGIS started via pm2"
        & pm2 save 2>&1 | Out-Null
        OK "pm2 config saved"
    } else {
        WARN "pm2 start had issues — check 'pm2 logs aegis' after install"
    }
} catch {
    WARN "pm2 start failed: $_ — start manually: pm2 start $distEntry --name aegis -- --tray"
}

# ── Step 4: Startup task ───────────────────────────────────────────────────
Show-Step -Step 4 -Total 6 -Label "Configuring startup (AEGIS survives reboots)"

try {
    $nodeExe = (Get-Command node -ErrorAction Stop).Source
    $pm2Script = Join-Path (Split-Path $nodeExe -Parent) "node_modules\pm2\bin\pm2"
    if (-not (Test-Path $pm2Script)) {
        # Try global npm prefix
        $npmPrefix = (npm config get prefix 2>&1).Trim()
        $pm2Script = Join-Path $npmPrefix "node_modules\pm2\bin\pm2"
    }

    $bounceScript = Join-Path $InstallPath "scripts\bounce.bat"
    if (Test-Path $bounceScript) {
        $action = New-ScheduledTaskAction -Execute $bounceScript
    } else {
        $action = New-ScheduledTaskAction -Execute $nodeExe -Argument "`"$pm2Script`" resurrect"
    }

    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

    Register-ScheduledTask -TaskName "AEGIS-Startup" `
        -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
        -Force | Out-Null

    OK "Startup task created — AEGIS will start on login"
} catch {
    WARN "Startup task failed (may need admin): $_"
    INFO "Run 'pm2 startup' manually to configure boot persistence"
}

# ── Step 5: Claude Desktop MCP config ─────────────────────────────────────
Show-Step -Step 5 -Total 6 -Label "Configuring Claude Desktop MCP server"

$claudeDir = "$env:APPDATA\Claude"
$claudeConfig = Join-Path $claudeDir "claude_desktop_config.json"

try {
    if (-not (Test-Path $claudeDir)) {
        New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
        INFO "Created Claude config directory"
    }

    $cfg = if (Test-Path $claudeConfig) {
        $raw = Get-Content $claudeConfig -Raw
        $raw | ConvertFrom-Json
    } else {
        [PSCustomObject]@{}
    }

    if (-not $cfg.PSObject.Properties['mcpServers']) {
        $cfg | Add-Member -NotePropertyName 'mcpServers' -NotePropertyValue ([PSCustomObject]@{})
    }

    $nodeExe = (Get-Command node -ErrorAction SilentlyContinue)?.Source
    if (-not $nodeExe) { $nodeExe = "node" }

    $mcpEntry = $distEntry -replace '\\', '\\'
    $cfg.mcpServers | Add-Member -Force -NotePropertyName 'aegis' -NotePropertyValue ([PSCustomObject]@{
        command = $nodeExe
        args    = @($distEntry, '--mcp')
    })

    $cfg | ConvertTo-Json -Depth 10 | Set-Content $claudeConfig -Encoding UTF8
    OK "claude_desktop_config.json updated"
    INFO "AEGIS MCP server will be available as 'aegis' in Claude Desktop"
    INFO "Restart Claude Desktop to load the new MCP configuration"
} catch {
    WARN "Could not auto-configure Claude Desktop: $_"
    INFO "Add manually to claude_desktop_config.json:"
    INFO "  `"aegis`": { `"command`": `"node`", `"args`": [`"$distEntry`", `"--mcp`"] }"
}

# ── Step 6: Open status window ─────────────────────────────────────────────
Show-Step -Step 6 -Total 6 -Label "Opening AEGIS status window"

$statusPort = 9001
try {
    $configFile = Join-Path $InstallPath "aegis-config.yaml"
    if (Test-Path $configFile) {
        $configContent = Get-Content $configFile -Raw
        if ($configContent -match 'port:\s*(\d+)') { $statusPort = [int]$Matches[1] }
    }
} catch {}

Start-Sleep -Seconds 2
try {
    Start-Process "http://localhost:$statusPort"
    OK "Opening http://localhost:$statusPort"
} catch {
    INFO "Navigate to http://localhost:$statusPort to open the cockpit"
}

# ─── COMPLETION ───────────────────────────────────────────────────────────────
C ""
C "  ╔══════════════════════════════════════════════════════════════════════╗" "Cyan"
C "  ║" "Cyan"
C "  ║   " "Cyan" -NoNewline; C "AEGIS is live." "White"
C "  ║" "Cyan"
C "  ║   " "Cyan" -NoNewline; C "Five intelligences, one daemon, one cockpit." "DarkCyan"
C "  ║" "Cyan"
C "  ╠══════════════════════════════════════════════════════════════════════╣" "Cyan"
C "  ║" "Cyan"
C "  ║   STATUS WINDOW  " "Cyan" -NoNewline; C "http://localhost:$statusPort" "White"
C "  ║   PM2 LOGS       " "Cyan" -NoNewline; C "pm2 logs aegis" "White"
C "  ║   PM2 STATUS     " "Cyan" -NoNewline; C "pm2 status" "White"
C "  ║   MCP CONNECT    " "Cyan" -NoNewline; C "restart Claude Desktop" "White"
C "  ║" "Cyan"
C "  ║   INSTALLED TO   " "Cyan" -NoNewline; C $InstallPath "White"
C "  ║" "Cyan"
C "  ╚══════════════════════════════════════════════════════════════════════╝" "Cyan"
C ""
