# EVENT-001-DESIGN Operational Event Spine Foundation

Date: 2026-07-09
Status: Deployed 2026-07-16; manager acknowledgement readback added 2026-08-09
Runtime scope: shared event/acknowledgement foundation plus manager readback

## Summary

`EVENT-001-DESIGN` adds the database foundation for a shared operational event spine.

This is intentionally additive. It does not switch the existing `MessagingHub`, driver dashboard, rota publishing, push notifications, or Atlas onto the new event spine yet.

## Purpose

The current app has separate operational surfaces:

- manager rota changes in `shifts`
- shift lifecycle audit in `shift_audit_events`
- direct/broadcast messages in `messages`
- driver tachograph acknowledgements in tacho-specific tables

ADR-0021 requires these to converge on a common backend event model so Portal, Driver App, messaging, rota, route/job planning, acknowledgements, push/realtime delivery, and Atlas can consume the same operational history.

## Files

Added:

- `supabase/migrations/20260709110000_add_event_spine_foundation.sql`
- `src/lib/event001EventSpine.test.ts`

Updated:

- `package.json`
- `docs/hourwise-concrete-implementation-plan-2026-07-09.md`
- `docs/source-of-truth-completion-plan-2026-07-02.md`
- `docs/source-of-truth/98 - Changelog.md`

## Schema

### `message_threads`

Purpose: thread container for broadcasts, direct messages, rota events, and future system conversations.

Key fields:

- `company_id`
- `thread_type`: `broadcast`, `direct`, `system`, `rota`
- `subject`
- `driver_id`
- `created_by`
- `last_event_id`
- `archived_at`

### `fleet_events`

Purpose: canonical operational event log.

Key fields:

- `company_id`
- `thread_id`
- `event_type`
- `priority`: `info`, `advisory`, `warning`, `critical`, `emergency`
- `actor_id`
- `recipient_driver_id`
- `related_shift_id`
- `related_message_id`
- `title`
- `body`
- `payload`
- `requires_ack`
- `expires_at`

Initial event types planned for implementation:

- `rota_shift_published`
- `rota_shift_updated`
- `rota_shift_cancelled`
- `message_sent`
- `driver_acknowledged`

### `driver_acknowledgements`

Purpose: generic driver acknowledgement/read model for events that need acknowledgement.

Key fields:

- `company_id`
- `event_id`
- `driver_id`
- `acknowledged_at`
- `note`

Constraints:

- unique `(event_id, driver_id)`
- drivers can only acknowledge events visible to them

### `messages` Compatibility Columns

Added nullable columns:

- `thread_id`
- `fleet_event_id`

Existing message reads/writes continue to work without using these columns.

## RLS And Security

Legacy manager/company security is preserved for this foundation slice.

Manager policies:

- managers can manage company message threads
- managers can manage company fleet events
- managers can view company driver acknowledgements

Driver policies:

- drivers can view direct threads assigned to them
- drivers can view broadcast threads for their company
- drivers can view direct events assigned to them
- drivers can view broadcast events for their company
- drivers can manage only their own acknowledgements
- driver acknowledgement inserts require the target event to be visible to that driver

The driver read model `driver_visible_fleet_events` uses `security_invoker = true`.

Manager acknowledgement readback is company-scoped and reuses the existing
`fleet_events` and `driver_acknowledgements` tables. The Portal batches the
latest relevant shift/job events, then batches acknowledgement rows without
selecting the private `note` field. It matches acknowledgements to both the
event and its `recipient_driver_id`, selects the newest event deterministically
by `created_at` and event ID, and treats an event with `requires_ack = false`
as `not_required` rather than outstanding.

## Non-Goals

The foundation migration itself does not:

- send push notifications
- alter the current `MessagingHub`
- create events from rota update/cancel (rota publication is implemented separately by EVENT-001 runtime)
- backfill old messages into threads
- expose event UI in the Driver Dashboard
- change central RBAC enforcement
- add Atlas event consumption

## Deployment Record

Deployed to the linked Supabase project on 2026-07-16:

```text
supabase/migrations/20260709110000_add_event_spine_foundation.sql
```

Suggested post-deploy checks:

```sql
select to_regclass('public.message_threads') as message_threads_table;
select to_regclass('public.fleet_events') as fleet_events_table;
select to_regclass('public.driver_acknowledgements') as driver_acknowledgements_table;
```

```sql
select
  table_name,
  column_name
from information_schema.columns
where table_schema = 'public'
and (
  table_name in ('message_threads', 'fleet_events', 'driver_acknowledgements')
  or (table_name = 'messages' and column_name in ('thread_id', 'fleet_event_id'))
)
order by table_name, ordinal_position;
```

```sql
select
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
and tablename in ('message_threads', 'fleet_events', 'driver_acknowledgements')
order by tablename, policyname;
```

## Validation

Passed locally:

- `npm run test:rules`
- `npx eslint src/lib/event001EventSpine.test.ts`

Latest local `test:rules` result:

- 13 test files passed
- 124 tests passed

## Acceptance

- Additive event/thread/ack schema exists.
- Existing `messages` remains compatible.
- Driver visibility is limited to assigned or company-broadcast events.
- Manager visibility is company-scoped.
- Acknowledgements are constrained to the driver and visible event.
- No push/realtime/UI behaviour changes until `EVENT-001` implementation.

## Manager Readback

The manager Shift Planner shows the latest relevant published/updated/cancelled
shift event as `Awaiting driver acknowledgement` or `Acknowledged` with the
acknowledgement timestamp when available. The Job Planner applies the same
readback to the latest `job_assigned`, `job_updated`, or `job_cancelled` event
for each assignment, including cancelled historical assignments.

The readback is deliberately non-blocking: loading or failure leaves the core
rota/job planning surface usable, and independent request tokens prevent an
older week or shift response from replacing a newer selection.

## Next Step

`EVENT-001` should continue the event-spine work with:

1. On rota publish, create or reuse a rota thread.
2. Insert `fleet_events.event_type = 'rota_shift_published'`.
3. Set `recipient_driver_id` to the assigned driver.
4. Set `related_shift_id`.
5. Optionally set `requires_ack = true`.
6. Show unread/ack state in the driver operational home.
