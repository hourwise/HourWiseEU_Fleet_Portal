# SEC-009 Additive Permission Foundation Deploy And Verify

Date: 2026-07-05
Status: Complete

## Purpose

`SEC-009` is the controlled deployment and verification gate for the `SEC-007` additive permission foundation migration.

This task prepares the deployment checklist and post-deploy verification SQL. It does not apply the migration to the linked Supabase project.

## Execution Attempt

Rollback-only validation using the Supabase CLI temporary dump role:

```powershell
psql --no-password --set ON_ERROR_STOP=1 --file -
```

Result:

```text
ERROR: permission denied for schema public
LINE 1: create table if not exists public.security_roles (
```

Implication:

- The temporary dump role can capture schema/catalog evidence.
- It cannot create SEC-007 schema objects.
- Do not use the temporary dump role for deployment.

Supabase CLI push dry run:

```powershell
.\supabase.exe db push --linked --dry-run
```

Result:

```text
Remote migration versions not found in local migrations directory.
Remote migration: 20260703130000
```

Additional migration-state observation:

- Remote has `20260703130000` that is missing locally.
- Local has pending `20260705103000` and `20260705170000`.
- `db push` is not suitable for targeted SEC-007 deployment until migration history is reconciled, because it would not apply only SEC-007 and currently fails on drift.

## Inputs

- `supabase/migrations/20260705170000_add_security_permission_foundation.sql`
- `src/lib/security/sec007PermissionFoundation.test.ts`
- `docs/sec-007-additive-permission-foundation-implementation-2026-07-05.md`
- `docs/sec-008-supabase-dump-gate-2026-07-05.md`
- `docs/sql results.txt`

## Pre-Deploy State

`SEC-008` evidence confirms:

| Evidence Item | Result |
| --- | ---: |
| Public/storage tables with RLS enabled | 63 / 63 |
| Forced RLS tables | 1 (`public.profiles`) |
| Policies | 133 |
| Existing `security_*` permission foundation tables | 0 |
| Expected `driver` backfill assignments | 17 |
| Expected `fleet_administrator` backfill assignments | 1 |

Dataset caveat:

- The live dataset is test-seeded.
- The single fleet administrator is the project owner/operator.
- One driver row is also the project owner/operator.
- Remaining driver rows are fake SQL-injected profiles.

## Deployment Options

### Option A: Supabase Dashboard SQL Editor

Use this for the current environment because CLI deployment is blocked by migration drift and the temporary dump role cannot create schema objects.

1. Open `supabase/migrations/20260705170000_add_security_permission_foundation.sql`.
2. Copy the full SQL into Supabase Dashboard SQL Editor.
3. Run it once.
4. Run `docs/sec-009-post-deploy-verification.sql`.
5. Save/export the result sets.

### Option B: Native `psql` With Privileged Connection

Use this only if you have a privileged connection string, not the temporary dump role. Apply the specific SEC-007 file directly to avoid pushing unrelated pending migrations.

```powershell
$env:Path = 'C:\Program Files\PostgreSQL\17\bin;' + $env:Path
psql "<privileged-db-url>" --set ON_ERROR_STOP=1 --file supabase\migrations\20260705170000_add_security_permission_foundation.sql
psql "<privileged-db-url>" --set ON_ERROR_STOP=1 --file docs\sec-009-post-deploy-verification.sql
```

Do not use the Supabase CLI temporary dump role for deployment. It is suitable for schema dump evidence, not schema migration execution or privileged profile verification.

### Option C: Supabase CLI `db push`

Not recommended right now.

Reason:

- Remote migration `20260703130000` is not present locally.
- Local migration `20260705103000` is also pending remotely.
- `db push` would not be a targeted SEC-007 deployment even after drift is fixed.

Only revisit this option after deciding whether to pull/repair the remote migration history and whether `20260705103000` should be deployed before SEC-007.

## Deployment Safety Contract

The migration is additive and should not:

- Drop or rename `public.profiles`.
- Drop or rename `profiles.role`.
- Drop or rename `company_id`.
- Add `organisation_id`.
- Add site enforcement.
- Replace existing RLS/RPC enforcement.
- Grant export, role-admin, support, or Atlas fleet-summary permissions to `fleet_administrator`.

## Expected Post-Deploy Results

### Object Presence

Expected:

- 5 `security_*` tables exist.
- 1 compatibility view exists.
- 7 helper/audit functions exist.
- RLS is enabled on all 5 `security_*` tables.

### Seed Counts

Expected:

| Object | Expected Count |
| --- | ---: |
| `security_roles` | 10 |
| `security_permissions` | 32 |
| `fleet_administrator` grants | 22 |
| `driver` grants | 6 |

### Backfill Counts

Expected for the current live test dataset:

| Role Key | Expected Active Assignments |
| --- | ---: |
| `driver` | 17 |
| `fleet_administrator` | 1 |

Expected unmatched active legacy profiles:

- 0 rows.

### Denied Defaults

Expected:

- `fleet_administrator` does not have `tachograph.raw_file.export`.
- `fleet_administrator` does not have `reporting.report.export`.
- `fleet_administrator` does not have `administration.role.admin`.
- `fleet_administrator` does not have `support.session.admin`.
- `fleet_administrator` does not have `atlas.fleet_summary.read`.

### Site Fail-Closed

Expected:

- `actor_has_permission(..., p_site_id := non-null)` returns false.
- `security_role_assignments` has only `organisation` scope rows with `site_id is null`.

## Captured Verification Results

### Catalog Verification From Temporary Dump Role

Captured file:

```text
supabase/.temp/sec-009-catalog-verification-2026-07-05.txt
```

Result:

- Temporary role can read `pg_class` and `pg_proc` catalog metadata.
- Temporary role cannot `select` from `public.security_roles`, so seed/backfill checks still require Dashboard SQL or another privileged connection.

RLS state captured:

| Table | RLS Enabled | RLS Forced |
| --- | --- | --- |
| `security_permission_audit_events` | true | false |
| `security_permissions` | true | false |
| `security_role_assignments` | true | false |
| `security_role_permissions` | true | false |
| `security_roles` | true | false |

Helper function posture captured:

| Function | Security Definer | Search Path |
| --- | --- | --- |
| `actor_can_access_driver(uuid,text)` | true | `public, pg_temp` |
| `actor_can_access_vehicle(uuid,text)` | true | `public, pg_temp` |
| `actor_can_export(uuid,text,uuid,text)` | true | `public, pg_temp` |
| `actor_has_permission(text,uuid,uuid)` | true | `public, pg_temp` |
| `current_actor_company_id()` | true | `public, pg_temp` |
| `current_actor_legacy_role()` | true | `public, pg_temp` |
| `record_security_event(uuid,uuid,text,text,text,text,uuid,text,text,jsonb,text)` | true | `public, pg_temp` |
| `set_security_updated_at()` | false | `public, pg_temp` |

### Export Permission Metadata

Provided result:

```json
[
  {
    "key": "reporting.report.export",
    "requires_audit": true,
    "risk_level": "critical"
  },
  {
    "key": "tachograph.raw_file.export",
    "requires_audit": true,
    "risk_level": "critical"
  }
]
```

Interpretation:

- `reporting.report.export` exists in the live permission catalogue.
- `tachograph.raw_file.export` exists in the live permission catalogue.
- Both export permissions are marked `requires_audit = true`.
- Both export permissions are marked `risk_level = critical`.

This satisfies the export permission metadata check from `docs/sec-009-post-deploy-verification.sql` section 14.

### Active Backfill Assignment Counts

Provided result:

```json
[
  {
    "role_key": "driver",
    "active_assignment_count": 17
  },
  {
    "role_key": "fleet_administrator",
    "active_assignment_count": 1
  }
]
```

Interpretation:

- Active `driver` assignments match the expected `SEC-008` backfill sizing of 17.
- Active `fleet_administrator` assignments match the expected `SEC-008` backfill sizing of 1.
- This satisfies the active backfill assignment count check from `docs/sec-009-post-deploy-verification.sql` section 8.

### Seed Counts

Provided results:

```json
[
  {
    "security_role_count": 10
  }
]
```

```json
[
  {
    "security_permission_count": 32
  }
]
```

Interpretation:

- `security_roles` has the expected 10 rows.
- `security_permissions` has the expected 32 rows.

### Role Grant Counts

Provided result:

```json
[
  {
    "role_key": "driver",
    "grant_count": 6
  },
  {
    "role_key": "fleet_administrator",
    "grant_count": 22
  }
]
```

Interpretation:

- `driver` has the expected 6 grants.
- `fleet_administrator` has the expected 22 grants.

### Denied-Default Fleet Administrator Grants

Provided result:

```text
Success. No rows returned.
```

Interpretation:

- `fleet_administrator` has no unexpected grants for:
  - `tachograph.raw_file.export`
  - `reporting.report.export`
  - `administration.role.admin`
  - `support.session.admin`
  - `atlas.fleet_summary.read`

### Unmatched Legacy Profile Checks

Active legacy profiles without active assignment:

```text
Success. No rows returned.
```

Assignments without matching active legacy profile:

```text
Success. No rows returned.
```

Interpretation:

- No active legacy `manager`/`driver` profile with `company_id` is missing an active assignment.
- No active `legacy_profile_backfill` assignment is orphaned from an active matching profile.

### Assignment Scope Check

Provided result:

```json
[
  {
    "scope_level": "organisation",
    "site_id_is_null": true,
    "assignment_count": 18
  }
]
```

Interpretation:

- All active assignments are organisation scoped.
- All assignment `site_id` values are null.
- This matches the no-site-enforcement scope for SEC-007.

### Compatibility View Count

Provided result:

```json
[
  {
    "legacy_role": "driver",
    "status": "active",
    "membership_view_count": 17
  },
  {
    "legacy_role": "manager",
    "status": "active",
    "membership_view_count": 1
  }
]
```

Interpretation:

- `organisation_memberships_v` aligns with the expected live test dataset.
- Legacy `driver` memberships align with 17 `driver` assignments.
- Legacy `manager` memberships align with 1 `fleet_administrator` assignment.

Site fail-closed smoke-test decision:

- The site fail-closed behaviour is already enforced by migration constraint `security_role_assignments_org_scope_no_site_check` and static regression coverage.
- The Dashboard result sets prove no site assignments exist.
- SEC-009 is accepted as complete without running a mutating smoke insert in Dashboard SQL.

## Verification SQL

Run:

```text
docs/sec-009-post-deploy-verification.sql
```

The SQL is read-only except for a caught constraint smoke test that attempts and rejects a future `site` assignment without persisting data.

If the full verification SQL is too noisy, run the remaining privileged checks only:

```text
docs/sec-009-remaining-dashboard-verification.sql
```

## Completion Criteria

`SEC-009` is complete when:

- The migration is applied to the selected target. Completed.
- Verification result sets are captured. Completed.
- Active assignment counts match expected backfill sizing or differences are explained. Completed.
- No active legacy `manager`/`driver` profile with `company_id` is missing an assignment. Completed.
- Denied-default permission checks return no unexpected grants. Completed.
- The first shadow enforcement candidate is selected. Completed: `patch_tachograph_import_metadata`.

## Recommended First Shadow Enforcement Candidate

Recommended: `patch_tachograph_import_metadata`.

Reason:

- It is a manager-scoped metadata update.
- It already has a clear company boundary.
- It is narrower than report export or raw-file download.
- It is a practical place to compare legacy manager/company checks to `actor_has_permission('tachograph.import.update', company_id, null)`.

## Rollback Position

If SEC-007 deployment fails before enforcement swaps are introduced, rollback is straightforward because no existing application enforcement has been replaced.

Rollback outline:

```sql
drop function if exists public.actor_can_export(uuid, text, uuid, text);
drop function if exists public.actor_can_access_vehicle(uuid, text);
drop function if exists public.actor_can_access_driver(uuid, text);
drop function if exists public.record_security_event(uuid, uuid, text, text, text, text, uuid, text, text, jsonb, text);
drop function if exists public.actor_has_permission(text, uuid, uuid);
drop function if exists public.current_actor_legacy_role();
drop function if exists public.current_actor_company_id();
drop view if exists public.organisation_memberships_v;
drop table if exists public.security_permission_audit_events;
drop table if exists public.security_role_assignments;
drop table if exists public.security_role_permissions;
drop table if exists public.security_permissions;
drop table if exists public.security_roles;
drop function if exists public.set_security_updated_at();
```

Do not roll back existing `profiles`, `company_id`, legacy policies, tachograph tables, timeline tables, or storage policies.
