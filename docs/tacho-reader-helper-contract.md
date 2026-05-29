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
- `sourceType`
- `driverName`
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

Starts reading the currently inserted driver card.

Example request:

```json
{
  "requestedAt": "2026-05-29T14:56:00.000Z"
}
```

Suggested response:

```json
{
  "accepted": true
}
```

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

## Local Mock Helper

This repo includes a minimal helper prototype at:

- `tools/tacho-reader-helper/mock-helper.mjs`

Run it with:

```bash
npm run tacho:helper:mock
```

Run the automated scenario regression harness with:

```bash
npm run tacho:helper:test
```

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
