-- Batch 22: planning demand sits above the assigned/published shift record.
-- Existing shifts retain their required driver_id and remain the operational
-- record shown to drivers. These tables are manager-only planning records.

create table if not exists public.rota_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  description text,
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rota_template_slots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid not null references public.rota_templates(id) on delete cascade,
  role_label text not null check (length(btrim(role_label)) between 1 and 100),
  start_time time not null,
  end_time time not null,
  required_headcount integer not null default 1 check (required_headcount between 1 and 50),
  required_skill text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (end_time <> start_time)
);

create table if not exists public.rota_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  template_id uuid references public.rota_templates(id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 160),
  date_start date not null,
  date_end date not null,
  status text not null default 'planning' check (status in ('planning', 'published', 'archived')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_end >= date_start)
);

create table if not exists public.rota_slots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_id uuid not null references public.rota_plans(id) on delete cascade,
  template_slot_id uuid references public.rota_template_slots(id) on delete set null,
  slot_date date not null,
  role_label text not null,
  start_time time not null,
  end_time time not null,
  required_headcount integer not null default 1 check (required_headcount between 1 and 50),
  required_skill text,
  status text not null default 'open' check (status in ('open', 'partially_filled', 'filled', 'cancelled')),
  vehicle_id uuid references public.vehicles(id) on delete set null,
  trailer_id uuid references public.vehicles(id) on delete set null,
  run_group text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time <> start_time)
);

create table if not exists public.rota_slot_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  slot_id uuid not null references public.rota_slots(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  shift_id uuid references public.shifts(id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'confirmed', 'cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists rota_slot_assignments_active_slot_driver_idx
  on public.rota_slot_assignments(slot_id, driver_id) where status <> 'cancelled';
create index if not exists rota_slots_company_date_idx on public.rota_slots(company_id, slot_date, status);
create index if not exists rota_slot_assignments_company_driver_idx on public.rota_slot_assignments(company_id, driver_id, status);

create table if not exists public.staff_availability (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  availability_type text not null check (availability_type in ('annual_leave', 'sickness', 'training', 'unavailable', 'other')),
  starts_on date not null,
  ends_on date not null,
  note text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists staff_availability_company_dates_idx on public.staff_availability(company_id, starts_on, ends_on);
create index if not exists staff_availability_driver_dates_idx on public.staff_availability(driver_id, starts_on, ends_on);

alter table public.rota_templates enable row level security;
alter table public.rota_template_slots enable row level security;
alter table public.rota_plans enable row level security;
alter table public.rota_slots enable row level security;
alter table public.rota_slot_assignments enable row level security;
alter table public.staff_availability enable row level security;

drop policy if exists "Managers can manage company rota templates" on public.rota_templates;
create policy "Managers can manage company rota templates" on public.rota_templates for all to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager')
with check (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');
drop policy if exists "Managers can manage company rota template slots" on public.rota_template_slots;
create policy "Managers can manage company rota template slots" on public.rota_template_slots for all to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager')
with check (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');
drop policy if exists "Managers can manage company rota plans" on public.rota_plans;
create policy "Managers can manage company rota plans" on public.rota_plans for all to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager')
with check (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');
drop policy if exists "Managers can manage company rota slots" on public.rota_slots;
create policy "Managers can manage company rota slots" on public.rota_slots for all to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager')
with check (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');
drop policy if exists "Managers can manage company rota slot assignments" on public.rota_slot_assignments;
create policy "Managers can manage company rota slot assignments" on public.rota_slot_assignments for all to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager')
with check (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');
drop policy if exists "Managers can manage company staff availability" on public.staff_availability;
create policy "Managers can manage company staff availability" on public.staff_availability for all to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager')
with check (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');

-- Batch 21 deployed an ambiguous reference in this function: the output
-- column signal_key shadowed the table column. Qualifying the table alias
-- keeps change detection deterministic without changing the public contract.
create or replace function public.sync_atlas_signal_observations(p_signals jsonb)
returns table(signal_key text, is_new boolean, first_seen_at timestamptz, last_seen_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  signal jsonb;
  existing public.atlas_signal_observations%rowtype;
  key_value text;
  fingerprint_value text;
  section_value text;
  severity_value text;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can sync Atlas observations' using errcode = '42501';
  end if;
  if jsonb_typeof(p_signals) <> 'array' or jsonb_array_length(p_signals) > 500 then
    raise exception 'Atlas signal payload must be an array containing no more than 500 signals' using errcode = '22023';
  end if;
  for signal in select value from jsonb_array_elements(p_signals) loop
    key_value := nullif(btrim(signal ->> 'signal_key'), '');
    fingerprint_value := nullif(btrim(signal ->> 'fingerprint'), '');
    section_value := nullif(btrim(signal ->> 'section'), '');
    severity_value := nullif(btrim(signal ->> 'severity'), '');
    if key_value is null or fingerprint_value is null or section_value not in ('yesterday', 'today', 'tomorrow', 'next30') or severity_value not in ('critical', 'warning', 'advisory') then
      raise exception 'Atlas signal is missing a valid key, fingerprint, section, or severity' using errcode = '22023';
    end if;
    select obs.* into existing
    from public.atlas_signal_observations as obs
    where obs.company_id = actor_company_id and obs.signal_key = key_value
    for update;
    if existing.id is null then
      insert into public.atlas_signal_observations (company_id, signal_key, fingerprint, section, severity, last_source_updated_at, created_by)
      values (actor_company_id, key_value, fingerprint_value, section_value, severity_value, nullif(signal ->> 'source_updated_at', '')::timestamptz, actor_id)
      returning * into existing;
      signal_key := key_value;
      is_new := true;
    else
      signal_key := key_value;
      is_new := existing.fingerprint is distinct from fingerprint_value;
      update public.atlas_signal_observations
      set fingerprint = fingerprint_value, section = section_value, severity = severity_value,
          last_seen_at = now(), last_source_updated_at = nullif(signal ->> 'source_updated_at', '')::timestamptz, updated_at = now()
      where id = existing.id
      returning * into existing;
    end if;
    first_seen_at := existing.first_seen_at;
    last_seen_at := existing.last_seen_at;
    return next;
  end loop;
end;
$$;
revoke all on function public.sync_atlas_signal_observations(jsonb) from public, anon;
grant execute on function public.sync_atlas_signal_observations(jsonb) to authenticated;

-- A draft is a planning record. Publication still runs this same trigger and
-- therefore rechecks hard blocks and unresolved readiness before driver use.
create or replace function public.enforce_asset_assignment_readiness()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  target_company_id uuid;
  target_shift_id uuid;
  target_vehicle_id uuid;
  target_shift_status text;
  policy jsonb;
  has_override boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if tg_table_name = 'shifts' then
    target_company_id := new.company_id;
    target_shift_id := new.id;
    target_vehicle_id := new.vehicle_id;
    target_shift_status := new.status::text;
  else
    target_company_id := new.company_id;
    target_shift_id := new.shift_id;
    select s.vehicle_id, s.status::text into target_vehicle_id, target_shift_status from public.shifts s where s.id = new.shift_id;
  end if;
  if target_shift_status = 'draft' then return new; end if;
  if target_vehicle_id is null then return new; end if;
  policy := public.get_asset_assignment_policy(target_company_id, target_vehicle_id);
  if coalesce((policy ->> 'hard_block')::boolean, true) then
    raise exception 'Asset assignment prohibited: %', policy -> 'reasons' using errcode = '42501';
  end if;
  if (policy ->> 'status') in ('unknown', 'action_required') then
    select exists (select 1 from public.asset_assignment_overrides o where o.company_id = target_company_id and o.shift_id = target_shift_id and o.vehicle_id = target_vehicle_id and o.revoked_at is null) into has_override;
    if not has_override then raise exception 'Asset assignment requires a recorded readiness override: %', policy -> 'reasons' using errcode = '42501'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.create_shift_draft(p_driver_id uuid, p_date date, p_start_time time, p_end_time time, p_vehicle_id uuid default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare actor_company_id uuid := public.get_my_company_id(); target public.shifts%rowtype;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can create a shift draft' using errcode = '42501'; end if;
  if p_date is null or p_start_time is null or p_end_time is null or p_start_time = p_end_time then raise exception 'A date and different start and end times are required' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_driver_id and company_id = actor_company_id and role = 'driver') then raise exception 'Driver is not available in this company' using errcode = '42501'; end if;
  if p_vehicle_id is not null and not exists (select 1 from public.vehicles where id = p_vehicle_id and company_id = actor_company_id) then raise exception 'Vehicle is not available in this company' using errcode = '42501'; end if;
  insert into public.shifts(company_id, driver_id, vehicle_id, date, start_time, end_time, status, notes) values (actor_company_id, p_driver_id, p_vehicle_id, p_date, p_start_time, p_end_time, 'draft', nullif(btrim(p_notes), '')) returning * into target;
  return to_jsonb(target);
end;
$$;
revoke all on function public.create_shift_draft(uuid, date, time, time, uuid, text) from public, anon;
grant execute on function public.create_shift_draft(uuid, date, time, time, uuid, text) to authenticated;

create or replace function public.create_rota_template_with_slots(p_name text, p_description text, p_slots jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare actor_company_id uuid := public.get_my_company_id(); template_id uuid; slot jsonb; slot_count integer := 0;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can create a rota pattern' using errcode = '42501'; end if;
  if nullif(btrim(p_name), '') is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 or jsonb_array_length(p_slots) > 100 then raise exception 'A name and between 1 and 100 rota slots are required' using errcode = '22023'; end if;
  insert into public.rota_templates(company_id, name, description, created_by) values (actor_company_id, btrim(p_name), nullif(btrim(p_description), ''), auth.uid()) returning id into template_id;
  for slot in select value from jsonb_array_elements(p_slots) loop
    if nullif(btrim(slot ->> 'role_label'), '') is null or (slot ->> 'start_time')::time = (slot ->> 'end_time')::time then raise exception 'Each rota slot needs a name and different times' using errcode = '22023'; end if;
    insert into public.rota_template_slots(company_id, template_id, role_label, start_time, end_time, required_headcount, required_skill, sort_order)
    values (actor_company_id, template_id, btrim(slot ->> 'role_label'), (slot ->> 'start_time')::time, (slot ->> 'end_time')::time, greatest(1, coalesce((slot ->> 'required_headcount')::integer, 1)), nullif(btrim(slot ->> 'required_skill'), ''), coalesce((slot ->> 'sort_order')::integer, slot_count));
    slot_count := slot_count + 1;
  end loop;
  return jsonb_build_object('template_id', template_id, 'slot_count', slot_count);
end;
$$;
revoke all on function public.create_rota_template_with_slots(text, text, jsonb) from public, anon;
grant execute on function public.create_rota_template_with_slots(text, text, jsonb) to authenticated;

create or replace function public.apply_rota_template(p_template_id uuid, p_name text, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare actor_company_id uuid := public.get_my_company_id(); template_record public.rota_templates%rowtype; plan_id uuid; current_day date; template_slot public.rota_template_slots%rowtype; slot_count integer := 0;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can apply a rota pattern' using errcode = '42501'; end if;
  if p_to < p_from or p_to - p_from > 366 then raise exception 'The planning period must be between 1 and 367 days' using errcode = '22023'; end if;
  select * into template_record from public.rota_templates where id = p_template_id and company_id = actor_company_id and active for update;
  if template_record.id is null then raise exception 'Rota pattern is not available in this company' using errcode = '42501'; end if;
  insert into public.rota_plans(company_id, template_id, name, date_start, date_end, created_by) values (actor_company_id, coalesce(nullif(btrim(p_name), ''), template_record.name), p_from, p_to, auth.uid()) returning id into plan_id;
  for current_day in select generate_series(p_from, p_to, interval '1 day')::date loop
    for template_slot in select * from public.rota_template_slots where template_id = template_record.id order by sort_order, id loop
      insert into public.rota_slots(company_id, plan_id, template_slot_id, slot_date, role_label, start_time, end_time, required_headcount, required_skill, created_by)
      values (actor_company_id, plan_id, template_slot.id, current_day, template_slot.role_label, template_slot.start_time, template_slot.end_time, template_slot.required_headcount, template_slot.required_skill, auth.uid());
      slot_count := slot_count + 1;
    end loop;
  end loop;
  return jsonb_build_object('plan_id', plan_id, 'slot_count', slot_count, 'date_start', p_from, 'date_end', p_to);
end;
$$;
revoke all on function public.apply_rota_template(uuid, text, date, date) from public, anon;
grant execute on function public.apply_rota_template(uuid, text, date, date) to authenticated;

create or replace function public.assign_rota_slot_driver(p_slot_id uuid, p_driver_id uuid, p_vehicle_id uuid default null, p_trailer_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare actor_company_id uuid := public.get_my_company_id(); slot_record public.rota_slots%rowtype; assignment_id uuid; shift_id uuid; filled_count integer; warning text := null;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can fill a rota slot' using errcode = '42501'; end if;
  select * into slot_record from public.rota_slots where id = p_slot_id and company_id = actor_company_id for update;
  if slot_record.id is null then raise exception 'Rota slot is not available in this company' using errcode = '42501'; end if;
  if slot_record.status = 'cancelled' then raise exception 'This rota slot is closed' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_driver_id and company_id = actor_company_id and role = 'driver') then raise exception 'Driver is not available in this company' using errcode = '42501'; end if;
  if exists (select 1 from public.staff_availability where company_id = actor_company_id and driver_id = p_driver_id and starts_on <= slot_record.slot_date and ends_on >= slot_record.slot_date) then raise exception 'Driver is marked unavailable for this date' using errcode = '22023'; end if;
  if p_vehicle_id is not null and not exists (select 1 from public.vehicles where id = p_vehicle_id and company_id = actor_company_id) then raise exception 'Vehicle is not available in this company' using errcode = '42501'; end if;
  if p_trailer_id is not null and not exists (select 1 from public.vehicles where id = p_trailer_id and company_id = actor_company_id and (vehicle_class = 'trailer' or vehicle_type = 'trailer')) then raise exception 'Trailer is not available in this company' using errcode = '42501'; end if;
  select rsa.id, rsa.shift_id into assignment_id, shift_id from public.rota_slot_assignments as rsa where rsa.slot_id = p_slot_id and rsa.driver_id = p_driver_id and rsa.status <> 'cancelled' for update;
  if assignment_id is null then
    insert into public.shifts(company_id, driver_id, vehicle_id, date, start_time, end_time, status, notes)
    values (actor_company_id, p_driver_id, p_vehicle_id, slot_record.slot_date, slot_record.start_time, slot_record.end_time, 'draft', 'Created from rota planning') returning id into shift_id;
    insert into public.rota_slot_assignments(company_id, slot_id, driver_id, shift_id, created_by) values (actor_company_id, p_slot_id, p_driver_id, shift_id, auth.uid()) returning id into assignment_id;
  end if;
  select count(*) into filled_count from public.rota_slot_assignments where slot_id = p_slot_id and status <> 'cancelled';
  update public.rota_slots set vehicle_id = coalesce(p_vehicle_id, vehicle_id), trailer_id = coalesce(p_trailer_id, trailer_id), status = case when filled_count >= required_headcount then 'filled' when filled_count > 0 then 'partially_filled' else 'open' end, updated_at = now() where id = p_slot_id;
  if p_vehicle_id is not null then
    begin
      if (public.get_asset_assignment_policy(actor_company_id, p_vehicle_id) ->> 'status') in ('unknown', 'action_required') then warning := 'Vehicle evidence needs review before publication.'; end if;
    exception when others then warning := 'Vehicle readiness will be checked again before publication.';
    end;
  end if;
  return jsonb_build_object('slot_id', p_slot_id, 'assignment_id', assignment_id, 'shift_id', shift_id, 'status', 'planned', 'warning', warning);
end;
$$;
revoke all on function public.assign_rota_slot_driver(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.assign_rota_slot_driver(uuid, uuid, uuid, uuid) to authenticated;

create or replace function public.create_planned_job(p_reference text, p_title text, p_job_type text, p_address_text text, p_customer_name text default null, p_instructions text default null, p_manager_notes text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare actor_company_id uuid := public.get_my_company_id(); target public.jobs%rowtype;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can create a planned job' using errcode = '42501'; end if;
  if nullif(btrim(p_reference), '') is null or nullif(btrim(p_title), '') is null or nullif(btrim(p_address_text), '') is null or p_job_type not in ('delivery', 'collection', 'service', 'other') then raise exception 'Reference, title, address, and a valid job type are required' using errcode = '22023'; end if;
  insert into public.jobs(company_id, reference, title, job_type, address_text, customer_name, instructions, manager_notes, created_by) values (actor_company_id, btrim(p_reference), btrim(p_title), p_job_type, btrim(p_address_text), nullif(btrim(p_customer_name), ''), nullif(btrim(p_instructions), ''), nullif(btrim(p_manager_notes), ''), auth.uid()) returning * into target;
  return to_jsonb(target);
end;
$$;
revoke all on function public.create_planned_job(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_planned_job(text, text, text, text, text, text, text) to authenticated;

create or replace function public.assign_job_to_draft_shift(p_job_id uuid, p_shift_id uuid, p_sequence integer default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare actor_company_id uuid := public.get_my_company_id(); target_job public.jobs%rowtype; target_shift public.shifts%rowtype; assignment public.job_assignments%rowtype; next_sequence integer;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can place a job on a planned shift' using errcode = '42501'; end if;
  select * into target_job from public.jobs where id = p_job_id and company_id = actor_company_id for update;
  select * into target_shift from public.shifts where id = p_shift_id and company_id = actor_company_id for update;
  if target_job.id is null or target_shift.id is null then raise exception 'Job and shift must belong to this company' using errcode = '42501'; end if;
  if target_shift.status not in ('draft', 'published', 'updated') then raise exception 'This shift cannot accept a planned job' using errcode = '22023'; end if;
  select * into assignment from public.job_assignments where job_id = p_job_id and company_id = actor_company_id and status <> 'cancelled' limit 1;
  if assignment.id is not null then return jsonb_build_object('job_assignment_id', assignment.id, 'shift_id', assignment.shift_id, 'already_assigned', true); end if;
  if p_sequence is null then select coalesce(max(sequence), 0) + 1 into next_sequence from public.job_assignments where shift_id = p_shift_id; else next_sequence := p_sequence; end if;
  insert into public.job_assignments(company_id, job_id, shift_id, driver_id, vehicle_id, sequence, status) values (actor_company_id, p_job_id, p_shift_id, target_shift.driver_id, target_shift.vehicle_id, next_sequence, 'draft') returning * into assignment;
  return jsonb_build_object('job_assignment_id', assignment.id, 'job_id', p_job_id, 'shift_id', p_shift_id, 'sequence', next_sequence, 'status', 'draft');
end;
$$;
revoke all on function public.assign_job_to_draft_shift(uuid, uuid, integer) from public, anon;
grant execute on function public.assign_job_to_draft_shift(uuid, uuid, integer) to authenticated;

create or replace function public.get_shift_publication_assessment(p_shift_id uuid)
returns jsonb language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare actor_company_id uuid := public.get_my_company_id(); target public.shifts%rowtype; policy jsonb; result jsonb;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can review publication readiness' using errcode = '42501'; end if;
  select * into target from public.shifts where id = p_shift_id and company_id = actor_company_id;
  if target.id is null then raise exception 'Shift is not available in this company' using errcode = '42501'; end if;
  if target.vehicle_id is null then return jsonb_build_object('status', 'warning', 'label', 'Vehicle still to be assigned', 'reasons', jsonb_build_array('Add a vehicle before publishing this shift.')); end if;
  policy := public.get_asset_assignment_policy(actor_company_id, target.vehicle_id);
  result := jsonb_build_object(
    'status', (case when coalesce((policy ->> 'hard_block')::boolean, true) then 'blocked' when (policy ->> 'status') in ('unknown', 'action_required') then 'warning' else 'ready' end),
    'label', (case when coalesce((policy ->> 'hard_block')::boolean, true) then 'Cannot publish yet' when (policy ->> 'status') in ('unknown', 'action_required') then 'Needs a readiness review' else 'Ready to publish' end),
    'reasons', coalesce(policy -> 'reasons', '[]'::jsonb)
  );
  return result;
end;
$$;
revoke all on function public.get_shift_publication_assessment(uuid) from public, anon;
grant execute on function public.get_shift_publication_assessment(uuid) to authenticated;

comment on table public.rota_templates is 'Manager rota patterns for creating empty demand slots; never replaces shifts.';
comment on table public.rota_slots is 'Dated planning demand. A slot may remain empty until a driver is assigned.';
comment on table public.staff_availability is 'Manager-entered availability and leave records used by planning checks.';
