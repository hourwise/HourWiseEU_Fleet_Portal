-- Batch 8: govern the manager incident follow-up boundary without changing
-- incident creation or the existing driver self-report contract.

insert into public.security_permissions (
  key, area, resource, operation, description, risk_level, requires_audit
)
values (
  'operations.incident.follow_up',
  'operations',
  'incident',
  'follow_up',
  'Update the status and manager notes of a same-company incident through the governed follow-up lifecycle.',
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
  'fleet_administrator',
  'operations.incident.follow_up',
  'allow',
  'organisation'
)
on conflict (role_key, permission_key, scope_level) do update
set effect = excluded.effect;

-- Ordinary authenticated clients must use the governed follow-up function.
-- INSERT remains available through the existing manager and driver policies.
revoke update on table public.incidents from public, anon, authenticated;

create or replace function public.update_incident_follow_up(
  p_incident_id uuid,
  p_to_status text,
  p_manager_notes text,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  incident_record public.incidents%rowtype;
  updated_incident public.incidents%rowtype;
  previous_status text;
  normalized_status text := lower(btrim(coalesce(p_to_status, '')));
  permission_key constant text := 'operations.incident.follow_up';
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.get_my_role() is distinct from 'manager'
     or actor_company_id is null
     or not public.actor_has_permission(permission_key, actor_company_id, null) then
    perform public.record_security_event(
      actor_company_id,
      null,
      permission_key,
      'denied',
      'manager_company_or_permission_mismatch',
      'incident',
      p_incident_id,
      'follow_up'
    );
    raise exception 'Only an authorised manager can update incident follow-up';
  end if;

  if normalized_status not in ('reported', 'investigating', 'closed') then
    raise exception 'Unsupported incident lifecycle status';
  end if;

  select *
  into incident_record
  from public.incidents
  where id = p_incident_id
    and company_id = actor_company_id
  for update;

  if incident_record.id is null then
    raise exception 'Incident not found for this company';
  end if;

  if p_expected_updated_at is null
     or incident_record.updated_at is distinct from p_expected_updated_at then
    perform public.record_security_event(
      actor_company_id,
      null,
      permission_key,
      'denied',
      'stale_incident_follow_up_state',
      'incident',
      incident_record.id,
      'follow_up',
      null,
      jsonb_build_object(
        'expectedUpdatedAt', p_expected_updated_at,
        'actualUpdatedAt', incident_record.updated_at
      )
    );
    raise exception 'Incident changed since it was loaded; reload before updating';
  end if;

  previous_status := coalesce(incident_record.status, 'reported');
  if previous_status = 'reported'
     and normalized_status not in ('reported', 'investigating') then
    raise exception 'A reported incident must move to investigating before it can be closed';
  end if;
  if previous_status = 'investigating'
     and normalized_status not in ('investigating', 'closed') then
    raise exception 'An investigating incident can only remain investigating or move to closed';
  end if;
  if previous_status = 'closed'
     and normalized_status <> 'closed' then
    raise exception 'A closed incident cannot be reopened through this action';
  end if;

  update public.incidents
  set status = normalized_status,
      manager_notes = nullif(btrim(coalesce(p_manager_notes, '')), '')
  where id = incident_record.id
    and company_id = actor_company_id
    and updated_at is not distinct from p_expected_updated_at
  returning * into updated_incident;

  if updated_incident.id is null then
    raise exception 'Incident changed since it was loaded; reload before updating';
  end if;

  perform public.record_security_event(
    actor_company_id,
    null,
    permission_key,
    'allowed',
    'incident_follow_up_updated',
    'incident',
    updated_incident.id,
    'follow_up',
    null,
    jsonb_build_object(
      'previousStatus', previous_status,
      'newStatus', updated_incident.status,
      'managerNotesChanged', updated_incident.manager_notes is distinct from incident_record.manager_notes,
      'updatedAt', updated_incident.updated_at
    )
  );

  return jsonb_build_object(
    'incidentId', updated_incident.id,
    'status', updated_incident.status,
    'managerNotes', updated_incident.manager_notes,
    'updatedAt', updated_incident.updated_at
  );
end;
$$;

revoke all on function public.update_incident_follow_up(uuid, text, text, timestamptz) from public;
revoke all on function public.update_incident_follow_up(uuid, text, text, timestamptz) from anon;
grant execute on function public.update_incident_follow_up(uuid, text, text, timestamptz) to authenticated;

comment on function public.update_incident_follow_up(uuid, text, text, timestamptz) is
  'Authenticated manager-only, same-company incident follow-up transition with permission enforcement, stale-write protection, allowlisted fields, and audit evidence.';
