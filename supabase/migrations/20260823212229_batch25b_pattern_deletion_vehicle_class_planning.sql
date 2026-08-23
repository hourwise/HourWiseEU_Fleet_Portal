-- Structured vehicle-class demand and driver clearance for rota planning.
-- These operational planning labels do not replace licence/document checks.

alter table public.rota_template_slots
  add column if not exists required_vehicle_class text;
alter table public.rota_slots
  add column if not exists required_vehicle_class text;
alter table public.vehicles
  add column if not exists planning_vehicle_class text;

alter table public.rota_template_slots
  drop constraint if exists rota_template_slots_required_vehicle_class_check;
alter table public.rota_template_slots
  add constraint rota_template_slots_required_vehicle_class_check
  check (required_vehicle_class is null or required_vehicle_class in ('3_5t', '7_5t', 'class_2', 'class_1'));
alter table public.rota_slots
  drop constraint if exists rota_slots_required_vehicle_class_check;
alter table public.rota_slots
  add constraint rota_slots_required_vehicle_class_check
  check (required_vehicle_class is null or required_vehicle_class in ('3_5t', '7_5t', 'class_2', 'class_1'));
alter table public.vehicles
  drop constraint if exists vehicles_planning_vehicle_class_check;
alter table public.vehicles
  add constraint vehicles_planning_vehicle_class_check check (
    planning_vehicle_class is null or
    (vehicle_class = 'van' and planning_vehicle_class = '3_5t') or
    (vehicle_class = 'rigid' and planning_vehicle_class in ('7_5t', 'class_2')) or
    (vehicle_class = 'artic_unit' and planning_vehicle_class = 'class_1')
  );
update public.vehicles set planning_vehicle_class = '3_5t'
where vehicle_class = 'van' and planning_vehicle_class is null;
update public.vehicles set planning_vehicle_class = 'class_1'
where vehicle_class = 'artic_unit' and planning_vehicle_class is null;

create table if not exists public.driver_vehicle_qualifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_class text not null check (vehicle_class in ('B', 'BE', 'C1', 'C1E', 'C', 'CE')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (driver_id, vehicle_class)
);

create index if not exists driver_vehicle_qualifications_company_driver_idx
  on public.driver_vehicle_qualifications(company_id, driver_id);
alter table public.driver_vehicle_qualifications enable row level security;
revoke all on table public.driver_vehicle_qualifications from public, anon, authenticated;

create or replace function public.set_driver_vehicle_qualifications(
  p_driver_id uuid,
  p_vehicle_classes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  invalid_count integer;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can set driver vehicle clearances' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_driver_id and p.company_id = actor_company_id and p.role = 'driver'
  ) then
    raise exception 'Driver is not available in this company' using errcode = '42501';
  end if;
  if jsonb_typeof(p_vehicle_classes) <> 'array' or jsonb_array_length(p_vehicle_classes) > 6 then
    raise exception 'Licence entitlements must be an array of up to six categories' using errcode = '22023';
  end if;
  select count(*) into invalid_count
  from jsonb_array_elements_text(p_vehicle_classes) value
  where value not in ('B', 'BE', 'C1', 'C1E', 'C', 'CE');
  if invalid_count > 0 then
    raise exception 'Licence entitlement is not recognised' using errcode = '22023';
  end if;

  delete from public.driver_vehicle_qualifications
  where company_id = actor_company_id and driver_id = p_driver_id;
  insert into public.driver_vehicle_qualifications(company_id, driver_id, vehicle_class, created_by)
  select actor_company_id, p_driver_id, value, actor_id
  from (select distinct value from jsonb_array_elements_text(p_vehicle_classes)) classes;

  return jsonb_build_object(
    'driver_id', p_driver_id,
    'vehicle_classes', coalesce((
      select jsonb_agg(q.vehicle_class order by q.vehicle_class)
      from public.driver_vehicle_qualifications q
      where q.company_id = actor_company_id and q.driver_id = p_driver_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.delete_rota_template(p_template_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  target public.rota_templates%rowtype;
  applied_plans integer;
  dated_slots integer;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can delete a rota pattern' using errcode = '42501';
  end if;
  select * into target from public.rota_templates
  where id = p_template_id and company_id = actor_company_id for update;
  if target.id is null then
    raise exception 'Rota pattern is not available in this company' using errcode = '42501';
  end if;
  select count(*) into applied_plans from public.rota_plans where template_id = target.id;
  select count(*) into dated_slots
  from public.rota_slots rs join public.rota_plans rp on rp.id = rs.plan_id
  where rp.template_id = target.id;
  delete from public.rota_templates where id = target.id;
  return jsonb_build_object(
    'template_id', target.id, 'name', target.name,
    'applied_plans_preserved', applied_plans,
    'dated_requirements_preserved', dated_slots
  );
end;
$$;

create or replace function public.enforce_rota_vehicle_clearance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  required_class text;
  assigned_class text;
begin
  if new.status = 'cancelled' then return new; end if;
  select rs.required_vehicle_class into required_class
  from public.rota_slots rs where rs.id = new.slot_id;
  if required_class is not null and not exists (
    select 1 from public.driver_vehicle_qualifications q
    where q.company_id = new.company_id and q.driver_id = new.driver_id
      and (
        (required_class = '3_5t' and q.vehicle_class in ('B', 'BE', 'C1', 'C1E', 'C', 'CE')) or
        (required_class = '7_5t' and q.vehicle_class in ('C1', 'C1E', 'C', 'CE')) or
        (required_class = 'class_2' and q.vehicle_class in ('C', 'CE')) or
        (required_class = 'class_1' and q.vehicle_class = 'CE')
      )
  ) then
    raise exception 'Driver licence entitlement does not cover the required vehicle class' using errcode = '23514';
  end if;
  if required_class is not null and new.vehicle_id is not null then
    select v.planning_vehicle_class into assigned_class
    from public.vehicles v where v.id = new.vehicle_id and v.company_id = new.company_id;
    if assigned_class is distinct from required_class then
      raise exception 'Assigned vehicle does not match the required vehicle class' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_rota_vehicle_clearance on public.rota_slot_assignments;
create trigger enforce_rota_vehicle_clearance
before insert or update of driver_id, slot_id, vehicle_id, status on public.rota_slot_assignments
for each row execute function public.enforce_rota_vehicle_clearance();

create or replace function public.create_cyclic_rota_template(
  p_name text, p_description text, p_cycle_length_days integer, p_slots jsonb, p_request_key uuid
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid(); actor_company_id uuid := public.get_my_company_id();
  template_id uuid; existing_cycle_length integer; existing_slot_count integer;
  slot jsonb; slot_count integer := 0; slot_cycle_day integer; vehicle_class text;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can create a rota pattern' using errcode = '42501'; end if;
  if p_request_key is null then raise exception 'A request key is required' using errcode = '22023'; end if;
  if nullif(btrim(p_name), '') is null or p_cycle_length_days not between 1 and 56
     or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) not between 1 and 500 then
    raise exception 'A name, a 1 to 56 day cycle, and between 1 and 500 requirements are needed' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor_company_id::text || ':' || p_request_key::text, 0));
  select rt.id, rt.cycle_length_days, count(rts.id)::integer into template_id, existing_cycle_length, existing_slot_count
  from public.rota_templates rt left join public.rota_template_slots rts on rts.template_id = rt.id
  where rt.company_id = actor_company_id and rt.request_key = p_request_key group by rt.id, rt.cycle_length_days;
  if template_id is not null then
    return jsonb_build_object('template_id', template_id, 'slot_count', existing_slot_count, 'cycle_length_days', existing_cycle_length, 'replayed', true);
  end if;
  insert into public.rota_templates(company_id, name, description, cycle_length_days, created_by, request_key)
  values (actor_company_id, btrim(p_name), nullif(btrim(p_description), ''), p_cycle_length_days, actor_id, p_request_key)
  returning id into template_id;
  for slot in select value from jsonb_array_elements(p_slots) loop
    slot_cycle_day := coalesce((slot ->> 'cycle_day')::integer, 0);
    vehicle_class := nullif(btrim(slot ->> 'required_vehicle_class'), '');
    if slot_cycle_day not between 1 and p_cycle_length_days or nullif(btrim(slot ->> 'role_label'), '') is null
       or (slot ->> 'start_time')::time = (slot ->> 'end_time')::time
       or coalesce((slot ->> 'required_headcount')::integer, 0) not between 1 and 50
       or (vehicle_class is not null and vehicle_class not in ('3_5t', '7_5t', 'class_2', 'class_1')) then
      raise exception 'Every requirement needs a valid day, name, time, headcount, and vehicle class' using errcode = '22023';
    end if;
    insert into public.rota_template_slots(company_id, template_id, cycle_day, role_label, start_time, end_time, required_headcount, required_skill, required_vehicle_class, sort_order)
    values (actor_company_id, template_id, slot_cycle_day, btrim(slot ->> 'role_label'), (slot ->> 'start_time')::time, (slot ->> 'end_time')::time,
      (slot ->> 'required_headcount')::integer, nullif(btrim(slot ->> 'required_skill'), ''), vehicle_class, coalesce((slot ->> 'sort_order')::integer, slot_count));
    slot_count := slot_count + 1;
  end loop;
  return jsonb_build_object('template_id', template_id, 'slot_count', slot_count, 'cycle_length_days', p_cycle_length_days, 'replayed', false);
end;
$$;

create or replace function public.apply_cyclic_rota_template(
  p_template_id uuid, p_name text, p_from date, p_to date, p_request_key uuid
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid(); actor_company_id uuid := public.get_my_company_id();
  template_record public.rota_templates%rowtype; plan_id uuid; inserted_count integer := 0; skipped_count integer := 0;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can apply a rota pattern' using errcode = '42501'; end if;
  if p_request_key is null or p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then raise exception 'A request key and a planning period between 1 and 367 days are required' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor_company_id::text || ':' || p_request_key::text, 0));
  select * into template_record from public.rota_templates where id = p_template_id and company_id = actor_company_id and active for update;
  if template_record.id is null then raise exception 'Rota pattern is not available in this company' using errcode = '42501'; end if;
  select id into plan_id from public.rota_plans where company_id = actor_company_id and template_id = p_template_id and date_start = p_from and date_end = p_to and status = 'planning' order by created_at desc limit 1 for update;
  if plan_id is null then
    insert into public.rota_plans(company_id, template_id, name, date_start, date_end, created_by)
    values (actor_company_id, p_template_id, coalesce(nullif(btrim(p_name), ''), template_record.name), p_from, p_to, actor_id) returning id into plan_id;
  end if;
  with mapped as (
    select day_value::date as slot_date, rts.* from generate_series(p_from, p_to, interval '1 day') day_value
    join public.rota_template_slots rts on rts.template_id = p_template_id and rts.cycle_day = ((day_value::date - p_from) % template_record.cycle_length_days) + 1
  ), inserted as (
    insert into public.rota_slots(company_id, plan_id, template_slot_id, slot_date, role_label, start_time, end_time, required_headcount, required_skill, required_vehicle_class, created_by)
    select actor_company_id, plan_id, id, slot_date, role_label, start_time, end_time, required_headcount, required_skill, required_vehicle_class, actor_id from mapped
    on conflict do nothing returning id
  ) select count(*) into inserted_count from inserted;
  select (public.preview_rota_template(p_template_id, p_from, p_to) ->> 'requirements')::integer - inserted_count into skipped_count;
  return jsonb_build_object('plan_id', plan_id, 'created', inserted_count, 'skipped', greatest(skipped_count, 0));
end;
$$;

create or replace function public.get_planning_workspace_snapshot(p_from date, p_to date)
returns jsonb
language plpgsql security definer stable set search_path = ''
as $$
declare actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can view the planning workspace' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then raise exception 'The visible planning period must be between 1 and 63 days' using errcode = '22023'; end if;
  return jsonb_build_object(
    'templates', coalesce((select jsonb_agg(to_jsonb(rt) order by rt.name) from public.rota_templates rt where rt.company_id = actor_company_id and rt.active), '[]'::jsonb),
    'template_slots', coalesce((select jsonb_agg(to_jsonb(rts) order by rts.template_id, rts.cycle_day, rts.sort_order, rts.id) from public.rota_template_slots rts join public.rota_templates rt on rt.id = rts.template_id where rts.company_id = actor_company_id and rt.active), '[]'::jsonb),
    'slots', coalesce((select jsonb_agg(to_jsonb(rs) order by rs.slot_date, rs.start_time, rs.role_label) from public.rota_slots rs where rs.company_id = actor_company_id and rs.slot_date between p_from and p_to and rs.status <> 'cancelled'), '[]'::jsonb),
    'assignments', coalesce((select jsonb_agg(to_jsonb(rsa) order by rsa.created_at) from public.rota_slot_assignments rsa join public.rota_slots rs on rs.id = rsa.slot_id where rsa.company_id = actor_company_id and rs.slot_date between p_from and p_to and rsa.status <> 'cancelled'), '[]'::jsonb),
    'availability', coalesce((select jsonb_agg(to_jsonb(sa) order by sa.starts_on, sa.driver_id) from public.staff_availability sa where sa.company_id = actor_company_id and sa.starts_on <= p_to and sa.ends_on >= p_from), '[]'::jsonb),
    'runs', coalesce((select jsonb_agg(to_jsonb(pr) order by pr.run_date, pr.start_time, pr.run_label) from public.planned_runs pr where pr.company_id = actor_company_id and pr.run_date between p_from and p_to and pr.status <> 'cancelled'), '[]'::jsonb),
    'run_jobs', coalesce((select jsonb_agg(to_jsonb(prj) order by prj.planned_run_id, prj.sequence) from public.planned_run_jobs prj join public.planned_runs pr on pr.id = prj.planned_run_id where prj.company_id = actor_company_id and pr.run_date between p_from and p_to and prj.status <> 'cancelled'), '[]'::jsonb),
    'leave_policies', coalesce((select jsonb_agg(to_jsonb(lcp) order by lcp.role_label, lcp.availability_type) from public.leave_capacity_policies lcp where lcp.company_id = actor_company_id and lcp.active), '[]'::jsonb),
    'driver_planning_profiles', coalesce((select jsonb_agg(to_jsonb(dpp) order by dpp.driver_id) from public.driver_planning_profiles dpp where dpp.company_id = actor_company_id), '[]'::jsonb),
    'driver_vehicle_qualifications', coalesce((select jsonb_agg(to_jsonb(q) order by q.driver_id, q.vehicle_class) from public.driver_vehicle_qualifications q where q.company_id = actor_company_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.set_driver_vehicle_qualifications(uuid, jsonb) from public, anon;
revoke all on function public.delete_rota_template(uuid) from public, anon;
revoke all on function public.enforce_rota_vehicle_clearance() from public, anon, authenticated;
revoke all on function public.create_cyclic_rota_template(text, text, integer, jsonb, uuid) from public, anon;
revoke all on function public.apply_cyclic_rota_template(uuid, text, date, date, uuid) from public, anon;
revoke all on function public.get_planning_workspace_snapshot(date, date) from public, anon;
grant execute on function public.set_driver_vehicle_qualifications(uuid, jsonb) to authenticated;
grant execute on function public.delete_rota_template(uuid) to authenticated;
grant execute on function public.create_cyclic_rota_template(text, text, integer, jsonb, uuid) to authenticated;
grant execute on function public.apply_cyclic_rota_template(uuid, text, date, date, uuid) to authenticated;
grant execute on function public.get_planning_workspace_snapshot(date, date) to authenticated;

comment on table public.driver_vehicle_qualifications is
  'Manager-recorded UK licence entitlement categories used for operational rota eligibility; document validity still requires separate checks.';
comment on function public.delete_rota_template(uuid) is
  'Deletes a reusable company rota pattern while preserving previously created dated plans and requirements.';
