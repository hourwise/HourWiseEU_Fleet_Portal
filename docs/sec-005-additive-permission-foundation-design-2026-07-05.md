# SEC-005 Additive Permission Foundation Design

Date: 2026-07-05
Status: Complete as migration design; schema/RLS implementation pending

## Purpose

`SEC-005` defines the additive permission foundation needed before HourWise replaces coarse `profiles.role` checks with the Zero Trust model from `SEC-003` and `SEC-004`.

This is a design document, not an applied migration. It defines the target tables, compatibility rules, helper functions, seed permissions, backfill route, test plan, and rollout gates for a future migration.

## Inputs

- `docs/zero-trust-organisation-rbac-matrix-sec-003-2026-07-05.md`
- `docs/sec-004-zero-trust-no-migration-compatibility-audit-2026-07-05.md`
- `docs/adr/ADR-0022_Zero_Trust_Multi_Tenant_Authorisation.md`
- `docs/adr/ADR-0023_Multi_Site_Organisation_Hierarchy.md`
- `docs/adr/ADR-0024_Role_Based_Access_Control.md`
- `docs/adr/ADR-0025_Tenant_Aware_Atlas_AI.md`
- `docs/adr/ADR-0026_Reporting_and_Organisational_Aggregation.md`
- `docs/adr/ADR-0027_Resource_Assignment_and_Transfer.md`
- `docs/adr/ADR-0028_Preventive_Maintenance_Asset_Compliance_Rule_Engine.md`
- `supabase/migrations/20260614115811_security_hardening_shared_database.sql`
- Existing tachograph/timeline/security documents and migrations

## Executive Decision

The first permission foundation migration should be additive and compatibility-first.

It should not rename `company_id`, remove `profiles.role`, introduce enforced site filtering, or rewrite all RLS/RPCs in one step.

It should add:

- role catalogue
- permission catalogue
- role-permission grants
- user role assignments scoped to `company_id`
- security/audit event table
- compatibility helper functions
- permission helper functions
- seed data mapping existing `manager` and `driver` behaviour
- tests proving cross-tenant and role-boundary behaviour before any enforcement replacement

It should not yet add:

- destructive `organisation_id` replacement
- enforced site scope
- Atlas retrieval
- report export snapshots
- support impersonation
- ADR-0028 maintenance-rule tables

## Compatibility Rules

| Rule | Decision | Reason |
| --- | --- | --- |
| Keep `companies.id` as organisation id | Yes | Existing data, RLS, storage paths, RPCs, and app code depend on `company_id`. |
| Keep `profiles.company_id` | Yes | It remains the compatibility membership source until memberships are backfilled and verified. |
| Keep `profiles.role` | Yes, legacy only | It seeds role assignments and remains a fallback during phased rollout. Do not add new role values to it. |
| Add `organisation_id` now | No | Would create parallel tenant keys before compatibility is proven. |
| Add site enforcement now | No | `SEC-004` found no authoritative site/resource assignment model. Site fields may be planned but must fail closed. |
| Replace all RLS now | No | Existing policies and RPCs are company scoped and should be migrated incrementally after tests exist. |
| Make export a separate permission | Yes | Export must stop being an automatic side effect of read permission. |
| Add audit event model now | Yes | Permission, export, support, Atlas, and service-role decisions need a shared event sink. |

## Proposed Additive Tables

### `security_roles`

Purpose: stable role catalogue.

Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `key` | text primary key | Stable role key, for example `organisation_owner`. |
| `name` | text | Human-readable label. |
| `description` | text | Admin/help text. |
| `scope_level` | text | `platform`, `organisation`, `site_set`, `site`, `own`. |
| `parent_role_key` | text nullable | Optional inheritance target; avoid complex inheritance in first enforcement. |
| `is_system` | boolean | Seed/system roles cannot be deleted by tenant admins. |
| `is_assignable` | boolean | Whether normal admins can assign the role. |
| `created_at` | timestamptz | Default now. |
| `updated_at` | timestamptz | Updated by trigger. |

Initial rows:

- `organisation_owner`
- `operations_director`
- `regional_manager`
- `site_manager`
- `planner`
- `workshop_manager`
- `fleet_administrator`
- `driver`
- `platform_admin`
- `system_job`

### `security_permissions`

Purpose: stable permission catalogue.

Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `key` | text primary key | Pattern `<area>.<resource>.<operation>`. |
| `area` | text | Example `tachograph`, `drivers`, `reporting`. |
| `resource` | text | Example `import`, `profile`, `report`. |
| `operation` | text | `read`, `create`, `update`, `archive`, `export`, `admin`, `acknowledge`. |
| `description` | text | Plain-language meaning. |
| `risk_level` | text | `low`, `medium`, `high`, `critical`. |
| `requires_audit` | boolean | True for export/admin/support/Atlas/service-role sensitive actions. |
| `created_at` | timestamptz | Default now. |

### `security_role_permissions`

Purpose: maps roles to allowed permission keys.

Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `role_key` | text references `security_roles(key)` | Role. |
| `permission_key` | text references `security_permissions(key)` | Permission. |
| `effect` | text | Start with `allow`; reserve `deny` for future overrides. |
| `scope_level` | text | Maximum scope this grant can use. |
| `created_at` | timestamptz | Default now. |

Primary key:

- `(role_key, permission_key, scope_level)`

### `security_role_assignments`

Purpose: assigns users to roles within the current company/organisation compatibility scope.

Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Default generated uuid. |
| `user_id` | uuid references `profiles(id)` | User/profile subject. |
| `company_id` | uuid references `companies(id)` | Current organisation scope. |
| `role_key` | text references `security_roles(key)` | Assigned role. |
| `scope_level` | text | `organisation` for first migration. Site scopes later. |
| `site_id` | uuid nullable | Reserved for future site foundation; no enforcement until site model exists. |
| `status` | text | `active`, `suspended`, `revoked`. |
| `source` | text | `legacy_profile_backfill`, `invite`, `admin`, `system`. |
| `starts_at` | timestamptz | Default now. |
| `ends_at` | timestamptz nullable | Optional expiry. |
| `created_by_user_id` | uuid nullable | Actor creating assignment. |
| `created_at` | timestamptz | Default now. |
| `updated_at` | timestamptz | Updated by trigger. |

Indexes:

- `(user_id, company_id, status)`
- `(company_id, role_key, status)`
- `(company_id, site_id, status)` for future site work

Constraint:

- For `scope_level = 'organisation'`, `site_id` must be null.
- For any future `site` or `site_set` assignment, fail closed until site foundation exists.

### `security_permission_audit_events`

Purpose: append-only security event sink for permission decisions and sensitive actions.

Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid primary key | Default generated uuid. |
| `created_at` | timestamptz | Default now. |
| `actor_user_id` | uuid nullable | Human actor, if present. |
| `actor_kind` | text | `user`, `system_job`, `webhook`, `support`, `unknown`. |
| `company_id` | uuid nullable | Organisation/company scope. |
| `site_id` | uuid nullable | Reserved for future site scope. |
| `permission_key` | text nullable | Permission being checked or used. |
| `decision` | text | `allowed`, `denied`, `not_applicable`, `error`. |
| `reason` | text | Short reason code. |
| `resource_type` | text nullable | Example `tachograph_import`, `driver`, `report`. |
| `resource_id` | uuid nullable | Target id where applicable. |
| `operation` | text nullable | Operation attempted. |
| `request_id` | text nullable | Edge Function/request correlation id if available. |
| `metadata` | jsonb | Non-sensitive structured details. |

Rules:

- Append-only in normal operation.
- No normal authenticated update/delete policy.
- Service-role/system writes allowed through controlled functions only.
- Avoid storing raw prompts, personal documents, or full export payloads unless separately approved.

### Optional Compatibility View: `organisation_memberships_v`

Purpose: expose current profile membership without introducing destructive schema.

Shape:

- `user_id`
- `company_id`
- `status`
- `legacy_role`
- `source`

Source:

- `profiles` where `company_id is not null` and `is_active` is true when available.

Decision:

- A view is safer than a new authoritative membership table for the first migration.
- A physical `organisation_memberships` table can be added later after invites, removals, billing, and support access semantics are finalised.

## Initial Permission Seed Set

This seed set covers current MVP behaviour and creates room for later feature-specific enforcement.

| Permission Key | Risk | Audit | Notes |
| --- | --- | --- | --- |
| `administration.membership.admin` | high | true | Invite/remove/manage users. |
| `administration.role.admin` | critical | true | Manage role assignments; not granted to normal managers initially. |
| `drivers.profile.read` | medium | false | Read driver profile data. |
| `drivers.profile.update` | high | true | Update driver profile data. |
| `drivers.profile.archive` | high | true | Archive/remove driver. |
| `drivers.own_profile.read` | low | false | Driver self-read. |
| `drivers.own_profile.update` | medium | true | Limited driver self-update. |
| `vehicles.record.read` | medium | false | Read vehicles. |
| `vehicles.record.create` | medium | true | Create vehicles. |
| `vehicles.record.update` | medium | true | Update vehicles. |
| `vehicles.record.archive` | high | true | Archive vehicles. |
| `tachograph.import.create` | high | true | Upload/import metadata creation. |
| `tachograph.import.read` | high | false | Read tachograph import metadata. |
| `tachograph.import.update` | high | true | Patch review/metadata fields. |
| `tachograph.import.archive` | high | true | Archive candidate/import metadata. |
| `tachograph.raw_file.read` | high | true | Read raw storage objects if exposed. |
| `tachograph.raw_file.export` | critical | true | Download raw files outside normal UI. |
| `tachograph.processing.run` | high | true | Trigger/reprocess parser. |
| `compliance.timeline.read` | high | false | Read generated timeline/compliance evidence. |
| `compliance.finding.review` | high | true | Manager review actions. |
| `compliance.finding.acknowledge` | medium | true | Driver acknowledgement. |
| `reporting.report.read` | medium | false | Preview reports. |
| `reporting.report.export` | critical | true | Export report/evidence. |
| `documents.record.read` | high | false | Read document metadata. |
| `documents.record.create` | high | true | Upload/create document metadata. |
| `documents.record.update` | high | true | Update document metadata. |
| `documents.record.archive` | high | true | Archive/delete document metadata. |
| `messaging.thread.read` | medium | false | Read permitted message threads. |
| `messaging.message.create` | medium | true | Send messages. |
| `atlas.conversation.create` | high | true | Start tenant-aware Atlas conversation. |
| `atlas.fleet_summary.read` | high | true | Atlas retrieval over tenant records. |
| `support.session.admin` | critical | true | Future support session management; not granted initially. |

## Initial Role Grants

### `organisation_owner`

Initial intent:

- All organisation-scoped permissions except `support.session.admin` and unrestricted `platform_admin` behaviour.
- Can administer membership and role assignment after dual-control rules are considered.

SEC-005 seed recommendation:

- Do not auto-create organisation owners from legacy data unless there is a reliable owner source.
- Backfill legacy `manager` users to `fleet_administrator`, not `organisation_owner`, unless `companies.created_by` matches a manager profile and the business accepts that mapping.

### `fleet_administrator`

Backfill target for legacy `profiles.role = 'manager'`.

Grant initially:

- `drivers.profile.read`
- `drivers.profile.update`
- `drivers.profile.archive`
- `vehicles.record.read`
- `vehicles.record.create`
- `vehicles.record.update`
- `vehicles.record.archive`
- `tachograph.import.create`
- `tachograph.import.read`
- `tachograph.import.update`
- `tachograph.import.archive`
- `tachograph.processing.run`
- `compliance.timeline.read`
- `compliance.finding.review`
- `documents.record.read`
- `documents.record.create`
- `documents.record.update`
- `documents.record.archive`
- `reporting.report.read`
- `messaging.thread.read`
- `messaging.message.create`

Do not grant by default:

- `tachograph.raw_file.export`
- `reporting.report.export`
- `administration.role.admin`
- `support.session.admin`
- `atlas.fleet_summary.read`

Rationale:

- This preserves most current manager behaviour while separating exports, role administration, support, and Atlas into explicit future decisions.

### `driver`

Backfill target for legacy `profiles.role = 'driver'`.

Grant initially:

- `drivers.own_profile.read`
- `drivers.own_profile.update`
- `compliance.timeline.read` limited by owner helper
- `compliance.finding.acknowledge`
- `messaging.thread.read` limited to participant/own scope later
- `messaging.message.create` limited to participant/own scope later

Do not grant by default:

- other driver profile reads
- company-wide tachograph reads
- raw tachograph export
- report export
- Atlas fleet summary

### Other Roles

Seed roles but grant minimal/no permissions until site and feature scopes exist:

- `operations_director`
- `regional_manager`
- `site_manager`
- `planner`
- `workshop_manager`
- `platform_admin`
- `system_job`

Rationale:

- It is useful to reserve stable role keys, but dangerous to imply behaviour before site/resource assignments and tests exist.

## Helper Function Contracts

### `current_actor_company_id()`

Purpose:

- Compatibility alias around current `public.get_my_company_id()`.

Contract:

- Returns the current user's `company_id` from `profiles`.
- Returns null if unauthenticated or no company.
- Stable, security definer, fixed search path.

### `current_actor_legacy_role()`

Purpose:

- Compatibility alias around current `public.get_my_role()`.

Contract:

- Returns legacy `profiles.role` as text.
- Used only as fallback and seed bridge.

### `actor_has_permission(p_permission_key text, p_company_id uuid, p_site_id uuid default null)`

Purpose:

- Central permission resolver.

Contract:

- Default deny on null actor, null permission, null company, unknown permission, inactive assignment, expired assignment, unknown role, or site mismatch.
- For SEC-005 first migration, support `organisation` scope only.
- If `p_site_id` is not null before site foundation exists, return false unless a future explicit compatibility rule is added.
- Check active rows in `security_role_assignments` joined to `security_role_permissions`.
- Treat `profiles.role` fallback only during transitional rollout if a backfill gap exists. Prefer failing tests if fallback is still needed after backfill verification.

### `actor_can_access_driver(p_driver_id uuid, p_operation text)`

Purpose:

- Resolve driver owner/company access.

First contract:

- Load target driver profile by `id = p_driver_id` and role `driver` where available.
- If current actor is the same user/profile and operation is own read/update/acknowledge, allow only through driver own permission.
- If manager/admin path, require `drivers.profile.<operation>` for target company.
- Return false on missing driver, company mismatch, unknown operation, or future site mismatch.

### `actor_can_access_vehicle(p_vehicle_id uuid, p_operation text)`

Purpose:

- Resolve vehicle/company access.

First contract:

- Load target vehicle by id and company.
- Require `vehicles.record.<operation>` for target company.
- Return false on missing vehicle, company mismatch, or future site mismatch.

### `actor_can_export(p_company_id uuid, p_resource_type text, p_resource_id uuid, p_permission_key text)`

Purpose:

- Preflight export/download actions.

First contract:

- Require an export permission key.
- Require `actor_has_permission(...)` for company scope.
- Record an audit event for allow and deny decisions.
- Return boolean or raise a controlled exception depending on RPC use.

### `record_security_event(...)`

Purpose:

- Shared audit insertion function.

First contract:

- Insert into `security_permission_audit_events` with fixed search path.
- Callable by authenticated where safe, but should not allow forged actor ids. Prefer deriving `actor_user_id` from `auth.uid()` unless called by service role with explicit actor metadata.
- Return inserted event id.

## Backfill Strategy

Step 1: Create catalogue tables and seed roles/permissions.

Step 2: Backfill role assignments from existing profiles:

| Legacy Profile State | New Assignment |
| --- | --- |
| `role = 'manager'` and `company_id is not null` | `fleet_administrator`, `scope_level = 'organisation'`, `source = 'legacy_profile_backfill'` |
| `role = 'driver'` and `company_id is not null` | `driver`, `scope_level = 'organisation'`, `source = 'legacy_profile_backfill'` |
| `company_id is null` | no assignment; requires onboarding/account cleanup |
| inactive profile | no active assignment unless status semantics are confirmed |

Step 3: Compare counts:

- count active company managers vs fleet administrator assignments
- count active company drivers vs driver assignments
- list profiles without assignments
- list assignments without matching active profile

Step 4: Keep existing `profiles.role` policies active until tests prove assignment checks match or deliberately narrow legacy behaviour.

Step 5: Only then start replacing selected RPCs/policies with `actor_has_permission(...)`.

## Migration Safety Rules

- No destructive changes in the first migration.
- No updates to `profiles.role` values except maybe metadata comments/documentation.
- No removal of existing RLS policies in the foundation migration.
- No change to tachograph storage path format.
- No new `organisation_id` columns.
- No site enforcement.
- All new tables must have RLS enabled before deployment.
- All security-definer functions must set `search_path` explicitly.
- All grants must be explicit; revoke public/anon where not needed.
- Any broad service-role writes must be paired with audit event capability before enforcement work.

## RLS Design For New Tables

### `security_roles`

Read:

- Authenticated users may read non-sensitive role catalogue rows.

Write:

- No tenant user write in first migration.
- Service role / migration only.

### `security_permissions`

Read:

- Authenticated users may read non-sensitive permission catalogue rows.

Write:

- Service role / migration only.

### `security_role_permissions`

Read:

- Authenticated users may read catalogue grants if needed for UI explanations.

Write:

- Service role / migration only in first migration.

### `security_role_assignments`

Read:

- User can read own active assignments.
- Fleet administrator/organisation owner can read company assignments only after permission helper exists and tests pass.
- In first migration, prefer helper/RPC reads rather than broad direct table reads.

Write:

- Service role / controlled RPC only.
- No direct browser insert/update/delete.

### `security_permission_audit_events`

Read:

- No broad direct read in first migration.
- Future audit UI must use scoped RPC and permission key.

Write:

- Controlled function only.

Update/delete:

- None for normal authenticated users.

## Initial RPC/Feature Mapping

| Existing Area | Current Guard | Future Permission Key |
| --- | --- | --- |
| Tacho upload metadata | manager plus company | `tachograph.import.create` |
| Tacho metadata read | manager plus company | `tachograph.import.read` |
| Tacho metadata patch | manager plus company RPC | `tachograph.import.update` |
| Tacho processing/reprocess | manager plus company or trigger token | `tachograph.processing.run` plus system actor audit |
| Timeline bundle read | manager plus company | `compliance.timeline.read` |
| Driver finding acknowledgement | driver own review | `compliance.finding.acknowledge` |
| Manager finding review | manager plus company | `compliance.finding.review` |
| Driver invite create | manager plus company | `administration.membership.admin` |
| Driver remove/archive | manager plus company | `administration.membership.admin` and `drivers.profile.archive` |
| Browser report preview | manager plus company | `reporting.report.read` |
| Browser CSV export | page-level access | `reporting.report.export` or domain export key |
| Raw file download | manager storage select | `tachograph.raw_file.export` if exposed as export |
| Broadcast/message send | trigger token/service role | `messaging.message.create` plus system actor audit |
| Document expiry check | service role background | system actor audit; no user permission |
| Atlas preview | public/static | no tenant permission; keep separated from tenant Atlas |

## Live/Local Catalog Refresh Requirement

Before writing the migration SQL, refresh catalog evidence for:

- existing tables and columns
- current RLS enabled/forced flags
- current policies
- current function owners
- current function grants
- current security-definer functions and search paths
- current storage buckets and storage object policies
- current role values and profile counts by company

If Docker/local Supabase is unavailable, use hosted Supabase dashboard SQL export as done for `DATA-002` and record the limitation.

## Test Plan

### Static Migration Tests

Add tests or script checks that assert:

- all new security tables enable RLS
- security-definer functions set explicit `search_path`
- anon/public grants are revoked where required
- seed permission keys match the documented list
- no `organisation_id` destructive change is introduced
- no site enforcement is activated in `SEC-005`

### Database Behaviour Tests

Required cases:

| Test ID | Scenario | Expected Result |
| --- | --- | --- |
| `SEC-005-T01` | Legacy manager backfilled to `fleet_administrator`. | Active organisation-scoped assignment exists. |
| `SEC-005-T02` | Legacy driver backfilled to `driver`. | Active organisation-scoped assignment exists. |
| `SEC-005-T03` | Manager from company A checks company A `tachograph.import.read`. | Allowed after backfill. |
| `SEC-005-T04` | Manager from company A checks company B `tachograph.import.read`. | Denied. |
| `SEC-005-T05` | Driver checks `drivers.own_profile.read` for self. | Allowed. |
| `SEC-005-T06` | Driver checks another driver's profile. | Denied. |
| `SEC-005-T07` | Fleet administrator checks `reporting.report.export`. | Denied by default. |
| `SEC-005-T08` | Fleet administrator checks `tachograph.raw_file.export`. | Denied by default. |
| `SEC-005-T09` | Unknown permission key is checked. | Denied and auditable if called through audit path. |
| `SEC-005-T10` | Non-null `site_id` is passed before site foundation. | Denied/fail closed. |
| `SEC-005-T11` | Permission-denied export preflight runs. | Denied audit event is recorded. |
| `SEC-005-T12` | Service-role background job records system event with company context. | Audit event exists with actor kind `system_job`. |
| `SEC-005-T13` | Role assignment changes. | Audit event exists and permission version/cache invalidation path is identified. |
| `SEC-005-T14` | Direct browser write to role assignments. | Denied. |
| `SEC-005-T15` | Direct browser update/delete of audit events. | Denied. |

### RPC Regression Tests

For each converted RPC, test:

- missing actor
- wrong company id
- missing permission
- wrong role assignment
- valid role assignment
- target record not in actor company
- export attempted with read but without export permission

Do not convert all RPCs in `SEC-005`; define the standard and convert in later enforcement tasks.

## Rollout Phases

### Phase 1: Catalogue And Backfill

- Add tables.
- Add seed roles and permissions.
- Backfill assignments from `profiles.role`.
- Add helper functions.
- Add audit function/table.
- Add tests for helper behaviour.
- Do not replace existing RLS/RPCs yet.

### Phase 2: Shadow Checks

- Add optional shadow permission checks to selected RPCs that log allow/deny comparison without changing behaviour.
- Compare legacy `manager/company` decisions to new assignment decisions.
- Fix backfill gaps.

### Phase 3: First Enforcement Swap

Candidate low-risk swaps:

- `patch_tachograph_import_metadata` -> `tachograph.import.update`
- timeline bundle read RPCs -> `compliance.timeline.read`
- tacho finding review RPC -> `compliance.finding.review`

Acceptance:

- Legacy and new permission decisions match intended MVP behaviour.
- Cross-tenant and role-boundary tests pass.

### Phase 4: Export And Background Audit

- Add export preflight RPC/function.
- Add report/raw-file export denied-by-default tests.
- Add system actor audit for background functions.

### Phase 5: Site Foundation Planning

- Only after Phase 1-4 are stable, design site tables, site memberships, and driver/vehicle assignment history.

## Open Questions Before Migration SQL

1. Should `companies.created_by` become the initial `organisation_owner`, or should all legacy managers start as `fleet_administrator` until ownership is manually confirmed?
2. Should `reporting.report.export` be granted to existing managers during beta, or remain denied until an explicit admin grant exists?
3. Should raw tachograph file download be exposed at all in MVP, or remain server-mediated/internal only?
4. Should audit events be visible in the existing Audit Trail UI, or only through an admin/security report later?
5. Should role assignments reference `profiles.id`, `profiles.user_id`, or both? Existing code uses both patterns and needs live catalog confirmation.
6. What is the first RPC selected for enforcement swap after shadow checks?

## Recommended Next Task

`SEC-006`: refresh live/local catalog evidence and turn this design into a candidate migration/test plan.

`SEC-006` should produce:

- live catalog evidence snapshot
- candidate migration filename and SQL outline
- seed role/permission list validated against current profile data
- backfill count expectations
- test fixture requirements
- rollout/rollback plan

Do not implement site foundation, Atlas retrieval, report export snapshots, support sessions, or ADR-0028 maintenance-rule schema before the permission foundation is proven.

## Acceptance Criteria

`SEC-005` is complete as a design gate when:

- additive table design is documented
- compatibility rules are documented
- permission seed set is documented
- role grant/backfill plan is documented
- helper function contracts are documented
- audit event model is documented
- RLS strategy for new tables is documented
- RPC/feature permission mapping is documented
- live/local catalog refresh requirement is documented
- test plan is documented
- next implementation planning task is defined

Schema/RLS implementation remains pending.
