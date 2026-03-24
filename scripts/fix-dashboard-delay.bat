@echo off
REM fix-dashboard-delay.bat
REM Rebuilds Dashboard-7171 with no network wait condition and shorter delay
REM Run as Administrator

echo.
echo === Rebuilding Dashboard-7171 (faster startup) ===

schtasks /delete /tn "Dashboard-7171" /f >nul 2>&1
echo Old task removed.

REM Create task: 8 second delay, no network condition, highest privilege
schtasks /create ^
  /tn "Dashboard-7171" ^
  /tr "wscript.exe \"D:\Meta\dashboard-silent.vbs\"" ^
  /sc onlogon ^
  /rl highest ^
  /delay 0000:08 ^
  /f

if %errorlevel%==0 (
    echo SUCCESS: Dashboard-7171 created with 8-second logon delay
) else (
    echo FAILED - run as Administrator
    pause
    exit /b 1
)

REM Remove network availability condition via XML export/import
schtasks /query /tn "Dashboard-7171" /xml > "%TEMP%\dash-task.xml" 2>nul

REM Use PowerShell to strip the RunOnlyIfNetworkAvailable condition
powershell.exe -NoProfile -Command ^
  "$xml = [xml](Get-Content '%TEMP%\dash-task.xml');" ^
  "$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable);" ^
  "$ns.AddNamespace('t', 'http://schemas.microsoft.com/windows/2004/02/mit/task');" ^
  "$node = $xml.SelectSingleNode('//t:RunOnlyIfNetworkAvailable', $ns);" ^
  "if ($node) { $node.InnerText = 'false'; $xml.Save('%TEMP%\dash-task-fixed.xml'); Write-Host 'Network condition removed' } else { Copy-Item '%TEMP%\dash-task.xml' '%TEMP%\dash-task-fixed.xml'; Write-Host 'No network condition found' }"

REM Re-register with fixed XML if it was created
if exist "%TEMP%\dash-task-fixed.xml" (
    schtasks /delete /tn "Dashboard-7171" /f >nul 2>&1
    schtasks /create /tn "Dashboard-7171" /xml "%TEMP%\dash-task-fixed.xml" /f >nul 2>&1
    if %errorlevel%==0 (echo Task re-registered without network condition.) else (echo Note: XML re-register failed, original task kept.)
)

echo.
echo === Current task ===
schtasks /query /fo table /nh | findstr /i dashboard
echo.
pause
