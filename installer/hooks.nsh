; AEGIS v4 — Installer Hooks
; Injected into Tauri's NSIS template at install/uninstall points
; Unicode True (set by Tauri bundler)

!macro customInstall

  ; ── ASCII boot sequence ────────────────────────────────────────────
  DetailPrint " "
  DetailPrint "   █████╗  ███████╗  ██████╗  ██╗  ███████╗"
  DetailPrint "  ██╔══██╗ ██╔════╝ ██╔════╝  ██║  ██╔════╝"
  DetailPrint "  ███████║ █████╗   ██║  ███╗ ██║  ███████╗"
  DetailPrint "  ██╔══██║ ██╔══╝   ██║   ██║ ██║  ╚════██║"
  DetailPrint "  ██║  ██║ ███████╗ ╚██████╔╝ ██║  ███████║"
  DetailPrint "  ╚═╝  ╚═╝ ╚══════╝  ╚═════╝  ╚═╝  ╚══════╝"
  DetailPrint " "
  DetailPrint "  ─────────────────────────────────────────"
  DetailPrint "  Cognitive Resource OS              v4.0.0"
  DetailPrint "  ─────────────────────────────────────────"
  DetailPrint " "
  ; ──────────────────────────────────────────────────────────────────

  ; Write version file
  FileOpen $0 "$INSTDIR\VERSION" w
  FileWrite $0 "4.0.0"
  FileClose $0

  ; Write default config if first install
  ${IfNot} ${FileExists} "$APPDATA\AEGIS\aegis-config.yaml"
    CreateDirectory "$APPDATA\AEGIS"
    CreateDirectory "$APPDATA\AEGIS\logs"
    CopyFiles "$INSTDIR\aegis-config.yaml" "$APPDATA\AEGIS\aegis-config.yaml"
    DetailPrint "Config initialized at $APPDATA\AEGIS"
  ${EndIf}

  ; Register per-user logon task (no elevation required)
  DetailPrint "Registering startup task..."
  ExecWait 'schtasks /Create /TN "AEGIS Cognitive Resource OS" /TR "\"$INSTDIR\AEGIS.exe\"" /SC ONLOGON /IT /F' $0
  ${If} $0 != 0
    DetailPrint "Note: Startup task not registered — start AEGIS manually from Start Menu."
  ${Else}
    DetailPrint "AEGIS will launch automatically at next logon."
  ${EndIf}

  ; Create Start Menu shortcut
  CreateDirectory "$SMPROGRAMS\AEGIS"
  CreateShortcut "$SMPROGRAMS\AEGIS\AEGIS.lnk" "$INSTDIR\AEGIS.exe" "" "$INSTDIR\AEGIS.exe" 0

  DetailPrint " "
  DetailPrint "  Installation complete."
  DetailPrint "  AEGIS is in your system tray after next logon."
  DetailPrint " "

!macroend

!macro customUninstall

  ; Kill running AEGIS
  ExecWait 'taskkill /F /IM AEGIS.exe' $0
  ExecWait 'taskkill /F /IM aegis-sidecar.exe' $0

  ; Remove startup task
  ExecWait 'schtasks /Delete /TN "AEGIS Cognitive Resource OS" /F'

  ; Remove Start Menu
  Delete "$SMPROGRAMS\AEGIS\AEGIS.lnk"
  RMDir "$SMPROGRAMS\AEGIS"

  ; Ask about user data
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Remove AEGIS configuration and profiles?$\r$\n$\r$\nChoose No to keep your custom profiles at:$\r$\n$APPDATA\AEGIS" \
    IDNO uninstall_done
  RMDir /r "$APPDATA\AEGIS"
  uninstall_done:

!macroend
