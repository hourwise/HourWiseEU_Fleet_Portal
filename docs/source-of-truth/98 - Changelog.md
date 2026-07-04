# 98 - Changelog

## 1. Purpose

This changelog records significant changes to the HourWise Source of Truth.

It exists to make product, architecture, security, and implementation-impact changes traceable over time.

Every significant change to HourWise should update:

- the affected source-of-truth document
- any affected dependency document
- any required Architecture Decision Record
- this changelog

Implementation should only begin after the source-of-truth change has been recorded here.

---

## 2. When To Add An Entry

Add a changelog entry when a change affects:

- product scope
- MVP scope
- capability definitions
- user journeys
- service blueprints
- platform architecture
- data model
- security model
- integrations
- reporting
- Atlas behaviour
- compliance interpretation
- ADR status or content
- implementation acceptance criteria
- migration or storage behaviour

Minor copy edits, spelling fixes, and formatting-only updates do not need a changelog entry unless they alter meaning.

---

## 3. Entry Template

Copy this template for future changes:

```md
## YYYY-MM-DD - Change Title

| Field | Value |
| --- | --- |
| Change ID | SOT-YYYY-MM-DD-001 |
| Status | Proposed / Accepted / Implemented / Superseded |
| Owner | Product Architecture / Platform Architecture / Security / Engineering |
| Summary | Short description of the change. |
| Reason | Why this change is needed. |
| Affected Source Documents | List document IDs and filenames. |
| Affected ADRs | List ADR IDs or `None`. |
| Capability IDs | List affected capability IDs or `None`. |
| Implementation Impact | None / Low / Medium / High |
| Database Impact | None / Migration Required / Data Backfill Required |
| Security Impact | None / Review Required / Security Gate Required |
| Testing Impact | None / Test Update Required / New Test Coverage Required |
| Rollback Notes | How to reverse or supersede this change if needed. |

### Details

Describe the actual source-of-truth change.

### Completion Checklist

- [ ] Relevant source-of-truth document updated
- [ ] Related documents updated
- [ ] ADR created or updated if required
- [ ] Implementation backlog updated if required
- [ ] Database migration impact assessed
- [ ] Security impact assessed
- [ ] Test impact assessed
```

---

## 4. Change Entries

## 2026-07-03 - Complete TIME-004 Timeline Bundle API Adapter

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-03-006 |
| Status | Implemented |
| Owner | Platform Architecture / Fleet Portal |
| Summary | Wired timeline bundle reads into the app/API adapter layer behind existing tachograph bundle fetchers. |
| Reason | Timeline generation needs application-layer verification before existing tachograph views are replaced with timeline-native rendering. |
| Affected Source Documents | `98 - Changelog.md`, `docs/timeline-bundle-api-adapter-time-004-2026-07-03.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0016`, `ADR-0017`, `ADR-0018` |
| Capability IDs | Timeline Engine, Fleet Portal, Import Management, Compliance Intelligence |
| Implementation Impact | Medium |
| Database Impact | None; depends on `20260703133000_add_timeline_generation_read_models.sql` being applied |
| Security Impact | Existing timeline RPC authorization applies |
| Testing Impact | Adapter and static API regression tests added |
| Rollback Notes | Remove optional timeline fetches from existing tachograph bundle fetchers; do not delete generated timeline history. |

### Details

Added typed timeline bundle structures, API helpers for import/driver/vehicle timeline bundle RPCs, and non-destructive comparison metadata attached to existing tachograph parser bundles.

Existing tachograph fetchers still call legacy bundle RPCs first. Timeline RPC failures are isolated and reported as comparison warnings so current views remain stable while timeline generation is verified.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-03 - Complete TIME-003 Timeline Generation Runtime

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-03-005 |
| Status | Implemented |
| Owner | Platform Architecture / Timeline Engine |
| Summary | Added import-scoped timeline generation from parser-derived tachograph rows and read-only timeline bundle RPCs. |
| Reason | The `Secure Upload to Timeline` milestone requires parser-derived rows to produce versioned timeline records with source links, gaps, daily summaries, and current/superseded generation state. |
| Affected Source Documents | `98 - Changelog.md`, `docs/timeline-generation-runtime-time-003-2026-07-03.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0016`, `ADR-0017`, `ADR-0018` |
| Capability IDs | Timeline Engine, Parser Pipeline, Import Management, Compliance Intelligence |
| Implementation Impact | High |
| Database Impact | Forward-fix read-model migration added |
| Security Impact | Security-definer RPCs include explicit manager/company checks |
| Testing Impact | Static timeline generation regression tests added |
| Rollback Notes | Prefer forward-fix rollback after timeline rows exist. Reverting runtime generation should not delete generated timeline audit history. |

### Details

Updated `process-tacho` so successful parser runs create import-scoped timeline generations from persisted parser-derived rows. Generated timeline data includes activity/technical events, event source links, vehicle/reconciliation gaps, and daily summaries, all tied to the current `parser_run_id`.

Added `supabase/migrations/20260703133000_add_timeline_generation_read_models.sql` with read-only import, driver, and vehicle timeline bundle RPCs.

Existing tachograph UI/API read paths are unchanged; the next task is adapter/UI integration behind existing views.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-03 - Complete TIME-002 Timeline Generation Schema

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-03-004 |
| Status | Implemented |
| Owner | Platform Architecture / Timeline Engine |
| Summary | Added the versioned timeline generation, event, source, gap, and daily summary schema required by the Secure Upload to Timeline milestone. |
| Reason | `ADR-0017` requires timeline events to be versioned derived records with source references, generation identity, current/superseded state, and gap tracking. |
| Affected Source Documents | `98 - Changelog.md`, `docs/timeline-generation-schema-time-002-2026-07-03.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0016`, `ADR-0017`, `ADR-0018` |
| Capability IDs | Timeline Engine, Parser Pipeline, Compliance Intelligence, Evidence Engine |
| Implementation Impact | High |
| Database Impact | Forward-fix migration added |
| Security Impact | Manager and driver read RLS added for timeline records |
| Testing Impact | Static timeline schema regression tests added |
| Rollback Notes | Prefer forward-fix rollback after timeline data exists. Dropping the new tables would discard derived timeline audit history. |

### Details

Added `supabase/migrations/20260703123000_add_timeline_generation_event_schema.sql`.

The migration creates `timeline_generations`, `timeline_events`, `timeline_event_sources`, `timeline_gaps`, and `daily_timeline_summaries`. It includes generation version/current/supersession fields, parser-run and parser-output references, source linkage, gap review states, daily summary fields, updated-at triggers, tenant read indexes, and explicit RLS.

This change is schema-only. Timeline generation workers and read-model RPCs remain a separate implementation task.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-03 - Complete PARSE-002 Parser Run Lifecycle Versioning

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-03-003 |
| Status | Implemented |
| Owner | Platform Architecture / Parser Pipeline |
| Summary | Extended parser-run lifecycle persistence so reprocessing creates distinct versioned runs and preserves parser-run history. |
| Reason | `ADR-0003`, `ADR-0016`, and the `Secure Upload to Timeline` milestone require parser executions, outputs, and errors to be traceable without deleting earlier parser-run audit records. |
| Affected Source Documents | `98 - Changelog.md`, `docs/parser-run-lifecycle-parse-002-2026-07-03.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0003`, `ADR-0016`, `ADR-0018` |
| Capability IDs | Parser Pipeline, Import Management, Compliance Intelligence, Timeline Engine |
| Implementation Impact | High |
| Database Impact | Forward-fix migration and backfill added |
| Security Impact | Manager read RLS added for parser diagnostics |
| Testing Impact | Static parser lifecycle regression tests added |
| Rollback Notes | Prefer forward-fix rollback. Do not drop new parser-run lifecycle columns after production writes unless parser audit data has been exported or confirmed disposable. |

### Details

Added `supabase/migrations/20260703113000_extend_parser_run_lifecycle.sql`.

The migration extends `tachograph_processing_runs` with lifecycle status, parser identity, timing, current/superseded state, and backfilled run sequence data. It also adds `tachograph_parser_outputs`, `tachograph_parser_errors`, and nullable `parser_run_id` links on derived tachograph tables where practical.

Updated `process-tacho` so parser runs are created before parsing starts and completed or failed in place. Reprocessing no longer deletes `tachograph_processing_runs`; older runs are marked non-current and linked from the new run through `supersedes_parser_run_id`.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-03 - Complete DATA-003 Driver Card Retention Archive

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-03-002 |
| Status | Implemented |
| Owner | Platform Architecture / Data |
| Summary | Converted destructive driver-card purge/reset flows into retention-state/archive-only workflows. |
| Reason | The `Secure Upload to Timeline` milestone requires raw imports, parser history, and derived evidence to be retained rather than deleted during reset/reprocess operations. |
| Affected Source Documents | `98 - Changelog.md`, `docs/driver-card-retention-archive-data-003-2026-07-03.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0017`, `ADR-0018` |
| Capability IDs | `CORE-004`, `CORE-005`, `SYS-001`, `SYS-004` |
| Implementation Impact | High |
| Database Impact | Forward-fix migration added |
| Security Impact | Evidence retention hardening |
| Testing Impact | Static security/data-retention regression tests updated |
| Rollback Notes | Reverting this change would reintroduce destructive purge/reset behaviour; use a forward-fix if archive metadata needs adjustment. |

### Details

Added `supabase/migrations/20260703103000_archive_driver_card_reset_flows.sql`.

The migration preserves existing RPC names for compatibility but changes `purge_company_driver_card_reads` and `prepare_tacho_import_reprocess` to retain raw storage, import rows, derived rows, parser runs, and driver signal history.

The Import Centre now presents archive/reset language instead of destructive delete language, and archived reset rows are hidden by the existing archive filter.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-03 - Complete SEC-002 Storage/RLS Hardening

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-03-001 |
| Status | Implemented |
| Owner | Platform Architecture / Security |
| Summary | Added the `SEC-002` forward-fix migration and client changes that harden `tachograph-files` storage and `tachograph_files` metadata policies. |
| Reason | `DATA-002` found a live storage delete policy and broad `tachograph_files` `ALL` policy that conflicted with the `Secure Upload to Timeline` raw evidence immutability gate. |
| Affected Source Documents | `98 - Changelog.md`, `docs/storage-rls-hardening-sec-002-2026-07-03.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0018` |
| Capability IDs | `CORE-004`, `CORE-005`, `SYS-001` |
| Implementation Impact | High |
| Database Impact | Forward-fix migration added |
| Security Impact | Storage/RLS hardening |
| Testing Impact | Static security regression tests updated |
| Rollback Notes | Reverting this hardening would re-open raw evidence deletion/update risk; rollback should instead use a forward-fix if policy text needs adjustment. |

### Details

Added `supabase/migrations/20260703090000_harden_tachograph_storage_rls.sql`.

The migration keeps `tachograph-files` private, recreates manager company-scoped storage insert/select policies, does not recreate storage update/delete policies, replaces the broad live `tachograph_files` `ALL` policy, adds a scoped metadata patch RPC, and adds a trigger to prevent normal authenticated users from mutating raw evidence identity fields.

Application code no longer attempts browser-side deletion from the `tachograph-files` bucket.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Complete DATA-002 Live Schema Verification

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-016 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Completed the `DATA-002` live schema/policy verification artifact using manual Supabase export evidence and recorded live storage/RLS blockers. |
| Reason | The `Secure Upload to Timeline` milestone requires live Supabase schema and policy verification before implementation migrations are safe; manual export evidence replaced the blocked Docker-dependent CLI dump path. |
| Affected Source Documents | `98 - Changelog.md`, `docs/live-schema-policy-verification-data-002-2026-07-02.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0003`, `ADR-0016`, `ADR-0017`, `ADR-0018` |
| Capability IDs | `CORE-004`, `CORE-005`, `SYS-001`, `SYS-004`, `CMP-004` |
| Implementation Impact | High |
| Database Impact | Migration Planning Unblocked For Storage/RLS Hardening |
| Security Impact | Security Gate Required |
| Testing Impact | Test Update Required |
| Rollback Notes | No schema rollback is required because no production migration was applied; next migration must remove unsafe raw storage delete access and narrow `tachograph_files` permissions. |

### Details

Attempted to create a linked Supabase schema dump for `public` and `storage`. The CLI path was blocked because the Supabase dump workflow requires Docker and Docker is unavailable in the current environment.

Manual Supabase Dashboard export evidence was captured instead, then split into schema-only SQL, policy JSON, RLS status JSON, and storage bucket JSON. The new `DATA-002` artifact records the live schema inventory, confirms the private `tachograph-files` bucket, and identifies policy blockers that must be fixed before timeline feature migrations begin.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Secure Upload To Timeline Acceptance And Rollback

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-015 |
| Status | Implemented |
| Owner | Product Architecture / Platform Architecture |
| Summary | Defined acceptance criteria, release gates, and rollback strategy for the `Secure Upload to Timeline` MVP milestone. |
| Reason | The source-of-truth completion plan requires the first milestone to have explicit acceptance criteria and rollback strategy before implementation work treats it as build-ready. |
| Affected Source Documents | `98 - Changelog.md`, `docs/secure-upload-to-timeline-acceptance-rollback-2026-07-02.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0003`, `ADR-0016`, `ADR-0017`, `ADR-0018` |
| Capability IDs | `CORE-004`, `CORE-005`, `SYS-001`, `SYS-004`, `CMP-004`, Fleet Portal capability area |
| Implementation Impact | High |
| Database Impact | Migration Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Use the milestone rollback strategy to disable upload/processing/timeline generation without deleting raw evidence, parser history, or timeline generations. |

### Details

Added a milestone contract for `Secure Upload to Timeline`.

The contract defines in-scope and out-of-scope work, capability mapping, acceptance criteria for upload/evidence/parser/timeline/UI/security/observability, required tests, release gates, rollback triggers, rollback steps, and implementation sequence.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Parser Fixture Regression Tests

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-014 |
| Status | Implemented |
| Owner | Engineering |
| Summary | Added parser fixture regression coverage for tachograph parser identities, outcomes, derived counts, warnings, and errors. |
| Reason | The MVP parser pipeline needs deterministic regression coverage before parser-run, timeline, compliance, and evidence migrations depend on parser output shape. |
| Affected Source Documents | `98 - Changelog.md`, `docs/parser-fixture-regression-tests-2026-07-02.md` |
| Affected ADRs | `ADR-0003`, `ADR-0016` |
| Capability IDs | Parser Pipeline, Import Management, Compliance Intelligence |
| Implementation Impact | Medium |
| Database Impact | None |
| Security Impact | None |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Remove only if replaced by stronger real binary parser fixture tests covering the same parser identities and output contracts. |

### Details

Added `src/lib/tacho/parserRegressionFixtures.ts` and `src/lib/tacho/parserRegressionFixtures.test.ts`, then included the test in `npm run test:rules`.

The fixture suite covers processed driver-card activity output, continuous-driving breach output, vehicle-unit cardless-driving and overspeed outputs, read-only helper capture partial output, and malformed parser-like timing failure output.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Cross-Tenant Upload/Read Regression Tests

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-013 |
| Status | Implemented |
| Owner | Security |
| Summary | Added Vitest regression coverage for tachograph cross-tenant storage upload/read policy boundaries and tacho read RPC scoping. |
| Reason | The MVP security gate requires tests that prevent regressions where uploads or reads can cross tenant boundaries. |
| Affected Source Documents | `98 - Changelog.md`, `docs/cross-tenant-upload-read-regression-tests-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0018` |
| Capability IDs | Security, Import Management, Compliance Intelligence |
| Implementation Impact | Medium |
| Database Impact | None |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Remove only if replaced by stronger runtime Supabase RLS/storage integration tests that cover the same upload/read boundaries. |

### Details

Added `src/lib/tacho/securityRegression.test.ts` and included it in `npm run test:rules`.

The tests statically verify that the `tachograph-files` upload/read storage policies are authenticated, manager-only, bucket-specific, and scoped by the actor's company folder. They also verify that driver, vehicle, and import tacho bundle reads remain scoped by company ID plus the relevant entity/import ID in both SQL and client RPC wiring.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Timeline Event MVP Schema And Read Model

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-012 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Defined the MVP schema, generation model, and UI read model for Timeline Events. |
| Reason | `SOT-18.6`, `SOT-21`, and `ADR-0017` require timeline events to be versioned derived records, but the current implementation only has tachograph-derived activity, summary, finding, and reconciliation tables. |
| Affected Source Documents | `98 - Changelog.md`, `docs/timeline-event-mvp-schema-read-model-2026-07-02.md` |
| Affected ADRs | `ADR-0016`, `ADR-0017`, `ADR-0018` |
| Capability IDs | Timeline Engine, Compliance Intelligence, Evidence Engine |
| Implementation Impact | High |
| Database Impact | Migration Required / Data Backfill Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede with a revised timeline migration plan if live schema verification or UI review requires a different read model. |

### Details

Added a timeline MVP document that defines `timeline_generations`, `timeline_events`, `timeline_event_sources`, `timeline_gaps`, and `daily_timeline_summaries`.

The document maps current tachograph-derived tables to timeline events, defines generation/version rules, provides the `timeline-mvp-1` UI read model, lists indexes and RLS expectations, and sets migration/test gates.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Process Tacho Parser Run Contract

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-011 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Mapped the current `process-tacho` edge function and `tachograph_processing_runs` table to the source-of-truth parser run contract. |
| Reason | `ADR-0003` and `ADR-0016` require versioned parser runs, parser outputs, and parser errors, while the current implementation records only limited processing-run rows and deletes prior run history during reprocessing cleanup. |
| Affected Source Documents | `98 - Changelog.md`, `docs/process-tacho-parser-run-contract-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0003`, `ADR-0016`, `ADR-0018` |
| Capability IDs | Import Management, Parser Pipeline, Compliance Intelligence |
| Implementation Impact | High |
| Database Impact | Migration Required / Data Backfill Required |
| Security Impact | Review Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede with a revised parser-run migration plan if live schema verification shows `tachograph_processing_runs` cannot safely act as the compatibility bridge for `parser_runs`. |

### Details

Added a parser run contract document that maps `process-tacho` behaviour, current parser identities, `tachograph_processing_runs`, derived rows, error handling, reprocessing, migration needs, and test requirements to the SOT parser model.

The document requires parser run rows to be created at execution start, updated through lifecycle states, retained across reprocessing, and linked to parser outputs, parser errors, raw imports, and derived records where practical.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Raw Tachograph Storage Immutability Checks

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-010 |
| Status | Implemented |
| Owner | Security |
| Summary | Defined the storage policy, database row, RPC, client, migration, and test checks required to enforce raw tachograph file immutability. |
| Reason | Current storage policies and cleanup flows allow manager update/delete or client-side deletion of raw tachograph evidence, which conflicts with `ADR-0002`, `ADR-0018`, `SOT-21`, and `SOT-22`. |
| Affected Source Documents | `98 - Changelog.md`, `docs/raw-tachograph-storage-immutability-checks-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0018` |
| Capability IDs | Import Management, Security, Compliance Intelligence |
| Implementation Impact | High |
| Database Impact | Migration Required / Data Backfill Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede only if the accepted retention model changes; do not re-enable normal authenticated raw-file update/delete without a replacement ADR and security test coverage. |

### Details

Added an implementation check document for the `tachograph-files` bucket and `tachograph_files` evidence rows.

The document identifies current conflicts, including manager storage update/delete policies, client-side storage `.remove()` calls, candidate archive deletion options, and purge flows that delete import rows. It defines live SQL checks, expected fail-closed policy behaviour, RPC/client remediation requirements, migration shape, and automated test cases.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Import Batch/File Schema Delta

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-009 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Defined the MVP schema delta between the current `tachograph_files` implementation and the source-of-truth import model. |
| Reason | The source-of-truth model introduces `import_batches`, `import_files`, subtype import records, and `file_assets`, while the current app and functions depend on `tachograph_files`. A compatibility migration path is required before implementation. |
| Affected Source Documents | `98 - Changelog.md`, `docs/import-batch-file-schema-delta-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0016`, `ADR-0018` |
| Capability IDs | Import Management, Compliance Intelligence |
| Implementation Impact | High |
| Database Impact | Migration Required / Data Backfill Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede with a revised import migration plan if live schema inspection shows `tachograph_files` cannot safely act as the MVP compatibility bridge. |

### Details

Added an implementation delta document that maps the current `tachograph_files` contract to the SOT `import_files` model, recommends additive compatibility changes, defines `import_batches` requirements, lists indexes, identifies RLS/storage constraints, and sets backfill gates.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add MVP Data Model Migration Reconciliation

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-008 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Added static reconciliation of source-controlled migrations against the `SOT-21` MVP data model. |
| Reason | Phase 1 implementation planning requires a clear map between existing tables and the source-of-truth MVP schema before new migrations are written. |
| Affected Source Documents | `98 - Changelog.md`, `docs/data-model-mvp-migration-reconciliation-2026-07-02.md` |
| Affected ADRs | `ADR-0016`, `ADR-0017`, `ADR-0018` referenced |
| Capability IDs | `CORE`, `CMP`, `SYS`, `REP`, `INT` capability areas affected; exact IDs to be mapped during backlog conversion. |
| Implementation Impact | Medium |
| Database Impact | Migration Required |
| Security Impact | Review Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede this reconciliation after a live database schema verification if actual hosted schema differs from source-controlled migrations. |

### Details

Created `docs/data-model-mvp-migration-reconciliation-2026-07-02.md`.

The reconciliation maps `SOT-21` required MVP tables to existing migration-created tables, identifies naming conflicts such as `companies` versus `fleets`, highlights missing timeline/evidence/reporting/Atlas tables, and recommends verifying live database state before writing new schema migrations.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add RLS Security Reconciliation

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-007 |
| Status | Implemented |
| Owner | Security |
| Summary | Added a static reconciliation of current Supabase RLS/security migrations against `SOT-22`. |
| Reason | Phase 1 implementation planning requires visibility into whether the current RLS/security model matches the source-of-truth security requirements. |
| Affected Source Documents | `98 - Changelog.md`, `docs/security-rls-reconciliation-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0012`, `ADR-0018` referenced |
| Capability IDs | `SYS`, `CMP`, `CORE` capability areas affected; exact IDs to be mapped during security backlog conversion. |
| Implementation Impact | Medium |
| Database Impact | Migration Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede this reconciliation if a live database policy audit produces different findings. |

### Details

Created `docs/security-rls-reconciliation-2026-07-02.md`.

The reconciliation identifies partial RLS coverage, likely missing RLS on core tachograph tables, tachograph storage update/delete conflicts with raw evidence immutability, and the need for permission tests around security-definer RPCs.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Accept Raw Tachograph File Retention ADR

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-006 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Added `ADR-0018` to define raw tachograph file retention as policy-driven and audited. |
| Reason | Storage design, deletion workflows, evidence integrity, privacy handling, and report traceability need a clear retention model. |
| Affected Source Documents | `SOT-21`, `SOT-24`, `SOT-98` |
| Affected ADRs | `ADR-0018`, `ADR-0002` |
| Capability IDs | `CMP`, `SYS`, `REP` capability areas affected; exact IDs to be mapped during MVP backlog conversion. |
| Implementation Impact | Medium |
| Database Impact | Migration Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede with a new ADR if legal/compliance review requires fixed retention, indefinite retention, or a different deletion model. |

### Details

Accepted that raw tachograph files remain immutable while retained, but retention is governed by configurable policy with platform minimums, fleet/jurisdiction overrides, legal hold support, and audited deletion or archival workflows.

The decision requires metadata, hash, parser references, audit trail, and report/evidence traceability to remain available even if the raw binary is deleted after retention expiry.

Also updated `SOT-21` so raw tachograph file retention is no longer listed as an unresolved open question.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Accept Timeline Versioning ADR

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-005 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Added `ADR-0017` to define Timeline Events as versioned derived records with controlled regeneration. |
| Reason | Timeline schema, compliance outcomes, evidence packs, Atlas explanations, and report snapshots need a stable rule for recalculation and historical traceability. |
| Affected Source Documents | `SOT-21`, `SOT-24`, `SOT-98` |
| Affected ADRs | `ADR-0017` |
| Capability IDs | `CMP`, `REP`, `INT` capability areas affected; exact IDs to be mapped during MVP backlog conversion. |
| Implementation Impact | Medium |
| Database Impact | Migration Required |
| Security Impact | Review Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede with a new ADR if timelines become fully immutable or are regenerated without retained versions. |

### Details

Accepted that Timeline Events are derived records that may be regenerated, but published timeline rows must not be silently overwritten.

Timeline generations must be versioned, previous versions must be retained when referenced by compliance outcomes, evidence packs, Atlas responses, review notes, or report exports, and exports must snapshot or reference the specific timeline version used.

Also updated `SOT-21` so the timeline versioning/regeneration question is no longer listed as unresolved.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Accept Parser Output Storage Boundary ADR

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-004 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Added `ADR-0016` to define the parser output boundary between relational records and JSONB payloads. |
| Reason | The MVP import pipeline and data model need a stable rule for what parser data is queryable relational data versus retained flexible parser payload. |
| Affected Source Documents | `SOT-21`, `SOT-24`, `SOT-98` |
| Affected ADRs | `ADR-0016` |
| Capability IDs | `CMP`, `SYS`, `REP` capability areas affected; exact IDs to be mapped during MVP backlog conversion. |
| Implementation Impact | Medium |
| Database Impact | Migration Required |
| Security Impact | Review Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede with a new ADR if the platform moves to fully relational parser storage or JSON-only parser storage. |

### Details

Accepted a hybrid parser-output model:

- relational records for query-critical, compliance-critical, security-critical, report-critical, and audit-critical derived data
- JSONB payloads for raw parser payloads, diagnostics, warnings, errors, unsupported fields, vendor-specific fields, and future-compatible parser details

Also updated `SOT-21` so the parser output JSONB boundary is no longer listed as an unresolved open question.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Fix MVP Markdown Link Escaping

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-003 |
| Status | Implemented |
| Owner | Product Architecture |
| Summary | Updated Markdown links to `SOT-10` so the MVP filename parentheses are URL-encoded. |
| Reason | Unescaped parentheses in Markdown link targets can be parsed incorrectly by tooling and automated link checks. |
| Affected Source Documents | `SOT-01`, `SOT-11`, `SOT-12`, `SOT-15`, `SOT-16`, `SOT-17`, `SOT-98` |
| Affected ADRs | None |
| Capability IDs | None |
| Implementation Impact | None |
| Database Impact | None |
| Security Impact | None |
| Testing Impact | None |
| Rollback Notes | Restore prior link targets only if the filename is renamed or the Markdown tooling convention changes. |

### Details

Updated related-document links pointing to `10 — Minimum Viable Product (MVP).md` to encode parentheses as `%28MVP%29`.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Source Of Truth Index

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-002 |
| Status | Implemented |
| Owner | Product Architecture |
| Summary | Added a canonical source-of-truth index with stable document IDs mapped to current filenames. |
| Reason | Several filenames are truncated or awkward for tooling, so implementation work needs stable IDs that do not depend on filename shape. |
| Affected Source Documents | `00 - README.md`, `98 - Changelog.md`, `index.md` |
| Affected ADRs | None |
| Capability IDs | None |
| Implementation Impact | Low |
| Database Impact | None |
| Security Impact | None |
| Testing Impact | None |
| Rollback Notes | Remove only if replaced by another canonical document registry. |

### Details

Created `index.md` to map stable IDs such as `SOT-18-07` and `SOT-21` to their current document filenames, categories, owners, statuses, and primary purposes.

Updated `00 - README.md` to identify `index.md` as the canonical document index.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Source Of Truth Changelog

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-001 |
| Status | Implemented |
| Owner | Product Architecture |
| Summary | Added this changelog as the formal change-control record for the HourWise Source of Truth. |
| Reason | `00 - README.md` requires changelog updates for significant HourWise changes, but no changelog file existed. |
| Affected Source Documents | `00 - README.md`, `98 - Changelog.md` |
| Affected ADRs | None |
| Capability IDs | None |
| Implementation Impact | Low |
| Database Impact | None |
| Security Impact | None |
| Testing Impact | None |
| Rollback Notes | Remove this document only if another formal source-of-truth change-control mechanism replaces it. |

### Details

Created `98 - Changelog.md` to provide a consistent template and permanent record for source-of-truth changes.

Updated `00 - README.md` so the update rules point directly to this changelog.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed
