; AEGIS v2.0 Installer
; NSIS Unicode installer with smart profile upgrade strategy

Unicode True
SetCompressor /SOLID lzma

!define APP_NAME        "AEGIS"
!define APP_VERSION     "2.1.0"
!define APP_PUBLISHER   "David K"
!define APP_URL         "https://github.com/duke-of-beans/AEGIS"
!define REG_KEY         "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
!define RELEASE_DIR     "..\release"
!define INSTALLER_NAME  "AEGIS-Setup-${APP_VERSION}.exe"

; Output
OutFile "..\${INSTALLER_NAME}"

; 64-BIT PROGRAM FILES — never the (x86) directory
InstallDir "$PROGRAMFILES64\${APP_NAME}"
InstallDirRegKey HKLM "${REG_KEY}" "InstallPath"

; Require admin
RequestExecutionLevel admin

; Pages
Page directory
Page instfiles

UninstPage uninstConfirm
UninstPage instfiles

; ── DEV GUARD ──────────────────────────────────────────────────────────────────
; Refuse install to source/dev directories
Function .onVerifyInstDir
  StrStr $0 $INSTDIR "\Dev\"
  StrCmp $0 "" check2 devError
  check2:
  StrStr $0 $INSTDIR "\dev\"
  StrCmp $0 "" check3 devError
  check3:
  StrStr $0 $INSTDIR "\source\"
  StrCmp $0 "" check4 devError
  check4:
  StrStr $0 $INSTDIR "\Source\"
  StrCmp $0 "" done devError
  devError:
    MessageBox MB_ICONSTOP "Cannot install AEGIS to a development directory.$\r$\nThis would overwrite your source code.$\r$\n$\r$\nPlease choose a different install location (e.g. C:\Program Files\AEGIS)."
    Abort
  done:
FunctionEnd

; ── MAIN INSTALL ───────────────────────────────────────────────────────────────
Section "Main Application" SecMain
  SetOutPath "$INSTDIR"
  
  ; Kill any running AEGIS first
  ExecWait 'taskkill /f /im AEGIS.exe' $0
  
  ; Core executable
  File "${RELEASE_DIR}\AEGIS.exe"
  File "${RELEASE_DIR}\AEGIS-silent.vbs"
  File "${RELEASE_DIR}\VERSION"
  
  ; PowerShell worker
  CreateDirectory "$INSTDIR\scripts"
  SetOutPath "$INSTDIR\scripts"
  File "${RELEASE_DIR}\scripts\aegis-worker.ps1"
  File "${RELEASE_DIR}\scripts\install-task.ps1"
  File "${RELEASE_DIR}\scripts\remove-task.ps1"
  
  ; Assets
  CreateDirectory "$INSTDIR\assets"
  SetOutPath "$INSTDIR\assets"
  File "${RELEASE_DIR}\assets\status.hta"
  File "${RELEASE_DIR}\assets\settings.hta"
  File "${RELEASE_DIR}\assets\status.css"
  File "${RELEASE_DIR}\assets\status.js"
  
  CreateDirectory "$INSTDIR\assets\icons"
  SetOutPath "$INSTDIR\assets\icons"
  File "${RELEASE_DIR}\assets\icons\*.ico"
  
  ; Default profiles (installed to Program Files — read-only reference copies)
  CreateDirectory "$INSTDIR\profiles"
  SetOutPath "$INSTDIR\profiles"
  File "${RELEASE_DIR}\profiles\*.yaml"

SectionEnd

; ── USER DATA ──────────────────────────────────────────────────────────────────
; Smart upgrade strategy: copy missing profiles only, never overwrite user config
Section "User Data" SecData
  ${IfNot} ${FileExists} "$APPDATA\${APP_NAME}\aegis-config.yaml"
    ; Fresh install — copy everything
    CreateDirectory "$APPDATA\${APP_NAME}\profiles"
    CreateDirectory "$APPDATA\${APP_NAME}\logs"
    
    SetOutPath "$APPDATA\${APP_NAME}"
    File "${RELEASE_DIR}\aegis-config.yaml"
    
    SetOutPath "$APPDATA\${APP_NAME}\profiles"
    File "${RELEASE_DIR}\profiles\idle.yaml"
    File "${RELEASE_DIR}\profiles\build-mode.yaml"
    File "${RELEASE_DIR}\profiles\deep-research.yaml"
    File "${RELEASE_DIR}\profiles\performance.yaml"
    File "${RELEASE_DIR}\profiles\wartime.yaml"
    File "${RELEASE_DIR}\profiles\presentation.yaml"
  ${Else}
    ; Upgrade — only copy profiles the user doesn't already have
    SetOutPath "$APPDATA\${APP_NAME}\profiles"
    
    ${IfNot} ${FileExists} "$APPDATA\${APP_NAME}\profiles\idle.yaml"
      File "${RELEASE_DIR}\profiles\idle.yaml"
    ${EndIf}
    ${IfNot} ${FileExists} "$APPDATA\${APP_NAME}\profiles\build-mode.yaml"
      File "${RELEASE_DIR}\profiles\build-mode.yaml"
    ${EndIf}
    ${IfNot} ${FileExists} "$APPDATA\${APP_NAME}\profiles\deep-research.yaml"
      File "${RELEASE_DIR}\profiles\deep-research.yaml"
    ${EndIf}
    ${IfNot} ${FileExists} "$APPDATA\${APP_NAME}\profiles\performance.yaml"
      File "${RELEASE_DIR}\profiles\performance.yaml"
    ${EndIf}
    ${IfNot} ${FileExists} "$APPDATA\${APP_NAME}\profiles\wartime.yaml"
      File "${RELEASE_DIR}\profiles\wartime.yaml"
    ${EndIf}
    ${IfNot} ${FileExists} "$APPDATA\${APP_NAME}\profiles\presentation.yaml"
      File "${RELEASE_DIR}\profiles\presentation.yaml"
    ${EndIf}
  ${EndIf}
SectionEnd

; ── SHORTCUTS ──────────────────────────────────────────────────────────────────
Section "Shortcuts" SecShortcuts
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\AEGIS.exe" "" "$INSTDIR\assets\icons\idle.ico"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall ${APP_NAME}.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

; ── STARTUP TASK ───────────────────────────────────────────────────────────────
Section "Startup Task" SecTask
  ExecWait 'powershell.exe -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\scripts\install-task.ps1" -ExePath "$INSTDIR\AEGIS.exe" -VbsPath "$INSTDIR\AEGIS-silent.vbs"' $0
SectionEnd

; ── REGISTRY ───────────────────────────────────────────────────────────────────
Section "Registry" SecRegistry
  WriteRegStr HKLM "${REG_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKLM "${REG_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKLM "${REG_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKLM "${REG_KEY}" "URLInfoAbout" "${APP_URL}"
  WriteRegStr HKLM "${REG_KEY}" "InstallPath" "$INSTDIR"
  WriteRegStr HKLM "${REG_KEY}" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegDWORD HKLM "${REG_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${REG_KEY}" "NoRepair" 1
  
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

; ── UNINSTALLER ────────────────────────────────────────────────────────────────
Section "Uninstall"
  ; Kill running AEGIS
  ExecWait 'taskkill /f /im AEGIS.exe'
  
  ; Remove startup task
  ExecWait 'powershell.exe -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\scripts\remove-task.ps1"'
  
  ; Remove install dir (program files)
  RMDir /r "$INSTDIR"
  
  ; Remove Start Menu entries
  RMDir /r "$SMPROGRAMS\${APP_NAME}"
  
  ; Remove registry entries
  DeleteRegKey HKLM "${REG_KEY}"
  
  ; Ask user about data
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Delete your AEGIS configuration and profiles?$\r$\n$\r$\nChoosing No preserves your custom profiles and settings at:$\r$\n$APPDATA\AEGIS" \
    IDNO uninstall_done
  RMDir /r "$APPDATA\${APP_NAME}"
  
  uninstall_done:
SectionEnd