-- Manager repair controls for linked driver-card reads.
-- Reprocess preparation clears import-derived analysis rows before the existing
-- process-tacho edge function is invoked again. It deliberately keeps historical
-- driver signal rows so a failed retry does not remove the last visible signal.

create or replace function public.prepare_tacho_import_reprocess(
  p_company_id uuid,
  p_import_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  import_record public.tachograph_files%rowtype;
  prepared_at timestamptz := now();
begin
  if public.get_my_role() is distinct from 'manager'
     or public.get_my_company_id() is distinct from p_company_id then
    raise exception 'Only a manager can prepare tachograph import reprocessing for their own company';
  end if;

  select *
  into import_record
  from public.tachograph_files
  where id = p_import_id
    and company_id = p_company_id
    and coalesce(source_type, 'driver_card') = 'driver_card'
  for update;

  if not found then
    raise exception 'Driver-card import was not found for this company';
  end if;

  if import_record.driver_id is null then
    raise exception 'Driver-card import must be linked to a driver before signal rebuild';
  end if;

  delete from public.tachograph_activities
  where file_id::text = p_import_id::text;

  delete from public.tachograph_speed_logs
  where file_id::text = p_import_id::text;

  delete from public.driver_card_downloads
  where import_id = p_import_id
    and company_id = p_company_id;

  delete from public.tachograph_activity_segments
  where import_id = p_import_id
    and company_id = p_company_id;

  delete from public.tachograph_day_summaries
  where import_id = p_import_id
    and company_id = p_company_id;

  delete from public.tachograph_findings
  where import_id = p_import_id
    and company_id = p_company_id;

  delete from public.tachograph_technical_events
  where import_id = p_import_id
    and company_id = p_company_id;

  if to_regclass('public.tachograph_reconciliation_items') is not null then
    delete from public.tachograph_reconciliation_items
    where import_id = p_import_id
      and company_id = p_company_id;
  end if;

  if to_regclass('public.tachograph_vehicle_motion_discrepancies') is not null then
    delete from public.tachograph_vehicle_motion_discrepancies
    where import_id = p_import_id
      and company_id = p_company_id;
  end if;

  if to_regclass('public.tachograph_processing_runs') is not null then
    delete from public.tachograph_processing_runs
    where import_id = p_import_id
      and company_id = p_company_id;
  end if;

  update public.tachograph_files
  set status = 'pending',
      metadata = jsonb_strip_nulls(
        coalesce(metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'manager_reprocess_requested_at', prepared_at,
          'manager_reprocess_requested_by_user_id', auth.uid(),
          'manager_reprocess_reason', nullif(btrim(coalesce(p_reason, '')), ''),
          'processing_kickoff_error', null,
          'processing_dispatch_error', null,
          'processing_error', null,
          'helper_capture_active_analysis_rows', true,
          'summary', 'Manager requested tachograph signal rebuild. Derived rows were cleared and the import is ready for processing retry.'
        )
      )
  where id = p_import_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'importId', p_import_id,
    'driverId', import_record.driver_id,
    'prepared', true,
    'preparedAt', prepared_at
  );
end;
$$;

grant execute on function public.prepare_tacho_import_reprocess(uuid, uuid, text) to authenticated;

create or replace function public.purge_company_driver_card_reads(
  p_company_id uuid,
  p_dry_run boolean default true,
  p_include_linked boolean default true,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  import_ids uuid[];
  linked_driver_ids uuid[];
  storage_paths text[];
  import_count integer := 0;
  linked_driver_count integer := 0;
begin
  if public.get_my_role() is distinct from 'manager'
     or public.get_my_company_id() is distinct from p_company_id then
    raise exception 'Only a manager can purge tachograph card reads for their own company';
  end if;

  select
    coalesce(array_agg(tf.id), array[]::uuid[]),
    coalesce(array_agg(distinct tf.driver_id) filter (where tf.driver_id is not null), array[]::uuid[]),
    coalesce(array_agg(tf.file_path) filter (where tf.file_path is not null and btrim(tf.file_path) <> ''), array[]::text[])
  into import_ids, linked_driver_ids, storage_paths
  from public.tachograph_files tf
  where tf.company_id = p_company_id
    and coalesce(tf.source_type, 'driver_card') = 'driver_card'
    and (coalesce(p_include_linked, true) or tf.driver_id is null);

  import_count := coalesce(array_length(import_ids, 1), 0);
  linked_driver_count := coalesce(array_length(linked_driver_ids, 1), 0);

  if coalesce(p_dry_run, true) then
    return jsonb_build_object(
      'dryRun', true,
      'importCount', import_count,
      'linkedDriverCount', linked_driver_count,
      'storagePaths', storage_paths
    );
  end if;

  if import_count = 0 then
    return jsonb_build_object(
      'dryRun', false,
      'deleted', true,
      'importCount', 0,
      'linkedDriverCount', 0,
      'storagePaths', storage_paths
    );
  end if;

  delete from public.tachograph_activities
  where file_id::text in (select unnest(import_ids)::text);

  delete from public.tachograph_speed_logs
  where file_id::text in (select unnest(import_ids)::text);

  delete from public.driver_card_downloads
  where company_id = p_company_id
    and import_id = any(import_ids);

  delete from public.tachograph_activity_segments
  where company_id = p_company_id
    and import_id = any(import_ids);

  delete from public.tachograph_day_summaries
  where company_id = p_company_id
    and import_id = any(import_ids);

  delete from public.tachograph_findings
  where company_id = p_company_id
    and import_id = any(import_ids);

  delete from public.tachograph_technical_events
  where company_id = p_company_id
    and import_id = any(import_ids);

  if to_regclass('public.tachograph_reconciliation_items') is not null then
    delete from public.tachograph_reconciliation_items
    where company_id = p_company_id
      and import_id = any(import_ids);
  end if;

  if to_regclass('public.tachograph_vehicle_motion_discrepancies') is not null then
    delete from public.tachograph_vehicle_motion_discrepancies
    where company_id = p_company_id
      and import_id = any(import_ids);
  end if;

  if to_regclass('public.tachograph_processing_runs') is not null then
    delete from public.tachograph_processing_runs
    where company_id = p_company_id
      and import_id = any(import_ids);
  end if;

  if linked_driver_count > 0 then
    delete from public.driver_tacho_compliance_signals
    where company_id = p_company_id
      and driver_id = any(linked_driver_ids);

    delete from public.driver_tacho_risk_signals
    where company_id = p_company_id
      and driver_id = any(linked_driver_ids);
  end if;

  delete from public.tachograph_files
  where company_id = p_company_id
    and id = any(import_ids);

  return jsonb_build_object(
    'dryRun', false,
    'deleted', true,
    'importCount', import_count,
    'linkedDriverCount', linked_driver_count,
    'storagePaths', storage_paths,
    'reason', nullif(btrim(coalesce(p_reason, '')), '')
  );
end;
$$;

grant execute on function public.purge_company_driver_card_reads(uuid, boolean, boolean, text) to authenticated;
