-- Batch 15: server-side Atlas apply claims, idempotent governed operations,
-- proposal audit timeline, bounded filtering, and explicit failure outcomes.
-- Each apply entry point maps to one existing governed RPC. There is no
-- generic Atlas executor and proposal rows remain decision evidence only.

alter table public.atlas_proposals
  drop constraint if exists atlas_proposals_status_check;

alter table public.atlas_proposals
  add constraint atlas_proposals_status_check
  check (status in ('pending_review', 'approved', 'applying', 'rejected', 'applied', 'failed'));

alter table public.atlas_proposals
  add column if not exists apply_attempt_count integer not null default 0,
  add column if not exists apply_started_at timestamptz,
  add column if not exists apply_finished_at timestamptz,
  add column if not exists apply_outcome text,
  add column if not exists apply_error_code text,
  add column if not exists resulting_event_id uuid references public.fleet_events(id) on delete set null;

alter table public.atlas_proposals
  drop constraint if exists atlas_proposals_apply_attempt_count_check;
alter table public.atlas_proposals
  add constraint atlas_proposals_apply_attempt_count_check check (apply_attempt_count >= 0);

alter table public.atlas_proposals
  drop constraint if exists atlas_proposals_apply_outcome_check;
alter table public.atlas_proposals
  add constraint atlas_proposals_apply_outcome_check
  check (apply_outcome is null or apply_outcome in ('applied', 'already_applied', 'stale', 'validation_failed', 'permission_denied', 'conflict', 'governed_operation_failed'));

create index if not exists atlas_proposals_audit_filter_idx
  on public.atlas_proposals(company_id, proposal_type, created_at desc, status);

create or replace function public.list_atlas_proposals(
  p_status text default null,
  p_proposal_type text default null,
  p_created_from timestamptz default null,
  p_created_to timestamptz default null,
  p_target_entity_id uuid default null,
  p_limit integer default 100
)
returns setof public.atlas_proposals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only an authenticated manager can list Atlas proposals' using errcode = '42501';
  end if;
  if coalesce(p_limit, 100) < 1 or coalesce(p_limit, 100) > 250 then
    raise exception 'Atlas proposal list limit must be between 1 and 250' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('pending_review', 'approved', 'applying', 'rejected', 'applied', 'failed') then
    raise exception 'Unsupported Atlas proposal status filter' using errcode = '22023';
  end if;
  if p_proposal_type is not null and p_proposal_type not in ('change_trailer', 'change_shift_vehicle', 'acknowledge_task') then
    raise exception 'Unsupported Atlas proposal type filter' using errcode = '22023';
  end if;

  return query
  select proposal
  from public.atlas_proposals proposal
  where proposal.company_id = actor_company_id
    and (p_status is null or proposal.status = p_status)
    and (p_proposal_type is null or proposal.proposal_type = p_proposal_type)
    and (p_created_from is null or proposal.created_at >= p_created_from)
    and (p_created_to is null or proposal.created_at < p_created_to)
    and (p_target_entity_id is null or proposal.target_entity_id = p_target_entity_id)
  order by proposal.created_at desc, proposal.id desc
  limit coalesce(p_limit, 100);
end;
$$;

revoke all on function public.list_atlas_proposals(text, text, timestamptz, timestamptz, uuid, integer) from public, anon;
grant execute on function public.list_atlas_proposals(text, text, timestamptz, timestamptz, uuid, integer) to authenticated;

create or replace function public.get_atlas_proposal_timeline(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  proposal public.atlas_proposals;
  timeline jsonb;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only an authenticated manager can view Atlas proposal history' using errcode = '42501';
  end if;
  select * into proposal
  from public.atlas_proposals
  where id = p_proposal_id and company_id = actor_company_id;
  if proposal.id is null then
    raise exception 'Atlas proposal not found for this company' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', audit.id,
      'timestamp', audit.created_at,
      'action', audit.reason,
      'actor_id', audit.actor_user_id,
      'actor_kind', audit.actor_kind,
      'decision', audit.decision,
      'resource_type', audit.resource_type,
      'resource_id', audit.resource_id,
      'operation', audit.operation,
      'metadata', audit.metadata
    ) order by audit.created_at, audit.id
  ), '[]'::jsonb)
  into timeline
  from public.security_permission_audit_events audit
  where audit.company_id = actor_company_id
    and audit.metadata ->> 'proposal_id' = proposal.id::text;

  return jsonb_build_object(
    'proposal_id', proposal.id,
    'company_id', proposal.company_id,
    'proposal_type', proposal.proposal_type,
    'target_entity_type', proposal.target_entity_type,
    'target_entity_id', proposal.target_entity_id,
    'status', proposal.status,
    'validation_status', proposal.validation_status,
    'validation_reasons', proposal.validation_reasons,
    'events', timeline
  );
end;
$$;

revoke all on function public.get_atlas_proposal_timeline(uuid) from public, anon;
grant execute on function public.get_atlas_proposal_timeline(uuid) to authenticated;

create or replace function public.audit_atlas_proposal_validation_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.validated_at is distinct from old.validated_at then
    perform public.record_security_event(
      new.company_id, null, 'operations.atlas.proposal', 'allowed',
      case when new.validation_status = 'valid' then 'atlas_proposal_revalidated'
           else 'atlas_proposal_became_' || new.validation_status end,
      new.target_entity_type, new.target_entity_id, 'revalidate', null,
      jsonb_build_object(
        'proposal_id', new.id,
        'proposal_type', new.proposal_type,
        'validation_status', new.validation_status,
        'validation_reasons', new.validation_reasons,
        'current_version', new.source_snapshot_version
      ),
      case when auth.uid() is null then 'system_job' else 'user' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists atlas_proposal_validation_audit on public.atlas_proposals;
create trigger atlas_proposal_validation_audit
after update of validation_status, validation_reasons, validated_at on public.atlas_proposals
for each row execute function public.audit_atlas_proposal_validation_transition();

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
  select * into proposal
  from public.atlas_proposals
  where id = p_proposal_id and company_id = actor_company_id
  for update;
  if proposal.id is null then
    raise exception 'Atlas proposal not found for this company' using errcode = '42501';
  end if;
  if proposal.status <> 'pending_review' then
    raise exception 'Only a pending Atlas proposal can receive a manager decision' using errcode = '40001';
  end if;
  if p_decision = 'approved' and proposal.validation_status <> 'valid' then
    raise exception 'Atlas proposal must be freshly valid before manager approval' using errcode = '40001';
  end if;
  update public.atlas_proposals
  set status = p_decision,
      reviewed_by = actor_id,
      reviewed_at = now(),
      review_notes = nullif(btrim(coalesce(p_notes, '')), ''),
      updated_at = now()
  where id = proposal.id
  returning * into reviewed;
  perform public.record_security_event(
    actor_company_id, null, 'operations.atlas.proposal.review', 'allowed',
    'atlas_proposal_reviewed', proposal.target_entity_type, proposal.target_entity_id,
    'review', null,
    jsonb_build_object('proposal_id', proposal.id, 'decision', p_decision), 'user'
  );
  return reviewed;
end;
$$;

revoke all on function public.review_atlas_proposal(uuid, text, text) from public, anon;
grant execute on function public.review_atlas_proposal(uuid, text, text) to authenticated;

revoke all on function public.record_atlas_proposal_outcome(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_atlas_proposal_outcome(uuid, text, jsonb) to postgres;

create or replace function public.atlas_apply_trailer_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  proposal public.atlas_proposals;
  updated_proposal public.atlas_proposals;
  validation_result jsonb;
  operation_result jsonb;
  event_id uuid;
  outcome_code text;
  error_message text;
  error_state text;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only an authenticated manager can apply an Atlas proposal' using errcode = '42501';
  end if;
  validation_result := public.revalidate_atlas_proposal(p_proposal_id);
  select * into proposal from public.atlas_proposals where id = p_proposal_id and company_id = actor_company_id for update;
  if proposal.id is null then raise exception 'Atlas proposal not found for this company' using errcode = '42501'; end if;
  if proposal.status = 'applied' then
    return jsonb_build_object('proposal_id', proposal.id, 'outcome_code', 'already_applied', 'idempotent_replay', true, 'proposal', to_jsonb(proposal), 'operation_result', proposal.operation_result, 'resulting_event_id', proposal.resulting_event_id);
  end if;
  if proposal.status = 'applying' then
    return jsonb_build_object('proposal_id', proposal.id, 'outcome_code', 'conflict', 'idempotent_replay', true, 'proposal', to_jsonb(proposal));
  end if;
  if proposal.status <> 'approved' then
    return jsonb_build_object('proposal_id', proposal.id, 'outcome_code', coalesce(proposal.apply_outcome, 'validation_failed'), 'idempotent_replay', true, 'proposal', to_jsonb(proposal), 'validation', validation_result);
  end if;
  if proposal.validation_status <> 'valid' then
    outcome_code := case when proposal.validation_status = 'stale' then 'stale' else 'validation_failed' end;
    update public.atlas_proposals set status = 'failed', apply_outcome = outcome_code, apply_error_code = outcome_code, apply_finished_at = now(), operation_result = jsonb_build_object('validation', validation_result), updated_at = now() where id = proposal.id returning * into updated_proposal;
    return jsonb_build_object('proposal_id', updated_proposal.id, 'outcome_code', outcome_code, 'idempotent_replay', false, 'proposal', to_jsonb(updated_proposal), 'validation', validation_result);
  end if;
  update public.atlas_proposals
  set status = 'applying', apply_attempt_count = apply_attempt_count + 1, apply_started_at = now(), apply_error_code = null, updated_at = now()
  where id = proposal.id and status = 'approved' and validation_status = 'valid'
  returning * into proposal;
  if proposal.id is null then
    return jsonb_build_object('proposal_id', p_proposal_id, 'outcome_code', 'conflict', 'idempotent_replay', true);
  end if;
  perform public.record_security_event(actor_company_id, null, 'operations.atlas.proposal.apply', 'allowed', 'atlas_proposal_apply_attempted', proposal.target_entity_type, proposal.target_entity_id, 'apply', null, jsonb_build_object('proposal_id', proposal.id, 'proposal_type', proposal.proposal_type, 'apply_attempt_count', proposal.apply_attempt_count), 'user');
  begin
    operation_result := public.assign_trailer_to_job_assignment(proposal.target_entity_id, nullif(proposal.proposed_change ->> 'trailer_id', '')::uuid, nullif(proposal.source_snapshot_version, '')::timestamptz);
    begin event_id := nullif(operation_result ->> 'event_id', '')::uuid; exception when invalid_text_representation then event_id := null; end;
    update public.atlas_proposals set status = 'applied', apply_outcome = 'applied', applied_by = actor_id, applied_at = now(), apply_finished_at = now(), resulting_event_id = event_id, operation_result = jsonb_build_object('operation_type', 'assign_trailer_to_job_assignment', 'result', operation_result), updated_at = now() where id = proposal.id returning * into updated_proposal;
    perform public.record_security_event(actor_company_id, null, 'operations.atlas.proposal.apply', 'allowed', 'atlas_proposal_applied', proposal.target_entity_type, proposal.target_entity_id, 'apply', null, jsonb_build_object('proposal_id', proposal.id, 'operation_type', 'assign_trailer_to_job_assignment', 'resulting_event_id', event_id), 'user');
    return jsonb_build_object('proposal_id', updated_proposal.id, 'outcome_code', 'applied', 'idempotent_replay', false, 'proposal', to_jsonb(updated_proposal), 'resulting_event_id', event_id);
  exception when others then
    error_state := SQLSTATE; error_message := left(SQLERRM, 500);
    outcome_code := case when error_state = '40001' then 'conflict' when error_state = '42501' and (lower(error_message) like '%prohibit%' or lower(error_message) like '%override%' or lower(error_message) like '%not found%') then 'validation_failed' when error_state = '42501' then 'permission_denied' when error_state = '22023' then 'validation_failed' else 'governed_operation_failed' end;
    update public.atlas_proposals set status = 'failed', apply_outcome = outcome_code, apply_error_code = error_state, apply_finished_at = now(), operation_result = jsonb_build_object('operation_type', 'assign_trailer_to_job_assignment', 'error_code', outcome_code, 'error_state', error_state, 'error_message', error_message), updated_at = now() where id = proposal.id returning * into updated_proposal;
    perform public.record_security_event(actor_company_id, null, 'operations.atlas.proposal.apply', 'error', 'atlas_proposal_apply_failed', proposal.target_entity_type, proposal.target_entity_id, 'apply', null, jsonb_build_object('proposal_id', proposal.id, 'operation_type', 'assign_trailer_to_job_assignment', 'error_code', outcome_code, 'error_state', error_state), 'user');
    return jsonb_build_object('proposal_id', updated_proposal.id, 'outcome_code', outcome_code, 'idempotent_replay', false, 'proposal', to_jsonb(updated_proposal));
  end;
end;
$$;

create or replace function public.atlas_apply_shift_vehicle_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid(); actor_company_id uuid := public.get_my_company_id(); proposal public.atlas_proposals; updated_proposal public.atlas_proposals; validation_result jsonb; operation_result jsonb; event_id uuid; outcome_code text; error_message text; error_state text;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only an authenticated manager can apply an Atlas proposal' using errcode = '42501'; end if;
  validation_result := public.revalidate_atlas_proposal(p_proposal_id);
  select * into proposal from public.atlas_proposals where id = p_proposal_id and company_id = actor_company_id for update;
  if proposal.id is null then raise exception 'Atlas proposal not found for this company' using errcode = '42501'; end if;
  if proposal.status = 'applied' then return jsonb_build_object('proposal_id', proposal.id, 'outcome_code', 'already_applied', 'idempotent_replay', true, 'proposal', to_jsonb(proposal), 'operation_result', proposal.operation_result, 'resulting_event_id', proposal.resulting_event_id); end if;
  if proposal.status = 'applying' then return jsonb_build_object('proposal_id', proposal.id, 'outcome_code', 'conflict', 'idempotent_replay', true, 'proposal', to_jsonb(proposal)); end if;
  if proposal.status <> 'approved' then return jsonb_build_object('proposal_id', proposal.id, 'outcome_code', coalesce(proposal.apply_outcome, 'validation_failed'), 'idempotent_replay', true, 'proposal', to_jsonb(proposal), 'validation', validation_result); end if;
  if proposal.validation_status <> 'valid' then
    outcome_code := case when proposal.validation_status = 'stale' then 'stale' else 'validation_failed' end;
    update public.atlas_proposals set status = 'failed', apply_outcome = outcome_code, apply_error_code = outcome_code, apply_finished_at = now(), operation_result = jsonb_build_object('validation', validation_result), updated_at = now() where id = proposal.id returning * into updated_proposal;
    return jsonb_build_object('proposal_id', updated_proposal.id, 'outcome_code', outcome_code, 'idempotent_replay', false, 'proposal', to_jsonb(updated_proposal), 'validation', validation_result);
  end if;
  update public.atlas_proposals set status = 'applying', apply_attempt_count = apply_attempt_count + 1, apply_started_at = now(), apply_error_code = null, updated_at = now() where id = proposal.id and status = 'approved' and validation_status = 'valid' returning * into proposal;
  if proposal.id is null then return jsonb_build_object('proposal_id', p_proposal_id, 'outcome_code', 'conflict', 'idempotent_replay', true); end if;
  perform public.record_security_event(actor_company_id, null, 'operations.atlas.proposal.apply', 'allowed', 'atlas_proposal_apply_attempted', proposal.target_entity_type, proposal.target_entity_id, 'apply', null, jsonb_build_object('proposal_id', proposal.id, 'proposal_type', proposal.proposal_type, 'apply_attempt_count', proposal.apply_attempt_count), 'user');
  begin
    operation_result := public.update_shift_with_asset_guard(proposal.target_entity_id, (proposal.proposed_change ->> 'date')::date, (proposal.proposed_change ->> 'start_time')::time, (proposal.proposed_change ->> 'end_time')::time, nullif(proposal.proposed_change ->> 'vehicle_id', '')::uuid, nullif(proposal.proposed_change ->> 'notes', ''), coalesce((proposal.proposed_change ->> 'requires_ack')::boolean, true));
    begin event_id := nullif(operation_result ->> 'event_id', '')::uuid; exception when invalid_text_representation then event_id := null; end;
    update public.atlas_proposals set status = 'applied', apply_outcome = 'applied', applied_by = actor_id, applied_at = now(), apply_finished_at = now(), resulting_event_id = event_id, operation_result = jsonb_build_object('operation_type', 'update_shift_with_asset_guard', 'result', operation_result), updated_at = now() where id = proposal.id returning * into updated_proposal;
    perform public.record_security_event(actor_company_id, null, 'operations.atlas.proposal.apply', 'allowed', 'atlas_proposal_applied', proposal.target_entity_type, proposal.target_entity_id, 'apply', null, jsonb_build_object('proposal_id', proposal.id, 'operation_type', 'update_shift_with_asset_guard', 'resulting_event_id', event_id), 'user');
    return jsonb_build_object('proposal_id', updated_proposal.id, 'outcome_code', 'applied', 'idempotent_replay', false, 'proposal', to_jsonb(updated_proposal), 'resulting_event_id', event_id);
  exception when others then
    error_state := SQLSTATE; error_message := left(SQLERRM, 500);
    outcome_code := case when error_state = '40001' then 'conflict' when error_state = '42501' and (lower(error_message) like '%prohibit%' or lower(error_message) like '%override%' or lower(error_message) like '%not found%') then 'validation_failed' when error_state = '42501' then 'permission_denied' when error_state = '22023' then 'validation_failed' else 'governed_operation_failed' end;
    update public.atlas_proposals set status = 'failed', apply_outcome = outcome_code, apply_error_code = error_state, apply_finished_at = now(), operation_result = jsonb_build_object('operation_type', 'update_shift_with_asset_guard', 'error_code', outcome_code, 'error_state', error_state, 'error_message', error_message), updated_at = now() where id = proposal.id returning * into updated_proposal;
    perform public.record_security_event(actor_company_id, null, 'operations.atlas.proposal.apply', 'error', 'atlas_proposal_apply_failed', proposal.target_entity_type, proposal.target_entity_id, 'apply', null, jsonb_build_object('proposal_id', proposal.id, 'operation_type', 'update_shift_with_asset_guard', 'error_code', outcome_code, 'error_state', error_state), 'user');
    return jsonb_build_object('proposal_id', updated_proposal.id, 'outcome_code', outcome_code, 'idempotent_replay', false, 'proposal', to_jsonb(updated_proposal));
  end;
end;
$$;

create or replace function public.atlas_apply_task_proposal(p_proposal_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid(); actor_company_id uuid := public.get_my_company_id(); proposal public.atlas_proposals; updated_proposal public.atlas_proposals; validation_result jsonb; operation_result jsonb; handling_version timestamptz; outcome_code text; error_message text; error_state text; task_source_type text; task_source_id uuid;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only an authenticated manager can apply an Atlas proposal' using errcode = '42501'; end if;
  validation_result := public.revalidate_atlas_proposal(p_proposal_id);
  select * into proposal from public.atlas_proposals where id = p_proposal_id and company_id = actor_company_id for update;
  if proposal.id is null then raise exception 'Atlas proposal not found for this company' using errcode = '42501'; end if;
  if proposal.status = 'applied' then return jsonb_build_object('proposal_id', proposal.id, 'outcome_code', 'already_applied', 'idempotent_replay', true, 'proposal', to_jsonb(proposal), 'operation_result', proposal.operation_result, 'resulting_event_id', proposal.resulting_event_id); end if;
  if proposal.status = 'applying' then return jsonb_build_object('proposal_id', proposal.id, 'outcome_code', 'conflict', 'idempotent_replay', true, 'proposal', to_jsonb(proposal)); end if;
  if proposal.status <> 'approved' then return jsonb_build_object('proposal_id', proposal.id, 'outcome_code', coalesce(proposal.apply_outcome, 'validation_failed'), 'idempotent_replay', true, 'proposal', to_jsonb(proposal), 'validation', validation_result); end if;
  if proposal.validation_status <> 'valid' then
    outcome_code := case when proposal.validation_status = 'stale' then 'stale' else 'validation_failed' end;
    update public.atlas_proposals set status = 'failed', apply_outcome = outcome_code, apply_error_code = outcome_code, apply_finished_at = now(), operation_result = jsonb_build_object('validation', validation_result), updated_at = now() where id = proposal.id returning * into updated_proposal;
    return jsonb_build_object('proposal_id', updated_proposal.id, 'outcome_code', outcome_code, 'idempotent_replay', false, 'proposal', to_jsonb(updated_proposal), 'validation', validation_result);
  end if;
  update public.atlas_proposals set status = 'applying', apply_attempt_count = apply_attempt_count + 1, apply_started_at = now(), apply_error_code = null, updated_at = now() where id = proposal.id and status = 'approved' and validation_status = 'valid' returning * into proposal;
  if proposal.id is null then return jsonb_build_object('proposal_id', p_proposal_id, 'outcome_code', 'conflict', 'idempotent_replay', true); end if;
  task_source_type := nullif(proposal.proposed_change ->> 'source_type', ''); task_source_id := nullif(proposal.proposed_change ->> 'source_id', '')::uuid;
  perform pg_advisory_xact_lock(hashtextextended('atlas-task:' || task_source_type || ':' || task_source_id::text, 0));
  select handling.updated_at into handling_version from public.operational_task_handlings handling where handling.company_id = actor_company_id and handling.source_type = task_source_type and handling.source_id = task_source_id for update;
  perform public.record_security_event(actor_company_id, null, 'operations.atlas.proposal.apply', 'allowed', 'atlas_proposal_apply_attempted', proposal.target_entity_type, proposal.target_entity_id, 'apply', null, jsonb_build_object('proposal_id', proposal.id, 'proposal_type', proposal.proposal_type, 'apply_attempt_count', proposal.apply_attempt_count), 'user');
  begin
    operation_result := public.set_operational_task_handling(task_source_type, task_source_id, 'acknowledged', null, coalesce(nullif(proposal.proposed_change ->> 'action', ''), 'atlas_manager_review'), nullif(proposal.proposed_change ->> 'note', ''), handling_version);
    update public.atlas_proposals set status = 'applied', apply_outcome = 'applied', applied_by = actor_id, applied_at = now(), apply_finished_at = now(), operation_result = jsonb_build_object('operation_type', 'set_operational_task_handling', 'result', operation_result), updated_at = now() where id = proposal.id returning * into updated_proposal;
    perform public.record_security_event(actor_company_id, null, 'operations.atlas.proposal.apply', 'allowed', 'atlas_proposal_applied', proposal.target_entity_type, proposal.target_entity_id, 'apply', null, jsonb_build_object('proposal_id', proposal.id, 'operation_type', 'set_operational_task_handling', 'handling_id', operation_result ->> 'id'), 'user');
    return jsonb_build_object('proposal_id', updated_proposal.id, 'outcome_code', 'applied', 'idempotent_replay', false, 'proposal', to_jsonb(updated_proposal));
  exception when others then
    error_state := SQLSTATE; error_message := left(SQLERRM, 500);
    outcome_code := case when error_state = '40001' then 'conflict' when error_state = '42501' then 'permission_denied' when error_state = '22023' then 'validation_failed' else 'governed_operation_failed' end;
    update public.atlas_proposals set status = 'failed', apply_outcome = outcome_code, apply_error_code = error_state, apply_finished_at = now(), operation_result = jsonb_build_object('operation_type', 'set_operational_task_handling', 'error_code', outcome_code, 'error_state', error_state, 'error_message', error_message), updated_at = now() where id = proposal.id returning * into updated_proposal;
    perform public.record_security_event(actor_company_id, null, 'operations.atlas.proposal.apply', 'error', 'atlas_proposal_apply_failed', proposal.target_entity_type, proposal.target_entity_id, 'apply', null, jsonb_build_object('proposal_id', proposal.id, 'operation_type', 'set_operational_task_handling', 'error_code', outcome_code, 'error_state', error_state), 'user');
    return jsonb_build_object('proposal_id', updated_proposal.id, 'outcome_code', outcome_code, 'idempotent_replay', false, 'proposal', to_jsonb(updated_proposal));
  end;
end;
$$;

revoke all on function public.atlas_apply_trailer_proposal(uuid) from public, anon;
revoke all on function public.atlas_apply_shift_vehicle_proposal(uuid) from public, anon;
revoke all on function public.atlas_apply_task_proposal(uuid) from public, anon;
grant execute on function public.atlas_apply_trailer_proposal(uuid) to authenticated;
grant execute on function public.atlas_apply_shift_vehicle_proposal(uuid) to authenticated;
grant execute on function public.atlas_apply_task_proposal(uuid) to authenticated;

comment on column public.atlas_proposals.apply_outcome is 'Deterministic apply result code. It distinguishes stale, validation, permission, conflict, governed-operation, and successful/idempotent outcomes.';
comment on function public.atlas_apply_trailer_proposal(uuid) is 'Explicit, locked, idempotent Atlas trailer apply mapped only to assign_trailer_to_job_assignment.';
comment on function public.atlas_apply_shift_vehicle_proposal(uuid) is 'Explicit, locked, idempotent Atlas shift-vehicle apply mapped only to update_shift_with_asset_guard.';
comment on function public.atlas_apply_task_proposal(uuid) is 'Explicit, locked, idempotent Atlas task apply mapped only to set_operational_task_handling.';
