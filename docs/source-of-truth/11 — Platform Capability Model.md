# 11 — Platform Capability Model

| Field                | Value                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| **Document Purpose** | Define the business capability model for the HourWise Platform.                                 |
| **Audience**         | Founders, developers, designers, AI coding agents, architects, testers and future contributors. |
| **Dependencies**     | 05_Product_Ecosystem.md, 09_Product_Pillars.md, 10_MVP.md                                       |
| **Status**           | Living Document                                                                                 |
| **Owner**            | Product Architecture                                                                            |
| **Priority**         | Critical                                                                                        |

---

# Introduction

HourWise is a platform, not a single application.

The platform is made up of products such as:

* Driver App
* Fleet Portal
* Atlas
* Website
* Resource Centre
* API layer

However, products are not the best way to organise long-term architecture.

Products change.

Screens change.

Frameworks change.

Capabilities remain more stable.

This document defines the core business capabilities of the HourWise Platform.

All future product specifications should reference these capability IDs.

---

# Capability Model Purpose

The capability model exists to create a shared language across the project.

Instead of saying:

> Build the driver timer.

The documentation should refer to:

> Implement capability DRV-002 — Working Time Management.

This makes features traceable across:

* strategy
* product specifications
* design
* engineering
* testing
* release planning
* AI agent instructions

---

# Capability ID Format

Each capability uses a short domain prefix and a permanent number.

Example:

```text
DRV-002
Working Time Management
```

Capability IDs should not be reused.

If a capability changes, update the existing entry.

If a capability is removed, mark it as deprecated rather than deleting it.

---

# Status Markers

| Status            | Meaning                               |
| ----------------- | ------------------------------------- |
| ✅ Released        | Available and verified                |
| 🧪 Testing        | Implemented but still being validated |
| 🚧 In Development | Actively being built                  |
| 🟡 Designed       | Specification exists                  |
| 📋 Planned        | Intended but not yet designed         |
| 🔬 Research       | Requires investigation                |
| 🚀 Future         | Long-term opportunity                 |
| ❌ Deprecated      | No longer planned                     |

---

# Priority Markers

| Priority | Meaning                          |
| -------- | -------------------------------- |
| P0       | Launch blocker                   |
| P1       | Important near-launch capability |
| P2       | Growth capability                |
| P3       | Long-term strategic capability   |

---

# Core Domains

The HourWise Platform is organised into twelve domains.

| Domain                  | Code | Purpose                                                 |
| ----------------------- | ---- | ------------------------------------------------------- |
| Authentication & Access | AUTH | Identity, login, roles and permissions                  |
| Core Platform           | CORE | Shared profiles, settings, storage and audit services   |
| Driver                  | DRV  | Driver-facing operational capabilities                  |
| Fleet                   | FLT  | Manager-facing fleet capabilities                       |
| Compliance              | CMP  | Legal, regulatory and evidence capabilities             |
| Operations              | OPS  | Daily operational workflows                             |
| Finance                 | FIN  | Expenses, invoices, payroll support and rates           |
| Communication           | COM  | Messaging, announcements and notifications              |
| Intelligence            | INT  | Atlas, risk scoring and proactive insights              |
| Reporting               | REP  | Reports, exports, dashboards and evidence packs         |
| Platform Services       | SYS  | Security, integrations, monitoring and background jobs  |
| Ecosystem               | ECO  | Website, Resource Centre, SEO, marketplace and training |

---

# AUTH — Authentication & Access

| ID       | Capability                  | Purpose                                              | Priority | Status     |
| -------- | --------------------------- | ---------------------------------------------------- | -------- | ---------- |
| AUTH-001 | User Authentication         | Allow users to securely create accounts and sign in. | P0       | 📋 Planned |
| AUTH-002 | Password Recovery           | Allow users to recover access safely.                | P0       | 📋 Planned |
| AUTH-003 | Role-Based Access           | Control permissions by user role.                    | P0       | 📋 Planned |
| AUTH-004 | Fleet Invitations           | Allow operators to invite drivers and staff.         | P0       | 📋 Planned |
| AUTH-005 | Multi-Factor Authentication | Strengthen access security for managers/admins.      | P1       | 📋 Planned |
| AUTH-006 | Subscription Access Control | Link feature access to subscription status.          | P1       | 📋 Planned |

---

# CORE — Core Platform

| ID       | Capability             | Purpose                                                  | Priority | Status     |
| -------- | ---------------------- | -------------------------------------------------------- | -------- | ---------- |
| CORE-001 | User Profiles          | Store shared user identity and profile data.             | P0       | 📋 Planned |
| CORE-002 | Company Profiles       | Represent fleet/operator organisations.                  | P0       | 📋 Planned |
| CORE-003 | Settings & Preferences | Store user and company preferences.                      | P1       | 📋 Planned |
| CORE-004 | File Storage           | Store documents, receipts, tachograph files and reports. | P0       | 📋 Planned |
| CORE-005 | Audit Trail            | Record significant system and compliance actions.        | P0       | 📋 Planned |
| CORE-006 | Search                 | Search records across the platform.                      | P2       | 📋 Planned |
| CORE-007 | Activity History       | Show recent activity across platform modules.            | P1       | 📋 Planned |

---

# DRV — Driver

| ID      | Capability              | Purpose                                                    | Priority | Status     |
| ------- | ----------------------- | ---------------------------------------------------------- | -------- | ---------- |
| DRV-001 | Driver Identity         | Represent driver details, documents and fleet link.        | P0       | 📋 Planned |
| DRV-002 | Working Time Management | Track work periods and working-time limits.                | P0       | 📋 Planned |
| DRV-003 | Driving Time Monitoring | Track driving time and break requirements.                 | P0       | 📋 Planned |
| DRV-004 | Break Management        | Track breaks and required rest periods.                    | P0       | 📋 Planned |
| DRV-005 | POA Management          | Track Periods of Availability.                             | P0       | 📋 Planned |
| DRV-006 | Shift Management        | Start, end and review driver shifts.                       | P0       | 📋 Planned |
| DRV-007 | Driver Calendar         | Display historical work and reports.                       | P1       | 📋 Planned |
| DRV-008 | Driver Reports          | Generate driver-facing daily/weekly reports.               | P0       | 📋 Planned |
| DRV-009 | Driver Notifications    | Warn drivers before important limits.                      | P0       | 📋 Planned |
| DRV-010 | Fleet Mode              | Connect driver app workflows to a fleet account.           | P0       | 📋 Planned |
| DRV-011 | Solo Driver Mode        | Support independent drivers without a fleet account.       | P0       | 📋 Planned |
| DRV-012 | Offline Resilience      | Allow essential driver workflows during poor connectivity. | P1       | 📋 Planned |

---

# FLT — Fleet

| ID      | Capability            | Purpose                                        | Priority | Status     |
| ------- | --------------------- | ---------------------------------------------- | -------- | ---------- |
| FLT-001 | Fleet Dashboard       | Provide managers with an operational overview. | P0       | 📋 Planned |
| FLT-002 | Driver Management     | Manage driver profiles, status and records.    | P0       | 📋 Planned |
| FLT-003 | Vehicle Management    | Manage vehicles, documents and status.         | P0       | 📋 Planned |
| FLT-004 | Driver Assignment     | Link drivers to vehicles, depots or fleets.    | P1       | 📋 Planned |
| FLT-005 | Vehicle Maintenance   | Track maintenance, PMI and defects.            | P1       | 📋 Planned |
| FLT-006 | Document Management   | Store and monitor fleet documents.             | P1       | 📋 Planned |
| FLT-007 | Fleet Calendar        | View vehicle, driver and compliance events.    | P2       | 📋 Planned |
| FLT-008 | Driver App Connection | Receive app data from fleet-connected drivers. | P0       | 📋 Planned |

---

# CMP — Compliance

| ID      | Capability             | Purpose                                                    | Priority | Status     |
| ------- | ---------------------- | ---------------------------------------------------------- | -------- | ---------- |
| CMP-001 | Drivers' Hours Rules   | Evaluate driver hours compliance.                          | P0       | 📋 Planned |
| CMP-002 | Working Time Rules     | Evaluate working-time compliance.                          | P0       | 📋 Planned |
| CMP-003 | Infringement Detection | Identify breaches and warnings.                            | P0       | 📋 Planned |
| CMP-004 | Compliance Evidence    | Preserve evidence for audits and reviews.                  | P0       | 📋 Planned |
| CMP-005 | Driver Document Expiry | Monitor licence, CPC, card and medical expiry.             | P1       | 📋 Planned |
| CMP-006 | Vehicle Compliance     | Monitor MOT, PMI, calibration and inspection requirements. | P1       | 📋 Planned |
| CMP-007 | O-Licence Readiness    | Support operator licence evidence and readiness.           | P2       | 📋 Planned |
| CMP-008 | Accreditation Support  | Support FORS, EcoStars, SQAS and Earned Recognition.       | P3       | 🚀 Future  |

---

# OPS — Operations

| ID      | Capability             | Purpose                                       | Priority | Status     |
| ------- | ---------------------- | --------------------------------------------- | -------- | ---------- |
| OPS-001 | Daily Vehicle Checks   | Allow drivers to submit walkaround checks.    | P0       | 📋 Planned |
| OPS-002 | Defect Reporting       | Record, review and close vehicle defects.     | P0       | 📋 Planned |
| OPS-003 | Incident Reporting     | Capture incidents, accidents and near misses. | P0       | 📋 Planned |
| OPS-004 | Investigation Workflow | Support follow-up actions after incidents.    | P2       | 📋 Planned |
| OPS-005 | Task Management        | Assign operational tasks and actions.         | P2       | 📋 Planned |
| OPS-006 | Shift Planning         | Plan shifts and rota coverage.                | P2       | 📋 Planned |
| OPS-007 | Route Planning         | Plan or reference journeys where useful.      | P3       | 🚀 Future  |
| OPS-008 | System Outage Fallback | Provide printable/manual backup workflows.    | P1       | 📋 Planned |

---

# FIN — Finance

| ID      | Capability               | Purpose                                               | Priority | Status     |
| ------- | ------------------------ | ----------------------------------------------------- | -------- | ---------- |
| FIN-001 | Expense Capture          | Allow drivers to record expenses and receipts.        | P0       | 📋 Planned |
| FIN-002 | Expense Review           | Allow managers to review expenses.                    | P1       | 📋 Planned |
| FIN-003 | Payroll Support          | Provide working-time and shift summaries for payroll. | P1       | 📋 Planned |
| FIN-004 | Driver Pay Configuration | Store pay rates, overtime and allowances.             | P1       | 📋 Planned |
| FIN-005 | Owner-Driver Invoicing   | Allow solo drivers to generate invoices.              | P2       | 📋 Planned |
| FIN-006 | Fleet Invoice Support    | Support billing and customer/job records.             | P3       | 🚀 Future  |
| FIN-007 | Accounting Export        | Export data to accounting software.                   | P2       | 📋 Planned |

---

# COM — Communication

| ID      | Capability              | Purpose                                             | Priority | Status     |
| ------- | ----------------------- | --------------------------------------------------- | -------- | ---------- |
| COM-001 | Driver Messaging        | Send messages between portal and app.               | P0       | 📋 Planned |
| COM-002 | Fleet Announcements     | Broadcast operational updates.                      | P1       | 📋 Planned |
| COM-003 | Push Notifications      | Notify users of important events.                   | P0       | 📋 Planned |
| COM-004 | Email Notifications     | Send important messages and reports by email.       | P1       | 📋 Planned |
| COM-005 | Reminder System         | Send expiry, task and compliance reminders.         | P1       | 📋 Planned |
| COM-006 | Message Acknowledgement | Track whether drivers have seen important messages. | P2       | 📋 Planned |

---

# INT — Intelligence

| ID      | Capability            | Purpose                                                  | Priority | Status     |
| ------- | --------------------- | -------------------------------------------------------- | -------- | ---------- |
| INT-001 | Atlas Rule Engine     | Generate deterministic fleet intelligence.               | P1       | 📋 Planned |
| INT-002 | Daily Atlas Briefing  | Summarise what needs attention today.                    | P1       | 📋 Planned |
| INT-003 | Driver Risk Scoring   | Highlight drivers requiring attention.                   | P2       | 📋 Planned |
| INT-004 | Vehicle Risk Scoring  | Highlight vehicles requiring attention.                  | P2       | 📋 Planned |
| INT-005 | AI Explanation Layer  | Turn validated findings into plain-English explanations. | P2       | 📋 Planned |
| INT-006 | Ask Atlas             | Natural-language fleet questions.                        | P3       | 🚀 Future  |
| INT-007 | Predictive Compliance | Forecast risks before they occur.                        | P3       | 🚀 Future  |
| INT-008 | Audit Pack Assistant  | Generate structured evidence packs.                      | P3       | 🚀 Future  |

---

# REP — Reporting

| ID      | Capability           | Purpose                                      | Priority | Status     |
| ------- | -------------------- | -------------------------------------------- | -------- | ---------- |
| REP-001 | Driver Daily Reports | Generate daily driver activity summaries.    | P0       | 📋 Planned |
| REP-002 | Fleet Reports        | Generate manager-facing operational reports. | P0       | 📋 Planned |
| REP-003 | Compliance Reports   | Generate evidence-backed compliance reports. | P0       | 📋 Planned |
| REP-004 | PDF Export           | Export branded PDFs.                         | P0       | 📋 Planned |
| REP-005 | CSV Export           | Export structured data for external systems. | P1       | 📋 Planned |
| REP-006 | Audit Packs          | Produce grouped evidence packs.              | P2       | 📋 Planned |
| REP-007 | Analytics Dashboard  | Display trends and KPIs.                     | P2       | 📋 Planned |

---

# SYS — Platform Services

| ID      | Capability            | Purpose                                                 | Priority | Status     |
| ------- | --------------------- | ------------------------------------------------------- | -------- | ---------- |
| SYS-001 | Security Model        | Enforce access control and data protection.             | P0       | 📋 Planned |
| SYS-002 | Row Level Security    | Protect tenant and user data.                           | P0       | 📋 Planned |
| SYS-003 | Background Jobs       | Run scheduled checks and processing.                    | P0       | 📋 Planned |
| SYS-004 | File Processing       | Process uploads such as tachograph files and documents. | P0       | 📋 Planned |
| SYS-005 | Monitoring & Logging  | Track system health and errors.                         | P0       | 📋 Planned |
| SYS-006 | Backup & Recovery     | Protect against data loss.                              | P0       | 📋 Planned |
| SYS-007 | API Layer             | Provide future external access.                         | P2       | 📋 Planned |
| SYS-008 | Integration Framework | Connect third-party systems.                            | P2       | 📋 Planned |

---

# ECO — Ecosystem

| ID      | Capability             | Purpose                                            | Priority | Status     |
| ------- | ---------------------- | -------------------------------------------------- | -------- | ---------- |
| ECO-001 | Public Website         | Present HourWise to potential customers.           | P0       | 📋 Planned |
| ECO-002 | Early Access Funnel    | Collect interest and beta users.                   | P0       | 📋 Planned |
| ECO-003 | Knowledge Centre       | Publish educational articles and guidance.         | P1       | 📋 Planned |
| ECO-004 | Free Download Centre   | Provide branded forms and templates.               | P1       | 📋 Planned |
| ECO-005 | Paid Compliance Guides | Sell premium PDF guides and packs.                 | P2       | 📋 Planned |
| ECO-006 | Documentation Hub      | Provide help and onboarding material.              | P1       | 📋 Planned |
| ECO-007 | Training Academy       | Offer structured training resources.               | P3       | 🚀 Future  |
| ECO-008 | Marketplace            | Offer partner templates, integrations or services. | P3       | 🚀 Future  |

---

# Product Mapping

## Driver App

Primary capabilities:

* AUTH-001
* CORE-001
* DRV-001 to DRV-012
* OPS-001
* OPS-002
* OPS-003
* FIN-001
* COM-001
* COM-003
* REP-001
* REP-004

---

## Fleet Portal

Primary capabilities:

* AUTH-001 to AUTH-006
* CORE-001 to CORE-007
* FLT-001 to FLT-008
* CMP-001 to CMP-007
* OPS-001 to OPS-008
* FIN-001 to FIN-007
* COM-001 to COM-006
* REP-002 to REP-007
* SYS-001 to SYS-006

---

## Atlas

Primary capabilities:

* INT-001 to INT-008
* CMP-001 to CMP-008
* FLT-001 to FLT-008
* DRV-001 to DRV-012
* OPS-001 to OPS-004
* REP-006
* REP-007

---

## Website & Resource Centre

Primary capabilities:

* ECO-001 to ECO-008
* REP-004
* COM-004
* CORE-004

---

# Capability Governance

Before adding a new capability, ask:

1. Does this capability already exist under another name?
2. Which domain owns it?
3. Which products use it?
4. Is it MVP, growth or future?
5. Does it strengthen one of the product pillars?
6. Does it conflict with the Non Goals document?
7. Does it require a new architecture decision?

---

# Rule for Future Documents

Every future product or module specification should include:

```text
Implemented Capabilities:
- DRV-002
- DRV-003
- REP-001
```

This creates traceability between strategy, product design and implementation.

---

# Related Documents

- [05 — Product Ecosystem.md](./05%20—%20Product%20Ecosystem.md)
- [09 — Product Pillars.md](./09%20—%20Product%20Pillars.md)
- [10 — Minimum Viable Product (MVP).md](./10%20—%20Minimum%20Viable%20Product%20(MVP).md)
- [16 — Driver App Specification.md](./16%20—%20Driver%20App%20Specification.md)
- [17 — Fleet Portal Specification.md](./17%20—%20Fleet%20Portal%20Specification.md)
- [18 — Compliance Intelligence Platform.md](./18%20—%20Compliance%20Intelligence%20Platform.md)
- [19 — Atlas Specification.md](./19%20—%20Atlas%20Specification.md)
