# Raw Tachograph Storage Immutability Checks

Date: 2026-07-02
Task: `IMP-002`
Status: Complete

## Purpose

Define the checks required before HourWise can treat raw tachograph file storage as compliant with the source-of-truth evidence model.

This document covers the `tachograph-files` Supabase storage bucket, the current `tachograph_files` database contract, archive/delete RPCs, and client call sites that can physically remove raw evidence.

Related documents:

- [SOT-21 Data Model](source-of-truth/21%20%E2%80%94%20Data%20Model%20Specification.md)
- [SOT-22 Security Model](source-of-truth/22%20%E2%80%94%20Security%20Model%20Specification.md)
- [SOT-24 Architecture Decision Records](source-of-truth/24%20%E2%80%94%20Architecture%20Decision%20Records.md)
- [Security/RLS Reconciliation](security-rls-reconciliation-2026-07-02.md)
- [Import Batch/File Schema Delta](import-batch-file-schema-delta-2026-07-02.md)

## Source-Of-Truth Requirement

Raw tachograph files are source evidence.

Required behaviour:

- raw files are private
- raw files are not overwritten
- raw files are not edited
- file hash is stored
- upload actor is stored
- upload timestamp is stored
- parser runs are recorded separately
- download is restricted to authorised users
- deletion or archival is allowed only through explicit policy-driven retention workflow
- metadata, hash, parser references, audit trail, and report/evidence traceability survive binary deletion

## Current Findings

The current implementation is not yet immutable.

| Area | Finding | Risk |
| --- | --- | --- |
| Storage bucket policy | `supabase/migrations/20260618210500_add_tachograph_storage_bucket.sql` creates manager `insert`, `select`, `update`, and `delete` policies for `tachograph-files`. | Authenticated managers can overwrite or delete raw evidence through storage APIs. |
| Candidate archive RPC | `archive_tacho_candidate_import` accepts `p_delete_storage_file` and records that storage deletion was requested. | User-driven cleanup can become evidence deletion without retention-policy checks. |
| Candidate archive client | `archiveTachoCandidateImport` calls `supabase.storage.from('tachograph-files').remove([storagePath])`. | Browser-side client performs physical deletion. |
| Purge RPC | `purge_company_driver_card_reads` deletes derived rows and then deletes rows from `tachograph_files`. | Import audit rows can be removed instead of retained as evidence metadata. |
| Purge client | `purgeCompanyDriverCardReads` can call `.remove(storagePaths)` when `deleteStorageFiles` is true. | Bulk physical deletion can occur outside a retention workflow. |
| Retention columns | `tachograph_files` does not have a verified policy-driven retention state in source-controlled migrations. | The system cannot prove whether deletion is allowed, blocked, archived, or on legal hold. |
| File integrity | `file_hash` is required by SOT but not verified as present in the current live schema. | Duplicate detection, integrity verification, and evidence traceability are incomplete. |

## Decision

For MVP, raw tachograph storage must fail closed.

Until a full retention workflow exists:

- keep `tachograph-files` private
- allow tenant-scoped insert for authorised upload flows
- allow tenant-scoped select/download for authorised users
- remove normal authenticated update policies
- remove normal authenticated delete policies
- stop browser-side physical deletion of raw files
- keep archive flows as metadata-only operations
- keep purge flows as derived-data cleanup only, not raw import row or object deletion
- route any future binary deletion through a service-role retention workflow with policy checks and audit logging

## Required Storage Policy Checks

Run these checks against the live Supabase database before writing or applying the storage hardening migration.

### Bucket Check

Expected:

- bucket exists
- bucket is private
- size limit is explicit
- allowed MIME types are constrained enough for tachograph upload handling

Example check:

```sql
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'tachograph-files';
```

Failing conditions:

- no `tachograph-files` bucket exists
- `public = true`
- unrestricted file size without documented reason
- broad MIME allow-list without parser safety controls

### Object Policy Check

Expected MVP policies:

| Operation | Normal authenticated users | Service role / controlled workflow |
| --- | --- | --- |
| `insert` | Allowed only for authorised fleet manager/helper upload paths. | Allowed. |
| `select` | Allowed only for authorised same-fleet reads. | Allowed. |
| `update` | Denied. | Allowed only through controlled retention/admin workflow if ever required. |
| `delete` | Denied. | Allowed only through controlled retention workflow after policy checks. |

Example policy inventory:

```sql
select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and (
    qual ilike '%tachograph-files%'
    or with_check ilike '%tachograph-files%'
  )
order by policyname;
```

Failing conditions:

- any `update` policy allows `authenticated` users to modify `tachograph-files`
- any `delete` policy allows `authenticated` users to delete `tachograph-files`
- any policy permits cross-tenant access by path manipulation
- path policy does not validate the first folder segment against the actor's company/fleet
- support/admin access is implied rather than explicitly modelled and audited

## Required Database Row Checks

Raw evidence rows must remain even if derived analysis rows are reset.

Expected:

- `tachograph_files` rows are not hard-deleted during normal manager workflows
- storage metadata is preserved
- retention state is explicit
- file hash is present for retained files after backfill
- deletion metadata is recorded only after a policy-approved retention operation

Minimum row fields to add or verify:

| Field | Requirement |
| --- | --- |
| `storage_bucket` | Required, default `tachograph-files`. |
| `file_path` or `storage_path` | Required for retained binary objects. |
| `file_hash` | Required after backfill. |
| `uploaded_by` | Required where actor is known. |
| `uploaded_at` | Required. |
| `retention_state` | Required, default `active` or `retained`. |
| `retain_until` | Nullable until policy is configured. |
| `legal_hold` or `legal_hold_id` | Nullable, but deletion must check it. |
| `archived_at` | Nullable, set only by archive workflow. |
| `deleted_at` | Nullable, set only after binary deletion. |
| `deleted_by` | Nullable, service/user actor that performed deletion. |
| `deletion_reason` | Nullable, required when deleted. |
| `deletion_policy_ref` | Nullable, required when deleted under retention policy. |

Example schema inventory:

```sql
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'tachograph_files'
order by ordinal_position;
```

Failing conditions:

- normal archive/purge workflows hard-delete `tachograph_files`
- retained rows have no stable storage path
- retained rows have no hash after backfill
- deletion state exists only in unstructured metadata JSON
- legal hold/report/evidence dependencies cannot block deletion

## Required RPC Checks

### `archive_tacho_candidate_import`

Required change:

- remove or ignore `p_delete_storage_file` until retention workflow exists
- archive candidate imports by metadata/status only
- preserve `tachograph_files` row
- preserve storage object
- record actor, reason, and timestamp

Failing conditions:

- returns `storageDeleteRequested = true`
- encourages client-side storage deletion
- updates metadata to say the object was deleted without service-side proof

### `confirm_tacho_candidate_import_storage_deleted`

Required change:

- deprecate for normal manager use
- replace with retention workflow confirmation if binary deletion is later implemented
- require policy reference and audit event

Failing conditions:

- executable by normal authenticated manager without retention-policy validation
- records deletion confirmation for client-side deletion

### `prepare_tacho_import_reprocess`

Required behaviour:

- may clear derived rows
- must not delete raw file storage object
- must not delete `tachograph_files`
- must create a new parser run when `PARSE-001` is implemented

Current behaviour is directionally acceptable for raw file preservation but still needs parser-run versioning alignment.

### `purge_company_driver_card_reads`

Required change:

- restrict to dry-run or derived-row cleanup until retention workflow exists
- do not hard-delete `tachograph_files`
- do not return storage paths for client-side deletion
- if fleet offboarding requires deletion, route through policy-driven retention/offboarding workflow

Failing conditions:

- deletes from `public.tachograph_files`
- returns `storagePaths` intended for browser-side `.remove()`
- allows linked evidence deletion without report/evidence/legal-hold dependency checks

## Required Client Checks

Search criteria:

```powershell
Select-String -Path 'src/**/*.ts','src/**/*.tsx' -Pattern "tachograph-files|storage\\.from\\('tachograph-files'\\)|\\.remove\\("
```

Current failing call sites:

| File | Issue |
| --- | --- |
| `src/lib/tacho/api.ts` | `archiveTachoCandidateImport` deletes a single raw object through `.remove([storagePath])`. |
| `src/lib/tacho/api.ts` | `purgeCompanyDriverCardReads` bulk deletes raw objects through `.remove(storagePaths)`. |

Required app behaviour:

- remove raw storage delete options from normal manager UI flows
- rename candidate cleanup actions to make clear they archive analysis state, not raw evidence
- display retention state instead of offering direct delete
- require a future retention/offboarding workflow for binary deletion

## Required Migration Shape

The hardening migration should do the following after live schema verification:

1. Drop `Managers can update tachograph files` on `storage.objects`.
2. Drop `Managers can delete tachograph files` on `storage.objects`.
3. Recreate only `insert` and `select` policies for authenticated same-fleet access.
4. Add or verify `tachograph_files` retention/integrity columns.
5. Backfill `storage_bucket`, `file_hash`, `retention_state`, and path aliases.
6. Replace hard-delete purge behaviour with metadata state transitions.
7. Replace candidate storage deletion with metadata-only archive.
8. Add audit logging for archive, reprocess, retention-blocked, and retention-deleted events.
9. Add tests that prove manager clients cannot update/delete objects in `tachograph-files`.

Do not add a permissive service-role deletion RPC until retention policy, legal hold, evidence dependency checks, audit logging, and report snapshot behaviour are implemented.

## Required Automated Tests

Add these to the MVP security test suite.

| Test ID | Scenario | Expected result |
| --- | --- | --- |
| `STOR-IMM-001` | Manager uploads raw tachograph file to own company path. | Allowed. |
| `STOR-IMM-002` | Manager reads raw tachograph file from own company path. | Allowed. |
| `STOR-IMM-003` | Manager uploads raw tachograph file to another company path. | Denied. |
| `STOR-IMM-004` | Manager reads raw tachograph file from another company path. | Denied. |
| `STOR-IMM-005` | Manager overwrites existing raw tachograph object. | Denied. |
| `STOR-IMM-006` | Manager deletes raw tachograph object. | Denied. |
| `STOR-IMM-007` | Candidate archive with delete option requested. | Raw object remains; row records metadata-only archive. |
| `STOR-IMM-008` | Purge driver-card reads for a company. | Derived rows may be cleared; raw object and import row remain. |
| `STOR-IMM-009` | Retained file without hash after backfill. | Test fails. |
| `STOR-IMM-010` | Retention delete attempted while file is linked to report/evidence/legal hold. | Denied and audited. |

## Implementation Gates

`IMP-002` is a planning task and does not apply the migration.

Implementation may begin only after:

- live storage policies are inventoried
- live `tachograph_files` columns are inventoried
- product confirms whether candidate/no-hire card reads are evidence while retained
- legal/compliance confirms default retention minimums
- `SEC-002` converts these checks into an RLS/storage migration
- `TEST-001` adds cross-tenant storage and row access regression tests

## Acceptance Criteria For `IMP-002`

- Current storage immutability conflicts are documented.
- Required live SQL checks are defined.
- Required RPC and client checks are defined.
- Required migration shape is defined.
- Required automated tests are defined.
- Security, retention, and implementation gates are explicit.
- Source-of-truth changelog and completion plan are updated.

