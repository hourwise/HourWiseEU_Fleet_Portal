-- SEC-010 live deploy and verification script.
-- Purpose:
-- 1. Apply only the SEC-010 RPC replacement.
-- 2. Run one normal manager-scoped metadata patch through the RPC.
-- 3. Inspect shadow_permission_mismatch audit rows.
--
-- This script intentionally does not repair Supabase migration history.
-- If it is run through Dashboard SQL, follow up with:
--   supabase migration repair --status applied 20260708120000

begin;

create or replace function public.patch_tachograph_import_metadata(
  p_import_id uuid,
  p_metadata_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_metadata jsonb;
  actor_role text := public.get_my_role();
  actor_company_id uuid := public.get_my_company_id();
  target_company_id uuid;
  legacy_allowed boolean;
  permission_allowed boolean := false;
begin
  select tf.company_id
  into target_company_id
  from public.tachograph_files tf
  where tf.id = p_import_id;

  legacy_allowed := coalesce(
    actor_role = 'manager'
    and target_company_id is not null
    and target_company_id = actor_company_id,
    false
  );

  begin
    permission_allowed := coalesce(
      target_company_id is not null
      and public.actor_has_permission('tachograph.import.update', target_company_id, null),
      false
    );

    if legacy_allowed is distinct from permission_allowed then
      perform public.record_security_event(
        target_company_id,
        null,
        'tachograph.import.update',
        case when permission_allowed then 'allowed' else 'denied' end,
        'shadow_permission_mismatch',
        'tachograph_import',
        p_import_id,
        'patch_metadata',
        null,
        jsonb_build_object(
          'shadow_comparison', 'patch_tachograph_import_metadata',
          'legacy_allowed', legacy_allowed,
          'permission_allowed', permission_allowed,
          'legacy_role', actor_role,
          'actor_company_id', actor_company_id
        ),
        'user'
      );
    end if;
  exception
    when others then
      raise warning 'SEC-010 shadow permission comparison failed for patch_tachograph_import_metadata import_id=%: %',
        p_import_id,
        sqlerrm;
  end;

  if actor_role <> 'manager' then
    raise exception 'Only managers can patch tachograph import metadata'
      using errcode = '42501';
  end if;

  update public.tachograph_files
  set metadata = jsonb_strip_nulls(coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata_patch, '{}'::jsonb))
  where id = p_import_id
    and company_id = actor_company_id
  returning metadata into updated_metadata;

  if updated_metadata is null then
    raise exception 'Tachograph import not found for current company'
      using errcode = '42501';
  end if;

  return updated_metadata;
end;
$$;

revoke all on function public.patch_tachograph_import_metadata(uuid, jsonb) from public;
revoke all on function public.patch_tachograph_import_metadata(uuid, jsonb) from anon;
grant execute on function public.patch_tachograph_import_metadata(uuid, jsonb) to authenticated;

commit;

select
  'function_deployed' as check_name,
  pg_get_functiondef('public.patch_tachograph_import_metadata(uuid,jsonb)'::regprocedure) like '%shadow_permission_mismatch%' as passed;

create temp table if not exists sec010_verification_context (
  manager_user_id uuid,
  company_id uuid,
  import_id uuid,
  patched_metadata jsonb,
  verified_at timestamptz
) on commit preserve rows;

truncate table sec010_verification_context;

do $$
declare
  manager_profile record;
  selected_import_id uuid;
  patched_metadata jsonb;
begin
  select p.id, p.company_id
  into manager_profile
  from public.profiles p
  where p.role = 'manager'
    and p.company_id is not null
    and coalesce(p.is_active, true) = true
  order by p.id
  limit 1;

  if manager_profile.id is null then
    raise exception 'SEC-010 verification could not find an active manager profile with company_id';
  end if;

  select tf.id
  into selected_import_id
  from public.tachograph_files tf
  where tf.company_id = manager_profile.company_id
  order by tf.uploaded_at desc nulls last, tf.id
  limit 1;

  if selected_import_id is null then
    raise exception 'SEC-010 verification could not find a tachograph import for manager company %', manager_profile.company_id;
  end if;

  perform set_config('request.jwt.claim.sub', manager_profile.id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', manager_profile.id::text, 'role', 'authenticated')::text,
    true
  );

  patched_metadata := public.patch_tachograph_import_metadata(
    selected_import_id,
    jsonb_build_object(
      'sec010_shadow_verification', true,
      'sec010_shadow_verified_at', now()
    )
  );

  insert into sec010_verification_context (
    manager_user_id,
    company_id,
    import_id,
    patched_metadata,
    verified_at
  ) values (
    manager_profile.id,
    manager_profile.company_id,
    selected_import_id,
    patched_metadata,
    now()
  );
end;
$$;

select
  'manager_patch_executed' as check_name,
  manager_user_id,
  company_id,
  import_id,
  verified_at,
  patched_metadata ? 'sec010_shadow_verification' as metadata_patch_present
from sec010_verification_context;

select
  'shadow_permission_mismatch_count' as check_name,
  count(*) as mismatch_count
from public.security_permission_audit_events
where reason = 'shadow_permission_mismatch'
  and permission_key = 'tachograph.import.update';

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
  metadata
from public.security_permission_audit_events
where reason = 'shadow_permission_mismatch'
  and permission_key = 'tachograph.import.update'
order by created_at desc
limit 50;
