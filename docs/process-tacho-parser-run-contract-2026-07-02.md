# Process Tacho Parser Run Contract

Date: 2026-07-02
Task: `PARSE-001`
Status: Complete

## Purpose

Map the current `supabase/functions/process-tacho/index.ts` edge function to the source-of-truth parser run contract.

This document defines how the current implementation should evolve so every parser execution is traceable, versioned, auditable, and linked to raw files and derived records.

Related documents:

- [SOT-21 Data Model](source-of-truth/21%20%E2%80%94%20Data%20Model%20Specification.md)
- [SOT-22 Security Model](source-of-truth/22%20%E2%80%94%20Security%20Model%20Specification.md)
- [SOT-24 Architecture Decision Records](source-of-truth/24%20%E2%80%94%20Architecture%20Decision%20Records.md)
- [Import Batch/File Schema Delta](import-batch-file-schema-delta-2026-07-02.md)
- [Raw Tachograph Storage Immutability Checks](raw-tachograph-storage-immutability-checks-2026-07-02.md)

## Source-Of-Truth Requirement

SOT-21 defines:

- `parser_runs`
- `parser_outputs`
- `parser_errors`

ADR-0003 requires every parser execution to create a parser run record with parser name, parser version, configuration, status, timestamps, and errors.

ADR-0016 requires a hybrid parser-output model:

- relational records for query-critical, compliance-critical, report-critical, security-critical, and audit-critical fields
- JSONB payloads for parser diagnostics, warnings, errors, unsupported fields, vendor-specific details, and forward-compatible parser payloads

Raw tachograph files remain immutable source evidence. Parser output is versioned derived data.

## Current Implementation Summary

`process-tacho` currently:

- authorises either a configured trigger token or an authenticated same-company manager
- marks `tachograph_files.status = 'processing'`
- downloads the raw object from `tachograph-files`
- parses either readesm output or HourWise read-only helper capture format
- derives activities, day summaries, findings, technical events, discrepancies, reconciliation rows, compliance signals, and risk signals
- writes `tachograph_processing_runs` after successful processing or after caught errors
- updates `tachograph_files` with final status, processed timestamp, linked driver/vehicle/card details, source type, and metadata

Current parser identities:

| Parser path | Current parser version/source |
| --- | --- |
| Standard binary parse | `readesm@1.0.17` with source `normalized_findings` |
| HourWise helper capture | `hourwise-read-only-capture@1` with source `hourwise_read_only_capture` |

## Current Compatibility Table

The current schema has `tachograph_processing_runs`.

Current fields:

| Field | Current meaning |
| --- | --- |
| `id` | Run identity. |
| `import_id` | Links to `tachograph_files.id`. |
| `company_id` | Tenant/fleet bridge. |
| `parser_version` | Parser version string. |
| `source` | Processing source/type. |
| `warnings` | JSONB warning array. |
| `errors` | JSONB error array. |
| `processed_at` | Completion or error timestamp. |

This table should be treated as the MVP compatibility bridge for SOT `parser_runs`, not as disposable diagnostic state.

## Gaps Against SOT Contract

| SOT need | Current state | Gap |
| --- | --- | --- |
| `parser_name` | Encoded indirectly through `source` and parser version constants. | Needs explicit parser name. |
| `parser_version` | Present. | Acceptable, but should be paired with parser name. |
| `parser_config_json` | Not present. | Need config/runtime details such as mode, source type, feature flags, parser options, capture schema. |
| `status` | Reflected on `tachograph_files.status`, not run row. | Run table needs own lifecycle: `queued`, `running`, `completed`, `completed_with_warnings`, `failed`, `unsupported`. |
| `started_at` | Not present. | Required for duration and execution audit. |
| `completed_at` | `processed_at` exists. | Rename or alias to SOT-compatible `completed_at`. |
| `duration_ms` | Not present. | Required for monitoring and support. |
| `error_summary` | Errors array exists. | Add first-class summary for quick triage. |
| `parser_outputs` | Not present. | Need JSONB output records for raw/semi-raw payloads and summaries. |
| `parser_errors` | Errors/warnings embedded in run JSON arrays. | Need optional first-class rows for queryable diagnostics. |
| Derived record linkage | Derived rows link to `import_id`, not parser run. | Add `parser_run_id` where practical or preserve compatible source references. |
| Run history | `clearImportData` deletes `tachograph_processing_runs`. | Must stop deleting previous parser runs. |

## Required Mapping

For MVP, evolve the current schema additively.

| SOT concept | MVP physical implementation |
| --- | --- |
| `parser_runs` | Evolve `tachograph_processing_runs` or create a compatibility view named `parser_runs`. |
| `import_file_id` | `tachograph_processing_runs.import_id`, linked to `tachograph_files.id`. |
| `fleet_id` | `company_id` until `companies`/`fleets` naming is resolved. |
| `parser_name` | New explicit field, values such as `readesm` and `hourwise_read_only_capture`. |
| `parser_version` | Existing `parser_version`. |
| `parser_config_json` | New JSONB field for runtime/config/capture schema. |
| `status` | New field on run row. |
| `started_at` | New field set before storage download begins. |
| `completed_at` | New field or alias from `processed_at`. |
| `duration_ms` | New field calculated from start/completion. |
| `error_summary` | New text field populated on failed/unsupported/partial outcomes. |
| `parser_outputs` | New table or JSONB compatibility table linked to run and import. |
| `parser_errors` | New table or compatibility view from run warnings/errors. |

## Required Status Mapping

`tachograph_files.status` may remain the app-facing import status during migration.

Parser run status must be separate:

| Current event | Import status | Parser run status |
| --- | --- | --- |
| Import queued/pending | `pending` | `queued` |
| Function starts processing | `processing` | `running` |
| Parsed with derived activities and no warnings | `processed` | `completed` |
| Parsed with warnings or partial helper capture | `partial` | `completed_with_warnings` |
| Parser cannot support format | `error` or future `unsupported` | `unsupported` |
| Exception or failed processing | `error` | `failed` |

Do not infer parser run status only from `tachograph_files.status`; the run row must be authoritative for the execution result.

## Required Processing Lifecycle

The edge function should follow this execution shape:

1. Validate request and authorise actor.
2. Load or verify the import row server-side.
3. Create a parser run row with `status = 'running'`, `started_at`, parser name, parser version, import ID, company ID, actor context, and parser config.
4. Update `tachograph_files.status = 'processing'`.
5. Download the immutable raw object.
6. Parse and normalise.
7. Write parser output JSONB rows for diagnostic payloads and summary output.
8. Write relational derived rows for operational and compliance queries.
9. Link derived records to `import_id` and, where schema permits, `parser_run_id`.
10. Complete the parser run with status, completion timestamp, duration, warnings, errors, and summary counts.
11. Update `tachograph_files` final import status and summary metadata.
12. On error, update the same parser run to `failed`; do not create only a late failure row after the fact.

## Required Derived Record Linkage

Derived tables should keep `import_id` for compatibility and add `parser_run_id` where practical.

Priority order:

| Table | Parser run linkage requirement |
| --- | --- |
| `driver_card_downloads` | Add `parser_run_id` when schema is evolved. |
| `vehicle_unit_downloads` | Add `parser_run_id` when schema is evolved. |
| `tachograph_activity_segments` | Add `parser_run_id` or replace with future `normalised_activities.parser_run_id`. |
| `tachograph_day_summaries` | Add `parser_run_id` if retained as derived parser output. |
| `tachograph_findings` | Add `parser_run_id` until compliance outcomes/evidence packs are introduced. |
| `tachograph_technical_events` | Add `parser_run_id`. |
| `tachograph_vehicle_motion_discrepancies` | Add `parser_run_id`. |
| `tachograph_reconciliation_items` | Add `parser_run_id`. |
| `driver_tacho_compliance_signals` | Prefer linking to compliance generation/run later; keep import/parser source metadata during MVP. |
| `driver_tacho_risk_signals` | Prefer linking to risk generation/run later; keep import/parser source metadata during MVP. |

## Required Parser Outputs

Create parser output records for:

| Output type | Contents |
| --- | --- |
| `driver_card_summary` | Card number, holder identity, issuing state, validity dates, period bounds. |
| `vehicle_unit_summary` | Registration, VU serial, calibration due, period bounds. |
| `activity_records` | Normalised activity summary and row counts; detailed rows remain relational. |
| `events` | Event/fault/technical event summary. |
| `raw_decoded` | Bounded parser payload or diagnostics, not an unbounded dump if too large. |
| `helper_capture_summary` | HourWise helper capture schema, files selected/read, warnings, captured bytes, decoded identity/activity counts. |

Large raw parser payloads should be bounded, compressed externally, or summarized. They must not become the only source for operational/compliance queries.

## Required Parser Errors

Warnings and errors should be queryable.

Minimum fields:

| Field | Requirement |
| --- | --- |
| `parser_run_id` | Required. |
| `import_file_id` | Required compatibility link to import. |
| `fleet_id` / `company_id` | Required tenant filter. |
| `severity` | `info`, `warning`, `error`, or `critical`. |
| `error_code` | Stable code such as `STORAGE_DOWNLOAD_FAILED`, `UNSUPPORTED_FORMAT`, `PARSER_EXCEPTION`, `DERIVED_WRITE_FAILED`. |
| `message` | Human-readable summary. |
| `details_json` | Bounded diagnostic details. |

Do not store only console logs or freeform `metadata.processing_error`.

## Required Reprocessing Behaviour

Reprocessing must create a new parser run.

Required changes:

- `clearImportData` must not delete `tachograph_processing_runs`.
- Derived rows may be cleared or superseded for the current active view.
- Prior parser run rows must remain available for audit, support, regression comparison, and report/evidence traceability.
- If old derived rows are deleted, any published outcomes/evidence/report references must continue to resolve through snapshots or retained version references.
- New parser runs should record why they were initiated, who initiated them, and which run they supersede if applicable.

## Required Migration Shape

After live schema verification:

1. Add SOT-compatible columns to `tachograph_processing_runs`: `parser_name`, `parser_config_json`, `status`, `started_at`, `completed_at`, `duration_ms`, `error_summary`, `triggered_by`, `supersedes_parser_run_id`, and `metadata`.
2. Backfill `parser_name` from `source` and `parser_version`.
3. Backfill `status` from `warnings`, `errors`, and linked `tachograph_files.status`.
4. Backfill `completed_at` from `processed_at`.
5. Create `parser_outputs` or `tachograph_parser_outputs`.
6. Create `parser_errors` or `tachograph_parser_errors`.
7. Add `parser_run_id` to priority derived tables where safe.
8. Update `process-tacho` to create the run before parsing and update it through the lifecycle.
9. Remove `tachograph_processing_runs` deletion from `clearImportData` and reprocess/purge flows.
10. Add compatibility view `parser_runs` if the physical table remains named `tachograph_processing_runs`.

## Required Automated Tests

| Test ID | Scenario | Expected result |
| --- | --- | --- |
| `PARSE-RUN-001` | Valid standard tachograph file is processed. | One parser run exists with parser name/version, `completed` status, timestamps, duration, and linked import. |
| `PARSE-RUN-002` | Valid HourWise helper capture is processed with warnings. | Parser run status is `completed_with_warnings`; warning rows or warning JSON are retained. |
| `PARSE-RUN-003` | Unsupported format is uploaded. | Parser run status is `unsupported` or `failed` with stable error code; import row is not marked processed. |
| `PARSE-RUN-004` | Storage download fails. | Parser run is updated to `failed`; `parser_errors` includes `STORAGE_DOWNLOAD_FAILED`. |
| `PARSE-RUN-005` | Derived row insert fails after parsing. | Parser run is `failed`; partial derived writes are rolled back or explicitly marked unsafe. |
| `PARSE-RUN-006` | Same import is reprocessed. | A new parser run is created; previous parser run remains. |
| `PARSE-RUN-007` | `clearImportData` runs for reprocess. | Derived rows may be cleared; parser run history remains. |
| `PARSE-RUN-008` | Parser output is needed by evidence/report flow. | Evidence can trace from derived row to parser run and raw import. |
| `PARSE-RUN-009` | Cross-tenant manager attempts processing. | Request is denied and no parser run is created for the other tenant. |
| `PARSE-RUN-010` | Trigger-token processing runs. | Parser run records trigger actor/source without exposing secret values. |

## Implementation Gates

Do not implement the production migration until:

- `DATA-002` verifies live table and column names
- `IMP-001` compatibility mapping is accepted
- `IMP-002` storage immutability hardening is converted into implementation work
- parser output retention limits are defined
- derived-row rollback or partial-write behaviour is decided
- security tests cover service-role function permission boundaries

## Acceptance Criteria For `PARSE-001`

- Current `process-tacho` behaviour is mapped to SOT parser concepts.
- Gaps against `parser_runs`, `parser_outputs`, and `parser_errors` are documented.
- Required status lifecycle is defined.
- Required reprocessing behaviour is defined.
- Required migration shape is defined.
- Required automated tests are defined.
- Source-of-truth changelog and completion plan are updated.

