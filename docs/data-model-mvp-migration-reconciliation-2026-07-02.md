# Data Model MVP Migration Reconciliation

Date: 2026-07-02
Task: `DATA-001`
Scope: Static mapping of existing Supabase migrations to `SOT-21` section `37.1 Required MVP Tables`
Status: Complete as assessment; implementation gaps remain open.

## Executive Summary

The current source-controlled Supabase migrations do not yet match the `SOT-21` MVP data model.

The existing schema is a working legacy/current-product model built around:

- `companies`
- `profiles`
- operational driver/fleet tables
- `tachograph_files` and derived `tachograph_*` records
- security-definer RPCs for tachograph bundles and workflows

The source-of-truth MVP model is a future-aligned platform model built around:

- `fleets`
- `fleet_memberships`
- `import_batches`
- `import_files`
- `parser_runs`
- `parser_outputs`
- `normalised_activities`
- `timeline_events`
- compliance/evidence/reporting/Atlas tables

Recommendation: do not create new tables blindly. First define a controlled migration strategy that maps legacy/current entities to the `SOT-21` model, preserves existing production data, and avoids parallel duplicate truth.

## Static Migration Inventory

Tables created directly in source-controlled migrations:

| Table | First Seen In Migration | Notes |
| --- | --- | --- |
| `companies` | `20251220174735_create_hourwise_schema.sql` | Current tenant/company entity. Maps conceptually to `fleets`. |
| `profiles` | `20251220174735_create_hourwise_schema.sql` | Current user/profile/role entity. Maps partly to `profiles`, `drivers`, and `fleet_memberships`. |
| `driver_logs` | `20251220174735_create_hourwise_schema.sql` | Legacy/current driver activity log table. |
| `invoices` | `20260105110830_add_individual_subscriptions.sql` | Billing/solo-driver support; not core compliance MVP in `37.1`. |
| `infringements` | `20260420120000_add_infringements_table.sql` | Existing compliance finding concept. May map to future `compliance_outcomes` only after review. |
| `alerts` | `20260421000000_create_alerts_table.sql` | Operational alerts; not directly in `37.1`. |
| `shifts` | `20260422000000_create_shifts_table.sql` | Operational planning; not directly in `37.1`. |
| `incidents` | `20260423000000_create_incidents_table.sql` | Operational incident records; not directly in `37.1`. |
| `tachograph_processing_runs` | `20260509193000_add_normalized_tacho_contract.sql` | Existing parser run equivalent. |
| `driver_card_downloads` | `20260509193000_add_normalized_tacho_contract.sql` | Existing driver-card import summary equivalent. |
| `vehicle_unit_downloads` | `20260509193000_add_normalized_tacho_contract.sql` | Existing VU import summary equivalent. |
| `tachograph_activity_segments` | `20260509193000_add_normalized_tacho_contract.sql` | Existing normalised activity equivalent. |
| `tachograph_day_summaries` | `20260509193000_add_normalized_tacho_contract.sql` | Existing daily summary/read model. |
| `tachograph_findings` | `20260509193000_add_normalized_tacho_contract.sql` | Existing compliance/technical finding equivalent. |
| `tachograph_technical_events` | `20260509193000_add_normalized_tacho_contract.sql` | Existing technical event equivalent. |
| `driver_tacho_compliance_signals` | `20260509193000_add_normalized_tacho_contract.sql` | Existing dashboard signal/read model. |
| `driver_tacho_risk_signals` | `20260509193000_add_normalized_tacho_contract.sql` | Existing risk signal/read model. |
| `tachograph_vehicle_motion_discrepancies` | `20260510211500_add_vehicle_motion_discrepancies.sql` | Existing VU/driver discrepancy equivalent. |
| `tachograph_reconciliation_items` | `20260511093000_add_tacho_reconciliation_contract.sql` | Existing app/tacho reconciliation equivalent. |
| `private.tacho_processing_runtime` | `20260606120000_add_tacho_trigger_dispatch.sql` | Private runtime config, not source-of-truth domain data. |
| `private.broadcast_dispatch_runtime` | `20260614115811_security_hardening_shared_database.sql` | Private runtime config, not source-of-truth domain data. |
| `tachograph_finding_reviews` | `20260621123000_add_tacho_finding_review_persistence.sql` | Existing review note/action equivalent. |
| `tachograph_finding_review_events` | `20260621123000_add_tacho_finding_review_persistence.sql` | Existing review audit/event equivalent. |

Important limitation:

The application references tables not created by the scanned source-controlled migrations, including `vehicles`, `vehicle_checks`, `driver_documents`, `vehicle_documents`, `tachograph_files`, `tachograph_activities`, and `tachograph_speed_logs`. These may exist in the hosted Supabase project, may come from omitted historical migrations, or may be schema drift. They must be verified against the live/local database before any destructive migration work.

## MVP Table Mapping

| `SOT-21` MVP Table | Current Migration Equivalent | Status | Notes |
| --- | --- | --- | --- |
| `profiles` | `profiles` | Implemented / needs reconciliation | Existing table mixes auth profile, role, company membership, driver details, billing fields, and tacho card fields. |
| `fleets` | `companies` | Naming conflict | Current tenant table is `companies`; source-of-truth uses `fleets`. Requires rename, view alias, or mapping decision. |
| `fleet_memberships` | `profiles.company_id`, `profiles.role` | Missing as separate table | Current model supports one company per profile. `SOT-21` expects explicit membership model. |
| `depots` | None found | Missing | No source-controlled migration found. |
| `drivers` | `profiles` where role/driver fields apply | Partial / naming conflict | Current model treats drivers as profiles. Separate driver entity not present. |
| `vehicles` | Referenced by code and FK, creation migration not found | Unknown / verify live DB | Existing code uses `vehicles`; source-controlled creation migration not found in scan. |
| `import_batches` | None found | Missing | Current model appears import-file centric rather than batch centric. |
| `import_files` | `tachograph_files` | Partial / legacy name | Referenced and altered by migrations, but source-controlled creation migration not found. |
| `driver_card_imports` | `driver_card_downloads` | Partial / naming conflict | Existing summary table maps to driver-card import details. |
| `vehicle_unit_imports` | `vehicle_unit_downloads` | Partial / naming conflict | Existing summary table maps to VU import details. |
| `parser_runs` | `tachograph_processing_runs` | Partial / naming conflict | Existing table stores parser version/source/warnings/errors/processed time. |
| `parser_outputs` | No direct table; JSONB spread across metadata/warnings/errors and derived tables | Missing / intentionally hybrid | `ADR-0016` says parser payload JSONB plus relational derived records. A formal `parser_outputs` table still needs design. |
| `parser_errors` | `tachograph_processing_runs.errors`, warnings JSONB | Partial | Separate error table absent. |
| `normalised_activities` | `tachograph_activity_segments` | Partial / naming conflict | Existing table matches concept. UK spelling differs from current table name. |
| `timeline_events` | None direct; `tachograph_activity_segments`, `tachograph_technical_events`, findings act as inputs | Missing | Required by `ADR-0017`. |
| `timeline_event_sources` | `evidence_refs` JSONB in findings/events | Missing / partial | Needs relational source-link model for traceability. |
| `timeline_gaps` | None found | Missing | Timeline gap model not implemented. |
| `compliance_checks` | No direct table | Missing | Existing rule execution creates findings/signals but no check record. |
| `compliance_outcomes` | `tachograph_findings`, `infringements` | Partial / naming conflict | Existing findings can seed outcomes, but source-of-truth outcome model is richer/versioned. |
| `compliance_outcome_events` | None direct; `tachograph_finding_review_events` covers review events only | Missing / partial | Outcome lifecycle events need separate model. |
| `compliance_outcome_sources` | `tachograph_findings.evidence_refs` JSONB | Missing / partial | Needs relational source links for evidence/report traceability. |
| `review_notes` | `tachograph_finding_reviews`, `tachograph_finding_review_events` | Partial / naming conflict | Existing review persistence maps to review notes/actions. |
| `evidence_packs` | None found | Missing | Not implemented. |
| `evidence_items` | None direct; source refs in JSONB | Missing / partial | Needs first-class evidence item model. |
| `evidence_completeness_checks` | None found | Missing | Not implemented. |
| `reports` | None found | Missing | Existing React report generation appears UI-level; source table absent. |
| `report_sections` | None found | Missing | Not implemented. |
| `report_sources` | None found | Missing | Not implemented. |
| `report_evidence_packs` | None found | Missing | Not implemented. |
| `report_exports` | None found | Missing | Not implemented. |
| `report_readiness_checks` | None found | Missing | Not implemented. |
| `report_templates` | None found | Missing | Not implemented. |
| `atlas_conversations` | None found | Missing | Not implemented. |
| `atlas_messages` | None found | Missing | Not implemented. |
| `atlas_message_sources` | None found | Missing | Not implemented. |
| `atlas_actions` | None found | Missing | Not implemented. |
| `audit_logs` | Scattered event/review records; no central table found | Missing / partial | Security spec expects central audit model. |
| `file_assets` | `tachograph_files`, document tables, storage metadata | Missing / partial | Unified file asset model absent. |

## Existing Tables Outside `SOT-21` MVP Core

These tables are valuable but not part of the `37.1` core compliance MVP list:

| Table | Recommendation |
| --- | --- |
| `driver_logs` | Treat as legacy/current driver activity source; do not confuse with tachograph source of truth. |
| `invoices` | Keep outside compliance MVP; later map to billing/feature access model. |
| `alerts` | Keep as operational/read-model table; may later map to tasks/notifications. |
| `shifts` | Keep as operations module data; not evidence source unless explicitly linked. |
| `incidents` | Keep as operational evidence candidate; not tachograph truth. |
| `driver_tacho_compliance_signals` | Treat as dashboard/read model generated from outcomes. |
| `driver_tacho_risk_signals` | Treat as dashboard/read model generated from outcomes. |
| `tachograph_vehicle_motion_discrepancies` | Candidate input to timeline/compliance outcomes. |
| `tachograph_reconciliation_items` | Candidate supplementary review/evidence data. |

## Key Reconciliation Findings

### DATA-001-F1 - Tenant Model Is `companies`, Not `fleets`

Severity: High
Markup: `[DECISION-ADR]`

`SOT-21` uses `fleets`, but current migrations and application code use `companies`.

Options:

- Rename `companies` to `fleets` through a controlled migration.
- Keep `companies` as the physical table and treat `fleets` as the source-of-truth domain name.
- Add a compatibility view named `fleets`.

Recommendation:

- Do not rename immediately. Decide in an ADR or schema strategy because this touches most tables, RLS policies, functions, and frontend queries.

### DATA-001-F2 - Membership Model Is Embedded In `profiles`

Severity: High
Markup: `[DECISION-ADR]`

`SOT-21` expects `fleet_memberships`; current schema stores `company_id` and `role` directly on `profiles`.

Impact:

- One user appears limited to one company/fleet.
- Role history and support/multi-fleet access are harder.
- RLS helper functions are tied to profile-level company lookup.

Recommendation:

- Keep current profile model for short-term compatibility, but design `fleet_memberships` before multi-fleet, support access, or enterprise roles.

### DATA-001-F3 - Core Tachograph Pipeline Exists But Uses Legacy Names

Severity: Medium
Markup: `[VERIFY]`

Existing tables cover meaningful parts of the import/parser/normalisation flow:

- `tachograph_processing_runs` -> `parser_runs`
- `driver_card_downloads` -> `driver_card_imports`
- `vehicle_unit_downloads` -> `vehicle_unit_imports`
- `tachograph_activity_segments` -> `normalised_activities`
- `tachograph_findings` -> `compliance_outcomes` seed
- `tachograph_finding_reviews` -> `review_notes` seed

Recommendation:

- Preserve these tables until a migration/backfill plan exists.
- Avoid creating duplicate new tables with overlapping responsibility unless they are clear v2 tables with migration path.

### DATA-001-F4 - Timeline/Evidence/Reporting/Atlas Tables Are Mostly Missing

Severity: High
Markup: `[IMPLEMENT-MVP]` for timeline foundation, `[DEFER-P1]` for reporting/Atlas

Missing major groups:

- timeline generation/versioning tables
- timeline event/source/gap tables
- compliance check/outcome source tables
- evidence pack/item/completeness tables
- report draft/export/readiness tables
- Atlas conversation/message/action tables
- central audit log table
- unified file asset table

Recommendation:

- Implement only the timeline/compliance/evidence minimum needed for the first milestone.
- Defer reporting and Atlas tables until evidence packs and timeline versioning are stable.

### DATA-001-F5 - Source-Controlled Migrations May Not Fully Represent The Database

Severity: High
Markup: `[VERIFY]`

Current code references tables not created in the scanned migrations:

- `vehicles`
- `vehicle_checks`
- `driver_documents`
- `vehicle_documents`
- `tachograph_files`
- `tachograph_activities`
- `tachograph_speed_logs`

Recommendation:

- Run a live/local database schema dump or catalog query before generating any migration that depends on these objects.

## Proposed Migration Strategy

### Stage 1 - Verify Actual Database State

Use Supabase catalog queries or a schema dump to verify:

- all actual tables
- columns
- constraints
- indexes
- RLS enablement
- policies
- grants
- functions
- triggers
- storage buckets and policies

Output should become `DATA-002`.

### Stage 2 - Declare Compatibility Mapping

Create a formal compatibility table:

- source-of-truth name
- current physical table
- migration target
- whether to rename, alias, backfill, or keep as legacy

### Stage 3 - Build MVP Delta Migrations

Add only missing structures required for `Secure Upload to Timeline`:

- `parser_outputs` if needed by `ADR-0016`
- timeline generation/version model
- `timeline_events`
- `timeline_event_sources`
- `timeline_gaps` if required for MVP
- minimal compliance check/outcome source records
- central audit/file asset records only if needed to satisfy security/evidence gates

### Stage 4 - Defer Downstream Platforms

Do not implement reporting and Atlas tables until:

- timeline versions are stable
- compliance outcomes are traceable
- evidence packs exist
- security/RLS tests pass

## Recommended Next Backlog Items

1. `DATA-002`: Verify live/local database schema against source-controlled migrations.
2. `DATA-003`: Decide `companies` versus `fleets` physical naming strategy.
3. `DATA-004`: Decide `profiles` embedded membership versus `fleet_memberships` migration strategy.
4. `DATA-005`: Design MVP timeline generation and event tables from `ADR-0017`.
5. `DATA-006`: Design minimal compliance check/outcome source tables.
6. `DATA-007`: Design `file_assets` versus existing `tachograph_files` compatibility.
7. `DATA-008`: Decide whether to create `parser_outputs` now or defer to current hybrid tachograph tables.

## Acceptance Criteria For Data Gate

Before schema implementation begins:

- Actual database state is verified, not inferred only from migrations.
- Every `SOT-21` MVP table has a status: implemented, mapped, missing, deferred, or superseded.
- Naming conflicts have explicit decisions.
- Existing production/current data has a preservation path.
- RLS and migration strategy are planned together.
- New tables do not duplicate existing truth without a migration path.
- First milestone tables are limited to `Secure Upload to Timeline` needs.

## Limitations

This reconciliation is a static source review.

It does not prove hosted Supabase state and does not account for:

- manual database changes
- missing historical migrations
- generated migrations not committed to source control
- views/functions that expose table-shaped data
- storage bucket metadata not represented as normal tables
