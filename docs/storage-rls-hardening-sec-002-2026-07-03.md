# Storage And RLS Hardening

Date: 2026-07-03
Task: `SEC-002`
Status: Complete

## Purpose

Implement the first security remediation from `DATA-002`: harden raw tachograph storage and related import metadata access before timeline feature migrations begin.

Related documents:

- [Live Schema And Policy Verification](live-schema-policy-verification-data-002-2026-07-02.md)
- [Secure Upload To Timeline Acceptance And Rollback](secure-upload-to-timeline-acceptance-rollback-2026-07-02.md)
- [Raw Tachograph Storage Immutability Checks](raw-tachograph-storage-immutability-checks-2026-07-02.md)
- [Security/RLS Reconciliation](security-rls-reconciliation-2026-07-02.md)

## Implementation Summary

Added forward-fix migration:

- `supabase/migrations/20260703090000_harden_tachograph_storage_rls.sql`

Updated application code:

- `src/lib/tacho/api.ts`
- `src/components/manager/tachograph/TachoImportCentre.tsx`
- `src/lib/tacho/securityRegression.test.ts`

## Policy Changes

Storage bucket:

- Keeps `tachograph-files` private.
- Keeps file size limit at `104857600`.
- Keeps allowed MIME types limited to `application/octet-stream`.

Storage object policies:

- Drops prior manager upload/read/update/delete policies for `tachograph-files`.
- Recreates manager insert policy scoped to the manager's own company folder.
- Recreates manager select policy scoped to the manager's own company folder.
- Does not recreate update or delete policies for normal authenticated users.

Import metadata policies:

- Drops the live broad `Managers can view company tacho files` `ALL` policy.
- Adds manager insert policy scoped to the user's own company.
- Adds manager select policy scoped to the user's own company.
- Does not add direct manager update/delete table policies.
- Adds `patch_tachograph_import_metadata` as a scoped security-definer RPC for browser upload kickoff metadata patches.

Raw identity immutability:

- Adds a `tachograph_files` update trigger.
- Normal authenticated updates cannot change raw identity fields:
  - `company_id`
  - `file_path`
  - `filename`
  - `file_type`
  - `uploaded_at`
  - `source_type`
- Service-role/admin operations remain available for controlled backend processing and repair.

## Application Changes

Browser-side deletion of raw tachograph storage objects was removed from tacho archive/purge helpers.

Candidate archive now retains storage objects and records metadata-only archive actions. The Import Centre no longer presents `Archive + Delete File` as a normal manager action.

Browser-side metadata patching now uses `patch_tachograph_import_metadata` instead of direct `.update()` calls against `tachograph_files`.

Bulk driver-card test reset now warns that raw tachograph storage objects are retained for audit. Database-row purge remains a separate retention-policy risk and should be handled in a later data-retention task.

## Acceptance Mapping

| Acceptance item | Status |
| --- | --- |
| `tachograph-files` remains private | Complete |
| Normal authenticated users cannot update raw tachograph storage objects | Complete |
| Normal authenticated users cannot delete raw tachograph storage objects | Complete |
| Managers can upload only into their own company folder | Complete |
| Managers can read only their own company storage objects | Complete |
| Managers can insert only their own company import metadata | Complete |
| Managers can read only their own company import metadata | Complete |
| Managers cannot directly update/delete import metadata rows through table policies | Complete |
| Browser upload metadata patching uses a scoped RPC | Complete |
| Raw import identity fields are immutable for normal authenticated updates | Complete |
| Existing raw objects and `tachograph_files` rows are preserved | Complete |

## Known Follow-Ups

`SEC-002` intentionally does not solve every retention issue.

Follow-up tasks:

1. `DATA-003`: convert destructive driver-card purge flows into retention-state/archive-only workflows.
2. `SEC-003`: add runtime Supabase policy tests against a local or hosted test project once Docker/Postgres tooling is available.
3. `PARSE-002`: extend parser run lifecycle schema after storage/RLS hardening is applied.

## Verification

Static regression tests were updated to assert:

- tachograph storage update/delete policies are dropped and not recreated
- insert/select storage policies are manager/company scoped
- `tachograph_files` no longer relies on a broad `ALL` policy
- browser metadata patching uses a scoped RPC instead of direct table updates
- raw import identity fields are protected by trigger
- browser-side storage deletion is not attempted for `tachograph-files`
