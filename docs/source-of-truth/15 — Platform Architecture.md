# 15 — Platform Architecture

| Field                | Value                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document Purpose** | Define the technical architecture of the HourWise Platform and explain how the Driver App, Fleet Portal, backend, storage, processing services, Atlas, website and integrations fit together. |
| **Audience**         | Developers, architects, AI coding agents, testers and future technical contributors.                                                                                                          |
| **Dependencies**     | 05_Product_Ecosystem.md, 11_Platform_Capability_Model.md, 14_Service_Blueprints.md                                                                                                            |
| **Status**           | Living Document                                                                                                                                                                               |
| **Owner**            | Platform Architecture                                                                                                                                                                         |
| **Priority**         | Critical                                                                                                                                                                                      |

---

# Introduction

HourWise is a multi-product platform.

It is not a single app.

The architecture must support:

* mobile driver workflows
* web-based fleet management
* secure multi-tenant data
* tachograph file processing
* reports and exports
* notifications
* future Atlas intelligence
* future integrations
* future commercial expansion

The architecture should prioritise:

* security
* reliability
* maintainability
* clear separation of concerns
* long-term scalability

---

# Architectural Principle

The platform should be modular.

Each major product has its own user experience, but all products share a common backend, identity layer, data model and reporting foundation.

Products should not duplicate business logic unnecessarily.

---

# High-Level Architecture

```text
Driver App
   │
   │
   ▼
Shared Cloud Backend
   │
   ├── Authentication
   ├── Database
   ├── File Storage
   ├── Edge Functions / API Layer
   ├── Background Jobs
   ├── Notifications
   ├── Reporting Engine
   ├── Tachograph Processing
   └── Atlas Intelligence

   ▲
   │
Fleet Portal

   ▲
   │
Website / Resource Centre
```

---

# Core Products

## Driver App

Primary platform for drivers.

Responsibilities:

* shift tracking
* working time tracking
* driving time monitoring
* breaks
* POA
* expenses
* vehicle checks
* incidents
* notifications
* reports
* fleet-connected workflows

The Driver App should be fast, resilient and mobile-first.

---

## Fleet Portal

Primary platform for managers and operators.

Responsibilities:

* driver management
* vehicle management
* tachograph analysis
* incident review
* maintenance visibility
* expenses
* messaging
* reporting
* compliance oversight
* future Atlas dashboard

The portal should prioritise clarity, visibility and action.

---

## Website

Public-facing marketing and resource platform.

Responsibilities:

* explain HourWise
* early access
* contact/support
* compliance resources
* free downloads
* premium guides
* SEO
* onboarding

The website must remain separate from authenticated portal functionality.

---

## Atlas

Intelligence layer.

Responsibilities:

* rule-based alerts
* daily briefings
* risk scores
* recommendations
* future AI explanations
* future predictive analysis

Atlas should consume validated platform data.

Atlas should not directly invent operational facts.

---

# Frontend Architecture

## Driver App

Current direction:

* React Native
* Expo / React Native tooling
* Mobile-first
* Offline-aware where essential
* Push notifications
* Background location where permitted
* Secure local storage where needed

Core requirements:

* reliable timer behaviour
* clear dashboard
* minimal driver input
* strong permission handling
* safe sync with backend
* graceful recovery from poor connectivity

---

## Fleet Portal

Current direction:

* Vite
* React
* Supabase-backed data access
* Modular manager dashboard
* Responsive SaaS-style UI

Core requirements:

* strong authenticated routing
* company-scoped data
* clear dashboard layout
* reusable components
* responsive design
* polished empty/loading/error states

---

## Website / Resource Centre

Current direction:

* Vite or equivalent lightweight web frontend
* Public marketing pages
* SEO-friendly structure
* Downloadable resources
* Forms for early access/contact

Must not expose private portal data.

---

# Backend Architecture

The backend provides shared services for all products.

Responsibilities:

* authentication
* authorisation
* database access
* file storage
* business logic
* processing workflows
* notifications
* reports
* background jobs
* audit trail

Business logic should not be scattered across frontends.

Where possible, important rules should live in shared backend services or reusable shared modules.

---

# Database Architecture

The database is the authoritative source for operational records.

Core entities include:

* users
* profiles
* companies
* drivers
* vehicles
* work sessions
* tachograph files
* driver card imports
* vehicle unit imports
* activities
* infringements
* vehicle checks
* defects
* incidents
* expenses
* messages
* reports
* documents
* audit records
* Atlas alerts

Every table must have clear ownership and access rules.

---

# Multi-Tenancy

HourWise must be designed as a multi-tenant platform.

Company data must be isolated.

A user should only access records they are authorised to view.

All company-scoped records should include clear tenant ownership.

Row Level Security must be treated as a release blocker.

---

# Authentication & Authorisation

Authentication must support:

* driver accounts
* manager accounts
* owner-driver accounts
* invited fleet drivers
* future admin/support access
* future enterprise roles

Authorisation must support:

* role-based access
* company-level permissions
* driver self-access
* manager access
* admin access
* future fine-grained permissions

---

# File Storage

File storage must support:

* tachograph files
* helper captures
* vehicle unit files
* receipts
* photographs
* documents
* policies
* reports
* resource downloads

Sensitive files must be private by default.

Access must be controlled by ownership, company and role.

---

# Tachograph Processing Architecture

Tachograph processing is a specialist subsystem.

Responsibilities:

* upload files
* preserve original raw files
* identify file type
* process driver card data
* process vehicle unit data
* store parsed activities
* detect infringements
* display analysis
* generate reports
* preserve audit evidence

Manual upload fallback must remain available even if helper workflows improve.

Current helper read-only capture must not be marketed as certified C1B/DDD export unless legally and technically validated.

---

# Reporting Architecture

Reporting should support:

* driver daily reports
* fleet reports
* compliance reports
* tachograph reports
* audit packs
* PDF export
* CSV export
* branded downloads

Reports should be evidence-backed.

Reports should clearly distinguish:

* confirmed data
* estimated data
* incomplete data
* failed imports
* user-entered corrections

---

# Notification Architecture

Notifications may include:

* push notifications
* email
* portal alerts
* future SMS
* Atlas briefings

Notification rules should avoid noise.

Important notifications should explain:

* what happened
* why it matters
* what action is required

---

# Atlas Architecture

Atlas should evolve in phases.

## Phase 1

Rule-based intelligence.

No AI required.

## Phase 2

AI explanation layer.

AI receives structured validated findings.

## Phase 3

Natural language questions.

## Phase 4

Predictive intelligence.

## Phase 5

Audit and accreditation assistant.

Atlas should never access raw data without controlled structure and permissions.

---

# Integration Architecture

Future integrations may include:

* GPS providers
* payroll software
* accounting software
* fuel card providers
* DVLA services
* calendar services
* email providers
* OCR
* external tachograph tools
* APIs

Integration first.

Replacement only where strategically justified.

---

# Security Architecture

Security is a platform requirement, not a feature.

Mandatory areas:

* secrets management
* environment variables
* RLS
* storage policies
* authentication
* role checks
* audit logging
* secure uploads
* input validation
* file-type validation
* future malware scanning
* monitoring
* backup and recovery

No customer release without security review.

---

# Audit Architecture

Significant events should generate audit records.

Examples:

* login events
* driver invite creation
* document upload
* tachograph import
* report export
* incident update
* defect closure
* permission changes
* Atlas recommendation acknowledgement

Audit records should be tamper-resistant where practical.

---

# Background Jobs

Background processing may handle:

* tachograph processing
* report generation
* expiry checks
* reminder generation
* Atlas alerts
* daily briefings
* cleanup tasks
* import retries
* scheduled emails

Jobs must be observable and retryable.

---

# Error Handling

All products should provide:

* clear error messages
* safe retry paths
* useful logs
* no exposure of sensitive internals
* recovery where possible

Technical errors should be logged.

User-facing errors should be understandable.

---

# Offline & Resilience

Driver App workflows should tolerate poor connectivity where practical.

Priority offline-resilient workflows:

* active shift
* timer display
* breaks
* POA
* expense draft
* vehicle check draft
* incident draft

Data should sync safely when connectivity returns.

Conflicts should be handled explicitly.

---

# Performance Principles

The platform should feel responsive.

Priority areas:

* Driver App dashboard
* timer updates
* portal dashboard
* tachograph analysis
* file upload status
* report generation

Long-running operations should show progress.

---

# Monitoring

The platform should monitor:

* frontend errors
* backend errors
* failed imports
* processing delays
* notification failures
* authentication failures
* slow queries
* storage failures
* background job failures

Monitoring should support debugging without exposing sensitive data.

---

# Environments

The platform should maintain clear separation between:

* local development
* staging/test
* production

Production data should never be used casually for testing.

Secrets must be environment-specific.

---

# CI/CD

Future build and deployment should include:

* linting
* type checking
* tests
* security checks
* migration review
* deployment logs
* rollback plan

No release should depend entirely on manual memory.

---

# Architecture Governance

Major architecture changes require:

* documented decision
* affected capabilities identified
* security review
* migration plan
* rollback plan
* changelog update

Architecture should evolve deliberately.

---

# AI Coding Agent Rules

AI agents must:

* follow this architecture
* avoid introducing new frameworks without approval
* avoid duplicating business logic across products
* update relevant documentation
* preserve security assumptions
* avoid weakening RLS or auth checks
* never expose secrets
* never remove manual fallbacks without replacement validation

---

# Related Documents

- [10 — Minimum Viable Product (MVP).md](./10%20—%20Minimum%20Viable%20Product%20(MVP).md)
- [11 — Platform Capability Model.md](./11%20—%20Platform%20Capability%20Model.md)
- [12 — Capability Register Detail.md](./12%20—%20Capability%20Register%20Detail.md)
- [13 — User Journey Map.md](./13%20—%20User%20Journey%20Map.md)
- [14 — Service Blueprints.md](./14%20—%20Service%20Blueprints.md)
- [16 — Driver App Specification.md](./16%20—%20Driver%20App%20Specification.md)
- [17 — Fleet Portal Specification.md](./17%20—%20Fleet%20Portal%20Specification.md)
- [24 — Architecture Decision Records.md](./24%20—%20Architecture%20Decision%20Records.md)
