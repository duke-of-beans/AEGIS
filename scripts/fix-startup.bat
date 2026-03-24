@echo off
REM fix-startup.bat
REM Removes legacy AEGIS tasks, adds Dashboard-7171 startup task
REM Run as Administrator

echo.
echo === Removing legacy AEGIS startup tasks ===

schtasks /delete /tn "AEGIS_Startup" /f >nul 2>&1
if %errorlevel%==0 (echo REMOVED: AEGIS_Startup) else (echo NOT FOUND: AEGIS_Startup)

schtasks /delete /tn "AEGIS Cognitive Resource Manager" /f >nul 2>&1
if %errorlevel%==0 (echo REMOVED: AEGIS Cognitive Resource Manager) else (echo NOT FOUND: AEGIS Cognitive Resource Manager)

echo.
echo === Adding Dashboard-7171 startup task ===

REM Remove existing dashboard task if present
schtasks /delete /tn "Dashboard-7171" /f >nul 2>&1

REM Create new task: run node D:\Meta\dashboard-server.js at logon, highest privileges
schtasks /create /tn "Dashboard-7171" /tr "node D:\Meta\dashboard-server.js" /sc onlogon /rl highest /f

if %errorlevel%==0 (
    echo SUCCESS: Dashboard-7171 task created
    echo node D:\Meta\dashboard-server.js will start at every login
) else (
    echo FAILED: Could not create Dashboard-7171 task
    echo Try running this batch file as Administrator
)

echo.
echo === Verifying scheduled tasks ===
schtasks /query /fo table /nh | findstr /i "aegis dashboard"

echo.
pause
