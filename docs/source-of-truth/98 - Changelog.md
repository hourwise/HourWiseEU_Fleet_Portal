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

## 2026-07-09 - Add EVENT-001 Operational Event Spine Foundation

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-09-005 |
| Status | Implemented Locally / Migration Pending Deployment |
| Owner | Product Architecture / Engineering |
| Summary | Added the additive event/thread/acknowledgement database foundation for the operational event spine. |
| Reason | Rota publishing and messaging need a shared event model before driver notifications, acknowledgements, route/job updates, and Atlas event consumption are implemented. |
| Affected Source Documents | `docs/event-001-operational-event-spine-design-2026-07-09.md`, `docs/hourwise-concrete-implementation-plan-2026-07-09.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0021`, `ADR-0022`, `ADR-0024`, `ADR-0025` |
| Capability IDs | Events, Messaging, Rota, Driver App, Atlas |
| Implementation Impact | High |
| Database Impact | Additive migration `20260709110000_add_event_spine_foundation.sql` pending deployment. |
| Security Impact | Adds company-scoped manager policies, driver assigned/broadcast visibility, acknowledgement constraints, and a security-invoker driver event view. |
| Testing Impact | Added static migration test and included it in `test:rules`. |
| Rollback Notes | Revert before deployment if superseded; after deployment, use a controlled rollback/superseding migration because tables may be referenced by future events. |

### Details

Added `message_threads`, `fleet_events`, `driver_acknowledgements`, nullable compatibility links on `messages`, indexes, RLS policies, and `driver_visible_fleet_events`.

No existing messaging UI, rota publish runtime, push notification, realtime, or Atlas behaviour was switched in this slice.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-09 - Implement ROTA-002 Publishable Rota Status

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-09-004 |
| Status | Implemented Locally / Migration Pending Deployment |
| Owner | Product Architecture / Engineering |
| Summary | Added publish/status/audit semantics to manager shifts and tightened driver rota visibility to published/updated shifts. |
| Reason | ROTA-001 made rota visible to drivers; ROTA-002 adds the minimum lifecycle control needed before event-backed rota notifications. |
| Affected Source Documents | `docs/rota-002-publish-status-audit-2026-07-09.md`, `docs/hourwise-concrete-implementation-plan-2026-07-09.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0020`, `ADR-0021`, `ADR-0022`, `ADR-0024` |
| Capability IDs | Rota, Driver App, Security Audit |
| Implementation Impact | High |
| Database Impact | Additive migration `20260709100000_add_shift_publish_status_audit.sql` pending deployment. |
| Security Impact | Tightens driver shift visibility and adds trigger-backed shift audit events; central RBAC enforcement remains unchanged. |
| Testing Impact | Added static migration test and updated rota helper tests. |
| Rollback Notes | Revert the migration and UI/helper changes only before deployment; after deployment, use a controlled migration rollback/superseding migration. |

### Details

Existing shifts are backfilled as `published`. New manager-created shifts are drafts until published. Published/updated shifts are visible to drivers; draft/cancelled shifts are hidden by query filter and RLS policy. Manager edits to published shifts mark them as `updated`, and managers can republish or cancel from the weekly roster grid.

Shift lifecycle changes are captured in `shift_audit_events` through a trigger on `shifts`.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-09 - Implement ROTA-001 Driver Read-Only Rota

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-09-003 |
| Status | Implemented Locally |
| Owner | Product Architecture / Engineering |
| Summary | Added a driver-facing read-only upcoming rota panel using the existing `shifts` table. |
| Reason | The concrete implementation plan identified driver rota visibility as the smallest useful first runtime slice for the new operational spine. |
| Affected Source Documents | `docs/rota-001-driver-read-only-rota-2026-07-09.md`, `docs/hourwise-concrete-implementation-plan-2026-07-09.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0020`, `ADR-0021` |
| Capability IDs | Rota, Driver App |
| Implementation Impact | Medium |
| Database Impact | None; existing `shifts` table and RLS policy are used. |
| Security Impact | Uses existing driver-owned `shifts` SELECT policy; no enforcement change. |
| Testing Impact | Added rota helper test and included it in `test:rules`. |
| Rollback Notes | Remove the driver rota panel/helper/test and revert the `test:rules` script addition if this slice is superseded. |

### Details

The Driver Dashboard now shows today's shift count and a read-only "Upcoming Rota" panel for today through the next 7 days. The panel shows shift date, start/end time, assigned vehicle registration, vehicle description when available, notes, and loading/empty/error states.

Manager `ShiftPlanner` behaviour is unchanged. ROTA-002 should add publish/status/audit semantics before event-backed rota notifications are implemented.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-09 - Add Concrete Implementation Plan

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-09-002 |
| Status | Implemented |
| Owner | Product Architecture |
| Summary | Added a concrete phased implementation plan that maps the current React/Supabase build to the new rota, event, route, asset compliance, and Atlas feature plans. |
| Reason | New feature planning needed to be converted into an implementation sequence that fits the existing dashboard, shift planner, messaging, vehicle, driver, and security/RBAC work. |
| Affected Source Documents | `docs/hourwise-concrete-implementation-plan-2026-07-09.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0020`, `ADR-0021`, `ADR-0028`, `ADR-0029` |
| Capability IDs | Rota, Messaging, Events, Driver App, Fleet Operations, Asset Compliance, Atlas |
| Implementation Impact | High |
| Database Impact | Planned additive migrations for later phases; no runtime schema change in this documentation update. |
| Security Impact | High; each feature phase is gated by RLS, RBAC, audit, and health-check requirements. |
| Testing Impact | Future feature slices require tests or static query-contract checks; no test change in this documentation update. |
| Rollback Notes | Remove the plan only if replaced by a newer implementation sequencing document and changelog entry. |

### Details

Created a phased implementation plan that starts with the current `shifts` and driver dashboard surfaces, then moves through publishable rota changes, event-backed messaging, driver operational home, route/job planning, asset compliance rules, deterministic Atlas operations briefing, and later driver Atlas/voice support.

The recommended first runtime task is `ROTA-001`: add a driver read-only upcoming rota from the existing `shifts` table.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-09 - Add Atlas And Fleet Platform Planning Documents

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-09-001 |
| Status | Proposed / Documented |
| Owner | Product Architecture / Platform Architecture |
| Summary | Added structured planning documents for Atlas as an operations platform, Atlas in the Driver App, generic work-management positioning, and enterprise architecture expansion. |
| Reason | GPT planning notes identified durable architecture and product decisions that should be captured before implementation work starts. |
| Affected Source Documents | `docs/adr/ADR-0029_Atlas_Driver_Assistant_And_Voice_Operations.md`, `docs/atlas-operations-platform-architecture-2026-07-09.md`, `docs/generic-work-management-vs-purpose-built-fleet-compliance-2026-07-09.md`, `docs/enterprise-architecture-specification-expansion-plan-2026-07-09.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0021`, `ADR-0025`, `ADR-0028`, `ADR-0029` |
| Capability IDs | Atlas, Driver App, fleet maintenance, enterprise architecture |
| Implementation Impact | Medium |
| Database Impact | None Yet / Future Migration Required |
| Security Impact | Security Gate Required |
| Testing Impact | Future Test Coverage Required |
| Rollback Notes | Remove or supersede these planning documents if Atlas, Driver App, or enterprise architecture direction changes before implementation. |

### Details

Added `ADR-0029` to define Atlas Driver Assistant and Voice Operations. It keeps Driver App Atlas behind backend permissions, audit logging, approved knowledge sources, driver context, driving-safe mode, and approved action templates.

Added the Atlas Operations Platform Architecture note to separate the Atlas Operations API, Operations Assistant, and future AI harness/multi-agent orchestration layers.

Added the generic work-management strategy note to clarify that monday.com-style products are UX benchmarks, not the HourWise product model. HourWise should provide native fleet compliance logic rather than asking users to build formulas and automations.

Added the Enterprise Architecture Specification expansion plan to promote ADR-0022 through ADR-0029 into a future larger implementation reference.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-08 - Add SEC-012 RBAC Security Health Check Pack

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-08-003 |
| Status | Implemented Locally |
| Owner | Security / Platform Architecture / Engineering |
| Summary | Added a repeatable read-only Dashboard SQL pack for RBAC/security health checks across SEC-007, SEC-010, and MIG-001. |
| Reason | Permission-foundation and shadow-enforcement work needs a single repeatable safety dashboard before further enforcement changes. |
| Affected Source Documents | `docs/sec-012-rbac-security-health-check-2026-07-08.md`, `docs/sec-012-rbac-security-health-check.sql`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0022`, `ADR-0024` |
| Capability IDs | Security, RBAC, migration safety |
| Implementation Impact | Low |
| Database Impact | None / Read-Only SQL |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Remove or supersede the SQL pack if the permission catalogue or expected live dataset changes. |

### Details

Added `docs/sec-012-rbac-security-health-check.sql` and static test coverage in `src/lib/security/sec012SecurityHealthCheck.test.ts`.

The SQL pack checks catalogue counts, role grants, denied-default fleet administrator grants, assignment/profile consistency, organisation-only scope, compatibility view counts, export permission metadata, SEC-010 shadow mismatch counts, deployed function markers, and MIG-001 migration-history notes.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-08 - Add MIG-001 Migration Drift Repair Plan

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-08-002 |
| Status | Repaired |
| Owner | Platform Architecture / Engineering |
| Summary | Recovered the missing remote migration file and documented a safe repair plan for Supabase migration-history drift. |
| Reason | `supabase db push` is unsafe while remote history and local migration files disagree, especially after SEC-007 and SEC-010 were applied manually outside migration history. |
| Affected Source Documents | `docs/mig-001-migration-history-drift-2026-07-08.md`, `docs/mig-001-live-migration-drift-verification.sql`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | None |
| Capability IDs | Database migrations, deployment safety |
| Implementation Impact | Medium |
| Database Impact | Migration History Repair Required |
| Security Impact | Review Required |
| Testing Impact | Verification SQL Required |
| Rollback Notes | Remove the recovered migration only if a different canonical source for `20260703130000` is chosen; do not alter remote migration history without marker verification. |

### Details

Recovered `supabase/migrations/20260703130000_add_push_token_and_account_deletion_requests.sql` from linked remote migration history.

Restored tracked migration files that `supabase migration fetch --linked` overwrote, keeping only the newly recovered migration file as the intended migration-directory addition.

Documented remaining local-only versions: `20260705103000`, `20260705170000`, and `20260708120000`. Live marker verification confirmed all three were already deployed, so Supabase migration history was repaired with:

```powershell
.\supabase.exe migration repair --status applied 20260705103000 20260705170000 20260708120000
```

`supabase migration list --linked` now aligns local and remote versions through `20260708120000`. A post-repair `db push --dry-run` attempt is blocked by a separate CLI login-role authentication failure, not migration-history drift.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-08 - Add SEC-010 Shadow Permission Comparison

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-08-001 |
| Status | Deployed / Verified |
| Owner | Security / Platform Architecture / Engineering |
| Summary | Added a shadow permission comparison to `patch_tachograph_import_metadata` without changing legacy runtime enforcement. |
| Reason | SEC-009 selected this RPC as the first low-risk shadow candidate before central permission enforcement swaps begin. |
| Affected Source Documents | `docs/sec-010-shadow-permission-patch-tachograph-import-metadata-2026-07-08.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0022`, `ADR-0024` |
| Capability IDs | Security, RBAC, tachograph import |
| Implementation Impact | Medium |
| Database Impact | Migration Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Reapply the previous `patch_tachograph_import_metadata` body from `20260703090000_harden_tachograph_storage_rls.sql`; do not remove the SEC-007 foundation. |

### Details

Added migration `20260708120000_shadow_permission_patch_tachograph_import_metadata.sql`.

The function still enforces the legacy `manager` role and company boundary. It now calculates `actor_has_permission('tachograph.import.update', target_company_id, null)` in shadow mode and writes `shadow_permission_mismatch` audit events only when the decisions differ.

Live verification on 2026-07-08 returned `shadow_permission_mismatch_count = 0` after a normal manager metadata patch, so SEC-010 is deployed and ready for observation before any enforcement swap.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-05 - Prepare SEC-009 Permission Foundation Deployment Verification

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-05-011 |
| Status | Complete |
| Owner | Security / Platform Architecture / Engineering |
| Summary | Completed SEC-009 deployment verification for the SEC-007 additive permission foundation and selected the first shadow enforcement candidate. |
| Reason | SEC-007 is implemented locally but must be deployed or dry-run against a database and verified before any shadow enforcement work starts. |
| Affected Source Documents | `docs/sec-009-additive-permission-foundation-deploy-verify-2026-07-05.md`, `docs/sec-009-post-deploy-verification.sql`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0022`, `ADR-0023`, `ADR-0024` |
| Capability IDs | Security, organisation hierarchy, RBAC |
| Implementation Impact | High |
| Database Impact | Migration Deployed / Verified |
| Security Impact | Security Gate Required |
| Testing Impact | Post-Deploy Verification Required |
| Rollback Notes | SEC-009 is documentation/verification SQL only. If the SEC-007 migration is deployed and must be rolled back before enforcement swaps, drop the additive security functions/tables in reverse dependency order and leave existing `profiles`, `company_id`, legacy policies, tachograph, timeline, and storage objects untouched. |

### Details

SEC-009 completed the controlled deployment verification path for `supabase/migrations/20260705170000_add_security_permission_foundation.sql`.

The deployment document covers Supabase Dashboard SQL Editor and privileged `psql` options, expected object/seed/backfill counts, denied-default permission checks, site fail-closed verification, completion criteria, rollback position, and recommends `patch_tachograph_import_metadata` as the first shadow enforcement candidate.

The standalone verification SQL is `docs/sec-009-post-deploy-verification.sql`.

Dashboard verification confirmed:

- `security_roles = 10`
- `security_permissions = 32`
- role grants: `driver = 6`, `fleet_administrator = 22`
- no unexpected `fleet_administrator` grants for raw-file export, report export, role admin, support session admin, or Atlas fleet summary
- active assignments: `driver = 17`, `fleet_administrator = 1`
- no active legacy `manager`/`driver` profiles missing assignments
- no orphaned active legacy backfill assignments
- assignment scope is organisation-only with null `site_id`
- compatibility view count matches 17 active drivers and 1 active manager

The first shadow enforcement candidate is `patch_tachograph_import_metadata`.

CLI deployment remains unsuitable until migration history drift is reconciled, but SEC-009 itself is complete from Dashboard SQL verification.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-05 - Complete SEC-007 Additive Permission Foundation Implementation

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-05-010 |
| Status | Implemented / Deployed / Verified |
| Owner | Security / Platform Architecture / Engineering |
| Summary | Added the SEC-007 additive permission foundation migration and static regression tests. |
| Reason | SEC-005 and SEC-006 defined the permission foundation required before replacing legacy `profiles.role` checks with zero-trust role/permission enforcement. SEC-008 supplied fresh schema/policy evidence and backfill sizing. |
| Affected Source Documents | `docs/sec-007-additive-permission-foundation-implementation-2026-07-05.md`, `docs/sec-008-supabase-dump-gate-2026-07-05.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0022`, `ADR-0023`, `ADR-0024`, `ADR-0025`, `ADR-0026`, `ADR-0027`, `ADR-0028` |
| Capability IDs | Security, organisation hierarchy, RBAC, reporting, Atlas, exports, support access |
| Implementation Impact | High |
| Database Impact | Migration Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Added |
| Rollback Notes | The migration is additive. If deployment fails before enforcement swaps, drop or ignore the new security functions/tables in reverse dependency order while keeping `profiles.role`, `company_id`, and existing RLS policies untouched. |

### Details

SEC-007 adds migration `supabase/migrations/20260705170000_add_security_permission_foundation.sql`.

The migration creates additive role, permission, role-permission, role-assignment, audit-event, and compatibility-view objects. It seeds the role and permission catalogues, grants current manager-compatible permissions to `fleet_administrator`, grants own-record permissions to `driver`, denies export/role-admin/support/Atlas fleet-summary permissions by default, and backfills active legacy `manager`/`driver` profiles with `company_id`.

The implementation intentionally does not add `organisation_id`, site enforcement, Atlas retrieval, report export snapshots, support sessions, ADR-0028 maintenance-rule tables, or broad existing RLS/RPC replacement.

Static test `src/lib/security/sec007PermissionFoundation.test.ts` is included in `npm run test:rules`. Verification passed with 8 test files and 106 tests.

SEC-009 subsequently verified deployment/backfill behaviour through Supabase Dashboard SQL.

`npm run typecheck` still fails on existing unrelated app/type-generation issues; this was not introduced by SEC-007.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-05 - Record SEC-008 Supabase Dump Blocker

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-05-009 |
| Status | Partially Implemented |
| Owner | Security / Platform Architecture |
| Summary | Recorded the SEC-008 linked Supabase dump attempts, successful PostgreSQL 17 native schema/policy capture, Supabase Dashboard storage bucket evidence, and expected role backfill counts. |
| Reason | SEC-008 requires fresh live schema/policy evidence before downstream permission-foundation rollout can rely on current catalog state. |
| Affected Source Documents | `docs/sec-008-supabase-dump-gate-2026-07-05.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0022`, `ADR-0023`, `ADR-0024` |
| Capability IDs | Security, organisation hierarchy, RBAC |
| Implementation Impact | High |
| Database Impact | None Yet / Evidence Required Before Migration Reliance |
| Security Impact | Security Gate Required |
| Testing Impact | Test Update Required After Evidence Capture |
| Rollback Notes | Supersede this entry when remaining profile distribution counts are recorded, if required, and the local SEC-007 artefact mismatch is reconciled. |

### Details

The linked Supabase dump was retried after Docker installation:

```powershell
.\supabase.exe db dump --linked --schema public,storage --file supabase\.temp\sec-008-live-schema-policy-dump-2026-07-05.sql
```

The command reached remote dump initialisation but failed because Docker Desktop cannot start its Linux engine. `docker ps` returns `Docker Desktop is unable to start`, `com.docker.service` is stopped, and WSL reports no installed Linux distributions.

PostgreSQL 15 native client tooling was then installed and can reach the linked database, but `pg_dump` aborts because the linked server is PostgreSQL 17.6 and `pg_dump` is version 15.18. The next local non-Docker route is PostgreSQL 17 client tooling.

PostgreSQL 17 native client tooling then captured a fresh non-empty public/storage schema and policy dump at `supabase/.temp/sec-008-live-schema-policy-dump-2026-07-05.sql`.

Catalog evidence shows 63/63 captured live public/storage tables with RLS enabled, `public.profiles` forced RLS, 133 policies, and no `security_*` permission foundation tables present.

Supabase Dashboard SQL captured the storage bucket result set in `docs/sql results.txt`.

Expected role backfill counts were provided separately: 17 `driver` assignments and 1 `fleet_administrator` assignment. The dataset is test-seeded: the fleet administrator is the project owner/operator, one driver row is also the owner/operator, and the remaining driver rows are fake SQL-injected profiles.

`SEC-008` remains partial, not complete, because company-role distribution, profiles-without-company count, and inactive-profile count have not been captured. Those details are useful before migration execution, but the expected role backfill sizing is now known for the current live test dataset.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-05 - Complete SEC-006 Permission Foundation Candidate Plan

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-05-008 |
| Status | Implemented |
| Owner | Security / Platform Architecture |
| Summary | Added the SEC-006 catalog refresh and candidate migration/test plan for the additive permission foundation. |
| Reason | SEC-005 required live/local catalog verification and a candidate migration/test plan before writing additive permission foundation SQL. |
| Affected Source Documents | `docs/sec-006-permission-foundation-catalog-refresh-candidate-plan-2026-07-05.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0022`, `ADR-0023`, `ADR-0024`, `ADR-0025`, `ADR-0026`, `ADR-0027`, `ADR-0028` |
| Capability IDs | Security, organisation hierarchy, RBAC, reporting, Atlas, exports, support access, maintenance |
| Implementation Impact | High |
| Database Impact | Migration Required Later |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede SEC-006 if a fresh live catalog export changes the candidate migration shape, seed data, backfill assumptions, or rollback plan. |

### Details

SEC-006 records that a fresh linked Supabase dump was attempted but failed because Docker Desktop/daemon is unavailable locally. The plan therefore uses the existing 2026-07-02 dashboard-export artefacts plus current source-controlled migrations as planning evidence, with a hard requirement for a fresh dashboard/SQL export before SEC-007 writes final SQL.

The candidate migration is named `20260705170000_add_security_permission_foundation.sql` and is limited to additive permission foundation objects, seed rows, backfill, helpers, audit events, RLS, grants, and tests.

The completion plan now marks `SEC-006` complete and recommends `SEC-007`: implement the additive permission foundation migration and static tests only after fresh live evidence is captured.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-05 - Complete SEC-005 Additive Permission Foundation Design

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-05-007 |
| Status | Implemented |
| Owner | Security / Platform Architecture |
| Summary | Added the SEC-005 additive permission foundation design covering role catalogue, permission keys, role assignments, compatibility wrappers, audit events, backfill strategy, rollout phases, and tests. |
| Reason | SEC-004 found the current baseline is only `company_id` plus legacy `manager`/`driver` checks, so a compatibility-safe permission foundation is required before any enforcement migration. |
| Affected Source Documents | `docs/sec-005-additive-permission-foundation-design-2026-07-05.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0022`, `ADR-0023`, `ADR-0024`, `ADR-0025`, `ADR-0026`, `ADR-0027`, `ADR-0028` |
| Capability IDs | Security, organisation hierarchy, RBAC, reporting, Atlas, exports, support access, maintenance |
| Implementation Impact | High |
| Database Impact | Migration Required Later |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede SEC-005 if live catalog verification or role/backfill decisions change before the additive permission foundation migration is written. |

### Details

SEC-005 defines an additive, compatibility-first permission foundation. It keeps `company_id`, `profiles.company_id`, and legacy `profiles.role` intact while introducing a future migration design for `security_roles`, `security_permissions`, `security_role_permissions`, `security_role_assignments`, and `security_permission_audit_events`.

The design maps current `manager` users to `fleet_administrator` and current `driver` users to `driver`, with export, support, role administration, and tenant-aware Atlas permissions denied by default.

The completion plan now marks `SEC-005` complete as a design gate and recommends `SEC-006`: refresh live/local catalog evidence and produce the candidate migration/test plan before writing SQL.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-05 - Record ADR-0028 Preventive Maintenance Rule Engine

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-05-006 |
| Status | Proposed |
| Owner | Product Architecture / Platform Architecture |
| Summary | Added ADR-0028 as the proposed Preventive Maintenance and Asset Compliance Rule Engine and recorded its implementation dependencies in the completion plan. |
| Reason | The new ADR materially expands future fleet compliance scope beyond tachograph evidence into asset rules, readings, due states, evidence, notifications, reporting, Atlas summaries, and multi-site visibility. |
| Affected Source Documents | `docs/adr/ADR-0028_Preventive_Maintenance_Asset_Compliance_Rule_Engine.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0023`, `ADR-0024`, `ADR-0025`, `ADR-0026`, `ADR-0028` |
| Capability IDs | Fleet Portal, maintenance, asset compliance, reporting, Atlas, notifications, security |
| Implementation Impact | High |
| Database Impact | Migration Required Later |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede ADR-0028 if the maintenance/compliance rule engine scope changes before schema design. Keep implementation deferred until SEC-005 and a dedicated asset-rule schema plan exist. |

### Details

ADR-0028 is recorded as proposed, not accepted implementation scope.

The completion plan now tracks ADR-0028 as a future asset compliance rule engine covering date, mileage, engine-hour, whichever-comes-first, stale-reading, evidence, notification, Atlas, reporting, and multi-site behaviours.

Implementation is deferred until the asset/rule/reading/due-state/evidence schema, stale-reading logic, site permissions, notification model, Atlas retrieval boundaries, and reporting/export audit model are specified.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-05 - Complete SEC-004 Zero Trust Compatibility Audit

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-05-005 |
| Status | Implemented |
| Owner | Security / Platform Architecture |
| Summary | Added the SEC-004 no-migration compatibility audit for the current schema, RLS/RPC, Edge Function, export/report, cache, Atlas, and support-access posture against the SEC-003 Zero Trust matrix. |
| Reason | SEC-003 required a compatibility audit before any organisation/site/RBAC migration is designed or written. |
| Affected Source Documents | `docs/sec-004-zero-trust-no-migration-compatibility-audit-2026-07-05.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0022`, `ADR-0023`, `ADR-0024`, `ADR-0025`, `ADR-0026`, `ADR-0027` |
| Capability IDs | Security, organisation hierarchy, RBAC, reporting, Atlas, exports, support access |
| Implementation Impact | High |
| Database Impact | Migration Required Later |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede the SEC-004 audit if live catalog verification or implementation changes materially alter the current compatibility baseline before SEC-005. |

### Details

SEC-004 confirms the current enforceable baseline is `company_id` as organisation scope plus legacy `profiles.role` values of `manager` and `driver`.

The audit found no authoritative site model, no role/permission catalogue, no central permission resolver, no export-specific permission/audit flow, no tenant-aware Atlas retrieval, and no support access session model.

The completion plan now marks `SEC-004` complete and recommends `SEC-005`: design the additive permission foundation migration, including role/permission tables, compatibility wrappers, audit events, and cross-tenant/role-boundary tests, with live/local catalog verification before final SQL.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-05 - Complete SEC-003 Zero Trust RBAC Matrix

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-05-004 |
| Status | Implemented |
| Owner | Security / Platform Architecture |
| Summary | Added the SEC-003 implementation-control matrix for Zero Trust organisation, site, role, ownership, operation, export, report, cache, and Atlas authorisation. |
| Reason | ADR-0022 through ADR-0027 are accepted constraints, but they needed an implementation matrix before schema/RLS work could proceed safely. |
| Affected Source Documents | `docs/zero-trust-organisation-rbac-matrix-sec-003-2026-07-05.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0022`, `ADR-0023`, `ADR-0024`, `ADR-0025`, `ADR-0026`, `ADR-0027` |
| Capability IDs | Security, organisation hierarchy, RBAC, reporting, Atlas, resource assignment |
| Implementation Impact | High |
| Database Impact | Migration Required Later |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede the SEC-003 matrix if the organisation/site/RBAC model changes before SEC-004 or migration work. |

### Details

SEC-003 documents the compatibility rule that current `companies` / `company_id` remains the enforceable organisation scope until a controlled organisation/site migration exists.

It defines the target scope model, core security tables, permission key pattern, baseline role matrix, operation matrix, RLS/function rules, Edge Function/RPC checks, export/report/download rules, cache-key rules, Atlas rules, mandatory tests, and phased implementation route.

The completion plan now marks SEC-003 complete as a planning gate and recommends `SEC-004`: a no-migration compatibility audit before any schema/RLS migration is written.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-05 - Record Organisation Security ADR Impact

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-05-003 |
| Status | Accepted |
| Owner | Product Architecture / Platform Architecture / Security |
| Summary | Recorded ADR-0022 through ADR-0027 as accepted organisation, security, Atlas, reporting, and resource-transfer constraints, and deferred TIME-008 until a real vehicle-unit import is available. |
| Reason | New accepted ADRs materially affect tenant modelling, site scoping, RBAC, Atlas permissions, reporting aggregation, assignment history, and implementation sequencing. |
| Affected Source Documents | `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0022`, `ADR-0023`, `ADR-0024`, `ADR-0025`, `ADR-0026`, `ADR-0027` |
| Capability IDs | Security, organisation hierarchy, reporting, Atlas, resource assignment, Fleet Portal |
| Implementation Impact | High |
| Database Impact | Migration Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede this entry if the organisation/site/RBAC model changes before implementation. Keep TIME-008 blocked until a real VU import is available. |

### Details

`ADR-0022` through `ADR-0027` are now recorded in the completion plan as accepted governing constraints. They are not implementation-ready by themselves; they require a concrete permission matrix, schema plan, RLS/RPC/Edge Function guards, export/report rules, cache-key rules, Atlas access rules, and automated tests.

`TIME-008` is now marked blocked/deferred because no real vehicle-unit tachograph import is available. The plan explicitly avoids using synthetic VU data to satisfy the vehicle-unit timeline acceptance gate.

The recommended next task is now `SEC-003`: create the Zero Trust organisation/site/RBAC implementation matrix from `ADR-0022`, `ADR-0023`, and `ADR-0024`.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-05 - Complete HELPER-003 Live Reader Validation

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-05-002 |
| Status | Implemented |
| Owner | Engineering |
| Summary | Completed live Phase 1 validation for the Windows helper read-only driver-card flow through browser upload, `process-tacho`, and Driver Card Analysis. |
| Reason | `HELPER-003` required physical reader/card plus Supabase validation before any helper sync queue or Tachomaster-style bulk sync work could be considered. |
| Affected Source Documents | `98 - Changelog.md`, `docs/helper-003-phase1-validation-2026-07-04.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `docs/hourwise-portal-master-build-plan.md`, `docs/tacho-reader-helper-production-checklist.md` |
| Affected ADRs | `ADR-0019` referenced |
| Capability IDs | Tachograph import/helper workflow, Driver Card Analysis, timeline generation |
| Implementation Impact | Medium |
| Database Impact | None |
| Security Impact | None |
| Testing Impact | Test Update Required |
| Rollback Notes | Revert HELPER-003 status to partial if a subsequent live read cannot reproduce browser upload, `process-tacho`, analysis routing, and timeline alignment. |

### Details

Live validation passed on 2026-07-05 with a physical smart-card reader and driver card. Baseline import `b9c8c986-445b-4411-82fc-c96b8ecf6178` linked to `PHILIP CHRISTOPHER GERAN`, decoded card `DB18220162003911`, reached `complete`, and opened Driver Card Analysis.

The read-only helper capture decoded 1839 provisional EF `0504` activity segments across 69 days. The visible review day `2026-06-29` showed aligned comparison counts: tachograph `58` / timeline `58`, gaps `0` / `0`, and day summaries `1` / `1`.

Initial live attempts exposed two defects that were corrected before the successful validation: stale terminal helper imports now clear through `/imports/reset`, and the read-only EF `0504` parser now uses a bounded best-run scan to avoid Supabase CPU-time termination.

The flow remains provisional read-only capture and is not certified legal `.C1B/.DDD` output. `ADR-0019` still gates any encrypted retry outbox or bulk sync implementation.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-05 - Add Rota Planning And Unified Event Sync ADRs

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-05-001 |
| Status | Proposed |
| Owner | Product Architecture / Platform Architecture / Security |
| Summary | Added `ADR-0020` and `ADR-0021` to define future rota/job/route planning and unified operational event synchronisation. |
| Reason | HourWise needs a shared Portal/App planning model and a single backend event layer for rota changes, job updates, route changes, messaging, acknowledgements, push/realtime delivery, and Atlas recommendations. |
| Affected Source Documents | `ADR-0020 - Rota, Job Planning, Route Estimates and Compliance-Aware Updates`, `ADR-0021 - Unified Event Synchronisation, Messaging and Atlas Integration`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `98 - Changelog.md` |
| Affected ADRs | `ADR-0020`, `ADR-0021` |
| Capability IDs | Rota/job planning, messaging, Atlas, operational events |
| Implementation Impact | High |
| Database Impact | Migration Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Keep the ADRs as proposed and remove them from active backlog sequencing if operational planning is deferred beyond P1. |

### Details

`ADR-0020` proposes a shared backend model for rota, job planning, route estimates, planned/actual job durations, delay handling, compliance-aware route warnings, manager messages, and Driver App consumption. It explicitly states that HourWise is not live HGV navigation and route estimates are advisory.

`ADR-0021` proposes a unified operational event system for messaging, rota updates, job updates, route changes, driver acknowledgements, push/realtime delivery, and Atlas recommendation events. It keeps the backend database as the source of truth and requires strict RLS/role visibility.

The completion plan now treats both ADRs as proposed P1 architecture. They do not displace the current tachograph/helper completion gate and must not be implemented until schema, RLS, event delivery, notification, acknowledgement, deduplication, and Atlas access boundaries are specified.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-04 - Add HELPER-003 Phase 1 Validation Harness

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-04-002 |
| Status | Implemented |
| Owner | Engineering |
| Summary | Added an automated Phase 1 validation harness for the Windows tachograph helper read/export/register contract. |
| Reason | `HELPER-003` needs repeatable validation of the current no-cache helper flow before any `ADR-0019` sync queue work starts. |
| Affected Source Documents | `98 - Changelog.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `docs/hourwise-portal-master-build-plan.md`, `docs/tacho-reader-helper-production-checklist.md`, `docs/helper-003-phase1-validation-2026-07-04.md` |
| Affected ADRs | `ADR-0019` referenced |
| Capability IDs | Tachograph import/helper workflow |
| Implementation Impact | Medium |
| Database Impact | None |
| Security Impact | None |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Remove `tacho:helper:phase1`, `phase1-validation.mjs`, `write-test-export.mjs`, and the related checklist/build-plan references. |

### Details

Added `npm run tacho:helper:phase1`, which builds the real .NET helper into a temporary folder, starts it on a non-default local port, enables simulated card presence and the external-export command seam, runs the read-mode helper contract probe, downloads export bytes, registers the import with the helper, and expects the helper to reach `complete`.

The existing mock scenario regression now defaults to isolated port `47237` so it does not accidentally talk to a normally running helper on `47231`.

`HELPER-003` is partially complete: automated command-seam validation now passes, while physical reader/card plus browser/Supabase validation remains pending.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-04 - Accept Windows Helper Local Outbox ADR

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-04-001 |
| Status | Accepted |
| Owner | Product Architecture / Security / Engineering |
| Summary | Added `ADR-0019` to define the Windows helper local outbox and sync semantics. |
| Reason | The helper needs a safe reliability path for failed/interrupted uploads without becoming a local compliance database or storing privileged Supabase credentials. |
| Affected Source Documents | `98 - Changelog.md`, `docs/source-of-truth-completion-plan-2026-07-02.md`, `docs/hourwise-portal-master-build-plan.md`, `docs/tacho-reader-helper-production-checklist.md` |
| Affected ADRs | `ADR-0019` |
| Capability IDs | Tachograph import/helper workflow |
| Implementation Impact | Medium |
| Database Impact | None |
| Security Impact | Security Gate Required |
| Testing Impact | Test Update Required |
| Rollback Notes | Supersede `ADR-0019` with a stricter no-local-cache ADR and remove Phase 2 outbox tasks from the helper checklist/master plan. |

### Details

HourWise accepts a constrained encrypted local outbox in the Windows helper only as a short-lived delivery/retry queue for complete tachograph exports when browser upload or backend registration fails/interrupted.

Supabase and backend imports remain the source of truth. The helper must not contain service-role keys, store long-lived browser tokens, become a local compliance database, or retain raw card/vehicle-unit data indefinitely.

The implementation sequence remains Phase 1 first: helper read/export bytes, browser authenticated upload, `process-tacho`, and analysis routing. Phase 2 encrypted retry cache and Phase 3 Tachomaster-style bulk sync are explicitly gated by `ADR-0019`.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

---

## 2026-07-03 - Complete TIME-004 Timeline Bundle API Adapter

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-03-006 |
| Status | Implemented |
| Owner | Platform Architecture / Fleet Portal |
| Summary | Wired timeline bundle reads into the app/API adapter layer behind existing tachograph bundle fetchers. |
| Reason | Timeline generation needs application-layer verification before existing tachograph views are replaced with timeline-native rendering. |
| Affected Source Documents | `98 - Changelog.md`, `docs/timeline-bundle-api-adapter-time-004-2026-07-03.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0016`, `ADR-0017`, `ADR-0018` |
| Capability IDs | Timeline Engine, Fleet Portal, Import Management, Compliance Intelligence |
| Implementation Impact | Medium |
| Database Impact | None; depends on `20260703133000_add_timeline_generation_read_models.sql` being applied |
| Security Impact | Existing timeline RPC authorization applies |
| Testing Impact | Adapter and static API regression tests added |
| Rollback Notes | Remove optional timeline fetches from existing tachograph bundle fetchers; do not delete generated timeline history. |

### Details

Added typed timeline bundle structures, API helpers for import/driver/vehicle timeline bundle RPCs, and non-destructive comparison metadata attached to existing tachograph parser bundles.

Existing tachograph fetchers still call legacy bundle RPCs first. Timeline RPC failures are isolated and reported as comparison warnings so current views remain stable while timeline generation is verified.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-03 - Complete TIME-003 Timeline Generation Runtime

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-03-005 |
| Status | Implemented |
| Owner | Platform Architecture / Timeline Engine |
| Summary | Added import-scoped timeline generation from parser-derived tachograph rows and read-only timeline bundle RPCs. |
| Reason | The `Secure Upload to Timeline` milestone requires parser-derived rows to produce versioned timeline records with source links, gaps, daily summaries, and current/superseded generation state. |
| Affected Source Documents | `98 - Changelog.md`, `docs/timeline-generation-runtime-time-003-2026-07-03.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0016`, `ADR-0017`, `ADR-0018` |
| Capability IDs | Timeline Engine, Parser Pipeline, Import Management, Compliance Intelligence |
| Implementation Impact | High |
| Database Impact | Forward-fix read-model migration added |
| Security Impact | Security-definer RPCs include explicit manager/company checks |
| Testing Impact | Static timeline generation regression tests added |
| Rollback Notes | Prefer forward-fix rollback after timeline rows exist. Reverting runtime generation should not delete generated timeline audit history. |

### Details

Updated `process-tacho` so successful parser runs create import-scoped timeline generations from persisted parser-derived rows. Generated timeline data includes activity/technical events, event source links, vehicle/reconciliation gaps, and daily summaries, all tied to the current `parser_run_id`.

Added `supabase/migrations/20260703133000_add_timeline_generation_read_models.sql` with read-only import, driver, and vehicle timeline bundle RPCs.

Existing tachograph UI/API read paths are unchanged; the next task is adapter/UI integration behind existing views.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-03 - Complete TIME-002 Timeline Generation Schema

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-03-004 |
| Status | Implemented |
| Owner | Platform Architecture / Timeline Engine |
| Summary | Added the versioned timeline generation, event, source, gap, and daily summary schema required by the Secure Upload to Timeline milestone. |
| Reason | `ADR-0017` requires timeline events to be versioned derived records with source references, generation identity, current/superseded state, and gap tracking. |
| Affected Source Documents | `98 - Changelog.md`, `docs/timeline-generation-schema-time-002-2026-07-03.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0016`, `ADR-0017`, `ADR-0018` |
| Capability IDs | Timeline Engine, Parser Pipeline, Compliance Intelligence, Evidence Engine |
| Implementation Impact | High |
| Database Impact | Forward-fix migration added |
| Security Impact | Manager and driver read RLS added for timeline records |
| Testing Impact | Static timeline schema regression tests added |
| Rollback Notes | Prefer forward-fix rollback after timeline data exists. Dropping the new tables would discard derived timeline audit history. |

### Details

Added `supabase/migrations/20260703123000_add_timeline_generation_event_schema.sql`.

The migration creates `timeline_generations`, `timeline_events`, `timeline_event_sources`, `timeline_gaps`, and `daily_timeline_summaries`. It includes generation version/current/supersession fields, parser-run and parser-output references, source linkage, gap review states, daily summary fields, updated-at triggers, tenant read indexes, and explicit RLS.

This change is schema-only. Timeline generation workers and read-model RPCs remain a separate implementation task.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-03 - Complete PARSE-002 Parser Run Lifecycle Versioning

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-03-003 |
| Status | Implemented |
| Owner | Platform Architecture / Parser Pipeline |
| Summary | Extended parser-run lifecycle persistence so reprocessing creates distinct versioned runs and preserves parser-run history. |
| Reason | `ADR-0003`, `ADR-0016`, and the `Secure Upload to Timeline` milestone require parser executions, outputs, and errors to be traceable without deleting earlier parser-run audit records. |
| Affected Source Documents | `98 - Changelog.md`, `docs/parser-run-lifecycle-parse-002-2026-07-03.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0003`, `ADR-0016`, `ADR-0018` |
| Capability IDs | Parser Pipeline, Import Management, Compliance Intelligence, Timeline Engine |
| Implementation Impact | High |
| Database Impact | Forward-fix migration and backfill added |
| Security Impact | Manager read RLS added for parser diagnostics |
| Testing Impact | Static parser lifecycle regression tests added |
| Rollback Notes | Prefer forward-fix rollback. Do not drop new parser-run lifecycle columns after production writes unless parser audit data has been exported or confirmed disposable. |

### Details

Added `supabase/migrations/20260703113000_extend_parser_run_lifecycle.sql`.

The migration extends `tachograph_processing_runs` with lifecycle status, parser identity, timing, current/superseded state, and backfilled run sequence data. It also adds `tachograph_parser_outputs`, `tachograph_parser_errors`, and nullable `parser_run_id` links on derived tachograph tables where practical.

Updated `process-tacho` so parser runs are created before parsing starts and completed or failed in place. Reprocessing no longer deletes `tachograph_processing_runs`; older runs are marked non-current and linked from the new run through `supersedes_parser_run_id`.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-03 - Complete DATA-003 Driver Card Retention Archive

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-03-002 |
| Status | Implemented |
| Owner | Platform Architecture / Data |
| Summary | Converted destructive driver-card purge/reset flows into retention-state/archive-only workflows. |
| Reason | The `Secure Upload to Timeline` milestone requires raw imports, parser history, and derived evidence to be retained rather than deleted during reset/reprocess operations. |
| Affected Source Documents | `98 - Changelog.md`, `docs/driver-card-retention-archive-data-003-2026-07-03.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0017`, `ADR-0018` |
| Capability IDs | `CORE-004`, `CORE-005`, `SYS-001`, `SYS-004` |
| Implementation Impact | High |
| Database Impact | Forward-fix migration added |
| Security Impact | Evidence retention hardening |
| Testing Impact | Static security/data-retention regression tests updated |
| Rollback Notes | Reverting this change would reintroduce destructive purge/reset behaviour; use a forward-fix if archive metadata needs adjustment. |

### Details

Added `supabase/migrations/20260703103000_archive_driver_card_reset_flows.sql`.

The migration preserves existing RPC names for compatibility but changes `purge_company_driver_card_reads` and `prepare_tacho_import_reprocess` to retain raw storage, import rows, derived rows, parser runs, and driver signal history.

The Import Centre now presents archive/reset language instead of destructive delete language, and archived reset rows are hidden by the existing archive filter.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-03 - Complete SEC-002 Storage/RLS Hardening

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-03-001 |
| Status | Implemented |
| Owner | Platform Architecture / Security |
| Summary | Added the `SEC-002` forward-fix migration and client changes that harden `tachograph-files` storage and `tachograph_files` metadata policies. |
| Reason | `DATA-002` found a live storage delete policy and broad `tachograph_files` `ALL` policy that conflicted with the `Secure Upload to Timeline` raw evidence immutability gate. |
| Affected Source Documents | `98 - Changelog.md`, `docs/storage-rls-hardening-sec-002-2026-07-03.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0018` |
| Capability IDs | `CORE-004`, `CORE-005`, `SYS-001` |
| Implementation Impact | High |
| Database Impact | Forward-fix migration added |
| Security Impact | Storage/RLS hardening |
| Testing Impact | Static security regression tests updated |
| Rollback Notes | Reverting this hardening would re-open raw evidence deletion/update risk; rollback should instead use a forward-fix if policy text needs adjustment. |

### Details

Added `supabase/migrations/20260703090000_harden_tachograph_storage_rls.sql`.

The migration keeps `tachograph-files` private, recreates manager company-scoped storage insert/select policies, does not recreate storage update/delete policies, replaces the broad live `tachograph_files` `ALL` policy, adds a scoped metadata patch RPC, and adds a trigger to prevent normal authenticated users from mutating raw evidence identity fields.

Application code no longer attempts browser-side deletion from the `tachograph-files` bucket.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Complete DATA-002 Live Schema Verification

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-016 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Completed the `DATA-002` live schema/policy verification artifact using manual Supabase export evidence and recorded live storage/RLS blockers. |
| Reason | The `Secure Upload to Timeline` milestone requires live Supabase schema and policy verification before implementation migrations are safe; manual export evidence replaced the blocked Docker-dependent CLI dump path. |
| Affected Source Documents | `98 - Changelog.md`, `docs/live-schema-policy-verification-data-002-2026-07-02.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0003`, `ADR-0016`, `ADR-0017`, `ADR-0018` |
| Capability IDs | `CORE-004`, `CORE-005`, `SYS-001`, `SYS-004`, `CMP-004` |
| Implementation Impact | High |
| Database Impact | Migration Planning Unblocked For Storage/RLS Hardening |
| Security Impact | Security Gate Required |
| Testing Impact | Test Update Required |
| Rollback Notes | No schema rollback is required because no production migration was applied; next migration must remove unsafe raw storage delete access and narrow `tachograph_files` permissions. |

### Details

Attempted to create a linked Supabase schema dump for `public` and `storage`. The CLI path was blocked because the Supabase dump workflow requires Docker and Docker is unavailable in the current environment.

Manual Supabase Dashboard export evidence was captured instead, then split into schema-only SQL, policy JSON, RLS status JSON, and storage bucket JSON. The new `DATA-002` artifact records the live schema inventory, confirms the private `tachograph-files` bucket, and identifies policy blockers that must be fixed before timeline feature migrations begin.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Secure Upload To Timeline Acceptance And Rollback

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-015 |
| Status | Implemented |
| Owner | Product Architecture / Platform Architecture |
| Summary | Defined acceptance criteria, release gates, and rollback strategy for the `Secure Upload to Timeline` MVP milestone. |
| Reason | The source-of-truth completion plan requires the first milestone to have explicit acceptance criteria and rollback strategy before implementation work treats it as build-ready. |
| Affected Source Documents | `98 - Changelog.md`, `docs/secure-upload-to-timeline-acceptance-rollback-2026-07-02.md`, `docs/source-of-truth-completion-plan-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0003`, `ADR-0016`, `ADR-0017`, `ADR-0018` |
| Capability IDs | `CORE-004`, `CORE-005`, `SYS-001`, `SYS-004`, `CMP-004`, Fleet Portal capability area |
| Implementation Impact | High |
| Database Impact | Migration Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Use the milestone rollback strategy to disable upload/processing/timeline generation without deleting raw evidence, parser history, or timeline generations. |

### Details

Added a milestone contract for `Secure Upload to Timeline`.

The contract defines in-scope and out-of-scope work, capability mapping, acceptance criteria for upload/evidence/parser/timeline/UI/security/observability, required tests, release gates, rollback triggers, rollback steps, and implementation sequence.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Parser Fixture Regression Tests

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-014 |
| Status | Implemented |
| Owner | Engineering |
| Summary | Added parser fixture regression coverage for tachograph parser identities, outcomes, derived counts, warnings, and errors. |
| Reason | The MVP parser pipeline needs deterministic regression coverage before parser-run, timeline, compliance, and evidence migrations depend on parser output shape. |
| Affected Source Documents | `98 - Changelog.md`, `docs/parser-fixture-regression-tests-2026-07-02.md` |
| Affected ADRs | `ADR-0003`, `ADR-0016` |
| Capability IDs | Parser Pipeline, Import Management, Compliance Intelligence |
| Implementation Impact | Medium |
| Database Impact | None |
| Security Impact | None |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Remove only if replaced by stronger real binary parser fixture tests covering the same parser identities and output contracts. |

### Details

Added `src/lib/tacho/parserRegressionFixtures.ts` and `src/lib/tacho/parserRegressionFixtures.test.ts`, then included the test in `npm run test:rules`.

The fixture suite covers processed driver-card activity output, continuous-driving breach output, vehicle-unit cardless-driving and overspeed outputs, read-only helper capture partial output, and malformed parser-like timing failure output.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Cross-Tenant Upload/Read Regression Tests

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-013 |
| Status | Implemented |
| Owner | Security |
| Summary | Added Vitest regression coverage for tachograph cross-tenant storage upload/read policy boundaries and tacho read RPC scoping. |
| Reason | The MVP security gate requires tests that prevent regressions where uploads or reads can cross tenant boundaries. |
| Affected Source Documents | `98 - Changelog.md`, `docs/cross-tenant-upload-read-regression-tests-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0018` |
| Capability IDs | Security, Import Management, Compliance Intelligence |
| Implementation Impact | Medium |
| Database Impact | None |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Remove only if replaced by stronger runtime Supabase RLS/storage integration tests that cover the same upload/read boundaries. |

### Details

Added `src/lib/tacho/securityRegression.test.ts` and included it in `npm run test:rules`.

The tests statically verify that the `tachograph-files` upload/read storage policies are authenticated, manager-only, bucket-specific, and scoped by the actor's company folder. They also verify that driver, vehicle, and import tacho bundle reads remain scoped by company ID plus the relevant entity/import ID in both SQL and client RPC wiring.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Timeline Event MVP Schema And Read Model

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-012 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Defined the MVP schema, generation model, and UI read model for Timeline Events. |
| Reason | `SOT-18.6`, `SOT-21`, and `ADR-0017` require timeline events to be versioned derived records, but the current implementation only has tachograph-derived activity, summary, finding, and reconciliation tables. |
| Affected Source Documents | `98 - Changelog.md`, `docs/timeline-event-mvp-schema-read-model-2026-07-02.md` |
| Affected ADRs | `ADR-0016`, `ADR-0017`, `ADR-0018` |
| Capability IDs | Timeline Engine, Compliance Intelligence, Evidence Engine |
| Implementation Impact | High |
| Database Impact | Migration Required / Data Backfill Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede with a revised timeline migration plan if live schema verification or UI review requires a different read model. |

### Details

Added a timeline MVP document that defines `timeline_generations`, `timeline_events`, `timeline_event_sources`, `timeline_gaps`, and `daily_timeline_summaries`.

The document maps current tachograph-derived tables to timeline events, defines generation/version rules, provides the `timeline-mvp-1` UI read model, lists indexes and RLS expectations, and sets migration/test gates.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Process Tacho Parser Run Contract

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-011 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Mapped the current `process-tacho` edge function and `tachograph_processing_runs` table to the source-of-truth parser run contract. |
| Reason | `ADR-0003` and `ADR-0016` require versioned parser runs, parser outputs, and parser errors, while the current implementation records only limited processing-run rows and deletes prior run history during reprocessing cleanup. |
| Affected Source Documents | `98 - Changelog.md`, `docs/process-tacho-parser-run-contract-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0003`, `ADR-0016`, `ADR-0018` |
| Capability IDs | Import Management, Parser Pipeline, Compliance Intelligence |
| Implementation Impact | High |
| Database Impact | Migration Required / Data Backfill Required |
| Security Impact | Review Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede with a revised parser-run migration plan if live schema verification shows `tachograph_processing_runs` cannot safely act as the compatibility bridge for `parser_runs`. |

### Details

Added a parser run contract document that maps `process-tacho` behaviour, current parser identities, `tachograph_processing_runs`, derived rows, error handling, reprocessing, migration needs, and test requirements to the SOT parser model.

The document requires parser run rows to be created at execution start, updated through lifecycle states, retained across reprocessing, and linked to parser outputs, parser errors, raw imports, and derived records where practical.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Raw Tachograph Storage Immutability Checks

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-010 |
| Status | Implemented |
| Owner | Security |
| Summary | Defined the storage policy, database row, RPC, client, migration, and test checks required to enforce raw tachograph file immutability. |
| Reason | Current storage policies and cleanup flows allow manager update/delete or client-side deletion of raw tachograph evidence, which conflicts with `ADR-0002`, `ADR-0018`, `SOT-21`, and `SOT-22`. |
| Affected Source Documents | `98 - Changelog.md`, `docs/raw-tachograph-storage-immutability-checks-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0018` |
| Capability IDs | Import Management, Security, Compliance Intelligence |
| Implementation Impact | High |
| Database Impact | Migration Required / Data Backfill Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede only if the accepted retention model changes; do not re-enable normal authenticated raw-file update/delete without a replacement ADR and security test coverage. |

### Details

Added an implementation check document for the `tachograph-files` bucket and `tachograph_files` evidence rows.

The document identifies current conflicts, including manager storage update/delete policies, client-side storage `.remove()` calls, candidate archive deletion options, and purge flows that delete import rows. It defines live SQL checks, expected fail-closed policy behaviour, RPC/client remediation requirements, migration shape, and automated test cases.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add Import Batch/File Schema Delta

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-009 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Defined the MVP schema delta between the current `tachograph_files` implementation and the source-of-truth import model. |
| Reason | The source-of-truth model introduces `import_batches`, `import_files`, subtype import records, and `file_assets`, while the current app and functions depend on `tachograph_files`. A compatibility migration path is required before implementation. |
| Affected Source Documents | `98 - Changelog.md`, `docs/import-batch-file-schema-delta-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0016`, `ADR-0018` |
| Capability IDs | Import Management, Compliance Intelligence |
| Implementation Impact | High |
| Database Impact | Migration Required / Data Backfill Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede with a revised import migration plan if live schema inspection shows `tachograph_files` cannot safely act as the MVP compatibility bridge. |

### Details

Added an implementation delta document that maps the current `tachograph_files` contract to the SOT `import_files` model, recommends additive compatibility changes, defines `import_batches` requirements, lists indexes, identifies RLS/storage constraints, and sets backfill gates.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add MVP Data Model Migration Reconciliation

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-008 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Added static reconciliation of source-controlled migrations against the `SOT-21` MVP data model. |
| Reason | Phase 1 implementation planning requires a clear map between existing tables and the source-of-truth MVP schema before new migrations are written. |
| Affected Source Documents | `98 - Changelog.md`, `docs/data-model-mvp-migration-reconciliation-2026-07-02.md` |
| Affected ADRs | `ADR-0016`, `ADR-0017`, `ADR-0018` referenced |
| Capability IDs | `CORE`, `CMP`, `SYS`, `REP`, `INT` capability areas affected; exact IDs to be mapped during backlog conversion. |
| Implementation Impact | Medium |
| Database Impact | Migration Required |
| Security Impact | Review Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede this reconciliation after a live database schema verification if actual hosted schema differs from source-controlled migrations. |

### Details

Created `docs/data-model-mvp-migration-reconciliation-2026-07-02.md`.

The reconciliation maps `SOT-21` required MVP tables to existing migration-created tables, identifies naming conflicts such as `companies` versus `fleets`, highlights missing timeline/evidence/reporting/Atlas tables, and recommends verifying live database state before writing new schema migrations.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Add RLS Security Reconciliation

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-007 |
| Status | Implemented |
| Owner | Security |
| Summary | Added a static reconciliation of current Supabase RLS/security migrations against `SOT-22`. |
| Reason | Phase 1 implementation planning requires visibility into whether the current RLS/security model matches the source-of-truth security requirements. |
| Affected Source Documents | `98 - Changelog.md`, `docs/security-rls-reconciliation-2026-07-02.md` |
| Affected ADRs | `ADR-0002`, `ADR-0012`, `ADR-0018` referenced |
| Capability IDs | `SYS`, `CMP`, `CORE` capability areas affected; exact IDs to be mapped during security backlog conversion. |
| Implementation Impact | Medium |
| Database Impact | Migration Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede this reconciliation if a live database policy audit produces different findings. |

### Details

Created `docs/security-rls-reconciliation-2026-07-02.md`.

The reconciliation identifies partial RLS coverage, likely missing RLS on core tachograph tables, tachograph storage update/delete conflicts with raw evidence immutability, and the need for permission tests around security-definer RPCs.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Accept Raw Tachograph File Retention ADR

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-006 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Added `ADR-0018` to define raw tachograph file retention as policy-driven and audited. |
| Reason | Storage design, deletion workflows, evidence integrity, privacy handling, and report traceability need a clear retention model. |
| Affected Source Documents | `SOT-21`, `SOT-24`, `SOT-98` |
| Affected ADRs | `ADR-0018`, `ADR-0002` |
| Capability IDs | `CMP`, `SYS`, `REP` capability areas affected; exact IDs to be mapped during MVP backlog conversion. |
| Implementation Impact | Medium |
| Database Impact | Migration Required |
| Security Impact | Security Gate Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede with a new ADR if legal/compliance review requires fixed retention, indefinite retention, or a different deletion model. |

### Details

Accepted that raw tachograph files remain immutable while retained, but retention is governed by configurable policy with platform minimums, fleet/jurisdiction overrides, legal hold support, and audited deletion or archival workflows.

The decision requires metadata, hash, parser references, audit trail, and report/evidence traceability to remain available even if the raw binary is deleted after retention expiry.

Also updated `SOT-21` so raw tachograph file retention is no longer listed as an unresolved open question.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Accept Timeline Versioning ADR

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-005 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Added `ADR-0017` to define Timeline Events as versioned derived records with controlled regeneration. |
| Reason | Timeline schema, compliance outcomes, evidence packs, Atlas explanations, and report snapshots need a stable rule for recalculation and historical traceability. |
| Affected Source Documents | `SOT-21`, `SOT-24`, `SOT-98` |
| Affected ADRs | `ADR-0017` |
| Capability IDs | `CMP`, `REP`, `INT` capability areas affected; exact IDs to be mapped during MVP backlog conversion. |
| Implementation Impact | Medium |
| Database Impact | Migration Required |
| Security Impact | Review Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede with a new ADR if timelines become fully immutable or are regenerated without retained versions. |

### Details

Accepted that Timeline Events are derived records that may be regenerated, but published timeline rows must not be silently overwritten.

Timeline generations must be versioned, previous versions must be retained when referenced by compliance outcomes, evidence packs, Atlas responses, review notes, or report exports, and exports must snapshot or reference the specific timeline version used.

Also updated `SOT-21` so the timeline versioning/regeneration question is no longer listed as unresolved.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Accept Parser Output Storage Boundary ADR

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-004 |
| Status | Implemented |
| Owner | Platform Architecture |
| Summary | Added `ADR-0016` to define the parser output boundary between relational records and JSONB payloads. |
| Reason | The MVP import pipeline and data model need a stable rule for what parser data is queryable relational data versus retained flexible parser payload. |
| Affected Source Documents | `SOT-21`, `SOT-24`, `SOT-98` |
| Affected ADRs | `ADR-0016` |
| Capability IDs | `CMP`, `SYS`, `REP` capability areas affected; exact IDs to be mapped during MVP backlog conversion. |
| Implementation Impact | Medium |
| Database Impact | Migration Required |
| Security Impact | Review Required |
| Testing Impact | New Test Coverage Required |
| Rollback Notes | Supersede with a new ADR if the platform moves to fully relational parser storage or JSON-only parser storage. |

### Details

Accepted a hybrid parser-output model:

- relational records for query-critical, compliance-critical, security-critical, report-critical, and audit-critical derived data
- JSONB payloads for raw parser payloads, diagnostics, warnings, errors, unsupported fields, vendor-specific fields, and future-compatible parser details

Also updated `SOT-21` so the parser output JSONB boundary is no longer listed as an unresolved open question.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed

## 2026-07-02 - Fix MVP Markdown Link Escaping

| Field | Value |
| --- | --- |
| Change ID | SOT-2026-07-02-003 |
| Status | Implemented |
| Owner | Product Architecture |
| Summary | Updated Markdown links to `SOT-10` so the MVP filename parentheses are URL-encoded. |
| Reason | Unescaped parentheses in Markdown link targets can be parsed incorrectly by tooling and automated link checks. |
| Affected Source Documents | `SOT-01`, `SOT-11`, `SOT-12`, `SOT-15`, `SOT-16`, `SOT-17`, `SOT-98` |
| Affected ADRs | None |
| Capability IDs | None |
| Implementation Impact | None |
| Database Impact | None |
| Security Impact | None |
| Testing Impact | None |
| Rollback Notes | Restore prior link targets only if the filename is renamed or the Markdown tooling convention changes. |

### Details

Updated related-document links pointing to `10 — Minimum Viable Product (MVP).md` to encode parentheses as `%28MVP%29`.

### Completion Checklist

- [x] Relevant source-of-truth document updated
- [x] Related documents updated
- [x] ADR created or updated if required
- [x] Implementation backlog updated if required
- [x] Database migration impact assessed
- [x] Security impact assessed
- [x] Test impact assessed


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
