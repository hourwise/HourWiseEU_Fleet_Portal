-- DATA-003: convert destructive driver-card purge/reset flows to archive-only.
-- Existing function names are retained for compatibility, but behaviour now
-- preserves raw imports, derived rows, parser runs, and driver signal history.

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

  update public.tachograph_files
  set status = 'pending',
      metadata = jsonb_strip_nulls(
        coalesce(metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'manager_reprocess_requested_at', prepared_at,
          'manager_reprocess_requested_by_user_id', auth.uid(),
          'manager_reprocess_reason', nullif(btrim(coalesce(p_reason, '')), ''),
          'manager_reprocess_strategy', 'archive_only_preserve_existing_rows',
          'manager_reprocess_existing_rows_retained', true,
          'processing_kickoff_error', null,
          'processing_dispatch_error', null,
          'processing_error', null,
          'summary', 'Manager requested tachograph signal rebuild. Existing derived rows and parser history were retained for audit; new processing must create a distinct parser run.'
        )
      )
  where id = p_import_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'importId', p_import_id,
    'driverId', import_record.driver_id,
    'prepared', true,
    'preparedAt', prepared_at,
    'existingRowsRetained', true,
    'strategy', 'archive_only_preserve_existing_rows'
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
  archived_at timestamptz := now();
  archive_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if public.get_my_role() is distinct from 'manager'
     or public.get_my_company_id() is distinct from p_company_id then
    raise exception 'Only a manager can archive tachograph card reads for their own company';
  end if;

  select
    coalesce(array_agg(tf.id), array[]::uuid[]),
    coalesce(array_agg(distinct tf.driver_id) filter (where tf.driver_id is not null), array[]::uuid[]),
    coalesce(array_agg(tf.file_path) filter (where tf.file_path is not null and btrim(tf.file_path) <> ''), array[]::text[])
  into import_ids, linked_driver_ids, storage_paths
  from public.tachograph_files tf
  where tf.company_id = p_company_id
    and coalesce(tf.source_type, 'driver_card') = 'driver_card'
    and coalesce(tf.metadata->>'driver_card_retention_state', 'active') <> 'archived'
    and coalesce(tf.metadata->>'candidate_import_archived_at', '') = ''
    and (coalesce(p_include_linked, true) or tf.driver_id is null);

  import_count := coalesce(array_length(import_ids, 1), 0);
  linked_driver_count := coalesce(array_length(linked_driver_ids, 1), 0);

  if coalesce(p_dry_run, true) then
    return jsonb_build_object(
      'dryRun', true,
      'archived', false,
      'deleted', false,
      'importCount', import_count,
      'archivedCount', 0,
      'linkedDriverCount', linked_driver_count,
      'storagePaths', storage_paths,
      'storageObjectsRetained', true
    );
  end if;

  if import_count > 0 then
    update public.tachograph_files
    set metadata = jsonb_strip_nulls(
      coalesce(metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'driver_card_retention_state', 'archived',
        'driver_card_purge_archived_at', archived_at,
        'driver_card_purge_archived_by_user_id', auth.uid(),
        'driver_card_purge_archive_reason', archive_reason,
        'driver_card_purge_strategy', 'archive_only_preserve_rows',
        'driver_card_purge_existing_rows_retained', true,
        'driver_card_purge_storage_objects_retained', true,
        'helper_capture_active_analysis_rows', false,
        'summary', 'Driver-card read archived by manager reset. Raw storage, import metadata, derived rows, parser runs, and signal history were retained for audit.'
      )
    )
    where company_id = p_company_id
      and id = any(import_ids);
  end if;

  return jsonb_build_object(
    'dryRun', false,
    'archived', true,
    'deleted', false,
    'importCount', import_count,
    'archivedCount', import_count,
    'linkedDriverCount', linked_driver_count,
    'storagePaths', storage_paths,
    'storageObjectsRetained', true,
    'derivedRowsRetained', true,
    'parserRunsRetained', true,
    'driverSignalsRetained', true,
    'archivedAt', archived_at,
    'reason', archive_reason
  );
end;
$$;

grant execute on function public.purge_company_driver_card_reads(uuid, boolean, boolean, text) to authenticated;
