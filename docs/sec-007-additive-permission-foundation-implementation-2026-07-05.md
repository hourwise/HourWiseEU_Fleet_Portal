# SEC-007 Additive Permission Foundation Implementation

Date: 2026-07-05
Status: Implemented, deployed, and verified through SEC-009

## Purpose

`SEC-007` implements the additive permission foundation described by `SEC-005` and planned by `SEC-006`, using the refreshed `SEC-008` live schema/policy evidence.

This task creates the migration and static regression tests only. It does not deploy the migration, replace existing RLS/RPC enforcement, add site enforcement, add Atlas retrieval, add report export snapshots, add support sessions, or implement ADR-0028 maintenance-rule tables.

## Inputs

- `docs/sec-005-additive-permission-foundation-design-2026-07-05.md`
- `docs/sec-006-permission-foundation-catalog-refresh-candidate-plan-2026-07-05.md`
- `docs/sec-008-supabase-dump-gate-2026-07-05.md`
- `supabase/.temp/sec-008-live-schema-policy-dump-2026-07-05.sql`
- `supabase/.temp/sec-008-live-catalog-summary-2026-07-05.txt`
- `docs/sql results.txt`

## Implemented Files

| File | Purpose |
| --- | --- |
| `supabase/migrations/20260705170000_add_security_permission_foundation.sql` | Additive permission foundation migration. |
| `src/lib/security/sec007PermissionFoundation.test.ts` | Static regression tests for the migration safety contract. |
| `package.json` | Adds SEC-007 static test to `npm run test:rules`. |

## Migration Scope

The migration creates:

- `public.security_roles`
- `public.security_permissions`
- `public.security_role_permissions`
- `public.security_role_assignments`
- `public.security_permission_audit_events`
- `public.organisation_memberships_v`

The migration adds helper functions:

- `public.current_actor_company_id()`
- `public.current_actor_legacy_role()`
- `public.actor_has_permission(text, uuid, uuid)`
- `public.record_security_event(uuid, uuid, text, text, text, text, uuid, text, text, jsonb, text)`
- `public.actor_can_access_driver(uuid, text)`
- `public.actor_can_access_vehicle(uuid, text)`
- `public.actor_can_export(uuid, text, uuid, text)`

The migration seeds:

- 10 role catalogue rows.
- 32 permission catalogue rows.
- Fleet administrator permissions that preserve current manager-like read/update/admin behaviour without granting export, role-admin, support, or Atlas fleet-summary permissions.
- Driver own-record permissions only.

The migration backfills:

- Active legacy `manager` profiles with `company_id` to `fleet_administrator`.
- Active legacy `driver` profiles with `company_id` to `driver`.

Current expected live backfill sizing from `SEC-008`:

| Target Role | Expected Assignments |
| --- | ---: |
| `driver` | 17 |
| `fleet_administrator` | 1 |

Dataset caveat:

- The live dataset is test-seeded.
- The single fleet administrator is the project owner/operator.
- One driver row is also the project owner/operator.
- Remaining driver rows are fake SQL-injected profiles.

## Explicit Non-Scope

SEC-007 does not:

- Drop, rename, or replace `profiles.role`.
- Drop, rename, or replace `profiles.company_id` or other `company_id` fields.
- Add `organisation_id`.
- Add site foundation tables.
- Enforce `site_id`.
- Replace existing application RLS policies.
- Replace existing RPC guards.
- Grant `reporting.report.export` to `fleet_administrator`.
- Grant `tachograph.raw_file.export` to `fleet_administrator`.
- Grant `administration.role.admin` to `fleet_administrator`.
- Grant `support.session.admin` to `fleet_administrator`.
- Grant `atlas.fleet_summary.read` to `fleet_administrator`.

## RLS And Grant Position

All new security tables have RLS enabled.

Direct authenticated writes are not granted for:

- `security_role_assignments`
- `security_permission_audit_events`

Audit writes are routed through `record_security_event(...)`, but direct authenticated execution of that audit function is revoked so browser clients cannot forge arbitrary audit outcomes. Controlled security-definer helpers such as `actor_can_export(...)` can call it internally.

The compatibility view `organisation_memberships_v` uses `security_invoker = true` so it does not bypass underlying caller/RLS behaviour.

Role assignments are constrained to organisation scope only in this first migration. Non-null `site_id` and non-organisation assignment scopes fail closed until a future site foundation exists.

## Verification

Targeted static test:

```powershell
npx vitest run src/lib/security/sec007PermissionFoundation.test.ts
```

Result:

- 1 test file passed.
- 9 tests passed.

Full rules regression suite:

```powershell
npm run test:rules
```

Result:

- 8 test files passed.
- 106 tests passed.

Typecheck:

```powershell
npm run typecheck
```

Result:

- Failed on existing unrelated app/type-generation issues across manager, marketing, subscription, and generated Supabase type usage.
- No failure was introduced by the SEC-007 test file or migration SQL because the new test is included in `test:rules` and passes.

## Deployment Status

Deployed and verified through `SEC-009`.

Dashboard verification confirmed:

- `security_roles = 10`
- `security_permissions = 32`
- role grants `driver = 6`
- role grants `fleet_administrator = 22`
- active assignments `driver = 17`
- active assignments `fleet_administrator = 1`
- no unexpected fleet-administrator export, role-admin, support, or Atlas fleet-summary grants
- no active legacy `manager`/`driver` profile with `company_id` missing an assignment
- no orphaned active `legacy_profile_backfill` assignments
- organisation-only assignment scope with null `site_id`
- compatibility view counts matching 17 active drivers and 1 active manager

## Post-Deploy Verification Queries

```sql
select role_key, count(*)
from public.security_role_assignments
where status = 'active'
group by role_key
order by role_key;

select p.id, p.email, p.role, p.company_id
from public.profiles p
left join public.security_role_assignments sra
  on sra.user_id = p.id
 and sra.company_id = p.company_id
 and sra.status = 'active'
where p.company_id is not null
  and coalesce(p.is_active, true) = true
  and p.role in ('manager', 'driver')
  and sra.id is null;
```

Expected for current live test dataset:

- `driver`: 17 active assignments.
- `fleet_administrator`: 1 active assignment.
- No unmatched active legacy `manager`/`driver` profiles with `company_id`.

## Next Task

`SEC-010`: add shadow permission comparison to `patch_tachograph_import_metadata` without changing runtime enforcement outcome.

Selected first shadow-enforcement candidate:

- `patch_tachograph_import_metadata`
