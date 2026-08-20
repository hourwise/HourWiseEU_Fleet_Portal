-- Batch 17: close the tenant-boundary gap in the POD health projection.
-- The maintenance-run ledger is global scheduler metadata; tenant-owned stale
-- upload counts are explicitly restricted to the requesting manager company.

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
  consecutive_unhealthy integer := 0;
  consecutive_failures integer := 0;
  consecutive_partial integer := 0;
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
    consecutive_unhealthy := consecutive_unhealthy + 1;
  end loop;
  for run_row in select status from public.pod_reconciliation_runs order by started_at desc, id desc limit 100 loop
    exit when run_row.status <> 'failure';
    consecutive_failures := consecutive_failures + 1;
  end loop;
  for run_row in select status from public.pod_reconciliation_runs order by started_at desc, id desc limit 100 loop
    exit when run_row.status <> 'partial';
    consecutive_partial := consecutive_partial + 1;
  end loop;
  if latest.id is not null then
    last_run_age_minutes := round(extract(epoch from (now() - latest.started_at)) / 60, 1);
  end if;

  if consecutive_failures >= 3 then
    severity := case when consecutive_failures >= 6 then 'critical' else 'warning' end;
    fingerprint := 'consecutive-failures:' || severity;
    alerts := alerts || jsonb_build_array(jsonb_build_object('signal_key', 'pod-reconciliation:consecutive-failures', 'fingerprint', fingerprint, 'section', 'today', 'severity', severity, 'title', 'POD reconciliation failures require attention', 'detail', consecutive_failures || ' consecutive scheduled runs failed. Review maintenance health before taking any cleanup action.', 'source_label', 'POD reconciliation', 'source_updated_at', latest.started_at));
  end if;
  if consecutive_partial >= 3 then
    severity := case when consecutive_partial >= 6 then 'critical' else 'warning' end;
    fingerprint := 'consecutive-partials:' || severity;
    alerts := alerts || jsonb_build_array(jsonb_build_object('signal_key', 'pod-reconciliation:consecutive-partials', 'fingerprint', fingerprint, 'section', 'today', 'severity', severity, 'title', 'POD reconciliation is repeatedly partial', 'detail', consecutive_partial || ' consecutive runs completed with mismatches or item failures. The source evidence has not been broadly deleted.', 'source_label', 'POD reconciliation', 'source_updated_at', latest.started_at));
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

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'started_at', started_at, 'finished_at', finished_at, 'status', status, 'intents_scanned', intents_scanned, 'intents_expired', intents_expired, 'storage_objects_removed', storage_objects_removed, 'mismatch_count', mismatch_count, 'failure_count', failure_count, 'consecutive_failures', consecutive_failures) order by started_at desc, id desc), '[]'::jsonb)
  into recent
  from (select * from public.pod_reconciliation_runs order by started_at desc, id desc limit 20) runs;

  return jsonb_build_object(
    'last_attempted_run', case when latest.id is null then null else to_jsonb(latest) end,
    'last_successful_run', case when last_success.id is null then null else to_jsonb(last_success) end,
    'consecutive_failures', consecutive_failures,
    'consecutive_unhealthy_runs', consecutive_unhealthy,
    'consecutive_partial_runs', consecutive_partial,
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

comment on function public.get_pod_reconciliation_health()
is 'Manager-scoped POD health projection. Stale upload counts are restricted to the actor company; run rows remain global scheduler metadata.';
