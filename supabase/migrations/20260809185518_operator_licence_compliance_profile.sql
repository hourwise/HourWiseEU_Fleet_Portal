-- Batch 4: persistent company-scoped O-Licence current record.
-- This is intentionally additive. It does not add regulatory fields to companies
-- and it does not create a history table until the product has a versioned-record
-- requirement.

create table public.company_operator_licence_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  operator_licence_number text null,
  operator_licence_region text null,
  operator_licence_type text null,
  operator_licence_status text null,
  operator_licence_expiry date null,
  authorised_vehicle_count integer not null default 0,
  authorised_trailer_count integer not null default 0,
  transport_manager_name text null,
  transport_manager_cpc_expiry date null,
  created_by uuid null references public.profiles(id) on delete set null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_operator_licence_profiles_type_check check (
    operator_licence_type is null
    or operator_licence_type in ('standard_national', 'standard_international', 'restricted')
  ),
  constraint company_operator_licence_profiles_status_check check (
    operator_licence_status is null
    or operator_licence_status in ('valid', 'suspended', 'curtailed', 'revoked')
  ),
  constraint company_operator_licence_profiles_vehicle_count_check check (authorised_vehicle_count >= 0),
  constraint company_operator_licence_profiles_trailer_count_check check (authorised_trailer_count >= 0),
  constraint company_operator_licence_profiles_number_not_blank_check check (
    operator_licence_number is null or length(trim(operator_licence_number)) > 0
  ),
  constraint company_operator_licence_profiles_region_not_blank_check check (
    operator_licence_region is null or length(trim(operator_licence_region)) > 0
  ),
  constraint company_operator_licence_profiles_manager_not_blank_check check (
    transport_manager_name is null or length(trim(transport_manager_name)) > 0
  )
);

create index company_operator_licence_profiles_company_idx
  on public.company_operator_licence_profiles (company_id);

create or replace function public.set_company_operator_licence_profile_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_company_operator_licence_profile_updated_at
  before update on public.company_operator_licence_profiles
  for each row execute function public.set_company_operator_licence_profile_updated_at();

alter table public.company_operator_licence_profiles enable row level security;

insert into public.security_permissions (key, area, resource, operation, description, risk_level, requires_audit)
values
  ('compliance.operator_licence.read', 'compliance', 'operator_licence', 'read', 'Read the current company operator licence record.', 'high', false),
  ('compliance.operator_licence.update', 'compliance', 'operator_licence', 'update', 'Update the current company operator licence record.', 'high', true)
on conflict (key) do update
set description = excluded.description,
    risk_level = excluded.risk_level,
    requires_audit = excluded.requires_audit;

insert into public.security_role_permissions (role_key, permission_key, effect, scope_level)
values
  ('fleet_administrator', 'compliance.operator_licence.read', 'allow', 'organisation'),
  ('fleet_administrator', 'compliance.operator_licence.update', 'allow', 'organisation')
on conflict (role_key, permission_key, scope_level) do update
set effect = excluded.effect;

drop policy if exists "Fleet administrators can read company operator licence" on public.company_operator_licence_profiles;
create policy "Fleet administrators can read company operator licence"
  on public.company_operator_licence_profiles
  for select
  to authenticated
  using (
    company_id = public.current_actor_company_id()
    and public.actor_has_permission('compliance.operator_licence.read', company_id, null)
  );

create or replace function public.upsert_company_operator_licence_profile(
  p_operator_licence_number text default null,
  p_operator_licence_region text default null,
  p_operator_licence_type text default null,
  p_operator_licence_status text default null,
  p_operator_licence_expiry date default null,
  p_authorised_vehicle_count integer default 0,
  p_authorised_trailer_count integer default 0,
  p_transport_manager_name text default null,
  p_transport_manager_cpc_expiry date default null
)
returns public.company_operator_licence_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.current_actor_company_id();
  saved_profile public.company_operator_licence_profiles;
begin
  if actor_company_id is null or not public.actor_has_permission(
    'compliance.operator_licence.update',
    actor_company_id,
    null
  ) then
    raise exception 'Operator licence update is not permitted for the current company'
      using errcode = '42501';
  end if;

  insert into public.company_operator_licence_profiles (
    company_id,
    operator_licence_number,
    operator_licence_region,
    operator_licence_type,
    operator_licence_status,
    operator_licence_expiry,
    authorised_vehicle_count,
    authorised_trailer_count,
    transport_manager_name,
    transport_manager_cpc_expiry,
    created_by,
    updated_by
  ) values (
    actor_company_id,
    nullif(trim(p_operator_licence_number), ''),
    nullif(trim(p_operator_licence_region), ''),
    p_operator_licence_type,
    p_operator_licence_status,
    p_operator_licence_expiry,
    p_authorised_vehicle_count,
    p_authorised_trailer_count,
    nullif(trim(p_transport_manager_name), ''),
    p_transport_manager_cpc_expiry,
    auth.uid(),
    auth.uid()
  )
  on conflict (company_id) do update set
    operator_licence_number = excluded.operator_licence_number,
    operator_licence_region = excluded.operator_licence_region,
    operator_licence_type = excluded.operator_licence_type,
    operator_licence_status = excluded.operator_licence_status,
    operator_licence_expiry = excluded.operator_licence_expiry,
    authorised_vehicle_count = excluded.authorised_vehicle_count,
    authorised_trailer_count = excluded.authorised_trailer_count,
    transport_manager_name = excluded.transport_manager_name,
    transport_manager_cpc_expiry = excluded.transport_manager_cpc_expiry,
    updated_by = auth.uid()
  returning * into saved_profile;

  perform public.record_security_event(
    actor_company_id,
    null,
    'compliance.operator_licence.update',
    'allowed',
    'operator_licence_profile_upserted',
    'company_operator_licence_profile',
    saved_profile.id,
    'upsert',
    null,
    jsonb_build_object(
      'company_id', actor_company_id,
      'fields', jsonb_build_array(
        'operator_licence_number',
        'operator_licence_region',
        'operator_licence_type',
        'operator_licence_status',
        'operator_licence_expiry',
        'authorised_vehicle_count',
        'authorised_trailer_count',
        'transport_manager_name',
        'transport_manager_cpc_expiry'
      )
    ),
    'user'
  );

  return saved_profile;
end;
$$;

revoke all on table public.company_operator_licence_profiles from public;
revoke all on table public.company_operator_licence_profiles from anon;
revoke insert, update, delete on table public.company_operator_licence_profiles from authenticated;
grant select on table public.company_operator_licence_profiles to authenticated;

revoke all on function public.set_company_operator_licence_profile_updated_at() from public;
revoke all on function public.set_company_operator_licence_profile_updated_at() from anon;
revoke all on function public.set_company_operator_licence_profile_updated_at() from authenticated;
revoke all on function public.upsert_company_operator_licence_profile(text, text, text, text, date, integer, integer, text, date) from public;
revoke all on function public.upsert_company_operator_licence_profile(text, text, text, text, date, integer, integer, text, date) from anon;
grant execute on function public.upsert_company_operator_licence_profile(text, text, text, text, date, integer, integer, text, date) to authenticated;

comment on table public.company_operator_licence_profiles is
  'One current, company-scoped operator licence record. Historical versions are intentionally deferred.';
comment on function public.upsert_company_operator_licence_profile(text, text, text, text, date, integer, integer, text, date) is
  'Atomically upserts the current company operator licence record for the authenticated company and records the audited update.';
