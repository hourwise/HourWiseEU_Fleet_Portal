# Batch 23 rota and dispatch implementation — 2026-08-22

## Starting state

Implementation started from clean `main` at `d80d03074b345052be01526a8805be6dd32db3f3`, with Batch 22 already present on linked Supabase project `lcvahjmoobmpifrexurb`. Batch 22 correctly separated empty demand from assigned `shifts`, but its primary screen was a long form/card stack ending in the legacy driver/day roster.

## Before and after information architecture

Before: date range → one-line pattern form → apply form → open-place cards → leave form → job form → job cards → legacy Shift Roster → hours cards.

After: one persistent weekly toolbar and six views of the same plan:

- **Coverage** is the default dense demand grid. Rows combine role and times; cells show filled/required, vacancies, covered state, and leave impact. A cell opens the vacancy drawer.
- **People** is the driver/date heat map with text-labelled duty, rest, leave, and conflict states.
- **Dispatch** places a searchable unallocated job pool beside dated runs. Runs can exist without a driver; jobs can be ordered onto them first.
- **Leave** is a driver/date calendar with a range-entry drawer and company-policy feedback.
- **Templates** shows cycle-aware multi-requirement patterns and opens a multi-row editor.
- **Assigned duties** contains the existing `ShiftPlanner` as a secondary lifecycle/detail surface.

The primary view no longer renders 175 “Add Shift” controls for a 25-driver week. Permanent job, leave, pattern, assignment, and review forms became drawers or dialogs.

## Template and cycle model

Migration `20260822211636_batch23_planning_workspace.sql` adds:

- `rota_templates.cycle_length_days`, bounded to 1–56;
- `rota_template_slots.cycle_day`, bounded to 1–56;
- `create_cyclic_rota_template`, accepting up to 500 validated requirements;
- `preview_rota_template`, reporting days, requirement rows, total positions, existing demand, and leave records;
- `apply_cyclic_rota_template`, mapping cycle positions with `(date - start) % cycle_length`, bounded to 367 days, protected with an advisory transaction lock and stable plan/slot identity.

Existing Batch 22 template rows backfill to cycle day 1 and seven-day templates. This is intentionally compatibility-safe rather than pretending old rows had known weekday semantics.

The editor supports 7, 14, and 28-day presets plus the bounded eight-day custom example, many requirements, requirement duplication, deletion, and copying day 1 to days 2–5. Individual driver work rotations are not inferred.

## Coverage and vacancy filling

Coverage is computed from dated requirements and active individual assignments. Each selected requirement drawer groups candidates as Available, Needs review, or Unavailable. Leave and duty overlap are hard candidate exclusions. A confirmed assimilated/AETR planning profile enables deterministic daily-rest bands using the repository tachograph rule constants. Other or unknown profiles remain explicitly review-only.

`assign_rota_position` locks the requirement, checks an optional `updated_at` version, validates every ID against the actor’s company, prevents overfill, rejects recorded unavailability, creates a required-driver draft shift, and stores fleet choices on the individual assignment.

## Assignment-level assets and trailer provenance

`rota_slot_assignments.vehicle_id` and `trailer_id` are now the tentative authority for each filled position. The existing slot-level fields remain compatibility/default fields only and are documented as such in the database. Each assignment can therefore represent Bob → Vehicle A → Trailer 1 independently of Sarah → Vehicle B → Trailer 9.

The draft shift receives the individual vehicle. When a planned run job is projected, its draft `job_assignments` row receives the individual vehicle and trailer, preserving the existing operational trailer authority and readiness triggers. Job projection is idempotent through the active-job unique relation and an existing operational-assignment lookup.

## People and availability

People and Leave use compact semantic tables with sticky driver/date headings. Every colour state also has a text label. The driver inspector separates Recorded and Planned totals, lists assigned duties and upcoming leave, and displays the regulatory regime boundary.

`record_staff_availability` derives company from the signed-in actor, validates the driver and range, reads `leave_capacity_policies`, and either warns or blocks according to company configuration. No default maximum is invented. Annual leave, sickness, training, unavailable, and other are supported.

## Job pool and unstaffed runs

`planned_runs` is the driverless dispatch layer; it is not a driverless shift. `planned_run_jobs` orders authoritative jobs on a run and enforces one active planned run per job plus unique active sequence per run.

The Dispatch view supports search, manual job creation in a drawer, new run creation without a driver, explicit job-to-run placement, and visible run staffing state. It always states that road driving duration is unavailable. No distance, ETA, or duration is calculated.

When an assignment later staffs a run, existing planned jobs project to draft `job_assignments`. When a job is added to an already staffed run, it projects immediately. Both paths first look for an existing active operational assignment and therefore do not duplicate the job.

CSV import remains a follow-up. This batch does not add a partially safe import surface without preview/deduplication/commit semantics.

## Publication review

The manager review consolidates draft duties, vacancies, missing vehicles, availability conflicts, unstaffed runs, and unprojected run jobs. “Publish ready duties” calls the current live readiness assessment immediately before each existing `publish_shift_with_event` call. Requirements without drivers stay in planning and are never converted into driverless shifts.

Publication is deliberately not automatic when a pattern is applied or vacancies are filled. The existing authoritative shift publication path, event creation, driver visibility, readiness triggers, and acknowledgement model remain intact.

## Security and concurrency

All new public tables have RLS and a company/manager policy. Live verification returned RLS enabled and one policy for each of `planned_runs`, `planned_run_jobs`, `leave_capacity_policies`, and `driver_planning_profiles`.

All new authoritative functions:

- require `auth.uid()` and manager role;
- derive company through `get_my_company_id()`;
- use fixed `search_path = public, pg_temp`;
- validate referenced drivers, assets, slots, runs, and jobs against that company;
- revoke execution from `PUBLIC` and `anon`, then deliberately grant `authenticated`;
- use locks, expected-version checks, active unique indexes, or existing-row reuse where duplicate browser actions matter.

Live privilege verification showed `anon_execute = false`, `authenticated_execute = true` for all eight new RPCs. The browser uses no service-role credential.

## 25-driver acceptance fixture and interaction model

`batch23PlanningFixture.ts` deterministically creates 25 drivers, four daily requirement groups (12 Day, 8 Night, 1 Shunter, 2 Standby), 28 weekly demand cells, 161 positions, Bob Smith’s two-week holiday, 12 jobs, and three pre-driver runs. Tests verify ten visible fixture vacancies, holiday exclusion, ordered run grouping, and distinct assignment-level vehicles.

The old workflow exposed 175 fixed add-shift controls before considering jobs or leave. The new workflow uses one pattern preview/confirm, one leave range action, one action per actual vacancy or exception, run-level job placement, and one publication review. Interaction count now scales with vacancies/exceptions rather than 25 × 7 cells.

## Validation and deployment

- `npm.cmd run typecheck`: passed after implementation and again after live type generation.
- `npm.cmd run test:rules`: 57 files passed, 357 tests passed.
- `npm.cmd test`: 63 files passed, 383 tests passed.
- `npm.cmd run build`: passed; 2,584 modules transformed, built in 25.16s. Existing dynamic-import and large-chunk warnings remain.
- Changed-file ESLint: zero findings.
- Repository-wide ESLint: unchanged documented baseline, 103 errors and 7 warnings.
- `git diff --check`: passed; only Windows line-ending notices were printed.
- Linked migration list: Batch 22 present, Batch 23 initially pending.
- Linked dry-run: only `20260822211636_batch23_planning_workspace.sql`.
- Linked push: migration applied successfully.
- Live schema: all eight new RPCs present; all four new tables protected by RLS/policy.
- `npm.cmd run db:types`: regenerated `src/lib/database.types.ts` from deployed project `lcvahjmoobmpifrexurb`.

Supabase advisors were run after deployment. Their returned set contains existing project-wide informational/warning findings; the targeted live checks found no missing RLS policy or anonymous execute grant on Batch 23 objects. Advisor remediation reference: [Supabase database linter](https://supabase.com/docs/guides/database/database-linter).

## Manual visual acceptance

The local Vite server started successfully, but the in-app browser runtime exposed zero browser instances. Authenticated visual inspection at 1280, 1440, and approximately 1920 pixels was therefore not performed and is not claimed. This remains a release acceptance action.

## Deliberate remaining scope

- authenticated multi-width visual QA;
- copy-week and broader bulk-operation preview/commit RPCs;
- template editing/versioning rather than create/copy only;
- leave-capacity policy administration UI;
- CSV preview/validate/deduplicate/commit;
- richer weekly-rest and working-time forecasting only after the required historical inputs and explicit regimes are available;
- server-atomic multi-duty publication review/token (current publication revalidates each duty through the existing RPC).

No AI inference, model provider, routing provider, live telemetry, fake distance, fake ETA, or fake driving duration was enabled.
