begin;

-- Batch 7: complete the existing vehicle defect lifecycle and close the
-- manager tachograph-training persistence seam without redesigning either
-- subsystem.

alter table public.vehicle_checks
  add column if not exists updated_at timestamptz not null default now();

update public.vehicle_checks
set updated_at = coalesce(created_at, now())
where updated_at is null;

create or replace function public.set_vehicle_check_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicle_checks_set_updated_at on public.vehicle_checks;
create trigger vehicle_checks_set_updated_at
before update on public.vehicle_checks
for each row execute function public.set_vehicle_check_updated_at();

alter table public.maintenance_logs
  add column if not exists vehicle_check_id uuid
    references public.vehicle_checks(id) on delete set null;

create index if not exists idx_maintenance_logs_vehicle_check
  on public.maintenance_logs(vehicle_check_id, completed_at desc);

-- Lifecycle changes are now made by the governed RPC. Existing manager reads
-- and driver-created checks remain intact; direct manager UPDATE is removed so
-- callers cannot edit identity or resolution fields around the RPC boundary.
drop policy if exists "Managers can update defect status" on public.vehicle_checks;
revoke update on table public.vehicle_checks from authenticated;

-- A repair log may still be created by the existing maintenance workflow, but
-- its defect reference is attached by the lifecycle RPC after same-company
-- and same-vehicle validation.
revoke update on table public.maintenance_logs from authenticated;

insert into public.security_permissions (
  key, area, resource, operation, description, risk_level, requires_audit
)
values (
  'compliance.training.assign',
  'compliance',
  'training',
  'assign',
  'Assign an approved tachograph corrective-action training record.',
  'high',
  true
)
on conflict (key) do update
set description = excluded.description,
    risk_level = excluded.risk_level,
    requires_audit = excluded.requires_audit;

insert into public.security_role_permissions (
  role_key, permission_key, effect, scope_level
)
values (
  'fleet_administrator', 'compliance.training.assign', 'allow', 'organisation'
)
on conflict (role_key, permission_key, scope_level) do update
set effect = excluded.effect;

-- The table previously had no manager SELECT policy. Adding this narrow read
-- policy lets existing manager training pages see records created by the
-- governed assignment without granting direct writes.
drop policy if exists "Managers can read company training records" on public.training_records;
create policy "Managers can read company training records"
  on public.training_records
  for select
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'manager'
  );

create or replace function public.update_vehicle_check_lifecycle(
  p_check_id uuid,
  p_to_status text,
  p_resolution_notes text default null,
  p_closing_odometer integer default null,
  p_expected_updated_at timestamptz default null,
  p_maintenance_log_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  check_record public.vehicle_checks%rowtype;
  linked_log public.maintenance_logs%rowtype;
  normalized_status text := lower(btrim(coalesce(p_to_status, '')));
  previous_status text;
  unresolved_defect_count integer := 0;
  returned_to_service boolean := false;
  updated_check public.vehicle_checks%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.get_my_role() is distinct from 'manager'
     or actor_company_id is null
     or not public.actor_has_permission('compliance.finding.review', actor_company_id, null) then
    perform public.record_security_event(
      actor_company_id,
      null,
      'compliance.finding.review',
      'denied',
      'manager_company_or_permission_mismatch',
      'vehicle_check',
      p_check_id,
      'lifecycle_update'
    );
    raise exception 'Only an authorised manager can update vehicle defect lifecycle';
  end if;

  if normalized_status not in ('reported', 'in_progress', 'fixed') then
    raise exception 'Unsupported vehicle defect lifecycle status';
  end if;

  select *
  into check_record
  from public.vehicle_checks
  where id = p_check_id
    and company_id = actor_company_id
  for update;

  if check_record.id is null then
    raise exception 'Vehicle check not found for this company';
  end if;

  if check_record.check_status is distinct from 'defect' then
    raise exception 'Only a defect vehicle check can enter the defect lifecycle';
  end if;

  if p_expected_updated_at is null
     or check_record.updated_at is distinct from p_expected_updated_at then
    perform public.record_security_event(
      actor_company_id,
      null,
      'compliance.finding.review',
      'denied',
      'stale_vehicle_check_lifecycle_state',
      'vehicle_check',
      check_record.id,
      'lifecycle_update',
      null,
      jsonb_build_object(
        'expectedUpdatedAt', p_expected_updated_at,
        'actualUpdatedAt', check_record.updated_at
      )
    );
    raise exception 'Vehicle defect changed since it was loaded; reload before updating';
  end if;

  previous_status := coalesce(check_record.defect_lifecycle_status, 'reported');
  if previous_status = 'reported' and normalized_status <> 'in_progress' then
    raise exception 'A reported defect must move to in_progress before it can be fixed';
  end if;
  if previous_status = 'in_progress' and normalized_status <> 'fixed' then
    raise exception 'An in-progress defect can only move to fixed';
  end if;
  if previous_status = 'fixed' then
    raise exception 'A fixed defect is terminal and cannot be reopened through this action';
  end if;

  if normalized_status = 'fixed' then
    if p_maintenance_log_id is null then
      raise exception 'A repair log must be linked before a defect can be fixed';
    end if;

    select *
    into linked_log
    from public.maintenance_logs
    where id = p_maintenance_log_id
      and company_id = actor_company_id
      and vehicle_check_id is null
      and exists (
        select 1
        from public.vehicles v
        where v.id = public.maintenance_logs.vehicle_id
          and v.company_id = actor_company_id
          and upper(v.reg_number) = upper(check_record.reg_number)
      )
    for update;

    if linked_log.id is null then
      raise exception 'Repair log not found for this company or vehicle, or it is already linked';
    end if;

    update public.maintenance_logs
    set vehicle_check_id = check_record.id
    where id = linked_log.id;
  end if;

  update public.vehicle_checks
  set defect_lifecycle_status = normalized_status,
      resolution_notes = case
        when normalized_status = 'fixed' then nullif(btrim(coalesce(p_resolution_notes, '')), '')
        else resolution_notes
      end,
      resolved_at = case when normalized_status = 'fixed' then now() else resolved_at end,
      resolved_by = case when normalized_status = 'fixed' then auth.uid() else resolved_by end,
      closing_odometer = case when normalized_status = 'fixed' then p_closing_odometer else closing_odometer end
  where id = check_record.id
  returning * into updated_check;

  if normalized_status = 'fixed' then
    select count(*)
    into unresolved_defect_count
    from public.vehicle_checks
    where company_id = actor_company_id
      and upper(reg_number) = upper(updated_check.reg_number)
      and check_status = 'defect'
      and coalesce(defect_lifecycle_status, 'reported') <> 'fixed';

    if unresolved_defect_count = 0 then
      update public.vehicles
      set is_vor = false,
          maintenance_called = false,
          updated_at = now()
      where company_id = actor_company_id
        and upper(reg_number) = upper(updated_check.reg_number);
      returned_to_service := true;
    end if;
  end if;

  perform public.record_security_event(
    actor_company_id,
    null,
    'compliance.finding.review',
    'allowed',
    'vehicle_defect_lifecycle_updated',
    'vehicle_check',
    updated_check.id,
    'lifecycle_update',
    null,
    jsonb_build_object(
      'previousStatus', previous_status,
      'newStatus', normalized_status,
      'maintenanceLogId', p_maintenance_log_id,
      'unresolvedDefectCount', unresolved_defect_count,
      'returnedToService', returned_to_service,
      'resolutionNotes', updated_check.resolution_notes,
      'closingOdometer', updated_check.closing_odometer
    )
  );

  return jsonb_build_object(
    'checkId', updated_check.id,
    'previousStatus', previous_status,
    'newStatus', updated_check.defect_lifecycle_status,
    'resolutionNotes', updated_check.resolution_notes,
    'resolvedAt', updated_check.resolved_at,
    'resolvedBy', updated_check.resolved_by,
    'closingOdometer', updated_check.closing_odometer,
    'maintenanceLogId', p_maintenance_log_id,
    'unresolvedDefectCount', unresolved_defect_count,
    'returnedToService', returned_to_service,
    'updatedAt', updated_check.updated_at
  );
end;
$$;

revoke all on function public.update_vehicle_check_lifecycle(uuid, text, text, integer, timestamptz, uuid) from public;
revoke all on function public.update_vehicle_check_lifecycle(uuid, text, text, integer, timestamptz, uuid) from anon;
grant execute on function public.update_vehicle_check_lifecycle(uuid, text, text, integer, timestamptz, uuid) to authenticated;

comment on function public.update_vehicle_check_lifecycle(uuid, text, text, integer, timestamptz, uuid) is
  'Authenticated manager-only, same-company vehicle defect lifecycle transition with stale-write protection, repair linkage, return-to-service gating, and audit evidence.';

create or replace function public.assign_tachograph_training(
  p_driver_id uuid,
  p_module_id text,
  p_title text,
  p_notes text default null,
  p_finding_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  driver_record public.profiles%rowtype;
  training_record public.training_records%rowtype;
  finding_id uuid;
  review_result jsonb;
  review_results jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.get_my_role() is distinct from 'manager'
     or actor_company_id is null
     or not public.actor_has_permission('compliance.training.assign', actor_company_id, null) then
    perform public.record_security_event(
      actor_company_id,
      null,
      'compliance.training.assign',
      'denied',
      'manager_company_or_permission_mismatch',
      'training_record',
      null,
      'assign'
    );
    raise exception 'Only an authorised manager can assign tachograph training';
  end if;

  if p_driver_id is null
     or p_title is null
     or length(btrim(p_title)) = 0
     or length(p_title) > 200
     or p_module_id is null
     or length(btrim(p_module_id)) = 0
     or length(p_module_id) > 100
     or length(coalesce(p_notes, '')) > 2000 then
    raise exception 'Invalid tachograph training assignment fields';
  end if;

  select *
  into driver_record
  from public.profiles
  where id = p_driver_id
    and company_id = actor_company_id
    and role = 'driver'
    and coalesce(is_active, true) = true;

  if driver_record.id is null then
    raise exception 'Training driver is not active in the manager company';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_finding_ids, '{}'::uuid[])) requested_finding_id
    where not exists (
      select 1
      from public.tachograph_findings finding
      where finding.id = requested_finding_id
        and finding.company_id = actor_company_id
        and finding.driver_id = p_driver_id
    )
  ) then
    raise exception 'One or more tachograph findings do not belong to the target driver and company';
  end if;

  insert into public.training_records (
    company_id,
    driver_id,
    training_type,
    module_id,
    title,
    hours_credited,
    status,
    assigned_by,
    notes
  )
  values (
    actor_company_id,
    p_driver_id,
    'tacho_refresher',
    btrim(p_module_id),
    btrim(p_title),
    0,
    'assigned',
    auth.uid(),
    nullif(btrim(coalesce(p_notes, '')), '')
  )
  returning * into training_record;

  -- The existing review RPC remains the authority for review state and event
  -- creation. Calling it in this transaction makes training + review linkage
  -- atomic while preserving the accepted Batch 6 contract.
  foreach finding_id in array coalesce(p_finding_ids, '{}'::uuid[]) loop
    review_result := public.save_tachograph_finding_review(
      actor_company_id,
      finding_id,
      'action_required',
      nullif(btrim(coalesce(p_notes, '')), ''),
      'training',
      training_record.id
    );
    review_results := review_results || jsonb_build_array(review_result);
  end loop;

  perform public.record_security_event(
    actor_company_id,
    null,
    'compliance.training.assign',
    'allowed',
    'tachograph_training_assigned',
    'training_record',
    training_record.id,
    'assign',
    null,
    jsonb_build_object(
      'driverId', p_driver_id,
      'moduleId', training_record.module_id,
      'findingIds', coalesce(to_jsonb(p_finding_ids), '[]'::jsonb),
      'reviewCount', jsonb_array_length(review_results)
    )
  );

  return jsonb_build_object(
    'trainingRecordId', training_record.id,
    'driverId', training_record.driver_id,
    'moduleId', training_record.module_id,
    'title', training_record.title,
    'status', training_record.status,
    'assignedAt', training_record.assigned_at,
    'reviews', review_results
  );
end;
$$;

revoke all on function public.assign_tachograph_training(uuid, text, text, text, uuid[]) from public;
revoke all on function public.assign_tachograph_training(uuid, text, text, text, uuid[]) from anon;
grant execute on function public.assign_tachograph_training(uuid, text, text, text, uuid[]) to authenticated;

comment on function public.assign_tachograph_training(uuid, text, text, text, uuid[]) is
  'Authenticated manager-only same-company tachograph training assignment with field allowlist, atomic corrective-action review linkage, and audit evidence.';

commit;
