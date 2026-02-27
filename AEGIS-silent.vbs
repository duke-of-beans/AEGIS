' AEGIS-silent.vbs
' Launches AEGIS.exe without showing a console window
' Used by Task Scheduler to start AEGIS silently on login

Option Explicit

Dim wsh, exePath, appDir

appDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' In installed mode, AEGIS.exe is in the same directory
exePath = appDir & "\AEGIS.exe"

If Not CreateObject("Scripting.FileSystemObject").FileExists(exePath) Then
    ' Try Program Files
    exePath = "C:\Program Files\AEGIS\AEGIS.exe"
End If

If Not CreateObject("Scripting.FileSystemObject").FileExists(exePath) Then
    MsgBox "AEGIS.exe not found. Please reinstall AEGIS.", vbExclamation, "AEGIS"
    WScript.Quit 1
End If

Set wsh = CreateObject("WScript.Shell")
' 0 = hide window, False = don't wait for completion
wsh.Run Chr(34) & exePath & Chr(34), 0, False
Set wsh = Nothing