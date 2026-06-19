-- Manual tachograph card pairing for read-only helper captures and parsed card imports.
-- Profiles are auth-backed app users, so unmatched card reads are linked to a real
-- driver profile once a manager confirms the match.

alter table public.profiles
  add column if not exists tacho_card_number text null;

create unique index if not exists idx_profiles_company_tacho_card_number
  on public.profiles(company_id, upper(tacho_card_number))
  where tacho_card_number is not null and btrim(tacho_card_number) <> '';

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
