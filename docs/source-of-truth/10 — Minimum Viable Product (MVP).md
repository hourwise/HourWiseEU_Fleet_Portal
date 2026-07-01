# 10 — Minimum Viable Product (MVP)

| Field | Value |
|---------|---------|
| **Document Purpose** | Define the minimum set of capabilities required to deliver a commercially viable first release of the HourWise platform. |
| **Audience** | Founders, developers, designers, AI coding agents, testers, business stakeholders and future contributors. |
| **Dependencies** | All previous strategic documents. |
| **Status** | Living Document |
| **Owner** | Product Architecture |
| **Priority** | Critical |

---

# Introduction

The purpose of this document is not to list every feature that could be built.

Its purpose is to define the smallest complete version of HourWise that customers would realistically pay to use.

The MVP is therefore a commercial milestone rather than a technical milestone.

A capability belongs in the MVP only if delaying it would significantly reduce the value of the platform to its intended customers.

Features that improve the platform but are not essential for initial customer success should be scheduled for later releases.

---

# MVP Philosophy

HourWise should launch when it delivers meaningful value to customers—not when every planned feature has been completed.

The first release should be:

Reliable.

Secure.

Understandable.

Professionally presented.

Commercially valuable.

Every additional capability should strengthen the platform without delaying the delivery of genuine customer value.

---

# Release Strategy

Development is organised into four capability groups.

| Level | Description | Capabilities |
|---------|-------------|--------------|
| **P0** | Launch blockers. The platform cannot be released without these capabilities. | `AUTH-001` to `AUTH-004`, `CORE-001`, `CORE-002`, `CORE-004`, `CORE-005`, `DRV-001` to `DRV-006`, `DRV-008` to `DRV-011`, `FLT-001` to `FLT-003`, `FLT-008`, `CMP-001` to `CMP-004`, `OPS-001` to `OPS-003`, `FIN-001`, `COM-001`, `COM-003`, `REP-001` to `REP-004`, `SYS-001` to `SYS-006`, `ECO-001`, `ECO-002` |
| **P1** | Important launch enhancements. Valuable soon after release but not blockers. | `AUTH-005`, `AUTH-006`, `CORE-003`, `CORE-007`, `DRV-007`, `DRV-012`, `FLT-004`, `FLT-005`, `FLT-006`, `CMP-005`, `CMP-006`, `OPS-008`, `FIN-002` to `FIN-004`, `COM-002`, `COM-004`, `COM-005`, `INT-001`, `INT-002`, `REP-005`, `ECO-003`, `ECO-004`, `ECO-006` |
| **P2** | Growth capabilities. Increase competitiveness and customer value after launch. | `CORE-006`, `FLT-007`, `CMP-007`, `OPS-004` to `OPS-006`, `FIN-005`, `FIN-007`, `COM-006`, `INT-003` to `INT-005`, `REP-006`, `REP-007`, `SYS-007`, `SYS-008`, `ECO-005` |
| **P3** | Long-term strategic capabilities. Enterprise, AI and ecosystem expansion. | `CMP-008`, `OPS-007`, `FIN-006`, `INT-006` to `INT-008`, `ECO-007`, `ECO-008` |

---

# Capability Status

Each capability progresses through the following lifecycle.

📋 Planned

↓

🟡 Designed

↓

🚧 In Development

↓

🧪 Testing

↓

✅ Released

↓

🔄 Improved

---

# Capability Register

Every capability is assigned a permanent identifier.

Capability identifiers are referenced throughout the entire Source of Truth.

Capabilities should never be deleted.

If functionality changes significantly, update the capability rather than creating unnecessary duplicates.
