# Tacho Reader Helper Contract

## Purpose

This document defines the localhost contract expected by the Phase 8 frontend scaffold in the manager import centre.

The current UI in `src/components/manager/tachograph/TachoReaderHelperPanel.tsx` assumes:

- a Windows desktop helper runs locally
- the helper exposes a small HTTP API on localhost
- the browser polls helper state and can send simple operator commands

This keeps the browser workflow stable while the helper executable is built separately.

For the Supabase-facing import handoff after a real reader export, see:

- `docs/tacho-reader-helper-backend-handoff.md`

For the production Windows helper build checklist, see:

- `docs/tacho-reader-helper-production-checklist.md`

## Default Endpoint

- default base URL: `http://127.0.0.1:47231`
- override with `VITE_TACHO_HELPER_URL`

## Endpoints

### `GET /status`

Returns the current helper and reader state.

Example response:

```json
{
  "stage": "card_inserted",
  "progressPercent": 20,
  "message": "Driver card detected and ready to read.",
  "detail": "Reader connected. Waiting for supervisor confirmation.",
  "helperVersion": "0.1.0",
  "readerConnected": true,
  "readerDeviceName": "ACS ACR39U ICC Reader",
  "cardPresent": true,
  "canStartRead": true,
  "canCancel": false,
  "lastHeartbeatAt": "2026-05-29T14:55:30.000Z"
}
```

Supported `stage` values:

- `ready`
- `card_inserted`
- `reading`
- `uploading`
- `processing`
- `complete`
- `error`

Optional completion fields:

- `importId`
- `driverId`
- `focusedDate`

When `stage` is `complete`, the frontend will try to open driver analysis automatically if `driverId` is present.

Optional correlation fields:

- `companyId`
- `requestedByUserId`
- `sourceType`
- `driverName`
- `readerDeviceName`
- `readSessionId`
- `exportFileName`
- `exportFilePath`
- `exportDownloadPath`
- `exportFileSizeBytes`
- `exportSha256`
- `driverCardNumberHint`
- `vehicleRegHint`
- `uploadReceiptId`
- `uploadPercent`
- `backendJobId`
- `uploadedStoragePath`
- `scenario`
- `availableScenarios`

### `POST /commands/start-read`

Starts the currently selected local reader workflow.

Example request:

```json
{
  "requestedAt": "2026-05-29T14:56:00.000Z",
  "companyId": "7f0ad8d2-1e0a-4a08-a4d3-93fb026e9b66",
  "requestedByUserId": "manager-profile-uuid",
  "sourceType": "driver_card"
}
```

Suggested response:

```json
{
  "accepted": true
}
```

Required request fields:

- `companyId`

Optional request fields:

- `requestedByUserId`
- `sourceType`, defaulting to `driver_card`

The helper should reject `start-read` if `companyId` is missing. The browser owns company identity because it has the authenticated portal session.

Supported source types:

- `driver_card`: enabled by default.
- `vehicle_unit`: reserved for the future VU-reader workflow and should only be accepted by helpers that explicitly advertise it in diagnostics/capabilities.

### `POST /commands/cancel`

Cancels the active read or upload workflow if possible.

Example request:

```json
{
  "requestedAt": "2026-05-29T14:56:20.000Z"
}
```

Suggested response:

```json
{
  "accepted": true
}
```

### `POST /imports/register`

Confirms that the browser has uploaded the exported file to Supabase Storage and registered the matching `tachograph_files` row.

Example request:

```json
{
  "requestedAt": "2026-05-29T15:02:00.000Z",
  "readSessionId": "read_0f4a5a3d-6990-4e5a-b9e5-2c8da78c5f1e",
  "importId": "dc42b0a2-f6f6-4a13-a808-e5d4f2478a02",
  "uploadedStoragePath": "company-uuid/1748535734000_LEWIS_CARTER_20260529.C1B",
  "fileName": "LEWIS_CARTER_20260529.C1B",
  "fileType": "c1b",
  "sourceType": "driver_card"
}
```

Suggested response:

```json
{
  "accepted": true,
  "stage": "processing",
  "importId": "dc42b0a2-f6f6-4a13-a808-e5d4f2478a02"
}
```

### `GET /exports/:readSessionId/file`

Returns the exported driver-card or VU file bytes for the active read session.

The browser uses this endpoint to download the local export and then uploads it to Supabase Storage under the authenticated portal session.

### `GET /diagnostics`

Returns support diagnostics from the local helper.

Expected fields:

- `helperVersion`
- `utcNow`
- `processId`
- `config`
- `capabilities`
- `state`
- `recentEvents`

The current `.NET` helper reports source-type capability here. `vehicle_unit` should not appear unless the helper has a real VU workflow path or an explicitly enabled development flag.

### `GET /diagnostics/logs`

Returns the recent in-memory diagnostic event ring plus the configured local log directory.

Production helpers should also write JSONL logs locally so support can collect startup, reader, export, registration, and error events without needing browser credentials.

### Optional debug endpoints for the in-repo mock helper

These are not part of the production contract, but the local prototype in this repo supports them for UI testing:

- `POST /debug/reset`
- `POST /debug/card-insert`
- `POST /debug/error`
- `POST /debug/scenario`

Example request for scenario switching:

```json
{
  "scenario": "backend_failure",
  "requestedAt": "2026-05-29T15:40:00.000Z"
}
```

Supported mock scenarios:

- `success`
- `slow_upload`
- `backend_failure`
- `missing_driver`

## State Expectations

The helper should map its internal process onto these browser-visible stages:

1. `ready`
2. `card_inserted`
3. `reading`
4. `uploading`
5. `processing`
6. `complete`

If anything fails, return:

```json
{
  "stage": "error",
  "progressPercent": 100,
  "message": "Reader disconnected during export.",
  "errorCode": "reader_disconnect",
  "canStartRead": true,
  "canCancel": false
}
```

## Notes For Helper Implementation

- Bind only to localhost.
- Return JSON for all endpoints.
- Keep `driverId` and `focusedDate` blank unless they are known with confidence.
- For browser-assisted upload flows, expose the exported bytes over localhost using `exportDownloadPath`.
- `processing` should mean the helper upload succeeded and Supabase processing is underway.
- `complete` should only be returned after the helper can identify the resulting import or driver review target.

## Frontend Dependencies

The current frontend uses this contract in:

- `src/components/manager/tachograph/TachoReaderHelperPanel.tsx`
- `src/components/manager/tachograph/TachoImportCentre.tsx`

## Future Reader UI Direction

When the card-reader and VU-reader screens move from functional scaffold to final UI, use the attached Tachomaster-style screen reference as a structural benchmark, not a visual clone.

Useful patterns to preserve:

- Clear reader status header with a single obvious ready / reading / processing state.
- Prominent action for file fallback or manual import.
- Compact driver / vehicle identity card.
- Compact quick-analysis card with operational figures such as last activity, available drive time, weekly counts, and rest markers.
- Separate infringements / alerts panel that can be empty without looking broken.
- Dense day-by-day timeline with a 0-24 hour ruler and colour-coded activity bands.
- Detail / log split for supervisor troubleshooting.

HourWise should apply its own visual language:

- Use the portal colour scheme rather than Tachomaster's maroon / green desktop style.
- Keep the layout cleaner, more spacious, and responsive for browser use.
- Preserve density in the activity timeline because supervisors need scan speed.
- Make status and error states more explicit than the legacy desktop UI.
- Keep driver-card and VU-reader screens visually related, but use different accents for person-focused and vehicle-focused workflows.

## Local Mock Helper

This repo includes a minimal helper prototype at:

- `tools/tacho-reader-helper/mock-helper.mjs`

This repo also includes the first production-shaped `.NET` helper shell at:

- `tools/tacho-reader-helper/windows-helper/`

Run it with:

```bash
npm run tacho:helper:mock
```

Run the `.NET` shell with:

```bash
npm run tacho:helper:windows
```

The `.NET` shell currently includes:

- PC/SC reader/card detection through Windows smart-card APIs.
- External export-command execution through `TACHO_HELPER_EXPORT_COMMAND`.
- JSONL support logging and `/diagnostics` endpoints.
- A disabled-by-default `vehicle_unit` workflow shape for future VU downloads.

Run the automated scenario regression harness with:

```bash
npm run tacho:helper:test
```

Probe any already-running helper implementation with:

```bash
npm run tacho:helper:probe
```

The probe defaults to safe smoke mode:

- calls `OPTIONS /status`
- calls `GET /status`
- validates core response shape, stage value, progress, and action booleans

To exercise a full staged read/export/register cycle against a staging helper, run:

```bash
npm run tacho:helper:probe -- --mode read --company-id <company-id> --user-id <manager-user-id>
```

Use `--base-url <url>` to target a non-default helper endpoint.

The read probe does not upload to Supabase. It simulates the browser-side registration callback so helper state transitions can be validated before wiring real storage and parser processing.

Default behavior:

- starts in `ready`
- auto-simulates card insertion after a short delay
- accepts `start-read`
- progresses through `reading` -> `uploading` -> `processing` -> `complete`
- serves the exported file over `GET /exports/:readSessionId/file`
- expects the browser to confirm the registered Supabase import with `POST /imports/register`
- emits realistic mock correlation data for read session, exported file, upload receipt, backend job, and import id
- exposes optional debug routes for reset/error testing
- supports scenario switching for slow upload, backend failure, and missing-driver correlation cases
- when the frontend detects `helperVersion` starting with `mock-`, it shows mock-only debug buttons in the reader panel
- includes a regression harness that boots the mock helper and validates all named scenarios
