# Enterprise Architecture Specification Expansion Plan

Date: 2026-07-09
Status: proposed documentation expansion

## Purpose

HourWise now has several enterprise architecture ADRs that affect almost every future feature. These ADRs should remain as decision records, but the underlying architecture deserves a larger reference specification for implementation agents and future engineers.

## Existing Foundation ADRs

- `ADR-0022`: Zero Trust Multi-Tenant Authorisation
- `ADR-0023`: Multi-Site Organisation Hierarchy
- `ADR-0024`: Role-Based Access Control
- `ADR-0025`: Tenant-Aware Atlas AI
- `ADR-0026`: Reporting And Organisational Aggregation
- `ADR-0027`: Resource Assignment And Transfer Lifecycle
- `ADR-0028`: Preventive Maintenance And Asset Compliance Rule Engine
- `ADR-0029`: Atlas Driver Assistant And Voice Operations

## Proposed New Reference Document

Create a future source-of-truth specification:

```text
Enterprise Organisation Architecture Specification
```

This should become the definitive implementation reference for:

- organisation and site hierarchy
- role hierarchy and inheritance
- driver assignment lifecycle
- vehicle/trailer/asset assignment lifecycle
- cross-site transfers
- regional management
- planning integration
- route planning implications
- payroll roll-up
- invoice roll-up
- compliance roll-up
- workshop integration
- messaging permissions
- Atlas permissions and context
- reporting aggregation
- database model
- RLS examples
- API examples
- audit model
- implementation checklists

## Why This Matters

The same architecture must support:

- one self-employed driver
- a 10-vehicle local fleet
- a 100-vehicle multi-depot company
- a 1,000+ vehicle enterprise

The system should scale without changing the underlying security and data model.

## Document Shape

The full specification should include:

- full rationale
- architecture diagrams
- Mermaid sequence diagrams
- database schema sketches
- permission matrices
- RLS policy examples
- API examples
- Atlas interaction examples
- reporting examples
- transfer lifecycle diagrams
- future roadmap
- implementation checklist

## Suggested Sections

### 1. Tenant Model

Platform -> organisation/company -> site/depot -> assigned resources.

Current compatibility position: `companies` and `company_id` remain the enforceable organisation boundary until a controlled organisation/site migration exists.

### 2. Identity And Membership

Define users, profiles, memberships, role assignments, site assignments, and support/system access.

### 3. Role And Permission Model

Expand `ADR-0024` into a practical matrix for Portal, Driver App, Atlas, reports, exports, documents, maintenance, planning, and support.

### 4. Resource Assignment Lifecycle

Define assignment, transfer, historical ownership, effective dates, payroll/compliance/reporting impact, and audit trail.

### 5. Site And Regional Reporting

Define how site, region, and organisation-level reporting aggregates without leaking data across permissions.

### 6. Planning And Operations

Connect rota, jobs, route plans, vehicles, trailers, events, and messages to the organisation/site model.

### 7. Atlas Context And Boundaries

Define what Atlas can see, summarize, and recommend at each scope.

### 8. RLS And API Patterns

Provide canonical examples for future migrations, RPCs, Edge Functions, and client queries.

### 9. Migration Strategy

Define compatibility with current `company_id`, phased introduction of site scope, and backfill/verification requirements.

## Implementation Rule

Until this specification exists, new protected features should explicitly reference:

- `ADR-0022`
- `ADR-0023`
- `ADR-0024`
- `docs/zero-trust-organisation-rbac-matrix-sec-003-2026-07-05.md`
- SEC-007/SEC-009/SEC-010/SEC-012 security verification docs

## Recommended Next Step

After SEC-011 and SEC-012 observation work, expand `ADR-0023` into the full Enterprise Organisation Architecture Specification.
