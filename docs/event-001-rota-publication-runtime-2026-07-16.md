# EVENT-001 Rota Publication Runtime

Date: 2026-07-16
Status: Deployed 2026-07-16

## Outcome

The manager rota **Publish** action now calls an atomic database function instead of updating `shifts` directly. One successful call:

1. Locks and publishes the draft or updated shift.
2. Creates or reuses that driver’s `rota` message thread.
3. Inserts `fleet_events.event_type = 'rota_shift_published'` for the assigned driver and links it to the shift.
4. Updates the thread’s latest event and returns the created IDs.

The event includes the shift date, start/end time, vehicle ID and notes payload. Events require driver acknowledgement by default. The manager Shift Planner now reads back the latest relevant shift event and shows a compact acknowledgement state without exposing driver notes.

## Files

- `supabase/migrations/20260716210000_add_rota_publish_event_rpc.sql`
- `src/components/manager/ShiftPlanner.tsx`
- `src/lib/event001RotaPublish.test.ts`

## Security

`rota.shift.publish` is an audited organisation-scoped permission granted to `fleet_administrator`.

During the current RBAC shadow phase, the function continues to enforce the existing manager/company condition. It compares that result with `actor_has_permission('rota.shift.publish', ...)` and records any mismatch. Every allowed or denied attempted publication is also recorded in the security audit log.

The function is `SECURITY DEFINER`, locks the shift row, accepts only draft or updated shifts, is revoked from `PUBLIC` and `anon`, and is executable by `authenticated` users only.

## Deployment Record

Deployed to the linked Supabase project on 2026-07-16 in this order:

1. `20260709100000_add_shift_publish_status_audit.sql`
2. `20260709110000_add_event_spine_foundation.sql`
3. `20260716210000_add_rota_publish_event_rpc.sql`

Post-deploy, publish a draft shift as a manager and confirm a matching `fleet_events` row, rota thread, shift audit event, and security audit event. Confirm the assigned driver can read the event but cannot read another driver’s event.

## Validation

Local checks:

- `npm run test:rules`
- focused ESLint for the changed TypeScript files
- `npm run build`

## Portal Driver Event Diagnostic

Implemented locally on 2026-07-16 as an internal Portal diagnostic/staging surface only:

- Driver Operational Home reads the deployed `driver_visible_fleet_events` view.
- Rota events requiring acknowledgement are counted and shown with an acknowledgement action.
- Acknowledgements are upserted to `driver_acknowledgements` under the existing driver-only RLS policy.

It is not the intended driver product and should not be deployed as a substitute for the separate Android Driver App.

## Manager Acknowledgement Readback

The existing manager RLS policy on `driver_acknowledgements` is reused. The
Portal loads company-scoped `fleet_events` and acknowledgement rows in batch,
matches an acknowledgement to the event's recipient driver, and selects the
latest event deterministically. It displays `Awaiting driver acknowledgement`
only when the latest relevant event requires acknowledgement and has no
matching row; otherwise it displays `Acknowledged` and the timestamp when
available. Events that do not require acknowledgement are not presented as
outstanding. Readback failures do not block rota planning, and stale week
responses are ignored.

## Next Task

Define the Portal job/route assignment outputs. Android integration work will consume the already-deployed rota lifecycle and manager-message event contracts in its own repository.
