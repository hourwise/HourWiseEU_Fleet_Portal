-- Batch 21: repair production RPC contracts without changing their authority
-- boundaries. The qualified projections below prevent PL/pgSQL name
-- resolution from turning valid manager reads into runtime errors.

create or replace function public.get_pod_reconciliation_health()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  latest public.pod_reconciliation_runs;
  last_success public.pod_reconciliation_runs;
  recent jsonb;
  alerts jsonb := '[]'::jsonb;
  stale_intent_count integer := 0;
  oldest_stale_age_hours numeric := null;
  failure_streak integer := 0;
  unhealthy_streak integer := 0;
  partial_streak integer := 0;
  run_row record;
  last_run_age_minutes numeric := null;
  severity text;
  fingerprint text;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' or actor_company_id is null then
    raise exception 'Only an authenticated manager can view reconciliation health' using errcode = '42501';
  end if;

  select * into latest from public.pod_reconciliation_runs order by started_at desc, id desc limit 1;
  select * into last_success from public.pod_reconciliation_runs where status = 'success' order by finished_at desc, id desc limit 1;

  select count(*)::integer,
         case when min(created_at) is null then null else round(extract(epoch from (now() - min(created_at))) / 3600, 1) end
  into stale_intent_count, oldest_stale_age_hours
  from public.job_evidence_upload_intents
  where company_id = actor_company_id
    and status = 'pending'
    and created_at < now() - interval '2 hours';

  for run_row in select status from public.pod_reconciliation_runs order by started_at desc, id desc limit 100 loop
    exit when run_row.status = 'success';
    unhealthy_streak := unhealthy_streak + 1;
  end loop;
  for run_row in select status from public.pod_reconciliation_runs order by started_at desc, id desc limit 100 loop
    exit when run_row.status <> 'failure';
    failure_streak := failure_streak + 1;
  end loop;
  for run_row in select status from public.pod_reconciliation_runs order by started_at desc, id desc limit 100 loop
    exit when run_row.status <> 'partial';
    partial_streak := partial_streak + 1;
  end loop;
  if latest.id is not null then
    last_run_age_minutes := round(extract(epoch from (now() - latest.started_at)) / 60, 1);
  end if;

  if failure_streak >= 3 then
    severity := case when failure_streak >= 6 then 'critical' else 'warning' end;
    fingerprint := 'consecutive-failures:' || severity;
    alerts := alerts || jsonb_build_array(jsonb_build_object('signal_key', 'pod-reconciliation:consecutive-failures', 'fingerprint', fingerprint, 'section', 'today', 'severity', severity, 'title', 'POD reconciliation failures require attention', 'detail', failure_streak || ' consecutive scheduled runs failed. Review maintenance health before taking any cleanup action.', 'source_label', 'POD reconciliation', 'source_updated_at', latest.started_at));
  end if;
  if partial_streak >= 3 then
    severity := case when partial_streak >= 6 then 'critical' else 'warning' end;
    fingerprint := 'consecutive-partials:' || severity;
    alerts := alerts || jsonb_build_array(jsonb_build_object('signal_key', 'pod-reconciliation:consecutive-partials', 'fingerprint', fingerprint, 'section', 'today', 'severity', severity, 'title', 'POD reconciliation is repeatedly partial', 'detail', partial_streak || ' consecutive runs completed with mismatches or item failures. The source evidence has not been broadly deleted.', 'source_label', 'POD reconciliation', 'source_updated_at', latest.started_at));
  end if;
  if stale_intent_count > 0 and oldest_stale_age_hours >= 24 then
    severity := case when oldest_stale_age_hours >= 72 then 'critical' else 'warning' end;
    fingerprint := 'stale-backlog:' || severity;
    alerts := alerts || jsonb_build_array(jsonb_build_object('signal_key', 'pod-reconciliation:stale-backlog', 'fingerprint', fingerprint, 'section', 'today', 'severity', severity, 'title', 'POD reconciliation backlog is stale', 'detail', stale_intent_count || ' pending upload intent(s) are older than the reconciliation window; the oldest is approximately ' || oldest_stale_age_hours || ' hour(s) old.', 'source_label', 'POD reconciliation', 'source_updated_at', latest.started_at));
  end if;
  if latest.id is null or last_run_age_minutes >= 45 then
    severity := case when latest.id is null or last_run_age_minutes >= 90 then 'critical' else 'warning' end;
    fingerprint := 'overdue:' || case when latest.id is null then 'missing' else severity end;
    alerts := alerts || jsonb_build_array(jsonb_build_object('signal_key', 'pod-reconciliation:overdue', 'fingerprint', fingerprint, 'section', 'today', 'severity', severity, 'title', 'POD reconciliation appears overdue', 'detail', case when latest.id is null then 'No scheduled reconciliation run is recorded.' else 'The last scheduled run started approximately ' || last_run_age_minutes || ' minute(s) ago.' end, 'source_label', 'POD reconciliation', 'source_updated_at', case when latest.id is null then null else latest.started_at end));
  end if;
  if latest.id is not null and (latest.mismatch_count > 0 or latest.failure_count > 0) then
    severity := case when latest.failure_count > 0 then 'warning' else 'advisory' end;
    fingerprint := 'storage-outcome:' || case when latest.failure_count > 0 then 'failure' else 'mismatch' end;
    alerts := alerts || jsonb_build_array(jsonb_build_object('signal_key', 'pod-reconciliation:storage-outcome', 'fingerprint', fingerprint, 'section', 'today', 'severity', severity, 'title', 'POD reconciliation found storage mismatches', 'detail', latest.mismatch_count || ' mismatch(es) and ' || latest.failure_count || ' item failure(s) were recorded in the latest run. Exact-object safeguards remain active.', 'source_label', 'POD reconciliation', 'source_updated_at', latest.started_at));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', runs.id, 'started_at', runs.started_at, 'finished_at', runs.finished_at, 'status', runs.status, 'intents_scanned', runs.intents_scanned, 'intents_expired', runs.intents_expired, 'storage_objects_removed', runs.storage_objects_removed, 'mismatch_count', runs.mismatch_count, 'failure_count', runs.failure_count, 'consecutive_failures', runs.consecutive_failures) order by runs.started_at desc, runs.id desc), '[]'::jsonb)
  into recent
  from (select * from public.pod_reconciliation_runs order by started_at desc, id desc limit 20) runs;

  return jsonb_build_object(
    'last_attempted_run', case when latest.id is null then null else to_jsonb(latest) end,
    'last_successful_run', case when last_success.id is null then null else to_jsonb(last_success) end,
    'consecutive_failures', failure_streak,
    'consecutive_unhealthy_runs', unhealthy_streak,
    'consecutive_partial_runs', partial_streak,
    'mismatch_backlog_count', stale_intent_count,
    'oldest_mismatch_age_hours', oldest_stale_age_hours,
    'last_run_age_minutes', last_run_age_minutes,
    'maintenance_warning', jsonb_array_length(alerts) > 0,
    'thresholds', jsonb_build_object('warning_failures', 3, 'critical_failures', 6, 'warning_stale_hours', 24, 'critical_stale_hours', 72, 'warning_overdue_minutes', 45, 'critical_overdue_minutes', 90),
    'alerts', alerts,
    'recent_runs', recent
  );
end;
$$;

revoke all on function public.get_pod_reconciliation_health() from public, anon;
grant execute on function public.get_pod_reconciliation_health() to authenticated;

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
  select proposal.*
  from public.atlas_proposals as proposal
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
