# ROUTE-001 Job and Route Assignment Design

Date: 2026-07-17
Status: First job-assignment foundation deployed 2026-07-17; route-estimate implementation pending
Scope: Manager Portal creates shared job/route assignments for the separate Android Driver App to consume.

## Decision

The Portal is the operational authoring surface. It creates jobs, attaches them to a driver shift, records an advisory route plan, and emits driver-visible events through the existing event spine.

The Android Driver App consumes the shared Supabase data. It does not call the Portal directly. This slice does not build Android UI, live HGV navigation, route optimisation, or POD capture.

## First Deliverable

Implemented in the Manager Portal against an existing published or updated shift:

- job reference and title
- delivery, collection, or other job type
- customer/site name and free-text address
- optional contact/instructions
- planned arrival/departure window and expected duration
- shift sequence
- manager notes

The manager can publish the assignment to the driver. A published assignment produces a `job_assigned` event, linked to the shift and recipient driver. Later edits/cancellation will produce `job_updated` and `job_cancelled` events.

## Additive Data Model

| Table | Purpose | Key fields |
| --- | --- | --- |
| `jobs` | Company-owned job definition and customer/site instructions. | `company_id`, `reference`, `title`, `job_type`, `customer_name`, `address_text`, contact/instructions, planned windows, expected duration, manager notes, status. |
| `job_assignments` | Assigns a job to one driver shift in an ordered sequence. | `company_id`, `job_id`, `shift_id`, `driver_id`, `vehicle_id`, `sequence`, assignment status, published timestamps. |
| `route_plans` | Advisory route-estimate snapshot for one shift. | `company_id`, `shift_id`, provider/version, estimated distance/duration, generated time, advisory metadata. |
| `route_plan_legs` | Ordered estimated route legs. | `route_plan_id`, `sequence`, origin/destination text, linked job, distance/duration estimates, warnings. |

`jobs` remains separate from assignments, allowing a job to be reassigned without overwriting its customer/site context. `job_assignments` copies the driver and vehicle context needed for secure Android reads and historical analysis.

No route provider is introduced in this first data-model slice. A manager may store a route estimate only after a controlled provider boundary is selected. All driver wording must state that estimates are advisory and approved HGV navigation, road signs, site rules, traffic conditions, and professional judgement take precedence.

## Status Model

Job assignment status will be one of:

`draft`, `published`, `updated`, `en_route`, `arrived`, `in_progress`, `delayed`, `completed`, `unable_to_complete`, `cancelled`.

The Portal controls planning statuses through `updated`. The Android app will later write driver operational statuses, actual arrival/departure timestamps, delay reason, driver notes, and completion evidence through scoped RPCs.

## Event Contract

Until explicit `related_job_id` and `related_route_plan_id` columns are added to `fleet_events`, job/route IDs are included in its JSON payload. Every event must include the assigned driver, related shift, a human-readable title/body, and an immutable summary of the relevant change.

| Action | Event type | Default acknowledgement |
| --- | --- | --- |
| Publish a job assignment | `job_assigned` | true |
| Edit a published assignment | `job_updated` | true |
| Cancel a published assignment | `job_cancelled` | true |
| Publish/update a route estimate | `route_plan_published` / `route_plan_updated` | true |
| Driver status update (future Android scope) | `job_status_updated` | false |

## Security and Audit

- New permission keys will be `operations.job.create`, `operations.job.update`, `operations.job.publish`, `operations.job.cancel`, and `operations.route.update`.
- During the existing RBAC shadow period, manager/company access remains the enforced compatibility path and permission comparison is audit-only.
- Manager writes must use security-definer RPCs that lock the target shift/assignment and create the assignment/event/audit records atomically.
- Driver reads must be limited to assignments for the signed-in driver and published/updated operational state.
- The Android app must not receive service-role credentials or unrestricted company data.

## Portal UI Boundary

Implementation will add a manager Job Planner linked from the existing Shift Planner. It will show only the manager’s company shifts, let a manager add/reorder assignments for one selected shift, and show advisory route-estimate state. It will not create a second driver UI in the Portal.

## Delivery Sequence

1. [x] Add the additive schema, RLS policies, permissions, and atomic manager publish RPC.
2. [x] Add the Portal Job Planner for create/publish assignments.
3. [x] Add manager job edit/cancel with driver-visible lifecycle events and audit records. Controlled route-estimate storage remains deferred.
4. Hand the Android agent the stable data/event contract for its unfinished schedule, messages, job, and route screens.
5. Add Android driver-status/POD actions only in the Android repository.

## Acceptance Criteria

- A manager can assign a planned job to a company driver and published shift.
- The assignment is visible through a driver-scoped shared-backend read model.
- Publishing, editing, and cancelling create auditable driver-visible events.
- The Portal never claims to provide live HGV navigation.
- Existing rota and two-way messaging remain compatible.

## Manager Edit/Cancel Completion Notes

The additive migration `20260809100000_complete_route_001_job_assignment_lifecycle.sql` adds locked, company-scoped `update_job_assignment_with_event` and `cancel_job_assignment_with_event` RPCs. Both require the assignment `updated_at` value observed by the manager UI, reject stale writes, and write the fleet event plus `record_security_event` audit row in the same transaction. The edit RPC updates only the driver-visible job contract and deliberately has no manager-notes parameter.

Verification is covered by `src/lib/route001JobAssignment.test.ts`, with UI/load and sequence protections covered by the focused Job Planner helper tests. Rollback is additive: remove the two RPCs and permission catalogue grants if needed, retaining historical job, assignment, event, and audit rows.

## Open Business Inputs Before Route Provider Work

- Preferred route-estimate provider and licence/billing owner.
- Customer/site master-data source versus manual entry.
- Whether job references must be unique per company.
- POD evidence, signature, photograph, and retention requirements.
