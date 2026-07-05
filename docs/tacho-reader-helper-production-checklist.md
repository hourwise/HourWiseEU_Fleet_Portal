# Tacho Reader Helper Production Checklist

## Purpose

This checklist turns the Phase 8 reader-helper scaffold into a build plan for the real Windows helper.

It complements:

- `docs/tacho-reader-helper-contract.md`
- `docs/tacho-reader-helper-backend-handoff.md`
- `docs/adr/ADR-0019-windows-helper-local-outbox-and-sync-semantics.md`
- `docs/helper-003-phase1-validation-2026-07-04.md`
- `tools/tacho-reader-helper/contract-probe.mjs`
- `tools/tacho-reader-helper/mock-helper.mjs`

The helper must remain a local bridge only. It should read/export tachograph data from local hardware and expose the export to the authenticated browser session. It should not contain long-lived Supabase credentials.

`ADR-0019` controls any local queue/sync behaviour. The helper may keep an encrypted local outbox only as a short-lived delivery/retry queue for failed or interrupted uploads. Supabase remains the source of truth; the helper must not become a local compliance database.

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
- May later keep an encrypted retry outbox for failed/interrupted uploads only, gated by `ADR-0019`.

Avoid for v1:

- Running as an elevated/admin service unless reader hardware requires it.
- Storing Supabase service keys or user session tokens.
- Uploading directly to Supabase from the helper.
- Adding a second backend import model separate from `tachograph_files`.
- Building full offline bulk sync before the basic read/export/browser-upload path is proven.
- Retaining raw card or vehicle-unit data indefinitely.

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

Current exporter milestone:

- `/diagnostics/card-probe` now opens the inserted card through Windows PC/SC and sends safe ISO 7816 probe APDUs, including tachograph-oriented file-selection candidates.
- The probe returns ATR, active protocol, APDU status words, and short response previews only.
- All APDU transmission paths are guarded by a read-only allowlist before PC/SC transmit. Only `SELECT`, `READ BINARY`, `READ RECORD`, `GET RESPONSE`, and `GET DATA` are allowed.
- Write/security-sensitive APDUs such as `UPDATE`, `ERASE`, `PUT DATA`, `VERIFY`, authentication, create/delete, and unknown instructions are blocked locally and are not sent to the card.
- `/diagnostics/apdu-safety` verifies the local allowlist without connecting to a reader or transmitting to a card.
- External exporter commands are disabled by default and require `TACHO_HELPER_ENABLE_EXTERNAL_EXPORTER=true`; external tools run outside the built-in APDU guard and must be reviewed separately before use.
- The probe supports an optional `TACHO_HELPER_TACHOGRAPH_AID` environment variable for testing a candidate tachograph application `SELECT` without hardcoding unverified values.
- Real-card probing has confirmed `SELECT FILE` with `P1=02/P2=0C`, EF.DIR application `FF544143484F`, and initial reads from tachograph application files `0501`, `050E`, `0520`, and `0504`.
- `/diagnostics/tachograph-file-map` now performs a bounded read-only file-map probe against those confirmed application files and returns lengths, hashes, short previews, and truncation flags.
- `POST /commands/start-read` now defaults to a built-in read-only driver-card capture when placeholder mode and external exporters are disabled.
- The built-in capture emits a deterministic HourWise JSON container with real EF bytes, per-file hashes, and truncation flags under a `.C1B` handoff filename for the current browser upload contract.
- `process-tacho` now detects `hourwise.tachograph.driver-card.read-only-capture.v1` before ReadESM parsing, stores sanitized EF summaries as partial metadata, and marks the import `partial` instead of failing as a parser error.
- Final standards-certified `.C1B/.DDD` binary encoding is still to be implemented on top of the confirmed read-only EF traversal.

Acceptance gate:

```bash
npm run tacho:helper:probe -- --mode read --company-id <company-id> --user-id <manager-user-id>
```

This validates the read/export/register state machine without performing a real Supabase upload.

Automated Phase 1 validation without hardware:

```bash
npm run tacho:helper:phase1
```

This starts the real .NET helper in simulated-card external-export mode, drives the read/export/register contract, and avoids the local outbox/sync queue path. See `docs/helper-003-phase1-validation-2026-07-04.md`.

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

### 5A. Encrypted Retry Outbox

Implementation status: ADR-gated Phase 2 reliability feature. Do not implement a sync queue until `ADR-0019` acceptance criteria are met.

Allowed scope:

- Queue only complete exported tachograph files when browser upload or backend registration fails/interrupted.
- Encrypt queued raw bytes at rest, preferably using Windows DPAPI or an equivalent OS-protected key.
- Use the browser-authenticated session for retry upload.
- Delete queued raw bytes after successful backend registration.
- Apply short automatic expiry, initially no longer than 24 hours unless reviewed.
- Expose manual "clear local queued reads" behaviour.
- Calculate SHA-256 for duplicate detection/idempotency.
- Show clear portal labels such as `1 read waiting to sync`, `Retry upload`, and `Local queued read expired`.

Forbidden scope:

- No Supabase service-role key in the helper.
- No long-lived browser auth token storage.
- No local compliance database.
- No authoritative local timeline, rule, report, or driver-history records.
- No full offline bulk sync until Phase 1 and Phase 2 are proven.

Acceptance gate before enabling:

- `docs/adr/ADR-0019-windows-helper-local-outbox-and-sync-semantics.md` acceptance criteria are satisfied.
- Duplicate-safe backend import behaviour is verified using SHA-256/idempotency.
- Diagnostics redact raw data and auth material.
- Uninstall/reinstall behaviour for queued files is defined.

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
- If `ADR-0019` Phase 2 is enabled, log only queue state transitions and hashes; do not log raw queued bytes or excessive card personal data.

### 8. Installer And Updates

Minimum installer requirements:

- Install helper executable.
- Create export/log directories.
- Register startup behavior.
- Allow uninstall without deleting logs by default.
- Show installed version.
- Provide a portal-hostable ZIP package with manifest and SHA-256 checksum.

Current first-pass scaffold:

- `tools/tacho-reader-helper/windows-helper/install.ps1` publishes or copies the helper into a predictable install root.
- `tools/tacho-reader-helper/windows-helper/install.ps1` creates log/export folders and writes `install-info.json`, `VERSION.txt`, and a startup wrapper.
- `tools/tacho-reader-helper/windows-helper/install.ps1` registers startup through the Windows `Run` key for `CurrentUser` or `Machine` scope.
- `tools/tacho-reader-helper/windows-helper/uninstall.ps1` removes startup registration and installed files while preserving logs/exports unless `-RemoveData` is supplied.
- `tools/tacho-reader-helper/windows-helper/package-portal-download.ps1` publishes a bundled Windows ZIP into `public/downloads/tacho-reader-helper/`.
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
- Treat any encrypted outbox as a short-lived retry queue only, as defined by `ADR-0019`.

Recommended:

- Restrict CORS origins to production portal and local dev origins where practical.
- Support Chromium Private Network Access preflights for hosted portal builds by returning `Access-Control-Allow-Private-Network: true` on local helper responses.
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
11. Any sync queue implementation has passed `ADR-0019` Phase 2 acceptance criteria before being enabled.

Current automated status:

- `[x]` `npm run tacho:helper:test` passes using isolated mock port `47237`.
- `[x]` `npm run tacho:helper:phase1` passes against the real .NET helper command seam on port `47236`.
- `[ ]` Real reader/card live validation remains pending.

## Open Technical Decisions

These should be resolved before implementation starts:

- Which Windows stack to use for the helper: .NET, Tauri/Rust, Electron, or a small Node-packaged executable.
- Which library/tool reads actual driver cards reliably on target hardware.
- Whether the helper should parse minimal identity hints locally or only export bytes.
- Whether VU download support shares this helper or uses a separate workflow.
- Whether production CORS should be strict-origin or localhost-permissive for support simplicity.
- Export/log retention period.
- Exact `ADR-0019` Phase 2 expiry default, storage path, clear-queue UX, and uninstall behaviour before enabling the encrypted retry outbox.
- Code-signing and update distribution route.

## Suggested Build Order

1. Implement local HTTP shell with `/status`, `OPTIONS`, and static state.
2. Make `npm run tacho:helper:probe` pass in smoke mode.
3. Add reader detection and card-present events.
4. Add fake export bytes behind real helper shell, then make read probe pass.
5. Replace fake export with real card export.
6. Validate real export bytes with portal upload and `process-tacho`.
7. Implement only the `ADR-0019` Phase 2 encrypted retry cache if the simple helper flow is stable and acceptance criteria are met.
8. Replace the first-pass PowerShell installer with the final signed installer/update route when distribution is selected.
9. Run UAT with a real supervisor workflow.

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
- Includes a portal packaging script that publishes a bundled Windows ZIP, manifest, and SHA-256 checksum under `public/downloads/tacho-reader-helper/`.
- Does not yet include a bundled tachograph card export library/tool.
- Generates placeholder bytes only when `TACHO_HELPER_PLACEHOLDER_READER=true`.
- Completes immediately after `/imports/register` only in placeholder mode.
- Keeps VU workflow disabled unless `TACHO_HELPER_ENABLE_VU_WORKFLOW=true`.

Build the current portal-hosted helper ZIP:

```powershell
npm run tacho:helper:package
```

Optional signing hook:

```powershell
.\tools\tacho-reader-helper\windows-helper\package-portal-download.ps1 `
  -CertificateThumbprint '<thumbprint>' `
  -TimestampUrl '<timestamp server URL>'
```

Portal-served outputs:

- `public/downloads/tacho-reader-helper/HourWise.TachoReaderHelper-win-x64-latest.zip`
- `public/downloads/tacho-reader-helper/latest.json`
- `public/downloads/tacho-reader-helper/HourWise.TachoReaderHelper-win-x64-latest.zip.sha256`

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
- `GET /diagnostics/apdu-safety`: local APDU read-only allowlist self-test; does not connect to the card.
- `GET /diagnostics/card-probe`: safe PC/SC APDU probe against the inserted card.
- `GET /diagnostics/tachograph-file-map`: bounded read-only tachograph application EF probe against the inserted card.

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
