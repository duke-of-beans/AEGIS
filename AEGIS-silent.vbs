' AEGIS-silent.vbs
' Launches AEGIS via Node without showing a console window
' Used by Task Scheduler to start AEGIS silently on login

Option Explicit

Dim wsh, appDir, fso

Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)

If Not fso.FileExists(appDir & "\dist\main.js") Then
    MsgBox "AEGIS dist\main.js not found. Please reinstall AEGIS.", vbExclamation, "AEGIS"
    WScript.Quit 1
End If

Set wsh = CreateObject("WScript.Shell")
' 0 = hide window, False = don't wait for completion
wsh.CurrentDirectory = appDir
wsh.Run "node dist\main.js", 0, False
Set wsh = Nothing
Set fso = Nothing
