# TIME-007 Representative Timeline Imports

Date: 2026-07-04
Status: Partial - driver-card representative import aligned; vehicle-unit import blocked
Scope: live representative import inspection, controlled driver-card timeline backfill, and aggregate validation

## Outcome

`TIME-007` created a current import-scoped timeline generation for the latest eligible driver-card import in the linked live Supabase project.

No production view should be replaced with timeline-native rendering yet.

Reason: the live project still has no eligible `vehicle_unit` tachograph import in the aggregate validation sample, so the Source-of-Truth gate requiring both driver-card and VU coverage is not met.

## Tooling Added

Added:

- `tools/tacho-processing/live-postgres-client.mjs`
- `tools/tacho-processing/inspect-time-007-state.mjs`
- `tools/tacho-processing/backfill-time-007-timeline.mjs`
- `tools/tacho-processing/finalize-time-007-backfill.mjs`

Added scripts:

- `npm run tacho:inspect-time-007`
- `npm run tacho:backfill-time-007`
- `npm run tacho:finalize-time-007`

The tools use the linked Supabase CLI database connection in memory, run aggregate-only reporting, and write non-PII reports under `supabase/.temp`.

## Live State Before Backfill

Inspection found:

| Metric | Count |
| --- | ---: |
| Companies | 1 |
| Vehicles | 24 |
| Eligible `driver_card` imports | 5 |
| Eligible `vehicle_unit` imports | 0 |

Latest eligible driver-card import aggregate rows:

| Source rows | Count |
| --- | ---: |
| Activity segments | 5,268 |
| Day summaries | 118 |
| Reconciliation issue rows | 116 |
| Technical events | 0 |
| Vehicle motion discrepancy rows | 0 |

## Live Write Performed

The controlled backfill generated a driver-card timeline from existing parser-derived relational rows:

| Timeline rows | Count |
| --- | ---: |
| Timeline events | 5,268 |
| Timeline event sources | 5,268 |
| Timeline gaps | 116 |
| Daily timeline summaries | 118 |

Final timeline status:

| Source type | Status | Current | Events | Gaps | Daily summaries |
| --- | --- | --- | ---: | ---: | ---: |
| `driver_card` | `completed_with_warnings` | yes | 5,268 | 116 | 118 |

The warning status is expected because the source import has 116 reconciliation issue rows that are represented as timeline gaps.

## Apply Repair Note

During the controlled apply, repeated runs created four complete TIME-007 driver-card timeline generations with `running` status and `is_current = false`.

The finalizer promoted the newest complete generation and superseded the earlier TIME-007 attempts:

| Generation state | Count |
| --- | ---: |
| Current TIME-007 generations | 1 |
| Running TIME-007 generations | 0 |
| Superseded TIME-007 generations | 3 |

No row-level tachograph, driver, vehicle, or file identifiers were exported in the reports.

## Validation Result

`npm run tacho:validate-timeline` result after finalization:

| Metric | Count |
| --- | ---: |
| Sample imports | 5 |
| Imports with current timeline generation | 1 |
| Imports missing current timeline generation | 4 |
| Count-aligned imports | 1 |
| Event mismatches | 0 |
| Gap mismatches | 0 |
| Day-summary mismatches | 0 |

Source-type result:

| Source type | Sample | With timeline | Missing timeline | Count-aligned |
| --- | ---: | ---: | ---: | ---: |
| `driver_card` | 5 | 1 | 4 | 1 |
| `vehicle_unit` | 0 | 0 | 0 | 0 |

Candidate recommendation:

> Only one source type appears aligned. Keep production analysis screens parser-native until both driver-card and VU imports are represented.

## Reports

Generated reports:

- `supabase/.temp/time-007-live-state-2026-07-04.json`
- `supabase/.temp/time-007-backfill-2026-07-04.json`
- `supabase/.temp/time-007-finalize-2026-07-04.json`
- `supabase/.temp/time-006-timeline-validation-2026-07-04.json`

## Decision

Driver-card timeline generation is now proven for one representative live import.

Do not select a timeline-native rendering candidate yet because VU coverage is absent.

## Next Task

`TIME-008`: create or upload a representative vehicle-unit tachograph import with raw storage, process it through the deployed runtime, confirm it receives a current import-scoped timeline generation, and rerun:

- `npm run tacho:inspect-time-007`
- `npm run tacho:validate-timeline`

Completion gate:

- at least one representative `driver_card` import remains current and count-aligned;
- at least one representative `vehicle_unit` import has a current timeline generation;
- event count is aligned by the existing adapter rule;
- gap count is exactly aligned;
- day-summary count is exactly aligned;
- Import Centre shows aligned comparison status for both source types before timeline-native rendering replaces parser-native views.
