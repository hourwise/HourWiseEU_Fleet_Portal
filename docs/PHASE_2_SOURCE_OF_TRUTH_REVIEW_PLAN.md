# Phase 2: Source of Truth Documentation Review Plan

## 1. Executive Summary

This report assesses the current state of the HourWise "Source of Truth" documentation (Phase 1) and outlines a staged plan for improvement (Phase 2). 

The documentation is high-quality, comprehensive, and technically grounded. However, as the platform moves into deeper implementation, it requires stronger internal cohesion, standardized terminology, and visual architecture representations.

---

## 2. Terminology Audit

The following terms were assessed for consistency across the specification suite.

| Term | Current State | Recommendation |
| :--- | :--- | :--- |
| **Evidence Pack** | Consistent. Used in `21`, `18.8`, `18.9`. | Maintain current usage. |
| **Timeline Event** | Consistent. Core concept in `18.6`. | Maintain current usage. |
| **Compliance Outcome** | Consistent. Core concept in `18.7`. | Maintain current usage. |
| **Import Batch** | Used in `21`, but `18.3` uses generic "Import". | Standardize on **Import Batch** in `18.3` and `18.4/5`. |
| **Parser Output** | Consistent in `21` and `18.6`. | Maintain current usage. |
| **Review Note** | Used in `21`. `18.7` uses "Human Review". | Standardize on **Review Note** across all engines. |
| **Report Draft** | Mentioned in `21` status. | Standardize in `18.9` and `20`. |
| **Report Export** | Used in `21` and `18.9`. | Maintain current usage. |
| **Confidence State** | Very consistent across `21`, `18.6`, `18.7`, `18.8`. | Excellent; do not change. |
| **Source Record** | Inconsistent. Used as "Evidence Source", "Source", and "source_id". | Standardize on **Source Record** for the entity level. |

### Identified Contradictions / Ambiguities
- **"Import" vs "Evidence"**: In `18.3`, the pipeline handles "Evidence", but the data model in `21` separates `import_files` from `evidence_items`. We need to clarify if an "Import" *is* "Evidence" or if it *contains* "Evidence".
- **"Processing Version" vs "Parser Version"**: Used interchangeably in `18.6`. Should standardize on **Parser Version** and **Rule Version** (for compliance).

---

## 3. Diagram Improvement Plan

The documentation relies heavily on text. Mermaid diagrams should be added to the following files to improve clarity for developers and AI agents.

### Priority 1: System Flow & Architecture
- **[15 — Platform Architecture](file:///docs/source-of-truth/15%20—%20Platform%20Architecture.md)**: Add a C4-style System Context diagram.
- **[18.2 — System Architecture](file:///docs/source-of-truth/18.2%20—%20System%20Architecture.md)**: Add a high-level block diagram of the engine pipeline.
- **[18.3 — Evidence Import Pipeline](file:///docs/source-of-truth/18.3%20—%20Evidence%20Import%20Pipeline.md)**: Add a sequence diagram for the upload → validation → storage flow.

### Priority 2: Data & Logic
- **[21 — Data Model Specification](file:///docs/source-of-truth/21%20—%20Data%20Model%20Specification.md)**: Expand the high-level ERD into modular sub-ERDs (Identity, Imports, Timeline, Compliance).
- **[18.6 — Timeline Engine](file:///docs/source-of-truth/18.6%20—%20Timeline%20Engine.md)**: Add a diagram showing the correlation of multiple sources into one timeline.
- **[18.7 — Compliance Engine](file:///docs/source-of-truth/18.7%20—%20Compliance%20Engine.md)**: Add a logic flow diagram for rule evaluation.

---

## 4. Capability ID Integration

The **Capability Model (11)** and **Register (12)** are currently isolated. To ensure traceability, the following files should receive Capability IDs first:

1.  **[10 — Minimum Viable Product (MVP)](file:///docs/source-of-truth/10%20—%20Minimum%20Viable%20Product%20(MVP).md)**: Map every MVP feature to a P0/P1 Capability ID.
2.  **[16 — Driver App Specification](file:///docs/source-of-truth/16%20—%20Driver%20App%20Specification.md)**: Link UI features to `DRV-xxx` IDs.
3.  **[17 — Fleet Portal Specification](file:///docs/source-of-truth/17%20—%20Fleet%20Portal%20Specification.md)**: Link dashboard/management features to `FLT-xxx` IDs.
4.  **[18.1 - 18.10 — Engines](file:///docs/source-of-truth/18.1%20—%20Compliance%20Intelligence%20Plat.md)**: Link engine responsibilities to `CMP-xxx`, `SYS-xxx`, and `REP-xxx` IDs.

---

## 5. Cross-Reference Gaps

Several documents mention "Related Documents" that are missing or have broken names.

- **[21 — Data Model](file:///docs/source-of-truth/21%20—%20Data%20Model%20Specification.md)**: References `18.1` and `18.2` but some engine file names in the directory have spaces or different numbering than the links.
- **[24 — Architecture Decision Records](file:///docs/source-of-truth/24%20—%20Architecture%20Decision%20Records.md)**: This is currently a single file with "starter content". It needs to be split into the proposed `docs/adr/` structure.
- **Glossary**: There is currently no central glossary. All terms from Section 2 of this report should move into a new `docs/source-of-truth/99 — Glossary.md`.

---

## 6. Staged Improvement Plan

To avoid overwhelming the documentation suite, the updates should follow this order:

### Stage 1: Terminology & Glossary (The "Shared Language" Pass)
- Create `99 — Glossary.md`.
- Update `21 — Data Model` to ensure table/column names perfectly match glossary terms.
- Standardize terms across `18.1` to `18.10`.

### Stage 2: Architecture Visualization (The "Visual" Pass)
- Add Mermaid diagrams to `15`, `18.2`, `18.3`, and `21`.
- Add sequence diagrams to `23 — Integration Architecture`.

### Stage 3: Traceability (The "Capability" Pass)
- Inject Capability IDs into `10`, `16`, `17`, and `18`.
- Ensure every "Core Responsibility" in engine docs maps to a Capability ID.

### Stage 4: Decision Records (The "Governance" Pass)
- Extract ADRs from `24` into individual files in `docs/adr/`.
- Update `00 — README` to reference the ADR process as the primary change control.

---

## 7. Open Questions & Risks

1.  **Capability Granularity**: Some capabilities in `11` are very broad (e.g., `CMP-001 Drivers' Hours Rules`). Should we add sub-IDs (e.g., `CMP-001.1`) for specific rules like "Weekly Rest"?
2.  **Diagram Maintenance**: Who maintains the Mermaid code? Recommend keeping code in the Markdown files (as currently done in `21`).
3.  **Cross-Fleet Logic**: The Data Model (21) and Security Model (22) need to be perfectly synced on "Support Access" logic before Phase 3 implementation.
