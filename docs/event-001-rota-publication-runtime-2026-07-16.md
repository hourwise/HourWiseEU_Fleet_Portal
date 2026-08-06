# EVENT-001 Rota Publication Runtime

Date: 2026-07-16
Status: Deployed 2026-07-16

## Outcome

The manager rota **Publish** action now calls an atomic database function instead of updating `shifts` directly. One successful call:

1. Locks and publishes the draft or updated shift.
2. Creates or reuses that driver’s `rota` message thread.
3. Inserts `fleet_events.event_type = 'rota_shift_published'` for the assigned driver and links it to the shift.
4. Updates the thread’s latest event and returns the created IDs.

The event includes the shift date, start/end time, vehicle ID and notes payload. Events require driver acknowledgement by default; the driver unread/acknowledgement UI remains the next slice.

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

## Next Task

Define the Portal job/route assignment outputs. Android integration work will consume the already-deployed rota lifecycle and manager-message event contracts in its own repository.
