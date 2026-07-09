# ROTA-001 Driver Read-Only Upcoming Rota

Date: 2026-07-09
Status: Implemented locally
Runtime scope: Driver dashboard, read-only shift query helper

## Summary

`ROTA-001` adds a driver-facing read-only rota panel to the existing Driver Dashboard.

The slice deliberately uses the existing `shifts` table and existing manager `ShiftPlanner` workflow. No runtime enforcement, publishing, event-log, route planning, or manager editing behaviour changes were made.

## Implementation

Added:

- `src/lib/rota.ts`
- `src/lib/rota.test.ts`
- Driver Dashboard upcoming rota panel in `src/components/driver/DriverDashboard.tsx`

Updated:

- `package.json` `test:rules` now includes the rota helper test.

## Behaviour

The driver dashboard now shows:

- Today's shift count.
- A read-only "Upcoming Rota" panel.
- Shifts from today through the next 7 days.
- Shift date, start/end time, assigned vehicle registration, vehicle description when available, and notes.
- Loading, empty, and error states.

The dashboard refresh button now reloads both tachograph review actions and upcoming rota.

## Data Access

`fetchDriverUpcomingShifts(driverId)` queries:

- `shifts.id`
- `shifts.date`
- `shifts.start_time`
- `shifts.end_time`
- `shifts.notes`
- `shifts.vehicle_id`
- joined `vehicles.reg_number`, `vehicles.make`, and `vehicles.model`

The query filters by:

- `driver_id = profile.id`
- `date >= today`
- `date <= today + 7 days`

## Security Position

No migration was added in this slice.

The existing `20260422000000_create_shifts_table.sql` migration already enables RLS on `shifts` and includes:

- Managers can manage company shifts.
- Drivers can view their own shifts where `driver_id = auth.uid()`.

The new UI relies on that existing driver-owned SELECT policy.

## Known Constraint

`database.types.ts` is stale and does not include all live tables/features used elsewhere in the app. To avoid broad type-regeneration churn inside ROTA-001, `src/lib/rota.ts` uses a narrow local query contract and normalises unknown Supabase rows into a typed `DriverUpcomingShift` shape.

Full `npm run typecheck` remains blocked by pre-existing unrelated stale-type/schema drift across manager, marketing, subscription, vehicle, payroll, and reporting files. ROTA-001 did not attempt to fix those wider issues.

## Validation

Passed:

- `npx eslint src/lib/rota.ts src/lib/rota.test.ts src/components/driver/DriverDashboard.tsx`
- `npm run test:rules`
- `npm run build`
- `git diff --check` with only existing LF/CRLF warnings

Latest local `test:rules` result:

- 11 test files passed
- 116 tests passed

## Acceptance

- A driver can see their own upcoming shifts on the driver dashboard.
- The view is read-only.
- Manager shift creation/editing remains unchanged.
- No new database migration is required for the first slice.

## Next Step

`ROTA-002` should add publish/status/audit semantics before rota changes become event-backed.

