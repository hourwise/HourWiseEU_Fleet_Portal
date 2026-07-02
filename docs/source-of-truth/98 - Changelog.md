# 98 - Changelog

## 1. Purpose

This changelog records significant changes to the HourWise Source of Truth.

It exists to make product, architecture, security, and implementation-impact changes traceable over time.

Every significant change to HourWise should update:

- the affected source-of-truth document
- any affected dependency document
- any required Architecture Decision Record
- this changelog

Implementation should only begin after the source-of-truth change has been recorded here.

---

## 2. When To Add An Entry

Add a changelog entry when a change affects:

- product scope
- MVP scope
- capability definitions
- user journeys
- service blueprints
- platform architecture
- data model
- security model
- integrations
- reporting
- Atlas behaviour
- compliance interpretation
- ADR status or content
- implementation acceptance criteria
- migration or storage behaviour

Minor copy edits, spelling fixes, and formatting-only updates do not need a changelog entry unless they alter meaning.

---

## 3. Entry Template

Copy this template for future changes:

```md
## YYYY-MM-DD - Change Title

| Field | Value |
| --- | --- |
| Change ID | SOT-YYYY-MM-DD-001 |
| Status | Proposed / Accepted / Implemented / Superseded |
| Owner | Product Architecture / Platform Architecture / Security / Engineering |
| Summary | Short description of the change. |
| Reason | Why this change is needed. |
| Affected Source Documents | List document IDs and filenames. |
| Affected ADRs | List ADR IDs or `None`. |
| Capability IDs | List affected capability IDs or `None`. |
| Implementation Impact | None / Low / Medium / High |
| Database Impact | None / Migration Required / Data Backfill Required |
| Security Impact | None / Review Required / Security Gate Required |
| Testing Impact | None / Test Update Required / New Test Coverage Required |
| Rollback Notes | How to reverse or supersede this change if needed. |

### Details

Describe the actual source-of-truth change.

### Completion Checklist

- [ ] Relevant source-of-truth document updated
- [ ] Related documents updated
- [ ] ADR created or updated if required
- [ ] Implementation backlog updated if required
- [ ] Database migration impact assessed
- [ ] Security impact assessed
- [ ] Test impact assessed
```

---

## 4. Change Entries

## 2026-07-02 - Add Source Of Truth Index

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-002 |
| Status | Implemented |
| Owner | Product Architecture |
| Summary | Added a canonical source-of-truth index with stable document IDs mapped to current filenames. |
| Reason | Several filenames are truncated or awkward for tooling, so implementation work needs stable IDs that do not depend on filename shape. |
| Affected Source Documents | `00 - README.md`, `98 - Changelog.md`, `index.md` |
| Affected ADRs | None |
| Capability IDs | None |
| Implementation Impact | Low |
| Database Impact | None |
| Security Impact | None |
| Testing Impact | None |
| Rollback Notes | Remove only if replaced by another canonical document registry. |

### Details

Created `index.md` to map stable IDs such as `SOT-18-07` and `SOT-21` to their current document filenames, categories, owners, statuses, and primary purposes.

Updated `00 - README.md` to identify `index.md` as the canonical document index.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Source Of Truth Changelog

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-001 |
| Status | Implemented |
| Owner | Product Architecture |
| Summary | Added this changelog as the formal change-control record for the HourWise Source of Truth. |
| Reason | `00 - README.md` requires changelog updates for significant HourWise changes, but no changelog file existed. |
| Affected Source Documents | `00 - README.md`, `98 - Changelog.md` |
| Affected ADRs | None |
| Capability IDs | None |
| Implementation Impact | Low |
| Database Impact | None |
| Security Impact | None |
| Testing Impact | None |
| Rollback Notes | Remove this document only if another formal source-of-truth change-control mechanism replaces it. |

### Details

Created `98 - Changelog.md` to provide a consistent template and permanent record for source-of-truth changes.

Updated `00 - README.md` so the update rules point directly to this changelog.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed
