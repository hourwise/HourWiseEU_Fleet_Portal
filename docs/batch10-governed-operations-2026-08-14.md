# Batch 10 — Governed Operations Execution

Status: implemented locally; Supabase migrations are pending deployment and verification.

## Scope

Batch 10 adds a governed execution slice for fleet operations. The browser can display readiness and offer actions, but the server remains authoritative for assignment eligibility, overrides, role/permission checks, company scope, optimistic concurrency, state transitions, and audit events.

This batch deliberately does not add route-provider integration, GPS or live location, ETA claims, trailer redesign, automated customer messaging, conversational Atlas, or an independent task database.

## Asset assignment policy

`get_asset_assignment_policy(company_id, vehicle_id)` is the canonical database policy used by assignment triggers and the governed create/update wrappers.

- `ready`: assignment may proceed.
- `warning`: assignment may proceed; the warning is shown to the manager.
- `unknown` or `action_required`: assignment is blocked until a governed override is recorded.
- `prohibited`: a hard block. VOR and unresolved safety defects cannot be overridden.

The policy treats missing evidence as unknown. It evaluates VOR, unresolved defect evidence, MOT or annual-test dates, PMI, tachograph calibration, insurance, LOLER where applicable, and vehicle-document evidence. The TypeScript evaluator remains a display/read model and is not trusted for authorization.

`create_asset_assignment_override` requires a manager with `operations.asset.override_assignment`, a 20–1000 character reason, the expected shift `updated_at`, and company/shift/vehicle consistency. The override stores the evaluated policy and reason, is visible to company managers under RLS, and is recorded through `record_security_event`. Active overrides are scoped to the shift and vehicle.

The `shifts` and `job_assignments` triggers enforce the same policy for direct writes. Browser create/update paths use `create_job_assignment_with_asset_guard` and `update_shift_with_asset_guard`; the legacy event-writing functions remain internal implementations behind those guards.

## Governed job execution

`transition_job_assignment_with_event` is the server-side state machine. Drivers may transition only their own assignment on their own shift and only through the permitted sequence:

`published/updated → acknowledged → started → arrived → completed`

Drivers may report `delayed` from an in-progress state and may report `unable_to_complete`, `vehicle_issue`, `site_issue`, or `route_issue` with a reason. A delayed assignment can be resumed. Managers with `operations.job.transition` may cancel through the governed function; manager execution mutation is intentionally conservative in this batch.

Every accepted transition writes the corresponding `fleet_events` record with actor, assignment/shift/job identifiers, prior and new status, reason, and appropriate priority. Exception states require driver acknowledgement by default. Stale `updated_at` values fail with an optimistic-concurrency error so the UI must reload rather than silently overwrite another action.

Driver RLS exposes active assigned work, including the new execution statuses. The UI uses the returned `updated_at` as the concurrency token and reports server errors without presenting a local success claim.

## Manager task queue and Atlas

`fetchOperationalTasks` projects a deterministic queue from current Portal records:

- unacknowledged fleet events;
- open vehicle safety defects;
- delayed or exception job assignments;
- published jobs not yet acknowledged;
- passed planned windows without a start state, explicitly not a driver-location assertion;
- published shifts with no active job assignment;
- asset readiness evidence tasks and assigned hard blocks.

Task IDs are source-prefixed and stable. Sorting is severity, due/occurred time, then source ID. No task row is persisted. The manager queue links back to the relevant Portal workspace and exposes loading, error, empty, and filter states.

Atlas uses the same structured inputs and now summarizes delayed, unable-to-complete, vehicle/site/route issue, unacknowledged, and no-start signals. It does not infer live position, lateness, ETA, or customer impact.

## Deployment and verification boundary

Apply these migrations in order after the existing migration history is available:

1. `20260814120000_batch10_governed_operations.sql`
2. `20260814123000_batch10_job_execution_lifecycle.sql`

After deployment, verify the enum values, function signatures/grants, RLS policies, assignment triggers, and security audit rows in the target Supabase project. Regenerate `src/lib/database.types.ts` after the migration is applied; this local batch intentionally uses narrow runtime unions and untyped RPC adapters where generated types still describe the pre-deployment enum.

Local validation covers TypeScript, focused contracts, changed-file lint, the existing rules suite, the production build, and `git diff --check`. No migration push is implied by this document.
