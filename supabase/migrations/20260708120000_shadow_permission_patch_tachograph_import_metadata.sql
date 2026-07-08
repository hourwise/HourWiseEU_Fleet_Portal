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
