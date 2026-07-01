# 99 — Glossary

## 1. Purpose
This document provides the authoritative definitions for terminology used across the HourWise Source of Truth. Standardisation ensures consistency between technical specifications, the data model, and user interface.

---

## 2. Core Entities

| Term | Definition |
| :--- | :--- |
| **Evidence Pack** | A collection of related source records and events assembled to support a specific compliance outcome or report. |
| **Timeline Event** | A normalised, chronologically ordered operational fact (e.g., "Driving", "Rest", "Card Inserted") derived from primary evidence. |
| **Compliance Outcome** | The result of evaluating a set of Timeline Events against a specific Ruleset (e.g., "Infringement", "Compliant"). |
| **Import Batch** | A grouping of one or more uploaded files received in a single session for processing. |
| **Parser Output** | The structured JSON data produced by the Driver Card or Vehicle Unit engines after decoding a raw file. |
| **Review Note** | A manual observation or interpretation added by a human manager to a record (replaces "Human Review"). |
| **Report Draft** | An unfinalised reporting record that can still be modified before export. |
| **Report Export** | The final, snapshotted version of a report, preserved immutably as a PDF or CSV. |
| **Confidence State** | A metric indicating the reliability of a record (e.g., "Confirmed", "Likely", "Uncertain"). |
| **Source Record** | The fundamental entity level reference for any fact (replaces "Evidence Source" or generic "Source"). |
| **Readiness State** | A calculated status indicating if a Report Draft is ready for export based on missing data and unresolved outcomes. |
| **Tenant / Fleet** | The top-level organisational unit (company) that owns data and defines the security boundary. |
| **Depot** | A sub-location within a Fleet used for grouping drivers and vehicles. |
| **Integration Boundary** | The secure entry point for external data from third-party providers. |
| **Provider Adapter** | A component that translates external third-party data formats into internal HourWise contracts. |

---

## 3. Ambiguity Resolutions

### "Import" vs "Evidence"
- **Import Batch / Import File**: Refers to the *action* and the *raw file* entering the system.
- **Evidence Item**: Refers to the *record* (e.g., a specific Driving period) once it is verified and linked to a Compliance Outcome.
- **Rule**: An "Import" *contains* raw data that becomes "Evidence" once processed and validated.

### Versioning
- **Parser Version**: The version of the decoding logic used to extract data from a raw file.
- **Ruleset Version**: The version of the legal or company rules applied by the Compliance Engine.
- **Processing Version**: Standardised as **Parser Version** for decoding and **Ruleset Version** for compliance.

---

## 4. Relationship to Data Model
The terms defined here map directly to table and column names in the [21 — Data Model Specification](file:///docs/source-of-truth/21%20—%20Data%20Model%20Specification.md).
