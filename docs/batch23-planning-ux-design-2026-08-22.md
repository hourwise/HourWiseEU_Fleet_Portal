# Batch 23 planning UX design — 2026-08-22

## Starting point and observed workflow

The audited starting point is `main` at `d80d03074b345052be01526a8805be6dd32db3f3` (Batch 22 deployed). The People > Shifts route mounts `RotaPlanningWorkspace`, which currently presents date inputs, a one-line pattern form, pattern application, individual open-place cards, a leave form, a job form, an unassigned-job card list, the complete legacy `ShiftPlanner`, and driver-hours cards in one vertical document.

The data architecture correctly keeps empty demand in `rota_slots` and assigned operational duties in `shifts`, whose `driver_id` remains required. The current interface does not express that architecture well: it asks a manager to work through forms and duplicate cards, then exposes a 25-driver by 7-day grid containing 175 “Add Shift” controls. It also cannot author a multi-requirement cyclic template, cannot put jobs on an unstaffed run, does not present availability as a calendar, and writes tentative asset choices to the shared requirement rather than the individual filled position.

## Information architecture

People > Shifts becomes a single Planning workspace with six views:

1. **Coverage** — the default demand-first weekly grid. Rows are requirement groups and columns are dates. Each cell shows filled/required, vacancies, leave impact, and warnings. Selecting a cell opens the vacancy inspector.
2. **People** — a driver-by-day heat map combining planned/assigned duty labels with Holiday, Sick, Training, Unavailable, Rest, and Conflict states. Selecting a driver opens their inspector.
3. **Dispatch** — an unassigned job pool beside dated runs. Jobs can be put in an ordered run before a driver or shift exists. Explicit move controls accompany any pointer-based interaction.
4. **Leave** — a compact driver-by-day availability calendar with a contextual leave drawer and capacity feedback.
5. **Templates** — a cycle-aware staffing-demand editor supporting 7, 14, 28, and bounded custom cycle lengths, with many requirements per cycle day and copy/duplicate actions.
6. **Assigned duties** — the existing `ShiftPlanner`, retained temporarily for published-duty detail, acknowledgement, cancellation, and existing job-lifecycle access. It is no longer rendered below the primary planner and is not the default workflow.

These are views of the same selected planning period. The sticky planner toolbar owns week navigation, date context, active plan/pattern, refresh, review, and publish actions.

## Principal manager workflows

### Create and apply staffing demand

The manager authors a named template with a cycle length and multiple lines assigned to explicit cycle positions. Weekday labels are used for seven-day templates; longer rotations show “Day 1…Day N” while retaining calendar dates in applied plans. Copy-day and duplicate-line actions avoid repeated entry.

Applying a template is a two-step operation. Preview reports days covered, requirement rows, total positions, existing draft conflicts, leave conflicts, and skipped existing rows. Confirmation uses a bounded, idempotent server operation; it never publishes.

### Fill vacancies

The Coverage grid makes shortage the dominant signal. Selecting (for example) `10/12` opens a right-side inspector showing the requirement, current individual allocations, and candidates grouped as Available, Needs review, and Unavailable. Each candidate row gives human-readable reasons and recorded/planned/rest context. Assignment happens in-place, with vehicle and trailer selected per individual allocation.

### Plan people and leave

The People and Leave grids share the same driver/date vocabulary. A manager can select a driver and date range in a drawer, choose Annual leave, Sickness, Training, Unavailable, or Other, and see the period across the row. Company-configured role capacity produces a warning or block; it is never presented as a legal rule.

### Plan work before staffing

Dispatch provides unassigned jobs and empty runs. A run is a dated planning requirement, not a driverless `shift`. Jobs are placed on that run with an explicit sequence. When the run gains an individual allocation and draft shift, the planned job relation is projected idempotently through the existing `job_assignments` contract. The job remains the single authoritative job record.

### Review and publish

Review aggregates ready duties, warnings, blocked duties, vacancies, availability conflicts, vehicle/trailer readiness, and jobs waiting for allocation. Drill-down returns the manager to the relevant grid cell or run. Publication performs fresh server-side checks and uses existing authoritative shift publication paths; cached browser assessments never authorise publication.

## Persistent versus contextual UI

Persistent elements are limited to the planner toolbar, view tabs, dominant grid/board, concise status summary, and filters needed to understand the current period. The following move to drawers or dialogs: new/edit template, template-apply preview, vacancy assignment, driver detail, leave entry, manual job creation, run editing, bulk-operation preview, and publication review.

No permanent “new shift”, “new leave”, or “new job” form occupies the core planning canvas.

## Planning and schema decisions

- `rota_templates.cycle_length_days` defines a bounded staffing-demand cycle.
- `rota_template_slots.cycle_day` identifies the single cycle position on which a requirement applies. Existing Batch 22 rows are backfilled compatibly to day 1; managers can correct old patterns in the editor.
- `rota_slot_assignments.vehicle_id` and `trailer_id` are authoritative for the filled position. Existing slot-level fields remain compatibility defaults only.
- `rota_slot_jobs` relates one job to one planned run/slot, with explicit sequence, before a shift exists.
- `leave_capacity_policies` stores company/role/type limits and `warn` or `block` handling.
- An explicit driver planning regime remains configurable and nullable. Unknown means “Rules need confirming”; no regime is guessed.

## Old ShiftRoster disposition

Option C is selected for Batch 23: retain the legacy roster behind **Assigned duties** while the new People view replaces it as the primary weekly overview. This is the safest transition because the legacy component still exposes mature published-duty lifecycle, acknowledgement, edit/cancel, and job-planner links. Its per-cell “Add Shift” controls are absent from the default planning experience.

## Accessibility

- Every colour state also has visible text or an icon with an accessible label.
- Grids use semantic table headers, keyboard-focusable cells, sticky row/date headings, and a logical reading order.
- Drawers use labelled controls, visible focus, Escape/close controls, and return focus to the invoking cell.
- Compact text remains at readable sizes; warning copy is concise and does not expose internal policy codes.
- Drag-and-drop is optional enhancement only; Move to run, Move up/down, and Remove buttons remain available.

## Responsive behaviour

At 1280–1920px the weekly grid/dispatch board is the dominant viewport object and inspectors use a constrained right drawer. Tablet widths retain horizontal scrolling with sticky first column and date headers. Mobile is a review and exception-handling layout: one selected day at a time, compact requirement list, and full-screen drawers. Bulk week construction remains desktop-first because safe dense planning is not credible on a narrow phone.

## Expected 25-driver workflow

A manager selects Regular Week, reviews a bounded application preview, confirms once, and immediately sees four compact demand rows across seven dates. They record Bob Smith’s two-week holiday once; the People/Leave grids and candidate picker reflect it everywhere. Vacancy filling works from shortage cells and supports repeated assignments without visiting 175 driver/day modals. Jobs are created in a drawer or imported later, placed into ordered runs, and then connected to drivers and assets. One publication review gathers remaining blockers before eligible duties are published through existing pathways.

The target interaction model is approximately: one template selection, one preview/confirm, one leave range entry, roughly one action per filled vacancy (with bulk filling available where safe), run-level job allocation, and one review. It removes the fixed 175 “Add Shift” decision points; actual interactions scale with exceptions and vacancies rather than drivers multiplied by days.
