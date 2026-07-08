# SEC-006 Permission Foundation Catalog Refresh And Candidate Migration Plan

Date: 2026-07-05
Status: Complete as candidate migration/test plan; SQL implementation pending

## Purpose

`SEC-006` refreshes the available live/local catalog evidence and turns the `SEC-005` additive permission foundation design into a candidate migration and test plan.

This task does not apply schema changes. It defines what `SEC-007` should implement after live catalog evidence is refreshed through a working Supabase dump or dashboard SQL export.

## Inputs

- `docs/sec-005-additive-permission-foundation-design-2026-07-05.md`
- `docs/sec-004-zero-trust-no-migration-compatibility-audit-2026-07-05.md`
- `docs/zero-trust-organisation-rbac-matrix-sec-003-2026-07-05.md`
- Existing live export artefacts in `supabase/.temp` from 2026-07-02
- Current source-controlled migrations through `20260705103000_update_tacho_pairing_timeline_rows.sql`
- Current Edge Functions and app code review from SEC-004/SEC-005

## Fresh Dump Attempt

A fresh linked Supabase dump was attempted for `SEC-006`:

```powershell
.\supabase.exe db dump --linked --schema public,storage --file supabase/.temp/sec-006-live-schema-policy-dump-2026-07-05.sql
```

Result:

- Failed because Docker Desktop / Docker daemon is unavailable in the local environment.
- The same command was retried with elevated permissions and failed for the same reason.
- No fresh `SEC-006` live dump file was produced.

Implication:

- `SEC-006` cannot honestly claim a fresh live catalog snapshot.
- `SEC-007` must not write final migration SQL until either Docker-based dump works or a new Supabase Dashboard SQL export is captured.

## Evidence Used

Existing captured live artefacts:

| Artefact | Date | Status | Use |
| --- | --- | --- | --- |
| `supabase/.temp/live-schema-only-2026-07-02.sql` | 2026-07-02 | Present | Live schema reference for public/storage at that time. |
| `supabase/.temp/live-policies-2026-07-02.json` | 2026-07-02 | Present | Live policy inventory. |
| `supabase/.temp/live-rls-status-2026-07-02.json` | 2026-07-02 | Present | Live RLS status inventory. |
| `supabase/.temp/live-storage-buckets-2026-07-02.json` | 2026-07-02 | Present | Live storage bucket inventory. |

Source-controlled local artefacts:

- Supabase migrations through `20260705103000_update_tacho_pairing_timeline_rows.sql`
- Edge Functions under `supabase/functions`
- App/RPC usage under `src`

## Captured Live Evidence Summary

From the 2026-07-02 live export artefacts:

| Evidence Item | Count / Result |
| --- | ---: |
| Policy records | 100 |
| RLS status records | 54 |
| RLS enabled records | 54 |
| Forced RLS records | 1 (`profiles`) |
| Storage buckets | 7 |
| Storage policies | 9 |
| Tachograph/import-related policies | 8 |

Live buckets captured:

| Bucket | Public | File Size Limit | Notes |
| --- | --- | ---: | --- |
| `defect-photos` | false | 10,485,760 | Private image bucket. |
| `driver-documents` | false | 20,971,520 | Private document bucket. |
| `logos` | true | 2,097,152 | Public logo bucket. |
| `maintenance-docs` | true | Not captured | Public at capture time; should be reviewed before maintenance evidence work. |
| `receipts` | false | Not captured | Private receipt bucket. |
| `tachograph-files` | false | 104,857,600 | Private raw tachograph bucket. |
| `vehicle-documents` | false | 20,971,520 | Private document bucket. |

Live RLS captured:

- All 54 captured tables had RLS enabled.
- `profiles` had forced RLS enabled in the captured export.
- No `security_roles`, `security_permissions`, `security_role_permissions`, `security_role_assignments`, or `security_permission_audit_events` tables were present in the 2026-07-02 live schema.

Important limitation:

- This evidence predates several local migrations from 2026-07-03 to 2026-07-05, including tachograph storage hardening, parser lifecycle, timeline schema/read models, and pairing updates.
- It must be refreshed before SQL implementation.

## Candidate Migration

Recommended candidate migration filename:

```text
supabase/migrations/20260705170000_add_security_permission_foundation.sql
```

Purpose:

- Add the permission foundation without replacing current RLS/RPC enforcement.
- Seed roles and permissions.
- Backfill current legacy `manager` and `driver` profiles into role assignments.
- Add permission helper functions and audit event function.
- Enable RLS on all new security tables.
- Keep existing `company_id`, `profiles.company_id`, and `profiles.role` unchanged.

## Candidate Migration SQL Outline

This is an outline for `SEC-007`; it is not yet committed as a migration.

```sql
-- SEC-007 candidate outline generated from SEC-006.
-- Do not apply until fresh live catalog evidence is captured.

create table if not exists public.security_roles (...);
create table if not exists public.security_permissions (...);
create table if not exists public.security_role_permissions (...);
create table if not exists public.security_role_assignments (...);
create table if not exists public.security_permission_audit_events (...);

alter table public.security_roles enable row level security;
alter table public.security_permissions enable row level security;
alter table public.security_role_permissions enable row level security;
alter table public.security_role_assignments enable row level security;
alter table public.security_permission_audit_events enable row level security;

create or replace function public.current_actor_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select public.get_my_company_id() $$;

create or replace function public.current_actor_legacy_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select public.get_my_role() $$;

create or replace function public.actor_has_permission(
  p_permission_key text,
  p_company_id uuid,
  p_site_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- default deny on null/unknown scope
  -- deny non-null site_id until site foundation exists
  -- check active security_role_assignments joined to security_role_permissions
$$;

create or replace function public.record_security_event(...)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
  -- derive user actor from auth.uid() unless service role supplies system metadata
  -- insert append-only audit event
$$;

create or replace function public.actor_can_access_driver(
  p_driver_id uuid,
  p_operation text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
  -- own-driver read/update/acknowledge path
  -- organisation-scoped manager/admin permission path
$$;

create or replace function public.actor_can_access_vehicle(
  p_vehicle_id uuid,
  p_operation text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
  -- organisation-scoped vehicle permission path
$$;

create or replace function public.actor_can_export(
  p_company_id uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_permission_key text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
  -- require *.export permission
  -- record allowed/denied audit event
$$;

-- Seed role catalogue.
insert into public.security_roles (...) values (...)
on conflict (key) do update set ...;

-- Seed permission catalogue.
insert into public.security_permissions (...) values (...)
on conflict (key) do update set ...;

-- Seed role permission grants.
insert into public.security_role_permissions (...) values (...)
on conflict (...) do update set ...;

-- Backfill from legacy profiles.
insert into public.security_role_assignments (...)
select ...
from public.profiles
where company_id is not null
  and role in ('manager', 'driver')
  and coalesce(is_active, true) = true
on conflict do nothing;

-- RLS policies for catalogue and assignment/audit tables.
create policy ... on public.security_roles for select to authenticated using (...);
create policy ... on public.security_permissions for select to authenticated using (...);
create policy ... on public.security_role_permissions for select to authenticated using (...);
create policy ... on public.security_role_assignments for select to authenticated using (...);
create policy ... on public.security_permission_audit_events for insert to authenticated with check (...);

revoke all on public.security_permission_audit_events from anon;
revoke all on public.security_role_assignments from anon;
grant execute on function public.actor_has_permission(text, uuid, uuid) to authenticated;
```

## Seed Roles

`SEC-007` should seed these roles:

| Role Key | Scope | Assignable Initially | Notes |
| --- | --- | --- | --- |
| `organisation_owner` | organisation | false until ownership confirmed | Do not auto-grant unless owner source is verified. |
| `operations_director` | organisation | false | Reserved. |
| `regional_manager` | site_set | false | Reserved until site model. |
| `site_manager` | site | false | Reserved until site model. |
| `planner` | site/site_set | false | Reserved until planning scope. |
| `workshop_manager` | site/site_set | false | Reserved until site/maintenance scope. |
| `fleet_administrator` | organisation | true | Backfill target for legacy managers. |
| `driver` | own/organisation | true | Backfill target for legacy drivers. |
| `platform_admin` | platform | false | No normal tenant assignment. |
| `system_job` | organisation | false | For background/system audit context only. |

## Seed Permissions

`SEC-007` should seed the permission set documented in `SEC-005`.

Critical defaults:

- Grant `reporting.report.read` to `fleet_administrator`.
- Do not grant `reporting.report.export` to `fleet_administrator` by default.
- Do not grant `tachograph.raw_file.export` to `fleet_administrator` by default.
- Do not grant `administration.role.admin` to `fleet_administrator` by default.
- Do not grant `atlas.fleet_summary.read` to `fleet_administrator` by default.
- Grant own-record permissions to `driver` only through helper-scoped checks.

## Backfill Count Expectations

`SEC-006` cannot compute live profile counts from the schema-only export.

Before `SEC-007`, run these count queries against live/local data and record the results:

```sql
select role, count(*)
from public.profiles
where company_id is not null
  and coalesce(is_active, true) = true
group by role
order by role;

select company_id, role, count(*)
from public.profiles
where company_id is not null
  and coalesce(is_active, true) = true
group by company_id, role
order by company_id, role;

select count(*) as profiles_without_company
from public.profiles
where company_id is null;

select count(*) as inactive_profiles
from public.profiles
where coalesce(is_active, true) = false;
```

Expected assignment counts after backfill:

| Source Profiles | Expected Assignment |
| --- | --- |
| active `manager` with company | one active `fleet_administrator` assignment |
| active `driver` with company | one active `driver` assignment |
| no company | no assignment |
| inactive | no active assignment until status semantics are confirmed |

Post-backfill verification queries:

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
  and sra.id is null;
```

## Live Catalog Queries Required Before SEC-007

Run these before writing final migration SQL:

```sql
-- Tables and columns
select table_schema, table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema in ('public', 'storage')
order by table_schema, table_name, ordinal_position;

-- RLS state
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p')
order by n.nspname, c.relname;

-- Policies
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- Security definer functions and search path
select n.nspname as schema_name, p.proname, p.oid::regprocedure as signature, p.prosecdef, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by n.nspname, p.proname, p.oid::regprocedure::text;

-- Function grants
select routine_schema, routine_name, privilege_type, grantee
from information_schema.routine_privileges
where routine_schema in ('public', 'private')
order by routine_schema, routine_name, grantee;

-- Storage buckets
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by id;
```

## Test Plan For SEC-007

### Static Test File

Recommended file:

```text
src/lib/security/sec007PermissionFoundation.test.ts
```

Test method:

- Static migration text checks, similar to the existing tachograph security regression tests.
- Assert the migration creates all required tables, enables RLS, sets search paths, revokes anon/public where required, and does not introduce forbidden destructive changes.

Static checks:

- `create table if not exists public.security_roles`
- `create table if not exists public.security_permissions`
- `create table if not exists public.security_role_permissions`
- `create table if not exists public.security_role_assignments`
- `create table if not exists public.security_permission_audit_events`
- all five tables have `enable row level security`
- helper functions are `security definer`
- helper functions set `search_path = public, pg_temp`
- no `drop table public.profiles`
- no `alter table public.profiles drop column role`
- no `rename column company_id`
- no `organisation_id` column added
- no site enforcement policy added

### Database Behaviour Tests

Required once local/hosted test database execution is available:

| Test ID | Scenario | Expected Result |
| --- | --- | --- |
| `SEC-006-T01` | Backfill active manager. | Active `fleet_administrator` assignment exists. |
| `SEC-006-T02` | Backfill active driver. | Active `driver` assignment exists. |
| `SEC-006-T03` | Inactive profile. | No active assignment. |
| `SEC-006-T04` | Profile without company. | No assignment. |
| `SEC-006-T05` | Manager checks own-company `tachograph.import.read`. | Allowed. |
| `SEC-006-T06` | Manager checks other-company `tachograph.import.read`. | Denied. |
| `SEC-006-T07` | Driver checks `drivers.own_profile.read` for self. | Allowed. |
| `SEC-006-T08` | Driver checks another driver. | Denied. |
| `SEC-006-T09` | Fleet administrator checks `reporting.report.export`. | Denied by default. |
| `SEC-006-T10` | Fleet administrator checks `tachograph.raw_file.export`. | Denied by default. |
| `SEC-006-T11` | Non-null `site_id` passed before site foundation. | Denied. |
| `SEC-006-T12` | Denied export preflight. | Denied audit event recorded. |
| `SEC-006-T13` | Direct browser write to role assignments. | Denied. |
| `SEC-006-T14` | Direct browser update/delete of audit events. | Denied. |

## Rollout Plan

### Step 1: Preflight Evidence

- Capture fresh live/local catalog export.
- Capture profile role counts and company distribution.
- Confirm whether `profiles.id` or `profiles.user_id` is the canonical assignment subject in live data.
- Confirm storage policy state after `SEC-002` is applied live.

### Step 2: Candidate Migration Draft

- Create `20260705170000_add_security_permission_foundation.sql`.
- Add tables, functions, seed rows, backfill, grants, RLS.
- Add static regression tests.

### Step 3: Dry Run

- Apply to local or disposable Supabase project.
- Run static tests.
- Run behaviour tests if database test harness is available.
- Compare legacy role decisions to permission helper decisions.

### Step 4: Deploy Additive Foundation

- Deploy only additive objects.
- Do not replace existing RLS/RPC checks in the same deployment.
- Record backfill counts and unmatched profiles.

### Step 5: Shadow Enforcement Planning

- Select first RPC for shadow checks.
- Recommended first candidates:
  - `patch_tachograph_import_metadata`
  - `get_import_timeline_bundle`
  - `save_tachograph_finding_review`

## Rollback Plan

Because `SEC-007` should be additive, rollback is straightforward if no enforcement swaps are made:

1. Disable new helper usage in app/RPCs if any was accidentally introduced.
2. Drop or ignore new security tables/functions in reverse dependency order if required.
3. Keep existing `profiles.role`, `company_id`, and current RLS policies untouched.
4. No user/business data should require rollback because assignments are derived from existing profiles.

Proposed rollback SQL outline:

```sql
drop function if exists public.actor_can_export(uuid, text, uuid, text);
drop function if exists public.actor_can_access_vehicle(uuid, text);
drop function if exists public.actor_can_access_driver(uuid, text);
drop function if exists public.record_security_event(...);
drop function if exists public.actor_has_permission(text, uuid, uuid);
drop function if exists public.current_actor_legacy_role();
drop function if exists public.current_actor_company_id();
drop table if exists public.security_permission_audit_events;
drop table if exists public.security_role_assignments;
drop table if exists public.security_role_permissions;
drop table if exists public.security_permissions;
drop table if exists public.security_roles;
```

Final rollback SQL must use exact function signatures from the implemented migration.

## Open Decisions Before SEC-007

1. `organisation_owner` backfill: do not auto-grant unless `companies.created_by` is reliable and accepted as ownership source.
2. Export defaults: keep `reporting.report.export` and `tachograph.raw_file.export` denied for backfilled fleet administrators unless explicitly approved.
3. Assignment subject: confirm whether `security_role_assignments.user_id` should reference `profiles.id`, `profiles.user_id`, or both in live data.
4. Audit visibility: decide whether `security_permission_audit_events` are admin-only via future RPC or integrated into the existing Audit Trail UI later.
5. First enforcement swap: choose one RPC for shadow checks after additive foundation is deployed.

## Recommended Next Task

`SEC-007`: implement the additive permission foundation migration and static tests only after fresh live catalog/profile-count evidence is captured.

Do not include these in `SEC-007`:

- site foundation
- site membership enforcement
- Atlas tenant retrieval
- report export snapshots
- support sessions
- ADR-0028 maintenance-rule tables
- broad replacement of existing RLS/RPC checks

## Acceptance Criteria

`SEC-006` is complete when:

- fresh dump attempt is recorded
- evidence limitation is documented
- existing live artefact counts are summarised
- missing permission tables are confirmed from available evidence
- candidate migration filename is proposed
- SQL outline is documented
- seed roles and permission defaults are documented
- backfill count queries are documented
- live catalog query set is documented
- static and database test plans are documented
- rollout and rollback plans are documented
- next task is defined
