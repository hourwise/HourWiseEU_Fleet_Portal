-- Supabase security hardening for shared portal/mobile project.
-- Addresses exposed trigger secrets, public driver_invites reads,
-- shift_jobs RLS, storage path policies, and SECURITY DEFINER search paths.

create extension if not exists pg_net;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

-- -----------------------------------------------------------------------------
-- Auth/RLS helper functions
-- -----------------------------------------------------------------------------

create or replace function public.get_my_company_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.company_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role::text
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.get_auth_user_company()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.get_my_company_id()
$$;

create or replace function public.get_auth_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.get_my_role()
$$;

grant execute on function public.get_my_company_id() to authenticated;
grant execute on function public.get_my_role() to authenticated;
grant execute on function public.get_auth_user_company() to authenticated;
grant execute on function public.get_auth_user_role() to authenticated;

create or replace function public.validate_auth_code(code text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  company_record record;
begin
  select c.id, c.auth_code_expires_at, c.max_drivers
  into company_record
  from public.companies c
  where c.auth_code = upper(trim(code))
    and c.auth_code_expires_at > now()
    and c.subscription_status in ('trial', 'active');

  if not found then
    raise exception 'Invalid or expired auth code';
  end if;

  if (
    select count(*)
    from public.profiles p
    where p.company_id = company_record.id
      and p.role = 'driver'
  ) >= company_record.max_drivers then
    raise exception 'Company has reached maximum number of drivers';
  end if;

  return company_record.id;
end;
$$;

grant execute on function public.validate_auth_code(text) to anon, authenticated;

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role text;
  actor_company uuid;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if current_setting('app.allow_profile_membership_update', true) = 'true' then
    return new;
  end if;

  actor_role := public.get_my_role();
  actor_company := public.get_my_company_id();

  if tg_op = 'UPDATE' and (
    new.role is distinct from old.role
    or new.company_id is distinct from old.company_id
  ) then
    if actor_role is distinct from 'manager'
       or actor_company is null
       or old.company_id is distinct from actor_company
       or new.company_id is distinct from actor_company then
      raise exception 'Changing role or company is not permitted';
    end if;
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    drop trigger if exists prevent_role_escalation_on_profiles on public.profiles;
    create trigger prevent_role_escalation_on_profiles
      before update on public.profiles
      for each row
      execute function public.prevent_role_escalation();
  end if;
end $$;

grant execute on function public.prevent_role_escalation() to authenticated;

-- Keep any existing update_user_claims function from inheriting caller search_path.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'update_user_claims'
  loop
    execute format('alter function %s set search_path = public, pg_temp', fn.signature);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- driver_invites: remove anonymous broad reads and expose safe RPCs only
-- -----------------------------------------------------------------------------

create or replace function public.lookup_pending_driver_invite(p_invite_code text)
returns table (
  invite_code text,
  email text,
  full_name text,
  company_name text,
  expires_at timestamptz
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
    di.expires_at
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

  select di.id, di.company_id, di.email, di.full_name, di.pay_config_snapshot
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
      role = 'driver'
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

  return jsonb_build_object('success', true, 'company_id', invite_record.company_id);
end;
$$;

grant execute on function public.accept_driver_invite(text) to authenticated;

-- Apply table grants/policies only when the live table exists.
do $$
declare
  p record;
begin
  if to_regclass('public.driver_invites') is null then
    return;
  end if;

  revoke select, insert, update, delete on table public.driver_invites from anon;

  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'driver_invites'
      and cmd = 'SELECT'
      and ('public' = any(roles) or 'anon' = any(roles))
  loop
    execute format('drop policy if exists %I on public.driver_invites', p.policyname);
  end loop;

  drop policy if exists "Managers can read company driver invites" on public.driver_invites;
  drop policy if exists "Managers can delete company driver invites" on public.driver_invites;
  drop policy if exists "Managers can update company driver invites" on public.driver_invites;

  alter table public.driver_invites enable row level security;

  create policy "Managers can read company driver invites"
    on public.driver_invites
    for select
    to authenticated
    using (
      public.get_my_role() = 'manager'
      and company_id = public.get_my_company_id()
    );

  create policy "Managers can delete company driver invites"
    on public.driver_invites
    for delete
    to authenticated
    using (
      public.get_my_role() = 'manager'
      and company_id = public.get_my_company_id()
    );

  create policy "Managers can update company driver invites"
    on public.driver_invites
    for update
    to authenticated
    using (
      public.get_my_role() = 'manager'
      and company_id = public.get_my_company_id()
    )
    with check (
      public.get_my_role() = 'manager'
      and company_id = public.get_my_company_id()
    );
end $$;

-- -----------------------------------------------------------------------------
-- shift_jobs RLS for mobile reports
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.shift_jobs') is null then
    return;
  end if;

  alter table public.shift_jobs enable row level security;

  drop policy if exists "Users can read own shift jobs" on public.shift_jobs;
  drop policy if exists "Managers can read company shift jobs" on public.shift_jobs;

  create policy "Users can read own shift jobs"
    on public.shift_jobs
    for select
    to authenticated
    using (user_id = auth.uid());

  create policy "Managers can read company shift jobs"
    on public.shift_jobs
    for select
    to authenticated
    using (
      public.get_my_role() = 'manager'
      and user_id in (
        select p.id
        from public.profiles p
        where p.company_id = public.get_my_company_id()
      )
    );
end $$;

-- -----------------------------------------------------------------------------
-- Storage bucket restrictions and path-aware policies
-- -----------------------------------------------------------------------------

create or replace function public.is_uuid(p_value text)
returns boolean
language plpgsql
immutable
set search_path = pg_temp
as $$
begin
  perform p_value::uuid;
  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function public.is_manager_for_company_path(p_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_uuid(p_company_id)
    and public.get_my_role() = 'manager'
    and public.get_my_company_id() = p_company_id::uuid
$$;

create or replace function public.can_access_driver_document_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
as $$
declare
  parts text[] := storage.foldername(p_name);
begin
  if auth.uid() is null or array_length(parts, 1) < 1 then
    return false;
  end if;

  -- Solo/mobile convention: <userId>/quals/...
  if parts[1] = auth.uid()::text then
    return true;
  end if;

  -- Portal/company convention: <companyId>/<driverId>/...
  if public.is_manager_for_company_path(parts[1]) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.can_access_vehicle_document_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
as $$
declare
  parts text[] := storage.foldername(p_name);
  owner_column text;
  owned_vehicle boolean := false;
begin
  if auth.uid() is null or array_length(parts, 1) < 1 then
    return false;
  end if;

  -- Preferred solo convention: <userId>/<vehicleId>/...
  if parts[1] = auth.uid()::text then
    return true;
  end if;

  -- Fleet convention: <companyId>/<vehicleId>/...
  if public.is_manager_for_company_path(parts[1]) then
    return true;
  end if;

  -- Legacy mobile convention: solo/<vehicleId>/...
  -- Only allow it if the vehicles table has an explicit owner-like column.
  if parts[1] = 'solo'
     and array_length(parts, 1) >= 2
     and public.is_uuid(parts[2]) then
    select c.column_name
    into owner_column
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'vehicles'
      and c.column_name in ('user_id', 'owner_id', 'driver_id', 'created_by')
    order by case c.column_name
      when 'user_id' then 1
      when 'owner_id' then 2
      when 'driver_id' then 3
      else 4
    end
    limit 1;

    if owner_column is not null then
      execute format(
        'select exists(select 1 from public.vehicles where id = $1::uuid and %I = $2)',
        owner_column
      )
      using parts[2], auth.uid()
      into owned_vehicle;
    end if;

    return coalesce(owned_vehicle, false);
  end if;

  return false;
end;
$$;

create or replace function public.can_access_defect_photo_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage, pg_temp
as $$
declare
  parts text[] := storage.foldername(p_name);
  first_segment text;
begin
  if auth.uid() is null or array_length(parts, 1) < 1 then
    return false;
  end if;

  first_segment := parts[1];

  -- Mobile convention: <userId>/...
  if first_segment = auth.uid()::text then
    return true;
  end if;

  -- Company convention: <companyId>/...
  if public.is_manager_for_company_path(first_segment) then
    return true;
  end if;

  -- Check-id convention: <vehicleCheckId>/...
  if public.is_uuid(first_segment) then
    return exists (
      select 1
      from public.vehicle_checks vc
      where vc.id = first_segment::uuid
        and (
          vc.driver_id = auth.uid()
          or (
            public.get_my_role() = 'manager'
            and vc.company_id = public.get_my_company_id()
          )
        )
    );
  end if;

  return false;
end;
$$;

grant execute on function public.is_uuid(text) to anon, authenticated;
grant execute on function public.is_manager_for_company_path(text) to authenticated;
grant execute on function public.can_access_driver_document_object(text) to authenticated;
grant execute on function public.can_access_vehicle_document_object(text) to authenticated;
grant execute on function public.can_access_defect_photo_object(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('logos', 'logos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('defect-photos', 'defect-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('driver-documents', 'driver-documents', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('vehicle-documents', 'vehicle-documents', false, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Driver documents storage policies.
drop policy if exists "Managers can upload driver documents" on storage.objects;
drop policy if exists "Managers can download driver documents" on storage.objects;
drop policy if exists "Managers can delete driver documents" on storage.objects;
drop policy if exists "Users can insert driver document objects" on storage.objects;
drop policy if exists "Users can read driver document objects" on storage.objects;
drop policy if exists "Users can update driver document objects" on storage.objects;
drop policy if exists "Users can delete driver document objects" on storage.objects;

create policy "Users can insert driver document objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'driver-documents'
    and public.can_access_driver_document_object(name)
  );

create policy "Users can read driver document objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'driver-documents'
    and public.can_access_driver_document_object(name)
  );

create policy "Users can update driver document objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'driver-documents'
    and public.can_access_driver_document_object(name)
  )
  with check (
    bucket_id = 'driver-documents'
    and public.can_access_driver_document_object(name)
  );

create policy "Users can delete driver document objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'driver-documents'
    and public.can_access_driver_document_object(name)
  );

-- Vehicle documents storage policies.
drop policy if exists "Managers can upload vehicle documents" on storage.objects;
drop policy if exists "Managers can download vehicle documents" on storage.objects;
drop policy if exists "Managers can delete vehicle documents" on storage.objects;
drop policy if exists "Users can insert vehicle document objects" on storage.objects;
drop policy if exists "Users can read vehicle document objects" on storage.objects;
drop policy if exists "Users can update vehicle document objects" on storage.objects;
drop policy if exists "Users can delete vehicle document objects" on storage.objects;

create policy "Users can insert vehicle document objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'vehicle-documents'
    and public.can_access_vehicle_document_object(name)
  );

create policy "Users can read vehicle document objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and public.can_access_vehicle_document_object(name)
  );

create policy "Users can update vehicle document objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and public.can_access_vehicle_document_object(name)
  )
  with check (
    bucket_id = 'vehicle-documents'
    and public.can_access_vehicle_document_object(name)
  );

create policy "Users can delete vehicle document objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and public.can_access_vehicle_document_object(name)
  );

-- Defect photo storage policies.
drop policy if exists "Users can insert defect photo objects" on storage.objects;
drop policy if exists "Users can read defect photo objects" on storage.objects;
drop policy if exists "Users can update defect photo objects" on storage.objects;
drop policy if exists "Users can delete defect photo objects" on storage.objects;

create policy "Users can insert defect photo objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'defect-photos'
    and public.can_access_defect_photo_object(name)
  );

create policy "Users can read defect photo objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'defect-photos'
    and public.can_access_defect_photo_object(name)
  );

create policy "Users can update defect photo objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'defect-photos'
    and public.can_access_defect_photo_object(name)
  )
  with check (
    bucket_id = 'defect-photos'
    and public.can_access_defect_photo_object(name)
  );

create policy "Users can delete defect photo objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'defect-photos'
    and public.can_access_defect_photo_object(name)
  );

-- -----------------------------------------------------------------------------
-- Replace legacy secret-bearing triggers with private-runtime dispatch
-- -----------------------------------------------------------------------------

create table if not exists private.broadcast_dispatch_runtime (
  singleton boolean primary key default true check (singleton),
  trigger_enabled boolean not null default false,
  send_broadcast_url text null,
  trigger_token text null,
  updated_at timestamptz not null default now()
);

insert into private.broadcast_dispatch_runtime (singleton, trigger_enabled)
values (true, false)
on conflict (singleton) do nothing;

create or replace function private.dispatch_new_broadcast()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  runtime_config private.broadcast_dispatch_runtime%rowtype;
  request_id bigint;
begin
  select *
  into runtime_config
  from private.broadcast_dispatch_runtime
  where singleton is true;

  if not coalesce(runtime_config.trigger_enabled, false)
     or runtime_config.send_broadcast_url is null
     or runtime_config.trigger_token is null then
    return new;
  end if;

  select net.http_post(
    url := runtime_config.send_broadcast_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-broadcast-trigger-token', runtime_config.trigger_token
    ),
    body := jsonb_build_object('record', to_jsonb(new))
  )
  into request_id;

  return new;
exception
  when others then
    raise warning 'broadcast dispatch failed: %', sqlerrm;
    return new;
end;
$$;

do $$
begin
  if to_regclass('public.broadcasts') is not null then
    drop trigger if exists on_new_broadcast on public.broadcasts;
    create trigger on_new_broadcast
      after insert on public.broadcasts
      for each row
      execute function private.dispatch_new_broadcast();
  end if;

  if to_regclass('public.tachograph_files') is not null then
    drop trigger if exists process_tacho_files on public.tachograph_files;
  end if;
end $$;

-- Defensive cleanup of legacy HTTP trigger dispatch is intentionally limited to
-- known affected trigger names above; verification query must return no rows.
