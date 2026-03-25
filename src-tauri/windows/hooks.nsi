; AEGIS v4 — NSIS Installer Hooks
; Injected into Tauri's installer at post-install and post-uninstall
; Unicode True is set by the Tauri bundler — block chars render in Courier New

!macro NSIS_HOOK_POSTINSTALL

  ; ── AEGIS boot sequence ────────────────────────────────────────────────────
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
  ; ───────────────────────────────────────────────────────────────────────────

  ; Initialize user data directory on first install
  ${IfNot} ${FileExists} "$APPDATA\AEGIS\aegis-config.yaml"
    CreateDirectory "$APPDATA\AEGIS"
    CreateDirectory "$APPDATA\AEGIS\logs"
    DetailPrint "Initializing config at $APPDATA\AEGIS ..."
    CopyFiles /SILENT "$INSTDIR\aegis-config.yaml" "$APPDATA\AEGIS\aegis-config.yaml"
  ${EndIf}

  ; Register per-user logon task — no elevation required
  DetailPrint "Registering startup task..."
  ExecWait 'schtasks /Create /TN "AEGIS Cognitive Resource OS" /TR "\"$INSTDIR\AEGIS.exe\"" /SC ONLOGON /IT /F' $0
  ${If} $0 != 0
    DetailPrint "  Note: Startup task not registered."
    DetailPrint "  Launch AEGIS manually from the Start Menu."
  ${Else}
    DetailPrint "  AEGIS will launch automatically at next logon."
  ${EndIf}

  DetailPrint " "
  DetailPrint "  Done. AEGIS is ready."
  DetailPrint "  It will appear in your system tray after next logon."
  DetailPrint " "

!macroend

!macro NSIS_HOOK_POSTUNINSTALL

  ; Remove startup task
  ExecWait 'schtasks /Delete /TN "AEGIS Cognitive Resource OS" /F'

  ; Ask about user data
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Remove AEGIS configuration and profiles?$\r$\n$\r$\nNo = keep your custom profiles at:$\r$\n$APPDATA\AEGIS" \
    IDNO aegis_uninstall_done
  RMDir /r "$APPDATA\AEGIS"
  aegis_uninstall_done:

!macroend
