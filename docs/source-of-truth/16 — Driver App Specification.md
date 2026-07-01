# 16 — Driver App Specification

| Field                | Value                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document Purpose** | Define the purpose, scope, capabilities, workflows and long-term direction of the HourWise Driver App.                                         |
| **Audience**         | Founders, developers, designers, AI coding agents, testers and future contributors.                                                            |
| **Dependencies**     | 04_User_Personas.md, 10_MVP.md, 11_Platform_Capability_Model.md, 13_User_Journey_Map.md, 14_Service_Blueprints.md, 15_Platform_Architecture.md |
| **Status**           | Living Document                                                                                                                                |
| **Owner**            | Product Architecture                                                                                                                           |
| **Priority**         | Critical                                                                                                                                       |

---

# Introduction

The HourWise Driver App is the driver-facing product within the HourWise Platform.

It is the daily companion for professional drivers.

The app should help drivers:

* understand their working position
* track work, driving, breaks and POA
* receive timely warnings
* complete daily administration
* submit records to their fleet
* generate reports
* reduce paperwork
* feel more confident about compliance

The Driver App is not a full management portal.

Its purpose is to make the driver’s working day easier, clearer and better documented.

---

# Primary Personas

## Alex — Fleet Driver

Alex uses the app daily while working for an operator.

Alex needs:

* speed
* simplicity
* clear instructions
* reliable timers
* minimal typing
* fleet communication
* vehicle checks
* incidents
* expenses

---

## James — Owner Driver

James uses the app as an independent driver and business owner.

James needs:

* timers
* reports
* expenses
* invoices
* calendar history
* compliance guidance
* business records

---

# Product Role

The Driver App is the starting point for operational data.

Information captured in the Driver App can later support:

* Fleet Portal dashboards
* payroll support
* compliance reviews
* reports
* incidents
* defect tracking
* Atlas intelligence
* audit evidence

Good fleet data begins with a good driver experience.

---

# Implemented Capabilities

The Driver App primarily implements:

* AUTH-001 User Authentication
* AUTH-002 Password Recovery
* AUTH-004 Fleet Invitations
* CORE-001 User Profiles
* CORE-003 Settings & Preferences
* CORE-004 File Storage
* CORE-005 Audit Trail
* DRV-001 Driver Identity
* DRV-002 Working Time Management
* DRV-003 Driving Time Monitoring
* DRV-004 Break Management
* DRV-005 POA Management
* DRV-006 Shift Management
* DRV-007 Driver Calendar
* DRV-008 Driver Reports
* DRV-009 Driver Notifications
* DRV-010 Fleet Mode
* DRV-011 Solo Driver Mode
* DRV-012 Offline Resilience
* OPS-001 Daily Vehicle Checks
* OPS-002 Defect Reporting
* OPS-003 Incident Reporting
* FIN-001 Expense Capture
* FIN-005 Owner-Driver Invoicing
* COM-001 Driver Messaging
* COM-003 Push Notifications
* REP-001 Driver Daily Reports
* REP-004 PDF Export

---

# Core App Modes

The Driver App supports two primary modes.

---

## Solo Driver Mode

Used by owner-drivers or independent drivers not connected to a fleet.

Primary features:

* personal driver profile
* work and driving timers
* break and POA tracking
* reports
* expenses
* calendar
* pay estimates
* future invoice generation

Solo Driver Mode should feel self-contained.

---

## Fleet Driver Mode

Used by drivers connected to a fleet account.

Primary features:

* fleet-connected profile
* shift data shared with portal
* vehicle checks
* defect reports
* incident reports
* expenses
* messages from transport office
* fleet reminders
* compliance visibility

Fleet Driver Mode should feel simple and operational, not managerial.

---

# Primary Navigation Areas

The app should be organised around practical driver tasks.

Recommended areas:

* Dashboard
* Shift / Timers
* Calendar
* Reports
* Expenses
* Vehicle Checks
* Incidents
* Messages
* Settings

Navigation should remain simple.

The dashboard should be the driver’s home.

---

# Dashboard

## Purpose

Give the driver an immediate understanding of their working position.

## Should Show

* current shift status
* working time
* driving time
* break status
* POA status
* remaining time
* current warnings
* next required action
* active fleet messages
* quick actions

## Design Goal

The driver should understand their current position within seconds.

---

# Shift Management

## Purpose

Allow drivers to start, manage and end their working day.

## Required Actions

* start shift
* end shift
* start break
* end break
* start POA
* end POA
* review shift
* confirm report

## Success Criteria

Driver can start and end a shift without confusion.

Timer state remains reliable even if the app is backgrounded.

---

# Working Time Management

## Purpose

Track working periods and warn drivers before relevant limits.

## Requirements

* track active work
* calculate elapsed work
* support 6-hour working time warnings
* support 9-hour working time warnings
* distinguish break and POA
* preserve history
* produce reports

## UX Requirement

Warnings should explain what is required, not merely display a number.

---

# Driving Time Monitoring

## Purpose

Help drivers monitor driving time and required breaks.

## Requirements

* track driving time
* support 4h30 driving period warnings
* show remaining driving time
* support weekly driving visibility
* support fortnightly driving visibility where data is available
* warn before relevant limits

## Important Note

App-based driving detection supports awareness but does not replace legal tachograph records.

---

# Break Management

## Purpose

Track breaks and help drivers understand when a break satisfies requirements.

## Requirements

* track break duration
* show current break duration
* identify 15-minute and 30-minute break segments
* support 45-minute break logic
* explain whether break requirement has been satisfied

---

# POA Management

## Purpose

Allow drivers to record Periods of Availability.

## Requirements

* start POA
* end POA
* display active POA duration
* include POA in reports
* separate POA from working time and break where relevant

---

# Vehicle Checks

## Purpose

Allow drivers to complete daily walkaround checks digitally.

## Requirements

* checklist
* pass/fail items
* defect capture
* photos
* notes
* timestamp
* vehicle link
* submission to portal
* offline draft support where practical

## Success Criteria

Driver completes a standard check in under two minutes.

---

# Defect Reporting

## Purpose

Allow vehicle defects to be recorded clearly and passed to the fleet.

## Requirements

* defect type
* severity
* vehicle
* notes
* photographs
* driver confirmation
* portal visibility
* audit trail

---

# Incident Reporting

## Purpose

Capture incident, accident and near-miss evidence while details are fresh.

## Requirements

* incident type
* date/time
* location
* driver statement
* photographs
* witness details
* vehicle involved
* third-party details where applicable
* submission to portal

## UX Requirement

The process should feel calm and guided.

Incidents are stressful.

The app should not increase stress.

---

# Expense Capture

## Purpose

Allow drivers to record expenses quickly.

## Requirements

* expense type
* amount
* receipt photo
* notes
* date
* submission status
* portal review for fleet drivers
* report inclusion for solo drivers

## Success Criteria

Expense can be captured in under 30 seconds.

---

# Driver Reports

## Purpose

Provide driver-facing summaries of work and records.

## Report Types

* daily report
* weekly summary
* expenses summary
* pay estimate
* future invoice support

Reports should be exportable where useful.

---

# Calendar

## Purpose

Show historical work and activity.

## Requirements

* monthly view
* shift history
* report access
* edit/review where permitted
* visual compliance indicators

---

# Messaging

## Purpose

Allow operational messages between fleet and driver.

## Requirements

* receive messages
* send replies where permitted
* view announcements
* acknowledge important messages
* push notification support

Messaging should remain operational, not social.

---

# Notifications

## Purpose

Alert drivers before important events.

## Notification Types

* working time warnings
* driving time warnings
* break reminders
* shift reminders
* fleet messages
* document reminders
* report reminders

Notifications should avoid noise.

Every notification should be useful.

---

# Settings

## Purpose

Allow users to configure app behaviour.

## Settings May Include

* driver profile
* business profile
* pay configuration
* language
* notification preferences
* permissions
* subscription
* fleet connection
* sign out

Settings should be clear and grouped logically.

---

# Offline Resilience

The app should remain useful when connectivity is poor.

Priority offline behaviours:

* active timers
* shift state
* break state
* POA state
* expense drafts
* incident drafts
* vehicle check drafts

When connection returns, data should sync safely.

---

# Permissions

The app may request:

* location
* background location
* notifications
* camera
* media/photo access where needed

Permissions should be explained before requesting them.

Users should understand why each permission is needed.

---

# Compliance Disclaimer

The Driver App supports awareness, record keeping and operational management.

It does not replace legally required tachograph equipment or official records.

This disclaimer should be communicated clearly without alarming users.

---

# UX Principles

The Driver App should feel:

* fast
* calm
* simple
* practical
* professional
* trustworthy

The app should avoid:

* crowded screens
* excessive warnings
* unclear terminology
* unnecessary typing
* hidden actions
* complex menus

---

# Data Sync

Driver App data may sync to:

* work sessions
* expenses
* reports
* vehicle checks
* defects
* incidents
* messages
* driver profile
* Fleet Portal dashboards
* Atlas risk engine

Sync must be secure and company-scoped.

---

# MVP Scope

## P0

Required for launch:

* authentication
* driver profile
* timers
* breaks
* POA
* notifications
* reports
* calendar
* fleet connection
* vehicle checks
* incident reporting
* expenses
* basic messaging
* secure sync

## P1

Near-launch:

* improved offline drafts
* document reminders
* richer reports
* calendar export
* message acknowledgement
* expense review status

## P2

Growth:

* owner-driver invoices
* advanced pay logic
* fleet policy acknowledgement
* training reminders
* enhanced analytics

---

# Known Risks

* background timer reliability
* GPS accuracy
* battery optimisation
* offline sync conflicts
* permission refusal
* user misunderstanding of tachograph limitations
* notification overload
* feature creep

---

# Future Enhancements

* invoice generation
* calendar export
* improved driving detection
* company device mode
* low-speed yard detection
* advanced fatigue indicators
* wearable integration
* voice-guided workflows
* document wallet
* training records

---

# Testing Requirements

The Driver App should be tested for:

* timer reliability
* app backgrounding
* device restart
* poor connectivity
* permission refusal
* notification delivery
* offline drafts
* sync conflicts
* accessibility
* multi-language display
* long shifts
* edge-case break patterns

---

# Definition of Done

A Driver App feature is complete only when:

* capability reference exists
* user journey updated
* service blueprint updated
* implementation complete
* tested on real device
* sync verified
* security reviewed
* documentation updated
* changelog updated

---

# Related Documents

* 04_User_Personas.md
* 10_MVP.md
* 11_Platform_Capability_Model.md
* 13_User_Journey_Map.md
* 14_Service_Blueprints.md
* 15_Platform_Architecture.md
* 17_Fleet_Portal.md
