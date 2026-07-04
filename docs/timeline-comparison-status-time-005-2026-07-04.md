# TIME-005 Timeline Comparison Status Surfacing

Date: 2026-07-04
Status: Complete
Scope: manager-facing visibility for timeline generation presence and count alignment

## Outcome

`TIME-005` is implemented as a non-destructive UI observability slice. Managers can now see whether a timeline generation is present and whether timeline event, gap, and day-summary counts align with the existing tachograph-derived bundle before any screen is replaced with timeline-native rendering.

## Runtime Changes

Files:

- `src/lib/tacho/rules/types.ts`
- `src/lib/tacho/adapters.ts`
- `src/hooks/useTachoImports.ts`
- `src/components/manager/tachograph/TimelineComparisonStatus.tsx`
- `src/components/manager/tachograph/TachoImportCentre.tsx`
- `src/components/manager/tachograph/DriverCardAnalysis.tsx`
- `src/components/manager/tachograph/VehicleUnitAnalysis.tsx`

Implemented:

- Added optional `timelineComparison` metadata to import records, driver-card analysis data, and vehicle-unit analysis data.
- Preserved `timelineComparison` when adapting parser bundles to driver and vehicle analysis models.
- Attached import-scoped comparison metadata to live Import Centre rows after `fetchTachoImportBundle(...)` enrichment.
- Added a shared `TimelineComparisonStatus` component with badge and panel variants.
- Added Import Centre queue badges for `Timeline aligned`, `Timeline missing`, `Timeline mismatch`, and `Timeline unchecked` states.
- Added an Import Centre summary card for aligned timeline count.
- Added selected-import timeline comparison details with tachograph-vs-timeline counts for events, gaps, and day summaries.
- Added support diagnostics entries for timeline generation ID and comparison counts.
- Added timeline comparison panels to Driver Card Analysis and Vehicle Unit Analysis.

## Deliberate Boundaries

This task does not switch any existing tachograph view to timeline-native rendering.

This task does not change parser output, timeline generation, compliance outcomes, or evidence reports.

Timeline comparison remains advisory observability. Existing tachograph bundle data remains the display source until alignment has been validated in live manager workflows.

## Validation

Run command:

```bash
npm run test:rules
```

Result:

- 7 test files passed.
- 95 tests passed.

`npm run typecheck` was also run. It still fails on the existing project-wide baseline errors outside this slice. No new typecheck errors were reported for `TimelineComparisonStatus.tsx`, the changed timeline comparison data path, or the import/analysis component changes. Existing tachograph typecheck errors remain in unrelated activity timeline rendering code.

## Rollback Strategy

If this slice must be rolled back:

1. Remove `TimelineComparisonStatus.tsx` and its imports/usages in Import Centre, Driver Card Analysis, and Vehicle Unit Analysis.
2. Keep the `timelineComparison` type pass-through fields if future work still needs the metadata.
3. If the metadata pass-through must also be removed, delete the optional fields from the analysis/import types and remove the adapter/hook assignments.

## Next Task

Next practical task: validate the newly surfaced comparison state against live imports and use the results to choose the first timeline-native rendering candidate. Do not replace a production view until Import Centre shows timeline generation is present and count-aligned for representative driver-card and VU imports.
