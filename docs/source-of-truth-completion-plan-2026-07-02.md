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

Source set contains 41 Markdown files:

- `00 - README.md`
- `01` to `09`: strategy, philosophy, problems, personas, ecosystem, principles, competitive position, non-goals, pillars
- `10` to `14`: MVP, capability model, capability detail, journeys, service blueprints
- `15` to `17`: architecture, Driver App, Fleet Portal
- `18` to `18.11`: Compliance Intelligence platform and engine suite
- `19` to `24`: Atlas, reporting, data model, security, integration architecture, ADRs
- `ADR-0020`: rota, job planning, route estimates, and compliance-aware updates
- `ADR-0021`: unified event synchronisation, messaging, and Atlas integration
- `99`: glossary

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
| `ADR-0020 - Rota, Job Planning, Route Estimates and Compliance-Aware Updates` | `[DECISION-ADR]`, `[DEFER-P1]` | Keep proposed until rota/job/route schema, advisory navigation limits, route-estimate provider boundary, and compliance-warning acceptance criteria are defined |
| `ADR-0021 - Unified Event Synchronisation, Messaging and Atlas Integration` | `[DECISION-ADR]`, `[SECURITY-GATE]`, `[DEFER-P1]` | Keep proposed until event log schema, RLS/role visibility, push/realtime delivery rules, acknowledgement semantics, and Atlas event access boundaries are specified |
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
19. `TIME-008`: Create or upload a representative vehicle-unit tachograph import and validate timeline generation/count alignment. Status: pending.
20. `HELPER-003`: Finish and live-validate the Phase 1 helper flow: helper read/export bytes, browser authenticated upload, `process-tacho`, and analysis routing. Status: partially complete 2026-07-04; automated real-helper command-seam validation passes, live reader/card/Supabase validation remains pending. See `docs/helper-003-phase1-validation-2026-07-04.md`.
21. `ADR-0020`: Rota, job planning, route estimates, and compliance-aware updates. Status: proposed 2026-07-05; do not build until shared Portal/App schema, route-estimate boundary, and advisory-navigation acceptance criteria are defined.
22. `ADR-0021`: Unified event synchronisation, messaging, and Atlas integration. Status: proposed 2026-07-05; do not build until central event-log schema, RLS visibility, push/realtime delivery rules, acknowledgement semantics, and Atlas access boundaries are defined.

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

The recommended next task is `HELPER-003`: finish and live-validate the Phase 1 helper flow before building the encrypted retry outbox.

Rationale:

- A local outbox may improve perceived speed and resilience because completed reads can remain available locally while upload/sync happens separately.
- It will not materially reduce the physical card APDU read time; that is still dominated by card detection, smart-card I/O, EF reads, decoding, upload, and parser/runtime work.
- It introduces local storage of tachograph personal data, so it needs a security and retention decision before implementation.
- It affects duplicate detection, manual refresh semantics, support diagnostics, and whether the portal or helper is the short-term source of truth for a completed read.

Recommended sequence:

1. `HELPER-003`: Prove the current simple helper path with real hardware: helper read/export bytes, browser authenticated upload, `process-tacho`, and analysis routing.
2. `HELPER-004`: Implement the `ADR-0019` Phase 2 encrypted retry cache only after Phase 1 is stable and the ADR acceptance criteria are met.
3. `TIME-008`: Create or upload a representative vehicle-unit tachograph import, then rerun timeline inspection/validation until driver-card and VU imports both have current count-aligned timeline generations.

If compliance source coverage is more urgent than reader UX, swap steps 1 and 3: run `TIME-008` first, then return to Phase 1 helper validation.

New operational-planning ADR impact:

- `ADR-0020` and `ADR-0021` add a future shared Portal/App operating model for rota, job planning, route estimates, messaging, event synchronisation, and event-aware Atlas recommendations.
- They should not displace the current tachograph/helper completion gate.
- They should be treated as proposed P1 architecture until the current compliance evidence foundation is stable.
- Before implementation, create a dedicated schema/security plan for `fleet_events`, `message_threads`, `messages`, `rota_assignments`, `job_assignments`, `route_plans`, `route_plan_legs`, `atlas_recommendations`, `driver_acknowledgements`, and `push_notification_log`.
- Route estimates must remain advisory; HourWise must not present itself as live HGV navigation unless a dedicated approved navigation partner is integrated later.

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
- `TIME-008`: Next task is to create or upload a representative vehicle-unit tachograph import with raw storage, process it through the deployed runtime, then rerun `npm run tacho:inspect-time-007` and `npm run tacho:validate-timeline` until both source types have current timeline generations and count-aligned comparison status.
- `ADR-0019`: Windows Helper Local Outbox And Sync Semantics is accepted as of 2026-07-04. It permits a constrained encrypted local outbox only as a short-lived delivery/retry queue, keeps Supabase/backend imports as the source of truth, forbids helper service-role keys and local compliance database behaviour, and blocks Tachomaster-style bulk sync until Phase 1 and Phase 2 acceptance criteria are met. See `docs/adr/ADR-0019-windows-helper-local-outbox-and-sync-semantics.md`.
- `HELPER-003`: Automated Phase 1 command-seam validation is complete as of 2026-07-04. `npm run tacho:helper:phase1` builds the real .NET helper into a temporary folder, starts it on port `47236`, uses simulated card presence and the external-export seam, runs the read-mode contract probe, downloads export bytes, acknowledges registration, and reaches `complete`. Live reader/card/Supabase validation remains the next helper gate before any sync queue work. See `docs/helper-003-phase1-validation-2026-07-04.md`.
- `ADR-0020`: New proposed source-of-truth ADR added as of 2026-07-05. It defines rota/job planning, route estimates, route/job delay handling, and compliance-aware route warnings as a shared backend feature consumed by both Portal and Driver App. Build is deferred until schema, provider boundary, advisory-navigation copy, and compliance-warning criteria are specified.
- `ADR-0021`: New proposed source-of-truth ADR added as of 2026-07-05. It defines a unified operational event system for messaging, rota/job/route updates, acknowledgements, push/realtime delivery, and Atlas recommendations. Build is deferred until event-log schema, RLS visibility, notification rules, deduplication/order semantics, and Atlas event-access boundaries are specified.
