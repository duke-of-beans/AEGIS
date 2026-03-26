' AEGIS-silent.vbs
' Launches AEGIS via Node without showing a console window
' Used by Task Scheduler to start AEGIS silently on login

Option Explicit

Dim wsh, appDir, fso, mainJs

Set fso = CreateObject("Scripting.FileSystemObject")
appDir = fso.GetParentFolderName(WScript.ScriptFullName)
mainJs = appDir & "\dist\main.js"

If Not fso.FileExists(mainJs) Then
    MsgBox "AEGIS dist\main.js not found at:" & vbCrLf & mainJs & vbCrLf & vbCrLf & "Please reinstall AEGIS.", vbExclamation, "AEGIS"
    WScript.Quit 1
End If

Set wsh = CreateObject("WScript.Shell")
' 0 = hide window, False = don't wait for completion
' Use cmd /c with quoted path to handle spaces in "Program Files"
wsh.Run "cmd /c cd /d """ & appDir & """ && node dist\main.js", 0, False
Set wsh = Nothing
Set fso = Nothing
