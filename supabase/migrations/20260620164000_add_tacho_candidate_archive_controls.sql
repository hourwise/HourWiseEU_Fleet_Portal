-- Manager-controlled cleanup for candidate/no-hire tachograph card reads.
-- Candidate imports are retained as audit rows, while derived candidate analysis rows
-- can be cleared and the private storage object can optionally be deleted by the UI.

create or replace function public.archive_tacho_candidate_import(
  p_company_id uuid,
  p_import_id uuid,
  p_delete_storage_file boolean default false,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  import_record public.tachograph_files%rowtype;
  archive_action text := case when coalesce(p_delete_storage_file, false) then 'delete_file' else 'keep_file' end;
  archived_at timestamptz := now();
  review_decision text;
begin
  if public.get_my_role() is distinct from 'manager'
     or public.get_my_company_id() is distinct from p_company_id then
    raise exception 'Only a manager can archive candidate tachograph imports for their own company';
  end if;

  select *
  into import_record
  from public.tachograph_files
  where id = p_import_id
    and company_id = p_company_id
    and coalesce(source_type, 'driver_card') = 'driver_card'
  for update;

  if not found then
    raise exception 'Candidate driver-card import was not found for this company';
  end if;

  if import_record.driver_id is not null then
    raise exception 'Linked driver-card imports cannot be archived through candidate cleanup';
  end if;

  review_decision := coalesce(import_record.metadata ->> 'candidate_review_decision', 'no_hire');

  delete from public.tachograph_activities
  where file_id::text = p_import_id::text;

  delete from public.tachograph_speed_logs
  where file_id::text = p_import_id::text;

  delete from public.driver_card_downloads
  where import_id = p_import_id
    and company_id = p_company_id
    and driver_id is null;

  delete from public.tachograph_activity_segments
  where import_id = p_import_id
    and company_id = p_company_id
    and driver_id is null;

  delete from public.tachograph_day_summaries
  where import_id = p_import_id
    and company_id = p_company_id
    and driver_id is null;

  delete from public.tachograph_findings
  where import_id = p_import_id
    and company_id = p_company_id
    and driver_id is null;

  delete from public.tachograph_technical_events
  where import_id = p_import_id
    and company_id = p_company_id
    and driver_id is null;

  if to_regclass('public.tachograph_reconciliation_items') is not null then
    delete from public.tachograph_reconciliation_items
    where import_id = p_import_id
      and company_id = p_company_id
      and driver_id is null;
  end if;

  if to_regclass('public.tachograph_vehicle_motion_discrepancies') is not null then
    delete from public.tachograph_vehicle_motion_discrepancies
    where import_id = p_import_id
      and company_id = p_company_id
      and driver_id is null;
  end if;

  update public.tachograph_files
  set metadata = jsonb_strip_nulls(
    coalesce(metadata, '{}'::jsonb) ||
    jsonb_build_object(
      'candidate_review_decision', review_decision,
      'candidate_import_archived_at', archived_at,
      'candidate_import_archived_by_user_id', auth.uid(),
      'candidate_import_archive_reason', nullif(btrim(coalesce(p_reason, '')), ''),
      'candidate_import_archive_storage_action', archive_action,
      'candidate_import_storage_delete_requested_at', case when p_delete_storage_file then archived_at else null end,
      'helper_capture_active_analysis_rows', false,
      'summary', case
        when p_delete_storage_file then 'Candidate card read archived for cleanup. Audit row retained; storage deletion requested.'
        else 'Candidate card read archived for cleanup. Audit row and storage file retained.'
      end
    )
  )
  where id = p_import_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'importId', p_import_id,
    'archived', true,
    'storagePath', import_record.file_path,
    'storageDeleteRequested', coalesce(p_delete_storage_file, false)
  );
end;
$$;

grant execute on function public.archive_tacho_candidate_import(uuid, uuid, boolean, text) to authenticated;

create or replace function public.confirm_tacho_candidate_import_storage_deleted(
  p_company_id uuid,
  p_import_id uuid,
  p_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  import_record public.tachograph_files%rowtype;
  deleted_at timestamptz := now();
begin
  if public.get_my_role() is distinct from 'manager'
     or public.get_my_company_id() is distinct from p_company_id then
    raise exception 'Only a manager can confirm candidate import storage deletion for their own company';
  end if;

  select *
  into import_record
  from public.tachograph_files
  where id = p_import_id
    and company_id = p_company_id
    and coalesce(source_type, 'driver_card') = 'driver_card'
  for update;

  if not found then
    raise exception 'Candidate driver-card import was not found for this company';
  end if;

  if import_record.driver_id is not null then
    raise exception 'Linked driver-card imports cannot be updated through candidate cleanup';
  end if;

  if coalesce(import_record.file_path, '') <> coalesce(p_storage_path, '') then
    raise exception 'Storage path does not match the candidate import audit row';
  end if;

  update public.tachograph_files
  set metadata = jsonb_strip_nulls(
    coalesce(metadata, '{}'::jsonb) ||
    jsonb_build_object(
      'candidate_import_storage_deleted_at', deleted_at,
      'candidate_import_storage_deleted_by_user_id', auth.uid()
    )
  )
  where id = p_import_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'importId', p_import_id,
    'storageDeleted', true,
    'storagePath', p_storage_path
  );
end;
$$;

grant execute on function public.confirm_tacho_candidate_import_storage_deleted(uuid, uuid, text) to authenticated;

create index if not exists idx_tachograph_files_candidate_archive
  on public.tachograph_files(company_id, source_type, uploaded_at desc)
  where metadata ? 'candidate_import_archived_at';
