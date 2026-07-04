# Live Schema And Policy Verification

Date: 2026-07-02
Task: `DATA-002`
Status: Complete with implementation blockers found

## Purpose

Verify the live Supabase schema and policies before implementing the `Secure Upload to Timeline` milestone.

This task is required because the implementation plan depends on knowing the real hosted database state, not only the source-controlled migration files.

Related documents:

- [Secure Upload To Timeline Acceptance And Rollback](secure-upload-to-timeline-acceptance-rollback-2026-07-02.md)
- [MVP Data Model Migration Reconciliation](data-model-mvp-migration-reconciliation-2026-07-02.md)
- [Security/RLS Reconciliation](security-rls-reconciliation-2026-07-02.md)
- [Import Batch/File Schema Delta](import-batch-file-schema-delta-2026-07-02.md)
- [Raw Tachograph Storage Immutability Checks](raw-tachograph-storage-immutability-checks-2026-07-02.md)
- [Process Tacho Parser Run Contract](process-tacho-parser-run-contract-2026-07-02.md)
- [Timeline Event MVP Schema And Read Model](timeline-event-mvp-schema-read-model-2026-07-02.md)

## Verification Result

Live verification is unblocked by manual Supabase Dashboard export.

The Supabase CLI linked dump path still requires Docker in the local environment, but the required live evidence was captured manually and split into usable artifacts.

## Captured Evidence

| Artifact | Source | Purpose | Result |
| --- | --- | --- | --- |
| `supabase/.temp/live-schema-policy-dump-2026-07-02.sql` | Manual Supabase export plus appended JSON query results | Original combined capture | Present, non-empty |
| `supabase/.temp/live-schema-only-2026-07-02.sql` | Extracted from combined capture | Valid SQL schema-only reference for `public` and `storage` | Present |
| `supabase/.temp/live-policies-2026-07-02.json` | Extracted from appended `pg_policies` JSON | Live policy inventory | 100 records |
| `supabase/.temp/live-rls-status-2026-07-02.json` | Extracted from appended RLS JSON | Live RLS enabled/forced status | 54 records |
| `supabase/.temp/live-storage-buckets-2026-07-02.json` | Extracted from appended storage bucket JSON | Live bucket inventory | 7 records |

Extraction summary:

| Item | Count / Value |
| --- | ---: |
| Schema-only bytes | 45,609 |
| Live policy records | 100 |
| Live RLS records | 54 |
| Live storage buckets | 7 |
| Tachograph/import-related policy records | 8 |
| Tachograph storage buckets | 1 |

## Tooling Note

The preferred CLI command was attempted:

```powershell
.\supabase.exe db dump --linked --schema public,storage --file supabase/.temp/live-schema-policy-dump-2026-07-02.sql
```

Result:

- Supabase CLI was installed and authenticated.
- The linked dump workflow failed because Docker Desktop is not installed/running.
- Local `pg_dump`, `psql`, and Docker CLI were unavailable.

The manual export is therefore the evidence source for this reconciliation.

## Live Tachograph Schema Inventory

The live schema contains the core legacy and MVP tachograph tables needed for the current bridge strategy.

| Table | Live status | Notes |
| --- | --- | --- |
| `tachograph_files` | Present | Existing MVP compatibility bridge for raw/import metadata. |
| `tachograph_activities` | Present | Legacy/compatibility activity table linked to `tachograph_files`. |
| `tachograph_speed_logs` | Present | Legacy/compatibility speed log table linked to `tachograph_files`. |
| `tachograph_processing_runs` | Present | Existing parser run table, but shape is thinner than milestone contract. |
| `driver_card_downloads` | Present | Derived driver-card download metadata. |
| `vehicle_unit_downloads` | Present | Derived vehicle-unit download metadata. |
| `tachograph_activity_segments` | Present | Normalised activity segment target. |
| `tachograph_day_summaries` | Present | Day summary target. |
| `tachograph_findings` | Present | Finding/compliance-adjacent derived target. |
| `tachograph_technical_events` | Present | Technical event target. |
| `driver_tacho_compliance_signals` | Present | Existing compliance signal surface. |
| `driver_tacho_risk_signals` | Present | Existing risk signal surface. |
| `tachograph_vehicle_motion_discrepancies` | Present | Derived discrepancy target. |
| `tachograph_reconciliation_items` | Present | Derived reconciliation target. |
| `tachograph_finding_reviews` | Present | Review workflow table. |
| `tachograph_finding_review_events` | Present | Review audit/event table. |
| `tacho_activities` | Present | Older legacy surface with explicit policies. |
| `tacho_infringements` | Present | Older legacy surface; include in migration strategy. |

Important live schema deltas:

- `tachograph_files` exists live even though its base creation was not visible in the source-controlled migration inventory.
- `tachograph_processing_runs` exists but does not yet satisfy the full milestone contract for status lifecycle, parser identity, timing, and traceability.
- No current `timeline_events`, `timeline_event_sources`, `timeline_generations`, `timeline_gaps`, or `timeline_day_summaries` table was found in the captured live schema.

## Live Storage Inventory

The required tachograph bucket exists.

| Bucket | Public | File size limit | Allowed MIME types | Assessment |
| --- | --- | ---: | --- | --- |
| `tachograph-files` | `false` | 104,857,600 | `application/octet-stream` | Correct private raw tachograph bucket baseline. |

Other live buckets:

- `defect-photos`
- `driver-documents`
- `logos`
- `maintenance-docs`
- `receipts`
- `vehicle-documents`

Storage assessment:

- The `tachograph-files` bucket is private.
- The file size limit is appropriate for large tachograph evidence files.
- The allowed MIME type is narrow, which is safer than accepting arbitrary uploads.
- Bucket configuration alone is not enough; `storage.objects` policies still need hardening.

## Live RLS Inventory

RLS is enabled for all captured tachograph-related tables.

| Table group | RLS status |
| --- | --- |
| `tachograph_files` | Enabled |
| `tachograph_activities`, `tachograph_speed_logs`, `tacho_activities`, `tacho_infringements` | Enabled |
| `tachograph_processing_runs` | Enabled |
| `driver_card_downloads`, `vehicle_unit_downloads` | Enabled |
| `tachograph_activity_segments`, `tachograph_day_summaries` | Enabled |
| `tachograph_findings`, `tachograph_technical_events` | Enabled |
| `driver_tacho_compliance_signals`, `driver_tacho_risk_signals` | Enabled |
| `tachograph_vehicle_motion_discrepancies`, `tachograph_reconciliation_items` | Enabled |
| `tachograph_finding_reviews`, `tachograph_finding_review_events` | Enabled |
| `storage.objects` | Enabled |

No captured table has forced RLS enabled. That is acceptable for normal Supabase application access but means service-role paths must continue to enforce explicit permission checks in code/RPCs.

## Live Policy Inventory

Tachograph/import-related live policies captured:

| Schema | Table | Policy | Command | Assessment |
| --- | --- | --- | --- | --- |
| `public` | `tacho_activities` | `Drivers read own tacho` | `SELECT` | Legacy driver self-read policy. |
| `public` | `tacho_activities` | `Managers manage tacho` | `ALL` | Legacy manager all-operation policy. |
| `public` | `tachograph_files` | `Managers can view company tacho files` | `ALL` | Name says view, command is `ALL`; permits broader operations than the milestone should allow from normal clients. |
| `public` | `tachograph_finding_reviews` | `Drivers can read own tacho finding reviews` | `SELECT` | Read-only driver review visibility. |
| `public` | `tachograph_finding_reviews` | `Managers can read company tacho finding reviews` | `SELECT` | Read-only manager review visibility. |
| `public` | `tachograph_finding_review_events` | `Drivers can read own tacho review events` | `SELECT` | Read-only driver review event visibility. |
| `public` | `tachograph_finding_review_events` | `Managers can read company tacho review events` | `SELECT` | Read-only manager review event visibility. |
| `storage` | `objects` | `Managers can delete tachograph files` | `DELETE` | Conflicts with raw evidence immutability milestone gate. |

Notable omissions in captured live policies:

- No explicit `storage.objects` `INSERT` policy for `tachograph-files`.
- No explicit `storage.objects` `SELECT` policy for `tachograph-files`.
- No explicit `storage.objects` `UPDATE` policy for `tachograph-files`, which is good for immutability.
- A live `storage.objects` `DELETE` policy exists for `tachograph-files`, which conflicts with the milestone rollback and release gates.
- Most new normalised tachograph tables have RLS enabled but no captured explicit authenticated policies. They are therefore protected by default, but authenticated client read/write flows will require RPCs or explicit tenant-scoped policies.

## Implementation Blockers Found

These issues must be resolved before enabling the `Secure Upload to Timeline` milestone:

1. Revoke or replace the live `storage.objects` delete policy for `tachograph-files`.
2. Add a tenant-scoped manager upload path for `tachograph-files` that does not allow overwrite.
3. Add a tenant-scoped manager read/download path for `tachograph-files` only if raw downloads are intended for MVP; otherwise keep raw evidence read server-mediated only.
4. Replace or narrow the `tachograph_files` `ALL` policy because the current policy name says view but the command permits all operations.
5. Add explicit tenant-scoped access strategy for `tachograph_processing_runs`, derived parser output tables, and future timeline tables.
6. Extend `tachograph_processing_runs` or add a compatible migration so parser run lifecycle satisfies the milestone contract.
7. Add timeline generation/event/source/gap/read-model schema because no live timeline event model was found.

## Migration Strategy Implications

The live state supports the existing bridge decision:

- Keep `tachograph_files` as the MVP compatibility bridge for import file metadata.
- Do not create a competing `import_files` table in the first milestone unless a migration/backfill plan is explicitly approved.
- Add forward-fix migrations that harden storage/RLS and extend parser/timeline schema without deleting live tachograph data.

Recommended migration order:

1. Storage policy hardening for `tachograph-files`.
2. `tachograph_files` RLS policy narrowing.
3. Parser run lifecycle extension or compatible companion table.
4. Timeline generation/event/source/gap/read-model tables.
5. Tenant-scoped RPCs/read bundles for Fleet Portal timeline UI.
6. Runtime security tests against live-equivalent policy behaviour.

## Implementation Gate

`DATA-002` no longer blocks implementation planning.

Implementation migrations may begin only for the blocker-remediation path above. The first migration should not add timeline features before storage/RLS hardening is addressed, because the live state currently allows manager deletion of raw tachograph storage objects and has an overly broad `tachograph_files` policy.

## Current Recommendation

Proceed to `SEC-002`: design and implement the storage/RLS hardening migration for `tachograph-files` and related raw import metadata.

Acceptance for the next task:

- `tachograph-files` remains private.
- Normal authenticated users cannot update or delete raw tachograph objects.
- Managers can upload only into their own company folder.
- Managers can read only their own company tachograph metadata.
- Cross-tenant upload/read/delete attempts fail.
- Existing raw objects and `tachograph_files` rows are preserved.
