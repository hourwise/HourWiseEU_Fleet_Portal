-- Keep manual driver-card pairing aligned with the newer timeline read models.
-- The original pairing RPC predates timeline_generations/timeline_events, so
-- unlinked helper reads could be paired to a driver while timeline rows stayed
-- driver_id null and remained invisible from the driver workspace.

create or replace function public.pair_tacho_card_import_to_driver(
  p_company_id uuid,
  p_import_id uuid,
  p_driver_id uuid,
  p_card_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  import_record public.tachograph_files%rowtype;
  driver_record public.profiles%rowtype;
  existing_driver_id uuid;
  resolved_card_number text;
  previous_card_driver_name text;
begin
  if public.get_my_role() is distinct from 'manager'
     or public.get_my_company_id() is distinct from p_company_id then
    raise exception 'Only a manager can pair tachograph cards for their own company';
  end if;

  select *
  into import_record
  from public.tachograph_files
  where id = p_import_id
    and company_id = p_company_id
    and coalesce(source_type, 'driver_card') = 'driver_card';

  if not found then
    raise exception 'Driver-card import was not found for this company';
  end if;

  select *
  into driver_record
  from public.profiles
  where id = p_driver_id
    and company_id = p_company_id
    and role = 'driver';

  if not found then
    raise exception 'Selected driver profile was not found for this company';
  end if;

  resolved_card_number := upper(btrim(coalesce(
    nullif(p_card_number, ''),
    nullif(import_record.external_card_number, ''),
    nullif(import_record.metadata ->> 'driver_card_number_hint', '')
  )));

  if resolved_card_number is null or resolved_card_number = '' then
    raise exception 'No tachograph card number is available on this import';
  end if;

  select id
  into existing_driver_id
  from public.profiles
  where company_id = p_company_id
    and id <> p_driver_id
    and upper(tacho_card_number) = resolved_card_number
  limit 1;

  if existing_driver_id is not null then
    raise exception 'This tachograph card is already paired to another driver profile';
  end if;

  previous_card_driver_name := coalesce(
    import_record.metadata ->> 'card_driver_name',
    import_record.metadata ->> 'driver_name'
  );

  update public.profiles
  set tacho_card_number = resolved_card_number
  where id = p_driver_id;

  update public.tachograph_files
  set
    driver_id = p_driver_id,
    external_card_number = resolved_card_number,
    metadata = jsonb_strip_nulls(
      coalesce(metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'driver_name', driver_record.full_name,
        'driver_card_number_hint', resolved_card_number,
        'card_driver_name', previous_card_driver_name,
        'paired_driver_id', p_driver_id,
        'paired_driver_name', driver_record.full_name,
        'paired_at', now(),
        'paired_by_user_id', auth.uid()
      )
    )
  where id = p_import_id;

  update public.driver_card_downloads
  set
    driver_id = p_driver_id,
    driver_name = driver_record.full_name,
    card_number = resolved_card_number
  where import_id = p_import_id
    and company_id = p_company_id;

  update public.tachograph_activity_segments
  set driver_id = p_driver_id
  where import_id = p_import_id
    and company_id = p_company_id;

  update public.tachograph_day_summaries
  set driver_id = p_driver_id
  where import_id = p_import_id
    and company_id = p_company_id;

  update public.tachograph_findings
  set driver_id = p_driver_id
  where import_id = p_import_id
    and company_id = p_company_id;

  update public.tachograph_technical_events
  set driver_id = p_driver_id
  where import_id = p_import_id
    and company_id = p_company_id;

  if to_regclass('public.tachograph_reconciliation_items') is not null then
    update public.tachograph_reconciliation_items
    set driver_id = p_driver_id
    where import_id = p_import_id
      and company_id = p_company_id;
  end if;

  if to_regclass('public.timeline_generations') is not null then
    update public.timeline_generations
    set
      driver_id = p_driver_id,
      scope_type = case when scope_type = 'import' then 'driver' else scope_type end,
      scope_id = case when scope_type = 'import' or scope_id is null then p_driver_id else scope_id end,
      generated_reason = case when generated_reason = 'initial_import' then 'pairing_changed' else generated_reason end,
      metadata = jsonb_strip_nulls(
        coalesce(metadata, '{}'::jsonb) ||
        jsonb_build_object(
          'paired_driver_id', p_driver_id,
          'paired_driver_name', driver_record.full_name,
          'paired_at', now(),
          'paired_by_user_id', auth.uid()
        )
      )
    where source_import_id = p_import_id
      and company_id = p_company_id;
  end if;

  if to_regclass('public.timeline_events') is not null then
    update public.timeline_events
    set driver_id = p_driver_id
    where company_id = p_company_id
      and (
        import_file_id = p_import_id
        or timeline_generation_id in (
          select id
          from public.timeline_generations
          where source_import_id = p_import_id
            and company_id = p_company_id
        )
      );
  end if;

  if to_regclass('public.timeline_gaps') is not null then
    update public.timeline_gaps
    set driver_id = p_driver_id
    where company_id = p_company_id
      and timeline_generation_id in (
        select id
        from public.timeline_generations
        where source_import_id = p_import_id
          and company_id = p_company_id
      );
  end if;

  if to_regclass('public.daily_timeline_summaries') is not null then
    update public.daily_timeline_summaries
    set driver_id = p_driver_id
    where company_id = p_company_id
      and timeline_generation_id in (
        select id
        from public.timeline_generations
        where source_import_id = p_import_id
          and company_id = p_company_id
      );
  end if;

  return jsonb_build_object(
    'importId', p_import_id,
    'driverId', p_driver_id,
    'driverName', driver_record.full_name,
    'cardNumber', resolved_card_number,
    'paired', true
  );
end;
$$;

grant execute on function public.pair_tacho_card_import_to_driver(uuid, uuid, uuid, text) to authenticated;
