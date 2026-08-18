-- Batch 12: persistent, deterministic Atlas signal observations and driver
-- compliance task projection. No model gateway or inference is involved.

alter table public.operational_task_handlings
  drop constraint if exists operational_task_handlings_source_type_check;
alter table public.operational_task_handlings
  add constraint operational_task_handlings_source_type_check
  check (source_type in ('fleet_event', 'job_assignment', 'vehicle_check', 'asset_readiness', 'shift', 'driver_compliance'));

create table if not exists public.atlas_signal_observations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  signal_key text not null check (length(btrim(signal_key)) between 1 and 300),
  fingerprint text not null check (length(btrim(fingerprint)) between 1 and 500),
  section text not null check (section in ('yesterday', 'today', 'tomorrow', 'next30')),
  severity text not null check (severity in ('critical', 'warning', 'advisory')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_source_updated_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique(company_id, signal_key)
);

create index if not exists atlas_signal_observations_company_seen_idx
  on public.atlas_signal_observations(company_id, last_seen_at desc);

alter table public.atlas_signal_observations enable row level security;
drop policy if exists "Managers can view company Atlas observations" on public.atlas_signal_observations;
create policy "Managers can view company Atlas observations"
  on public.atlas_signal_observations for select to authenticated
  using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');

revoke insert, update, delete on public.atlas_signal_observations from public, anon, authenticated;
grant select on public.atlas_signal_observations to authenticated;

create or replace function public.sync_atlas_signal_observations(p_signals jsonb)
returns table(signal_key text, is_new boolean, first_seen_at timestamptz, last_seen_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
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
    select * into existing from public.atlas_signal_observations
    where company_id = actor_company_id and signal_key = key_value for update;
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
      set fingerprint = fingerprint_value,
          section = section_value,
          severity = severity_value,
          last_seen_at = now(),
          last_source_updated_at = nullif(signal ->> 'source_updated_at', '')::timestamptz,
          updated_at = now()
      where id = existing.id
      returning * into existing;
    end if;
    first_seen_at := existing.first_seen_at;
    last_seen_at := existing.last_seen_at;
    return next;
  end loop;
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
  elsif p_source_type = 'driver_compliance' then select company_id into source_company_id from public.profiles where id = p_source_id;
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

revoke all on function public.sync_atlas_signal_observations(jsonb) from public, anon;
grant execute on function public.sync_atlas_signal_observations(jsonb) to authenticated;
revoke all on function public.set_operational_task_handling(text, uuid, text, uuid, text, text, timestamptz) from public, anon;
grant execute on function public.set_operational_task_handling(text, uuid, text, uuid, text, text, timestamptz) to authenticated;

comment on table public.atlas_signal_observations is 'Persistent fingerprints for deterministic Atlas signals; unchanged signals are known, changed/new fingerprints are newly surfaced.';
