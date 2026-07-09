-- MIG-001 read-only live migration drift verification.
-- Run in Supabase Dashboard SQL Editor before any migration repair or db push.

select
  '20260705103000_pairing_timeline_rpc_marker' as check_name,
  pg_get_functiondef('public.pair_tacho_card_import_to_driver(uuid,uuid,uuid,text)'::regprocedure) like '%timeline_generations%' as has_timeline_generations_update,
  pg_get_functiondef('public.pair_tacho_card_import_to_driver(uuid,uuid,uuid,text)'::regprocedure) like '%timeline_events%' as has_timeline_events_update;

select
  '20260705170000_security_foundation_marker' as check_name,
  to_regclass('public.security_roles') is not null as has_security_roles,
  to_regclass('public.security_permissions') is not null as has_security_permissions,
  to_regclass('public.security_role_assignments') is not null as has_security_role_assignments,
  to_regclass('public.security_permission_audit_events') is not null as has_security_permission_audit_events,
  to_regclass('public.organisation_memberships_v') is not null as has_organisation_memberships_view,
  to_regprocedure('public.actor_has_permission(text,uuid,uuid)') is not null as has_actor_has_permission,
  to_regprocedure('public.record_security_event(uuid,uuid,text,text,text,text,uuid,text,text,jsonb,text)') is not null as has_record_security_event;

select
  '20260708120000_sec010_shadow_marker' as check_name,
  pg_get_functiondef('public.patch_tachograph_import_metadata(uuid,jsonb)'::regprocedure) like '%shadow_permission_mismatch%' as has_shadow_mismatch_audit,
  pg_get_functiondef('public.patch_tachograph_import_metadata(uuid,jsonb)'::regprocedure) like '%actor_has_permission(''tachograph.import.update''%' as has_permission_shadow_check;

select
  'migration_history_local_only_expected_repair_targets' as check_name,
  array[
    '20260705170000',
    '20260708120000'
  ] as safe_to_mark_applied_if_markers_true,
  array[
    '20260705103000'
  ] as do_not_mark_applied_until_pairing_timeline_markers_true;
