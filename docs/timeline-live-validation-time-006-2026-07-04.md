# TIME-006 Timeline Live Validation

Date: 2026-07-04
Status: Complete - no timeline-native rendering candidate selected
Scope: live aggregate validation of timeline generation presence and count alignment

## Outcome

`TIME-006` validated the surfaced timeline comparison state against the linked live Supabase project using aggregate-only database counts.

No production view should be replaced with timeline-native rendering yet.

The live sample contains processed or partial tachograph imports, but none currently have a current import-scoped timeline generation. The validation therefore cannot prove event, gap, or day-summary alignment for either driver-card or vehicle-unit imports.

## Validation Tooling

Added:

- `tools/tacho-processing/validate-timeline-comparison.mjs`
- `npm run tacho:validate-timeline`

The validator:

- uses the linked Supabase CLI connection details in memory;
- switches to the same `postgres` role used by Supabase CLI remote dumps;
- runs a narrow aggregate SQL query only;
- does not dump row-level tachograph, driver, vehicle, or file data;
- writes a non-PII JSON report under `supabase/.temp`.

Report produced:

- `supabase/.temp/time-006-timeline-validation-2026-07-04.json`

## Live Result

Aggregate result:

| Metric | Count |
| --- | ---: |
| Sample imports | 5 |
| Imports with current timeline generation | 0 |
| Imports missing current timeline generation | 5 |
| Count-aligned imports | 0 |
| Event mismatches | 0 |
| Gap mismatches | 0 |
| Day-summary mismatches | 0 |

Source-type result:

| Source type | Sample | With timeline | Missing timeline | Count-aligned |
| --- | ---: | ---: | ---: | ---: |
| `driver_card` | 5 | 0 | 5 | 0 |
| `vehicle_unit` | 0 | 0 | 0 | 0 |

Latest sampled import timestamp:

- `2026-07-01T09:20:21.814761+00:00`

## Decision

Do not choose a timeline-native rendering candidate yet.

Reason:

- There are no current import-scoped timeline generations in the live sample.
- There are no representative vehicle-unit imports in the validated sample.
- Count alignment cannot be established until timeline generation exists for representative driver-card and VU imports.

Current tachograph and analysis views must remain parser-native with timeline comparison status shown as observability only.

## Next Task

Next practical task: create or reprocess representative driver-card and vehicle-unit imports after the timeline generation runtime is deployed, then rerun `npm run tacho:validate-timeline`.

Completion gate for selecting a timeline-native rendering candidate:

- at least one representative `driver_card` import has a current timeline generation;
- at least one representative `vehicle_unit` import has a current timeline generation;
- event count is aligned by the existing adapter rule;
- gap count is exactly aligned;
- day-summary count is exactly aligned;
- Import Centre shows the same aligned state managers will see in production.

## Rollback Strategy

No production schema or runtime code was changed for this validation task.

If the validation tool is not wanted, remove:

- `tools/tacho-processing/validate-timeline-comparison.mjs`
- the `tacho:validate-timeline` package script

The aggregate report under `supabase/.temp` can be regenerated and is not required by application runtime.
