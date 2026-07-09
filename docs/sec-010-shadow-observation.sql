-- SEC-010 read-only shadow observation.
-- Run from Supabase Dashboard SQL Editor after normal application usage of
-- patch_tachograph_import_metadata.
--
-- Pass condition before any enforcement swap:
-- - mismatch_count = 0 for tachograph.import.update
-- - no recent mismatch detail rows
--
-- Fail condition:
-- - any shadow_permission_mismatch row exists
-- - investigate legacy_allowed vs permission_allowed before changing runtime enforcement

select
  'sec010_shadow_observation_summary' as check_name,
  count(*) filter (
    where reason = 'shadow_permission_mismatch'
      and permission_key = 'tachograph.import.update'
  ) as mismatch_count,
  count(*) filter (
    where reason = 'shadow_permission_mismatch'
      and permission_key = 'tachograph.import.update'
      and created_at >= now() - interval '24 hours'
  ) as mismatch_count_24h,
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
  'sec010_function_shadow_marker' as check_name,
  pg_get_functiondef('public.patch_tachograph_import_metadata(uuid,jsonb)'::regprocedure) like '%shadow_permission_mismatch%' as has_shadow_mismatch_audit,
  pg_get_functiondef('public.patch_tachograph_import_metadata(uuid,jsonb)'::regprocedure) like '%actor_has_permission(''tachograph.import.update''%' as has_permission_shadow_check;
