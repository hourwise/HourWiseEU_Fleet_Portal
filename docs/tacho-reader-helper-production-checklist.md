# Tacho Reader Helper Production Checklist

## Purpose

This checklist turns the Phase 8 reader-helper scaffold into a build plan for the real Windows helper.

It complements:

- `docs/tacho-reader-helper-contract.md`
- `docs/tacho-reader-helper-backend-handoff.md`
- `tools/tacho-reader-helper/contract-probe.mjs`
- `tools/tacho-reader-helper/mock-helper.mjs`

The helper must remain a local bridge only. It should read/export tachograph data from local hardware and expose the export to the authenticated browser session. It should not contain long-lived Supabase credentials.

## Target Runtime Shape

Recommended first production shape:

- Windows desktop/tray app or user-level background process.
- Binds only to `127.0.0.1`.
- Default port: `47231`.
- Starts automatically for the signed-in Windows user, or is launched by the supervisor before opening the portal.
- Writes logs under a predictable local folder, for example:
  - `%ProgramData%\HourWise\TachoReaderHelper\logs`
  - `%ProgramData%\HourWise\TachoReaderHelper\exports`
- Exposes the existing localhost HTTP contract.
- Keeps exported files long enough for browser upload and troubleshooting, then applies retention cleanup.

Avoid for v1:

- Running as an elevated/admin service unless reader hardware requires it.
- Storing Supabase service keys or user session tokens.
- Uploading directly to Supabase from the helper.
- Adding a second backend import model separate from `tachograph_files`.

## Implementation Slices

### 1. Local HTTP Service

Required:

- Bind to `127.0.0.1`, not `0.0.0.0`.
- Serve JSON responses for all contract endpoints.
- Implement CORS headers for the portal origin and local development.
- Return stable state from `GET /status`.
- Support `OPTIONS` preflight.
- Reject invalid JSON with `400`.
- Reject unsupported methods/routes with useful JSON.

Contract endpoints:

- `GET /status`
- `POST /commands/start-read`
- `POST /commands/cancel`
- `POST /imports/register`
- `GET /exports/:readSessionId/file`

Acceptance gate:

```bash
npm run tacho:helper:probe -- --base-url http://127.0.0.1:47231
```

### 2. Reader Detection

Required:

- Detect whether a supported smart-card reader is connected.
- Detect whether a driver card is present.
- Move state to `ready` when helper is running but no card is available.
- Move state to `card_inserted` when a card can be read.
- Keep `readerConnected` and `cardPresent` accurate in `/status`.

Recommended:

- Include a stable `readerDeviceId` or reader name in internal logs.
- Avoid exposing low-level device paths in UI-visible fields.
- Debounce insert/remove events to avoid flickering states.

Failure mappings:

- No reader: `ready`, `readerConnected: false`, `cardPresent: false`.
- Reader disconnected mid-read: `error`, `errorCode: "reader_disconnect"`.
- Card removed mid-read: `error`, `errorCode: "card_removed"`.
- Unsupported card: `error`, `errorCode: "unsupported_card"`.

### 3. Card Export

Required:

- On `start-read`, require `companyId`.
- Preserve `requestedByUserId` when supplied.
- Reject non-driver-card `sourceType` for the card-reader path.
- Generate a unique `readSessionId`.
- Export a real card file to disk.
- Expose the exported bytes through `GET /exports/:readSessionId/file`.
- Report:
  - `sourceType: "driver_card"`
  - `exportFileName`
  - `exportDownloadPath`
  - `exportFileSizeBytes`
  - `exportSha256` when feasible
  - `driverCardNumberHint` when safely extractable
  - `driverName` when safely extractable

Recommended file naming:

```text
<driver-token>_<card-or-date-token>_<utc-timestamp>.C1B
```

If the export library produces `.ddd`, preserve the original extension and file bytes.

Failure mappings:

- Export library unavailable: `error`, `errorCode: "export_tool_missing"`.
- Export failed: `error`, `errorCode: "card_export_failed"`.
- Export timeout: `error`, `errorCode: "card_export_timeout"`.
- Export file missing after success: `error`, `errorCode: "export_file_missing"`.

Acceptance gate:

```bash
npm run tacho:helper:probe -- --mode read --company-id <company-id> --user-id <manager-user-id>
```

This validates the read/export/register state machine without performing a real Supabase upload.

### 4. Browser Registration Handoff

Required:

- Wait in `uploading` after export bytes are ready.
- Keep `exportDownloadPath` stable until registration succeeds, fails, or is cancelled.
- Accept `POST /imports/register` only for the current `readSessionId`.
- Require:
  - `readSessionId`
  - `importId`
  - `uploadedStoragePath`
- Move to `processing` after registration is accepted.
- Echo `importId`, `uploadedStoragePath`, and any backend/job correlation fields in `/status`.

Important boundary:

- The browser uploads to Supabase Storage and inserts `tachograph_files`.
- The helper only acknowledges that the browser has registered the import.

Failure mappings:

- Wrong `readSessionId`: HTTP `409`, no state transition.
- Missing `importId`: HTTP `400`, no state transition.
- Missing storage path: HTTP `400`, no state transition.
- Registration timeout from browser side: keep `uploading` and allow cancel/retry.

### 5. Processing And Completion

For v1, the helper does not know actual Supabase processing state unless the browser tells it.

Current browser behavior:

- Browser downloads helper export.
- Browser uploads to storage.
- Browser inserts `tachograph_files`.
- Browser invokes `process-tacho`.
- Browser polls Supabase and auto-opens analysis when a driver target is known.

Helper behavior:

- Move to `processing` after `/imports/register`.
- Keep enough correlation in `/status` for the portal to show progress.
- Do not invent `driverId` or `focusedDate`.
- Only expose `driverId` or `focusedDate` if supplied by the browser or known from a trusted local parser.

Recommended v1 completion rule:

- If browser eventually adds a completion callback, helper may move to `complete`.
- Without a completion callback, helper may remain `processing` while the portal shows backend progress from Supabase.

### 6. Cancellation

Required:

- `POST /commands/cancel` should cancel active read/export where possible.
- If cancellation cannot interrupt the hardware export safely, return accepted and move to a cancelling state internally, then `ready`.
- Clear active export state after cancellation.
- Do not delete logs.

Failure mappings:

- Cancel not possible: HTTP `409` with clear JSON error.
- Cancel succeeded: HTTP `202`, state returns to `ready`.

### 7. Logging And Support

Required logs:

- helper startup/shutdown
- bound host/port
- reader detected/lost
- card inserted/removed
- start-read request with `companyId` and `requestedByUserId`
- read session id
- export file path, size, and hash
- `/imports/register` receipt
- errors with `errorCode`

Do not log:

- Supabase access tokens
- browser auth headers
- full card personal data beyond what is already visible in the portal

Recommended:

- JSON lines log format for easy support parsing.
- Daily log rotation.
- Export retention cleanup after a configurable period.

### 8. Installer And Updates

Minimum installer requirements:

- Install helper executable.
- Create export/log directories.
- Register startup behavior.
- Allow uninstall without deleting logs by default.
- Show installed version.

Current first-pass scaffold:

- `tools/tacho-reader-helper/windows-helper/install.ps1` publishes or copies the helper into a predictable install root.
- `tools/tacho-reader-helper/windows-helper/install.ps1` creates log/export folders and writes `install-info.json`, `VERSION.txt`, and a startup wrapper.
- `tools/tacho-reader-helper/windows-helper/install.ps1` registers startup through the Windows `Run` key for `CurrentUser` or `Machine` scope.
- `tools/tacho-reader-helper/windows-helper/uninstall.ps1` removes startup registration and installed files while preserving logs/exports unless `-RemoveData` is supplied.
- `tools/tacho-reader-helper/windows-helper/README.md` documents install/uninstall commands and default paths.

Recommended:

- Code-sign the installer and executable.
- Make the helper version visible in `/status.helperVersion`.
- Include a "copy diagnostics" action in the tray app or support UI.
- Keep port configurable for support, but default to `47231`.

### 9. Security Baseline

Required:

- Bind only to loopback.
- No service-role Supabase key in the helper.
- No unauthenticated network listener beyond localhost.
- Validate all request bodies.
- Treat `companyId` as browser-supplied context, not local trust.
- Keep `readSessionId` unpredictable.
- Only serve export bytes for the active or retained read session id.

Recommended:

- Restrict CORS origins to production portal and local dev origins where practical.
- Consider a short-lived local pairing token later if browser/helper spoofing becomes a concern.
- Avoid admin privileges unless hardware access demands it.

## Error Code Catalogue

The portal should be able to display these as operator-friendly messages.

| Error code | Meaning | Suggested operator message |
|---|---|---|
| `reader_disconnect` | Reader disconnected during workflow | Reconnect the reader and try again. |
| `card_removed` | Card removed before export finished | Reinsert the card and start a new read. |
| `unsupported_card` | Card type is not supported | Check that this is a driver tachograph card. |
| `export_tool_missing` | Required local export dependency is unavailable | Reinstall or repair the reader helper. |
| `card_export_failed` | Export library returned failure | Try again; if repeated, collect diagnostics. |
| `card_export_timeout` | Export took too long | Check reader connection and try again. |
| `export_file_missing` | Export reported success but file was not found | Repair helper installation or check disk permissions. |
| `export_download_failed` | Browser could not download helper export | Keep helper open and retry upload. |
| `registration_timeout` | Browser did not register upload in time | Retry or use manual upload fallback. |

## Production Acceptance Gates

Before a helper build is considered usable with real supervisors:

1. `npm run tacho:helper:probe` passes.
2. `npm run tacho:helper:probe -- --mode read --company-id <test-company> --user-id <test-user>` passes with a real reader/card.
3. Portal import centre shows helper state changes correctly.
4. Browser-assisted upload creates a `tachograph_files` row.
5. `process-tacho` runs on the uploaded file.
6. Import queue shows success, partial, or failure with clear metadata.
7. Successful driver-card import opens focused driver analysis when driver correlation exists.
8. Manual upload fallback still works when helper is stopped.
9. Logs contain enough detail to diagnose a failed read without exposing secrets.
10. Uninstall/reinstall does not corrupt portal state or stored imports.

## Open Technical Decisions

These should be resolved before implementation starts:

- Which Windows stack to use for the helper: .NET, Tauri/Rust, Electron, or a small Node-packaged executable.
- Which library/tool reads actual driver cards reliably on target hardware.
- Whether the helper should parse minimal identity hints locally or only export bytes.
- Whether VU download support shares this helper or uses a separate workflow.
- Whether production CORS should be strict-origin or localhost-permissive for support simplicity.
- Export/log retention period.
- Code-signing and update distribution route.

## Suggested Build Order

1. Implement local HTTP shell with `/status`, `OPTIONS`, and static state.
2. Make `npm run tacho:helper:probe` pass in smoke mode.
3. Add reader detection and card-present events.
4. Add fake export bytes behind real helper shell, then make read probe pass.
5. Replace fake export with real card export.
6. Validate real export bytes with portal upload and `process-tacho`.
7. Replace the first-pass PowerShell installer with the final signed installer/update route when distribution is selected.
8. Run UAT with a real supervisor workflow.

## Current Repo Scaffold

The first production-shaped helper shell now exists at:

- `tools/tacho-reader-helper/windows-helper/`

It is an ASP.NET Core localhost service targeting `.NET 10`.

Installer scaffold:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\tools\tacho-reader-helper\windows-helper\install.ps1 -Scope CurrentUser
```

Machine-wide install requires an elevated PowerShell session:

```powershell
.\tools\tacho-reader-helper\windows-helper\install.ps1 -Scope Machine
```

Uninstall while preserving logs and exports:

```powershell
.\tools\tacho-reader-helper\windows-helper\uninstall.ps1 -Scope CurrentUser
```

Run the shell:

```bash
npm run tacho:helper:windows
```

Run the shell on a non-default port in PowerShell:

```powershell
$env:TACHO_HELPER_PORT='47232'
npm run tacho:helper:windows
```

Validate smoke mode:

```bash
npm run tacho:helper:probe -- --base-url http://127.0.0.1:47232
```

Enable placeholder-reader mode for full read/register contract testing:

```powershell
$env:TACHO_HELPER_PORT='47232'
$env:TACHO_HELPER_PLACEHOLDER_READER='true'
npm run tacho:helper:windows
```

Then run:

```bash
npm run tacho:helper:probe -- --base-url http://127.0.0.1:47232 --mode read --company-id shell-company --user-id shell-user
```

Current scaffold limitations:

- Detects Windows smart-card readers through PC/SC (`winscard.dll`) and maps card presence into `/status`.
- Can run a configured external card export command and expose the resulting file through `/exports/:readSessionId/file`.
- Writes a JSONL diagnostic event log and exposes recent support events through `/diagnostics`.
- Exposes helper configuration/capabilities through `/diagnostics`, including whether VU workflow support is enabled.
- Includes first-pass install/uninstall scripts using Windows `Run` startup registration, not a Windows Service.
- Does not yet include a bundled tachograph card export library/tool.
- Generates placeholder bytes only when `TACHO_HELPER_PLACEHOLDER_READER=true`.
- Completes immediately after `/imports/register` only in placeholder mode.
- Keeps VU workflow disabled unless `TACHO_HELPER_ENABLE_VU_WORKFLOW=true`.

External export command configuration:

```powershell
$env:TACHO_HELPER_EXPORT_COMMAND='C:\Path\To\CardExportTool.exe'
$env:TACHO_HELPER_EXPORT_ARGS='--output "{outputPath}"'
```

Supported argument placeholders:

- `{readSessionId}`
- `{outputPath}`
- `{outputDir}`

The helper also provides these environment variables to the child process:

- `HOURWISE_TACHO_READ_SESSION_ID`
- `HOURWISE_TACHO_SOURCE_TYPE`
- `HOURWISE_TACHO_EXPORT_OUTPUT_PATH`
- `HOURWISE_TACHO_EXPORT_OUTPUT_DIR`

Diagnostics endpoints:

- `GET /diagnostics`: helper version, process id, config, capabilities, state snapshot, and recent events.
- `GET /diagnostics/logs`: recent events and the local log directory.

Default local folders:

- exports: `%ProgramData%\HourWise\TachoReaderHelper\exports`
- logs: `%ProgramData%\HourWise\TachoReaderHelper\logs`

The installer uses `%LOCALAPPDATA%\HourWise\TachoReaderHelper\logs` and `%LOCALAPPDATA%\HourWise\TachoReaderHelper\exports` for `CurrentUser` scope, and `%ProgramData%\HourWise\TachoReaderHelper\...` for `Machine` scope.

Local command-seam test without hardware:

```powershell
$env:TACHO_HELPER_PORT='47234'
$env:TACHO_HELPER_SIMULATE_CARD_PRESENT='true'
$env:TACHO_HELPER_COMPLETE_AFTER_REGISTER='true'
$env:TACHO_HELPER_EXPORT_COMMAND='powershell'
$env:TACHO_HELPER_EXPORT_ARGS='-NoProfile -ExecutionPolicy Bypass -Command "[System.IO.File]::WriteAllBytes(''{outputPath}'', [byte[]](1,2,3,4,5,6,7,8))"'
npm run tacho:helper:windows
```

Then run:

```bash
npm run tacho:helper:probe -- --base-url http://127.0.0.1:47234 --mode read --company-id shell-company --user-id shell-user
```

Development-only switches:

- `TACHO_HELPER_PLACEHOLDER_READER=true`: bypasses reader/export integration and generates placeholder bytes internally.
- `TACHO_HELPER_SIMULATE_CARD_PRESENT=true`: simulates PC/SC reader/card presence but still uses the configured external export command.
- `TACHO_HELPER_COMPLETE_AFTER_REGISTER=true`: completes the helper workflow after `/imports/register` for local contract testing without backend completion callbacks.
- `TACHO_HELPER_ENABLE_VU_WORKFLOW=true`: enables the future `vehicle_unit` source type shape. Keep this off until a real VU export path is selected.
- `TACHO_HELPER_LOG_DIR=<path>`: overrides the default local JSONL log directory.
