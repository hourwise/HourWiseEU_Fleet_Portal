# SEC-003 Zero Trust Organisation, Site, And RBAC Implementation Matrix

Date: 2026-07-05
Status: Complete as implementation-control document; schema/RLS implementation pending

## Purpose

`SEC-003` converts the accepted organisation/security ADRs into a concrete implementation matrix before new protected feature work proceeds.

Inputs:

- `docs/adr/ADR-0022_Zero_Trust_Multi_Tenant_Authorisation.md`
- `docs/adr/ADR-0023_Multi_Site_Organisation_Hierarchy.md`
- `docs/adr/ADR-0024_Role_Based_Access_Control.md`
- `docs/adr/ADR-0025_Tenant_Aware_Atlas_AI.md`
- `docs/adr/ADR-0026_Reporting_and_Organisational_Aggregation.md`
- `docs/adr/ADR-0027_Resource_Assignment_and_Transfer.md`
- `SOT-21` Data Model Specification
- `SOT-22` Security Model Specification
- `docs/security-rls-reconciliation-2026-07-02.md`
- `docs/storage-rls-hardening-sec-002-2026-07-03.md`

## Decision

HourWise will treat the current `companies` / `company_id` schema as the compatibility implementation of the ADR term `organisation` / `organisation_id` until a controlled migration introduces explicit organisation and site tables.

No new security-sensitive feature should be built until it can answer these checks for every request:

- who is the actor
- which organisation is in scope
- which site or site set is in scope
- which role grants access
- which record ownership rule applies
- which operation is being attempted
- whether export/report/Atlas/background-job behaviour uses the same scope

Authentication alone is never enough.

## Compatibility Position

| ADR Term | Current Implementation | SEC-003 Compatibility Rule | Migration Direction |
| --- | --- | --- | --- |
| `organisation` | `companies` | Treat `companies.id` as organisation scope. Do not introduce parallel `organisation_id` without a backfill plan. | Rename or alias through additive views/functions before any destructive change. |
| `organisation_id` | `company_id` | Existing `company_id` remains the enforceable tenant key. New tables may use `company_id` until the organisation migration is planned. | Add `organisation_id` only with compatibility indexes, views, and function updates. |
| `site` | Not consistently implemented | Site scope is not yet enforceable. Site-specific features must remain blocked or use explicit nullable `site_id` with fail-closed checks. | Add `sites`, assignment history, and site membership before site-filtered UX. |
| `role` | `profiles.role` with `driver` / `manager` plus scattered checks | Current role model is insufficient for ADR-0024. Treat `manager` as a legacy coarse role, not the final permission model. | Add role catalogue, role assignments, role permissions, inheritance, and audit. |
| `record ownership` | Mixed: `user_id`, `driver_id`, `company_id` | Every protected table needs a documented owner rule before new writes. | Add helper functions and tests for owner checks. |
| `operation` | RLS policies and RPC checks vary by feature | Operation must be explicit: read, create, update, delete/archive, export, administer. | Add permission keys and operation-specific tests. |

## Scope Model

Every access decision must resolve to one of these scopes.

| Scope | Meaning | Examples | Required Check |
| --- | --- | --- | --- |
| Platform | HourWise-level administration across organisations | Platform admin support, system diagnostics | Explicit platform role plus audited support/admin path. |
| Organisation | Whole operator/fleet account | Organisation owner, operations director, compliance lead | Actor has membership in `company_id`/organisation and permission for operation. |
| Site Set | One or more assigned sites | Regional manager, planner covering several depots | Actor has active site assignments covering target `site_id`. |
| Site | One depot/operating centre | Site manager, workshop manager | Actor has active role for target site. |
| Own Record | The actor's own driver/user data | Driver viewing own shifts, messages, acknowledgements | Target row is owned by actor or linked driver identity. |
| Public Authenticated | Authenticated but not tenant-specific | None for business/compliance data | Not allowed for business records unless explicitly documented. |

Default rule: if scope cannot be resolved, deny.

## Core Tables And Security Requirements

These tables define the target model. Some are future migration targets rather than current tables.

| Table / Model | Current Status | Required Columns | RLS Requirement | Audit Requirement |
| --- | --- | --- | --- | --- |
| `companies` / organisations | Exists as current tenant table | `id`, name, status | Read/update only through organisation membership and operation permission. | Organisation profile changes. |
| `sites` | Missing or incomplete | `id`, `company_id`, name, status, address, operating-centre metadata | Organisation members see only permitted sites; site roles see assigned sites only. | Create/update/archive site. |
| `profiles` | Exists | `id`, `company_id`, legacy `role` | Self-read/update limited fields; managers/admins only through permission matrix. | Role/scope-affecting profile changes. |
| `organisation_memberships` | Target model; current profile acts as coarse membership | `user_id`, `company_id`, status | Actor can only see/manage memberships they are permitted to administer. | Membership invite, activation, suspension, removal. |
| `site_memberships` | Target model | `user_id`, `company_id`, `site_id`, role assignment | Required before site-level filtering is treated as enforced. | Site assignment grant/revoke. |
| `roles` | Target model | role key, name, inheritance parent, assignable flag | Readable by authorised admins; changes restricted to platform/organisation admin. | Role create/update/archive. |
| `role_permissions` | Drafted in SOT data model | role key, permission key, effect, scope | Default deny; allow only through explicit permission. | Permission grant/revoke. |
| `drivers` | Existing concept | `company_id`, future `home_site_id`, active assignment state | Organisation/site/own-driver scoped access. | Driver create/update/archive/site transfer. |
| `vehicles` | Existing concept | `company_id`, future `home_site_id`, active assignment state | Organisation/site scoped access; workshop roles get maintenance-only permissions. | Vehicle create/update/archive/site transfer. |
| `tachograph_files` and raw storage | Exists and hardened for company scope | `company_id`, uploader, driver/vehicle/import references | Company scope now; site scope after driver/vehicle assignment exists. | Upload, processing, archive, retention event. |
| Timeline/parser tables | Exists for tachograph flow | `company_id`, driver/vehicle/import references | Same scope as source import plus role permission for compliance/tachograph read. | Regeneration, supersession, review action. |
| Reports/export tables | Future/partial | `company_id`, `site_id` where applicable, snapshot scope | Same permission as interactive report plus export permission. | Create, preview, export, download, archive. |
| Atlas conversations/actions | Future/partial | `company_id`, `site_id`, actor, permission context | Atlas inherits caller scope; no service-role-only data expansion. | Prompt, retrieved sources, response, action request. |
| Assignment/transfer events | Future | `company_id`, resource type, resource id, from_site_id, to_site_id, effective time | Visible by role/scope; immutable normal path. | Every transfer event. |

## Permission Key Pattern

Use stable permission keys with explicit area, resource, and operation.

Pattern:

```text
<area>.<resource>.<operation>
```

Operations:

| Operation | Meaning |
| --- | --- |
| `read` | View records or derived summaries. |
| `create` | Create new records. |
| `update` | Mutate existing records. |
| `archive` | Soft-delete/archive/retention-state changes. Normal hard delete remains restricted. |
| `export` | Produce or download files outside normal UI rendering. |
| `admin` | Manage configuration, permissions, assignments, or sensitive settings. |
| `acknowledge` | Driver or manager acknowledgement without broad update permission. |

Initial permission areas:

- `fleet`
- `drivers`
- `vehicles`
- `planning`
- `payroll`
- `compliance`
- `tachograph`
- `reporting`
- `messaging`
- `atlas`
- `administration`
- `documents`
- `support`

Example keys:

- `drivers.profile.read`
- `drivers.profile.update`
- `vehicles.record.read`
- `planning.shift.create`
- `tachograph.import.create`
- `tachograph.import.read`
- `tachograph.raw_file.export`
- `compliance.timeline.read`
- `reporting.report.read`
- `reporting.report.export`
- `messaging.thread.read`
- `messaging.message.create`
- `atlas.conversation.create`
- `atlas.fleet_summary.read`
- `administration.membership.admin`
- `administration.role.admin`

## Baseline Role Matrix

This matrix defines initial intent. Implementation must still enforce exact permission keys and scope rows.

Legend:

- `Org`: whole organisation scope
- `Region`: assigned region/site set only
- `Site`: assigned site only
- `Own`: own driver/user records only
- `No`: default deny

| Role | Fleet Admin | Drivers | Vehicles | Planning | Payroll | Compliance | Reporting | Messaging | Atlas | Administration |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Platform Admin | Org via support only | Org via support only | Org via support only | Org via support only | No by default | Org via support only | Org via support only | No by default | Org via support only | Platform |
| Organisation Owner | Org | Org | Org | Org | Org | Org | Org | Org | Org | Org |
| Operations Director | Org | Org | Org | Org | Read/approve if granted | Org | Org | Org | Org | No role admin by default |
| Regional Manager | Region | Region | Region | Region | No by default | Region | Region | Region | Region | No |
| Site Manager | Site | Site | Site | Site | No by default | Site | Site | Site | Site | No |
| Planner | No | Read assigned scope | Read assigned scope | Assigned scope | No | Read assigned scope | Planning reports only | Assigned scope | Advisory only if granted | No |
| Workshop Manager | No | No by default | Site/Region maintenance | No | No | Vehicle compliance only | Maintenance reports only | Vehicle/job threads if granted | No by default | No |
| Fleet Administrator | Org limited | Org limited | Org limited | Org limited | No by default | Read/upload if granted | Standard reports if granted | Org limited | No by default | No role admin |
| Driver | No | Own | Assigned vehicle read | Own shifts/jobs | Own payroll summary if enabled | Own compliance summary | Own exports only if enabled | Own threads | Own context only if enabled | No |

Platform Admin is not a normal cross-tenant bypass. Production support access must be time-bound, reason-coded, audited, and preferably implemented as a support session with explicit organisation scope.

## Operation Matrix By Feature Area

| Feature Area | Read | Create | Update | Archive/Delete | Export | Special Rules |
| --- | --- | --- | --- | --- | --- | --- |
| Driver profiles | Organisation/site/own scope | Admin/manager roles only | Admin/manager roles; driver self-update limited fields | Archive only, no normal hard delete | Requires driver export permission | Site filters apply once `site_id` exists. |
| Vehicle records | Organisation/site scope | Fleet admin/workshop roles | Fleet admin/workshop roles | Archive only | Requires vehicle export permission | Maintenance-only roles must not access payroll/driver personal data. |
| Tachograph imports | Organisation/site/own-driver scope | Manager/import roles; driver app later own upload if enabled | Processing system only except review metadata | Archive/retention-state only | Raw file export requires explicit permission and audit | Storage object access must match `tachograph_files` row scope. |
| Timeline/compliance review | Organisation/site/own-driver scope | System generation only | Review actions by permitted compliance roles | Supersede, not hard delete | Report/export permission required | Generated rows inherit source import scope. |
| Rota/jobs/routes | Organisation/site/own-driver scope | Planning roles | Planning/manager roles | Cancel/supersede, not hard delete | Planning/reporting permission | Route estimates remain advisory, not live HGV navigation. |
| Messaging/events | Thread participant or scoped manager | Participant/system/manager roles | Limited corrections only | Archive/hide, not destroy audit | Export requires messaging/reporting permission | Event log remains source of truth. |
| Reports | Same scope as source records | Reporting roles | Draft updates by owner/role | Archive exports only per retention | Explicit `reporting.*.export` | Export must snapshot evidence and permission context. |
| Atlas | Same as caller | Conversation/action request by permission | No direct source mutation without confirmed action | Audit retained per policy | Atlas cannot export without explicit export permission | Retrieval must include permission context and source IDs. |
| Administration | Admin scope only | Admin roles | Admin roles | Audit and soft-delete where possible | Admin export permission | Role/permission changes require audit and may require dual control later. |

## RLS And Function Rules

RLS baseline:

- Enable RLS on every business table.
- Prefer `company_id`/organisation scoping as the first predicate.
- Add `site_id` predicates only when site assignments are authoritative.
- Do not rely on client-supplied `company_id`, `site_id`, `driver_id`, or `vehicle_id` without server-side verification.
- Use security-definer functions only when needed to avoid RLS recursion or perform privileged internal work.
- Every security-definer function must validate actor, tenant, scope, operation, and target record before returning data or mutating state.
- Background jobs must either run with a scoped system actor or record the source user/request that authorised the job.

Required helper functions:

| Function | Purpose | Notes |
| --- | --- | --- |
| `current_actor_company_id()` | Compatibility wrapper for current organisation. | Can initially wrap existing `get_user_company_id()`. |
| `actor_has_permission(permission_key, company_id, site_id)` | Central permission check. | Must default deny on null/unknown scope. |
| `actor_can_access_driver(driver_id, operation)` | Driver ownership/site/organisation check. | Needed before driver profile, tachograph, payroll, report access. |
| `actor_can_access_vehicle(vehicle_id, operation)` | Vehicle site/organisation check. | Needed before VU, maintenance, defect, report access. |
| `actor_can_export(scope, resource_type, resource_id)` | Export permission and audit preflight. | Required for raw files and reports. |
| `record_security_event(...)` | Audit security-sensitive decisions/actions. | Should capture actor, target, permission, decision, and reason. |

## Edge Function And RPC Rules

Every Edge Function/RPC that reads or mutates business data must document:

- accepted actor roles
- required permission key
- tenant source of truth
- target record lookup
- site/ownership check
- export/report/cache/Atlas side effects
- audit event emitted
- failure mode for missing or mismatched scope

Required fail-closed behaviour:

- missing actor: reject
- missing tenant: reject
- actor not a member of tenant: reject
- `company_id` mismatch between request and target row: reject
- `site_id` mismatch once site enforcement exists: reject
- permission key missing: reject
- export attempted without export permission: reject and audit

## Export, Report, And Download Rules

Exports are a separate operation, not a side effect of read permission.

Rules:

- A user who can view a page may still be denied export.
- Raw tachograph file download requires `tachograph.raw_file.export`.
- Report export requires `reporting.report.export`.
- Driver self-export, if enabled, must be limited to own records and explicitly labelled.
- Signed URLs must be short-lived and generated only after permission checks.
- Stored export files must include tenant and report/export metadata.
- Export audit must include actor, tenant, scope, source records, file id/path, timestamp, and permission key.
- A report export must preserve the evidence state and permission context used at export time.

## Cache Key Rules

Any cache containing business data must include:

- actor id or role scope where required
- organisation/company id
- site id or site set hash
- permission-version or role-assignment version
- resource id
- date/range/filter parameters

Never share cached Atlas, report, tachograph, driver, payroll, or compliance payloads across tenants or scopes.

## Atlas Rules

Atlas must run as the caller, not as a global service-role reader.

Required context:

- actor id
- company/organisation id
- site scope
- role/permission summary
- target resource ids
- allowed source tables/resources
- denied operation list where relevant

Atlas must not:

- query another tenant
- bypass RLS to broaden context
- expose records hidden from the caller
- create exports without explicit export permission and confirmation
- generate cross-site comparisons unless the caller can access all compared sites

Atlas audit must include prompt, permission context, source records retrieved, response metadata, actions proposed, and actions executed.

## Mandatory Test Matrix

| Test ID | Scenario | Expected Result |
| --- | --- | --- |
| `SEC-003-T01` | Manager from company A requests company B driver. | Denied; no row returned. |
| `SEC-003-T02` | Site manager requests driver assigned to another site. | Denied once site enforcement is enabled. |
| `SEC-003-T03` | Driver requests another driver's profile or tachograph analysis. | Denied. |
| `SEC-003-T04` | Driver requests own permitted summary. | Allowed with own-record scope only. |
| `SEC-003-T05` | Planner edits payroll fields. | Denied. |
| `SEC-003-T06` | Workshop manager reads vehicle maintenance data for assigned site. | Allowed. |
| `SEC-003-T07` | Workshop manager reads driver payroll data. | Denied. |
| `SEC-003-T08` | User can view report but lacks export permission. | Preview allowed if scoped; export denied and audited. |
| `SEC-003-T09` | Raw tachograph file signed URL requested without export permission. | Denied and audited. |
| `SEC-003-T10` | Edge Function receives mismatched `company_id` and target import id. | Denied before processing. |
| `SEC-003-T11` | Background processing writes derived rows for an import. | Allowed only if source import scope is preserved. |
| `SEC-003-T12` | Atlas asks for another tenant's driver data. | Denied; response must say insufficient permission. |
| `SEC-003-T13` | Atlas compares two sites when caller has one-site scope. | Denied or limited to authorised site. |
| `SEC-003-T14` | Cache entry created for a site-scoped report. | Cache key includes company and site scope. |
| `SEC-003-T15` | Driver/vehicle transferred between sites. | Transfer event retained; historical records remain queryable by authorised historical/compliance roles. |
| `SEC-003-T16` | Role permission is changed. | Audit event created; permission-version invalidates relevant caches. |

## Implementation Phases

### Phase A: Compatibility Audit

- Inventory every table with `company_id`, `driver_id`, `vehicle_id`, and any existing role checks.
- Identify business tables without RLS.
- Identify RPCs and Edge Functions using service-role or security-definer paths.
- Map current `profiles.role = manager/driver` behaviour to target permission keys.
- Produce a no-migration gap report.

### Phase B: Permission Foundation

- Add role and permission catalogue tables.
- Add organisation membership and role assignment tables or compatibility views.
- Add audit table/events for permission, export, support, and Atlas decisions.
- Add helper functions for actor, tenant, permission, driver, vehicle, export, and audit checks.
- Backfill current managers/drivers into target roles.

### Phase C: Site Foundation

- Add `sites`.
- Add driver and vehicle site assignment history.
- Add user site memberships or role assignments scoped to site/site set.
- Backfill one default site per existing company only if required for migration safety.
- Keep site filtering disabled or all-company until backfill is verified.

### Phase D: Enforcement

- Replace broad manager/company checks with permission helper checks.
- Add site filters where site assignments are authoritative.
- Update RPCs and Edge Functions to fail closed on mismatched tenant/site/operation.
- Add export/report/download permission checks.
- Add cache-key scope requirements.

### Phase E: Atlas And Reporting

- Enable tenant-aware Atlas retrieval only after Phase B enforcement exists.
- Enable site/organisation aggregation only after Phase C is verified.
- Add Atlas and report export audit tests.
- Block cross-site comparisons unless all sites are authorised.

## Acceptance Criteria

`SEC-003` is complete as a planning gate when:

- organisation/company compatibility is explicitly documented
- role and permission categories are defined
- default role scope matrix is defined
- required target tables/functions are listed
- RLS/RPC/Edge Function rules are listed
- export/report/download rules are listed
- cache-key rules are listed
- Atlas permission rules are listed
- mandatory tests are listed
- implementation phases are defined

Schema/RLS implementation is a separate task. No migration should claim completion of ADR-0022 to ADR-0027 until the mandatory tests pass.
