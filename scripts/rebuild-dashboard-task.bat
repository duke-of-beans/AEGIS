@echo off
REM rebuild-dashboard-task.bat
REM Deletes and rebuilds Dashboard-7171 using the silent VBS launcher
REM This fixes the "node not found at login" problem (PATH not loaded yet at logon)
REM Run as Administrator

echo.
echo === Rebuilding Dashboard-7171 startup task ===

REM Kill any existing server on 7171
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :7171 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
    echo Killed existing server on port 7171
)

REM Remove old task
schtasks /delete /tn "Dashboard-7171" /f >nul 2>&1
echo Removed old task.

REM Create task using wscript + VBS (VBS has full node path hardcoded, no PATH dependency)
schtasks /create ^
  /tn "Dashboard-7171" ^
  /tr "wscript.exe \"D:\Meta\dashboard-silent.vbs\"" ^
  /sc onlogon ^
  /rl highest ^
  /delay 0000:20 ^
  /f

if %errorlevel%==0 (
    echo SUCCESS: Dashboard-7171 task created
    echo Uses: wscript.exe + D:\Meta\dashboard-silent.vbs
    echo Node path: D:\Program Files\nodejs\node.exe ^(hardcoded in VBS^)
    echo Delay: 20 seconds after logon
) else (
    echo FAILED to create task. Are you running as Administrator?
)

echo.
echo === Starting server now to verify ===
wscript.exe "D:\Meta\dashboard-silent.vbs"
timeout /t 3 /nobreak >nul
netstat -aon | findstr :7171 | findstr LISTENING
if %errorlevel%==0 (
    echo SERVER IS UP on port 7171
) else (
    echo Server did not start - check D:\Meta\dashboard-server.js exists
)

echo.
echo === Current tasks ===
schtasks /query /fo table /nh | findstr /i dashboard

echo.
pause
