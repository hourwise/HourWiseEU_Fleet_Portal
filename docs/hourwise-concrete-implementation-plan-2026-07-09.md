# HourWise Concrete Implementation Plan

Date: 2026-07-09
Status: Active implementation plan
Scope: current React/Supabase build, source-of-truth plan, ADR-0020 to ADR-0029, and new planning notes

## Purpose

This plan converts the current source-of-truth and new feature planning into an implementation sequence that fits the existing application.

It does not replace the security/backend work. `SEC-*`, `MIG-*`, and schema hardening tasks continue as gates inside each feature phase.

## Inputs Reviewed

- `docs/source-of-truth-completion-plan-2026-07-02.md`
- `docs/adr/ADR-0020` rota, jobs, route estimates, and compliance-aware route updates
- `docs/adr/ADR-0021` unified event synchronisation, messaging, and Atlas integration
- `docs/adr/ADR-0028` preventive maintenance and asset compliance rule engine
- `docs/adr/ADR-0029_Atlas_Driver_Assistant_And_Voice_Operations.md`
- `docs/atlas-operations-platform-architecture-2026-07-09.md`
- `docs/generic-work-management-vs-purpose-built-fleet-compliance-2026-07-09.md`
- `docs/enterprise-architecture-specification-expansion-plan-2026-07-09.md`
- Current app shell: `src/App.tsx`
- Current manager shell: `src/components/manager/ManagerDashboard.tsx`
- Current driver shell: `src/components/driver/DriverDashboard.tsx`
- Current rota surface: `src/components/manager/ShiftPlanner.tsx`
- Current messaging surface: `src/components/manager/MessagingHub.tsx`
- Current fleet/vehicle surfaces: `VehicleManagement`, `VehicleChecksModule`, maintenance and compliance components

## Current Build Assessment

The portal already has enough structure to begin feature implementation without a rebuild.

| Area | Current State | Implementation Implication |
| --- | --- | --- |
| Routing and app shell | Single authenticated dashboard route with manager/driver split by profile role. | Keep this shape for now; add operational surfaces inside existing dashboards before adding new route complexity. |
| Manager dashboard | Workspace navigation exists for dashboard, people, fleet, compliance, reports, and settings. | New features can land as new sections/cards inside existing workspaces. |
| Rota | `ShiftPlanner` exists and uses a simple `shifts` table with driver, vehicle, date, time, and notes. | Start with this as the compatibility layer. Do not wait for the full `rota_assignments` model before making rota visible to drivers. |
| Messaging | `MessagingHub` exists on a direct `messages` table with broadcast/direct messages and realtime updates. | Keep the UI, then move writes/reads behind an event-backed model in phases. |
| Driver dashboard | Driver view is currently centred on tachograph review actions and acknowledgements. | This is the biggest user-facing gap. Add operational home cards for rota, messages, assigned vehicle, and tacho actions. |
| Fleet and maintenance | Vehicle management already tracks compliance dates, odometer, VOR, maintenance called, and audit trail. | Build the rule engine later around these existing data points instead of replacing the vehicle module first. |
| Atlas | Atlas is present as planning/marketing/dashboard beta intent, not as an operational backend. | Build deterministic Atlas Operations API summaries before conversational or voice assistant work. |
| Security | Additive RBAC foundation, SEC-010 shadow comparison, and SEC-012 health checks are in place locally/deployed as documented. | Every new protected feature should add permission checks, RLS tests, and audit points as part of the feature slice. |

## Product Implementation Decision

The next useful product step is not broad Atlas or route optimisation. The next useful product step is the operational spine:

1. Rota visible to drivers.
2. Rota and messages becoming event-backed.
3. Driver dashboard becoming an operational home.
4. Jobs and route plans added onto the rota/event spine.
5. Asset compliance rule engine added onto existing vehicle data.
6. Atlas summarising deterministic operational data.
7. Atlas driver assistant and voice after the approved knowledge and safety model exist.

This order keeps implementation aligned with the current codebase and reduces schema churn.

## Phase Plan

### Phase 0 - Stabilise The Build Path

Status: In progress through `SEC-*`, `MIG-*`, and local test coverage.

Goal: keep the repo safe to build on while features move.

Tasks:

- Run `SEC-012` before deploying any new protected feature.
- Resolve the current Supabase CLI `db push --dry-run` login-role authentication blocker or document Dashboard-only deployment for the next migration.
- Refresh generated database types or document why `database.types.ts` is intentionally stale.
- Keep `npm run test:rules` passing after each security/schema planning change.
- Add migration-history notes whenever `supabase migration repair` or Dashboard SQL is used.

Completion gate:

- Migration history remains aligned.
- Security health checks do not show shadow permission mismatches.
- New feature migrations have explicit rollback notes and RLS/security tests.

### Phase 1 - ROTA-001 Driver Read-Only Rota

Status: Implemented locally 2026-07-09. See `docs/rota-001-driver-read-only-rota-2026-07-09.md`.

Goal: turn the existing manager shift planner into visible driver value without a major schema rewrite.

Implementation:

- Add a driver-facing rota panel to `DriverDashboard`.
- Read the authenticated driver's own `shifts` for today and the next 7 days.
- Show date, start/end time, vehicle registration, and notes.
- Add empty/loading/error states suitable for a driver.
- Keep manager write behaviour in `ShiftPlanner` unchanged.
- Add a small data-access helper rather than embedding all Supabase queries in the component.

Schema impact:

- Prefer no migration for the first slice.
- If the live `shifts` table lacks required driver SELECT policy, add only a narrow RLS/policy migration.

Security:

- Driver reads only own shifts.
- Manager reads remain company-scoped.
- Add permission/RLS checks to the `SEC-012` checklist when the policy is confirmed.

Acceptance:

- A driver can see their upcoming shifts after manager-created shifts exist.
- A driver cannot read another driver's shifts.
- Existing manager shift creation/editing still works.

Likely files:

- `src/components/driver/DriverDashboard.tsx`
- `src/lib/rota.ts` or equivalent new data helper
- `src/lib/database.types.ts` if types are refreshed
- Optional Supabase migration only if policy/type drift requires it

### Phase 2 - ROTA-002 Publishable Rota Changes

Status: Implemented locally 2026-07-09; migration pending deployment. See `docs/rota-002-publish-status-audit-2026-07-09.md`.

Goal: make rota changes explicit operational events rather than silent table edits.

Implementation:

- Add shift status fields such as `draft`, `published`, `updated`, and `cancelled`.
- Add `published_at` and `published_by`.
- Add manager action to publish a shift or week.
- Show driver-facing "updated" markers.
- Add audit records for created, updated, published, and cancelled shifts.

Schema impact:

- Additive columns on `shifts` for compatibility, or create `rota_assignments` with a compatibility view if the schema review shows `shifts` is too limited.

Security:

- Keep legacy manager role enforcement first if needed.
- Add shadow permission comparison for the new rota update operation before enforcement swaps.

Acceptance:

- Managers can draft and publish.
- Drivers only see published/currently valid assignments unless explicitly allowed otherwise.
- Rota mutations are auditable.

### Phase 3 - EVENT-001 Operational Event Spine

Status: Foundation design implemented locally 2026-07-09; migration pending deployment. See `docs/event-001-operational-event-spine-design-2026-07-09.md`.

Goal: unify rota updates, messages, acknowledgements, notifications, and future Atlas recommendations.

Implementation:

- Add `fleet_events` as the canonical operational event log.
- Add `message_threads` and connect `messages` to threads/events without breaking the current `MessagingHub`.
- Add `driver_acknowledgements`.
- Create RPC boundaries for `create_fleet_event`, `send_message`, and `acknowledge_event`.
- Start with rota events and message events only.

Schema impact:

- New additive tables.
- Existing `messages` table remains readable during transition.
- Backfill is optional for old messages unless needed for UI continuity.

Security:

- Event visibility must be organisation/company scoped.
- Driver visibility must be based on direct recipient, assignment, or broadcast membership.
- Managers need operation-level permissions for broadcast and system event creation.

Acceptance:

- A manager message creates an event-backed thread.
- A rota publication creates an event visible to the assigned driver.
- Driver acknowledgements are visible to managers.
- Existing message UI still works during migration.

### Phase 4 - DRIVER-001 Driver Operational Home

Status: Build after ROTA-001 starts proving useful.

Goal: make the driver dashboard a daily work surface, not only a tachograph review surface.

Implementation:

- Add "Today" summary card.
- Add upcoming rota list.
- Add unread messages/events count.
- Add assigned vehicle card.
- Keep tachograph review actions and acknowledgements prominent.
- Add acknowledgement/read actions once EVENT-001 exists.

Security:

- Driver data must be own-driver only.
- Vehicle visibility should be limited to assigned/current operational context until the wider site/organisation model is complete.

Acceptance:

- Driver can answer: "What am I doing today?", "What vehicle am I using?", "Do I have messages?", and "Do I have tacho actions?"

### Phase 5 - ROUTE-001 Job And Route Planning MVP

Status: Defer until rota/event spine exists.

Goal: add job and route planning as operational assignments, not as standalone map tooling.

Implementation:

- Add `job_assignments`, `route_plans`, and `route_plan_legs`.
- Store planned and actual job duration.
- Store route estimate metadata and provider/version.
- Add delay reason and manager/driver update flow.
- Add advisory compliance warnings, not live navigation.
- Provide external navigation handoff only.

Security:

- Managers can plan within their organisation/company scope.
- Drivers can read assigned jobs/routes only.
- Reports/exports require explicit permissions and audit events.

Acceptance:

- Manager can assign a job to a driver/vehicle/day.
- Driver can see job details and route summary.
- Driver can mark delayed/arrived/completed.
- Route wording is advisory and does not claim HGV navigation authority.

### Phase 6 - ASSET-001 Maintenance Rule Engine

Status: Defer until driver/rota/event spine is useful.

Goal: evolve the existing vehicle compliance fields into a rule-driven maintenance and asset compliance system.

Implementation:

- Add asset rules for date, mileage, engine hours, and whichever-comes-first obligations.
- Add readings with reading source and freshness/staleness markers.
- Add due states and evidence records.
- Start with vehicles, then add trailers/equipment later.
- Use existing vehicle compliance dates and maintenance audit trail as source inputs where possible.

Security:

- Site/organisation visibility must be respected as the multi-site model lands.
- Maintenance exports require audit.

Acceptance:

- Fleet manager can see due/overdue/stale-reading obligations.
- A rule calculation can explain why an item is due.
- Evidence can be attached to a completed obligation.

### Phase 7 - ATLAS-001 Deterministic Operations API

Status: Build before conversational Atlas.

Goal: make Atlas useful by exposing safe, deterministic operational summaries first.

Implementation:

- Add operations API/query functions for daily briefing, overdue maintenance, open defects, missing checks, rota gaps, unread acknowledgements, and compliance risk summaries.
- Replace dashboard Atlas beta card with a real read-only briefing panel.
- Keep responses structured and query-derived.
- Do not allow Atlas to mutate data in this phase.

Security:

- Atlas inherits caller context.
- Atlas must not bypass RLS.
- Audit Atlas requests/responses when enabled beyond local deterministic UI summaries.

Acceptance:

- Manager can open Atlas briefing and see only data they are allowed to see.
- Briefing links back to source records.
- No action is performed by Atlas.

### Phase 8 - ATLAS-DRIVER-001 Driver Assistant And Voice

Status: Later phase.

Goal: add driver-facing Atlas only after the operational data, approved knowledge base, and driving-safe model are ready.

Implementation:

- Approved knowledge sources only.
- Typed assistant first.
- Voice after driving-safe mode and response constraints are implemented.
- Action templates only, with driver confirmation.

Security:

- Driver context only.
- No cross-driver, cross-site, or support-level visibility.
- Audit all assistant interactions.

Acceptance:

- Driver can ask operational questions about their own assignments, messages, site instructions, and tachograph reminders.
- Assistant refuses unsafe, unauthorised, or unsupported requests.

## Concrete Backlog

| ID | Task | Priority | Depends On | Runtime Change |
| --- | --- | --- | --- | --- |
| `IMPL-001` | Refresh current schema/type position for `shifts`, `messages`, and driver dashboard data needs. | P0 | Current repo | No |
| `ROTA-001` | Add driver read-only upcoming rota from existing `shifts`. | P0 | `IMPL-001` | Yes - implemented locally 2026-07-09 |
| `SEC-013` | Add rota read visibility checks to the security health/check test plan. | P0 | `ROTA-001` schema decision | Maybe |
| `ROTA-002` | Add publish/status/audit semantics to shifts. | P1 | `ROTA-001` | Yes - implemented locally 2026-07-09, migration pending deployment |
| `EVENT-001-DESIGN` | Design additive event/thread/ack schema with compatibility to current `messages`. | P1 | `ROTA-001` | No - implemented locally 2026-07-09, migration pending deployment |
| `EVENT-001` | Implement event-backed messages and rota publication events. | P1 | `EVENT-001-DESIGN`, security review | Yes |
| `DRIVER-001` | Expand driver dashboard into Today/Rota/Messages/Tacho operational home. | P1 | `ROTA-001`, partial `EVENT-001` | Yes |
| `ROUTE-001-DESIGN` | Finalise route/job schema, provider boundary, advisory wording, and delay flow. | P2 | `EVENT-001` | No |
| `ROUTE-001` | Implement job and route planning MVP. | P2 | `ROUTE-001-DESIGN` | Yes |
| `ASSET-001-DESIGN` | Design asset rule/readings/due-state/evidence model around existing vehicle data. | P2 | Security/site model progress | No |
| `ASSET-001` | Implement first vehicle maintenance rule engine slice. | P2 | `ASSET-001-DESIGN` | Yes |
| `ATLAS-001-DESIGN` | Define deterministic Atlas Operations API query set and audit boundary. | P2 | `EVENT-001`, `ASSET-001-DESIGN` | No |
| `ATLAS-001` | Implement read-only Atlas operations briefing. | P3 | `ATLAS-001-DESIGN` | Yes |
| `ATLAS-DRIVER-001` | Implement driver assistant/voice foundation. | P4 | `ATLAS-001`, approved knowledge base, driving-safe model | Yes |

## Immediate Sprint Recommendation

Start with `IMPL-001` and `ROTA-001`.

Reason:

- The current repo already has `ShiftPlanner` and a `shifts` migration.
- Driver dashboard has a clear gap and can be improved without waiting for route planning or Atlas.
- This validates the shared Portal/App operating model from ADR-0020 in the smallest possible slice.
- It gives a practical security target for the RBAC foundation: driver own-shift read access and manager company-scoped shift management.

Minimum build slice:

1. Confirm live/local `shifts` columns and RLS policy.
2. Add a `getDriverUpcomingShifts` helper.
3. Add a driver dashboard rota panel.
4. Add loading/empty/error states.
5. Add tests or static query-contract checks where practical.
6. Run `npm run test:rules` and existing frontend checks available in the repo.

Do not start with:

- Full route optimisation.
- Generic monday.com-style board builder.
- Conversational or voice Atlas.
- Multi-site hierarchy UI.
- Full asset rule engine.

Those depend on the operational spine and security model maturing first.
