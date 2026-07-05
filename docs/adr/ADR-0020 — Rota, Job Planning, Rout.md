# ADR-0020 — Rota, Job Planning, Route Estimates and Compliance-Aware Updates

## Status

Proposed

## Context

HourWise needs a shared rota and job planning system across the Fleet Portal and Driver App.

The Fleet Portal will allow managers to plan shifts several weeks ahead, assign drivers, vehicles and trailers, and attach one or more jobs to a shift.

The Driver App will display the driver’s assigned rota, vehicle, trailer, jobs, route plan and messages.

HourWise will not act as live HGV navigation. Route planning will use estimated route times only. Drivers must still use approved HGV navigation tools and professional judgement.

## Decision

HourWise will implement rota and job planning as a shared backend feature used by both Portal and App.

The Portal will create and manage:

* driver rota
* shift start/end times
* vehicle and trailer assignments
* depot location
* job locations
* expected job duration
* expected arrival/departure windows
* route estimates
* job notes
* route warnings
* manager messages

The Driver App will consume this information from the shared backend.

The Driver App will not call the Portal directly.

The Driver App and Fleet Portal will both communicate with the shared HourWise backend.

## Architecture

```text
Fleet Portal
   │
   │ creates rota, jobs, routes, assignments
   ▼
HourWise Backend / Supabase
   │
   ├── stores rota
   ├── stores job plans
   ├── stores route estimates
   ├── stores vehicle/trailer assignments
   ├── stores planned and actual job duration
   ├── stores driver work/driving state
   └── stores Atlas recommendations
   ▲
   │ consumes assigned rota/jobs
Driver App
```

Route calculation should be performed centrally, not independently by each client.

OpenRouteService should be called from the backend or controlled portal workflow, then the resulting estimates should be stored against the route plan.

## Job Duration

Each job must support:

* planned arrival time
* planned departure time
* expected job duration
* actual arrival time
* actual departure time
* actual job duration
* delay reason
* driver notes
* manager notes
* completion status

Example:

```text
Job A expected duration: 20 minutes
Driver actual duration: 45 minutes
Delay: customer not ready
```

When actual duration differs from planned duration, HourWise must update the route risk calculation.

## Delay Handling

Delays are expected and must be treated as normal operational events, not system failures.

A route plan must remain flexible enough to support:

* customer delays
* loading delays
* traffic delays
* vehicle defects
* driver breaks
* late starts
* sickness
* driver reassignment
* vehicle reassignment
* job cancellation
* job reordering

When a delay occurs, the Driver App should update the current route state and recalculate:

* remaining work time
* remaining driving time
* estimated time to next job
* expected arrival time
* break requirement
* route risk status
* missed delivery window risk
* whether the current plan remains realistic

## Compliance-Aware Route Warnings

HourWise should compare the planned route against the driver’s live legal availability.

Example:

```text
Next leg estimate: 1h 15m
Remaining driving time: 45m
Remaining work time: 1h 05m

Atlas recommendation:
You are unlikely to complete the next leg before reaching your driving limit.
Take a compliant break before departure or at an appropriate safe stopping location.
```

If the job duration changes:

```text
Expected job duration: 20m
Actual job duration: 45m
Delay added: 25m
Next leg: 1h 15m
Remaining driving time: 45m

Updated warning:
This delay has made the next planned leg non-compliant without a break.
```

## Driver App Behaviour

The Driver App should show:

* today’s rota
* assigned vehicle
* assigned trailer
* shift start/end time
* job list
* planned route order
* estimated drive time between jobs
* expected job duration
* actual time spent at job
* route warnings
* Atlas recommendations
* manager messages
* external navigation launch button

The driver should be able to mark:

* arrived at job
* started job
* delayed
* completed job
* unable to complete
* departed job

These timestamps should update the shared backend.

## Portal Behaviour

The Portal should allow managers to:

* create rota
* assign drivers
* assign vehicles
* assign trailers
* create job sequences
* set expected job durations
* set delivery/collection time windows
* view route risk before publishing
* publish route to driver
* edit route during the day
* reassign jobs
* reassign drivers
* message affected drivers
* view actual versus planned performance

## Messaging Integration

Messaging must be linked to rota and job events.

Example messages:

```text
Your vehicle has changed from HX12 ABC to HX15 XYZ.
```

```text
Job 3 has been cancelled. Return to depot after Job 2.
```

```text
You are running late for Job 4. Manager has been notified.
```

```text
Atlas recommends a break before travelling to the next job.
```

## Advisory Navigation Position

HourWise is not a sat-nav.

HourWise must clearly state:

```text
Route estimates are advisory only.
Drivers must use approved HGV navigation, road signs, traffic conditions, site rules and professional judgement.
```

HourWise may provide links to external navigation apps, but must not claim to provide live HGV navigation unless a dedicated approved navigation partner is integrated in future.

## Future Options

Future integrations may include:

* CoPilot HGV
* TomTom HGV
* Microlise-style telematics
* DPD Saturn-style operational routing
* GPS tracking provider integrations
* traffic-aware route refresh
* customer ETA notifications
* automated delay detection
* suggested safe break locations
* proof of delivery
* electronic delivery notes
* vehicle defect escalation
* automatic route resequencing

## Consequences

This creates a major HourWise advantage:

HourWise does not just tell managers where drivers should go.

It tells managers whether the plan is realistic based on the driver’s actual legal working and driving time.

This turns route planning into compliance-aware operational planning.
