# TIME-003 Timeline Generation From Parser-Derived Rows

Date: 2026-07-03
Status: Complete
Scope: import-scoped timeline generation in `process-tacho` and read-only timeline bundle RPCs

## Outcome

`TIME-003` is implemented as the first runtime timeline generation slice. When `process-tacho` successfully writes parser-derived tachograph rows, it now creates a versioned import-scoped timeline generation and writes timeline events, event source links, gaps, and daily summaries tied to the current parser run.

## Runtime Changes

File: `supabase/functions/process-tacho/index.ts`

Implemented:

- `generateImportTimeline(...)` reads persisted parser-derived rows for the current `parser_run_id`.
- Creates a `timeline_generations` row with `scope_type = 'import'`, `source_import_id`, `parser_run_id`, range, generation reason, and current/supersession metadata.
- Converts `tachograph_activity_segments` into `timeline_events`.
- Converts `tachograph_technical_events` into technical timeline events.
- Writes `timeline_event_sources` for generated events with concrete source row IDs.
- Converts vehicle motion discrepancies and reconciliation mismatches into `timeline_gaps`.
- Converts `tachograph_day_summaries` into `daily_timeline_summaries`.
- Marks the new generation current only after all rows are inserted.
- Marks the previous current generation for the same import as superseded after successful generation.
- Marks the generation failed if timeline writes fail.
- Adds timeline generation counts to parser output summaries for both standard `readesm` and HourWise helper-capture paths.

## Database/RPC Changes

Migration: `supabase/migrations/20260703133000_add_timeline_generation_read_models.sql`

Implemented read-only helper/RPC functions:

- `timeline_generation_json(...)`
- `timeline_event_json(...)`
- `timeline_gap_json(...)`
- `daily_timeline_summary_json(...)`
- `get_import_timeline_bundle(p_company_id, p_import_id)`
- `get_driver_timeline_bundle(p_company_id, p_driver_id, p_range)`
- `get_vehicle_timeline_bundle(p_company_id, p_vehicle_id, p_range)`

The bundle RPCs return `timeline-mvp-1` payloads containing current generations, events, gaps, daily summaries, source links where applicable, and warnings. They are `security definer` functions with explicit manager/company checks.

## Deliberate Boundaries

This task generates import-scoped timeline records only. It does not yet create fleet-range or standalone driver/vehicle rebuild jobs independent of an import.

Existing tachograph analysis UI paths remain unchanged. The new RPCs are available for the next UI/API adapter slice but are not wired into the frontend yet.

Compliance outcomes still read existing tachograph-derived rows. A later task should switch compliance calculation to timeline events once timeline bundle reads are verified in the application layer.

## Validation

Added static regression coverage in `src/lib/tacho/securityRegression.test.ts` for:

- timeline generation from parser-derived rows;
- current/superseded generation lifecycle;
- generation wiring in both standard and HourWise parser paths;
- read-only import, driver, and vehicle timeline bundle RPCs;
- manager company scoping on security-definer RPCs.

Run command:

```bash
npm run test:rules
```

## Rollback Strategy

If this must be rolled back before production timeline generation is relied upon:

1. Revert the `process-tacho` timeline generation calls and helper functions.
2. Drop or supersede `supabase/migrations/20260703133000_add_timeline_generation_read_models.sql` before it is applied.
3. Keep `TIME-002` schema tables in place unless no timeline rows exist and a full schema rollback is explicitly approved.

If timeline rows already exist, use a forward-fix. Do not delete generated timeline history unless it is confirmed unused by compliance, evidence, reports, Atlas, or review records.

## Next Task

Next practical task: wire timeline bundle reads into the app/API adapter layer behind existing tachograph views, starting with import timeline bundle access and non-destructive comparison against existing tachograph bundle output.
