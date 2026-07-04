# TIME-004 Timeline Bundle API Adapter Wiring

Date: 2026-07-03
Status: Complete
Scope: app/API adapter access to timeline bundle RPCs behind existing tachograph views

## Outcome

`TIME-004` is implemented as a non-destructive app adapter slice. Existing tachograph views continue to use the current parser bundle shape, while API fetchers now attempt to load timeline bundle data and attach comparison metadata for verification.

## Runtime Changes

Files:

- `src/lib/tacho/rules/types.ts`
- `src/lib/tacho/api.ts`
- `src/lib/tacho/adapters.ts`

Implemented:

- Added typed timeline bundle structures for generations, events, gaps, daily summaries, sources, and comparison metadata.
- Added `fetchImportTimelineBundle(...)`, `fetchDriverTimelineBundle(...)`, and `fetchVehicleTimelineBundle(...)` API helpers.
- Added timeline RPC names for `get_import_timeline_bundle`, `get_driver_timeline_bundle`, and `get_vehicle_timeline_bundle`.
- Existing `fetchTachoImportBundle(...)`, `fetchDriverTachoAnalysisBundle(...)`, and `fetchVehicleUnitAnalysisBundle(...)` now attempt timeline bundle reads after the existing tachograph bundle succeeds.
- Timeline RPC failures are isolated: existing tachograph bundle reads still return successfully, with a warning in `timelineComparison`.
- Added `attachTimelineComparison(...)` and `compareTachoBundleToTimeline(...)` to attach counts and availability without transforming existing bundle data.

## Deliberate Boundaries

This task does not replace existing tachograph UI rendering with timeline events. It only makes timeline bundle data available behind existing fetchers and provides non-destructive comparison metadata.

This task does not change compliance calculations. Compliance remains on the existing tachograph-derived model until timeline reads are verified in the application layer.

The remote database must have `20260703133000_add_timeline_generation_read_models.sql` applied before timeline RPCs can return data. Until then, the adapter catches the RPC failure and continues serving the existing tachograph bundle.

## Validation

Added regression coverage in:

- `src/lib/tacho/adapters.test.ts`
- `src/lib/tacho/securityRegression.test.ts`

Covered:

- timeline comparison attaches without changing existing parser bundle arrays;
- event/gap/day-summary counts are compared;
- API constants and fetchers call the new timeline RPCs;
- existing tachograph bundle fetchers still call legacy bundle RPCs and attach timeline comparison behind them;
- missing timeline RPCs produce a warning instead of breaking existing views.

Run command:

```bash
npm run test:rules
```

`npm run typecheck` was also run. It still fails on the existing project-wide baseline errors outside the TIME-004 files; no new typecheck errors were reported in `src/lib/tacho/api.ts`, `src/lib/tacho/adapters.ts`, `src/lib/tacho/adapters.test.ts`, or `src/lib/tacho/rules/types.ts`.

## Rollback Strategy

If this slice must be rolled back:

1. Remove the optional timeline fetches from existing tachograph bundle fetchers.
2. Keep the timeline RPC migration and database tables in place unless no runtime timeline rows exist and schema rollback is explicitly approved.
3. Keep existing tachograph bundle RPCs unchanged; they remain the primary display path.

## Next Task

Next practical task: surface timeline comparison status in the Import Centre or analysis panels so managers can see whether timeline generation is present and count-aligned before replacing any view with timeline-native rendering.
