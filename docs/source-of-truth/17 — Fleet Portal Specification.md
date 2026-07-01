# 17 — Fleet Portal Specification

| Field                | Value                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document Purpose** | Define the purpose, architecture, capabilities, workflows and long-term vision of the HourWise Fleet Portal.                                   |
| **Audience**         | Founders, developers, designers, AI coding agents, testers and future contributors.                                                            |
| **Dependencies**     | 04_User_Personas.md, 10_MVP.md, 11_Platform_Capability_Model.md, 13_User_Journey_Map.md, 14_Service_Blueprints.md, 15_Platform_Architecture.md |
| **Status**           | Living Document                                                                                                                                |
| **Owner**            | Product Architecture                                                                                                                           |
| **Priority**         | Critical                                                                                                                                       |

---

# Introduction

The Fleet Portal is the operational heart of the HourWise Platform.

It provides transport managers, compliance managers, fleet operators and business owners with a complete operational view of their business.

The portal should not overwhelm users with information.

Instead, it should identify:

* what matters today
* who needs attention
* what risks exist
* what actions should be taken

The Fleet Portal should reduce administration while increasing operational awareness.

---

# Primary Personas

## Sarah — Transport Manager

Daily operational management.

Primary needs:

* dashboard
* drivers
* vehicles
* compliance
* tachograph analysis
* messaging
* incidents
* reports

---

## Emma — Compliance Manager

Primary needs:

* evidence
* infringements
* document expiry
* audits
* reports
* driver cards
* vehicle units

---

## Mike — Fleet Director

Primary needs:

* KPIs
* trends
* compliance
* operational visibility
* strategic reporting
* Atlas summaries

---

## Olivia — Business Owner

Primary needs:

* operational confidence
* profitability indicators
* fleet health
* customer confidence

---

# Product Role

The Fleet Portal transforms operational data into actionable information.

Its role is to:

* receive
* validate
* organise
* analyse
* present
* report

Everything should support better operational decisions.

---

# Implemented Capabilities

Primary capability groups:

* AUTH
* CORE
* FLT
* CMP
* OPS
* FIN
* COM
* REP
* SYS
* INT (Atlas integration)

Refer to the Platform Capability Model for the complete capability list.

---

# Core Portal Modules

The Fleet Portal is organised into modular workspaces.

Each module has a single primary responsibility.

---

# Dashboard

## Purpose

Provide an immediate understanding of fleet health.

### Dashboard should answer:

* What requires attention today?
* Which drivers are at risk?
* Which vehicles require action?
* Which compliance issues are new?
* What has changed since yesterday?

The dashboard should support decision making within two minutes.

---

## Dashboard Widgets

Suggested widgets:

* Atlas Morning Brief
* Fleet Status Summary
* Drivers On Shift
* Drivers Near Legal Limits
* Vehicle Defects
* Maintenance Due
* Driver Card Expiry
* CPC Expiry
* Vehicle Document Expiry
* Today's Messages
* Outstanding Incidents
* Pending Vehicle Checks
* Tachograph Imports
* Weekly KPIs

Widgets should be configurable.

---

# Driver Management

Purpose:

Maintain driver records and operational status.

Features:

* driver profiles
* licence monitoring
* CPC
* driver card
* medicals
* assigned vehicles
* shift history
* incidents
* expenses
* messaging
* permissions
* employment status

---

# Vehicle Management

Purpose:

Maintain fleet information.

Features:

* vehicle profiles
* registrations
* VIN
* fleet groups
* MOT
* PMI
* servicing
* inspections
* insurance
* tax
* calibration
* assigned drivers
* defect history

---

# Tachograph Centre

Purpose:

Process and review driver card and vehicle unit data.

Capabilities:

* upload files
* helper imports
* import history
* validation
* activity timeline
* legal totals
* infringements
* event logs
* speed events
* downloads
* evidence packs

The Tachograph Centre should become the trusted source of operational analysis.

---

# Compliance Centre

Purpose:

Monitor regulatory compliance across the business.

Features:

* infringement overview
* driver hours
* working time
* document expiry
* fleet readiness
* O-Licence readiness
* FORS support
* EcoStars support
* SQAS support
* audit preparation

Compliance should be proactive rather than reactive.

---

# Operations Centre

Purpose:

Manage day-to-day activities.

Features:

* vehicle checks
* defects
* incidents
* investigations
* task assignment
* action tracking
* approvals

---

# Finance Centre

Purpose:

Support operational financial workflows.

Features:

* expense approval
* pay summaries
* overtime visibility
* allowances
* invoice review
* customer/job summaries
* export support

The portal supports finance but does not replace accounting software.

---

# Messaging Centre

Purpose:

Provide operational communication.

Features:

* direct driver messages
* announcements
* reminders
* acknowledgements
* message history

Communication should remain operational.

---

# Reporting Centre

Purpose:

Generate operational and compliance reports.

Report types:

* driver reports
* vehicle reports
* fleet reports
* compliance reports
* tachograph reports
* audit packs
* PDF
* CSV

Reports should be evidence-backed and branded.

---

# Document Centre

Purpose:

Store and manage operational documents.

Supported documents:

* licences
* CPC
* medicals
* insurance
* policies
* procedures
* certificates
* fleet documents
* uploaded evidence

Expiry monitoring should be automatic.

---

# Atlas Workspace

Purpose:

Present operational intelligence.

Initial capabilities:

* daily briefing
* risk summaries
* recommendations
* action list

Future capabilities:

* predictive intelligence
* natural language search
* audit assistant
* fleet benchmarking

Atlas should guide rather than replace human judgement.

---

# Administration

Purpose:

Configure the platform.

Areas include:

* company profile
* users
* permissions
* subscriptions
* branding
* notification settings
* integrations
* audit settings

---

# Search

Global search should locate:

* drivers
* vehicles
* incidents
* reports
* expenses
* documents
* messages
* tachograph imports

Search should be available from every page.

---

# Portal Design Principles

The Fleet Portal should feel:

* calm
* professional
* modern
* data-rich without being cluttered
* trustworthy

Information hierarchy is more important than visual decoration.

---

# Navigation Principles

Users should never feel lost.

Navigation should remain shallow.

Frequently used areas should require minimal clicks.

Dashboard should always be one click away.

---

# Permissions

Portal permissions should support:

* Super Administrator
* Company Owner
* Fleet Manager
* Transport Manager
* Compliance Manager
* Workshop Manager
* Read Only
* Driver (limited portal access if enabled)

Permissions should be role-based and company-scoped.

---

# Notifications

Portal notifications include:

* compliance alerts
* document expiry
* incidents
* defects
* Atlas recommendations
* imports completed
* report generation
* messages

Notifications should always explain the required action.

---

# Data Relationships

The Fleet Portal consumes data from:

* Driver App
* Tachograph imports
* Manual records
* Documents
* Vehicle records
* Integrations
* Atlas

The portal is the operational hub where data becomes information.

---

# MVP Scope

## P0

Required for launch:

* authentication
* dashboard
* driver management
* vehicle management
* tachograph upload
* compliance dashboard
* document management
* incidents
* defects
* messaging
* reporting
* secure multi-tenancy

## P1

Near-launch:

* Atlas rule engine
* configurable dashboard
* maintenance planning
* expense approval
* document reminders
* advanced exports

## P2

Growth:

* predictive Atlas
* workflow automation
* GPS integrations
* accounting integrations
* payroll integrations
* benchmarking
* API ecosystem

---

# Success Metrics

The Fleet Portal succeeds when:

* managers identify priorities within two minutes
* compliance risks are found before they become infringements
* audits require minimal manual preparation
* drivers submit accurate operational information
* paperwork is reduced
* users trust the information presented

---

# Known Risks

* information overload
* feature creep
* dashboard complexity
* inconsistent terminology
* duplicate workflows
* poor mobile responsiveness
* slow tachograph processing
* excessive notifications

These risks should be reviewed regularly.

---

# Future Vision

The Fleet Portal should evolve into the central operating system for transport businesses.

It should become the place where managers begin and end every working day.

Every operational decision should be supported by timely, trustworthy information.

As Atlas matures, the portal should gradually shift from presenting data to recommending actions, while always leaving the final decision to the user.

---

# Definition of Done

A Fleet Portal capability is complete only when:

* capability reference exists
* user journey updated
* service blueprint updated
* security reviewed
* RLS verified
* responsive design tested
* documentation updated
* reporting verified
* audit trail confirmed
* release notes updated

---

# Related Documents

* 10_MVP.md
* 11_Platform_Capability_Model.md
* 12_Capability_Register_Detail.md
* 13_User_Journey_Map.md
* 14_Service_Blueprints.md
* 15_Platform_Architecture.md
* 16_Driver_App.md
* 18_Tachograph_Platform.md
* 19_Atlas.md
