# Security RLS Reconciliation

Date: 2026-07-02
Task: `SEC-001`
Scope: Static review of `supabase/migrations` against `docs/source-of-truth/22 - Security Model Specification.md`
Status: Complete as assessment; implementation gaps remain open.

## Executive Summary

The current Supabase security model partially aligns with `SOT-22`.

Strong areas:

- Core identity/company/profile tables have been iterated through multiple RLS hardening passes.
- Many operational tables have manager/driver scoped policies.
- Storage buckets are private and scoped by path for documents and tachograph files.
- Security-definer RPCs are used for complex permission-sensitive workflows.
- Later migrations include explicit hardening work for recursion, storage path policies, role escalation, invites, and tachograph review actions.

Primary gaps:

- Core tachograph import and derived analysis tables appear to have no explicit RLS enablement in migrations.
- Tachograph storage policies currently allow manager update and delete of raw tachograph files, conflicting with `ADR-0002` and `ADR-0018`.
- Security-definer tachograph RPCs are extensive and need a formal permission test matrix.
- Several sensitive workflows use delete/purge semantics that need reconciliation with the new evidence retention model.
- This was a static migration review, not a live `pg_policies` / `pg_class.relrowsecurity` verification.

Recommendation: do not add new compliance-intelligence schema until the core tachograph RLS gaps and storage delete/update conflicts are resolved.

## Source Documents Used

- `SOT-22` - Security Model Specification
- `SOT-21` - Data Model Specification
- `SOT-24` - Architecture Decision Records
- `ADR-0002` - Raw Tachograph Files Are Immutable
- `ADR-0012` - Service Role Access Must Be Wrapped By Permission Checks
- `ADR-0018` - Raw Tachograph File Retention Is Policy-Driven And Audited

## Static Inventory

The static migration scan found:

| Item | Count / Scope |
| --- | --- |
| Tables with explicit `ENABLE ROW LEVEL SECURITY` | 14 |
| Migration-level policy definitions found | 107 |
| Storage object policy definitions found | 22 |
| Security-definer function occurrences | 39 observed references |
| Service-role-only runtime config grants | 2 |

Tables with explicit RLS enablement found:

| Table | Migration |
| --- | --- |
| `companies` | `20251220174735_create_hourwise_schema.sql` |
| `profiles` | `20251220174735_create_hourwise_schema.sql` |
| `driver_logs` | `20251220174735_create_hourwise_schema.sql` |
| `invoices` | `20260105110830_add_individual_subscriptions.sql` |
| `driver_documents` | `20260418000000_fix_document_rls_policies.sql` |
| `vehicle_documents` | `20260418000000_fix_document_rls_policies.sql` |
| `infringements` | `20260420120000_add_infringements_table.sql` |
| `alerts` | `20260421000000_create_alerts_table.sql` |
| `shifts` | `20260422000000_create_shifts_table.sql` |
| `incidents` | `20260423000000_create_incidents_table.sql` |
| `driver_invites` | `20260614115811_security_hardening_shared_database.sql` |
| `shift_jobs` | `20260614115811_security_hardening_shared_database.sql` |
| `tachograph_finding_reviews` | `20260621123000_add_tacho_finding_review_persistence.sql` |
| `tachograph_finding_review_events` | `20260621123000_add_tacho_finding_review_persistence.sql` |

## Policy Coverage By Area

| Area | Current Evidence | Alignment With `SOT-22` | Status |
| --- | --- | --- | --- |
| Identity/profile access | Multiple profile policy hardening migrations; final hardening uses own-profile and company-profile policies. | Matches own-user and company-scoped access intent. | Partial - verify live final policies. |
| Company/tenant boundary | Final company policy appears scoped to companies associated with current user's profile. | Matches tenant isolation principle. | Partial - verify live final policy and company creation rules. |
| Driver self-scope | Driver logs, shifts, incidents, infringements, and tacho finding reviews include driver self-scope policies. | Matches driver self-scope requirement. | Partial. |
| Manager company scope | Documents, alerts, shifts, incidents, infringements, driver invites, shift jobs, and tacho review records have manager/company policies. | Directionally matches role-scoped access. | Partial. |
| Core tachograph imports and derived records | `tachograph_processing_runs`, `driver_card_downloads`, `vehicle_unit_downloads`, `tachograph_activity_segments`, `tachograph_day_summaries`, `tachograph_findings`, `tachograph_technical_events`, `driver_tacho_compliance_signals`, `driver_tacho_risk_signals`, `tachograph_vehicle_motion_discrepancies`, and `tachograph_reconciliation_items` are created without explicit RLS enablement found in this scan. | `SOT-22` expects RLS on tenant-owned tables and compliance/evidence data. | Gap. |
| Tachograph reviews | `tachograph_finding_reviews` and `tachograph_finding_review_events` have RLS and manager/driver read policies. | Matches review visibility expectations. | Partial - write actions happen through RPC. |
| File storage | Private storage policies exist for driver documents, vehicle documents, defect photos, and tachograph files. | Matches private bucket/path-scoped principle. | Partial. |
| Raw tachograph file immutability | Tachograph storage bucket has manager `UPDATE` and `DELETE` policies on `storage.objects`. | Conflicts with `ADR-0002` and `ADR-0018` unless wrapped by retention workflow. | Gap. |
| Service role / security-definer usage | Tacho processing, runtime config, invite, pairing, archive, reprocess, purge, and review workflows use security-definer functions and service-role edge functions. | Allowed only when wrapped by permission checks and tests. | Review required. |
| Support access | No dedicated support session/access table found in this pass. | `SOT-22` expects controlled and logged support access. | Gap / not implemented. |
| Security testing | Test scripts exist for tacho rules, but no explicit RLS/cross-tenant test suite found in `package.json`. | `SOT-22` requires permission, RLS, API ID tampering, report export, file download, Atlas, and cross-tenant regression tests. | Gap. |

## High-Priority Findings

### SEC-RLS-001 - Core Tachograph Tables Need RLS

Severity: High
Markup: `[SECURITY-GATE]`

Core tachograph import and derived analysis tables appear to be tenant-owned but do not have explicit RLS enablement in migrations reviewed here.

Affected tables include:

- `tachograph_files`
- `tachograph_processing_runs`
- `driver_card_downloads`
- `vehicle_unit_downloads`
- `tachograph_activity_segments`
- `tachograph_day_summaries`
- `tachograph_findings`
- `tachograph_technical_events`
- `driver_tacho_compliance_signals`
- `driver_tacho_risk_signals`
- `tachograph_vehicle_motion_discrepancies`
- `tachograph_reconciliation_items`

Required next step:

- Add or verify RLS for every tenant-owned tachograph table before expanding compliance-intelligence schema.

### SEC-RLS-002 - Tachograph Storage Delete/Update Conflicts With Raw Evidence Decisions

Severity: High
Markup: `[SECURITY-GATE]`

`20260618210500_add_tachograph_storage_bucket.sql` creates manager `UPDATE` and `DELETE` policies for `tachograph-files` storage objects.

This conflicts with:

- `ADR-0002` - raw tachograph files are immutable
- `ADR-0018` - raw tachograph retention is policy-driven and audited
- `SOT-22` - raw tachograph files are protected evidence

Required next step:

- Replace direct manager storage update/delete with controlled retention/archive workflows.
- If deletion remains possible, it must be performed through audited server-side policy checks, not broad direct storage object delete.

### SEC-RLS-003 - Security-Definer RPCs Need Permission Test Coverage

Severity: High
Markup: `[SECURITY-GATE]`

Security-definer RPCs are used extensively for:

- tacho analysis bundles
- tacho import bundles
- tacho runtime config
- driver invites
- tacho card pairing
- candidate review/archive
- reprocess/purge controls
- finding review persistence
- driver acknowledgement

This pattern is acceptable only if every RPC validates:

- authenticated user
- tenant/company scope
- role
- target record ownership
- action permission
- service role bypass rules

Required next step:

- Create an RPC permission matrix and add automated tests for cross-tenant and role-boundary cases.

### SEC-RLS-004 - Purge/Delete Workflows Conflict With Evidence Retention Unless Guarded

Severity: Medium
Markup: `[SECURITY-GATE]`

Several migrations include delete/purge workflows for tachograph derived data and card reads.

These may be valid for reprocessing or candidate cleanup, but after `ADR-0017` and `ADR-0018`, delete semantics need clearer boundaries:

- derived timeline/compliance/report evidence must not disappear silently
- raw file deletion must be policy-driven and audited
- reprocessing should supersede generated records rather than destroy evidence needed for reports

Required next step:

- Reconcile purge/reprocess functions with timeline versioning and raw file retention decisions.

### SEC-RLS-005 - No Dedicated Support Access Model Found

Severity: Medium
Markup: `[SECURITY-GATE]`

`SOT-22` expects controlled and logged support access. This scan did not find a dedicated support session/access table or complete support audit workflow.

Required next step:

- Keep support access out of MVP or implement a formal support access model before enabling support impersonation/admin access.

## Alignment With `SOT-22` Requirements

| `SOT-22` Requirement | Current State | Reconciliation Result |
| --- | --- | --- |
| RLS protects all tenant-owned tables | Core app tables partially covered; core tachograph tables appear uncovered. | Not complete. |
| Driver self-scope policies | Present for several driver-owned resources. | Partially complete. |
| API must not trust client context | Some RPCs check role/company; service-role edge functions need full audit. | Needs test coverage. |
| Service role wrapped by permission checks | Some checks exist; no consolidated matrix. | Needs review. |
| Raw tachograph files protected | Private bucket exists; update/delete policies conflict with immutability. | Needs fix. |
| Report exports not public | Reporting implementation not fully present in this scan. | Future gate. |
| Support access controlled/logged | No dedicated model found. | Not complete. |
| Permission/RLS tests | No explicit RLS test suite found. | Not complete. |
| Cross-tenant regression tests | No explicit suite found. | Not complete. |

## Recommended Remediation Backlog

1. `SEC-002`: Verify live Supabase RLS state with `pg_policies`, `pg_class.relrowsecurity`, grants, and storage policies.
2. `SEC-003`: Add RLS policies for core tachograph import and derived tables.
3. `SEC-004`: Replace direct tachograph storage update/delete policies with audited retention/archive RPCs.
4. `SEC-005`: Build RPC permission matrix for all security-definer tacho functions.
5. `SEC-006`: Add cross-tenant RLS tests for profiles, companies, tachograph imports, derived tacho records, reviews, and storage objects.
6. `SEC-007`: Reconcile tacho purge/reprocess functions with `ADR-0017` and `ADR-0018`.
7. `SEC-008`: Define support access model or explicitly mark support access deferred from MVP.

## Acceptance Criteria For Security Gate

Before implementing new compliance-intelligence schema:

- Every tenant-owned table has RLS enabled or a documented reason for being server-only.
- Every RLS table has select/insert/update/delete policies appropriate to its use.
- Every security-definer function has an owner, purpose, permission preconditions, and tests.
- Raw tachograph storage cannot be updated or deleted directly by ordinary manager users.
- Cross-tenant tests exist and fail if fleet/company IDs are tampered with.
- Driver self-scope tests exist for driver-visible records.
- Storage object path tests exist for private buckets.
- Service-role edge functions perform explicit permission checks before acting on user-supplied IDs.

## Limitations

This reconciliation is based on static migration files only.

It does not prove the current live database state because:

- policies may have been changed manually
- migration order may differ between local and hosted environments
- dropped policies are hard to reason about from static history alone
- grants and ownership should be verified against the actual database

The next security task should query the live/local database catalog directly.
