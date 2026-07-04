# 12 — Capability Register Detail

| Field                | Value                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document Purpose** | Define the standard specification that every HourWise capability must follow. This document establishes the template and governance rules for all capability definitions. |
| **Audience**         | Founders, developers, architects, designers, AI coding agents, testers and future contributors.                                                                           |
| **Dependencies**     | 10_MVP.md, 11_Platform_Capability_Model.md                                                                                                                                |
| **Status**           | Living Document                                                                                                                                                           |
| **Owner**            | Product Architecture                                                                                                                                                      |
| **Priority**         | Critical                                                                                                                                                                  |

---

# Introduction

The Platform Capability Model identifies the capabilities that make up the HourWise Platform.

This document defines **how each capability is specified**.

Every capability should follow the same structure regardless of its size or complexity.

Consistency improves:

* architecture
* planning
* development
* testing
* documentation
* AI implementation
* future maintenance

Capabilities are intended to remain stable over many years.

Individual features may change.

Individual user interfaces may change.

Capabilities should remain relatively constant.

---

# Capability Lifecycle

Every capability progresses through a standard lifecycle.

```text
Idea

↓

Research

↓

Specification

↓

Architecture Review

↓

Approved

↓

Development

↓

Testing

↓

Released

↓

Maintained

↓

Enhanced

↓

Deprecated (if required)
```

Capabilities are never deleted.

If replaced, they are marked as deprecated and linked to the replacement capability.

---

# Capability Specification Template

Every capability must contain the following sections.

---

## Capability Identifier

Example:

```text
DRV-002
```

Permanent.

Never reused.

---

## Capability Name

Example:

Working Time Management

Keep names concise and descriptive.

---

## Domain

Examples:

AUTH

CORE

DRV

FLT

CMP

OPS

FIN

COM

INT

REP

SYS

ECO

Every capability belongs to exactly one primary domain.

---

## Summary

One paragraph explaining what the capability does.

This should be understandable by both technical and non-technical readers.

---

## Business Purpose

Why does this capability exist?

Which business problem does it solve?

---

## User Value

What benefit does the user receive?

Describe the outcome rather than the implementation.

---

## Primary Personas

Reference the personas defined in:

04_User_Personas.md

Example:

* James
* Sarah

---

## Secondary Personas

Users who benefit indirectly.

---

## Products

Identify every product implementing this capability.

Examples:

* Driver App
* Fleet Portal
* Atlas
* Website
* Resource Centre

A capability may appear in multiple products.

---

## Priority

Use the standard priority levels.

| Priority | Meaning          |
| -------- | ---------------- |
| P0       | Launch blocker   |
| P1       | Important        |
| P2       | Growth           |
| P3       | Strategic Future |

---

## Status

Use the standard lifecycle.

📋 Planned

🟡 Designed

🚧 Development

🧪 Testing

✅ Released

🔄 Enhanced

❌ Deprecated

---

## Release Target

Example:

Version 1.0

Version 1.1

Version 2.0

Future

---

## Dependencies

List all prerequisite capabilities.

Example:

AUTH-001

CORE-001

DRV-001

Dependencies should reference capability IDs rather than documents.

---

## Related Capabilities

Identify closely related capabilities.

Example:

DRV-003

CMP-001

REP-001

---

## Functional Requirements

Describe everything the capability must do.

Use numbered requirements.

Example:

FR-001

Allow a driver to start a shift.

FR-002

Allow a driver to pause a shift.

FR-003

Automatically calculate elapsed working time.

Requirements should describe behaviour rather than implementation.

---

## Non-Functional Requirements

Performance

Security

Accessibility

Reliability

Scalability

Availability

Offline behaviour

Internationalisation

Logging

Auditability

---

## Inputs

Information consumed by the capability.

Examples:

Driver actions

GPS

Tachograph files

Notifications

API requests

Database records

---

## Outputs

Information produced.

Examples:

Reports

Alerts

Database updates

Notifications

Atlas events

Evidence

---

## Business Rules

Describe the operational rules.

Example:

Working time must never exceed configured legal limits without generating a warning.

Business rules should avoid implementation detail.

---

## Permissions

Who can:

View

Create

Edit

Approve

Delete

Export

Reference platform roles.

---

## Data Ownership

Identify the authoritative source.

Examples:

Driver Profile

Vehicle

Fleet

Compliance Record

Report

---

## Security Considerations

Authentication

Authorisation

Sensitive information

Audit requirements

Encryption

Data retention

Privacy

---

## User Experience Principles

Describe the intended experience.

Fast.

Simple.

Minimal input.

Accessible.

Professional.

---

## Error Handling

Describe expected failures.

Missing permissions.

Missing data.

Network failure.

Validation failure.

Conflict resolution.

Offline mode.

---

## Acceptance Criteria

Define when the capability is considered complete.

Acceptance criteria should be measurable.

Example:

A driver can complete a daily vehicle inspection in under two minutes.

---

## Success Metrics

How do we know this capability is successful?

Examples:

Reduced infringements.

Reduced paperwork.

Time saved.

Customer adoption.

Reduced support requests.

---

## Risks

Known implementation risks.

Technical risks.

Operational risks.

Legal risks.

Commercial risks.

---

## Future Enhancements

Ideas already identified.

These should remain outside the current implementation unless promoted through the roadmap.

---

## Architecture Decisions

Reference any ADRs that affect this capability.

Example:

ADR-003

Atlas provides explanations rather than legal decisions.

---

## Testing Strategy

Unit tests

Integration tests

UI tests

Security tests

Performance tests

Acceptance tests

Regression tests

---

## Documentation Requirements

Every released capability should include:

User documentation.

Developer documentation.

API documentation (where applicable).

Support documentation.

Training material (where appropriate).

---

# Capability Review Checklist

Before approving a capability ask:

* Does it solve a real problem?
* Does it align with the Product Philosophy?
* Does it strengthen at least one Product Pillar?
* Does it respect the Non Goals document?
* Is another capability already responsible?
* Is the capability clearly owned?
* Are dependencies identified?
* Is success measurable?
* Is the MVP priority correct?
* Is documentation complete?

---

# Capability Governance

Capabilities are platform assets.

Changing a capability should follow the same discipline as changing source code.

Major capability changes require:

* updated specification
* architecture review
* dependency review
* MVP review
* changelog update

---

# Rule for AI Coding Agents

AI agents must never invent new capabilities during implementation.

If a required capability does not exist:

1. Stop implementation.
2. Propose the capability.
3. Add it to the Platform Capability Model.
4. Complete the specification.
5. Obtain approval.
6. Continue implementation.

This ensures the architecture remains intentional and traceable.

---

# Related Documents

- [10 — Minimum Viable Product (MVP).md](./10%20—%20Minimum%20Viable%20Product%20%28MVP%29.md)
- [11 — Platform Capability Model.md](./11%20—%20Platform%20Capability%20Model.md)
- [16 — Driver App Specification.md](./16%20—%20Driver%20App%20Specification.md)
- [17 — Fleet Portal Specification.md](./17%20—%20Fleet%20Portal%20Specification.md)
- [24 — Architecture Decision Records.md](./24%20—%20Architecture%20Decision%20Records.md)
