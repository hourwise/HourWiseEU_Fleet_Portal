# ADR-0028: Preventive Maintenance & Asset Compliance Rule Engine

## Status

Proposed

## Context

HourWise EU is expanding beyond driver hours and tachograph analysis into a wider fleet compliance and operations platform.

Small fleet operators often begin with spreadsheets, monday.com, Trello, Airtable, calendar reminders or basic visual boards. These tools can work for simple date-based reminders, but they become unreliable when fleet logic depends on multiple triggers, such as:

* Date-based maintenance
* Mileage-based maintenance
* Engine-hour-based maintenance
* Whichever comes first rules
* Warning thresholds
* Hard overdue states
* Historical service records
* Compliance document renewals
* Driver licence and CPC renewals
* Tachograph calibration
* MOT and insurance expiry

A recurring pain point is preventive maintenance by **date, mileage or engine hours**, especially when the operator needs alerts based on whichever threshold is reached first.

Generic work-management tools can record this information, but the operator usually has to build the logic manually using formulas, automations, connected boards and forms. This creates a risk that reminders fail, records are overwritten, or compliance evidence is incomplete.

HourWise should avoid becoming a generic board builder. Instead, it should provide purpose-built fleet logic that works out of the box for small and mid-sized UK/EU fleets.

## Decision

HourWise will include a native **Preventive Maintenance & Asset Compliance Rule Engine**.

The engine will allow each fleet asset or compliance obligation to have one or more rules attached to it.

Supported rule types will include:

| Rule Type             | Example                                       |
| --------------------- | --------------------------------------------- |
| Date-based            | Service every 12 months                       |
| Mileage-based         | Service every 20,000 km                       |
| Engine-hour-based     | Service every 500 hours                       |
| Whichever comes first | 12 months or 20,000 km                        |
| Warning threshold     | Warn 30 days, 1,000 km or 25 hours before due |
| Hard overdue          | Flag when past date, mileage or hours         |
| Recurring history     | Create the next due record after completion   |

The rule engine will apply to:

* Vehicles
* Trailers
* Plant
* Lifting equipment
* Tachograph calibration
* MOT
* Insurance
* Operator licence documents
* Driver licence checks
* CPC renewals
* Medical renewals
* Service inspections
* Preventive maintenance inspections
* Defect follow-up actions

## Product Principle

HourWise should give operators the visual clarity of a work-management tool, but without requiring them to build fleet logic manually.

The user should not need to create formulas or complex automations for common fleet scenarios.

Instead of asking the user to build:

> If date is past OR current mileage is greater than service mileage OR current hours are greater than service hours, then update status and notify manager.

HourWise should allow the user to enter:

> Service due every 12 months or 20,000 km, whichever comes first.

HourWise will then calculate the due state automatically.

## Core Model

The engine should separate:

1. **Asset**

   * Vehicle
   * Trailer
   * Plant item
   * Equipment item
   * Driver
   * Document
   * Licence
   * Compliance obligation

2. **Rule**

   * What needs to happen
   * What interval applies
   * What thresholds apply
   * Whether the rule is recurring
   * Whether evidence is required

3. **Reading**

   * Current mileage
   * Current engine hours
   * Manual update
   * Driver-submitted update
   * Imported update
   * Future telematics update

4. **Due State**

   * Not due
   * Due soon
   * Due now
   * Overdue
   * Completed
   * Evidence missing

5. **History**

   * Completed service
   * Completion date
   * Mileage or hours at completion
   * Supplier or mechanic
   * Cost
   * Notes
   * Attachments
   * Defects resolved
   * Next due calculation

## Reading Capture

Mileage and engine-hour based rules require reliable input.

HourWise will support multiple capture methods:

* Manual manager entry
* Monthly fleet update form
* Driver app submission
* Daily vehicle check reading
* Service completion form
* Imported CSV
* Future telematics or GPS provider integration
* Future fuel-card or workshop-system integration

The system must make it clear when a rule depends on stale data.

Example:

> Service appears not due, but mileage has not been updated for 42 days.

This prevents false confidence where a vehicle appears compliant only because readings are outdated.

## UI Behaviour

Each asset should show a clear maintenance and compliance status.

Example:

| Item                   | Status          |
| ---------------------- | --------------- |
| PMI                    | Due in 12 days  |
| MOT                    | Due in 47 days  |
| Tachograph calibration | Overdue         |
| Service                | Due in 1,200 km |
| Insurance              | Valid           |
| Last vehicle check     | Completed today |
| Defect                 | Open            |

Status should be simple and visual:

* Green: compliant
* Amber: due soon
* Red: overdue or urgent
* Grey: unknown or missing data
* Blue: scheduled or in progress

The dashboard should prioritise actions, not raw data.

Example:

> 3 vehicles need attention this week
> 1 tachograph calibration overdue
> 2 PMIs due within 14 days
> 4 driver licence checks due within 30 days
> 1 vehicle has stale mileage data

## Atlas Integration

Atlas should be able to query the rule engine and explain risks in plain language.

Example Atlas prompts:

* Which vehicles need attention this week?
* Which vehicles are overdue?
* Which assets have stale mileage or engine-hour readings?
* Which drivers have documents expiring soon?
* What maintenance is due before the end of the month?
* Are any vehicles at risk of being non-compliant?
* Show me upcoming costs from scheduled maintenance.

Atlas should not replace the rule engine. Atlas should explain, summarise and prioritise the rule engine output.

## Notifications

The rule engine should support notifications through:

* Portal dashboard alerts
* Driver app alerts where relevant
* Manager email summaries
* Push notifications
* Future scheduled reports
* Future Atlas digest

Notification examples:

* Vehicle service due soon
* Vehicle service overdue
* Tachograph calibration due
* MOT expiry approaching
* Driver licence check due
* CPC renewal due
* Mileage reading stale
* Engine-hour reading stale
* Defect unresolved after threshold period

## Evidence Requirements

For compliance-sensitive actions, completion should require evidence.

Evidence may include:

* Uploaded invoice
* Service sheet
* MOT certificate
* Tachograph calibration certificate
* Inspection report
* Driver licence check result
* CPC evidence
* Photo
* Notes
* Supplier details
* Cost
* Completion signature or confirmation

This turns HourWise from a reminder system into an evidence system.

## Multi-Site Behaviour

The rule engine must respect the company hierarchy and site/depot permissions.

Local managers should only see and act on assets assigned to their site.

Main company managers should be able to:

* View all assets
* Move assets between sites
* View all due and overdue obligations
* Run company-wide reports
* See site-level compliance summaries

This connects to the multi-site company structure ADR.

## Consequences

### Positive

* HourWise becomes meaningfully stronger than spreadsheets and generic board tools.
* Preventive maintenance becomes a core platform capability.
* Compliance evidence becomes easier to collect and report.
* Atlas gains a strong operational data source.
* The fleet portal becomes more valuable even before full telematics integration.
* Small fleets can start manually and later upgrade to automated readings.
* The system supports vehicles, trailers, plant and driver compliance in one model.

### Negative

* More data modelling is required.
* Rule evaluation must be reliable and testable.
* Mileage and engine-hour data must be kept current.
* The UI must avoid becoming too complicated.
* Operators may need onboarding guidance to configure rules correctly.
* Future telematics integrations will require careful provider-specific mapping.

## Risks

The main risk is building too much flexibility too early.

HourWise should not become a generic automation platform.

The first version should support common fleet rules only:

* Date due
* Mileage due
* Engine hours due
* Whichever comes first
* Due soon warning
* Overdue status
* Completion history
* Evidence upload
* Next due calculation

Advanced custom workflows should be deferred.

## Implementation Direction

Phase 1 should include:

* Asset rule table
* Asset reading table
* Rule evaluation service
* Due status calculation
* Dashboard alert cards
* Completion history
* Evidence upload
* Manual readings
* Driver app reading submission where relevant
* Monthly update form
* Atlas query compatibility

Phase 2 should include:

* Recurring scheduled evaluations
* Email and push alerts
* CSV import/export
* Cost tracking
* Supplier records
* Workshop/service provider records
* Maintenance calendar
* Site-level reporting

Phase 3 should include:

* Telematics integration
* Fuel-card integration
* Accounting integration
* Automated odometer/hour readings
* Predictive maintenance insights
* Atlas risk scoring
* Cost forecasting

## Rejected Alternatives

### Use generic task reminders

Rejected because generic reminders do not understand mileage, engine hours, stale readings, whichever-comes-first rules or compliance evidence.

### Use monday.com-style boards internally

Rejected because this would make HourWise a generic work-management tool rather than a purpose-built fleet compliance platform.

### Build telematics first

Rejected for the initial phase because telematics integrations vary by provider and would slow down core fleet compliance development. The rule engine should be useful with manual and driver-submitted readings first, then support telematics later.

### Only track vehicle maintenance

Rejected because the same rule model can support vehicles, trailers, plant, equipment, documents and driver compliance obligations.

## Final Decision

HourWise will implement a native Preventive Maintenance & Asset Compliance Rule Engine as a core fleet portal capability.

The system will prioritise simple setup, reliable due-state calculation, clear visual alerts, historical evidence and future integration with Atlas, driver app readings, telematics, fuel and accounting systems.
