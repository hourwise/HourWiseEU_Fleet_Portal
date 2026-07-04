# Secure Upload To Timeline Acceptance And Rollback

Date: 2026-07-02
Status: Complete
Milestone: `Secure Upload to Timeline`

## Purpose

Define the acceptance criteria, test gates, release gates, and rollback strategy for the first HourWise MVP implementation milestone.

This document turns the source-of-truth governance work into a buildable milestone contract.

Related documents:

- [SOT-10 MVP](source-of-truth/10%20%E2%80%94%20Minimum%20Viable%20Product%20%28MVP%29.md)
- [SOT-15 Platform Architecture](source-of-truth/15%20%E2%80%94%20Platform%20Architecture.md)
- [SOT-18.3 Evidence Import Pipeline](source-of-truth/18.3%20%E2%80%94%20Evidence%20Import%20Pipeline.md)
- [SOT-18.6 Timeline Engine](source-of-truth/18.6%20%E2%80%94%20Timeline%20Engine.md)
- [SOT-21 Data Model](source-of-truth/21%20%E2%80%94%20Data%20Model%20Specification.md)
- [SOT-22 Security Model](source-of-truth/22%20%E2%80%94%20Security%20Model%20Specification.md)
- [SOT-24 Architecture Decision Records](source-of-truth/24%20%E2%80%94%20Architecture%20Decision%20Records.md)
- [Import Batch/File Schema Delta](import-batch-file-schema-delta-2026-07-02.md)
- [Raw Tachograph Storage Immutability Checks](raw-tachograph-storage-immutability-checks-2026-07-02.md)
- [Process Tacho Parser Run Contract](process-tacho-parser-run-contract-2026-07-02.md)
- [Timeline Event MVP Schema And Read Model](timeline-event-mvp-schema-read-model-2026-07-02.md)

## Milestone Statement

An authenticated fleet manager can upload a driver-card or vehicle-unit tachograph file, have it stored as immutable private evidence, process it through a versioned parser run, derive normalised activity and timeline events, and view the resulting timeline in the Fleet Portal without exposing data across tenants.

## In Scope

| Area | In scope |
| --- | --- |
| Authentication | Manager-only upload and read flows for a user's own fleet/company. |
| Upload | Browser-assisted upload to private `tachograph-files` storage. |
| Evidence | Raw file metadata, hash, storage path, uploader, upload timestamp, and retention state. |
| Import records | MVP-compatible import batch/import file records using the accepted `tachograph_files` bridge. |
| Parser | Versioned parser run lifecycle with status, timing, warnings, errors, and parser identity. |
| Parser output | Relational derived rows plus bounded JSONB diagnostics where required. |
| Timeline | Current MVP timeline generation, events, event sources, gaps, and daily summaries. |
| UI | Fleet Portal read view for upload status, parser status, and timeline events. |
| Security | Tenant-scoped RLS/storage/API checks and regression coverage. |
| Observability | Audit/metadata events for upload, processing, failure, reprocess, and timeline generation. |

## Out Of Scope

| Area | Reason |
| --- | --- |
| Compliance outcomes | Built after timeline generation is stable. |
| Evidence packs | Built after compliance outcomes exist. |
| Report exports | Built after evidence snapshot integrity is proven. |
| Atlas timeline explanations | Built after evidence retrieval and permission model are stable. |
| Automated retention deletion | Requires legal/policy defaults and explicit retention workflow. |
| Full driver app timeline UI | Fleet Portal timeline is the MVP validation surface. |
| Real binary fixture library expansion | Requires anonymisation, licensing, retention, and fixture storage decisions. |

## Capability Mapping

| Capability area | Capability IDs / source |
| --- | --- |
| File storage | `CORE-004`, `SOT-18.3`, `SOT-21` |
| Audit trail | `CORE-005`, `SOT-22` |
| Security model | `SYS-001`, `SOT-22`, `ADR-0002`, `ADR-0018` |
| File processing | `SYS-004`, `SOT-18.3`, `ADR-0003`, `ADR-0016` |
| Compliance evidence | `CMP-004`, `SOT-18.6`, `ADR-0017` |
| Fleet Portal | `FLT` capability area, `SOT-17` |

## Acceptance Criteria

### Upload And Evidence

- A same-company authenticated manager can upload a supported driver-card or vehicle-unit file.
- An unauthenticated user cannot upload.
- A driver cannot upload through the manager-only Fleet Portal upload path.
- A manager cannot upload into another company's storage folder.
- The raw file is stored in the private `tachograph-files` bucket.
- The raw file is not publicly readable.
- Normal authenticated clients cannot overwrite or delete raw tachograph objects after upload.
- The import record stores tenant/company, uploader, original filename, storage bucket/path, file type, file size where available, hash where available, upload timestamp, status, and metadata.
- Duplicate file handling is deterministic and does not overwrite the original evidence.
- Candidate/no-hire cleanup archives metadata only unless a policy-approved retention workflow exists.

### Parser Run

- Processing creates a parser run before parsing starts.
- Parser run records parser name, parser version, source/import ID, company ID, status, started timestamp, completed timestamp, duration, warnings, errors, and config/metadata.
- Successful processing ends in `completed` or `completed_with_warnings`.
- Unsupported or malformed files end in `unsupported` or `failed` with stable error details.
- Reprocessing creates a new parser run and preserves previous parser run history.
- Parser output is traceable to the raw import and parser run.
- Operationally important parser output is relational, not JSON-only.

### Timeline

- Processing creates or updates a current timeline generation.
- Timeline events are generated from relational normalised activity/technical event sources, not directly from raw parser JSON.
- Timeline events include tenant/company, driver and/or vehicle, event type, start/end time, duration, confidence, status, generation ID, source summary, import ID, and parser run reference where available.
- Timeline event source rows link events back to source rows and imports.
- Timeline gaps are created for unresolved missing/conflicting evidence without inventing facts.
- Daily timeline summaries are available for the UI.
- Regeneration supersedes prior current generations only after the new generation completes.
- Superseded timeline generations remain available when referenced by review, compliance, evidence, Atlas, or report records.

### Fleet Portal UI

- A manager can see upload/import status.
- A manager can see parser status, warnings, and failures in understandable language.
- A manager can see current timeline events for the uploaded driver/vehicle/import.
- The UI distinguishes raw evidence, parser output, timeline events, and gaps.
- The UI does not expose raw storage paths or sensitive internal diagnostics to unauthorised users.
- Empty, partial, failed, and unsupported states have explicit user-facing messages.
- The UI does not offer raw evidence deletion as a normal manager action.

### Security

- RLS is enabled and explicit for all MVP import/parser/timeline tables.
- Storage policies are private and tenant-scoped.
- Server-side RPCs check company/fleet scope and relevant actor role.
- Service-role operations perform explicit permission checks before acting on user-provided IDs.
- Cross-tenant reads fail for import records, parser runs, timeline events, timeline gaps, and storage objects.
- Cross-tenant writes fail for upload/import/parser/timeline workflows.
- Audit metadata records sensitive actions without leaking secrets.

### Observability

- Upload failure, parser failure, parser warning, timeline generation failure, and reprocess states are visible to support/manager workflows.
- Parser and timeline generation records preserve enough metadata to debug failed files without relying only on edge logs.
- Test fixtures cover successful, partial, failed, malformed, and cross-tenant denial paths.

## Required Tests

| Test area | Required coverage |
| --- | --- |
| Unit | Parser fixture regression tests, timeline mapping tests, status mapping tests, metadata adapters. |
| Security static | Migration/client regressions for tenant-scoped upload/read and RPC company/entity scoping. |
| Security runtime | Supabase RLS/storage tests for cross-tenant upload/read/write denial. |
| Integration | Upload record creation, parser run lifecycle, derived rows, timeline generation, UI bundle read model. |
| E2E/manual | Manager uploads file, observes processing, sees timeline, and cannot access another tenant's data. |
| Regression | Reprocess creates new parser run and new timeline generation without deleting historical run records. |

## Release Gates

Do not release this milestone until:

- all required migrations are reversible or have documented forward-fix rollback
- local and CI tests pass
- cross-tenant runtime security tests pass
- storage update/delete policies for raw tachograph evidence are locked down
- parser run history is preserved across reprocess
- timeline generation has current/superseded behaviour
- UI has tested loading, empty, partial, failed, and success states
- a seeded or fixture-backed demo path proves the full upload-to-timeline flow
- known limitations are documented in release notes

## Rollback Triggers

Rollback or disable the milestone if any of these occur:

- cross-tenant read or write is possible
- raw tachograph object can be overwritten or deleted by normal authenticated users
- parser reprocessing deletes parser run history
- timeline regeneration silently overwrites a timeline version used by downstream evidence/review/report records
- upload creates orphaned storage objects without import records
- import records point to missing raw objects unexpectedly
- parser failures leave imports stuck in `processing` without observable recovery
- UI exposes another tenant's import, parser, or timeline data
- migration causes data loss in `tachograph_files`, parser history, storage metadata, or derived records

## Rollback Strategy

### Feature Flags And Operational Disablement

- Disable new tachograph uploads in the Fleet Portal.
- Disable automatic processing trigger dispatch.
- Disable timeline generation jobs.
- Leave read-only access to existing safe records where tenant boundaries are confirmed.
- Keep raw storage objects and import metadata intact.

### Database Rollback

- Prefer forward-fix migrations for production once data exists.
- If pre-production, roll back newly added timeline/parser tables only after confirming no referenced evidence depends on them.
- Never hard-delete raw tachograph files as part of rollback.
- Never delete historical parser runs or timeline generations that may be referenced.
- If a new migration is faulty, add a corrective migration that:
  - revokes unsafe policies
  - disables unsafe RPCs
  - marks unsafe generated rows as `superseded`, `failed`, or `quarantined`
  - preserves source evidence and audit metadata

### Storage Rollback

- Keep `tachograph-files` private.
- Revoke unsafe update/delete policies immediately.
- Preserve uploaded objects, even if processing is disabled.
- Reconcile orphaned objects by creating quarantine metadata rows or adding support-only cleanup records.

### Application Rollback

- Hide upload and reprocess controls.
- Keep import/timeline views read-only if safe.
- Show operational banner for paused processing.
- Preserve manager visibility of already-created imports and failures.

### Recovery After Rollback

- Run integrity checks for storage object to import row matching.
- Run tenant isolation tests.
- Run parser fixture regression tests.
- Run timeline generation regression tests.
- Re-enable processing only after unsafe policies/RPCs/migrations are corrected and verified.

## Implementation Sequence

1. Verify live schema and policies.
2. Add or harden storage/RLS policies.
3. Add import/schema bridge migrations.
4. Add parser run lifecycle migration and function changes.
5. Add timeline generation schema and generator.
6. Add UI read model/RPCs.
7. Add runtime security tests.
8. Add integration tests for upload-to-timeline.
9. Run release gates.
10. Enable for internal/test fleets before broader release.

## Definition Of Done

This milestone is done when:

- acceptance criteria pass
- release gates pass
- rollback strategy is documented and operationally executable
- source-of-truth changelog is updated
- implementation tasks reference this milestone contract

