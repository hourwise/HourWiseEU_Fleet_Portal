-- SEC-012 read-only RBAC/security health-check pack.
-- Run in Supabase Dashboard SQL Editor.
--
-- Expected green state for the current live test dataset:
-- - security_role_count = 10
-- - security_permission_count = 32
-- - driver grant_count = 6
-- - fleet_administrator grant_count = 22
-- - denied-default fleet administrator unexpected grants = 0
-- - active legacy profile assignment gaps = 0
-- - orphaned legacy backfill assignments = 0
-- - assignment scope is organisation-only with site_id null
-- - SEC-010 shadow mismatch counts = 0

select
  'sec012_catalog_counts' as check_name,
  (select count(*) from public.security_roles) as security_role_count,
  (select count(*) from public.security_permissions) as security_permission_count,
  (select count(*) from public.security_roles) = 10 as security_role_count_ok,
  (select count(*) from public.security_permissions) = 32 as security_permission_count_ok;

select
  'sec012_role_grant_counts' as check_name,
  sr.key as role_key,
  count(srp.permission_key) as grant_count,
  case sr.key
    when 'driver' then count(srp.permission_key) = 6
    when 'fleet_administrator' then count(srp.permission_key) = 22
    else true
  end as expected_count_ok
from public.security_roles sr
left join public.security_role_permissions srp
  on srp.role_key = sr.key
where sr.key in ('driver', 'fleet_administrator')
group by sr.key
order by sr.key;

select
  'sec012_denied_default_fleet_administrator_grants' as check_name,
  count(*) as unexpected_grant_count,
  count(*) = 0 as expected_count_ok
from public.security_role_permissions
where role_key = 'fleet_administrator'
  and permission_key in (
    'tachograph.raw_file.export',
    'reporting.report.export',
    'administration.role.admin',
    'support.session.admin',
    'atlas.fleet_summary.read'
  );

select
  'sec012_active_assignment_counts' as check_name,
  role_key,
  count(*) as active_assignment_count
from public.security_role_assignments
where status = 'active'
group by role_key
order by role_key;

select
  'sec012_active_legacy_profiles_without_assignment' as check_name,
  count(*) as gap_count,
  count(*) = 0 as expected_count_ok
from public.profiles p
left join public.security_role_assignments sra
  on sra.user_id = p.id
 and sra.company_id = p.company_id
 and sra.status = 'active'
where p.company_id is not null
  and coalesce(p.is_active, true) = true
  and p.role in ('manager', 'driver')
  and sra.id is null;

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

select
  'sec012_orphaned_legacy_backfill_assignments' as check_name,
  count(*) as orphaned_assignment_count,
  count(*) = 0 as expected_count_ok
from public.security_role_assignments sra
left join public.profiles p
  on p.id = sra.user_id
 and p.company_id = sra.company_id
 and coalesce(p.is_active, true) = true
where sra.status = 'active'
  and sra.source = 'legacy_profile_backfill'
  and p.id is null;

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

select
  'sec012_assignment_scope_summary' as check_name,
  scope_level,
  site_id is null as site_id_is_null,
  count(*) as assignment_count,
  scope_level = 'organisation' and site_id is null as expected_scope_ok
from public.security_role_assignments
group by scope_level, site_id is null, site_id
order by scope_level, site_id_is_null;

select
  'sec012_compatibility_view_counts' as check_name,
  legacy_role,
  status,
  count(*) as membership_view_count
from public.organisation_memberships_v
group by legacy_role, status
order by legacy_role, status;

select
  'sec012_export_permission_metadata' as check_name,
  sp.key,
  sp.requires_audit,
  sp.risk_level,
  sp.requires_audit = true and sp.risk_level = 'critical' as expected_metadata_ok
from public.security_permissions sp
where sp.key in (
  'tachograph.raw_file.export',
  'reporting.report.export'
)
order by sp.key;

select
  'sec012_sec010_shadow_summary' as check_name,
  count(*) filter (
    where reason = 'shadow_permission_mismatch'
      and permission_key = 'tachograph.import.update'
  ) as mismatch_count,
  count(*) filter (
    where reason = 'shadow_permission_mismatch'
      and permission_key = 'tachograph.import.update'
      and created_at >= now() - interval '24 hours'
  ) as mismatch_count_24h,
  count(*) filter (
    where reason = 'shadow_permission_mismatch'
      and permission_key = 'tachograph.import.update'
  ) = 0 as expected_count_ok,
  min(created_at) filter (
    where reason = 'shadow_permission_mismatch'
      and permission_key = 'tachograph.import.update'
  ) as first_mismatch_at,
  max(created_at) filter (
    where reason = 'shadow_permission_mismatch'
      and permission_key = 'tachograph.import.update'
  ) as last_mismatch_at
from public.security_permission_audit_events;

select
  created_at,
  actor_user_id,
  company_id,
  permission_key,
  decision,
  reason,
  resource_type,
  resource_id,
  operation,
  metadata ->> 'legacy_role' as legacy_role,
  (metadata ->> 'legacy_allowed')::boolean as legacy_allowed,
  (metadata ->> 'permission_allowed')::boolean as permission_allowed,
  metadata ->> 'shadow_comparison' as shadow_comparison,
  metadata
from public.security_permission_audit_events
where reason = 'shadow_permission_mismatch'
  and permission_key = 'tachograph.import.update'
order by created_at desc
limit 50;

select
  'sec012_deployed_function_markers' as check_name,
  pg_get_functiondef('public.pair_tacho_card_import_to_driver(uuid,uuid,uuid,text)'::regprocedure) like '%timeline_generations%' as pairing_has_timeline_generations_update,
  pg_get_functiondef('public.pair_tacho_card_import_to_driver(uuid,uuid,uuid,text)'::regprocedure) like '%timeline_events%' as pairing_has_timeline_events_update,
  pg_get_functiondef('public.patch_tachograph_import_metadata(uuid,jsonb)'::regprocedure) like '%shadow_permission_mismatch%' as sec010_has_shadow_mismatch_audit,
  pg_get_functiondef('public.patch_tachograph_import_metadata(uuid,jsonb)'::regprocedure) like '%actor_has_permission(''tachograph.import.update''%' as sec010_has_permission_shadow_check;

select
  'sec012_migration_history_note' as check_name,
  'supabase migration list --linked aligned local and remote through 20260708120000 on 2026-07-08 after MIG-001 repair' as note,
  to_regclass('supabase_migrations.schema_migrations') is not null as migration_history_table_visible_from_sql;
