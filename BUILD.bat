@echo off
title AEGIS Builder
echo.
echo  Building AEGIS installer...
echo  This takes about 7 minutes. Do not close this window.
echo.
cd /d D:\Projects\AEGIS
cargo tauri build
echo.
if %ERRORLEVEL% EQU 0 (
  echo  SUCCESS. Installer is at:
  echo  D:\Tools\.cargo-target\release\bundle\nsis\AEGIS_4.0.0_x64-setup.exe
  echo.
  explorer "D:\Tools\.cargo-target\release\bundle\nsis"
) else (
  echo  BUILD FAILED. Check output above for errors.
)
pause
