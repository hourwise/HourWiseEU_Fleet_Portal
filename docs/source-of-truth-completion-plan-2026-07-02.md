# HourWise Source of Truth Completion Plan

Date: 2026-07-02
Scope: `docs/source-of-truth`
Output purpose: assess the new HourWise system documentation set and define the next steps, markups, and completion gates needed before implementation work treats it as authoritative.

## Executive Assessment

The `docs/source-of-truth` collection is strong enough to act as the primary product and architecture reference for HourWise. It covers product strategy, personas, MVP scope, capability modelling, journeys, service blueprints, platform architecture, Driver App, Fleet Portal, Compliance Intelligence, Atlas, reporting, data model, security, integrations, ADRs, and glossary.

It is not yet complete as an implementation control system. The main gaps are not missing narrative; they are governance and execution gaps:

- Several major implementation checklists remain unchecked.
- The ADR process exists, but ADRs are still embedded in one large document instead of managed as separate records.
- The README requires a changelog, but no changelog document was found during this pass.
- Some file names and link targets are awkward for tooling, especially `10 - Minimum Viable Product (MVP).md` links that contain parentheses.
- The data model still lists unresolved architecture questions that should become ADRs before schema work.
- The current product specs define workflows and capabilities, but not enough UI-level acceptance detail for build handoff.

Recommendation: treat the collection as `architecture-approved / implementation-pending`, then complete the gates below before using it as the sole build source.

## Inventory Reviewed

Source set contains 39 Markdown files:

- `00 - README.md`
- `01` to `09`: strategy, philosophy, problems, personas, ecosystem, principles, competitive position, non-goals, pillars
- `10` to `14`: MVP, capability model, capability detail, journeys, service blueprints
- `15` to `17`: architecture, Driver App, Fleet Portal
- `18` to `18.11`: Compliance Intelligence platform and engine suite
- `19` to `24`: Atlas, reporting, data model, security, integration architecture, ADRs
- `98`: changelog
- `99`: glossary
- `index`: stable source-of-truth document index

Managed ADR records in `docs/adr` now contain 11 Markdown files:

- `ADR-0019`: Windows helper local outbox and sync semantics
- `ADR-0020`: rota, job planning, route estimates, and compliance-aware updates
- `ADR-0021`: unified event synchronisation, messaging, and Atlas integration
- `ADR-0022`: zero trust multi-tenant authorisation
- `ADR-0023`: multi-site organisation hierarchy
- `ADR-0024`: role-based access control
- `ADR-0025`: tenant-aware Atlas AI
- `ADR-0026`: reporting and organisational aggregation
- `ADR-0027`: resource assignment and transfer lifecycle
- `ADR-0028`: preventive maintenance and asset compliance rule engine
- `ADR-0029`: Atlas Driver Assistant and voice operations

Existing supporting documents also found:

- `docs/PHASE_2_SOURCE_OF_TRUTH_REVIEW_PLAN.md`
- `docs/PHASE_2_COMPLETION_SUMMARY.md`

Current repo context:

- Vite/React/TypeScript application
- Supabase migrations and edge functions already exist
- Existing tachograph processing tools and helper utilities exist
- Current scripts include `build`, `lint`, `typecheck`, and tachograph-specific test/runtime helpers

## Readiness By Area

| Area | Assessment | Markup | Completion Need |
| --- | --- | --- | --- |
| Product strategy | Clear and coherent | `[SOT-OK]` | Keep stable; only update through changelog |
| Personas and problems | Good for product decisions | `[SOT-OK]` | Add measurable UX acceptance criteria when implementing screens |
| MVP and capability model | Directionally strong | `[DOC-FIX]` | Convert MVP into an executable milestone backlog |
| Journeys and blueprints | Useful but high level | `[IMPLEMENT-MVP]` | Add API/schema/test references per first milestone |
| Platform architecture | Good baseline | `[VERIFY]` | Reconcile with existing Supabase schema/functions |
| Driver App spec | Good product scope | `[IMPLEMENT-LATER]` | Delay until portal/compliance foundation is stable |
| Fleet Portal spec | Good product scope | `[IMPLEMENT-MVP]` | Needs page-level acceptance criteria for build work |
| Compliance Intelligence suite | Strong core architecture | `[IMPLEMENT-MVP]` | Needs rule-level design and parser/schema alignment |
| Atlas specs | Detailed but not MVP-critical | `[DEFER-P1]` | Keep safety model; defer broad assistant build |
| Reporting spec | Detailed but downstream | `[DEFER-P1]` | Implement after evidence packs and compliance outcomes exist |
| Data model | Strong draft | `[DECISION-ADR]` | Resolve open architecture questions before migrations |
| Security model | Strong draft | `[SECURITY-GATE]` | Convert to RLS tests and permission test matrix |
| Integrations | Strong roadmap | `[DEFER-P1]` | Keep parser/helper integration only for MVP |
| ADRs | Good starter set | `[DOC-FIX]` | Split into managed ADR records |
| Glossary | Present and useful | `[SOT-OK]` | Expand as implementation names settle |

## Completion Markups

Use these tags when annotating source-of-truth work items, PRs, or follow-up tasks.

| Markup | Meaning | Required Action |
| --- | --- | --- |
| `[SOT-OK]` | Document is good enough to guide implementation | Keep under change control |
| `[DOC-FIX]` | Documentation issue blocks reliable use | Fix before implementation depends on it |
| `[DECISION-ADR]` | Architecture/product decision needed | Create or update ADR before coding |
| `[IMPLEMENT-MVP]` | Required for first build milestone | Convert into backlog tasks with tests |
| `[SECURITY-GATE]` | Security-sensitive item | Add explicit RLS/API/permission tests |
| `[TEST-GATE]` | Must have automated test coverage before complete | Define test cases before marking done |
| `[VERIFY]` | Needs reconciliation with existing code/schema | Compare docs to repo before changing implementation |
| `[DEFER-P1]` | Important but not required for first milestone | Keep documented, do not build yet |
| `[DEFER-FUTURE]` | Future roadmap item | Revisit after MVP |

## Immediate Documentation Fixes

### 1. Add Changelog

Markup: `[DOC-FIX]`

The README says significant changes must update a changelog, but no changelog file was found. Add:

- `docs/source-of-truth/CHANGELOG.md` or `docs/source-of-truth/98 - Changelog.md`
- Entry template with date, author, affected docs, affected ADRs, implementation impact, and migration impact
- Rule that source-of-truth changes and implementation PRs reference the same change entry

Completion gate:

- Every future source-of-truth change has a changelog entry.

### 2. Fix Tool-Fragile Links

Markup: `[DOC-FIX]`

Relative Markdown links to `10 - Minimum Viable Product (MVP).md` are fragile because the link target includes parentheses. They should encode parentheses as `%28` and `%29`, or the file should be renamed in a controlled link-rewrite pass.

Known affected files from this pass:

- `01 - Executive Summary.md`
- `11 - Platform Capability Model.md`
- `12 - Capability Register Detail.md`
- `15 - Platform Architecture.md`
- `16 - Driver App Specification.md`
- `17 - Fleet Portal Specification.md`

Completion gate:

- A Markdown link check can parse all relative links without false truncation at `(MVP)`.

### 3. Standardise Filenames For Build Tooling

Markup: `[DOC-FIX]`

Several filenames are descriptive but awkward for shell scripts, link checkers, and AI/code tools:

- `18.1 - Compliance Intelligence Plat.md`
- `18.2 - Compliance Intelligence Plat.md`
- `20 - Reporting Platform Specificati.md`
- filenames containing em dashes and parentheses

Options:

- Keep display titles as-is and add a machine-readable index file.
- Rename files to stable ASCII slugs and update all links in one pass.

Recommended approach:

- Do not rename immediately unless the team accepts a one-time docs link rewrite.
- Add `docs/source-of-truth/index.md` with canonical titles, current filenames, and stable document IDs.

Completion gate:

- Every source document has a stable document ID independent of filename.

### 4. Split ADRs

Markup: `[DOC-FIX]`, `[DECISION-ADR]`

`24 - Architecture Decision Records.md` contains the ADR process and 15 starter ADRs. This is useful for reading, but poor for governance.

Create:

- `docs/adr/README.md`
- `docs/adr/ADR-0001-record-architecture-decisions.md`
- One file per ADR through `ADR-0015`
- `docs/adr/template.md`

Keep `24 - Architecture Decision Records.md` as an index and process guide, not as the authoritative home of every ADR body.

Completion gate:

- Each ADR has status, date, context, decision, alternatives, consequences, implementation notes, review triggers, and links to affected source-of-truth docs.

## Decisions Required Before Build

These decisions are called out or implied by the source set and should be resolved before database or engine implementation expands.

| Decision | Source | Markup | Why It Blocks |
| --- | --- | --- | --- |
| Driver card history table from the start | `21 - Data Model Specification.md` | `[DECISION-ADR]` | Affects migrations, imports, card replacement, driver history |
| Vehicle unit history table from the start | `21 - Data Model Specification.md` | `[DECISION-ADR]` | Affects VU imports, vehicle replacement, audit history |
| Parser output relational vs JSONB split | `21`, `18.3`, `18.4`, `18.5` | `[DECISION-ADR]` | Affects queryability, performance, parser versioning |
| Timeline event versioning vs regeneration | `21`, `18.6` | `[DECISION-ADR]` | Affects auditability and report snapshot integrity |
| Atlas conversation retention | `21`, `19`, `22` | `[DEFER-P1]` | Required before Atlas is enabled beyond prototype |
| Raw tachograph file retention | `21`, `22`, `24` | `[SECURITY-GATE]` | Affects storage cost, legal retention, deletion policy |
| Desktop helper local cache/outbox vs browser-only handoff | `18.3`, `22`, `23` | `[DECISION-ADR]`, `[SECURITY-GATE]` | Affects reader speed perception, offline sync, local personal-data storage, and duplicate import handling |
| Helper signing/update distribution route | `22`, `23` | `[SECURITY-GATE]`, `[VERIFY]` | Portal-hosted download exists, but production signing certificate, timestamping, and update policy still need finalisation |
| Immutable report export retention | `20`, `21`, `24` | `[DECISION-ADR]` | Affects report storage and audit expectations |
| Support access session model | `21`, `22` | `[SECURITY-GATE]` | Affects service role safety and audit logs |
| Billing schema isolation | `21`, `23` | `[DEFER-P1]` | Not required for compliance MVP unless billing is in first release |
| Rule definitions as data vs code references | `18.7`, `21`, `24` | `[DECISION-ADR]` | Affects compliance engine design and test strategy |
| Rota/job/route planning data model | `ADR-0020`, `16`, `17`, `21`, `23` | `[DECISION-ADR]`, `[DEFER-P1]` | Affects shared Portal/App schema, route estimate storage, legal-availability calculations, and advisory navigation wording |
| Unified operational event log and sync model | `ADR-0021`, `18.10`, `19`, `21`, `22`, `23` | `[DECISION-ADR]`, `[SECURITY-GATE]` | Affects messaging, realtime/push delivery, driver acknowledgement, Atlas access, event deduplication, and RLS visibility |
| Zero trust tenant/site/role enforcement | `ADR-0022`, `22`, `21`, `23` | `[SECURITY-GATE]`, `[IMPLEMENT-MVP]` | Every request must be authorised by organisation, site, role, ownership, and operation; affects RLS, RPCs, Edge Functions, exports, reports, cache keys, and Atlas |
| Multi-site organisation hierarchy | `ADR-0023`, `21`, `22`, `17`, `20` | `[DECISION-ADR]`, `[SECURITY-GATE]` | Introduces organisation/site scoping across drivers, vehicles, reporting, transfers, and Atlas comparisons |
| Role-based access control model | `ADR-0024`, `22`, `21` | `[SECURITY-GATE]`, `[IMPLEMENT-MVP]` | Requires role tables, permission categories, inheritance/default-deny semantics, audit logs, and permission regression tests |
| Tenant-aware Atlas execution | `ADR-0025`, `19`, `18.10`, `22` | `[SECURITY-GATE]`, `[DEFER-P1]` | Atlas must inherit caller permissions, never bypass RLS, audit requests/responses, and include tenant context in retrieval/query paths |
| Reporting aggregation permission model | `ADR-0026`, `20`, `21`, `22` | `[SECURITY-GATE]`, `[DEFER-P1]` | Driver, vehicle, site, region, and organisation reports need upward aggregation without leaking unauthorised site data |
| Resource assignment and transfer lifecycle | `ADR-0027`, `21`, `ADR-0021`, `ADR-0023` | `[DECISION-ADR]`, `[DEFER-P1]` | Driver/vehicle site transfers must preserve payroll, compliance, maintenance, messages, shifts, and audit history through events |
| Preventive maintenance and asset compliance rule engine | `ADR-0028`, `17`, `20`, `21`, `22`, `23`, `ADR-0023`, `ADR-0024`, `ADR-0025`, `ADR-0026` | `[DECISION-ADR]`, `[SECURITY-GATE]`, `[DEFER-P1]` | Asset rules, readings, due states, evidence, notifications, Atlas summaries, site visibility, and reporting exports need schema, permission, stale-reading, and audit design before implementation |
| Atlas Driver Assistant and voice operations | `ADR-0029`, `16`, `19`, `22`, `ADR-0021`, `ADR-0025` | `[SECURITY-GATE]`, `[DEFER-P1]` | Driver-facing Atlas requires approved knowledge sources, driving-safe mode, permissions, audit logging, and controlled action templates before implementation |

## Implementation Completion Sequence

### Phase 0 - Source-of-Truth Hardening

Goal: make the documentation safe to use as implementation input.

Tasks:

- Add changelog/change-control document.
- Add source-of-truth index with stable document IDs.
- Fix or explicitly document MVP link escaping.
- Split ADRs or create a documented ADR extraction backlog.
- Add a docs validation script for relative links and UTF-8 reads.
- Add a checklist roll-up table showing unchecked items by document.

Exit criteria:

- No unresolved documentation hygiene issue blocks implementation planning.
- All `[DOC-FIX]` items above are either complete or tracked with owner/date.

### Phase 1 - Docs-To-Code Reconciliation

Goal: compare the new source-of-truth against current Supabase/schema/functions/frontend before adding more tables.

Tasks:

- Map existing migrations to data model entities in `21`.
- Map existing Supabase functions to integration/security requirements in `22` and `23`.
- Map existing tachograph processing code to `18.3` to `18.7`.
- Identify legacy tables/fields that conflict with new terminology.
- Identify existing RLS policies that need replacement or hardening.
- Produce a migration strategy: preserve, rename, backfill, or supersede.

Exit criteria:

- A table exists showing each source-of-truth entity and whether it is already implemented, partially implemented, missing, or superseded.
- No schema migration is written until conflicts are resolved.

### Phase 2 - MVP Build Backlog

Goal: convert the documentation into a buildable, testable MVP backlog.

Recommended MVP milestone:

`Secure Upload to Timeline`

Scope:

- Authenticated fleet user can upload a driver card or VU file.
- Raw file is stored immutably in private storage.
- Import batch and import file records are created.
- Parser run is versioned and audited.
- Parser output is stored.
- Normalised activities are created.
- Timeline events are visible in the Fleet Portal.
- Cross-tenant access is blocked by RLS and API checks.

Required source documents:

- `10 - Minimum Viable Product (MVP).md`
- `15 - Platform Architecture.md`
- `18.3 - Evidence Import Pipeline.md`
- `18.4 - Driver Card Engine.md`
- `18.5 - Vehicle Unit Engine.md`
- `18.6 - Timeline Engine.md`
- `21 - Data Model Specification.md`
- `22 - Security Model Specification.md`
- `23 - Integration Architecture.md`
- `24 - Architecture Decision Records.md`

Exit criteria:

- Backlog tasks have capability IDs, source document links, schema impact, API impact, UI impact, and tests.

### Phase 3 - Security Foundation

Goal: implement tenancy, permissions, storage controls, and audit logging before compliance intelligence expands.

Tasks:

- Implement or reconcile fleet/tenant membership model.
- Implement RLS policies for MVP tables.
- Add server-side permission helpers.
- Lock down raw tachograph file storage.
- Add audit log events for upload, parser run, timeline generation, report export, support access, and protected downloads.
- Add tests for cross-tenant access, ID tampering, and service-role use.

Exit criteria:

- Security tests fail before policy implementation and pass after implementation.
- Service role usage is wrapped by explicit permission checks.

### Phase 4 - Compliance Engine Foundation

Goal: build deterministic compliance outcomes on top of timeline events.

Tasks:

- Resolve rule definitions as data vs code references.
- Define MVP rule set boundaries.
- Add rule versioning.
- Generate compliance checks and outcomes.
- Link outcomes to source records and timeline events.
- Add review notes and confidence states.
- Add rule regression tests using fixture tachograph data.

Exit criteria:

- A compliance outcome can be traced from raw file to parser output to timeline event to rule version.

### Phase 5 - Evidence Packs And Reporting

Goal: create auditable evidence and report snapshots after compliance outcomes are stable.

Tasks:

- Implement evidence packs as first-class records.
- Add evidence completeness checks.
- Implement report drafts.
- Implement readiness checks.
- Implement export snapshots.
- Add PDF/CSV generation only after snapshot integrity is proven.

Exit criteria:

- A report export can be reproduced from its snapshot without depending on mutable live records.

### Phase 6 - Atlas MVP

Goal: add Atlas only as a permission-checked explanation layer over existing evidence.

Tasks:

- Implement context resolver.
- Implement server-side retrieval with permission checks.
- Implement source-card response format.
- Implement unsupported-request handling.
- Add prompt-injection and legal wording tests.
- Add audit logging for prompts, sources, model/provider metadata, and actions.

Exit criteria:

- Atlas cannot retrieve data the user cannot access directly.
- Every evidence-backed answer links to source records.
- Unsupported or insufficient-evidence prompts fail safely.

## File-Level Markups For Completion

| Document | Recommended Markup | Completion Action |
| --- | --- | --- |
| `00 - README.md` | `[DOC-FIX]` | Add changelog reference once changelog exists |
| `01` to `09` | `[SOT-OK]` | Freeze except for changelog-controlled changes |
| `10 - Minimum Viable Product (MVP).md` | `[IMPLEMENT-MVP]`, `[DOC-FIX]` | Convert MVP into milestone backlog and fix link fragility |
| `11 - Platform Capability Model.md` | `[SOT-OK]` | Use as capability ID authority |
| `12 - Capability Register Detail.md` | `[SOT-OK]` | Use as backlog item template |
| `13 - User Journey Map.md` | `[IMPLEMENT-MVP]` | Mark journeys included in first milestone |
| `14 - Service Blueprints.md` | `[IMPLEMENT-MVP]` | Add concrete blueprint for secure upload to timeline |
| `15 - Platform Architecture.md` | `[VERIFY]` | Reconcile with current Supabase/functions/code |
| `16 - Driver App Specification.md` | `[DEFER-P1]` | Avoid expanding until portal compliance foundation stabilises |
| `17 - Fleet Portal Specification.md` | `[IMPLEMENT-MVP]` | Define timeline/upload pages and acceptance criteria |
| `18 - Compliance Intelligence Platform.md` | `[SOT-OK]` | Keep as subsystem overview |
| `18.1` to `18.2` | `[DOC-FIX]` | Clarify filenames or add stable index IDs |
| `18.3` to `18.6` | `[IMPLEMENT-MVP]` | Build import, parser, normalisation, and timeline foundation |
| `18.7` | `[DECISION-ADR]` | Resolve rule definition strategy before build |
| `18.8` to `18.9` | `[DEFER-P1]` | Implement after compliance outcomes are reliable |
| `18.10` | `[DEFER-P1]` | Preserve safety model; defer broad UI work |
| `18.11` | `[SOT-OK]` | Keep as roadmap, not MVP backlog |
| `19 - Atlas Specification.md` | `[DEFER-P1]`, `[SECURITY-GATE]` | Implement only after evidence retrieval exists |
| `20 - Reporting Platform Specificati.md` | `[DEFER-P1]` | Rename/index and defer until evidence packs exist |
| `21 - Data Model Specification.md` | `[DECISION-ADR]`, `[IMPLEMENT-MVP]` | Resolve open questions and map to migrations |
| `22 - Security Model Specification.md` | `[SECURITY-GATE]` | Convert checklist to permission/RLS tests |
| `23 - Integration Architecture.md` | `[VERIFY]`, `[DEFER-P1]` | Keep parser/helper integration for MVP; defer providers |
| `24 - Architecture Decision Records.md` | `[DOC-FIX]`, `[DECISION-ADR]` | Split ADRs into individual records |
| `docs/adr/ADR-0020 - Rota, Job Planning, Route Estimates and Compliance-Aware Updates` | `[DECISION-ADR]`, `[DEFER-P1]` | Keep proposed until rota/job/route schema, advisory navigation limits, route-estimate provider boundary, and compliance-warning acceptance criteria are defined |
| `docs/adr/ADR-0021 - Unified Event Synchronisation, Messaging and Atlas Integration` | `[DECISION-ADR]`, `[SECURITY-GATE]`, `[DEFER-P1]` | Keep proposed until event log schema, RLS/role visibility, push/realtime delivery rules, acknowledgement semantics, and Atlas event access boundaries are specified |
| `docs/adr/ADR-0022 - Zero Trust Multi-Tenant Authorisation` | `[SECURITY-GATE]`, `[IMPLEMENT-MVP]` | Accepted governing constraint; create a concrete organisation/site/role/operation permission matrix and RLS/RPC/Edge Function test plan before expanding protected features |
| `docs/adr/ADR-0023 - Multi-Site Organisation Hierarchy` | `[DECISION-ADR]`, `[SECURITY-GATE]` | Accepted direction, but needs schema plan for organisation/site/region membership, assignment history, reporting scope, and cross-site transfer behaviour |
| `docs/adr/ADR-0024 - Role-Based Access Control` | `[SECURITY-GATE]`, `[IMPLEMENT-MVP]` | Accepted direction, but needs permission catalogue, role inheritance/default-deny rules, admin UI boundaries, and audit requirements before schema implementation |
| `docs/adr/ADR-0025 - Tenant-Aware Atlas AI` | `[SECURITY-GATE]`, `[DEFER-P1]` | Accepted Atlas constraint; do not enable Atlas retrieval/query tooling until tenant/site/role context, RLS checks, and prompt/response audit are implemented |
| `docs/adr/ADR-0026 - Reporting And Organisational Aggregation` | `[SECURITY-GATE]`, `[DEFER-P1]` | Accepted reporting direction; defer broad aggregation until site hierarchy and RBAC are implemented and permission tests prove no cross-site leakage |
| `docs/adr/ADR-0027 - Resource Assignment And Transfer Lifecycle` | `[DECISION-ADR]`, `[DEFER-P1]` | Accepted direction; implement only after assignment event model and transfer history preserve compliance, payroll, maintenance, messaging, and historical shifts |
| `docs/adr/ADR-0028 - Preventive Maintenance And Asset Compliance Rule Engine` | `[DECISION-ADR]`, `[SECURITY-GATE]`, `[DEFER-P1]` | Proposed direction; do not build until asset/rule/reading/due-state/evidence schema, stale-reading logic, site permissions, notification rules, Atlas boundaries, and reporting/export audit are specified |
| `docs/adr/ADR-0029 - Atlas Driver Assistant And Voice Operations` | `[SECURITY-GATE]`, `[DEFER-P1]` | Proposed direction; do not build until Atlas Operations API, approved knowledge base, driver context, driving-safe UX, audit logging, and permission checks are designed |
| `99 - Glossary.md` | `[SOT-OK]` | Keep authoritative; update during implementation naming decisions |

## Checklist Roll-Up

Unchecked implementation checklist items found during this pass:

| Document | Count |
| --- | ---: |
| `21 - Data Model Specification.md` | 61 |
| `22 - Security Model Specification.md` | 58 |
| `20 - Reporting Platform Specificati.md` | 44 |
| `23 - Integration Architecture.md` | 43 |
| `19 - Atlas Specification.md` | 41 |
| `18.10 - Atlas Interface.md` | 21 |
| `24 - Architecture Decision Records.md` | 12 |
| Total | 280 |

Interpretation:

- These are mostly implementation checklists, not documentation drafting tasks.
- They should not all become MVP scope.
- Promote only the items required for `Secure Upload to Timeline` into the first build backlog.

## First Backlog Slice

Create a concrete backlog with these initial items:

1. `DOC-001`: Add source-of-truth changelog and change template. Status: complete 2026-07-02.
2. `DOC-002`: Add source-of-truth index with stable document IDs. Status: complete 2026-07-02.
3. `DOC-003`: Fix MVP Markdown link escaping or document link convention. Status: complete 2026-07-02.
4. `ADR-0016`: Decide parser output relational vs JSONB boundary. Status: complete 2026-07-02.
5. `ADR-0017`: Decide timeline versioning/regeneration strategy. Status: complete 2026-07-02.
6. `ADR-0018`: Decide raw tachograph retention policy. Status: complete 2026-07-02.
7. `SEC-001`: Map existing RLS policies to the security spec. Status: complete 2026-07-02.
8. `DATA-001`: Map existing migrations to the MVP data model. Status: complete 2026-07-02.
9. `IMP-001`: Define import batch/import file schema delta. Status: complete 2026-07-02.
10. `IMP-002`: Define raw tachograph storage immutability checks. Status: complete 2026-07-02.
11. `PARSE-001`: Map existing `process-tacho` function to parser run contract. Status: complete 2026-07-02.
12. `TIME-001`: Define timeline event MVP schema and UI read model. Status: complete 2026-07-02.
13. `TEST-001`: Add cross-tenant upload/read regression tests. Status: complete 2026-07-02.
14. `TEST-002`: Add parser fixture regression tests. Status: complete 2026-07-02.
15. `HELPER-001`: Package the Windows tachograph helper as a portal-hosted download with installer, checksum, and manifest support. Status: complete 2026-07-04.
16. `CARD-UI-001`: Refactor Driver Card Analysis so the activity calendar is the primary workspace, with compact reader/target strips and bounded review panels. Status: complete 2026-07-04.
17. `HELPER-002`: Preserve the completed reader result after card removal until another card is read or manual refresh clears stale reader state. Status: complete 2026-07-04.
18. `ADR-0019`: Decide whether the Windows helper should keep a local encrypted cache/outbox and define its sync, retention, duplicate detection, and reset behaviour. Status: accepted 2026-07-04; see `docs/adr/ADR-0019-windows-helper-local-outbox-and-sync-semantics.md`.
19. `TIME-008`: Create or upload a representative vehicle-unit tachograph import and validate timeline generation/count alignment. Status: blocked/deferred 2026-07-05; waiting on a real vehicle-unit import from tachograph unit manufacturers. Do not substitute synthetic VU data for the acceptance gate.
20. `HELPER-003`: Finish and live-validate the Phase 1 helper flow: helper read/export bytes, browser authenticated upload, `process-tacho`, and analysis routing. Status: complete 2026-07-05 for the current read-only driver-card helper path; live reader/card/Supabase validation passed with aligned Driver Card Analysis timeline. See `docs/helper-003-phase1-validation-2026-07-04.md`.
21. `ADR-0020`: Rota, job planning, route estimates, and compliance-aware updates. Status: proposed 2026-07-05 in `docs/adr`; do not build until shared Portal/App schema, route-estimate boundary, and advisory-navigation acceptance criteria are defined.
22. `ADR-0021`: Unified event synchronisation, messaging, and Atlas integration. Status: proposed 2026-07-05 in `docs/adr`; do not build until central event-log schema, RLS visibility, push/realtime delivery rules, acknowledgement semantics, and Atlas access boundaries are defined.
23. `ADR-0022`: Zero Trust Multi-Tenant Authorisation. Status: accepted 2026-07-05; implementation requires a concrete permission matrix and tests for organisation, site, role, ownership, operation, exports, documents, background jobs, cache keys, and Atlas.
24. `ADR-0023`: Multi-Site Organisation Hierarchy. Status: accepted 2026-07-05; implementation requires organisation/site/region schema, membership/assignment history, reporting scope rules, and transfer behaviour before migrations.
25. `ADR-0024`: Role-Based Access Control. Status: accepted 2026-07-05; implementation requires role/permission schema, role inheritance/default deny, auditable permission changes, and permission regression tests.
26. `ADR-0025`: Tenant-Aware Atlas AI. Status: accepted 2026-07-05; implementation is deferred until Atlas can inherit caller security context, respect RLS, and audit requests/responses.
27. `ADR-0026`: Reporting and Organisational Aggregation. Status: accepted 2026-07-05; implementation is deferred until organisation/site hierarchy and RBAC are implemented and tested for aggregation leakage.
28. `ADR-0027`: Resource Assignment and Transfer Lifecycle. Status: accepted 2026-07-05; implementation requires assignment/transfer event history that preserves payroll, compliance, maintenance, messages, and historical shifts.
29. `SEC-003`: Create the Zero Trust organisation/site/RBAC implementation matrix from `ADR-0022`, `ADR-0023`, and `ADR-0024`. Status: complete 2026-07-05 as an implementation-control document; schema/RLS implementation remains pending. See `docs/zero-trust-organisation-rbac-matrix-sec-003-2026-07-05.md`.
30. `SEC-004`: Run the Zero Trust no-migration compatibility audit from the `SEC-003` Phase A checklist. Status: complete 2026-07-05 as an audit document; no schema/RLS changes made. See `docs/sec-004-zero-trust-no-migration-compatibility-audit-2026-07-05.md`.
31. `ADR-0028`: Preventive Maintenance and Asset Compliance Rule Engine. Status: proposed 2026-07-05 in `docs/adr`; do not build until the asset/rule/reading/due-state/evidence schema, stale-reading rules, site permissions, notification model, Atlas boundaries, and reporting/export audit plan are defined.
32. `SEC-005`: Design the additive permission foundation migration. Status: complete 2026-07-05 as a design gate; schema/RLS implementation remains pending. See `docs/sec-005-additive-permission-foundation-design-2026-07-05.md`.
33. `SEC-006`: Refresh catalog evidence and produce the additive permission foundation candidate migration/test plan. Status: complete 2026-07-05 as a planning gate; fresh linked dump blocked by missing Docker, so SEC-007 requires fresh dashboard/SQL export before writing final SQL. See `docs/sec-006-permission-foundation-catalog-refresh-candidate-plan-2026-07-05.md`.
34. `SEC-007`: Implement the additive permission foundation migration and static tests. Status: complete/deployed/verified 2026-07-05; migration/test files are present, `npm run test:rules` passes, and SEC-009 Dashboard verification passed. See `docs/sec-007-additive-permission-foundation-implementation-2026-07-05.md`.
35. `SEC-008`: Capture the fresh linked Supabase dump/evidence after Docker installation. Status: partial 2026-07-05; PostgreSQL 17 native `pg_dump` captured fresh public/storage schema and policy evidence without Docker, Supabase Dashboard SQL captured storage buckets, and expected role backfill counts are 17 `driver` assignments plus 1 `fleet_administrator` assignment. Company-role/null/inactive profile distribution remains uncaptured. See `docs/sec-008-supabase-dump-gate-2026-07-05.md`.
36. `SEC-009`: Deploy and verify additive permission foundation. Status: complete 2026-07-05; Dashboard verification confirmed expected seed counts, grant counts, backfill counts, denied defaults, no unmatched legacy profiles, organisation-only assignment scope, and compatibility view counts. First shadow enforcement candidate selected: `patch_tachograph_import_metadata`. See `docs/sec-009-additive-permission-foundation-deploy-verify-2026-07-05.md`.
37. `ADR-0029`: Atlas Driver Assistant and Voice Operations. Status: proposed 2026-07-09 in `docs/adr`; do not build until Atlas Operations API, approved knowledge base, driver context engine, driving-safe mode, audit logging, and action-template boundaries are specified.

## Definition Of Complete

The source-of-truth collection can be marked complete for implementation governance when:

- Changelog exists and is referenced by README.
- ADRs are separated or formally indexed with stable IDs.
- Open data model questions that affect MVP are resolved through ADRs.
- MVP scope is converted into backlog tasks with capability IDs.
- Existing code/schema is reconciled against the new documents.
- Markdown links and filenames are safe for automation.
- Security model is represented by tests, not only narrative.
- First milestone has explicit acceptance criteria and rollback strategy. Status: complete 2026-07-02; see `docs/secure-upload-to-timeline-acceptance-rollback-2026-07-02.md`.

## Recommended Next Action

Phase 0 and Phase 1 are substantially complete for the current MVP thread. The plan already covered the tachograph import/parser/timeline work at architecture level through `18.3` to `18.6`, `23`, and `TIME-001` to `TIME-008`. The recent helper packaging, portal download, reader workspace layout, and post-card-removal persistence work were not explicitly tracked in this plan, so they are now recorded below.

`TIME-008` is now blocked/deferred because no real vehicle-unit import is available. Keep the gate open while waiting for tachograph unit manufacturer responses; do not use synthetic VU data to claim the vehicle-unit timeline acceptance gate.

`SEC-010` is deployed and verified. A normal manager metadata patch produced `shadow_permission_mismatch_count = 0`, so the legacy manager/company decision and `actor_has_permission('tachograph.import.update', target_company_id, null)` agreed for the first shadow check. Do not swap enforcement yet; observe additional normal usage before replacing the legacy guard.

Rationale:

- ADR-0022 to ADR-0028 widen the platform model from simple company membership to organisation, site, role, ownership, operation, Atlas, report, transfer, and asset-compliance scopes.
- These accepted ADRs affect almost every future migration, RPC, Edge Function, report, export, cache key, and Atlas retrieval path.
- A schema or UI build before the permission matrix risks baking in tenant or site leakage.
- `TIME-008` cannot progress honestly without a real VU file.
- A local outbox may improve perceived speed and resilience because completed reads can remain available locally while upload/sync happens separately.
- It will not materially reduce the physical card APDU read time; that is still dominated by card detection, smart-card I/O, EF reads, decoding, upload, and parser/runtime work.
- It introduces local storage of tachograph personal data, so it needs a security and retention decision before implementation.
- It affects duplicate detection, manual refresh semantics, support diagnostics, and whether the portal or helper is the short-term source of truth for a completed read.

Recommended sequence:

1. Run `SEC-012`: Use `docs/sec-012-rbac-security-health-check.sql` as the repeatable Dashboard health check before further shadow/enforcement work.
2. Observe `SEC-010`: Keep the shadow comparison in place through additional normal `patch_tachograph_import_metadata` usage. Do not consider an enforcement swap unless SEC-012 shadow mismatch counts stay at `0`.
3. `HELPER-004`: Implement the `ADR-0019` Phase 2 encrypted retry cache only after Phase 1 remains stable and the ADR acceptance criteria are met.
4. `TIME-008`: Resume only when a real vehicle-unit tachograph import is available, then rerun timeline inspection/validation until driver-card and VU imports both have current count-aligned timeline generations.
5. Certified helper export planning: select the standards-certified `.C1B/.DDD` encoding strategy separately from the read-only capture path.

If reader reliability becomes more urgent than platform security modelling, swap steps 1 and 2, but do not build Tachomaster-style bulk sync before the constrained retry cache is proven.

New ADR impact:

- `ADR-0020` and `ADR-0021` add a future shared Portal/App operating model for rota, job planning, route estimates, messaging, event synchronisation, and event-aware Atlas recommendations.
- They should not displace the current tachograph/helper completion gate.
- They should be treated as proposed P1 architecture until the current compliance evidence foundation is stable.
- Before implementation, create a dedicated schema/security plan for `fleet_events`, `message_threads`, `messages`, `rota_assignments`, `job_assignments`, `route_plans`, `route_plan_legs`, `atlas_recommendations`, `driver_acknowledgements`, and `push_notification_log`.
- Route estimates must remain advisory; HourWise must not present itself as live HGV navigation unless a dedicated approved navigation partner is integrated later.
- `ADR-0022` is accepted and becomes a governing security constraint now: authentication alone is never enough, and every request needs organisation, site, role, ownership, and operation checks.
- `ADR-0023` is accepted and changes the target tenant model to platform -> organisation -> site, with drivers and vehicles owned by the organisation and assigned to sites.
- `ADR-0024` is accepted and requires role-based permissions, least privilege, default deny, role inheritance, and auditable permission changes.
- `ADR-0025` is accepted and blocks tenant-unsafe Atlas work: Atlas must run in the caller security context and must not bypass RLS.
- `ADR-0026` is accepted and requires report aggregation to respect the same permission model as interactive reports.
- `ADR-0027` is accepted and requires driver/vehicle assignment transfers to preserve operational and compliance history through auditable events.
- `ADR-0028` is proposed and adds a future preventive maintenance and asset compliance rule engine covering date, mileage, engine-hour, whichever-comes-first, stale-reading, evidence, notification, Atlas, and multi-site behaviours.
- `ADR-0028` should not displace `SEC-005`; it depends on the same organisation/site/RBAC foundation, plus a dedicated asset/rule/reading/evidence schema plan.
- `ADR-0029` is proposed and adds a future Driver App Atlas assistant with typed/voice requests, site procedure lookup, driving-safe responses, driver context, and approved action suggestions. Build is deferred until the Atlas Operations API, approved knowledge base, permissions, audit logging, and driver safety model are designed.
- `docs/atlas-operations-platform-architecture-2026-07-09.md` clarifies that Atlas should be built as an Operations API and explanation layer over deterministic HourWise systems before any multi-agent orchestration.
- `docs/generic-work-management-vs-purpose-built-fleet-compliance-2026-07-09.md` records monday.com and generic-board products as UX benchmarks, not product models.
- `docs/enterprise-architecture-specification-expansion-plan-2026-07-09.md` proposes expanding the enterprise ADR set into a larger implementation reference before broad multi-site feature work.

Current implementation gate:

- `DATA-002`: Live schema and policy verification is complete with implementation blockers found as of 2026-07-02. Manual Supabase Dashboard export confirmed the live `tachograph-files` bucket and tachograph schema, but also found an unsafe raw storage delete policy and an overly broad `tachograph_files` `ALL` policy. See `docs/live-schema-policy-verification-data-002-2026-07-02.md`.
- `SEC-002`: Storage/RLS hardening migration for `tachograph-files` and related raw import metadata is complete as of 2026-07-03. See `docs/storage-rls-hardening-sec-002-2026-07-03.md`.
- `DATA-003`: Driver-card purge/reset flows now use retention-state/archive-only behaviour as of 2026-07-03. See `docs/driver-card-retention-archive-data-003-2026-07-03.md`.
- `PARSE-002`: Parser run lifecycle schema and `process-tacho` lifecycle writes are complete as of 2026-07-03. Reprocessing now creates distinct versioned parser runs, marks current/superseded state, and preserves parser-run history. See `docs/parser-run-lifecycle-parse-002-2026-07-03.md`.
- `TIME-002`: Timeline generation/event/source/gap schema is complete as of 2026-07-03. See `docs/timeline-generation-schema-time-002-2026-07-03.md`.
- `TIME-003`: Import-scoped timeline generation from parser-derived tachograph rows and read-only timeline bundle RPCs are complete as of 2026-07-03. See `docs/timeline-generation-runtime-time-003-2026-07-03.md`.
- `TIME-004`: Timeline bundle reads are wired into the app/API adapter layer behind existing tachograph views as of 2026-07-03. See `docs/timeline-bundle-api-adapter-time-004-2026-07-03.md`.
- `TIME-005`: Timeline comparison status is surfaced in Import Centre, Driver Card Analysis, and Vehicle Unit Analysis as of 2026-07-04. Managers can see timeline generation presence and count alignment before any view is replaced with timeline-native rendering. See `docs/timeline-comparison-status-time-005-2026-07-04.md`.
- `TIME-006`: Live aggregate timeline validation is complete as of 2026-07-04. The live sample had 5 processed/partial driver-card imports, 0 vehicle-unit imports, 0 current import-scoped timeline generations, and 0 count-aligned imports, so no timeline-native rendering candidate was selected. See `docs/timeline-live-validation-time-006-2026-07-04.md`.
- `TIME-007`: Representative timeline import run is partially complete as of 2026-07-04. The latest eligible driver-card import now has a current import-scoped timeline generation with 5,268 events, 116 gaps, 118 daily summaries, and count-aligned validation. The live project still has 0 eligible vehicle-unit imports, so no timeline-native rendering candidate was selected. See `docs/timeline-representative-imports-time-007-2026-07-04.md`.
- `HELPER-001`: Windows tachograph helper packaging is complete as of 2026-07-04. The repo now has a packaging script, portal-hosted ZIP/checksum/manifest output, installer support for bundled helper app payloads, README/checklist updates, and a portal helper download card. The current generated package is unsigned unless a production certificate thumbprint is supplied during packaging.
- `CARD-UI-001`: Driver Card Analysis has been refactored around a calendar-first workspace as of 2026-07-04. The driver target and reader controls are compact strips, the activity-by-day calendar keeps prime screen space, selected-day/cross-check details are bounded in the review rail, and provisional/candidate/comparison panels are moved below the main review area.
- `HELPER-002`: Reader result persistence after card removal is complete as of 2026-07-04. Completed read data remains visible after the card is removed and is replaced by the next successful read; manual Refresh now explicitly clears stale reader state when appropriate.
- `TIME-008`: Blocked/deferred as of 2026-07-05 because no real representative vehicle-unit tachograph import is available yet. Await manufacturer responses; resume only with a real VU file that can be uploaded to raw storage, processed through the deployed runtime, and validated with `npm run tacho:inspect-time-007` and `npm run tacho:validate-timeline`.
- `ADR-0019`: Windows Helper Local Outbox And Sync Semantics is accepted as of 2026-07-04. It permits a constrained encrypted local outbox only as a short-lived delivery/retry queue, keeps Supabase/backend imports as the source of truth, forbids helper service-role keys and local compliance database behaviour, and blocks Tachomaster-style bulk sync until Phase 1 and Phase 2 acceptance criteria are met. See `docs/adr/ADR-0019-windows-helper-local-outbox-and-sync-semantics.md`.
- `HELPER-003`: Phase 1 helper validation is complete for the current read-only driver-card helper path as of 2026-07-05. Automated command-seam validation passes, and live reader/card/Supabase validation produced baseline import `b9c8c986-445b-4411-82fc-c96b8ecf6178`, linked it to `PHILIP CHRISTOPHER GERAN`, decoded card `DB18220162003911`, completed `process-tacho`, opened Driver Card Analysis, and aligned the visible review day at tachograph `58` / timeline `58`. Certified `.C1B/.DDD` output and any encrypted retry outbox remain outside HELPER-003. See `docs/helper-003-phase1-validation-2026-07-04.md`.
- `ADR-0020`: New proposed source-of-truth ADR added as of 2026-07-05. It defines rota/job planning, route estimates, route/job delay handling, and compliance-aware route warnings as a shared backend feature consumed by both Portal and Driver App. Build is deferred until schema, provider boundary, advisory-navigation copy, and compliance-warning criteria are specified.
- `ADR-0021`: New proposed source-of-truth ADR added as of 2026-07-05. It defines a unified operational event system for messaging, rota/job/route updates, acknowledgements, push/realtime delivery, and Atlas recommendations. Build is deferred until event-log schema, RLS visibility, notification rules, deduplication/order semantics, and Atlas event-access boundaries are specified.
- `ADR-0022`: Zero Trust Multi-Tenant Authorisation is accepted as of 2026-07-05. It requires organisation, site, role, ownership, and operation-level authorisation for requests, exports, reports, documents, background jobs, cache keys, and Atlas. Next gate: `SEC-003` permission matrix and test plan before new protected feature work.
- `ADR-0023`: Multi-Site Organisation Hierarchy is accepted as of 2026-07-05. It sets platform -> organisation -> site as the target tenant hierarchy and requires drivers/vehicles to remain organisation-owned with site assignments.
- `ADR-0024`: Role-Based Access Control is accepted as of 2026-07-05. It requires role-based permissions, least privilege, default deny, role inheritance, and auditable permission changes.
- `ADR-0025`: Tenant-Aware Atlas AI is accepted as of 2026-07-05. Atlas must inherit the caller's security context, respect organisation/site/role filters, never bypass RLS, and audit requests/responses.
- `ADR-0026`: Reporting and Organisational Aggregation is accepted as of 2026-07-05. Report and export aggregation must work at driver, vehicle, site, region, and organisation levels without exceeding caller permissions.
- `ADR-0027`: Resource Assignment and Transfer Lifecycle is accepted as of 2026-07-05. Driver and vehicle transfers must preserve payroll, compliance, maintenance, messages, historical shifts, and audit history through events.
- `ADR-0028`: Preventive Maintenance and Asset Compliance Rule Engine is proposed as of 2026-07-05. It defines future rule-driven maintenance/compliance obligations for vehicles, trailers, plant, equipment, documents, licences, tachograph calibration, MOT, insurance, driver licence/CPC/medical renewals, service inspections, PMIs, and defect follow-up. Build is deferred until the rule engine schema, reading freshness model, evidence requirements, site permissions, notification behaviour, Atlas boundaries, and export/report audit model are specified.
- `SEC-003`: Complete as of 2026-07-05. The Zero Trust organisation/site/RBAC implementation matrix defines the compatibility position for `companies`/`company_id`, target role/permission model, operation matrix, RLS/RPC/Edge Function rules, export/report/cache/Atlas rules, mandatory tests, and implementation phases. See `docs/zero-trust-organisation-rbac-matrix-sec-003-2026-07-05.md`.
- `SEC-004`: Complete as of 2026-07-05. The no-migration compatibility audit confirms the current enforceable baseline is `company_id` plus legacy `manager`/`driver` role checks, with no site model, no permission catalogue, no central permission resolver, no export audit operation, no tenant-aware Atlas retrieval, and no support access session model. See `docs/sec-004-zero-trust-no-migration-compatibility-audit-2026-07-05.md`.
- `SEC-005`: Complete as of 2026-07-05 as a design gate. It defines the additive permission foundation tables, compatibility rules, seed permission set, legacy `manager`/`driver` backfill plan, helper function contracts, security audit event model, RLS strategy, RPC/feature mapping, rollout phases, and tests. See `docs/sec-005-additive-permission-foundation-design-2026-07-05.md`.
- `SEC-006`: Complete as of 2026-07-05 as a planning gate. A fresh linked Supabase dump was attempted and failed because Docker Desktop/daemon is unavailable. The plan uses existing 2026-07-02 dashboard-export artefacts plus current migrations to define candidate migration `20260705170000_add_security_permission_foundation.sql`, required live catalog queries, seed/backfill expectations, static tests, database tests, rollout, and rollback. See `docs/sec-006-permission-foundation-catalog-refresh-candidate-plan-2026-07-05.md`.
- `SEC-007`: Complete, deployed, and verified as of 2026-07-05. The repo contains additive migration `supabase/migrations/20260705170000_add_security_permission_foundation.sql`, static test `src/lib/security/sec007PermissionFoundation.test.ts`, and `npm run test:rules` coverage. The migration adds the security role/permission/assignment/audit foundation, seeds roles and permissions, backfills active legacy `manager`/`driver` profiles, and keeps site enforcement/export defaults/Atlas/support/RLS replacement out of scope. SEC-009 Dashboard verification passed. See `docs/sec-007-additive-permission-foundation-implementation-2026-07-05.md`.
- `SEC-008`: Partial as of 2026-07-05. Docker Desktop still cannot start its Linux engine, but PostgreSQL 17 native client tooling captured a fresh non-empty public/storage schema and policy dump at `supabase/.temp/sec-008-live-schema-policy-dump-2026-07-05.sql`. Catalog evidence shows 63/63 captured live public/storage tables with RLS enabled, `public.profiles` forced RLS, 133 policies, and no `security_*` permission foundation tables present. Supabase Dashboard SQL captured storage buckets in `docs/sql results.txt`. Expected role backfill counts are 17 `driver` assignments plus 1 `fleet_administrator` assignment; the dataset is test-seeded, with one real fleet administrator, one driver row also representing the project owner/operator, and remaining drivers fake SQL-injected profiles. Company-role/null/inactive profile distribution remains uncaptured. See `docs/sec-008-supabase-dump-gate-2026-07-05.md`.
- `SEC-009`: Complete as of 2026-07-05. Dashboard verification confirmed `security_roles = 10`, `security_permissions = 32`, role grants `driver = 6` and `fleet_administrator = 22`, no unexpected fleet-administrator grants for export/role-admin/support/Atlas, active assignments `driver = 17` and `fleet_administrator = 1`, no unmatched active legacy profiles, no orphaned legacy backfill assignments, organisation-only assignment scope with 18 active assignments, and compatibility view counts matching 17 active drivers plus 1 active manager. First shadow enforcement candidate selected: `patch_tachograph_import_metadata`. See `docs/sec-009-additive-permission-foundation-deploy-verify-2026-07-05.md`.
- `SEC-010`: Deployed and verified as of 2026-07-08. Migration `supabase/migrations/20260708120000_shadow_permission_patch_tachograph_import_metadata.sql` adds shadow comparison for `patch_tachograph_import_metadata` between the legacy manager/company decision and `actor_has_permission('tachograph.import.update', target_company_id, null)`, audits mismatches, catches audit failures as warnings, and does not change runtime enforcement. Live verification returned `shadow_permission_mismatch_count = 0` after a normal manager metadata patch. See `docs/sec-010-shadow-permission-patch-tachograph-import-metadata-2026-07-08.md`.
- `MIG-001`: Repaired as of 2026-07-08. Missing remote migration `20260703130000_add_push_token_and_account_deletion_requests.sql` was recovered locally, accidental fetch overwrites were restored, live markers verified that `20260705103000`, `20260705170000`, and `20260708120000` were already deployed, and Supabase migration history was repaired for those versions. `supabase migration list --linked` now aligns local and remote versions through `20260708120000`; `db push --dry-run` is blocked by a separate CLI login-role authentication issue, not migration drift. See `docs/mig-001-migration-history-drift-2026-07-08.md`.
- `SEC-012`: Implemented locally as of 2026-07-08. The repo now has a repeatable read-only RBAC/security health-check SQL pack covering catalogue counts, grant counts, denied defaults, assignment gaps, orphaned assignments, organisation-only scope, compatibility view counts, export permission metadata, SEC-010 mismatch counts, deployed function markers, and MIG-001 migration-history notes. See `docs/sec-012-rbac-security-health-check-2026-07-08.md`.
- `PLAN-2026-07-09`: New planning documents created from supplied GPT planning notes. Added `ADR-0029` for Atlas Driver Assistant and Voice Operations, an Atlas Operations Platform Architecture note, a generic work-management versus purpose-built fleet compliance strategy note, and an Enterprise Architecture Specification expansion plan. These are planning/source-of-truth documents only; no runtime implementation changed.
- `IMPL-001`: Concrete implementation sequencing is now defined as of 2026-07-09. See `docs/hourwise-concrete-implementation-plan-2026-07-09.md`. Recommended first runtime feature slice is `ROTA-001`: add a driver read-only upcoming rota from the existing `shifts` table, then layer publish/audit semantics, event-backed messaging, driver operational home, route/job planning, asset compliance rules, and deterministic Atlas operations briefing.
- `ROTA-001`: Implemented locally as of 2026-07-09. Driver Dashboard now has a read-only upcoming rota panel backed by the existing `shifts` table and existing driver-owned RLS SELECT policy. No migration or manager editing behaviour changed. See `docs/rota-001-driver-read-only-rota-2026-07-09.md`.
- `ROTA-002`: Implemented locally as of 2026-07-09; migration pending deployment. Added additive shift publish/status/audit migration, manager draft/publish/cancel UI, and driver filtering to published/updated own shifts. See `docs/rota-002-publish-status-audit-2026-07-09.md`.
- `EVENT-001-DESIGN`: Implemented locally as of 2026-07-09; migration pending deployment. Added additive event/thread/ack schema foundation with compatibility links to `messages`, company-scoped manager policies, driver assigned/broadcast visibility, and a security-invoker driver event view. No runtime UI/push/realtime behaviour changed. See `docs/event-001-operational-event-spine-design-2026-07-09.md`.
