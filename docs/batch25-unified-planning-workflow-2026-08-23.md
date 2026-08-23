# Batch 25 — Unified planning workflow

Date: 2026-08-23  
Starting HEAD: `b9c37a2ac1dff1170a9b92058ad5ed14c8c5a44a`  
Supabase project: `lcvahjmoobmpifrexurb`

## P0 refresh failure

The manager planner previously loaded the core snapshot, drivers, vehicles, jobs, and recorded work in one `Promise.all`. Its recorded-work query filtered `work_sessions` with `company_id`, but that table has no `company_id` column. The resulting auxiliary query error was combined with every other result and promoted to the global message “We couldn't refresh planning. Try again.” Valid core data—including saved templates—was therefore discarded from the interface.

Batch 25 removes that client query. Recorded work now comes from `get_planning_recorded_work_summary(p_from, p_to)`, which joins:

`work_sessions.user_id → profiles.id → profiles.company_id`

The RPC accepts at most 63 visible days, requires an authenticated manager, derives the company from the caller, returns only current-company drivers, and exposes only the fields the planner needs. It does not broaden `work_sessions` RLS and does not add a fake company column.

## Domain-aware loading and error scope

The planner now settles five domains independently:

- Core planning snapshot: templates, requirements, assignments, leave, runs, policies, and planning profiles.
- Drivers.
- Vehicles and trailers.
- Jobs.
- Recorded hours.

A failed core read shows the board-level message “We couldn't load this week's plan.” A supporting failure keeps the last good supporting data and appears next to the affected feature:

- Recorded hours: “Recorded hours are temporarily unavailable. Rest and working-time checks may be incomplete.”
- Jobs: “Jobs couldn't be loaded.”
- Vehicles: “Vehicle availability couldn't be loaded.”
- Drivers: “Drivers couldn't be loaded.”

Each successful retry clears that domain's stale error. A recorded-hours failure no longer hides templates, vacancies, jobs, leave, or runs.

## Saved template reconciliation

Read-only live SQL after deployment confirmed that the existing records remain intact:

- Regular Week: 7 days; Monday Day Driver; 08:00–18:00; 10 people.
- Busy Week: 7 days; Monday–Friday Day Driver; 08:00–18:00; 15 people per day.

The migration contains no template insert, update, delete, or automatic recreation.

## Information architecture

Before Batch 25, Planning exposed six top-level modes: Coverage, People, Dispatch, Leave, Templates, and Assigned duties. Although they shared data, they behaved like separate workflows.

After Batch 25, Planning is one weekly page with three compact representations of the same selected week:

- Coverage: grouped demand and vacancy counts.
- Drivers: dense driver-by-day duty, rest, holiday, sickness, training, and conflict overlay.
- Runs: dated driverless or staffed runs with ordered jobs.

State remains in the same workspace when changing board mode. Supporting work stays in context:

- Pattern dropdown and Apply action are in the weekly header.
- Manage patterns opens a drawer.
- Leave is overlaid on Coverage and Drivers, with an overview drawer and Add leave action.
- Jobs remain in a collapsible tray underneath every board mode.
- Coverage cells, drivers, bulk staffing, leave, patterns, jobs, and runs use contextual drawers.
- Review & publish opens the weekly review.
- The prior ShiftPlanner lifecycle is retained only as a secondary Duty register link.

No routing provider or additional planner page was added.

## Bulk staffing

“Fill vacancies across week” opens one drawer. The manager selects drivers and days once. The client builds a deterministic preview of every driver/date combination and reports:

- Ready.
- Needs review.
- Unavailable.
- Already assigned or conflict.

Holiday and other absence, existing assignment, overlapping duty, and overfill are reported per item rather than silently skipped. Unknown regulatory profiles remain “Rules need confirming”; the planner does not invent legal conclusions.

Confirmation calls one bounded database function for up to 500 combinations. `bulk_assign_rota_positions` rechecks manager role, caller company, driver membership, slot company, active vacancy, leave, overlap, and current capacity. It delegates successful items to the existing guarded single-position authority, preserving shift creation, run staffing, and one-time job projection.

The request UUID is stable for the drawer. A company/request-key advisory lock and private replay table make retries idempotent. Repeated confirmation returns the original result; it cannot create duplicate shifts. The existing unique active `(slot_id, driver_id)` index remains a second constraint.

## Interaction-count comparison

Approximate normal-flow comparison, excluding exception resolution:

| Task | Before | Batch 25 |
| --- | ---: | ---: |
| Assign Bob Monday–Friday | Five separate vacancy/driver flows; approximately 15 interactions | Open bulk fill, select Bob, confirm; approximately 3 interactions |
| Assign 12 chosen day drivers Monday–Friday | 60 driver/day assignment flows; approximately 180 interactions | Open, select 12 drivers, review preselected weekdays, confirm; approximately 15 interactions |
| Assign all currently compatible drivers | Up to 60 separate flows | Open, Select all, review, confirm; approximately 4 interactions |
| Apply a saved week | Pattern page, preview/apply, return to Coverage | Choose pattern, Apply, confirm; stays on the board |
| Allocate waiting jobs | Navigate to Dispatch and back | Open persistent job tray, choose Move to run |

The remaining interactions are deliberate exceptions: holidays, conflicts, rest warnings, missing fleet assets, and incomplete runs.

## Leave and capacity

Leave is no longer a primary planner page. The Drivers board paints Holiday, Sick, Training, and Unavailable directly into each affected date, including ranges spanning two weeks. Coverage shows away counts. A weekly leave drawer provides capacity context and opens the same Add leave form.

The existing `record_staff_availability` RPC remains responsible for company membership and policy enforcement. Company leave capacity is displayed as policy context and remains distinct from statutory law.

## Jobs, runs, vehicles, and trailers

The persistent Jobs waiting tray is accessible in all three board modes. It supports search, Add job, and an explicit accessible Move to run selector. Drag-and-drop is not required. Existing jobs can remain unallocated.

Runs remain valid without a driver. Jobs may be placed on a driverless run; when the related rota position is staffed later, the existing assignment authority projects each job once. Runs show staffing state and ordered jobs in the same weekly workspace.

Fleet selection is deliberately deferred. The individual vacancy inspector assigns Driver, Vehicle, and Trailer together when desired. A manager may staff first and leave vehicle/trailer blank. The weekly review reports missing vehicle and incomplete run counts, while publication continues to perform the current authoritative asset and duty checks.

## Human-language pass

The principal manager-facing language now uses “Weekly planning board,” “View by,” “Fill vacancies,” “Jobs waiting,” “Move to run,” “Manage patterns,” “Add leave,” “Rules need confirming,” and “Duty register.” Technical transport and database errors remain in developer logs rather than manager copy. Normal failure messages describe the affected feature and next action.

## 25-driver reality check

The existing deterministic Batch 23 fixture contains 25 drivers, 28 weekly staffing requirements, 161 required positions, leave, assigned fleet, vacancies, and driverless runs with multiple jobs. Batch 25 tests apply the new bulk model to Monday–Friday demand and verify one-driver/multi-day assignment, many-driver/many-vacancy assignment, holiday exclusion, overlap rejection, overfill prevention, and per-item partial reporting.

Source-level usability answer: yes, a manager can reasonably plan a 25-driver week from this one screen. Coverage exposes vacancies; Drivers exposes who is working, rest, leave, and conflicts; the hours warning remains visible; the job tray exposes waiting jobs; Runs exposes unstaffed runs. Bob can be selected once for Monday–Friday. Twelve chosen drivers can be applied across five dates without 60 individual operations.

This answer is supported by workflow logic and automated fixtures. Authenticated visual confirmation is separately blocked below and is not claimed as passed.

## Migration and security

Migration: `20260823155636_batch25_unified_planning_workspace.sql`.

It adds:

- Manager-scoped recorded-work summary RPC.
- Recreated core snapshot RPC with an empty fixed search path.
- Manager-scoped bounded bulk-assignment RPC.
- RLS-enabled replay table with all direct public, anonymous, and authenticated table access revoked.

Live verification confirmed all three functions have `search_path = ''`, anonymous execute is false, authenticated execute is true, and the replay table has RLS with no anonymous or authenticated SELECT privilege. The function bodies require `auth.uid()`, manager role, and the caller's company before accessing data. The replay table had zero rows after read-only verification.

Supabase security and performance advisors were run. They report the existing broad project advisory baseline. The new replay table receives an informational “RLS enabled, no policy” notice because direct client privileges are intentionally revoked and all access is internal to the guarded function. No new table is directly exposed. Existing signed-in SECURITY DEFINER notices are expected for guarded RPCs; the Batch 25 functions explicitly check manager role and company.

## Validation

- Focused Batch 25 and planning contracts: 21 tests passed across 3 files.
- Rules suite: 370 tests passed across 59 files.
- Full suite: 412 tests passed across 66 files.
- TypeScript: passed.
- Production build: passed; 2,586 modules transformed. Existing mixed-import and large-chunk warnings remain.
- Changed-file ESLint: passed.
- Repository lint: unchanged known baseline, 103 errors and 7 warnings; no Batch 25 changed-file error.
- `git diff --check`: passed.
- Supabase post-deploy dry run: remote database up to date.

## Visual acceptance

`MANUAL VISUAL ACCEPTANCE BLOCKED — AUTHENTICATED BROWSER ENVIRONMENT.`

The browser runtime reported no available in-app or connected browser. Authenticated checks at 1280, 1440, and approximately 1920 pixels, screenshot review, and a live production 25-driver interaction-count trial could not be performed. No visual result is represented as passed, and no production planning rows were created to simulate one.

## Remaining limitation

The unified board deliberately keeps advanced existing shift lifecycle actions in the secondary Duty register until those less-common cancellation/edit operations are individually redesigned as contextual duty-inspector actions. This does not reintroduce Assigned duties as a top-level planner mode.
