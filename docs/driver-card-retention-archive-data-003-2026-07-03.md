# Driver Card Retention Archive

Date: 2026-07-03
Task: `DATA-003`
Status: Complete

## Purpose

Convert destructive driver-card purge/reset flows into retention-state/archive-only workflows before parser and timeline feature migrations begin.

Related documents:

- [Storage And RLS Hardening](storage-rls-hardening-sec-002-2026-07-03.md)
- [Live Schema And Policy Verification](live-schema-policy-verification-data-002-2026-07-02.md)
- [Raw Tachograph Storage Immutability Checks](raw-tachograph-storage-immutability-checks-2026-07-02.md)
- [Secure Upload To Timeline Acceptance And Rollback](secure-upload-to-timeline-acceptance-rollback-2026-07-02.md)

## Implementation Summary

Added forward-fix migration:

- `supabase/migrations/20260703103000_archive_driver_card_reset_flows.sql`

Updated application code:

- `src/lib/tacho/api.ts`
- `src/lib/tacho/adapters.ts`
- `src/components/manager/tachograph/TachoImportCentre.tsx`
- `src/lib/tacho/securityRegression.test.ts`

## Behaviour Changes

### Company Driver-Card Reset

The existing `purge_company_driver_card_reads` RPC name is retained for compatibility, but behaviour is now archive-only.

The RPC no longer deletes:

- `tachograph_files`
- raw `tachograph-files` storage objects
- `tachograph_activities`
- `tachograph_speed_logs`
- `driver_card_downloads`
- `tachograph_activity_segments`
- `tachograph_day_summaries`
- `tachograph_findings`
- `tachograph_technical_events`
- `tachograph_reconciliation_items`
- `tachograph_vehicle_motion_discrepancies`
- `tachograph_processing_runs`
- `driver_tacho_compliance_signals`
- `driver_tacho_risk_signals`

Instead, matching `tachograph_files` rows receive metadata markers:

- `driver_card_retention_state = archived`
- `driver_card_purge_archived_at`
- `driver_card_purge_archived_by_user_id`
- `driver_card_purge_archive_reason`
- `driver_card_purge_strategy = archive_only_preserve_rows`
- `driver_card_purge_existing_rows_retained = true`
- `driver_card_purge_storage_objects_retained = true`
- `helper_capture_active_analysis_rows = false`

### Reprocess Preparation

The existing `prepare_tacho_import_reprocess` RPC name is retained for compatibility.

It no longer clears derived rows or parser run history before retry. It records:

- `manager_reprocess_requested_at`
- `manager_reprocess_requested_by_user_id`
- `manager_reprocess_reason`
- `manager_reprocess_strategy = archive_only_preserve_existing_rows`
- `manager_reprocess_existing_rows_retained = true`

Parser run versioning remains a follow-up task.

### Import Centre UI

The reset panel now presents archive language instead of delete language.

The confirmation phrase changed from `DELETE CARD READS` to `ARCHIVE CARD READS`.

Archived driver-card reads are hidden by the existing queue filter because the adapter now maps `driver_card_purge_archived_at` to `archivedAt`.

## Acceptance Mapping

| Acceptance item | Status |
| --- | --- |
| Driver-card reset does not delete raw storage objects | Complete |
| Driver-card reset does not delete import rows | Complete |
| Driver-card reset does not delete derived rows | Complete |
| Driver-card reset does not delete parser run history | Complete |
| Driver-card reset does not delete driver signal history | Complete |
| Reset rows are hidden from normal queue by archive metadata | Complete |
| Archived rows remain visible through existing audit-row toggle | Complete |
| Reprocess preparation preserves existing rows | Complete |
| Static regression tests guard against reintroducing destructive deletes | Complete |

## Known Follow-Ups

1. `PARSE-002`: extend parser run lifecycle schema so reprocessing creates a distinct versioned parser run and marks current/superseded state explicitly.
2. `TIME-002`: add timeline generation/event/source/gap schema once parser runs are version-safe.
3. `SEC-003`: add runtime Supabase policy tests once Docker/Postgres tooling is available.

## Verification

Static regression tests were updated to assert:

- the new driver-card reset migration contains no `delete from public.*` statements
- the reset RPC archives rows through metadata
- reprocess preparation preserves existing parser/derived rows
- adapter maps `driver_card_purge_archived_at` into `archivedAt`
- the Import Centre exposes archive wording and no destructive reset wording
