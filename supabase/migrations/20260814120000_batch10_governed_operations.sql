-- Batch 10: server-authoritative asset assignment policy and governed
-- operational execution. This migration is additive; prior migrations remain
-- unchanged and existing data is retained.

begin;

-- The existing status enum represented the publication lifecycle. Extend it
-- with the smallest execution vocabulary needed by the driver workflow.
alter type public.job_assignment_status add value if not exists 'acknowledged';
alter type public.job_assignment_status add value if not exists 'started';
alter type public.job_assignment_status add value if not exists 'arrived';
alter type public.job_assignment_status add value if not exists 'completed';
alter type public.job_assignment_status add value if not exists 'delayed';
alter type public.job_assignment_status add value if not exists 'unable_to_complete';
alter type public.job_assignment_status add value if not exists 'vehicle_issue';
alter type public.job_assignment_status add value if not exists 'site_issue';
alter type public.job_assignment_status add value if not exists 'route_issue';

insert into public.security_permissions (key, area, resource, operation, description, risk_level, requires_audit)
values
  ('operations.asset.override_assignment', 'operations', 'asset', 'override_assignment', 'Record a time-bound manager override for non-prohibited asset readiness evidence.', 'critical', true),
  ('operations.job.transition', 'operations', 'job', 'transition', 'Perform an authorised manager intervention in the job execution lifecycle.', 'high', true)
on conflict (key) do update set description = excluded.description, risk_level = excluded.risk_level, requires_audit = excluded.requires_audit;

insert into public.security_role_permissions (role_key, permission_key, effect, scope_level)
values
  ('fleet_administrator', 'operations.asset.override_assignment', 'allow', 'organisation'),
  ('fleet_administrator', 'operations.job.transition', 'allow', 'organisation')
on conflict (role_key, permission_key, scope_level) do update set effect = excluded.effect;

create table if not exists public.asset_assignment_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  job_assignment_id uuid references public.job_assignments(id) on delete set null,
  readiness_policy jsonb not null default '{}'::jsonb,
  reason text not null check (length(btrim(reason)) between 20 and 1000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists asset_assignment_overrides_active_shift_vehicle_idx
  on public.asset_assignment_overrides(shift_id, vehicle_id)
  where revoked_at is null;
create index if not exists asset_assignment_overrides_company_created_idx
  on public.asset_assignment_overrides(company_id, created_at desc);

alter table public.asset_assignment_overrides enable row level security;
drop policy if exists "Managers can view company asset assignment overrides" on public.asset_assignment_overrides;
create policy "Managers can view company asset assignment overrides"
  on public.asset_assignment_overrides for select
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'manager'
  );
revoke insert, update, delete on public.asset_assignment_overrides from public, anon, authenticated;
grant select on public.asset_assignment_overrides to authenticated;

-- Canonical server-side policy. The browser-side evaluator is a display/read
-- model only; assignment guards call this function against database truth.
create or replace function public.get_asset_assignment_policy(
  p_company_id uuid,
  p_vehicle_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  vehicle_record public.vehicles%rowtype;
  check_count integer := 0;
  unresolved_defect_count integer := 0;
  document_count integer := 0;
  status text := 'ready';
  hard_block boolean := false;
  reasons jsonb := '[]'::jsonb;
  is_trailer boolean := false;
  days_remaining integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if public.get_my_company_id() is distinct from p_company_id then
    raise exception 'Asset policy is outside the actor company' using errcode = '42501';
  end if;

  select * into vehicle_record
  from public.vehicles
  where id = p_vehicle_id
    and company_id = p_company_id;

  if vehicle_record.id is null then
    return jsonb_build_object(
      'asset_id', p_vehicle_id,
      'status', 'prohibited',
      'hard_block', true,
      'override_allowed', false,
      'reasons', jsonb_build_array(jsonb_build_object('code', 'asset_not_in_company', 'severity', 'prohibited', 'label', 'Vehicle is not available in this company'))
    );
  end if;

  is_trailer := vehicle_record.vehicle_class = 'trailer' or vehicle_record.vehicle_type = 'trailer';

  if coalesce(vehicle_record.is_vor, false) then
    hard_block := true;
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'vehicle_off_road', 'severity', 'prohibited', 'label', 'Vehicle is marked off road'));
  end if;

  select count(*), count(*) filter (
    where check_status = 'defect'
      and coalesce(defect_lifecycle_status, 'reported') <> 'fixed'
  )
  into check_count, unresolved_defect_count
  from public.vehicle_checks
  where company_id = p_company_id
    and upper(reg_number) = upper(vehicle_record.reg_number);

  if check_count = 0 then
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'safety_defects_unknown', 'severity', 'unknown', 'label', 'Safety defect evidence is unavailable'));
  elsif unresolved_defect_count > 0 then
    hard_block := true;
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'unresolved_safety_defect', 'severity', 'prohibited', 'label', format('%s unresolved safety defect(s)', unresolved_defect_count)));
  end if;

  if vehicle_record.mot_due_date is null then
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'mot_due', 'severity', 'unknown', 'label', case when is_trailer then 'Annual test date is missing' else 'MOT date is missing' end));
  else
    days_remaining := vehicle_record.mot_due_date::date - current_date;
    if days_remaining < 0 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'mot_expired', 'severity', 'action_required', 'label', 'MOT or annual test has expired', 'due_date', vehicle_record.mot_due_date));
    elsif days_remaining <= 14 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'mot_expiring', 'severity', 'warning', 'label', 'MOT or annual test is due within 14 days', 'due_date', vehicle_record.mot_due_date));
    end if;
  end if;

  if vehicle_record.pmi_due_date is null then
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'pmi_due', 'severity', 'unknown', 'label', 'PMI or service due date is missing'));
  else
    days_remaining := vehicle_record.pmi_due_date::date - current_date;
    if days_remaining < 0 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'pmi_expired', 'severity', 'action_required', 'label', 'PMI or service date has expired', 'due_date', vehicle_record.pmi_due_date));
    elsif days_remaining <= 14 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'pmi_expiring', 'severity', 'warning', 'label', 'PMI or service is due within 14 days', 'due_date', vehicle_record.pmi_due_date));
    end if;
  end if;

  if not is_trailer then
    if vehicle_record.tacho_calibration_due is null then
      reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'tacho_calibration_due', 'severity', 'unknown', 'label', 'Tachograph calibration date is missing'));
    else
      days_remaining := vehicle_record.tacho_calibration_due::date - current_date;
      if days_remaining < 0 then
        reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'tacho_calibration_expired', 'severity', 'action_required', 'label', 'Tachograph calibration has expired', 'due_date', vehicle_record.tacho_calibration_due));
      elsif days_remaining <= 14 then
        reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'tacho_calibration_expiring', 'severity', 'warning', 'label', 'Tachograph calibration is due within 14 days', 'due_date', vehicle_record.tacho_calibration_due));
      end if;
    end if;
  end if;

  if vehicle_record.insurance_expiry is null then
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'insurance_unknown', 'severity', 'unknown', 'label', 'Insurance expiry evidence is unavailable'));
  else
    days_remaining := vehicle_record.insurance_expiry::date - current_date;
    if days_remaining < 0 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'insurance_expired', 'severity', 'action_required', 'label', 'Insurance evidence has expired', 'due_date', vehicle_record.insurance_expiry));
    elsif days_remaining <= 14 then
      reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'insurance_expiring', 'severity', 'warning', 'label', 'Insurance expires within 14 days', 'due_date', vehicle_record.insurance_expiry));
    end if;
  end if;

  select count(*) into document_count
  from public.vehicle_documents
  where company_id = p_company_id and vehicle_id = vehicle_record.id;
  if document_count = 0 then
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'documents_missing', 'severity', 'unknown', 'label', 'No vehicle documents are recorded'));
  end if;

  if hard_block or jsonb_path_exists(reasons, '$[*] ? (@.severity == "prohibited")') then
    status := 'prohibited';
  elsif jsonb_path_exists(reasons, '$[*] ? (@.severity == "action_required")') then
    status := 'action_required';
  elsif jsonb_path_exists(reasons, '$[*] ? (@.severity == "warning")') then
    status := 'warning';
  elsif jsonb_path_exists(reasons, '$[*] ? (@.severity == "unknown")') then
    status := 'unknown';
  end if;

  return jsonb_build_object(
    'asset_id', vehicle_record.id,
    'registration', vehicle_record.reg_number,
    'status', status,
    'hard_block', hard_block,
    'override_allowed', status in ('unknown', 'action_required') and not hard_block,
    'reasons', reasons
  );
end;
$$;

comment on function public.get_asset_assignment_policy(uuid, uuid) is
  'Canonical database-truth asset assignment readiness policy. Browser readiness calculations are advisory only.';

create or replace function public.create_asset_assignment_override(
  p_shift_id uuid,
  p_vehicle_id uuid,
  p_job_assignment_id uuid default null,
  p_reason text default null,
  p_expected_shift_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  target_shift public.shifts%rowtype;
  target_assignment public.job_assignments%rowtype;
  policy jsonb;
  override_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if public.get_my_role() is distinct from 'manager'
     or actor_company_id is null
     or not public.actor_has_permission('operations.asset.override_assignment', actor_company_id, null) then
    perform public.record_security_event(actor_company_id, null, 'operations.asset.override_assignment', 'denied', 'manager_or_permission_mismatch', 'shift', p_shift_id, 'override');
    raise exception 'Only an authorised manager can override asset readiness';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null or length(btrim(p_reason)) < 20 or length(p_reason) > 1000 then
    raise exception 'A meaningful asset override reason between 20 and 1000 characters is required' using errcode = '22023';
  end if;

  select * into target_shift from public.shifts where id = p_shift_id and company_id = actor_company_id for update;
  if target_shift.id is null then raise exception 'Shift not found for this company' using errcode = '42501'; end if;
  if p_expected_shift_updated_at is null or target_shift.updated_at is distinct from p_expected_shift_updated_at then
    raise exception 'Shift changed since it was loaded; refresh before recording an override' using errcode = '40001';
  end if;
  if p_job_assignment_id is not null then
    select * into target_assignment from public.job_assignments where id = p_job_assignment_id and company_id = actor_company_id and shift_id = p_shift_id for update;
    if target_assignment.id is null then raise exception 'Job assignment does not belong to this shift and company' using errcode = '42501'; end if;
  end if;

  policy := public.get_asset_assignment_policy(actor_company_id, p_vehicle_id);
  if coalesce((policy ->> 'hard_block')::boolean, true) then raise exception 'This asset is prohibited and cannot be overridden: %', policy -> 'reasons' using errcode = '42501'; end if;
  if coalesce((policy ->> 'override_allowed')::boolean, false) is false then raise exception 'This asset does not require an override' using errcode = '22023'; end if;

  insert into public.asset_assignment_overrides (company_id, shift_id, vehicle_id, job_assignment_id, readiness_policy, reason, created_by)
  values (actor_company_id, p_shift_id, p_vehicle_id, p_job_assignment_id, policy, btrim(p_reason), auth.uid())
  on conflict (shift_id, vehicle_id) where revoked_at is null
  do update set job_assignment_id = excluded.job_assignment_id, readiness_policy = excluded.readiness_policy, reason = excluded.reason, created_by = excluded.created_by, created_at = now()
  returning id into override_id;

  perform public.record_security_event(actor_company_id, null, 'operations.asset.override_assignment', 'allowed', 'asset_assignment_overridden', 'vehicle', p_vehicle_id, 'override', null, jsonb_build_object('override_id', override_id, 'shift_id', p_shift_id, 'job_assignment_id', p_job_assignment_id, 'reason', btrim(p_reason), 'readiness_policy', policy));
  return jsonb_build_object('override_id', override_id, 'shift_id', p_shift_id, 'vehicle_id', p_vehicle_id, 'policy', policy);
end;
$$;

create or replace function public.enforce_asset_assignment_readiness()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_company_id uuid;
  target_shift_id uuid;
  target_vehicle_id uuid;
  policy jsonb;
  has_override boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if tg_table_name = 'shifts' then
    target_company_id := new.company_id;
    target_shift_id := new.id;
    target_vehicle_id := new.vehicle_id;
  else
    target_company_id := new.company_id;
    target_shift_id := new.shift_id;
    select coalesce(new.vehicle_id, s.vehicle_id) into target_vehicle_id from public.shifts s where s.id = new.shift_id;
  end if;
  if target_vehicle_id is null then return new; end if;

  policy := public.get_asset_assignment_policy(target_company_id, target_vehicle_id);
  if coalesce((policy ->> 'hard_block')::boolean, true) then
    raise exception 'Asset assignment prohibited: %', policy -> 'reasons' using errcode = '42501';
  end if;
  if (policy ->> 'status') in ('unknown', 'action_required') then
    select exists (
      select 1 from public.asset_assignment_overrides o
      where o.company_id = target_company_id
        and o.shift_id = target_shift_id
        and o.vehicle_id = target_vehicle_id
        and o.revoked_at is null
    ) into has_override;
    if not has_override then raise exception 'Asset assignment requires a recorded readiness override: %', policy -> 'reasons' using errcode = '42501'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_shift_asset_assignment_readiness on public.shifts;
create trigger enforce_shift_asset_assignment_readiness
before insert or update of vehicle_id, status on public.shifts
for each row execute function public.enforce_asset_assignment_readiness();

drop trigger if exists enforce_job_asset_assignment_readiness on public.job_assignments;
create trigger enforce_job_asset_assignment_readiness
before insert or update of vehicle_id, shift_id on public.job_assignments
for each row execute function public.enforce_asset_assignment_readiness();

-- Public callers use these guarded wrappers. The old functions remain usable
-- internally by the wrappers but are no longer executable by authenticated
-- clients, preventing an alternate unguarded browser path.
create or replace function public.create_job_assignment_with_asset_guard(
  p_shift_id uuid,
  p_reference text,
  p_title text,
  p_job_type text,
  p_address_text text,
  p_customer_name text default null,
  p_contact_name text default null,
  p_contact_phone text default null,
  p_instructions text default null,
  p_manager_notes text default null,
  p_sequence integer default 1,
  p_planned_arrival_at timestamptz default null,
  p_planned_departure_at timestamptz default null,
  p_expected_duration_minutes integer default null,
  p_requires_ack boolean default true
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  target_shift public.shifts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into target_shift from public.shifts where id = p_shift_id and company_id = actor_company_id for update;
  if target_shift.id is null then raise exception 'Shift not found for this company' using errcode = '42501'; end if;
  -- The insert trigger independently evaluates the shift vehicle. This
  -- wrapper exists to make the guarded function the only client entry point.
  return public.create_job_assignment_with_event(
    p_shift_id, p_reference, p_title, p_job_type, p_address_text,
    p_customer_name, p_contact_name, p_contact_phone, p_instructions,
    p_manager_notes, p_sequence, p_planned_arrival_at,
    p_planned_departure_at, p_expected_duration_minutes, p_requires_ack
  );
end;
$$;

create or replace function public.update_shift_with_asset_guard(
  p_shift_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_vehicle_id uuid default null,
  p_notes text default null,
  p_requires_ack boolean default true
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  target_shift public.shifts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into target_shift from public.shifts where id = p_shift_id and company_id = actor_company_id for update;
  if target_shift.id is null then raise exception 'Shift not found for this company' using errcode = '42501'; end if;
  return public.update_shift_with_event(p_shift_id, p_date, p_start_time, p_end_time, p_vehicle_id, p_notes, p_requires_ack);
end;
$$;

revoke all on function public.get_asset_assignment_policy(uuid, uuid) from public, anon;
grant execute on function public.get_asset_assignment_policy(uuid, uuid) to authenticated;
revoke all on function public.create_asset_assignment_override(uuid, uuid, uuid, text, timestamptz) from public, anon;
grant execute on function public.create_asset_assignment_override(uuid, uuid, uuid, text, timestamptz) to authenticated;
revoke all on function public.create_job_assignment_with_event(uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz, timestamptz, integer, boolean) from authenticated, anon, public;
grant execute on function public.create_job_assignment_with_asset_guard(uuid, text, text, text, text, text, text, text, text, text, integer, timestamptz, timestamptz, integer, boolean) to authenticated;
revoke all on function public.update_shift_with_event(uuid, date, time, time, uuid, text, boolean) from authenticated, anon, public;
grant execute on function public.update_shift_with_asset_guard(uuid, date, time, time, uuid, text, boolean) to authenticated;

comment on function public.create_asset_assignment_override(uuid, uuid, uuid, text, timestamptz) is
  'Manager-only, same-company, audited asset readiness override. Hard-prohibited assets cannot be overridden.';

commit;
