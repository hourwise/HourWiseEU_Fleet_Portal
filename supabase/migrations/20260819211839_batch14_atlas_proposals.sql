-- Batch 14: persisted, manager-reviewed Atlas proposal evidence.
-- Proposals never replace operational source truth and never receive actor
-- identity from the browser. Applying a proposal remains a client-mediated
-- call to an existing governed operational RPC.

create table if not exists public.atlas_proposals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  proposal_type text not null check (proposal_type in ('change_trailer', 'change_shift_vehicle', 'acknowledge_task')),
  target_entity_type text not null check (target_entity_type in ('job_assignment', 'shift', 'operational_task')),
  target_entity_id uuid not null,
  proposed_change jsonb not null default '{}'::jsonb,
  evidence_facts jsonb not null default '[]'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  source_snapshot_version text not null,
  validation_status text not null default 'stale' check (validation_status in ('valid', 'invalid', 'stale', 'requires_override', 'unsupported')),
  validation_reasons jsonb not null default '[]'::jsonb,
  origin text not null check (origin in ('deterministic', 'future_model')),
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'applied', 'failed')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  applied_by uuid references public.profiles(id) on delete set null,
  applied_at timestamptz,
  operation_result jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists atlas_proposals_company_status_idx
  on public.atlas_proposals(company_id, status, updated_at desc);
create index if not exists atlas_proposals_target_idx
  on public.atlas_proposals(company_id, target_entity_type, target_entity_id, created_at desc);

alter table public.atlas_proposals enable row level security;
drop policy if exists "Managers can view company Atlas proposals" on public.atlas_proposals;
create policy "Managers can view company Atlas proposals"
  on public.atlas_proposals for select to authenticated
  using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');

revoke insert, update, delete on public.atlas_proposals from public, anon, authenticated;
grant select on public.atlas_proposals to authenticated;

create or replace function public.create_atlas_proposal(
  p_proposal_type text,
  p_target_entity_type text,
  p_target_entity_id uuid,
  p_proposed_change jsonb,
  p_evidence_facts jsonb,
  p_source_snapshot jsonb,
  p_source_snapshot_version text,
  p_origin text default 'deterministic'
)
returns public.atlas_proposals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  created_proposal public.atlas_proposals;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only an authenticated manager can create an Atlas proposal' using errcode = '42501';
  end if;
  if p_proposal_type not in ('change_trailer', 'change_shift_vehicle', 'acknowledge_task') then
    raise exception 'Unsupported Atlas proposal type' using errcode = '22023';
  end if;
  if p_origin not in ('deterministic', 'future_model') then
    raise exception 'Unsupported Atlas proposal origin' using errcode = '22023';
  end if;
  if p_target_entity_id is null or nullif(btrim(coalesce(p_source_snapshot_version, '')), '') is null then
    raise exception 'Atlas proposals require a target and source snapshot version' using errcode = '22023';
  end if;
  if p_proposal_type = 'change_trailer' and p_target_entity_type <> 'job_assignment' then
    raise exception 'Trailer proposals must target a job assignment' using errcode = '22023';
  end if;
  if p_proposal_type = 'change_shift_vehicle' and p_target_entity_type <> 'shift' then
    raise exception 'Vehicle proposals must target a shift' using errcode = '22023';
  end if;
  if p_proposal_type = 'acknowledge_task' and p_target_entity_type <> 'operational_task' then
    raise exception 'Task proposals must target an operational task' using errcode = '22023';
  end if;

  insert into public.atlas_proposals (
    company_id, proposal_type, target_entity_type, target_entity_id,
    proposed_change, evidence_facts, source_snapshot, source_snapshot_version,
    origin, created_by
  ) values (
    actor_company_id, p_proposal_type, p_target_entity_type, p_target_entity_id,
    coalesce(p_proposed_change, '{}'::jsonb), coalesce(p_evidence_facts, '[]'::jsonb),
    coalesce(p_source_snapshot, '{}'::jsonb), btrim(p_source_snapshot_version),
    p_origin, actor_id
  ) returning * into created_proposal;

  perform public.record_security_event(
    actor_company_id, null, 'operations.atlas.proposal', 'allowed', 'atlas_proposal_created',
    p_target_entity_type, p_target_entity_id, 'create', null,
    jsonb_build_object('proposal_id', created_proposal.id, 'proposal_type', p_proposal_type, 'origin', p_origin), 'user'
  );
  return created_proposal;
end;
$$;

create or replace function public.revalidate_atlas_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  proposal public.atlas_proposals;
  assignment public.job_assignments%rowtype;
  target_shift public.shifts%rowtype;
  target_vehicle public.vehicles%rowtype;
  target_profile public.profiles%rowtype;
  policy jsonb;
  current_version text;
  new_asset_id uuid;
  source_type text;
  source_id uuid;
  status_value text := 'valid';
  reasons jsonb := '[]'::jsonb;
  task_exists boolean := false;
  collision_exists boolean := false;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only an authenticated manager can revalidate an Atlas proposal' using errcode = '42501';
  end if;
  select * into proposal from public.atlas_proposals
  where id = p_proposal_id and company_id = actor_company_id
  for update;
  if proposal.id is null then
    raise exception 'Atlas proposal not found for this company' using errcode = '42501';
  end if;
  if proposal.status in ('rejected', 'applied') then
    return jsonb_build_object('proposal_id', proposal.id, 'status', 'invalid', 'reasons', jsonb_build_array(jsonb_build_object('code', 'terminal_status', 'message', 'A rejected or applied proposal cannot be revalidated.')));
  end if;

  if proposal.proposal_type = 'change_trailer' then
    select * into assignment from public.job_assignments where id = proposal.target_entity_id and company_id = actor_company_id for update;
    if assignment.id is null then
      status_value := 'invalid';
      reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'target_missing', 'message', 'The target job assignment no longer exists in this company.'));
    else
      current_version := assignment.updated_at::text;
      if assignment.status not in ('published', 'updated', 'acknowledged') then
        status_value := 'invalid';
        reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'lifecycle_restricted', 'message', 'Trailer changes are limited to published or acknowledged work before execution starts.'));
      end if;
      select * into target_profile from public.profiles where id = assignment.driver_id and company_id = actor_company_id;
      if target_profile.id is null or target_profile.is_active is distinct from true or target_profile.role <> 'driver' then
        status_value := 'invalid';
        reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'driver_inactive', 'message', 'The current assignment driver is not an active Portal driver.'));
      end if;
      begin
        new_asset_id := nullif(proposal.proposed_change ->> 'trailer_id', '')::uuid;
      exception when invalid_text_representation then
        new_asset_id := null;
      end;
      if new_asset_id is null then
        status_value := 'invalid';
        reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'asset_missing', 'message', 'A trailer must be selected for this proposal.'));
      else
        select * into target_vehicle from public.vehicles where id = new_asset_id and company_id = actor_company_id for update;
        if target_vehicle.id is null then
          status_value := 'invalid';
          reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'asset_unknown', 'message', 'The proposed trailer is not in the authenticated company.'));
        elsif lower(coalesce(target_vehicle.vehicle_class, '')) <> 'trailer' and lower(coalesce(target_vehicle.vehicle_type, '')) <> 'trailer' then
          status_value := 'invalid';
          reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'asset_kind', 'message', 'The selected asset is not recorded as a trailer.'));
        else
          policy := public.get_asset_assignment_policy(actor_company_id, new_asset_id);
          if coalesce((policy ->> 'hard_block')::boolean, true) or (policy ->> 'status') = 'prohibited' then
            status_value := 'invalid';
            reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'asset_prohibited', 'message', 'The proposed trailer is VOR or has an unresolved safety defect.'));
          elsif (policy ->> 'status') in ('unknown', 'action_required') then
            status_value := 'requires_override';
            reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'asset_override_required', 'message', 'The proposed trailer needs a separately governed readiness override before assignment.'));
          end if;
          select exists (
            select 1 from public.job_assignments other
            where other.company_id = actor_company_id and other.shift_id = assignment.shift_id
              and other.trailer_id = new_asset_id and other.id <> assignment.id
              and other.status not in ('draft', 'cancelled')
          ) into collision_exists;
          if collision_exists then
            status_value := 'invalid';
            reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'assignment_collision', 'message', 'The proposed trailer is already assigned to another active job on this shift.'));
          end if;
        end if;
      end if;
    end if;
  elsif proposal.proposal_type = 'change_shift_vehicle' then
    select * into target_shift from public.shifts where id = proposal.target_entity_id and company_id = actor_company_id for update;
    if target_shift.id is null then
      status_value := 'invalid';
      reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'target_missing', 'message', 'The target shift no longer exists in this company.'));
    else
      current_version := target_shift.updated_at::text;
      if target_shift.status not in ('published', 'updated') then
        status_value := 'invalid';
        reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'rota_state', 'message', 'Vehicle changes are limited to published or updated shifts.'));
      end if;
      select * into target_profile from public.profiles where id = target_shift.driver_id and company_id = actor_company_id;
      if target_profile.id is null or target_profile.is_active is distinct from true or target_profile.role <> 'driver' then
        status_value := 'invalid';
        reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'driver_inactive', 'message', 'The shift driver is not an active Portal driver.'));
      end if;
      begin
        new_asset_id := nullif(proposal.proposed_change ->> 'vehicle_id', '')::uuid;
      exception when invalid_text_representation then
        new_asset_id := null;
      end;
      if new_asset_id is null then
        status_value := 'invalid';
        reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'asset_missing', 'message', 'A vehicle must be selected for this proposal.'));
      else
        select * into target_vehicle from public.vehicles where id = new_asset_id and company_id = actor_company_id for update;
        if target_vehicle.id is null then
          status_value := 'invalid';
          reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'asset_unknown', 'message', 'The proposed vehicle is not in the authenticated company.'));
        elsif lower(coalesce(target_vehicle.vehicle_class, '')) = 'trailer' or lower(coalesce(target_vehicle.vehicle_type, '')) = 'trailer' then
          status_value := 'invalid';
          reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'asset_kind', 'message', 'A trailer cannot be assigned as the shift vehicle.'));
        else
          policy := public.get_asset_assignment_policy(actor_company_id, new_asset_id);
          if coalesce((policy ->> 'hard_block')::boolean, true) or (policy ->> 'status') = 'prohibited' then
            status_value := 'invalid';
            reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'asset_prohibited', 'message', 'The proposed vehicle is VOR or has an unresolved safety defect.'));
          elsif (policy ->> 'status') in ('unknown', 'action_required') then
            status_value := 'requires_override';
            reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'asset_override_required', 'message', 'The proposed vehicle needs a separately governed readiness override before assignment.'));
          end if;
          select exists (
            select 1 from public.shifts other
            where other.company_id = actor_company_id and other.date = target_shift.date
              and other.vehicle_id = new_asset_id and other.id <> target_shift.id
              and other.status not in ('draft', 'cancelled')
          ) into collision_exists;
          if collision_exists then
            status_value := 'invalid';
            reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'rota_collision', 'message', 'The proposed vehicle is already used by another active shift on this date.'));
          end if;
        end if;
      end if;
    end if;
  elsif proposal.proposal_type = 'acknowledge_task' then
    source_type := nullif(proposal.proposed_change ->> 'source_type', '');
    begin
      source_id := nullif(proposal.proposed_change ->> 'source_id', '')::uuid;
    exception when invalid_text_representation then
      source_id := null;
    end;
    if source_type not in ('fleet_event', 'job_assignment', 'vehicle_check', 'asset_readiness', 'shift', 'driver_compliance') or source_id is null then
      status_value := 'unsupported';
      reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'unsupported_source', 'message', 'This task source is not mapped to an existing governed task-handling RPC.'));
    else
      case source_type
        when 'fleet_event' then select exists (select 1 from public.fleet_events where id = source_id and company_id = actor_company_id) into task_exists;
        when 'job_assignment' then select exists (select 1 from public.job_assignments where id = source_id and company_id = actor_company_id) into task_exists;
        when 'vehicle_check' then select exists (select 1 from public.vehicle_checks where id = source_id and company_id = actor_company_id) into task_exists;
        when 'asset_readiness' then select exists (select 1 from public.vehicles where id = source_id and company_id = actor_company_id) into task_exists;
        when 'shift' then select exists (select 1 from public.shifts where id = source_id and company_id = actor_company_id) into task_exists;
        when 'driver_compliance' then select exists (select 1 from public.profiles where id = source_id and company_id = actor_company_id and role = 'driver') into task_exists;
      end case;
      if not task_exists then
        status_value := 'invalid';
        reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'task_source_missing', 'message', 'The proposed task source is not present in this company.'));
      end if;
      current_version := coalesce(nullif(proposal.source_snapshot_version, ''), 'unknown');
    end if;
  else
    status_value := 'unsupported';
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'unsupported_proposal', 'message', 'This proposal type has no governed Portal apply mapping.'));
  end if;

  if proposal.proposal_type <> 'acknowledge_task' and proposal.source_snapshot_version is distinct from current_version then
    status_value := 'stale';
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'stale_snapshot', 'message', 'Authoritative target state changed after this proposal was constructed; refresh and revalidate.'));
  end if;

  update public.atlas_proposals
  set validation_status = status_value, validation_reasons = reasons, validated_at = now(), updated_at = now()
  where id = proposal.id;
  return jsonb_build_object('proposal_id', proposal.id, 'status', status_value, 'reasons', reasons, 'current_version', current_version);
end;
$$;

create or replace function public.review_atlas_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_notes text default null
)
returns public.atlas_proposals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  proposal public.atlas_proposals;
  reviewed public.atlas_proposals;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only an authenticated manager can review an Atlas proposal' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Atlas proposal decision must be approved or rejected' using errcode = '22023';
  end if;
  if p_notes is not null and length(p_notes) > 2000 then
    raise exception 'Atlas proposal review notes are limited to 2000 characters' using errcode = '22023';
  end if;
  select * into proposal from public.atlas_proposals where id = p_proposal_id and company_id = actor_company_id for update;
  if proposal.id is null then raise exception 'Atlas proposal not found for this company' using errcode = '42501'; end if;
  if proposal.status in ('applied', 'rejected') then raise exception 'Atlas proposal is already terminal' using errcode = '22023'; end if;
  if p_decision = 'approved' and proposal.validation_status <> 'valid' then
    raise exception 'Atlas proposal must be freshly valid before manager approval' using errcode = '40001';
  end if;
  update public.atlas_proposals
  set status = p_decision, reviewed_by = actor_id, reviewed_at = now(), review_notes = nullif(btrim(coalesce(p_notes, '')), ''), updated_at = now()
  where id = proposal.id
  returning * into reviewed;
  perform public.record_security_event(actor_company_id, null, 'operations.atlas.proposal.review', 'allowed', 'atlas_proposal_reviewed', proposal.target_entity_type, proposal.target_entity_id, 'review', null, jsonb_build_object('proposal_id', proposal.id, 'decision', p_decision), 'user');
  return reviewed;
end;
$$;

create or replace function public.record_atlas_proposal_outcome(
  p_proposal_id uuid,
  p_outcome text,
  p_operation_result jsonb default '{}'::jsonb
)
returns public.atlas_proposals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  proposal public.atlas_proposals;
  recorded public.atlas_proposals;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only an authenticated manager can record an Atlas proposal outcome' using errcode = '42501';
  end if;
  if p_outcome not in ('applied', 'failed') then raise exception 'Unsupported Atlas proposal outcome' using errcode = '22023'; end if;
  select * into proposal from public.atlas_proposals where id = p_proposal_id and company_id = actor_company_id for update;
  if proposal.id is null then raise exception 'Atlas proposal not found for this company' using errcode = '42501'; end if;
  if proposal.status <> 'approved' then raise exception 'Only an approved Atlas proposal can receive an operation outcome' using errcode = '22023'; end if;
  update public.atlas_proposals
  set status = p_outcome, applied_by = actor_id, applied_at = now(), operation_result = coalesce(p_operation_result, '{}'::jsonb), updated_at = now()
  where id = proposal.id
  returning * into recorded;
  perform public.record_security_event(actor_company_id, null, 'operations.atlas.proposal.outcome', 'allowed', 'atlas_proposal_outcome_recorded', proposal.target_entity_type, proposal.target_entity_id, 'outcome', null, jsonb_build_object('proposal_id', proposal.id, 'outcome', p_outcome, 'operation_result', coalesce(p_operation_result, '{}'::jsonb)), 'user');
  return recorded;
end;
$$;

revoke all on function public.create_atlas_proposal(text, text, uuid, jsonb, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.create_atlas_proposal(text, text, uuid, jsonb, jsonb, jsonb, text, text) to authenticated;
revoke all on function public.revalidate_atlas_proposal(uuid) from public, anon;
grant execute on function public.revalidate_atlas_proposal(uuid) to authenticated;
revoke all on function public.review_atlas_proposal(uuid, text, text) from public, anon;
grant execute on function public.review_atlas_proposal(uuid, text, text) to authenticated;
revoke all on function public.record_atlas_proposal_outcome(uuid, text, jsonb) from public, anon;
grant execute on function public.record_atlas_proposal_outcome(uuid, text, jsonb) to authenticated;

comment on table public.atlas_proposals is 'Manager-reviewed Atlas decision evidence. It is not operational source truth and has no generic write authority.';
comment on function public.revalidate_atlas_proposal(uuid) is 'Revalidates current Portal truth immediately before manager review or governed apply.';
