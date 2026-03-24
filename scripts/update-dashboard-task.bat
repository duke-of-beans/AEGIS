@echo off
REM update-dashboard-task.bat
REM Updates Dashboard-7171 task to use silent VBS launcher (no console window)
REM Run as Administrator

echo.
echo === Updating Dashboard-7171 to use silent launcher ===

REM Remove existing task
schtasks /delete /tn "Dashboard-7171" /f >nul 2>&1

REM Re-create using wscript.exe + VBS = no visible window
schtasks /create /tn "Dashboard-7171" /tr "wscript.exe \"D:\Meta\dashboard-silent.vbs\"" /sc onlogon /rl highest /delay 0000:15 /f

if %errorlevel%==0 (
    echo SUCCESS: Dashboard-7171 updated
    echo dashboard-server.js will start silently at login with a 15-second delay
) else (
    echo FAILED: Could not update task
    echo Try running as Administrator
)

echo.
echo === Current task list ===
schtasks /query /fo table /nh | findstr /i dashboard

echo.
pause
