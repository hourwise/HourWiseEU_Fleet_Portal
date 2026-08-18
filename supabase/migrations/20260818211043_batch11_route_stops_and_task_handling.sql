-- Batch 11: governed multi-stop planning and event-backed task handling.
-- Route estimates are deliberately not persisted here: no provider is
-- configured in this portal, so the read model must show unavailable rather
-- than inventing distance, duration, or ETA.

create table if not exists public.job_stops (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  stop_type text not null default 'service' check (stop_type in ('pickup', 'delivery', 'service', 'other')),
  site_name text,
  address_text text not null check (length(btrim(address_text)) between 1 and 500),
  latitude numeric(9,6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9,6) check (longitude is null or longitude between -180 and 180),
  contact_name text,
  contact_phone text,
  instructions text,
  driver_notes text,
  arrival_window_start timestamptz,
  arrival_window_end timestamptz,
  activity text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (arrival_window_end is null or arrival_window_start is null or arrival_window_end >= arrival_window_start)
);

create unique index if not exists job_stops_job_sequence_idx on public.job_stops(job_id, sequence);
create index if not exists job_stops_company_job_idx on public.job_stops(company_id, job_id, sequence);

create table if not exists public.job_stop_manager_notes (
  stop_id uuid primary key references public.job_stops(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  note text not null check (length(btrim(note)) between 1 and 1000),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_task_handlings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_type text not null check (source_type in ('fleet_event', 'job_assignment', 'vehicle_check', 'asset_readiness', 'shift')),
  source_id uuid not null,
  status text not null default 'new' check (status in ('new', 'acknowledged', 'in_progress', 'resolved')),
  owner_id uuid references public.profiles(id) on delete set null,
  action text,
  note text check (note is null or length(btrim(note)) <= 2000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(company_id, source_type, source_id)
);

create index if not exists operational_task_handlings_company_status_idx on public.operational_task_handlings(company_id, status, updated_at desc);

alter table public.job_stops enable row level security;
alter table public.job_stop_manager_notes enable row level security;
alter table public.operational_task_handlings enable row level security;

drop policy if exists "Managers can view company job stops" on public.job_stops;
create policy "Managers can view company job stops" on public.job_stops for select to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');
drop policy if exists "Drivers can view own published job stops" on public.job_stops;
create policy "Drivers can view own published job stops" on public.job_stops for select to authenticated
using (company_id = public.get_my_company_id() and exists (
  select 1 from public.job_assignments ja
  where ja.job_id = job_stops.job_id and ja.driver_id = auth.uid()
    and ja.status in ('published','updated','acknowledged','started','arrived','completed','delayed','unable_to_complete','vehicle_issue','site_issue','route_issue')
));

drop policy if exists "Managers can view company stop notes" on public.job_stop_manager_notes;
create policy "Managers can view company stop notes" on public.job_stop_manager_notes for select to authenticated
using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');

drop policy if exists "Managers can view company task handlings" on public.operational_task_handlings;
create policy "Managers can view company task handlings" on public.operational_task_handlings for select to authenticated
using (company_id = public.get_my_company_id() and (public.get_my_role() = 'manager' or public.actor_has_permission('operations.task.handle', company_id, null)));

revoke insert, update, delete on public.job_stops from public, anon, authenticated;
revoke insert, update, delete on public.job_stop_manager_notes from public, anon, authenticated;
revoke insert, update, delete on public.operational_task_handlings from public, anon, authenticated;
grant select on public.job_stops, public.job_stop_manager_notes, public.operational_task_handlings to authenticated;

insert into public.security_permissions (key, area, resource, operation, description, risk_level, requires_audit)
values ('operations.task.handle', 'operations', 'task', 'handle', 'Acknowledge, own, progress, and record bounded resolution handling for company operational tasks.', 'high', true)
on conflict (key) do update set description = excluded.description, risk_level = excluded.risk_level, requires_audit = excluded.requires_audit;

insert into public.security_role_permissions (role_key, permission_key, effect, scope_level)
values ('fleet_administrator', 'operations.task.handle', 'allow', 'organisation')
on conflict (role_key, permission_key, scope_level) do update set effect = excluded.effect;

create or replace function public.save_job_stops(
  p_job_id uuid,
  p_expected_job_updated_at timestamptz,
  p_stops jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  target_job public.jobs%rowtype;
  stop jsonb;
  stop_count integer := 0;
  expected_sequence integer;
  new_stop_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.get_my_role() <> 'manager' and not public.actor_has_permission('operations.job.update', actor_company_id, null) then
    raise exception 'Only an authorised planning manager can edit job stops' using errcode = '42501';
  end if;
  if jsonb_typeof(p_stops) <> 'array' or jsonb_array_length(p_stops) > 100 then
    raise exception 'Stop list must be an array containing no more than 100 stops' using errcode = '22023';
  end if;
  select * into target_job from public.jobs where id = p_job_id and company_id = actor_company_id for update;
  if target_job.id is null then raise exception 'Job is outside the actor company' using errcode = '42501'; end if;
  if p_expected_job_updated_at is null or target_job.updated_at is distinct from p_expected_job_updated_at then
    raise exception 'Job changed since it was loaded; refresh before editing stops' using errcode = '40001';
  end if;

  delete from public.job_stop_manager_notes where company_id = actor_company_id and stop_id in (select id from public.job_stops where job_id = p_job_id);
  delete from public.job_stops where job_id = p_job_id;
  for stop in select value from jsonb_array_elements(p_stops) loop
    stop_count := stop_count + 1;
    expected_sequence := (stop ->> 'sequence')::integer;
    if expected_sequence is null or expected_sequence <> stop_count then raise exception 'Stop sequence must be explicit and contiguous from 1' using errcode = '22023'; end if;
    if nullif(btrim(stop ->> 'address_text'), '') is null then raise exception 'Every stop needs an address or clear location text' using errcode = '22023'; end if;
    insert into public.job_stops (company_id, job_id, sequence, stop_type, site_name, address_text, latitude, longitude, contact_name, contact_phone, instructions, driver_notes, arrival_window_start, arrival_window_end, activity)
    values (actor_company_id, p_job_id, expected_sequence, coalesce(nullif(stop ->> 'stop_type',''), 'service'), nullif(btrim(stop ->> 'site_name'), ''), btrim(stop ->> 'address_text'), nullif(stop ->> 'latitude','')::numeric, nullif(stop ->> 'longitude','')::numeric, nullif(btrim(stop ->> 'contact_name'), ''), nullif(btrim(stop ->> 'contact_phone'), ''), nullif(btrim(stop ->> 'instructions'), ''), nullif(btrim(stop ->> 'driver_notes'), ''), nullif(stop ->> 'arrival_window_start','')::timestamptz, nullif(stop ->> 'arrival_window_end','')::timestamptz, nullif(btrim(stop ->> 'activity'), ''))
    returning id into new_stop_id;
    if nullif(btrim(stop ->> 'manager_notes'), '') is not null then
      insert into public.job_stop_manager_notes (stop_id, company_id, note, updated_by) values (new_stop_id, actor_company_id, btrim(stop ->> 'manager_notes'), auth.uid());
    end if;
  end loop;
  update public.jobs set updated_at = now() where id = p_job_id;
  perform public.record_security_event(actor_company_id, null, 'operations.job.update', 'allowed', 'job_route_updated', 'job', p_job_id, 'update', null, jsonb_build_object('stop_count', stop_count), 'user');
  return jsonb_build_object('job_id', p_job_id, 'stop_count', stop_count, 'updated_at', (select updated_at from public.jobs where id = p_job_id));
end;
$$;

create or replace function public.set_operational_task_handling(
  p_source_type text,
  p_source_id uuid,
  p_status text,
  p_owner_id uuid default null,
  p_action text default null,
  p_note text default null,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  source_company_id uuid;
  target public.operational_task_handlings%rowtype;
  owner_company_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.get_my_role() <> 'manager' and not public.actor_has_permission('operations.task.handle', actor_company_id, null) then raise exception 'Only an authorised manager can handle operational tasks' using errcode = '42501'; end if;
  if p_status not in ('new','acknowledged','in_progress','resolved') then raise exception 'Invalid task handling state' using errcode = '22023'; end if;
  if p_note is not null and length(btrim(p_note)) > 2000 then raise exception 'Task note is limited to 2000 characters' using errcode = '22023'; end if;
  if p_source_type = 'fleet_event' then select company_id into source_company_id from public.fleet_events where id = p_source_id;
  elsif p_source_type = 'job_assignment' then select company_id into source_company_id from public.job_assignments where id = p_source_id;
  elsif p_source_type = 'vehicle_check' then select company_id into source_company_id from public.vehicle_checks where id = p_source_id;
  elsif p_source_type = 'shift' then select company_id into source_company_id from public.shifts where id = p_source_id;
  elsif p_source_type = 'asset_readiness' then select company_id into source_company_id from public.vehicles where id = p_source_id;
  else raise exception 'Unsupported task source type' using errcode = '22023'; end if;
  if source_company_id is distinct from actor_company_id then raise exception 'Task source is outside the actor company' using errcode = '42501'; end if;
  if p_owner_id is not null then
    select company_id into owner_company_id from public.profiles where id = p_owner_id;
    if owner_company_id is distinct from actor_company_id then raise exception 'Task owner is outside the actor company' using errcode = '42501'; end if;
    if not exists (select 1 from public.profiles where id = p_owner_id and role = 'manager') then raise exception 'Tasks can only be owned by authorised managers' using errcode = '42501'; end if;
  end if;
  select * into target from public.operational_task_handlings where company_id = actor_company_id and source_type = p_source_type and source_id = p_source_id for update;
  if target.id is not null and p_expected_updated_at is not null and target.updated_at is distinct from p_expected_updated_at then raise exception 'Task handling changed since it was loaded; refresh before updating' using errcode = '40001'; end if;
  insert into public.operational_task_handlings (company_id, source_type, source_id, status, owner_id, action, note, created_by, updated_by, resolved_at)
  values (actor_company_id, p_source_type, p_source_id, p_status, p_owner_id, nullif(btrim(p_action), ''), nullif(btrim(p_note), ''), auth.uid(), auth.uid(), case when p_status = 'resolved' then now() else null end)
  on conflict (company_id, source_type, source_id) do update set status = excluded.status, owner_id = excluded.owner_id, action = excluded.action, note = excluded.note, updated_by = auth.uid(), updated_at = now(), resolved_at = excluded.resolved_at
  returning * into target;
  perform public.record_security_event(actor_company_id, null, 'operations.task.handle', 'allowed', 'operational_task_handled', p_source_type, p_source_id, 'update', null, jsonb_build_object('handling_id', target.id, 'status', target.status, 'owner_id', target.owner_id, 'action', target.action), 'user');
  return to_jsonb(target);
end;
$$;

revoke all on function public.save_job_stops(uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.save_job_stops(uuid, timestamptz, jsonb) to authenticated;
revoke all on function public.set_operational_task_handling(text, uuid, text, uuid, text, text, timestamptz) from public, anon;
grant execute on function public.set_operational_task_handling(text, uuid, text, uuid, text, text, timestamptz) to authenticated;

comment on table public.job_stops is 'Company-scoped ordered stops for a job. Route estimates remain an external-provider boundary.';
comment on table public.operational_task_handlings is 'Manager handling state for projected source records; it never replaces source truth.';
