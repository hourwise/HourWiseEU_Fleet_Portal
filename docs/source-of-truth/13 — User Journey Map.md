# 13 — User Journey Map

| Field                | Value                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document Purpose** | Define the complete end-to-end user journeys across the HourWise Platform. These journeys describe how users accomplish real-world tasks rather than how individual screens behave. |
| **Audience**         | Founders, developers, designers, AI coding agents, testers and future contributors.                                                                                                 |
| **Dependencies**     | 04_User_Personas.md, 10_MVP.md, 11_Platform_Capability_Model.md, 12_Capability_Register_Detail.md                                                                                   |
| **Status**           | Living Document                                                                                                                                                                     |
| **Owner**            | Product Architecture                                                                                                                                                                |
| **Priority**         | Critical                                                                                                                                                                            |

---

# Introduction

Users do not think in terms of screens.

They think in terms of completing tasks.

Examples include:

* "Start my shift."
* "Check my remaining driving time."
* "Report an accident."
* "Review today's fleet."
* "Prepare for a DVSA audit."

This document defines those journeys.

Every screen, API and capability should support one or more complete journeys.

---

# Journey Design Principles

Every journey should aim to be:

* Simple
* Fast
* Reliable
* Explainable
* Recoverable if interrupted
* Consistent across the platform

Where possible, journeys should minimise:

* unnecessary typing
* duplicate data entry
* excessive navigation
* avoidable decisions

---

# Journey Lifecycle

Every journey follows the same structure.

## Objective

What the user wants to achieve.

## Primary Persona

Who usually performs the journey.

## Supporting Personas

Who else may be involved.

## Trigger

What starts the journey.

## Preconditions

What must already exist.

## Golden Path

The ideal workflow.

## Alternative Paths

Expected variations.

## Failure Scenarios

What happens if something goes wrong.

## Success Criteria

How we know the journey is complete.

## Implemented Capabilities

Reference capability IDs.

---

# Journey Categories

The HourWise Platform contains six journey groups.

## Driver Journeys

Everything performed primarily in the Driver App.

---

## Fleet Journeys

Operational workflows completed in the Fleet Portal.

---

## Compliance Journeys

Monitoring, reviewing and preparing compliance evidence.

---

## Administration Journeys

Configuration, onboarding and account management.

---

## Intelligence Journeys

Interactions involving Atlas.

---

## Customer Journeys

Website, onboarding, subscriptions and Resource Centre.

---

# Driver Journeys

## DRV-J01 — First-Time Driver Onboarding

Objective

Allow a new driver to install the app, create an account and become operational.

Golden Path

1. Download the app.
2. Create an account.
3. Verify email.
4. Complete driver profile.
5. Accept permissions.
6. Join fleet (or choose Solo Mode).
7. Complete setup.
8. Reach dashboard.

Success

Driver is ready to begin work immediately.

---

## DRV-J02 — Start a Shift

Objective

Begin a compliant working day.

Golden Path

1. Open app.
2. Review alerts.
3. Complete vehicle check (if required).
4. Start shift.
5. Working timer begins.
6. Dashboard updates.

Success

Working time is being tracked accurately.

---

## DRV-J03 — Complete a Vehicle Check

Objective

Record a legally compliant daily inspection.

Golden Path

1. Open checklist.
2. Complete inspection.
3. Record defects if required.
4. Attach photographs.
5. Submit.

Success

Inspection is stored and visible to the fleet.

---

## DRV-J04 — Report an Incident

Objective

Capture accurate information immediately after an incident.

Golden Path

1. Open Incident Reporting.
2. Select incident type.
3. Enter details.
4. Capture photographs.
5. Record location.
6. Submit.

Success

Incident appears in the Fleet Portal with supporting evidence.

---

## DRV-J05 — Record an Expense

Objective

Capture an expense while travelling.

Golden Path

1. Select expense type.
2. Photograph receipt.
3. Enter amount.
4. Save.

Success

Expense is immediately available for review.

---

# Fleet Journeys

## FLT-J01 — Morning Dashboard Review

Primary Persona

Sarah (Transport Manager)

Objective

Understand fleet priorities within two minutes.

Golden Path

1. Log into portal.
2. Dashboard loads.
3. Atlas summary displayed.
4. Compliance alerts reviewed.
5. Driver issues reviewed.
6. Action list generated.

Success

Manager knows today's priorities.

---

## FLT-J02 — Review Driver Card

Objective

Analyse a driver's tachograph data.

Golden Path

1. Upload driver card.
2. Processing begins.
3. Validation completes.
4. Timeline displayed.
5. Infringements highlighted.
6. Report generated.

Success

Manager understands the driver's compliance position.

---

## FLT-J03 — Resolve a Vehicle Defect

Objective

Manage a reported defect through to completion.

Golden Path

1. Defect received.
2. Assigned.
3. Repair recorded.
4. Verification completed.
5. Defect closed.

Success

Audit trail complete.

---

# Compliance Journeys

## CMP-J01 — Prepare for a DVSA Audit

Objective

Produce evidence quickly.

Golden Path

1. Select audit period.
2. Choose evidence pack.
3. Generate reports.
4. Export documentation.

Success

Evidence is available without manual collection.

---

## CMP-J02 — Review Compliance Risk

Objective

Understand current fleet compliance.

Golden Path

1. Open compliance dashboard.
2. Review high-risk items.
3. Prioritise actions.
4. Assign work.

Success

Risks become actionable tasks.

---

# Intelligence Journeys

## INT-J01 — Atlas Morning Briefing

Objective

Provide managers with a concise operational summary.

Golden Path

1. Manager logs in.
2. Atlas analyses overnight data.
3. Summary displayed.
4. Recommended actions shown.

Success

Manager understands today's priorities without searching.

---

## INT-J02 — Ask Atlas

Future Journey

Natural language interaction with operational data.

Release

Future.

---

# Customer Journeys

## ECO-J01 — Discover HourWise

Website visitor arrives.

Explores platform.

Downloads resources.

Registers interest.

Creates account.

Begins onboarding.

---

## ECO-J02 — Download Free Compliance Resources

Visitor:

Finds resource.

Downloads PDF.

Discovers platform.

Returns later as a customer.

---

# Cross-Journey Rules

All journeys should:

Support interruption.

Resume safely.

Preserve entered data.

Provide meaningful feedback.

Avoid duplicate work.

Support accessibility.

Respect permissions.

Generate audit trails where appropriate.

---

# Journey Success Metrics

Journeys should be measured by outcomes rather than clicks.

Examples:

* Driver onboarding completed in under 10 minutes.
* Vehicle check completed in under 2 minutes.
* Expense captured in under 30 seconds.
* Morning dashboard understood within 2 minutes.
* Driver card processed in under 60 seconds (excluding upload time).

---

# Journey Governance

New features should identify:

* which journey they support
* which journey they improve
* whether they introduce unnecessary friction
* whether an existing journey should be simplified instead

Features that do not improve a user journey should be carefully challenged.

---

# Related Documents

* 04_User_Personas.md
* 10_MVP.md
* 11_Platform_Capability_Model.md
* 12_Capability_Register_Detail.md
* 14_Driver_App.md
* 15_Fleet_Portal.md
* 16_Atlas.md
