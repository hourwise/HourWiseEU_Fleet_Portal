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

The helper also exposes `helperVersion` from `/status` and `/diagnostics`. After installing this build, `/status` should report `dotnet-shell-0.5.9`.

Validate the HELPER-003 Phase 1 read/export/register contract without hardware:

```bash
npm run tacho:helper:phase1
```

This builds the helper into a temporary folder, starts it on an isolated local port, uses simulated card presence plus the external-export command seam, and runs the read-mode contract probe. It does not validate real smart-card APDU reads or certified `.C1B/.DDD` output.

With a card inserted, validate the first APDU/exporter foundation:

```powershell
Invoke-RestMethod http://127.0.0.1:47231/diagnostics/card-probe
```

This endpoint opens the card through Windows PC/SC and sends a safe ISO 7816 APDU probe set. It returns ATR, active protocol, and APDU status words only; it does not export driver activity records yet.

To validate the next read-only file-map step:

```powershell
Invoke-RestMethod http://127.0.0.1:47231/diagnostics/tachograph-file-map
```

This selects the confirmed tachograph application and performs bounded `READ BINARY` traversal of known EFs. It returns byte counts, hashes, short previews, and truncation flags; it does not write to the card and does not create an export file.

For a correctly refreshed `0.5.9` install, `apduResults` should include probes such as `select_mf_3f00_by_file_under_current_p1_02_p2_0c`, `read_selected_ef_dir_binary_probe_20`, `select_ef_dir_aid_ff544143484f_no_le_p2_0c`, `select_tachograph_identification_0520`, `read_selected_identification_probe_16`, and `get_data_probe`. If it only returns the older small probe set, stop the helper process and rerun `install.ps1`.

Card-safety boundary:

- The helper's built-in card probe only sends read-only APDUs: `SELECT`, `READ BINARY`, `READ RECORD`, `GET RESPONSE`, and `GET DATA`.
- The file-map probe uses the same read-only guard and caps each EF read to 4096 bytes.
- The optional APDU diagnostics endpoint is also protected by the same read-only allowlist before any PC/SC transmit occurs.
- Write/security-sensitive APDUs such as `UPDATE BINARY`, `UPDATE RECORD`, `ERASE BINARY`, `PUT DATA`, `VERIFY`, authentication, create/delete, and any non-allowlisted instruction are blocked locally and are not sent to the card.
- The helper does not send PINs, keys, authentication challenges, or file-update commands.
- `GET /diagnostics/apdu-safety` runs local allowlist checks without connecting to the card, so support can verify that write/security APDUs are blocked before transmit.
- External exporter commands are disabled unless `TACHO_HELPER_ENABLE_EXTERNAL_EXPORTER=true` is set. External tools run outside the built-in APDU guard and should not be enabled for this read-only development path.
- `POST /commands/start-read` now defaults to the built-in read-only capture path when placeholder mode and external exporters are disabled.
- The built-in capture produces a deterministic HourWise JSON container with real EF bytes, per-file hashes, and truncation flags, downloaded with a `.C1B` filename for the current browser handoff contract. It is not yet a certified legal C1B encoder.
- Built-in capture uses `TACHO_HELPER_BUILTIN_EXPORT_MAX_BYTES_PER_FILE` to cap each EF read. The default is 65536 bytes, clamped between 1024 and 1048576 bytes.

On the first tested real card, EF.DIR exposed two application identifiers:

- `FF544143484F`, selected successfully with `00 A4 04 0C 06 FF544143484F`.
- `FF534D524454`, visible in EF.DIR but not selected by the current first-generation tachograph probe.

If a tachograph application identifier is being tested, set it before starting the helper:

```powershell
$env:TACHO_HELPER_TACHOGRAPH_AID='001122334455'
```

The helper will then also attempt `SELECT` by that configured AID and return only the status word/result preview.

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

## Portal Download Package

Create the portal-hosted ZIP and manifest:

```powershell
npm run tacho:helper:package
```

This writes:

- `public/downloads/tacho-reader-helper/HourWise.TachoReaderHelper-win-x64-latest.zip`
- `public/downloads/tacho-reader-helper/latest.json`
- `public/downloads/tacho-reader-helper/HourWise.TachoReaderHelper-win-x64-latest.zip.sha256`

Optional Authenticode signing before the ZIP is created:

```powershell
.\package-portal-download.ps1 `
  -CertificateThumbprint '<thumbprint from Cert:\CurrentUser\My or Cert:\LocalMachine\My>' `
  -TimestampUrl '<timestamp server URL>'
```

The generated package installs from its bundled `app` folder. After extracting the ZIP, run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\install.ps1 -Scope CurrentUser
```

## Notes

- The helper binds only to `127.0.0.1` or `localhost`.
- The helper returns `Access-Control-Allow-Private-Network: true` so hosted HTTPS portal builds can reach the loopback helper from Chromium browsers.
- The helper must not contain Supabase service-role credentials.
- Logs are JSONL files written by the helper runtime.
- Exports are local temporary handoff files for browser-assisted upload.
- `/diagnostics/card-probe` is a safe development probe, not a full `.C1B/.DDD` exporter.
- Production code-signing requires a real Authenticode certificate; the packaging script provides the signing hook and unsigned manifest/checksum output when no certificate is supplied.
