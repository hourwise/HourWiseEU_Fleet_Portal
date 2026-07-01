# 18 — Compliance Intelligence Platform

| Field                    | Value                            |
| ------------------------ | -------------------------------- |
| **Subsystem**            | Compliance Intelligence Platform |
| **Status**               | Active Development               |
| **Priority**             | Critical                         |
| **Owner**                | Platform Architecture            |
| **Primary Products**     | Fleet Portal, Driver App, Atlas  |
| **Business Criticality** | Highest                          |
| **Estimated Lifetime**   | Long-term Core Platform          |
| **Revision**             | 1.0                              |

---

# Purpose

The Compliance Intelligence Platform is responsible for transforming operational evidence into trusted compliance information.

It is the analytical core of the HourWise Platform.

Rather than acting as a simple tachograph parser, the platform combines multiple evidence sources to produce a complete operational picture of drivers, vehicles and fleets.

The objective is not simply to identify infringements.

The objective is to help operators understand:

* what happened
* why it happened
* what should happen next
* how future problems can be prevented

---

# Platform Objectives

The platform should:

* preserve original evidence
* process imported data safely
* calculate legal compliance
* generate reports
* provide audit evidence
* support Atlas intelligence
* support future integrations
* remain legally explainable

Every calculation should be reproducible.

Every warning should be evidence-backed.

Every report should be traceable.

---

# Core Principles

## Preserve Evidence

Uploaded files are never modified.

Original files remain the authoritative evidence.

---

## Deterministic Processing

The same evidence should always produce the same result.

---

## Explainability

Every warning must explain:

* rule applied
* calculation performed
* supporting evidence
* confidence level (where appropriate)

---

## Traceability

Every report should be traceable back to:

* uploaded file
* parsed activity
* calculation
* compliance rule
* generated report

---

## Extensibility

New evidence sources should be added without redesigning the platform.

Future examples include:

* telematics
* GPS
* wearable devices
* driver declarations
* OCR documents
* third-party compliance feeds

---

# Evidence Sources

Current:

* Driver Card
* Vehicle Unit
* Driver App
* Manual Records

Future:

* GPS providers
* Telematics
* Workshop systems
* DVSA integrations
* Fleet management systems
* Vehicle sensors

---

# Platform Modules

The subsystem is divided into the following specifications.

| Document                 | Purpose                           |
| ------------------------ | --------------------------------- |
| 18.1 Vision              | Long-term vision and objectives   |
| 18.2 System Architecture | Internal architecture             |
| 18.3 Import Pipeline     | Upload, validation and processing |
| 18.4 Driver Card Engine  | Driver card processing            |
| 18.5 Vehicle Unit Engine | Vehicle unit processing           |
| 18.6 Timeline Engine     | Unified activity timeline         |
| 18.7 Compliance Engine   | Rules and calculations            |
| 18.8 Evidence Engine     | Evidence preservation and audit   |
| 18.9 Reporting           | Compliance reports and exports    |
| 18.10 Atlas Interface    | Intelligence integration          |
| 18.11 Future Roadmap     | Planned expansion                 |

---

# Relationship to the HourWise Platform

This subsystem provides trusted compliance data to:

* Fleet Portal
* Driver App
* Atlas
* Reporting Platform
* Audit Packs
* Future APIs

No product should bypass this subsystem when compliance information is required.

---

# Definition of Success

The Compliance Intelligence Platform succeeds when:

* calculations are trusted
* reports are explainable
* evidence is preserved
* audits become easier
* operators gain actionable insight rather than raw data

It should become the foundation on which the rest of the HourWise Platform relies.
