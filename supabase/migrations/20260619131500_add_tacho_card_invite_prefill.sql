-- Preserve decoded tachograph card identity on driver invites so a manager can
-- read a card before the driver has accepted an app invite.

alter table public.driver_invites
  add column if not exists tacho_card_number text null,
  add column if not exists tacho_card_holder_name text null,
  add column if not exists tacho_card_expiry date null,
  add column if not exists tacho_card_issuing_authority text null,
  add column if not exists tacho_source_import_id uuid null references public.tachograph_files(id) on delete set null;

create index if not exists idx_driver_invites_company_tacho_card
  on public.driver_invites(company_id, upper(tacho_card_number))
  where tacho_card_number is not null and btrim(tacho_card_number) <> '';

create or replace function public.lookup_pending_driver_invite(p_invite_code text)
returns table (
  invite_code text,
  email text,
  full_name text,
  company_name text,
  expires_at timestamptz,
  tacho_card_number text,
  tacho_card_holder_name text,
  tacho_card_expiry date,
  tacho_card_issuing_authority text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select
    di.invite_code,
    di.email,
    di.full_name,
    c.name as company_name,
    di.expires_at,
    di.tacho_card_number,
    di.tacho_card_holder_name,
    di.tacho_card_expiry,
    di.tacho_card_issuing_authority
  from public.driver_invites di
  join public.companies c on c.id = di.company_id
  where di.invite_code = upper(trim(p_invite_code))
    and di.status = 'pending'
    and di.expires_at > now()
  limit 1;
end;
$$;

grant execute on function public.lookup_pending_driver_invite(text) to anon, authenticated;

create or replace function public.accept_driver_invite(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  invite_record record;
  profile_record record;
  pay_snapshot jsonb;
  pay_columns text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select
    di.id,
    di.company_id,
    di.email,
    di.full_name,
    di.pay_config_snapshot,
    di.tacho_card_number
  into invite_record
  from public.driver_invites di
  where di.invite_code = upper(trim(p_invite_code))
    and di.status = 'pending'
    and di.expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired invite code';
  end if;

  select p.id, p.email, p.company_id, p.role
  into profile_record
  from public.profiles p
  where p.id = current_user_id
  for update;

  if not found then
    raise exception 'User profile not found';
  end if;

  if lower(coalesce(profile_record.email, '')) <> lower(coalesce(invite_record.email, '')) then
    raise exception 'Invite email does not match the signed-in user';
  end if;

  if profile_record.company_id is not null
     and profile_record.company_id is distinct from invite_record.company_id then
    raise exception 'Signed-in user already belongs to another company';
  end if;

  perform set_config('app.allow_profile_membership_update', 'true', true);

  update public.profiles
  set company_id = invite_record.company_id,
      full_name = coalesce(nullif(invite_record.full_name, ''), full_name),
      role = 'driver',
      tacho_card_number = coalesce(nullif(upper(btrim(invite_record.tacho_card_number)), ''), tacho_card_number)
  where id = current_user_id;

  if to_regclass('public.pay_configurations') is not null then
    pay_snapshot := coalesce(invite_record.pay_config_snapshot, '{}'::jsonb)
      || jsonb_build_object('user_id', current_user_id);

    delete from public.pay_configurations
    where user_id = current_user_id;

    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into pay_columns
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'pay_configurations'
      and c.column_name <> 'id'
      and pay_snapshot ? c.column_name;

    if pay_columns is not null then
      execute format(
        'insert into public.pay_configurations (%1$s) select %1$s from jsonb_populate_record(null::public.pay_configurations, $1)',
        pay_columns
      ) using pay_snapshot;
    end if;
  end if;

  update public.driver_invites
  set status = 'accepted',
      accepted_by_user_id = current_user_id
  where id = invite_record.id
    and status = 'pending';

  if not found then
    raise exception 'Invite was already accepted';
  end if;

  update public.tachograph_files
  set driver_id = current_user_id
  where company_id = invite_record.company_id
    and external_card_number = upper(btrim(invite_record.tacho_card_number))
    and driver_id is null;

  update public.driver_card_downloads
  set driver_id = current_user_id,
      driver_name = coalesce(nullif(invite_record.full_name, ''), driver_name)
  where company_id = invite_record.company_id
    and card_number = upper(btrim(invite_record.tacho_card_number))
    and driver_id is null;

  return jsonb_build_object('success', true, 'company_id', invite_record.company_id);
end;
$$;

grant execute on function public.accept_driver_invite(text) to authenticated;
