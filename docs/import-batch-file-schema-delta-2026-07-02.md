# Import Batch/File Schema Delta

Date: 2026-07-02
Task: `IMP-001`
Status: Complete

## Purpose

Define the MVP schema delta between the current tachograph import implementation and the source-of-truth import model.

This document bridges:

- Source of Truth: [SOT-21 Data Model](source-of-truth/21%20%E2%80%94%20Data%20Model%20Specification.md)
- Source of Truth: [SOT-22 Security Model](source-of-truth/22%20%E2%80%94%20Security%20Model%20Specification.md)
- ADRs: [SOT-24 Architecture Decision Records](source-of-truth/24%20%E2%80%94%20Architecture%20Decision%20Records.md)
- Prior reconciliation: [MVP Data Model Migration Reconciliation](data-model-mvp-migration-reconciliation-2026-07-02.md)
- Prior reconciliation: [Security/RLS Reconciliation](security-rls-reconciliation-2026-07-02.md)

## Decision

For MVP, do not replace the current `tachograph_files` contract with a new `import_files` table in one step.

Use `tachograph_files` as the physical compatibility bridge for the source-of-truth `import_files` concept, then evolve it toward the SOT model with additive columns, compatibility views, indexes, RLS hardening, and backfill scripts.

Create `import_batches` as the first new import grouping table only after the live database schema is verified. `import_batch_id` on `tachograph_files` may be nullable during migration and backfilled later into one-file default batches where no real batch exists.

Do not introduce a parallel `import_files` table until:

- existing app reads and writes have a compatibility plan
- RLS/storage immutability gaps are closed
- parser and timeline contracts are aligned
- migration rollback and backfill paths are documented

## Current Implementation Shape

The application currently treats `tachograph_files` as the upload/import source of truth.

Observed code contracts:

| Area | Current dependency |
| --- | --- |
| `src/lib/tacho/helperImport.ts` | Inserts pending imports into `tachograph_files` with `company_id`, `filename`, `file_path`, `file_type`, `status`, `source_type`, `driver_id`, `vehicle_id`, and `metadata`. |
| `src/lib/tacho/api.ts` | Reads recent imports by `company_id`, orders by `uploaded_at`, and can archive candidate imports with optional storage deletion. |
| `src/hooks/useDriverTachoSummary.ts` | Reads `tachograph_files` by `external_card_number` and status metadata for driver summaries. |
| `src/components/manager/reports/compliance-pack/CompliancePackGenerator.tsx` | Reads import metadata for compliance pack evidence. |
| `supabase/functions/process-tacho/index.ts` | Receives and updates `tachograph_files` rows during processing, including `status`, `processed_at`, `external_card_number`, `driver_id`, `vehicle_id`, `source_type`, and `metadata`. |
| Supabase migrations | Add normalized tacho columns, storage bucket policies, helper indexes, candidate archive controls, rebuild/reset controls, and purge behaviour around `tachograph_files`. |

Important caveat: source-controlled migrations reference some tables that are not created in the visible migration set, including `tachograph_files`, `tachograph_activities`, and `tachograph_speed_logs`. A live schema inspection is required before writing the implementation migration.

## Source-Of-Truth Target Shape

SOT-21 defines imported files as immutable evidence.

Target import model:

| SOT table | Purpose |
| --- | --- |
| `import_batches` | Groups one or more uploaded files. |
| `import_files` | Stores file-level metadata for uploaded files. |
| `driver_card_imports` | Represents a driver card import derived from an imported file. |
| `vehicle_unit_imports` | Represents a vehicle unit import derived from an imported file. |
| `file_assets` | Generic file metadata table for stored evidence assets. |
| `parser_runs` | Represents each parsing execution against an import file. |

Relevant SOT principles:

- raw imported files are evidence
- raw files should be immutable
- reprocessing creates a new parser run
- original files are not overwritten
- derived outputs may be regenerated, but published evidence remains traceable

## MVP Mapping

Use this mapping for the first migration slice.

| SOT concept | MVP physical implementation | Notes |
| --- | --- | --- |
| `fleet_id` | `company_id` | Temporary naming bridge until the `companies` versus `fleets` model is resolved. |
| `import_files` | `tachograph_files` | Preserve app and function compatibility. |
| `import_batches` | New table, optional in first migration | Supports grouped helper/manual uploads. `tachograph_files.import_batch_id` can be nullable initially. |
| `driver_card_imports` | Existing metadata plus future table/view | Do not create until parser output and driver card identity model are verified. |
| `vehicle_unit_imports` | Existing metadata plus future table/view | Do not create until vehicle identity model is verified. |
| `file_assets` | `tachograph_files` storage columns plus `tachograph-files` bucket | Delay generic table unless required by evidence packs. |
| `parser_runs` | Current `process-tacho` updates plus future parser run table | Covered by `PARSE-001`; do not overload `tachograph_files` with parser execution history. |

## Required `tachograph_files` Delta

Before implementation, verify which columns already exist in the live database. Add only missing columns.

| Column | Requirement | Purpose |
| --- | --- | --- |
| `company_id` | Existing/required | Tenant/fleet bridge. |
| `import_batch_id` | Add nullable FK | Links a file to an upload batch. |
| `filename` | Existing/required | Current app-facing filename. |
| `original_filename` | Optional alias/additive | SOT-compatible filename; may be generated from `filename`. |
| `file_path` | Existing/required | Current storage path. |
| `storage_bucket` | Add default `tachograph-files` | Makes storage asset explicit. |
| `storage_path` | Optional alias/additive | SOT-compatible storage path; may mirror `file_path`. |
| `file_hash` | Add required after backfill | Duplicate detection and evidence integrity. |
| `file_size_bytes` | Add nullable, backfill where possible | Evidence metadata and duplicate analysis. |
| `mime_type` | Add nullable | Asset metadata. |
| `file_type` | Existing/required | Driver card, vehicle unit, unknown, unsupported. |
| `detected_format` | Add nullable | Parser-detected format/version. |
| `status` | Existing/required | Upload/import processing state. |
| `duplicate_of_import_file_id` | Add nullable self-reference | SOT duplicate handling. |
| `uploaded_by` | Add nullable FK if absent | Actor attribution. |
| `uploaded_at` | Existing/required | Import chronology. |
| `processed_at` | Existing/required | Processing chronology. |
| `driver_id` | Existing/nullable | Linked driver where known. |
| `vehicle_id` | Existing/nullable | Linked vehicle where known. |
| `external_card_number` | Existing/nullable | Current driver-card matching contract. |
| `source_type` | Existing/required | Portal/helper/API/source classification. |
| `metadata` | Existing/required | Compatibility JSON payload. |
| `metadata_json` | Do not add for MVP | Use `metadata`; introduce view alias later if needed. |
| `retention_state` | Add default `retained` | Supports ADR-0018 immutability and retention workflow. |
| `retain_until` | Add nullable | Policy-driven retention boundary. |
| `deleted_at` | Add nullable | Soft deletion only, if permitted by policy. |
| `deleted_by` | Add nullable FK | Deletion actor audit. |
| `deletion_reason` | Add nullable | Deletion audit reason. |

## New `import_batches` Table Delta

Add this table only after `DATA-002` confirms the live schema and relationship names.

Required fields:

| Column | Requirement |
| --- | --- |
| `id` | Primary key. |
| `company_id` | Tenant/fleet bridge, required. |
| `uploaded_by` | Actor who started the batch, nullable only for legacy backfill. |
| `batch_type` | Controlled value: `driver_card`, `vehicle_unit`, `mixed`, `manual`, `api`. |
| `source` | Controlled value: `portal_upload`, `windows_helper`, `api`, `support_upload`, `future_integration`. |
| `source_record_id` | Nullable external/helper reference. |
| `status` | Controlled value mapped to import processing lifecycle. |
| `created_at` | Required. |
| `updated_at` | Required. |
| `metadata` | JSONB for compatibility and helper diagnostics. |

Recommended compatibility view:

```sql
create view import_files as
select
  id,
  company_id as fleet_id,
  import_batch_id,
  uploaded_by,
  file_type,
  coalesce(original_filename, filename) as original_filename,
  coalesce(storage_path, file_path) as storage_path,
  file_hash,
  file_size_bytes,
  mime_type,
  detected_format,
  status,
  duplicate_of_import_file_id,
  uploaded_at as created_at,
  processed_at,
  metadata as metadata_json
from tachograph_files;
```

The exact SQL must be adjusted after live schema verification.

## Status Mapping

Normalize status values at the boundary, not by breaking existing app code.

| Current value | SOT-compatible meaning |
| --- | --- |
| `pending` | `queued` |
| `processing` | `processing` |
| `processed` | `processed` |
| `partial` | `completed_with_warnings` |
| `error` | `failed` |
| `unsupported` | `unsupported` |
| `rejected` | `rejected` |

Implementation should support both current and SOT-compatible values during migration, then converge through typed adapters.

## Required Indexes

Add or verify these indexes as part of the migration plan:

| Index | Purpose |
| --- | --- |
| `tachograph_files(file_hash)` | Duplicate and integrity lookup. |
| `tachograph_files(company_id, file_hash)` | Tenant-scoped duplicate detection. |
| `tachograph_files(company_id, source_type, uploaded_at desc)` | Recent import reads. |
| `tachograph_files(company_id, source_type, driver_id, uploaded_at desc)` | Driver import summaries. |
| `tachograph_files(company_id, source_type, vehicle_id, uploaded_at desc)` | Vehicle import summaries. |
| `tachograph_files(import_batch_id)` | Batch drill-down. |
| `tachograph_files(duplicate_of_import_file_id)` | Duplicate lineage. |
| `import_batches(company_id, created_at desc)` | Recent batches. |
| `import_batches(company_id, status, created_at desc)` | Batch processing queues and monitoring. |

## RLS And Storage Requirements

This item is blocked from implementation until the security gaps from `SEC-001` are converted into migration and test tasks.

Minimum requirements:

- `tachograph_files` must have explicit tenant-scoped RLS.
- `import_batches` must have explicit tenant-scoped RLS.
- Managers may insert and select imports for fleets they manage.
- Drivers may read only their own linked import summaries if exposed to the driver app.
- Raw evidence rows must not be directly updateable or deleteable by normal clients.
- Status, retention, duplicate, and parser fields must be changed through controlled RPCs or service-role functions.
- The `tachograph-files` storage bucket must not permit normal manager update/delete of raw evidence.
- Storage delete/archive workflows must preserve audit metadata and comply with ADR-0018.
- Support access must be explicitly modelled before support upload or support read policies are enabled.

## Backfill Plan

Required before enforcing stricter constraints:

1. Inspect live columns, constraints, policies, and storage policies.
2. Add nullable compatibility columns to `tachograph_files`.
3. Backfill `storage_bucket = 'tachograph-files'`.
4. Backfill `storage_path` from `file_path` where absent.
5. Backfill `original_filename` from `filename` where absent.
6. Compute or import `file_hash` for existing stored objects where possible.
7. Set `retention_state = 'retained'` for existing evidence rows.
8. Create one-file `import_batches` for legacy rows if batch grouping is required.
9. Link `tachograph_files.import_batch_id` to generated or real batches.
10. Add indexes concurrently where supported.
11. Add or tighten RLS after data is backfilled and app queries are verified.
12. Add compatibility views only after app and function query paths are covered by tests.

## Implementation Gates

Do not write the production migration until these are complete:

| Gate | Required output |
| --- | --- |
| `DATA-002` | Live Supabase schema dump or verified table/column/policy inventory. |
| `SEC-002` | RLS migration plan for import rows and storage objects. |
| `IMP-002` | Raw tachograph storage immutability checks and archive/delete policy. |
| `PARSE-001` | Parser run contract for `process-tacho`. |
| `TEST-001` | Cross-tenant upload/read regression tests. |

## Acceptance Criteria For `IMP-001`

- Current `tachograph_files` dependency is documented.
- SOT import model mapping is documented.
- MVP migration direction is selected.
- Required columns, indexes, RLS expectations, and backfill notes are defined.
- Security and parser blockers are explicit.
- Source-of-truth changelog and completion plan are updated.

