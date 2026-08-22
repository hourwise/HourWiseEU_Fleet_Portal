-- Batch 23: cyclic staffing demand, assignment-level assets, unstaffed runs,
-- leave capacity policy, and bounded/idempotent planning operations.

alter table public.rota_templates
  add column if not exists cycle_length_days integer not null default 7
    check (cycle_length_days between 1 and 56);

alter table public.rota_template_slots
  add column if not exists cycle_day integer not null default 1
    check (cycle_day between 1 and 56);

alter table public.rota_slot_assignments
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists trailer_id uuid references public.vehicles(id) on delete set null,
  add column if not exists planning_version integer not null default 1
    check (planning_version > 0);

comment on column public.rota_slots.vehicle_id is
  'Compatibility/default vehicle only. The individual rota_slot_assignments.vehicle_id is authoritative.';
comment on column public.rota_slots.trailer_id is
  'Compatibility/default trailer only. The individual rota_slot_assignments.trailer_id is authoritative.';

create unique index if not exists rota_slots_plan_template_date_active_idx
  on public.rota_slots(plan_id, template_slot_id, slot_date)
  where template_slot_id is not null and status <> 'cancelled';

create table if not exists public.planned_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  rota_slot_id uuid references public.rota_slots(id) on delete set null,
  rota_slot_assignment_id uuid references public.rota_slot_assignments(id) on delete set null,
  run_date date not null,
  run_label text not null check (length(btrim(run_label)) between 1 and 100),
  start_time time not null,
  end_time time not null,
  status text not null default 'planning' check (status in ('planning', 'staffed', 'published', 'cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time <> end_time)
);

create table if not exists public.planned_run_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  planned_run_id uuid not null references public.planned_runs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  sequence integer not null check (sequence between 1 and 500),
  status text not null default 'planned' check (status in ('planned', 'projected', 'cancelled')),
  projected_job_assignment_id uuid references public.job_assignments(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists planned_run_jobs_active_job_idx
  on public.planned_run_jobs(company_id, job_id) where status <> 'cancelled';
create unique index if not exists planned_run_jobs_active_sequence_idx
  on public.planned_run_jobs(planned_run_id, sequence) where status <> 'cancelled';
create index if not exists planned_runs_company_date_idx
  on public.planned_runs(company_id, run_date, status);

create table if not exists public.leave_capacity_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role_label text not null check (length(btrim(role_label)) between 1 and 100),
  availability_type text not null default 'annual_leave'
    check (availability_type in ('annual_leave', 'sickness', 'training', 'unavailable', 'other')),
  maximum_simultaneous integer not null check (maximum_simultaneous between 0 and 100),
  handling text not null default 'warn' check (handling in ('warn', 'block')),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, role_label, availability_type)
);

create table if not exists public.driver_planning_profiles (
  company_id uuid not null references public.companies(id) on delete cascade,
  driver_id uuid primary key references public.profiles(id) on delete cascade,
  regulatory_regime text not null default 'unknown'
    check (regulatory_regime in ('assimilated_aetr', 'gb_domestic', 'other_not_applicable', 'unknown')),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

alter table public.planned_runs enable row level security;
alter table public.planned_run_jobs enable row level security;
alter table public.leave_capacity_policies enable row level security;
alter table public.driver_planning_profiles enable row level security;

drop policy if exists "Managers can manage company planned runs" on public.planned_runs;
create policy "Managers can manage company planned runs" on public.planned_runs
for all to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager')
with check (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');

drop policy if exists "Managers can manage company planned run jobs" on public.planned_run_jobs;
create policy "Managers can manage company planned run jobs" on public.planned_run_jobs
for all to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager')
with check (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');

drop policy if exists "Managers can manage company leave capacity policies" on public.leave_capacity_policies;
create policy "Managers can manage company leave capacity policies" on public.leave_capacity_policies
for all to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager')
with check (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');

drop policy if exists "Managers can manage company driver planning profiles" on public.driver_planning_profiles;
create policy "Managers can manage company driver planning profiles" on public.driver_planning_profiles
for all to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager')
with check (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');

grant select, insert, update, delete on public.planned_runs to authenticated;
grant select, insert, update, delete on public.planned_run_jobs to authenticated;
grant select, insert, update, delete on public.leave_capacity_policies to authenticated;
grant select, insert, update, delete on public.driver_planning_profiles to authenticated;

create or replace function public.create_cyclic_rota_template(
  p_name text,
  p_description text,
  p_cycle_length_days integer,
  p_slots jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  template_id uuid;
  slot jsonb;
  slot_count integer := 0;
  slot_cycle_day integer;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can create a rota pattern' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null or p_cycle_length_days not between 1 and 56
     or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) not between 1 and 500 then
    raise exception 'A name, a 1 to 56 day cycle, and between 1 and 500 requirements are needed' using errcode = '22023';
  end if;
  insert into public.rota_templates(company_id, name, description, cycle_length_days, created_by)
  values (actor_company_id, btrim(p_name), nullif(btrim(p_description), ''), p_cycle_length_days, actor_id)
  returning id into template_id;

  for slot in select value from jsonb_array_elements(p_slots) loop
    slot_cycle_day := coalesce((slot ->> 'cycle_day')::integer, 0);
    if slot_cycle_day not between 1 and p_cycle_length_days
       or nullif(btrim(slot ->> 'role_label'), '') is null
       or (slot ->> 'start_time')::time = (slot ->> 'end_time')::time
       or coalesce((slot ->> 'required_headcount')::integer, 0) not between 1 and 50 then
      raise exception 'Every requirement needs a valid cycle day, name, time, and headcount' using errcode = '22023';
    end if;
    insert into public.rota_template_slots(
      company_id, template_id, cycle_day, role_label, start_time, end_time,
      required_headcount, required_skill, sort_order
    ) values (
      actor_company_id, template_id, slot_cycle_day, btrim(slot ->> 'role_label'),
      (slot ->> 'start_time')::time, (slot ->> 'end_time')::time,
      (slot ->> 'required_headcount')::integer,
      nullif(btrim(slot ->> 'required_skill'), ''),
      coalesce((slot ->> 'sort_order')::integer, slot_count)
    );
    slot_count := slot_count + 1;
  end loop;
  return jsonb_build_object('template_id', template_id, 'slot_count', slot_count, 'cycle_length_days', p_cycle_length_days);
end;
$$;

create or replace function public.preview_rota_template(
  p_template_id uuid,
  p_from date,
  p_to date
)
returns jsonb
language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  cycle_length integer;
  requirement_count integer;
  total_positions bigint;
  existing_count bigint;
  leave_conflicts bigint;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can preview a rota pattern' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'The planning period must be between 1 and 367 days' using errcode = '22023';
  end if;
  select cycle_length_days into cycle_length from public.rota_templates
  where id = p_template_id and company_id = actor_company_id and active;
  if cycle_length is null then raise exception 'Rota pattern is not available in this company' using errcode = '42501'; end if;

  with mapped as (
    select day_value::date as slot_date, rts.*
    from generate_series(p_from, p_to, interval '1 day') day_value
    join public.rota_template_slots rts
      on rts.template_id = p_template_id
     and rts.cycle_day = ((day_value::date - p_from) % cycle_length) + 1
  )
  select count(*), coalesce(sum(required_headcount), 0) into requirement_count, total_positions from mapped;

  select count(*) into existing_count from public.rota_slots
  where company_id = actor_company_id and slot_date between p_from and p_to and status <> 'cancelled';
  select count(*) into leave_conflicts from public.staff_availability
  where company_id = actor_company_id and starts_on <= p_to and ends_on >= p_from;

  return jsonb_build_object(
    'days_covered', p_to - p_from + 1,
    'requirements', requirement_count,
    'total_positions', total_positions,
    'existing_draft_requirements', existing_count,
    'leave_records_in_period', leave_conflicts,
    'cycle_length_days', cycle_length
  );
end;
$$;

create or replace function public.apply_cyclic_rota_template(
  p_template_id uuid,
  p_name text,
  p_from date,
  p_to date,
  p_request_key uuid
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  template_record public.rota_templates%rowtype;
  plan_id uuid;
  inserted_count integer := 0;
  skipped_count integer := 0;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can apply a rota pattern' using errcode = '42501';
  end if;
  if p_request_key is null or p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'A request key and a planning period between 1 and 367 days are required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor_company_id::text || ':' || p_request_key::text, 0));
  select * into template_record from public.rota_templates
  where id = p_template_id and company_id = actor_company_id and active for update;
  if template_record.id is null then raise exception 'Rota pattern is not available in this company' using errcode = '42501'; end if;

  select id into plan_id from public.rota_plans
  where company_id = actor_company_id and template_id = p_template_id
    and date_start = p_from and date_end = p_to and status = 'planning'
  order by created_at desc limit 1 for update;
  if plan_id is null then
    insert into public.rota_plans(company_id, template_id, name, date_start, date_end, created_by)
    values (actor_company_id, p_template_id, coalesce(nullif(btrim(p_name), ''), template_record.name), p_from, p_to, actor_id)
    returning id into plan_id;
  end if;

  with mapped as (
    select day_value::date as slot_date, rts.*
    from generate_series(p_from, p_to, interval '1 day') day_value
    join public.rota_template_slots rts
      on rts.template_id = p_template_id
     and rts.cycle_day = ((day_value::date - p_from) % template_record.cycle_length_days) + 1
  ), inserted as (
    insert into public.rota_slots(
      company_id, plan_id, template_slot_id, slot_date, role_label, start_time,
      end_time, required_headcount, required_skill, created_by
    )
    select actor_company_id, plan_id, id, slot_date, role_label, start_time,
      end_time, required_headcount, required_skill, actor_id
    from mapped
    on conflict do nothing
    returning id
  ) select count(*) into inserted_count from inserted;

  select (public.preview_rota_template(p_template_id, p_from, p_to) ->> 'requirements')::integer - inserted_count
  into skipped_count;
  return jsonb_build_object('plan_id', plan_id, 'created', inserted_count, 'skipped', greatest(skipped_count, 0));
end;
$$;

create or replace function public.assign_rota_position(
  p_slot_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid default null,
  p_trailer_id uuid default null,
  p_expected_slot_updated_at timestamptz default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  slot_record public.rota_slots%rowtype;
  assignment_record public.rota_slot_assignments%rowtype;
  planned_job_record record;
  projected_assignment_id uuid;
  projected_sequence integer;
  target_shift_id uuid;
  filled_count integer;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can fill a rota position' using errcode = '42501';
  end if;
  select * into slot_record from public.rota_slots
  where id = p_slot_id and company_id = actor_company_id for update;
  if slot_record.id is null then raise exception 'Rota requirement is not available in this company' using errcode = '42501'; end if;
  if p_expected_slot_updated_at is not null and slot_record.updated_at is distinct from p_expected_slot_updated_at then
    raise exception 'This requirement changed. Refresh it before assigning a driver' using errcode = '40001';
  end if;
  if slot_record.status = 'cancelled' then raise exception 'This requirement is closed' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_driver_id and company_id = actor_company_id and role = 'driver') then
    raise exception 'Driver is not available in this company' using errcode = '42501';
  end if;
  if exists (select 1 from public.staff_availability where company_id = actor_company_id and driver_id = p_driver_id and starts_on <= slot_record.slot_date and ends_on >= slot_record.slot_date) then
    raise exception 'Driver is unavailable on this date' using errcode = '22023';
  end if;
  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicles where id = p_vehicle_id and company_id = actor_company_id
      and not (vehicle_class = 'trailer' or vehicle_type = 'trailer')
  ) then raise exception 'Vehicle is not available in this company' using errcode = '42501'; end if;
  if p_trailer_id is not null and not exists (
    select 1 from public.vehicles where id = p_trailer_id and company_id = actor_company_id
      and (vehicle_class = 'trailer' or vehicle_type = 'trailer')
  ) then raise exception 'Trailer is not available in this company' using errcode = '42501'; end if;

  select count(*) into filled_count from public.rota_slot_assignments
  where slot_id = p_slot_id and status <> 'cancelled';
  select * into assignment_record from public.rota_slot_assignments
  where slot_id = p_slot_id and driver_id = p_driver_id and status <> 'cancelled' for update;
  if assignment_record.id is null and filled_count >= slot_record.required_headcount then
    raise exception 'This requirement is already fully staffed' using errcode = '23514';
  end if;
  if assignment_record.id is null then
    insert into public.shifts(company_id, driver_id, vehicle_id, date, start_time, end_time, status, notes)
    values (actor_company_id, p_driver_id, p_vehicle_id, slot_record.slot_date, slot_record.start_time, slot_record.end_time, 'draft', 'Created from rota planning')
    returning id into target_shift_id;
    insert into public.rota_slot_assignments(
      company_id, slot_id, driver_id, shift_id, vehicle_id, trailer_id, created_by
    ) values (
      actor_company_id, p_slot_id, p_driver_id, target_shift_id, p_vehicle_id, p_trailer_id, actor_id
    ) returning * into assignment_record;
  else
    target_shift_id := assignment_record.shift_id;
    update public.rota_slot_assignments set
      vehicle_id = p_vehicle_id, trailer_id = p_trailer_id,
      planning_version = planning_version + 1, updated_at = now()
    where id = assignment_record.id returning * into assignment_record;
    update public.shifts set vehicle_id = p_vehicle_id, updated_at = now()
    where id = target_shift_id and company_id = actor_company_id and status = 'draft';
  end if;
  select count(*) into filled_count from public.rota_slot_assignments
  where slot_id = p_slot_id and status <> 'cancelled';
  update public.rota_slots set
    status = case when filled_count >= required_headcount then 'filled' else 'partially_filled' end,
    updated_at = now()
  where id = p_slot_id;
  update public.planned_runs set rota_slot_assignment_id = assignment_record.id, status = 'staffed', updated_at = now()
  where company_id = actor_company_id and rota_slot_id = p_slot_id and rota_slot_assignment_id is null;
  for planned_job_record in
    select prj.id, prj.job_id
    from public.planned_run_jobs prj
    join public.planned_runs pr on pr.id = prj.planned_run_id
    where pr.company_id = actor_company_id and pr.rota_slot_assignment_id = assignment_record.id
      and prj.status <> 'cancelled'
    order by pr.run_date, pr.start_time, prj.sequence, prj.id
  loop
    select id into projected_assignment_id from public.job_assignments
    where company_id = actor_company_id and job_id = planned_job_record.job_id and status <> 'cancelled'
    limit 1;
    if projected_assignment_id is null then
      select coalesce(max(sequence), 0) + 1 into projected_sequence
      from public.job_assignments ja where ja.shift_id = target_shift_id and ja.status <> 'cancelled';
      insert into public.job_assignments(
        company_id, job_id, shift_id, driver_id, vehicle_id, trailer_id, sequence, status
      ) values (
        actor_company_id, planned_job_record.job_id, target_shift_id, p_driver_id,
        p_vehicle_id, p_trailer_id, projected_sequence, 'draft'
      ) returning id into projected_assignment_id;
    end if;
    update public.planned_run_jobs set
      status = 'projected', projected_job_assignment_id = projected_assignment_id, updated_at = now()
    where id = planned_job_record.id;
    projected_assignment_id := null;
  end loop;
  return jsonb_build_object(
    'assignment_id', assignment_record.id, 'shift_id', target_shift_id,
    'vehicle_id', assignment_record.vehicle_id, 'trailer_id', assignment_record.trailer_id,
    'filled', filled_count, 'required', slot_record.required_headcount
  );
end;
$$;

create or replace function public.create_planned_run(
  p_run_date date,
  p_run_label text,
  p_start_time time,
  p_end_time time,
  p_rota_slot_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  target public.planned_runs%rowtype;
  target_assignment_id uuid;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can create a planned run' using errcode = '42501'; end if;
  if p_run_date is null or nullif(btrim(p_run_label), '') is null or p_start_time = p_end_time then raise exception 'Run date, name, and different start/end times are required' using errcode = '22023'; end if;
  if p_rota_slot_id is not null and not exists (select 1 from public.rota_slots where id = p_rota_slot_id and company_id = actor_company_id and status <> 'cancelled') then raise exception 'Rota requirement is not available in this company' using errcode = '42501'; end if;
  if p_rota_slot_id is not null then
    select id into target_assignment_id
    from public.rota_slot_assignments
    where slot_id = p_rota_slot_id and company_id = actor_company_id and status <> 'cancelled'
    order by created_at, id limit 1;
  end if;
  insert into public.planned_runs(company_id, rota_slot_id, rota_slot_assignment_id, run_date, run_label, start_time, end_time, status, created_by)
  values (actor_company_id, p_rota_slot_id, target_assignment_id, p_run_date, btrim(p_run_label), p_start_time, p_end_time, case when target_assignment_id is null then 'planning' else 'staffed' end, auth.uid())
  returning * into target;
  return to_jsonb(target);
end;
$$;

create or replace function public.place_job_on_planned_run(
  p_job_id uuid,
  p_planned_run_id uuid,
  p_sequence integer default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  target_run public.planned_runs%rowtype;
  assignment public.rota_slot_assignments%rowtype;
  relation public.planned_run_jobs%rowtype;
  operational public.job_assignments%rowtype;
  next_sequence integer;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can allocate planned jobs' using errcode = '42501'; end if;
  select * into target_run from public.planned_runs where id = p_planned_run_id and company_id = actor_company_id and status <> 'cancelled' for update;
  if target_run.id is null or not exists (select 1 from public.jobs where id = p_job_id and company_id = actor_company_id) then raise exception 'Run and job must belong to this company' using errcode = '42501'; end if;
  select * into relation from public.planned_run_jobs where company_id = actor_company_id and job_id = p_job_id and status <> 'cancelled' for update;
  if relation.id is not null and relation.planned_run_id <> p_planned_run_id then raise exception 'Job is already allocated to another run' using errcode = '23505'; end if;
  if relation.id is null then
    if p_sequence is null then select coalesce(max(sequence), 0) + 1 into next_sequence from public.planned_run_jobs where planned_run_id = p_planned_run_id and status <> 'cancelled'; else next_sequence := p_sequence; end if;
    insert into public.planned_run_jobs(company_id, planned_run_id, job_id, sequence, created_by)
    values (actor_company_id, p_planned_run_id, p_job_id, next_sequence, auth.uid()) returning * into relation;
  end if;

  if target_run.rota_slot_assignment_id is not null then
    select * into assignment from public.rota_slot_assignments where id = target_run.rota_slot_assignment_id and company_id = actor_company_id and status <> 'cancelled';
    if assignment.shift_id is not null then
      select * into operational from public.job_assignments where company_id = actor_company_id and job_id = p_job_id and status <> 'cancelled' limit 1;
      if operational.id is null then
        insert into public.job_assignments(company_id, job_id, shift_id, driver_id, vehicle_id, trailer_id, sequence, status)
        values (actor_company_id, p_job_id, assignment.shift_id, assignment.driver_id, assignment.vehicle_id, assignment.trailer_id, relation.sequence, 'draft')
        returning * into operational;
      end if;
      update public.planned_run_jobs set status = 'projected', projected_job_assignment_id = operational.id, updated_at = now() where id = relation.id returning * into relation;
    end if;
  end if;
  return jsonb_build_object('planned_run_job_id', relation.id, 'sequence', relation.sequence, 'projected_job_assignment_id', relation.projected_job_assignment_id);
end;
$$;

create or replace function public.record_staff_availability(
  p_driver_id uuid,
  p_availability_type text,
  p_starts_on date,
  p_ends_on date,
  p_note text default null,
  p_role_label text default 'Driver'
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  policy_record public.leave_capacity_policies%rowtype;
  overlapping integer := 0;
  target public.staff_availability%rowtype;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can record availability' using errcode = '42501'; end if;
  if p_availability_type not in ('annual_leave', 'sickness', 'training', 'unavailable', 'other') or p_ends_on < p_starts_on then raise exception 'Availability type and date range are not valid' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_driver_id and company_id = actor_company_id and role = 'driver') then raise exception 'Driver is not available in this company' using errcode = '42501'; end if;
  select * into policy_record from public.leave_capacity_policies
  where company_id = actor_company_id and lower(role_label) = lower(p_role_label)
    and availability_type = p_availability_type and active;
  if policy_record.id is not null then
    select count(distinct driver_id) into overlapping from public.staff_availability
    where company_id = actor_company_id and availability_type = p_availability_type
      and starts_on <= p_ends_on and ends_on >= p_starts_on;
    if overlapping >= policy_record.maximum_simultaneous and policy_record.handling = 'block' then
      raise exception 'Leave capacity reached: % of % places are already booked', overlapping, policy_record.maximum_simultaneous using errcode = '23514';
    end if;
  end if;
  insert into public.staff_availability(company_id, driver_id, availability_type, starts_on, ends_on, note, created_by)
  values (actor_company_id, p_driver_id, p_availability_type, p_starts_on, p_ends_on, nullif(btrim(p_note), ''), auth.uid())
  returning * into target;
  return jsonb_build_object(
    'availability_id', target.id,
    'capacity_status', case when policy_record.id is null then 'not_configured' when overlapping >= policy_record.maximum_simultaneous then 'reached' else 'within_capacity' end,
    'booked', overlapping + 1,
    'maximum', policy_record.maximum_simultaneous,
    'handling', policy_record.handling
  );
end;
$$;

create or replace function public.get_planning_workspace_snapshot(p_from date, p_to date)
returns jsonb
language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can view the planning workspace' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception 'The visible planning period must be between 1 and 63 days' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'templates', coalesce((
      select jsonb_agg(to_jsonb(rt) order by rt.name)
      from public.rota_templates rt
      where rt.company_id = actor_company_id and rt.active
    ), '[]'::jsonb),
    'template_slots', coalesce((
      select jsonb_agg(to_jsonb(rts) order by rts.template_id, rts.cycle_day, rts.sort_order, rts.id)
      from public.rota_template_slots rts
      join public.rota_templates rt on rt.id = rts.template_id
      where rts.company_id = actor_company_id and rt.active
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(to_jsonb(rs) order by rs.slot_date, rs.start_time, rs.role_label)
      from public.rota_slots rs
      where rs.company_id = actor_company_id and rs.slot_date between p_from and p_to and rs.status <> 'cancelled'
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(rsa) order by rsa.created_at)
      from public.rota_slot_assignments rsa
      join public.rota_slots rs on rs.id = rsa.slot_id
      where rsa.company_id = actor_company_id and rs.slot_date between p_from and p_to and rsa.status <> 'cancelled'
    ), '[]'::jsonb),
    'availability', coalesce((
      select jsonb_agg(to_jsonb(sa) order by sa.starts_on, sa.driver_id)
      from public.staff_availability sa
      where sa.company_id = actor_company_id and sa.starts_on <= p_to and sa.ends_on >= p_from
    ), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(to_jsonb(pr) order by pr.run_date, pr.start_time, pr.run_label)
      from public.planned_runs pr
      where pr.company_id = actor_company_id and pr.run_date between p_from and p_to and pr.status <> 'cancelled'
    ), '[]'::jsonb),
    'run_jobs', coalesce((
      select jsonb_agg(to_jsonb(prj) order by prj.planned_run_id, prj.sequence)
      from public.planned_run_jobs prj
      join public.planned_runs pr on pr.id = prj.planned_run_id
      where prj.company_id = actor_company_id and pr.run_date between p_from and p_to and prj.status <> 'cancelled'
    ), '[]'::jsonb),
    'leave_policies', coalesce((
      select jsonb_agg(to_jsonb(lcp) order by lcp.role_label, lcp.availability_type)
      from public.leave_capacity_policies lcp
      where lcp.company_id = actor_company_id and lcp.active
    ), '[]'::jsonb),
    'driver_planning_profiles', coalesce((
      select jsonb_agg(to_jsonb(dpp) order by dpp.driver_id)
      from public.driver_planning_profiles dpp
      where dpp.company_id = actor_company_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.create_cyclic_rota_template(text, text, integer, jsonb) from public, anon;
revoke all on function public.preview_rota_template(uuid, date, date) from public, anon;
revoke all on function public.apply_cyclic_rota_template(uuid, text, date, date, uuid) from public, anon;
revoke all on function public.assign_rota_position(uuid, uuid, uuid, uuid, timestamptz) from public, anon;
revoke all on function public.create_planned_run(date, text, time, time, uuid) from public, anon;
revoke all on function public.place_job_on_planned_run(uuid, uuid, integer) from public, anon;
revoke all on function public.record_staff_availability(uuid, text, date, date, text, text) from public, anon;
revoke all on function public.get_planning_workspace_snapshot(date, date) from public, anon;
grant execute on function public.create_cyclic_rota_template(text, text, integer, jsonb) to authenticated;
grant execute on function public.preview_rota_template(uuid, date, date) to authenticated;
grant execute on function public.apply_cyclic_rota_template(uuid, text, date, date, uuid) to authenticated;
grant execute on function public.assign_rota_position(uuid, uuid, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.create_planned_run(date, text, time, time, uuid) to authenticated;
grant execute on function public.place_job_on_planned_run(uuid, uuid, integer) to authenticated;
grant execute on function public.record_staff_availability(uuid, text, date, date, text, text) to authenticated;
grant execute on function public.get_planning_workspace_snapshot(date, date) to authenticated;

comment on table public.planned_runs is 'Driverless dispatch planning runs. Operational authority remains with shifts and job_assignments.';
comment on table public.planned_run_jobs is 'Ordered planning relation from jobs to unstaffed or staffed runs; projected idempotently to job_assignments.';
comment on table public.leave_capacity_policies is 'Company planning policy, not a legal or regulatory limit.';
comment on table public.driver_planning_profiles is 'Explicit manager-confirmed planning regime; unknown is never inferred.';
