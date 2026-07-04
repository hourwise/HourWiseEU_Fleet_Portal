# Timeline Event MVP Schema And Read Model

Date: 2026-07-02
Task: `TIME-001`
Status: Complete

## Purpose

Define the MVP schema and UI read model for HourWise Timeline Events.

This document bridges the current tachograph-derived tables to the source-of-truth Timeline Engine model without breaking existing driver, vehicle, and import analysis screens.

Related documents:

- [SOT-18.6 Timeline Engine](source-of-truth/18.6%20%E2%80%94%20Timeline%20Engine.md)
- [SOT-21 Data Model](source-of-truth/21%20%E2%80%94%20Data%20Model%20Specification.md)
- [SOT-24 Architecture Decision Records](source-of-truth/24%20%E2%80%94%20Architecture%20Decision%20Records.md)
- [Process Tacho Parser Run Contract](process-tacho-parser-run-contract-2026-07-02.md)

## Source-Of-Truth Requirement

Timeline Events are derived records.

They must:

- organise operational facts into chronological history
- preserve source evidence references
- preserve parser run references where applicable
- support confidence states
- identify gaps and unresolved periods
- support daily summaries for UI/report performance
- be versioned by generation so recalculation does not silently overwrite published evidence

ADR-0017 requires every timeline generation to have generation/version metadata and current/superseded state.

## Current Implementation Shape

The current application does not have dedicated `timeline_events`, `timeline_event_sources`, `timeline_gaps`, or `daily_timeline_summaries` tables.

Timeline-like data exists in tachograph-derived tables:

| Current table/RPC | Current role |
| --- | --- |
| `tachograph_activity_segments` | Normalised tachograph activity periods with driver/vehicle/time/source fields. |
| `tachograph_day_summaries` | Daily tachograph rollups used by analysis screens. |
| `tachograph_findings` | Compliance-style findings derived from activity windows. |
| `tachograph_technical_events` | VU/technical events such as overspeed or faults. |
| `tachograph_vehicle_motion_discrepancies` | Gap/conflict-like vehicle motion review items. |
| `tachograph_reconciliation_items` | App/tachograph mismatch records. |
| `get_driver_tacho_analysis_bundle` | Current driver read bundle containing activity segments, findings, technical events, day summaries, and reconciliation. |
| `get_vehicle_unit_analysis_bundle` | Current vehicle read bundle. |
| `get_tacho_import_bundle` | Current import-level read bundle. |
| TypeScript bundle types | `TachoActivitySegment`, `TachoDaySummary`, `TachoFinding`, `VehicleMotionDiscrepancy`, and `TachoParserBundle`. |

These tables are useful as MVP inputs, but they are not sufficient as the canonical timeline model because they lack generation identity, event source linking, active/superseded state, and unified event typing.

## Decision

For MVP, add dedicated timeline tables instead of treating `tachograph_activity_segments` as the permanent timeline.

Use current tachograph-derived tables as source inputs and compatibility read sources during migration.

The first timeline implementation should:

- create `timeline_generations`
- create `timeline_events`
- create `timeline_event_sources`
- create `timeline_gaps`
- create `daily_timeline_summaries`
- generate MVP timeline rows from `tachograph_activity_segments`, `tachograph_technical_events`, `tachograph_vehicle_motion_discrepancies`, and selected app/work-session records where available
- expose a UI read model that can still feed the existing bundle screens
- mark prior generations as superseded rather than overwriting published timeline rows

Do not build compliance outcomes directly from parser-specific JSON or raw `tachograph_activity_segments` once timeline generation exists.

## MVP Schema

### `timeline_generations`

Groups a deterministic timeline build for a fleet, driver, vehicle, import, or date range.

Required fields:

| Column | Requirement |
| --- | --- |
| `id` | Primary key. |
| `company_id` | Tenant/fleet bridge. |
| `driver_id` | Nullable for vehicle-only timelines. |
| `vehicle_id` | Nullable for driver-only timelines. |
| `scope_type` | `driver`, `vehicle`, `import`, `fleet_range`. |
| `scope_id` | Nullable UUID for import/driver/vehicle scope. |
| `range_start` | Inclusive generation range start. |
| `range_end` | Exclusive or inclusive generation range end; define consistently in migration. |
| `generation_version` | Timeline generation logic version, for example `timeline-mvp@1`. |
| `status` | `running`, `completed`, `completed_with_warnings`, `failed`, `superseded`. |
| `is_current` | True for the active operational generation for the same scope/range. |
| `generated_by` | User/process actor where known. |
| `generated_reason` | `initial_import`, `reprocess`, `pairing_changed`, `manual_rebuild`, `backfill`. |
| `source_import_id` | Nullable `tachograph_files.id` for import-scoped builds. |
| `parser_run_id` | Nullable latest parser run used by import-scoped builds. |
| `supersedes_generation_id` | Nullable prior generation reference. |
| `superseded_by_generation_id` | Nullable replacement generation reference. |
| `superseded_at` | Nullable. |
| `started_at` | Required. |
| `completed_at` | Nullable until finished. |
| `metadata` | JSONB for counts, warnings, source table versions, and diagnostics. |

### `timeline_events`

Stores current and historical derived timeline events.

Required fields:

| Column | Requirement |
| --- | --- |
| `id` | Primary key. |
| `company_id` | Tenant/fleet bridge. |
| `timeline_generation_id` | Required. |
| `driver_id` | Nullable. |
| `vehicle_id` | Nullable. |
| `event_type` | Controlled event type. |
| `started_at` | Required. |
| `ended_at` | Nullable only for point events. |
| `duration_seconds` | Nullable for point events; required for intervals. |
| `timezone` | Required if known; default `UTC` only when source timezone is unknown. |
| `confidence_state` | `confirmed`, `likely`, `possible`, `uncertain`, `insufficient_data`. |
| `source_summary` | Short human-readable provenance summary. |
| `status` | `current`, `superseded`, `excluded`, `needs_review`. |
| `is_current` | Operational active flag. |
| `parser_run_id` | Nullable link when derived from parser output. |
| `import_file_id` | Nullable link to `tachograph_files.id`. |
| `source_table` | Compatibility pointer such as `tachograph_activity_segments`. |
| `source_id` | Compatibility pointer to source row. |
| `created_at` | Required. |
| `updated_at` | Required. |
| `metadata` | JSONB for labels, source details, original timestamps, and UI display hints. |

### `timeline_event_sources`

Links timeline events to all contributing source records.

Required fields:

| Column | Requirement |
| --- | --- |
| `id` | Primary key. |
| `company_id` | Tenant/fleet bridge. |
| `timeline_event_id` | Required. |
| `timeline_generation_id` | Required for efficient generation cleanup/audit. |
| `source_type` | `tachograph_activity_segment`, `tachograph_technical_event`, `vehicle_motion_discrepancy`, `work_session`, `driver_card_import`, `vehicle_unit_import`, `manual_entry`, `future_telematics`. |
| `source_id` | Source row UUID or stable external ID. |
| `normalised_activity_id` | Nullable future SOT link. |
| `parser_run_id` | Nullable. |
| `parser_output_id` | Nullable future SOT link. |
| `import_file_id` | Nullable `tachograph_files.id`. |
| `source_reference_json` | JSONB with source table, field mapping, and evidence labels. |
| `created_at` | Required. |

### `timeline_gaps`

Tracks missing, conflicting, or unresolved periods. Gaps are not legal findings; they are review prompts and evidence-quality indicators.

Required fields:

| Column | Requirement |
| --- | --- |
| `id` | Primary key. |
| `company_id` | Tenant/fleet bridge. |
| `timeline_generation_id` | Required. |
| `driver_id` | Nullable. |
| `vehicle_id` | Nullable. |
| `started_at` | Required. |
| `ended_at` | Required. |
| `duration_seconds` | Required. |
| `gap_type` | `missing_driver_card_data`, `missing_vehicle_unit_data`, `unmatched_activity`, `unknown_driver`, `parser_gap`, `manual_review_required`, `app_tacho_mismatch`. |
| `severity` | `low`, `medium`, `high`, `critical`. |
| `reason` | Human-readable reason. |
| `status` | `open`, `in_review`, `resolved`, `superseded`, `accepted`. |
| `created_at` | Required. |
| `updated_at` | Required. |
| `metadata` | JSONB with source evidence and review context. |

### `daily_timeline_summaries`

Rollup table for UI and reports.

Required fields:

| Column | Requirement |
| --- | --- |
| `id` | Primary key. |
| `company_id` | Tenant/fleet bridge. |
| `timeline_generation_id` | Required. |
| `driver_id` | Nullable. |
| `vehicle_id` | Nullable. |
| `summary_date` | Required. |
| `driving_seconds` | Required default `0`. |
| `work_seconds` | Required default `0`. |
| `availability_seconds` | Required default `0`. |
| `rest_seconds` | Required default `0`. |
| `break_seconds` | Required default `0`. |
| `unknown_seconds` | Required default `0`. |
| `duty_start` | Nullable. |
| `duty_end` | Nullable. |
| `gap_count` | Required default `0`. |
| `finding_count` | Required default `0`. |
| `confidence_state` | Required. |
| `created_at` | Required. |
| `updated_at` | Required. |
| `metadata` | JSONB. |

## MVP Event Type Mapping

Map current activity and event rows into SOT event types.

| Current source | Current value | Timeline `event_type` |
| --- | --- | --- |
| `tachograph_activity_segments.activity_type` | `driving` | `driving` |
| `tachograph_activity_segments.activity_type` | `work` | `other_work` |
| `tachograph_activity_segments.activity_type` | `poa` | `availability` |
| `tachograph_activity_segments.activity_type` | `break_rest` | `rest` or `break` based on duration/source label if known; otherwise `rest`. |
| `tachograph_activity_segments.activity_type` | unknown/unmapped | `unknown` |
| `tachograph_technical_events.rule_code` | `VU_OVERSPEED` | `overspeed` |
| `tachograph_technical_events.rule_code` | `VU_DRIVING_WITHOUT_CARD` | `movement_without_card` |
| `tachograph_technical_events.rule_code` | fault/security/calibration events | `vehicle_movement`, `unknown`, or specific future event type via metadata until enum expands. |
| `tachograph_vehicle_motion_discrepancies.status` | `unassigned_motion` | `movement_without_card` and/or `unknown_driver` gap. |
| `tachograph_vehicle_motion_discrepancies.status` | `card_gap` | `gap`. |
| `tachograph_reconciliation_items.status` | `app_only`, `tacho_only`, `mismatch_*`, `uncertain` | `timeline_gaps` rather than primary timeline event. |

## Current-To-MVP Data Mapping

| Current field | Timeline field |
| --- | --- |
| `tachograph_activity_segments.company_id` | `timeline_events.company_id` |
| `tachograph_activity_segments.driver_id` | `timeline_events.driver_id` |
| `tachograph_activity_segments.vehicle_id` | `timeline_events.vehicle_id` |
| `tachograph_activity_segments.start_time` | `timeline_events.started_at` |
| `tachograph_activity_segments.end_time` | `timeline_events.ended_at` |
| `tachograph_activity_segments.duration_mins * 60` | `timeline_events.duration_seconds` |
| `tachograph_activity_segments.confidence` | Map `high` to `confirmed`, `medium` to `likely`, `low` to `possible`; default `uncertain`. |
| `tachograph_activity_segments.source` | `timeline_event_sources.source_reference_json.source` |
| `tachograph_activity_segments.import_id` | `timeline_events.import_file_id` and `timeline_event_sources.import_file_id` |
| `tachograph_processing_runs.id` | `timeline_events.parser_run_id` after `PARSE-001` migration. |
| `tachograph_day_summaries` | Backfill seed for `daily_timeline_summaries`; recompute from events once timeline generation exists. |

## UI Read Model

The MVP UI read model should be stable even if physical tables evolve.

Recommended RPCs:

| RPC | Purpose |
| --- | --- |
| `get_driver_timeline_bundle(p_company_id, p_driver_id, p_range)` | Driver timeline screen and driver analysis compatibility. |
| `get_vehicle_timeline_bundle(p_company_id, p_vehicle_id, p_range)` | Vehicle timeline and vehicle unit analysis compatibility. |
| `get_import_timeline_bundle(p_company_id, p_import_id)` | Import audit view and parser result drill-down. |

Common response shape:

```json
{
  "contractVersion": "timeline-mvp-1",
  "timelineGeneration": {
    "id": "uuid",
    "version": "timeline-mvp@1",
    "status": "completed",
    "isCurrent": true,
    "rangeStart": "iso",
    "rangeEnd": "iso",
    "generatedAt": "iso",
    "supersededByGenerationId": null
  },
  "events": [],
  "gaps": [],
  "dailySummaries": [],
  "sourceCoverage": {},
  "warnings": []
}
```

Event shape:

```json
{
  "id": "uuid",
  "eventType": "driving",
  "driverId": "uuid",
  "vehicleId": "uuid",
  "startTime": "iso",
  "endTime": "iso",
  "durationSeconds": 3600,
  "confidenceState": "confirmed",
  "status": "current",
  "sourceSummary": "Driver card activity",
  "sources": [],
  "metadata": {}
}
```

Compatibility adapters may continue to expose `TachoActivitySegment` and `TachoDaySummary` by projecting timeline events and daily summaries:

| Existing UI type | Timeline projection |
| --- | --- |
| `TachoActivitySegment` | `timeline_events` where event type is activity-like. |
| `TachoDaySummary` | `daily_timeline_summaries` plus same-day activity events. |
| `TachoFinding` | Keep from `tachograph_findings` until compliance outcomes are introduced. |
| `VehicleMotionDiscrepancy` | `timeline_gaps` with source links. |
| `TachoReconciliationItem` | `timeline_gaps` or reconciliation rows during transition. |

## Generation Rules

MVP generation rules:

1. Build one current generation per driver/range or vehicle/range.
2. Generate from relational source rows, not raw parser JSON.
3. Sort deterministically by `started_at`, confidence, source priority, and source row ID.
4. Convert known activity rows into interval events.
5. Convert technical event rows into point or interval events.
6. Convert unmatched motion and reconciliation mismatch rows into gaps.
7. Build daily summaries from generated timeline events.
8. Mark old current generation as superseded only after the new generation completes.
9. Preserve old generations if used by compliance outcomes, evidence packs, review notes, Atlas responses, or report exports.
10. Record generation reason and source counts.

## Indexes

Recommended MVP indexes:

| Index | Purpose |
| --- | --- |
| `timeline_generations(company_id, driver_id, is_current, range_start, range_end)` | Current driver timeline lookup. |
| `timeline_generations(company_id, vehicle_id, is_current, range_start, range_end)` | Current vehicle timeline lookup. |
| `timeline_events(company_id, driver_id, started_at)` | Driver timeline range reads. |
| `timeline_events(company_id, vehicle_id, started_at)` | Vehicle timeline range reads. |
| `timeline_events(company_id, timeline_generation_id, started_at)` | Generation audit reads. |
| `timeline_events(company_id, event_type, started_at)` | Event filtering. |
| `timeline_event_sources(timeline_event_id)` | Source expansion. |
| `timeline_event_sources(company_id, source_type, source_id)` | Reverse source lookup. |
| `timeline_gaps(company_id, driver_id, status, started_at)` | Driver gap review queue. |
| `timeline_gaps(company_id, vehicle_id, status, started_at)` | Vehicle gap review queue. |
| `daily_timeline_summaries(company_id, driver_id, summary_date)` | Driver daily summary reads. |

## RLS And Security

Timeline tables are tenant-scoped and derived from sensitive source evidence.

Minimum requirements:

- all timeline tables require explicit RLS
- managers can read same-company timeline records
- drivers can read only their own driver timeline if exposed in the driver app
- support access must be explicitly audited
- normal clients cannot update or delete timeline records directly
- regeneration must run through controlled RPC/service-role workflow
- source links must not expose cross-tenant IDs or storage paths
- timeline generation metadata must not leak trigger tokens, parser secrets, or raw storage paths to unauthorised clients

## Migration Shape

After live schema verification:

1. Create timeline tables and indexes.
2. Add RLS policies for tenant-scoped reads and controlled writes.
3. Add a generator function or service process that builds timeline generations from current tachograph-derived tables.
4. Backfill current generations for recent processed imports.
5. Add read RPCs returning `timeline-mvp-1` bundles.
6. Update existing tacho bundle RPCs to optionally project from timeline tables while preserving contract version `1.0` until UI adapters change.
7. Add parser-run links after `PARSE-001` schema changes are implemented.
8. Add compliance/evidence/report references to timeline generation IDs before compliance outcomes become authoritative.

## Required Automated Tests

| Test ID | Scenario | Expected result |
| --- | --- | --- |
| `TIME-001-001` | Generate timeline from processed driver-card activity segments. | Timeline generation completes and produces ordered activity events. |
| `TIME-001-002` | Generate timeline from VU technical events. | Overspeed/motion events are represented as timeline events with source links. |
| `TIME-001-003` | Generate timeline with app/tachograph mismatch rows. | Timeline gaps are created without inventing facts. |
| `TIME-001-004` | Regenerate timeline after reprocess. | New generation becomes current; old generation is superseded but retained. |
| `TIME-001-005` | Read driver timeline as same-company manager. | Allowed. |
| `TIME-001-006` | Read driver timeline as other-company manager. | Denied. |
| `TIME-001-007` | Driver reads own timeline. | Allowed only if driver app exposure is enabled. |
| `TIME-001-008` | Driver reads another driver's timeline. | Denied. |
| `TIME-001-009` | Existing driver analysis bundle is projected from timeline read model. | UI receives compatible activity/day summary shapes. |
| `TIME-001-010` | Compliance outcome references a timeline generation. | Later regeneration does not change the referenced historical generation. |

## Implementation Gates

Do not implement production migrations until:

- `DATA-002` verifies live schema
- `PARSE-001` parser run compatibility plan is accepted
- `SEC-002` RLS/storage hardening work is defined
- UI owners confirm the `timeline-mvp-1` read model
- compliance outcome schema identifies how it references timeline generation IDs
- report/evidence snapshot rules are ready to preserve historical timeline references

## Acceptance Criteria For `TIME-001`

- Current timeline-like sources are mapped.
- MVP timeline schema is defined.
- UI read model is defined.
- Generation/versioning rules are defined.
- RLS, migration, and index requirements are defined.
- Automated test scenarios are defined.
- Source-of-truth changelog and completion plan are updated.

