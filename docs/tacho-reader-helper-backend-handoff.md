# Tacho Reader Helper Backend Handoff

## Purpose

This document defines the production-side handoff between the Windows reader helper, the authenticated browser session, and the Supabase import pipeline.

It is grounded in the current repo behavior:

- manual uploads write raw files to the `tachograph-files` storage bucket
- imports are registered in `public.tachograph_files`
- `supabase/functions/process-tacho/index.ts` processes one inserted import row as `{ "record": ... }`

It complements:

- `docs/tacho-reader-helper-contract.md`
- `docs/tacho-backend-api.md`
- `src/components/manager/tachograph/TachoUploadZone.tsx`
- `supabase/functions/process-tacho/index.ts`

## Current Code-Backed Pipeline

Today, the only code-backed ingest flow in-repo is:

1. Upload the raw `.ddd/.c1b/.v1b/.tgd` file to storage bucket `tachograph-files`.
2. Insert a `tachograph_files` row with `status = 'pending'`.
3. Invoke `process-tacho` with `{ "record": <inserted row> }`.
4. `process-tacho` updates the row to `processing`, then to `processed`, `partial`, or `error`.
5. The frontend reads that row through `fetchRecentTachoImports()` and the normalized RPCs.

The helper build should preserve that pipeline rather than create a parallel import model.

## Recommended Ownership Boundary

For the real helper flow, the clean boundary is:

- the helper is authoritative for reader state, export timing, and raw exported file bytes
- the browser is authoritative for the authenticated `companyId` and any operator-selected driver or vehicle hints
- Supabase is authoritative for `importId`, final `driver_id`, final `vehicle_id`, `source_type`, processing status, and review focus

This avoids putting long-lived Supabase credentials inside the Windows helper.

## Helper Export Payload

After a successful reader export, the helper should expose one stable export descriptor to the browser.

The browser cannot use a local Windows file path directly, so a localhost-downloadable file reference is required if the browser performs the storage upload.

Example helper payload:

```json
{
  "schemaVersion": "1.0",
  "readSessionId": "0f4a5a3d-6990-4e5a-b9e5-2c8da78c5f1e",
  "helperVersion": "0.2.0",
  "companyId": "7f0ad8d2-1e0a-4a08-a4d3-93fb026e9b66",
  "sourceType": "driver_card",
  "exportedAt": "2026-05-29T16:22:14.000Z",
  "export": {
    "fileName": "LEWIS_CARTER_20260529.C1B",
    "fileType": "c1b",
    "fileSizeBytes": 248112,
    "sha256": "b6a6d6f2f8d5f4f5f9c01f0f0f8d7f8d0d4f765db3d1b6d9f6d6f7b2a1c3d4e5",
    "downloadPath": "/exports/0f4a5a3d-6990-4e5a-b9e5-2c8da78c5f1e/file",
    "localFilePath": "C:\\ProgramData\\HourWise\\TachoExports\\LEWIS_CARTER_20260529.C1B"
  },
  "hints": {
    "driverId": null,
    "vehicleId": null,
    "driverCardNumber": "UK1234567890",
    "driverName": "Lewis Carter",
    "vehicleReg": null
  },
  "reader": {
    "deviceId": "omnikey-3121-frontdesk",
    "readerConnected": true,
    "cardPresent": false
  }
}
```

### Required fields

- `schemaVersion`
- `readSessionId`
- `helperVersion`
- `companyId`
- `sourceType`
- `exportedAt`
- `export.fileName`
- `export.fileType`
- `export.fileSizeBytes`
- `export.downloadPath`

### Strongly recommended fields

- `export.sha256`
- `hints.driverCardNumber`
- `hints.driverName`
- `hints.vehicleReg`
- `reader.deviceId`
- `export.localFilePath`

### Notes

- `companyId` should come from the signed-in browser context, not from local machine config.
- `sourceType` should be set by the helper only when it is certain: `driver_card` or `vehicle_unit`.
- `focusedDate` should not be guessed by the helper. It is a backend correlation output, not a reader export input.

## Browser-To-Supabase Registration

Once the browser has the helper export payload, it should persist the import in the same shape as the current manual upload flow.

### Storage upload

- bucket: `tachograph-files`
- current-compatible object path: `${companyId}/${timestamp}_${fileName}`

The helper path should not be reused as the storage object key. Only the Supabase object path matters after upload.

### `tachograph_files` insert payload

Minimum current-compatible insert:

```json
{
  "company_id": "7f0ad8d2-1e0a-4a08-a4d3-93fb026e9b66",
  "filename": "LEWIS_CARTER_20260529.C1B",
  "file_path": "7f0ad8d2-1e0a-4a08-a4d3-93fb026e9b66/1748535734000_LEWIS_CARTER_20260529.C1B",
  "file_type": "c1b",
  "status": "pending",
  "source_type": "driver_card",
  "driver_id": null,
  "vehicle_id": null,
  "metadata": {
    "ingest_source": "reader_helper",
    "helper_schema_version": "1.0",
    "helper_version": "0.2.0",
    "read_session_id": "0f4a5a3d-6990-4e5a-b9e5-2c8da78c5f1e",
    "reader_device_id": "omnikey-3121-frontdesk",
    "exported_at": "2026-05-29T16:22:14.000Z",
    "export_file_name": "LEWIS_CARTER_20260529.C1B",
    "export_file_size_bytes": 248112,
    "export_sha256": "b6a6d6f2f8d5f4f5f9c01f0f0f8d7f8d0d4f765db3d1b6d9f6d6f7b2a1c3d4e5",
    "driver_card_number_hint": "UK1234567890",
    "driver_name": "Lewis Carter",
    "vehicle_reg": null,
    "upload_origin": "browser_assisted"
  }
}
```

### Why these fields matter

- `company_id`, `file_path`, and `status` are required by the existing import path.
- `source_type` is already honored by `process-tacho` and prevents ambiguous source inference.
- `driver_id` and `vehicle_id` should be populated only when the UI already has a high-confidence match.
- helper correlation data belongs in `metadata` because `process-tacho` already merges metadata forward instead of replacing it.

## Exact `process-tacho` Record Contract

`process-tacho` currently expects this request body:

```json
{
  "record": {
    "id": "import-uuid",
    "company_id": "company-uuid",
    "driver_id": "driver-uuid-or-null",
    "vehicle_id": "vehicle-uuid-or-null",
    "file_path": "company-uuid/1748535734000_LEWIS_CARTER_20260529.C1B",
    "file_type": "c1b",
    "filename": "LEWIS_CARTER_20260529.C1B",
    "metadata": {
      "ingest_source": "reader_helper",
      "read_session_id": "0f4a5a3d-6990-4e5a-b9e5-2c8da78c5f1e"
    },
    "source_type": "driver_card"
  }
}
```

Observed behavior from the current function:

1. Rejects the request if `record.id` or `record.file_path` is missing.
2. Sets `tachograph_files.status = 'processing'`.
3. Downloads from storage bucket `tachograph-files` using `record.file_path`.
4. Uses `record.driver_id`, `record.vehicle_id`, and `record.source_type` as strong hints.
5. Falls back to matching `profiles.tacho_card_number` and `vehicles.reg_number` when explicit ids are absent.
6. Writes the final row with `status`, `processed_at`, resolved `driver_id`, resolved `vehicle_id`, `source_type`, and merged metadata.

## Import Correlation Rules

`importId` must be the inserted `tachograph_files.id`. That row id is the only durable key that all later views can share.

Recommended correlation fields to preserve from helper to import row:

- `metadata.read_session_id`
- `metadata.export_sha256`
- `metadata.reader_device_id`
- `metadata.ingest_source = 'reader_helper'`

These fields are useful for:

- showing the operator which helper read created which import
- retrying a failed backend run without re-reading the card
- diagnosing duplicate uploads or reader-side export issues

## Review-Target Correlation

The helper should not try to determine the final review target by itself. Supabase should derive it after processing.

### Driver target

Use this order:

1. `tachograph_files.driver_id` after `process-tacho` finishes
2. if still null, do not auto-open driver analysis

This is consistent with current processor behavior, which first trusts `record.driver_id` and otherwise matches by parsed card number.

### Vehicle target

Use this order:

1. `tachograph_files.vehicle_id` after `process-tacho` finishes
2. otherwise leave vehicle analysis unopened

### Focused review date

Recommended order:

1. latest `driver_tacho_compliance_signals.review_focus.date` for the resolved driver
2. latest `driver_tacho_risk_signals.review_focus.date` for the resolved driver
3. first non-`matched` `tachograph_reconciliation_items.recon_date` for the import
4. first `tachograph_findings.occurred_at::date` for the import
5. first `tachograph_technical_events.occurred_at::date` for the import

Why this order:

- `process-tacho` already writes `review_focus` into normalized driver signal rows
- the frontend already treats `reviewFocus.date` as the preferred navigation hint
- reconciliation and findings are the next best import-local evidence if signal rows are not yet available

## Recommended Production Flow

1. Browser sends `start-read` with authenticated company and optional driver or vehicle hints.
2. Helper exports the raw file and exposes the export descriptor plus `downloadPath`.
3. Browser uploads the exported bytes to `tachograph-files`.
4. Browser inserts the `tachograph_files` row with helper metadata.
5. Existing deployment trigger or webhook invokes `process-tacho` with `{ "record": <inserted row> }`.
6. Browser polls import status by `importId`.
7. Once processing finishes, browser resolves `driverId` and `focusedDate` from Supabase and only then marks the helper flow `complete`.

## Known Gap

This repo contains the processor but not the in-database or webhook trigger that calls `process-tacho` for new `tachograph_files` rows.

That missing deployment-owned trigger is the same boundary referenced in the roadmap note about replacing the exposed trigger bearer pattern safely.

Until that trigger path is finalized, the helper build should treat `{ "record": <inserted row> }` as the stable processor input and avoid depending on any additional unpublished backend payload shape.
