# TIME-002 Timeline Generation/Event/Source/Gap Schema

Date: 2026-07-03
Status: Complete
Scope: timeline generation, event, source, gap, and daily summary schema

## Outcome

`TIME-002` is implemented as an additive schema slice. The database now has the core tables needed for versioned timeline generation without changing current tachograph analysis read paths.

## Database Changes

Migration: `supabase/migrations/20260703123000_add_timeline_generation_event_schema.sql`

Implemented tables:

- `timeline_generations`
- `timeline_events`
- `timeline_event_sources`
- `timeline_gaps`
- `daily_timeline_summaries`

Implemented controls:

- generation status, reason, scope, current/superseded fields, and parser-run links;
- event confidence, status, import, parser-run, and source compatibility fields;
- event-source rows for reverse evidence lookup and parser output linkage;
- reviewable gap records for missing/conflicting/unresolved periods;
- daily summary records for future UI and reporting reads;
- updated-at triggers for mutable derived records;
- indexes for current generation reads, driver/vehicle timeline range reads, source lookup, gap queues, and daily summaries;
- explicit manager same-company read RLS and driver own-timeline read RLS.

## Deliberate Boundaries

This task is schema-only. It does not yet generate timeline rows from `tachograph_activity_segments`, `tachograph_technical_events`, vehicle motion discrepancies, reconciliation items, or work sessions.

Existing driver, vehicle, and import tachograph bundle RPCs are unchanged. They continue to read the current tachograph-derived tables until a generation worker and timeline read-model RPCs are introduced.

`event_type` is constrained only as non-empty text. This avoids hard schema churn while the timeline engine expands beyond tachograph MVP events into app work sessions, manual entries, telematics, and future evidence sources.

## Validation

Added static regression coverage in `src/lib/tacho/securityRegression.test.ts` for:

- all five timeline tables;
- generation version/current/supersession fields;
- parser-run, parser-output, and import source traceability;
- gap status/type constraints;
- tenant-scoped RLS policies;
- core read and source lookup indexes.

Run command:

```bash
npm run test:rules
```

## Rollback Strategy

If rollback is needed before production timeline rows exist:

1. Drop the five new timeline tables in dependency order: `daily_timeline_summaries`, `timeline_gaps`, `timeline_event_sources`, `timeline_events`, `timeline_generations`.
2. Drop `public.set_timeline_updated_at()` only if no later migration depends on it.
3. Keep existing tachograph tables and parser-run lifecycle tables unchanged.

If production timeline rows exist, use a forward-fix instead. Dropping these tables would discard derived timeline audit history and break evidence traceability.

## Next Task

Next practical task: implement timeline generation from parser-derived tachograph rows, starting with import-scoped generation for `process-tacho` outputs and a read-only bundle RPC for current timeline events/gaps.
