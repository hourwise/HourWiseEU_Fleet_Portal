# PARSE-002 Parser Run Lifecycle Implementation

Date: 2026-07-03
Status: Complete
Scope: `tachograph_processing_runs`, parser outputs/errors, and `process-tacho` lifecycle writes

## Outcome

`PARSE-002` is implemented as an additive parser-run lifecycle slice. Reprocessing now creates a new parser run, links it to the previous current run through `supersedes_parser_run_id`, marks older runs as non-current, and preserves prior parser-run history.

## Database Changes

Migration: `supabase/migrations/20260703113000_extend_parser_run_lifecycle.sql`

Implemented:

- Extends `public.tachograph_processing_runs` with parser name, parser config, lifecycle status, start/completion timing, duration, error summary, trigger source, supersession link, metadata, current marker, and run sequence.
- Backfills existing processing runs into the new lifecycle fields.
- Adds indexes for current run lookup, company/status diagnostics, and supersession traversal.
- Adds `public.tachograph_parser_outputs` for parser output summaries and diagnostic payloads.
- Adds `public.tachograph_parser_errors` for parser errors and warnings that need first-class queryability.
- Adds nullable `parser_run_id` references to current derived tachograph tables where safe.
- Enables manager read RLS on parser outputs and parser errors.

## Runtime Changes

File: `supabase/functions/process-tacho/index.ts`

Implemented:

- `createParserRun(...)` creates a `running` parser run after authorization and before parsing starts.
- The new run records parser identity, trigger source, actor metadata, and the previous current run ID where one exists.
- Older runs for the same import are marked `is_current = false`; their audit rows are not deleted.
- `completeParserRun(...)` updates the same run to `completed`, `completed_with_warnings`, or `failed`.
- Standard `readesm` and HourWise helper-capture paths now write parser output summaries.
- Failed parser executions now update the existing run and write parser error rows when a run exists.
- New derived normalized rows are tagged with `parser_run_id` where the table now supports it.
- `clearImportData(...)` no longer deletes `tachograph_processing_runs`.

## Deliberate Boundaries

This task does not fully convert the legacy derived-row cleanup model. Existing read models still read by `import_id`, so the processor continues replacing derived analysis rows for an import before writing the latest versioned output. Parser-run history and parser output/error diagnostics are retained; a later timeline/read-model task can switch consumers to current-run filtering and make derived-row history fully append-only.

This task does not change the older reset-control migration files that are already superseded by later archive-only migrations. Regression coverage now blocks reintroducing parser-run deletion in the active processor and PARSE-002 migration.

## Validation

Added static regression coverage in `src/lib/tacho/securityRegression.test.ts` for:

- parser lifecycle fields and status set;
- parser output/error tables;
- nullable `parser_run_id` links on derived tables;
- create-before-parse and complete-same-run processor behaviour;
- absence of parser-run deletion in the active processor and PARSE-002 migration.

Run command:

```bash
npm run test:rules
```

## Rollback Strategy

If the migration must be rolled back before production data depends on it:

1. Revert `process-tacho` to the previous late-insert parser-run behaviour.
2. Stop writing `tachograph_parser_outputs`, `tachograph_parser_errors`, and derived `parser_run_id` fields.
3. Drop `tachograph_parser_outputs` and `tachograph_parser_errors` only if their data has been exported or confirmed disposable.
4. Keep added columns on `tachograph_processing_runs` if any production parser-run rows have been written; dropping them would discard audit state.
5. If necessary, set `is_current = true` for the latest run per import using `processed_at desc` before redeploying older readers.

## Next Task

Next practical task: `TIME-002` - add timeline generation/event/source/gap schema now that parser runs are version-safe and derived rows can be associated with a parser-run identity.
