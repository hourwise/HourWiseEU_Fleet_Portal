-- SEC-009 remaining privileged verification.
-- Run in Supabase Dashboard SQL Editor after SEC-007 migration is applied.
-- These checks require table SELECT access that the Supabase CLI temporary dump role does not have.

-- 1. Seed role count.
select count(*) as security_role_count
from public.security_roles;

-- Expected: 10

-- 2. Seed permission count.
select count(*) as security_permission_count
from public.security_permissions;

-- Expected: 32

-- 3. Role grant counts.
select
  role_key,
  count(*) as grant_count
from public.security_role_permissions
group by role_key
order by role_key;

-- Expected:
-- driver = 6
-- fleet_administrator = 22

-- 4. Denied-by-default fleet administrator permission check.
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

-- 5. Active backfill assignment counts.
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

-- 6. Active legacy profiles without active assignment.
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

-- 7. Assignments without matching active legacy profile.
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

-- 8. Role assignment scope check.
select
  scope_level,
  site_id is null as site_id_is_null,
  count(*) as assignment_count
from public.security_role_assignments
group by scope_level, site_id is null
order by scope_level, site_id_is_null;

-- Expected: only scope_level = organisation and site_id_is_null = true.

-- 9. Compatibility view count.
select
  legacy_role,
  status,
  count(*) as membership_view_count
from public.organisation_memberships_v
group by legacy_role, status
order by legacy_role, status;

-- Expected to align with live profile distribution.

-- 10. Export permission metadata already observed; rerun for completeness.
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
