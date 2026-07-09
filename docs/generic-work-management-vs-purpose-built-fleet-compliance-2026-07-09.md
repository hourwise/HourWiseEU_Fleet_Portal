# Generic Work Management Tools Versus Purpose-Built Fleet Compliance

Date: 2026-07-09
Status: product strategy note

## Purpose

This note captures the product lesson from small-fleet operators trying to use generic work-management tools such as monday.com, spreadsheets, Airtable, Trello, Notion, and visual boards for fleet management.

HourWise should learn from these tools' usability, but should not copy their product model.

## Strategic Position

HourWise should offer the clarity of a work-management dashboard with the reliability of purpose-built fleet compliance logic.

Positioning:

```text
HourWise gives small and mid-sized fleets the simplicity of a monday-style dashboard, but with transport compliance, tachograph intelligence, driver hours, maintenance rules, evidence capture, and Atlas summaries built in from day one.
```

## What To Learn From monday.com

HourWise should aspire to:

- visual simplicity
- clear cards and status columns
- due soon, due, overdue views
- calendar views
- simple forms
- owner/responsible-person fields
- low-friction onboarding
- approachable dashboard language
- fast setup for small fleets

Example asset card:

```text
Vehicle: YX23 ABC
PMI: due in 9 days
Service: due in 1,200 km
Brake inspection: overdue
Last daily check: today
Assigned depot: Liverpool
Responsible manager: Sarah
```

## What To Avoid

HourWise should not become a generic board builder.

Avoid asking users to build:

- formula columns
- workflow paths
- custom automation recipes
- connected-board logic
- manual compliance rules
- fragile workaround automations

Fleet managers should enter fleet language:

```text
Service due every 12 months or 20,000 km, whichever comes first.
Warn 30 days or 1,000 km before due.
Require evidence on completion.
```

HourWise should calculate due state, warnings, evidence requirements, and next due automatically.

## Product Language

Avoid vague productivity language:

- manage workflows
- streamline operations
- create boards
- automate processes
- collaborate better

Use transport and compliance language:

- PMI due
- defect unresolved
- driver card overdue
- vehicle check missing
- licence expiry approaching
- tachograph infringement found
- weekly driving risk
- maintenance evidence ready
- stale odometer reading

## Service Rule Engine Is The Differentiator

The key gap in generic tools is multi-trigger fleet logic:

- date-based maintenance
- mileage-based maintenance
- engine-hour-based maintenance
- whichever comes first
- stale reading warnings
- evidence requirements
- completion history
- next due calculation

This is already captured in `ADR-0028: Preventive Maintenance & Asset Compliance Rule Engine`.

## Forms As First-Class Inputs

Small fleets often start with forms. HourWise should support:

- monthly odometer/engine-hour update forms
- daily check readings
- driver-submitted defects
- workshop/service completion forms
- plant-hour updates
- fuel, AdBlue, and expense submissions
- licence/document upload forms

Unlike generic tools, these forms should feed purpose-built fleet engines and evidence models.

## History, Not Overwrite

HourWise should never only overwrite a "last service" field.

Every completed service or compliance action should create a historical record:

- date
- mileage/hours
- supplier
- mechanic
- cost
- notes
- documents
- defects resolved
- evidence
- next due calculation

This turns HourWise into an evidence system, not a reminder board.

## Small Fleet Adoption Principles

For 20 to 25 vehicle fleets:

- ease of use beats feature count
- practical data entry beats theoretical automation
- monthly forms are acceptable if telematics is not available
- setup should use templates
- onboarding should explain what data must stay current
- stale readings must be visible

## Rejected Product Direction

HourWise will not become "monday.com for transport".

Rejected because:

- generic flexibility creates compliance risk
- users should not build statutory logic manually
- arbitrary board customization weakens product identity
- compliance evidence needs stronger structure than task cards

## Decision

Use generic work-management tools as a UX benchmark, not as the product model.

HourWise should be easier to adopt than enterprise fleet software, more reliable than spreadsheets or generic boards, and explicitly built for UK/EU fleet compliance.
