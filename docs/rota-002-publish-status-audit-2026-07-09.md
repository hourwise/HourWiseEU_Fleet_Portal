# ROTA-002 Publishable Rota Status And Audit

Date: 2026-07-09
Status: Implemented locally, migration pending deployment
Runtime scope: manager shift planner, driver rota visibility, additive shift status/audit schema

## Summary

`ROTA-002` adds publish/status/audit semantics to the existing `shifts` workflow.

The implementation keeps the current manager `ShiftPlanner` and driver rota surfaces, but changes the lifecycle:

- Existing shifts are preserved and backfilled as `published`.
- New shifts are saved as `draft`.
- Draft shifts are hidden from drivers.
- Managers publish drafts when ready.
- Editing a published shift marks it as `updated`.
- Updated shifts remain visible to drivers and can be republished.
- Cancelled shifts are hidden from drivers.
- Shift lifecycle changes are recorded through a database trigger into `shift_audit_events`.

## Files

Added:

- `supabase/migrations/20260709100000_add_shift_publish_status_audit.sql`
- `src/lib/rota002PublishStatus.test.ts`

Updated:

- `src/components/manager/ShiftPlanner.tsx`
- `src/lib/rota.ts`
- `src/lib/rota.test.ts`
- `package.json`

## Migration

The migration adds:

- `shift_status` enum: `draft`, `published`, `updated`, `cancelled`
- `shifts.status`
- `shifts.published_at`
- `shifts.published_by`
- `shifts.cancelled_at`
- `shifts.cancelled_by`
- `shift_audit_events`
- Trigger function `record_shift_audit_event()`
- Trigger `record_shift_audit_event_trigger`

It also replaces the old driver shift SELECT policy:

- Old: drivers can view all own shifts.
- New: drivers can view own shifts only where `status IN ('published', 'updated')`.

## Manager Behaviour

Manager `ShiftPlanner` now shows status badges:

- `draft`
- `published`
- `updated`
- `cancelled`

Manager actions:

- Save new shift: creates a draft.
- Save edit to draft/cancelled shift: keeps draft.
- Save edit to published/updated shift: marks as updated.
- Publish: marks draft/updated shift as published and stamps `published_at`/`published_by`.
- Cancel: marks shift as cancelled and stamps `cancelled_at`/`cancelled_by`.

The legacy hard delete button has been replaced by cancellation from the grid.

## Driver Behaviour

Driver upcoming rota now queries only:

- `published`
- `updated`

The driver UI includes the returned shift status in its local model, but does not expose draft/cancelled shifts.

## Security Position

This slice still relies on the existing legacy manager/company shift management policy.

Security changes are limited to:

- driver read policy tightened to published/updated own shifts
- audit events table with manager company-scoped SELECT/INSERT policies
- trigger-backed audit insertions for insert/update/delete lifecycle changes

No central RBAC enforcement swap was made in this slice.

## Deployment

Deploy migration:

```powershell
supabase db push
```

If CLI auth remains blocked, apply `supabase/migrations/20260709100000_add_shift_publish_status_audit.sql` through Supabase Dashboard SQL, then repair/record migration history only after marker verification.

Suggested post-deploy checks:

```sql
select
  status,
  count(*) as shift_count
from public.shifts
group by status
order by status;

select
  count(*) as audit_event_count
from public.shift_audit_events;

select
  policyname,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
and tablename = 'shifts'
and policyname ilike '%driver%shift%';
```

## Validation

Passed locally:

- `npm run test:rules`
- `npx eslint src/lib/rota.ts src/lib/rota.test.ts src/lib/rota002PublishStatus.test.ts src/components/driver/DriverDashboard.tsx src/components/manager/ShiftPlanner.tsx`
- `npm run build`

Latest local `test:rules` result:

- 12 test files passed
- 119 tests passed

Known limitation:

- Full `npm run typecheck` remains blocked by pre-existing unrelated stale generated Supabase types and app type drift.

## Acceptance

- Existing shifts are not hidden after migration.
- New shifts are drafts until published.
- Drivers only see published/updated shifts.
- Managers can publish or cancel from the weekly grid.
- Shift lifecycle mutations are audit-recorded by database trigger.

## Next Step

`EVENT-001-DESIGN` should define how published rota changes become event-backed driver notifications before implementing push/realtime delivery.

