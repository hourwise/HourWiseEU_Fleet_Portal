# ADR-0021 — Unified Event Synchronisation, Messaging and Atlas Integration

## Status

Proposed

## Related Documents

* ADR-0020 — Rota, Job Planning, Route Estimates and Compliance-Aware Updates
* 18.10_Atlas_Interface.md
* 19_Atlas_Specification.md
* 23_Integration_Architecture.md
* 24_Architecture_Decision_Records.md

## Context

HourWise already has the beginnings of a two-way messaging system using Supabase push/realtime behaviour.

The Fleet Portal also needs to communicate rota changes, vehicle assignments, trailer assignments, job updates, route updates, delay events and Atlas recommendations to the Driver App.

Rather than building separate synchronisation systems for rota, jobs, messages, route plans and Atlas alerts, HourWise will use a unified event model.

Messaging becomes one visible part of a wider event synchronisation architecture.

## Decision

HourWise will implement a shared event system used by both the Fleet Portal and Driver App.

The Fleet Portal, Driver App and Atlas will communicate through the shared HourWise backend.

The app must not call the portal directly.

The portal must not rely on app-only state.

Both clients must read and write to shared backend tables with strict permissions, role checks and row-level security.

## Architecture

```text
Fleet Portal
    │
    │ creates rota, job, route, message and manager events
    ▼
HourWise Backend / Supabase
    │
    ├── stores event history
    ├── stores messages
    ├── stores rota updates
    ├── stores route updates
    ├── stores job status
    ├── stores driver acknowledgements
    ├── stores Atlas recommendations
    └── pushes realtime updates
    ▲
    │
Driver App
    │
    │ creates driver status, delay, acknowledgement and completion events
    ▼
HourWise Backend / Supabase
    │
    ▼
Atlas
    │
    │ analyses relevant events
    ▼
Atlas Recommendation Events
```

## Core Principle

Everything important that happens operationally should be represented as an event.

Examples:

```text
SHIFT_ASSIGNED
SHIFT_UPDATED
SHIFT_CANCELLED
VEHICLE_ASSIGNED
VEHICLE_CHANGED
TRAILER_ASSIGNED
TRAILER_CHANGED
JOB_ADDED
JOB_UPDATED
JOB_STARTED
JOB_DELAYED
JOB_COMPLETED
JOB_CANCELLED
ROUTE_CREATED
ROUTE_UPDATED
ROUTE_RECALCULATED
MESSAGE_SENT
MESSAGE_READ
DRIVER_ACKNOWLEDGED
BREAK_RECOMMENDED
COMPLIANCE_WARNING
DRIVER_RUNNING_LATE
DEFECT_REPORTED
INCIDENT_CREATED
ATLAS_RECOMMENDATION_CREATED
```

## Messaging Integration

The existing two-way messaging system should not be replaced.

It should be expanded so that conversations can include:

* manager messages
* driver replies
* system messages
* rota changes
* job changes
* route updates
* compliance warnings
* Atlas recommendations

Example conversation:

```text
Manager:
Please use vehicle HX14 ABC today.

System:
Vehicle assignment changed from HX12 ABC to HX14 ABC.

Atlas:
Route recalculated. Your next leg is estimated at 1h 15m, but you only have 45m driving time remaining. A break is recommended before departure.

Driver:
Understood.
```

## Atlas Integration

Atlas will subscribe to relevant operational events.

When a rota, job, route, delay, vehicle or driver timer event changes, Atlas may recalculate:

* remaining driving time
* remaining working time
* estimated arrival time
* route risk
* delivery window risk
* break requirement
* missed job risk
* driver lateness risk
* manager action required

Atlas must then publish its own event.

Example:

```text
JOB_DELAYED
    ↓
Atlas recalculates route risk
    ↓
ATLAS_RECOMMENDATION_CREATED
    ↓
Driver App and Portal receive update
```

## Driver Delay Example

A job is planned to take 20 minutes.

The driver is delayed and records the job as taking 45 minutes.

The Driver App creates:

```text
JOB_DELAYED
```

The backend updates the job actual duration.

Atlas recalculates the rest of the route.

If the delay affects compliance, Atlas creates:

```text
BREAK_RECOMMENDED
COMPLIANCE_WARNING
ROUTE_RECALCULATED
```

The Driver App then shows:

```text
This delay has changed your route risk.

Next leg estimate: 1h 15m.
Remaining driving time: 45m.

Atlas recommends taking a compliant break before leaving this job.
```

The Portal shows the manager:

```text
Driver is delayed by 25 minutes.

Route risk changed from Advisory to Warning.

Break now recommended before Job 3.
```

## Event Priority

Events should have priority levels.

```text
INFO
ADVISORY
WARNING
CRITICAL
EMERGENCY
```

Examples:

```text
INFO:
Message received

ADVISORY:
Route updated

WARNING:
Driver may not reach next job before break is required

CRITICAL:
Driver has exceeded a legal driving or working time threshold

EMERGENCY:
Accident, breakdown or panic event
```

Priority controls:

* push notification behaviour
* dashboard banners
* unread badges
* manager alerts
* Atlas escalation
* audit log visibility

## Event Delivery Rules

The system should support:

* realtime updates while the app is open
* push notifications while the app is backgrounded
* local caching for poor signal
* acknowledgement tracking
* retry behaviour
* duplicate event protection
* ordered event history where possible
* role-based visibility

The app should be able to recover if it misses events by fetching the latest state from the backend.

Realtime events are for responsiveness.

The backend database remains the source of truth.

## Data Model Direction

Suggested core tables:

```text
fleet_events
messages
message_threads
rota_assignments
job_assignments
route_plans
route_plan_legs
atlas_recommendations
driver_acknowledgements
push_notification_log
```

`fleet_events` should act as the central operational event log.

Suggested fields:

```text
id
fleet_id
driver_id
vehicle_id
trailer_id
shift_id
job_id
route_plan_id
event_type
priority
title
body
payload_json
created_by_user_id
created_by_role
created_at
read_at
acknowledged_at
expires_at
```

## Permissions

Drivers should only see events relevant to:

* their own assigned shifts
* their assigned vehicles
* their assigned jobs
* messages sent to them
* fleet-wide announcements they are allowed to view

Managers should see events for their fleet, subject to role permissions.

Atlas should only access data needed to generate recommendations for the relevant fleet, driver, shift or route.

## Consequences

This architecture gives HourWise a single communication layer for:

* rota updates
* job planning
* route updates
* driver messages
* manager messages
* compliance warnings
* Atlas recommendations
* incident workflows
* defect workflows
* future telematics events

This avoids building separate sync systems for each feature.

It also makes Atlas more powerful because it can react to real operational changes instead of only answering user questions.

## Risks

The event system could become noisy if every minor update creates a visible notification.

To prevent this:

* not every event should create a push notification
* low-priority events may only update the local UI
* events should be grouped where appropriate
* Atlas should avoid repeating the same recommendation too often
* managers should be able to configure notification preferences

## Final Decision

HourWise will treat messaging, rota updates, job updates, route changes and Atlas recommendations as part of one unified event synchronisation system.

The existing Supabase-powered messaging work should be retained and expanded into this event model.

The Fleet Portal and Driver App will communicate through the shared backend, not directly with each other.

Atlas will become an event-aware operational assistant, capable of reacting to delays, route changes, job updates and compliance risks in near real time.
