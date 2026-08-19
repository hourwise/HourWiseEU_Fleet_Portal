-- Forward fix for Batch 14 task proposals. The original revalidation function
-- remains immutable; this wrapper delegates asset/shift checks to its renamed
-- implementation and adds current source-version checks for task handling.

alter function public.revalidate_atlas_proposal(uuid)
  rename to revalidate_atlas_proposal_asset_checks;

revoke all on function public.revalidate_atlas_proposal_asset_checks(uuid) from public, anon, authenticated;

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
  status_value text := 'valid';
  reasons jsonb := '[]'::jsonb;
  source_type text;
  source_id uuid;
  current_version text;
  source_exists boolean := false;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only an authenticated manager can revalidate an Atlas proposal' using errcode = '42501';
  end if;
  select * into proposal from public.atlas_proposals where id = p_proposal_id and company_id = actor_company_id for update;
  if proposal.id is null then raise exception 'Atlas proposal not found for this company' using errcode = '42501'; end if;
  if proposal.proposal_type <> 'acknowledge_task' then
    return public.revalidate_atlas_proposal_asset_checks(p_proposal_id);
  end if;

  source_type := nullif(proposal.proposed_change ->> 'source_type', '');
  begin
    source_id := nullif(proposal.proposed_change ->> 'source_id', '')::uuid;
  exception when invalid_text_representation then
    source_id := null;
  end;
  if source_id is null or source_id <> proposal.target_entity_id then
    status_value := 'invalid';
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'task_source_mismatch', 'message', 'The task source and proposal target do not match.'));
  elsif source_type = 'fleet_event' then
    select exists (select 1 from public.fleet_events where id = source_id and company_id = actor_company_id), max(created_at::text) into source_exists, current_version from public.fleet_events where id = source_id and company_id = actor_company_id;
  elsif source_type = 'job_assignment' then
    select exists (select 1 from public.job_assignments where id = source_id and company_id = actor_company_id), max(updated_at::text) into source_exists, current_version from public.job_assignments where id = source_id and company_id = actor_company_id;
  elsif source_type = 'vehicle_check' then
    select exists (select 1 from public.vehicle_checks where id = source_id and company_id = actor_company_id), max(updated_at::text) into source_exists, current_version from public.vehicle_checks where id = source_id and company_id = actor_company_id;
  elsif source_type = 'asset_readiness' then
    select exists (select 1 from public.vehicles where id = source_id and company_id = actor_company_id), max(updated_at::text) into source_exists, current_version from public.vehicles where id = source_id and company_id = actor_company_id;
  elsif source_type = 'shift' then
    select exists (select 1 from public.shifts where id = source_id and company_id = actor_company_id), max(updated_at::text) into source_exists, current_version from public.shifts where id = source_id and company_id = actor_company_id;
  elsif source_type = 'driver_compliance' then
    select exists (select 1 from public.profiles where id = source_id and company_id = actor_company_id and role = 'driver'), max(updated_at::text) into source_exists, current_version from public.profiles where id = source_id and company_id = actor_company_id and role = 'driver';
  else
    status_value := 'unsupported';
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'unsupported_source', 'message', 'This task source is not mapped to the governed task-handling RPC.'));
  end if;

  if status_value = 'valid' and not source_exists then
    status_value := 'invalid';
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'task_source_missing', 'message', 'The task source is no longer present in this company.'));
  elsif status_value = 'valid' and current_version is distinct from proposal.source_snapshot_version then
    status_value := 'stale';
    reasons := reasons || jsonb_build_array(jsonb_build_object('code', 'stale_snapshot', 'message', 'The task source changed after this proposal was constructed; refresh and revalidate.'));
  end if;

  update public.atlas_proposals
  set validation_status = status_value, validation_reasons = reasons, validated_at = now(), updated_at = now()
  where id = proposal.id;
  return jsonb_build_object('proposal_id', proposal.id, 'status', status_value, 'reasons', reasons, 'current_version', current_version);
end;
$$;

revoke all on function public.revalidate_atlas_proposal(uuid) from public, anon;
grant execute on function public.revalidate_atlas_proposal(uuid) to authenticated;
