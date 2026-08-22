# Batch 23 planning compliance contract — 2026-08-22

## Purpose

The planning workspace is a deterministic decision aid. It may identify a known conflict or warning before a duty is assigned, but it does not make a general legal-compliance claim. Publication remains the point where current operational state is checked through existing authoritative server paths.

## Data classes

### Recorded

Recorded work comes from `work_sessions` and existing tachograph processing. It is displayed separately and is not silently rewritten by planning. Where recorded minutes are absent, the new workspace does not manufacture activity composition.

### Planned

Planned duty comes from dated rota requirements that have an active individual assignment and linked draft `shift`. The planner may calculate elapsed duty duration and the rest interval between two planned duties. It does not treat the entire duty as driving.

### Unknown

Unknown remains a first-class state for:

- regulatory regime not explicitly configured;
- driving duration while the route provider is unconfigured;
- driving versus other work within a planned duty;
- historical evidence absent from the selected window;
- weekly-rest/compensation history that cannot be reconstructed authoritatively;
- rolling working-time inputs that are incomplete.

Unknown is rendered as “Rules need confirming” or “Driving-time check pending”, never as pass/available by assumption.

## Regulatory regime

`driver_planning_profiles.regulatory_regime` is the narrow configuration seam:

- `assimilated_aetr`
- `gb_domestic`
- `other_not_applicable`
- `unknown`

No profile is inferred from role, vehicle, address, or past rota. The default is `unknown`. GB domestic and other profiles are labelled but do not reuse assimilated/AETR thresholds.

## Deterministic daily-rest forecast

For an explicitly confirmed assimilated/AETR planning profile, candidate assessment uses the same `TACHO_RULE_LIMITS` constants consumed by the existing tachograph rest engine:

- below the repository reduced-daily-rest threshold: Cannot currently fit;
- between reduced and regular daily-rest thresholds: Needs review / Reduced daily rest;
- at or above regular daily rest, with no other block: Available.

The interval is calculated from the actual end timestamp of the preceding planned duty to the proposed duty start. Overnight duties advance their end date correctly. A direct duty overlap is always unavailable regardless of regime.

The planner does not count reduced-rest uses across incomplete history and therefore does not claim that a reduced rest is legally available to use; it only labels the interval for review.

## Weekly rest and working time

The repository tachograph engine remains authoritative for findings based on recorded activity. Batch 23 does not apply weekly-rest, compensation, rolling average, or break rules to incomplete planning data. The driver inspector shows Recorded and Planned totals separately. Weekly/rolling status remains unknown until the required historical and activity-composition inputs are available.

## Driving hours and routing

Driving time belongs to run/dispatch feasibility and requires credible road-duration evidence. The route provider remains `unconfigured`. Dispatch states:

> Driving-time check pending · Road driving duration is not available yet.

Shift duration, straight-line distance, service time, and guesswork are never substituted for driving duration. No provider is called and no ETA or distance is stored.

## Availability and leave capacity

Recorded annual leave, sickness, training, unavailable, or other periods make a driver unavailable for candidate selection on overlapping dates. Leave-capacity limits are explicitly company policy. `warn` records the period and returns capacity feedback; `block` rejects it once configured capacity is reached. No number is hard-coded.

## Asset and trailer checks

Tentative vehicle/trailer choices are stored per filled position. Draft planning can be incomplete, but the existing shift/job assignment readiness triggers and live publication assessment remain authoritative. Trailer ID projects to the established `job_assignments.trailer_id`; there is no second operational trailer authority.

## Publication boundary

The browser review is explanatory and cannot authorise publication by itself. Immediately before publication, each duty obtains a current server assessment and then calls `publish_shift_with_event`, whose existing triggers and permission/event contracts apply. A missing driver is represented only as an unfilled planning requirement and never as a `shift`.

## Security boundary

All new planning RPCs authenticate the actor, require manager role, derive company server-side, validate related IDs, use fixed search paths, and deny anonymous execution. New planning tables use RLS with company/manager predicates. Driver-facing data remains sourced from published/updated operational shifts and job assignments, not from empty planning demand.

## Explicit non-capabilities

Batch 23 does not provide:

- a legal-compliance guarantee;
- automatic individual driver rotation optimisation;
- AI/model inference or generic write authority;
- paid or free routing integration;
- live telemetry;
- fake driving time, route duration, distance, or ETA.
