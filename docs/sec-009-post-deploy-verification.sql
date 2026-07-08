-- SEC-009 post-deploy verification for SEC-007 additive permission foundation.
-- Run after applying supabase/migrations/20260705170000_add_security_permission_foundation.sql.
-- This script is intended for Supabase Dashboard SQL Editor or privileged psql.

-- 1. Security foundation object presence.
select
  table_schema,
  table_name,
  table_type
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'security_roles',
    'security_permissions',
    'security_role_permissions',
    'security_role_assignments',
    'security_permission_audit_events',
    'organisation_memberships_v'
  )
order by table_type, table_name;

-- 2. RLS state for new security tables.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'security_roles',
    'security_permissions',
    'security_role_permissions',
    'security_role_assignments',
    'security_permission_audit_events'
  )
order by c.relname;

-- 3. Helper function presence and security-definer/search-path posture.
select
  n.nspname as schema_name,
  p.proname,
  p.oid::regprocedure as signature,
  p.prosecdef as security_definer,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'current_actor_company_id',
    'current_actor_legacy_role',
    'actor_has_permission',
    'record_security_event',
    'actor_can_access_driver',
    'actor_can_access_vehicle',
    'actor_can_export',
    'set_security_updated_at'
  )
order by p.proname, p.oid::regprocedure::text;

-- 4. Seed role count.
select count(*) as security_role_count
from public.security_roles;

-- 5. Seed permission count.
select count(*) as security_permission_count
from public.security_permissions;

-- 6. Role grant counts.
select
  role_key,
  count(*) as grant_count
from public.security_role_permissions
group by role_key
order by role_key;

-- 7. Expected denied-by-default fleet administrator permissions.
select
  permission_key,
  count(*) as unexpected_fleet_administrator_grants
from public.security_role_permissions
where role_key = 'fleet_administrator'
  and permission_key in (
    'tachograph.raw_file.export',
    'reporting.report.export',
    'administration.role.admin',
    'support.session.admin',
    'atlas.fleet_summary.read'
  )
group by permission_key
order by permission_key;

-- Expected: no rows.

-- 8. Active backfill assignment counts.
select
  role_key,
  count(*) as active_assignment_count
from public.security_role_assignments
where status = 'active'
group by role_key
order by role_key;

-- Expected for current live test dataset:
-- driver = 17
-- fleet_administrator = 1

-- 9. Active legacy profiles without active assignment.
select
  p.id,
  p.email,
  p.role,
  p.company_id
from public.profiles p
left join public.security_role_assignments sra
  on sra.user_id = p.id
 and sra.company_id = p.company_id
 and sra.status = 'active'
where p.company_id is not null
  and coalesce(p.is_active, true) = true
  and p.role in ('manager', 'driver')
  and sra.id is null
order by p.role, p.email, p.id;

-- Expected: no rows.

-- 10. Assignments without matching active legacy profile.
select
  sra.id,
  sra.user_id,
  sra.company_id,
  sra.role_key,
  sra.status,
  sra.source
from public.security_role_assignments sra
left join public.profiles p
  on p.id = sra.user_id
 and p.company_id = sra.company_id
 and coalesce(p.is_active, true) = true
where sra.status = 'active'
  and sra.source = 'legacy_profile_backfill'
  and p.id is null
order by sra.role_key, sra.user_id;

-- Expected: no rows.

-- 11. Role assignment scope check.
select
  scope_level,
  site_id is null as site_id_is_null,
  count(*) as assignment_count
from public.security_role_assignments
group by scope_level, site_id is null
order by scope_level, site_id_is_null;

-- Expected: only scope_level = organisation and site_id_is_null = true.

-- 12. Site fail-closed constraint smoke test.
do $$
declare
  sample_profile record;
  rejected boolean := false;
begin
  select p.id, p.company_id
  into sample_profile
  from public.profiles p
  where p.company_id is not null
  limit 1;

  if sample_profile.id is null then
    raise notice 'SEC-009 site fail-closed smoke test skipped: no profile with company_id';
    return;
  end if;

  begin
    insert into public.security_role_assignments (
      user_id,
      company_id,
      role_key,
      scope_level,
      site_id,
      status,
      source
    ) values (
      sample_profile.id,
      sample_profile.company_id,
      'driver',
      'site',
      gen_random_uuid(),
      'active',
      'system'
    );
  exception
    when check_violation then
      rejected := true;
  end;

  if rejected is not true then
    raise exception 'SEC-009 failure: site-scope assignment was not rejected';
  end if;
end $$;

-- Expected: DO block completes. If the check constraint does not reject site scope,
-- the block raises an exception and the migration must not be accepted.

-- 13. Catalogue readability check through compatibility view.
select
  legacy_role,
  status,
  count(*) as membership_view_count
from public.organisation_memberships_v
group by legacy_role, status
order by legacy_role, status;

-- 14. Export preflight denied-default metadata check.
select
  sp.key,
  sp.requires_audit,
  sp.risk_level
from public.security_permissions sp
where sp.key in (
  'tachograph.raw_file.export',
  'reporting.report.export'
)
order by sp.key;
