# SEC-004 Zero Trust No-Migration Compatibility Audit

Date: 2026-07-05
Status: Complete as no-migration audit; implementation pending

## Purpose

`SEC-004` audits the current repository against the `SEC-003` Zero Trust organisation, site, and RBAC implementation matrix without writing migrations.

This is a compatibility check only. It identifies what can be treated as the current enforceable baseline and what must be designed before an organisation/site/RBAC migration is written.

## Source Inputs

- `docs/zero-trust-organisation-rbac-matrix-sec-003-2026-07-05.md`
- `docs/adr/ADR-0022_Zero_Trust_Multi_Tenant_Authorisation.md`
- `docs/adr/ADR-0023_Multi_Site_Organisation_Hierarchy.md`
- `docs/adr/ADR-0024_Role_Based_Access_Control.md`
- `docs/adr/ADR-0025_Tenant_Aware_Atlas_AI.md`
- `docs/adr/ADR-0026_Reporting_and_Organisational_Aggregation.md`
- `docs/adr/ADR-0027_Resource_Assignment_and_Transfer.md`
- `docs/security-rls-reconciliation-2026-07-02.md`
- `docs/live-schema-policy-verification-data-002-2026-07-02.md`
- `docs/storage-rls-hardening-sec-002-2026-07-03.md`
- `supabase/migrations`
- `supabase/functions`
- `src/contexts/AuthContext.tsx`
- `src/lib/tacho/api.ts`
- manager reporting/export components
- Atlas preview components

## Executive Result

The current codebase has a workable company-scoped compatibility baseline, but it is not yet an implementation of the accepted Zero Trust target model.

Current compatible baseline:

- `companies.id` / `company_id` is the only enforceable tenant/organisation key.
- `profiles.role` with `manager` and `driver` is the only implemented role boundary.
- Recent tachograph and timeline work uses scoped RLS/RPC checks around `company_id`, `get_my_company_id()`, `get_my_role()`, and driver ownership where applicable.
- `SEC-002` removed normal manager update/delete access to raw tachograph storage and moved browser metadata patching behind a scoped RPC.
- `process-tacho` validates either a configured trigger token or an authenticated manager whose company matches the import row before using service-role access.

Current blockers for the Zero Trust target:

- No `sites`, `site_memberships`, region/site-set model, or authoritative resource site assignments were found.
- No role catalogue, role assignments, role permissions, permission keys, permission versioning, or default-deny permission resolver were found.
- No central `actor_has_permission(...)`, `actor_can_access_driver(...)`, `actor_can_access_vehicle(...)`, or `actor_can_export(...)` helper exists yet.
- Service-role and security-definer paths are partially guarded by company/role checks, but not by operation-specific permission keys or a central security audit event model.
- Exports are mostly browser-generated CSV/download flows based on already-loaded scoped data; they are not separate audited `export` operations.
- Atlas in the app is currently a public marketing preview and feedback collector, not tenant-aware Atlas retrieval. Full Atlas must remain blocked until the security context and audit model exist.
- Support access sessions, platform admin support scope, and reason-coded support audit were not found.
- Runtime/live RLS verification is still needed before writing the permission foundation migration, because static migrations and live state have diverged historically.

Conclusion: proceed to `SEC-005` as a design task for an additive permission foundation. Do not write organisation/site/RBAC enforcement migrations until the design resolves compatibility with existing `company_id`, `profiles.role`, tacho RPCs, exports, background functions, and future site assignment history.

## SEC-003 Phase A Checklist Result

| SEC-003 Phase A Item | Audit Result | Status |
| --- | --- | --- |
| Inventory every table with `company_id`, `driver_id`, `vehicle_id`, and role checks | Static migration and client scan completed. Current business model is company-scoped, with driver/vehicle ownership checks in selected RLS/RPC/client paths. | Complete as static audit |
| Identify business tables without RLS | Static migrations explicitly enable RLS on core, document, invite, tachograph metadata, parser output/error, timeline, review, and several operational tables. Earlier live export showed broader RLS than static creation files alone. Re-verify live before migration. | Partial - live verification required |
| Identify RPCs and Edge Functions using service role or security-definer paths | Service-role Edge Functions and security-definer RPCs inventoried. Several are scoped by company/role, some are token/webhook/background only. | Complete as static audit |
| Map current `profiles.role = manager/driver` behaviour to target permission keys | Mapped conceptually below. Current roles are coarse compatibility roles only. | Complete as planning input |
| Produce a no-migration gap report | This document. | Complete |

## Current Compatibility Model

| SEC-003 Target | Current Codebase Position | Compatibility Decision |
| --- | --- | --- |
| Organisation | `companies.id` and `company_id` | Keep as current organisation scope. Do not add parallel `organisation_id` before backfill and compatibility views/functions are designed. |
| Site | No authoritative site model found | Site-scoped UX, reports, Atlas comparisons, and transfers remain blocked. New features may only use `site_id` if nullable and fail-closed until assignments exist. |
| Role | `profiles.role` with `manager` / `driver` | Treat as legacy coarse role. It can seed initial role assignments but must not be expanded ad hoc. |
| Permission | No permission catalogue found | Add permission keys and resolver before protected feature expansion. |
| Ownership | Mixed `auth.uid()`, `profiles.id`, `driver_id`, `vehicle_id`, `company_id` | Formalise owner rules before migration. Driver identity currently appears to be profile/user-aligned in several policies. |
| Operation | RLS policies and RPC names imply operations | Must become explicit permission keys: read, create, update, archive, export, admin, acknowledge. |
| Export | Browser CSV/downloads and storage downloads | Must become separately authorised and audited before production reporting/export features. |
| Atlas | Public marketing preview plus feedback table | Tenant-aware Atlas retrieval is not implemented and should remain blocked. |
| Support | No support access/session model found | Keep support access out of product scope until support sessions and audit exist. |

## Schema And RLS Observations

Static migration table creation scan found source-controlled creation for core and recent MVP tables including:

- `companies`, `profiles`, `driver_logs`
- `alerts`, `invoices`, `incidents`, `infringements`, `shifts`
- `driver_card_downloads`, `vehicle_unit_downloads`, `tachograph_processing_runs`
- `tachograph_activity_segments`, `tachograph_day_summaries`, `tachograph_findings`, `tachograph_technical_events`
- `driver_tacho_compliance_signals`, `driver_tacho_risk_signals`
- `tachograph_vehicle_motion_discrepancies`, `tachograph_reconciliation_items`
- `tachograph_finding_reviews`, `tachograph_finding_review_events`
- `tachograph_parser_outputs`, `tachograph_parser_errors`
- `timeline_generations`, `timeline_events`, `timeline_event_sources`, `timeline_gaps`, `daily_timeline_summaries`
- private runtime tables: `private.tacho_processing_runtime`, `private.broadcast_dispatch_runtime`

Static migrations explicitly enable RLS for:

- core identity/company tables
- document tables
- alerts, invoices, incidents, infringements, shifts
- driver invites and shift jobs
- `tachograph_files`
- `tachograph_finding_reviews`, `tachograph_finding_review_events`
- `tachograph_parser_outputs`, `tachograph_parser_errors`
- timeline generation/event/source/gap/daily summary tables

Important limitation:

- Earlier live verification on 2026-07-02 found RLS enabled for more tachograph tables than the static create-table scan alone proves.
- Because historical schema state includes live/manual or previously generated artefacts, `SEC-005` must start by refreshing live/local catalog evidence before migration SQL is finalised.

## Security Helper Observations

Current helper functions found:

- `public.get_my_company_id()`
- `public.get_my_role()`
- `public.get_auth_user_company()`
- `public.get_auth_user_role()`
- `public.is_manager_for_company_path(text)`
- `public.prevent_role_escalation()`
- storage object access helpers for driver/vehicle documents and defect photos

These are useful compatibility helpers, but they do not satisfy `SEC-003` target helpers.

Missing target helpers:

- `current_actor_company_id()` compatibility wrapper with target naming
- `actor_has_permission(permission_key, company_id, site_id)`
- `actor_can_access_driver(driver_id, operation)`
- `actor_can_access_vehicle(vehicle_id, operation)`
- `actor_can_export(scope, resource_type, resource_id)`
- `record_security_event(...)`

## Edge Function Audit

| Edge Function | Service Role | Guard Pattern Found | SEC-004 Assessment |
| --- | --- | --- | --- |
| `process-tacho` | Yes | Configured trigger token or authenticated manager with matching import company; service role then downloads raw object and writes derived rows. | Compatible for company-scoped MVP; needs permission key, background-job actor context, and audit before Zero Trust completion. |
| `configure-tacho-processing-runtime` | Yes | Requires `x-tacho-runtime-admin-token`; validates runtime URL/token patch. | Admin-token controlled; not tenant permission-aware. Keep as ops-only and audit later. |
| `create-driver-invite` | Yes | Authenticated actor profile; requires manager role and matching company. | Compatible baseline; needs `administration.membership.admin` and site/role assignment rules. |
| `accept-driver-invite` | Yes for linked-import processing trigger | Authenticated user accepts invite via RPC; service role can trigger processing for linked imports. | Needs explicit audit and target role assignment behaviour in permission model. |
| `remove-driver` | Yes | Authenticated requester profile; requires manager and same company as driver. | Compatible baseline; needs archive/retention, membership admin permission, and audit. |
| `create-fleet-checkout` | Yes | Authenticated profile company is loaded; service role updates company/subscription. | Billing/admin path; needs billing permission and audit before role catalogue. |
| `create-portal-session` | No service role | Uses user JWT and profile company to create Stripe portal session. | Lower risk; still needs billing permission later. |
| `document-expiry-check` | Yes | Background scan over all driver documents; no request auth/token visible. | Needs cron-only protection, scoped system actor, and audit/event log. |
| `recurring-pmi-alerts` | Yes | Uses cron token header and loops companies/vehicles. | Token protected; needs scoped system actor and site-aware alert rules later. |
| `send-broadcast` | Yes | Uses broadcast trigger token and row company id. | Token protected; needs event source validation, messaging permission model, recipient scope, and audit. |
| `stripe-webhook` | Yes | Stripe-signature path implied by headers and Stripe webhook handling. | External webhook path; must continue to verify signatures and map company metadata carefully. |
| `lookup-driver-invite` | No service role | Public invite lookup. | Keep limited to invite-safe fields only. |
| `request-account-deletion` | No service role | Authenticated user profile lookup. | Needs privacy/export/delete request audit model later. |

## RPC And Security-Definer Audit

Current security-definer and RPC surface includes:

- tacho import bundle reads
- company tacho signals
- driver and vehicle analysis bundles
- timeline bundle reads
- tacho candidate marking/archive/reprocess/purge flows
- driver-card pairing
- tachograph finding review save/acknowledgement
- invite lookup/acceptance
- tacho runtime configuration
- broadcast/tacho trigger dispatch
- storage object helper checks

Good compatibility patterns found:

- Many RPCs validate `public.get_my_role() = 'manager'` and `public.get_my_company_id() = p_company_id` before returning or mutating company-scoped data.
- Driver acknowledgement paths use driver role and ownership-style checks.
- Timeline read models are read-only and company-scoped for managers.
- Pairing/reprocess/archive flows update related timeline/tachograph rows with `company_id = p_company_id` predicates.

Gaps against `SEC-003`:

- RPCs do not use permission keys.
- RPCs do not resolve site scope.
- RPCs generally do not emit a central security/audit event.
- Several RPCs return warning payloads rather than throwing for unauthorised timeline reads; this may be acceptable for UI fallbacks but should be standardised.
- `security definer` functions need a final owner/grant review in live database before migration work.

## Frontend Access Audit

Current frontend patterns:

- `AuthContext` loads the user profile and relies on `profile.company_id` / `profile.role` for client routing and query parameters.
- Hooks and manager components commonly pass `companyId` from profile into Supabase `.eq('company_id', companyId)` or RPC `p_company_id` calls.
- Tachograph client API uses RPCs for sensitive bundle/read/review operations and direct reads for some review/import rows.
- Export/report screens generate CSV files in the browser from already-fetched rows.
- Atlas preview is a public marketing chatbot with static local knowledge and a feedback insert into `public_atlas_feedback`.

Important compatibility warning:

- Client-side `companyId` filters are convenience filters only. They are not security controls. RLS/RPC/server checks remain the source of enforcement.

## Export, Report, Download, And Cache Findings

Exports/downloads found:

- `ReportsAndExports.tsx` generates multiple browser CSV exports, including payroll, expenses, maintenance, documents, training, incidents, and other manager reports.
- `AuditTrail.tsx` generates audit/compliance CSV downloads client-side.
- `FuelMileageTracker.tsx` generates CSV export client-side.
- Some components download storage objects directly through Supabase storage paths, for example receipts/documents.
- Tachograph raw object browser deletion has been removed by `SEC-002`; tachograph storage read/upload is company-folder scoped for managers.

Gaps against `SEC-003`:

- Export is not a distinct audited operation.
- There is no `reporting.*.export` or domain-specific export permission check.
- Export files do not preserve permission context or evidence snapshot metadata.
- Browser-generated CSV exports inherit current UI scope but cannot prove immutable report/export state.
- No permission-version cache key strategy was found.
- No business-data cache system was found beyond normal client state and i18n localStorage; future React Query/cache usage must include tenant/site/permission context.

## Atlas Findings

Current Atlas implementation:

- Located under `src/components/marketing/atlas`.
- Uses static prepared marketing knowledge and simple matching.
- Collects feedback via `public_atlas_feedback`.
- Does not query tenant records, reports, tachograph evidence, drivers, vehicles, or documents.

SEC-003 decision:

- This marketing preview may remain separate from tenant-aware Atlas.
- Full Atlas must remain blocked until permission context, RLS-safe retrieval, source logging, prompt/response audit, and export/action boundaries exist.

## Findings

### SEC-004-F01 - Permission Foundation Missing

Severity: High
Markup: `[SECURITY-GATE]`

No role catalogue, role assignment, role permission, permission key, permission version, or default-deny permission resolver was found.

Impact:

- `profiles.role = manager/driver` cannot express organisation owner, operations director, regional manager, site manager, planner, workshop manager, fleet administrator, platform support, or limited export/report permissions.
- New features risk adding one-off role checks instead of converging on the accepted RBAC model.

Required next step:

- `SEC-005`: design additive permission foundation migration with role/permission tables, seed mappings from existing manager/driver roles, and central permission helper functions.

### SEC-004-F02 - Site Scope Not Implemented

Severity: High
Markup: `[SECURITY-GATE]`

No authoritative site, site membership, site assignment, region/site-set, driver site history, or vehicle site history model was found.

Impact:

- Site manager/regional manager behaviour cannot be enforced.
- Reporting aggregation cannot safely support site/region scopes.
- Atlas cannot safely compare sites.
- Resource transfer lifecycle cannot be implemented.

Required next step:

- Keep all site-scoped product work blocked until a site foundation and assignment history design exists.

### SEC-004-F03 - Service-Role And Background Jobs Need System Actor/Audit Model

Severity: High
Markup: `[SECURITY-GATE]`

Service-role functions exist for processing, runtime config, invites, billing, expiry checks, PMI alerts, broadcasts, and Stripe webhooks.

Some are well-guarded by user JWT, company checks, trigger tokens, or webhook contracts. However, they do not yet share a central system actor/audit model.

Impact:

- Background jobs can be correct operationally but still fail Zero Trust auditability.
- It is hard to prove which actor/request authorised a derived write, broadcast, expiry notice, export, or processing run.

Required next step:

- Define `record_security_event(...)`, scoped system actors, and audit fields before broadening background jobs.

### SEC-004-F04 - Export Is Not A Separate Permissioned Operation

Severity: High
Markup: `[SECURITY-GATE]`

Manager report/export screens generate CSVs directly in the browser from scoped data.

Impact:

- A user who can view a page can often export the same data.
- Export events are not centrally audited.
- Export outputs do not preserve evidence snapshots or permission context.

Required next step:

- Add export permission design before production report/export hardening: `reporting.report.export`, domain-specific export keys, export audit rows, short-lived signed URLs where applicable, and snapshot metadata.

### SEC-004-F05 - RPCs Are Company/Role Scoped But Not Permission/Site Scoped

Severity: Medium
Markup: `[SECURITY-GATE]`

Tachograph and timeline RPCs commonly validate `manager` plus matching `company_id`, and some driver paths validate own-driver access.

Impact:

- Current model is acceptable for MVP compatibility where all managers are whole-company managers.
- It is not compatible with site managers, planners, workshop managers, or restricted compliance/reporting roles.

Required next step:

- During `SEC-005`, map existing RPCs to permission keys and required scope. Do not duplicate bespoke role checks in new RPCs.

### SEC-004-F06 - Tenant-Aware Atlas Not Implemented And Must Stay Blocked

Severity: Medium
Markup: `[SECURITY-GATE]`, `[DEFER-P1]`

Current Atlas is a marketing preview. It does not access tenant data.

Impact:

- No current tenant-data leakage was found in Atlas preview.
- Full Atlas cannot be enabled safely until the caller context, retrieval permissions, source records, action permissions, and prompt/response audit model exist.

Required next step:

- Keep full Atlas retrieval/query tooling deferred until after permission foundation and RLS enforcement are tested.

### SEC-004-F07 - Support Access Model Missing

Severity: Medium
Markup: `[SECURITY-GATE]`

No support access session, platform admin support scope, reason code, time-bound grant, or support audit workflow was found.

Impact:

- Platform support must not be implemented through broad service-role/manual access.

Required next step:

- Either keep support access explicitly out of MVP or design support sessions as part of a later security migration.

## Current Safe Operating Rules

Until `SEC-005` and later migrations are complete:

- Treat `company_id` as the only enforceable organisation scope.
- Treat `manager` as whole-company manager only; do not add pseudo site/region behaviour to `profiles.role`.
- Do not introduce site-scoped UI claims unless the backend can enforce site scope.
- Do not add new protected features with direct client-side table writes unless RLS/RPC checks are documented.
- Do not add new export/report downloads without an export permission and audit plan.
- Do not enable tenant-aware Atlas retrieval.
- Do not add support impersonation or cross-tenant support tooling.
- Do not write a schema migration that introduces `organisation_id` in parallel with `company_id` without a compatibility and backfill plan.

## Recommended Next Task: SEC-005

`SEC-005`: design the additive permission foundation migration.

Scope for `SEC-005`:

- Define role catalogue and permission catalogue tables.
- Define role assignment shape for organisation scope first, with future site scope fields nullable/fail-closed.
- Define permission key seed set for current manager/driver behaviour.
- Define compatibility wrappers around existing `get_my_company_id()` and `get_my_role()`.
- Define `actor_has_permission(...)` and initial owner/export helper signatures.
- Define permission audit/security event table.
- Define migration/backfill approach from current `profiles.role`.
- Define tests for cross-tenant, role-boundary, export-denied, service-role, and RPC IDOR/BOLA cases.

Out of scope for `SEC-005`:

- Enforcing site-level filtering.
- Building site assignment history.
- Enabling Atlas retrieval.
- Building report export snapshots.
- Replacing every existing RPC in one migration.

## Acceptance Criteria

`SEC-004` is complete when:

- current organisation/company compatibility is verified from code and migrations
- missing site model is documented
- missing RBAC/permission catalogue is documented
- service-role and security-definer surfaces are inventoried
- export/report/download gaps are identified
- Atlas current state is classified
- support access gap is identified
- next task is defined without writing migrations

Schema/RLS implementation remains pending.
