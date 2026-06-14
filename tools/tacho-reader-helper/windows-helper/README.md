# HourWise Tacho Reader Helper - Windows Install Scaffold

This folder contains the first production-shaped Windows helper shell and a simple PowerShell installer.

The installer is intentionally not a Windows Service yet. It publishes the .NET helper, creates predictable install/data folders, writes a startup wrapper, and registers that wrapper in the Windows `Run` key.

## Default Paths

Current-user install, no admin required:

- app: `%LOCALAPPDATA%\Programs\HourWise\TachoReaderHelper\app`
- metadata: `%LOCALAPPDATA%\Programs\HourWise\TachoReaderHelper\install-info.json`
- version: `%LOCALAPPDATA%\Programs\HourWise\TachoReaderHelper\VERSION.txt`
- logs: `%LOCALAPPDATA%\HourWise\TachoReaderHelper\logs`
- exports: `%LOCALAPPDATA%\HourWise\TachoReaderHelper\exports`
- startup: `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\HourWiseTachoReaderHelper`

Machine install, elevated PowerShell required:

- app: `%ProgramFiles%\HourWise\TachoReaderHelper\app`
- metadata: `%ProgramFiles%\HourWise\TachoReaderHelper\install-info.json`
- version: `%ProgramFiles%\HourWise\TachoReaderHelper\VERSION.txt`
- logs: `%ProgramData%\HourWise\TachoReaderHelper\logs`
- exports: `%ProgramData%\HourWise\TachoReaderHelper\exports`
- startup: `HKLM\Software\Microsoft\Windows\CurrentVersion\Run\HourWiseTachoReaderHelper`

## Install

Current user:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install.ps1 -Scope CurrentUser
```

Machine-wide:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install.ps1 -Scope Machine
```

Install without startup registration:

```powershell
.\install.ps1 -Scope CurrentUser -NoStartup
```

Install with an external card export command:

```powershell
.\install.ps1 `
  -Scope CurrentUser `
  -ExportCommand 'C:\Path\To\CardExportTool.exe' `
  -ExportArguments '--output "{outputPath}"'
```

Install from an already-published folder:

```powershell
.\install.ps1 -NoPublish -PublishedAppPath 'C:\Temp\HourWise.TachoReaderHelper\publish'
```

## Start Manually

The installer writes `Start-HourWiseTachoReaderHelper.ps1` into the install root.

```powershell
& "$env:LOCALAPPDATA\Programs\HourWise\TachoReaderHelper\Start-HourWiseTachoReaderHelper.ps1"
```

Then validate:

```powershell
Invoke-RestMethod http://127.0.0.1:47231/status
Invoke-RestMethod http://127.0.0.1:47231/diagnostics
```

The helper also exposes `helperVersion` from `/status` and `/diagnostics`.

## Uninstall

Uninstall but preserve logs/exports:

```powershell
.\uninstall.ps1 -Scope CurrentUser
```

Uninstall and remove logs/exports:

```powershell
.\uninstall.ps1 -Scope CurrentUser -RemoveData
```

Machine uninstall requires an elevated PowerShell session:

```powershell
.\uninstall.ps1 -Scope Machine
```

## Notes

- The helper binds only to `127.0.0.1` or `localhost`.
- The helper must not contain Supabase service-role credentials.
- Logs are JSONL files written by the helper runtime.
- Exports are local temporary handoff files for browser-assisted upload.
- Code-signing and update distribution are still future production tasks.
