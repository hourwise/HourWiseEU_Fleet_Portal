-- Batch 15: bounded POD reconciliation run health and repeated-failure state.
-- This is a small operational health record, not a second event/audit system;
-- detailed actions continue to use security_permission_audit_events.

create table if not exists public.pod_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'partial', 'failure')),
  batch_limit integer not null check (batch_limit between 1 and 1000),
  intents_scanned integer not null default 0 check (intents_scanned >= 0),
  intents_expired integer not null default 0 check (intents_expired >= 0),
  storage_objects_removed integer not null default 0 check (storage_objects_removed >= 0),
  mismatch_count integer not null default 0 check (mismatch_count >= 0),
  failure_count integer not null default 0 check (failure_count >= 0),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists pod_reconciliation_runs_started_idx
  on public.pod_reconciliation_runs(started_at desc, id desc);

alter table public.pod_reconciliation_runs enable row level security;
revoke all on public.pod_reconciliation_runs from public, anon, authenticated;
grant select, insert, update on public.pod_reconciliation_runs to postgres;

create or replace function public.reconcile_expired_job_evidence_uploads(
  p_max_rows integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  intent public.job_evidence_upload_intents%rowtype;
  run_record public.pod_reconciliation_runs;
  previous_run public.pod_reconciliation_runs;
  deleted_object_id uuid;
  inspected_count integer := 0;
  expired_count integer := 0;
  deleted_count integer := 0;
  mismatch_total integer := 0;
  failure_total integer := 0;
  consecutive_count integer := 0;
  run_status text;
  cutoff timestamptz := now() - interval '2 hours';
begin
  if coalesce(p_max_rows, 100) < 1 or coalesce(p_max_rows, 100) > 1000 then
    raise exception 'POD reconciliation batch size must be between 1 and 1000' using errcode = '22023';
  end if;

  insert into public.pod_reconciliation_runs(batch_limit)
  values (coalesce(p_max_rows, 100))
  returning * into run_record;

  begin
    for intent in
      select *
      from public.job_evidence_upload_intents
      where status = 'pending'
        and created_at < cutoff
      order by created_at, id
      for update skip locked
      limit coalesce(p_max_rows, 100)
    loop
      inspected_count := inspected_count + 1;
      deleted_object_id := null;

      begin
        -- A pending intent with an evidence reference is inconsistent. Keep it
        -- pending for diagnosis and never delete its object.
        if intent.evidence_id is not null then
          mismatch_total := mismatch_total + 1;
          update public.job_evidence_upload_intents
          set cleanup_reason = left('Batch 15 reconciliation skipped an intent that already has an evidence reference.', 1000), updated_at = now()
          where id = intent.id and status = 'pending';
        else
          delete from storage.objects
          where bucket_id = intent.storage_bucket
            and name = intent.storage_path
            and owner_id = intent.uploaded_by
          returning id into deleted_object_id;

          if deleted_object_id is null then mismatch_total := mismatch_total + 1; else deleted_count := deleted_count + 1; end if;

          update public.job_evidence_upload_intents
          set status = 'expired', cleaned_at = now(), cleanup_reason = left(
            case when deleted_object_id is null
              then 'Batch 15 reconciliation expired intent; no exact uploader-owned object matched.'
              else 'Batch 15 reconciliation expired intent and removed the exact uploader-owned object.'
            end, 1000), updated_at = now()
          where id = intent.id and status = 'pending';
          if found then expired_count := expired_count + 1; end if;
        end if;

        perform public.record_security_event(
          intent.company_id, null, 'operations.job.evidence.reconcile', 'allowed',
          'job_evidence_upload_reconciled', 'job_assignment', intent.job_assignment_id,
          'cleanup', null,
          jsonb_build_object(
            'upload_intent_id', intent.id,
            'storage_object_deleted', deleted_object_id is not null,
            'mismatch', intent.evidence_id is not null or deleted_object_id is null,
            'cutoff', cutoff,
            'run_id', run_record.id
          ), 'system'
        );
      exception when others then
        failure_total := failure_total + 1;
        update public.job_evidence_upload_intents
        set cleanup_reason = left('Batch 15 reconciliation encountered a bounded item failure: ' || SQLSTATE, 1000), updated_at = now()
        where id = intent.id and status = 'pending';
      end;
    end loop;

    run_status := case when failure_total > 0 then 'partial' when mismatch_total > 0 then 'partial' else 'success' end;
  exception when others then
    failure_total := failure_total + 1;
    run_status := 'failure';
    update public.pod_reconciliation_runs
    set status = run_status, finished_at = now(), intents_scanned = inspected_count,
        intents_expired = expired_count, storage_objects_removed = deleted_count,
        mismatch_count = mismatch_total, failure_count = failure_total,
        error_code = SQLSTATE, error_message = left(SQLERRM, 500)
    where id = run_record.id;
    perform public.record_security_event(
      null, null, 'operations.job.evidence.reconcile', 'error',
      'pod_reconciliation_run_failed', 'pod_reconciliation_run', run_record.id,
      'maintenance', null,
      jsonb_build_object('run_id', run_record.id, 'error_code', SQLSTATE, 'intents_scanned', inspected_count), 'system'
    );
    return jsonb_build_object('run_id', run_record.id, 'status', run_status, 'intents_scanned', inspected_count, 'intents_expired', expired_count, 'storage_objects_removed', deleted_count, 'mismatch_count', mismatch_total, 'failure_count', failure_total, 'consecutive_failures', 0);
  end;

  select * into previous_run
  from public.pod_reconciliation_runs
  where id <> run_record.id
  order by started_at desc, id desc
  limit 1;
  if run_status = 'failure' then consecutive_count := coalesce(previous_run.consecutive_failures, 0) + 1; else consecutive_count := 0; end if;

  update public.pod_reconciliation_runs
  set status = run_status, finished_at = now(), intents_scanned = inspected_count,
      intents_expired = expired_count, storage_objects_removed = deleted_count,
      mismatch_count = mismatch_total, failure_count = failure_total,
      consecutive_failures = consecutive_count
  where id = run_record.id
  returning * into run_record;

  perform public.record_security_event(
    null, null, 'operations.job.evidence.reconcile',
    case when run_status = 'success' then 'allowed' else 'error' end,
    case when run_status = 'success' then 'pod_reconciliation_run_succeeded'
         when consecutive_count >= 3 then 'pod_reconciliation_repeated_failure'
         else 'pod_reconciliation_run_partial' end,
    'pod_reconciliation_run', run_record.id, 'maintenance', null,
    jsonb_build_object(
      'run_id', run_record.id,
      'status', run_record.status,
      'intents_scanned', run_record.intents_scanned,
      'intents_expired', run_record.intents_expired,
      'storage_objects_removed', run_record.storage_objects_removed,
      'mismatch_count', run_record.mismatch_count,
      'failure_count', run_record.failure_count,
      'consecutive_failures', run_record.consecutive_failures
    ), 'system'
  );

  return jsonb_build_object(
    'run_id', run_record.id,
    'status', run_record.status,
    'started_at', run_record.started_at,
    'finished_at', run_record.finished_at,
    'intents_scanned', run_record.intents_scanned,
    'intents_expired', run_record.intents_expired,
    'storage_objects_removed', run_record.storage_objects_removed,
    'mismatch_count', run_record.mismatch_count,
    'failure_count', run_record.failure_count,
    'consecutive_failures', run_record.consecutive_failures,
    'maintenance_warning', run_record.consecutive_failures >= 3
  );
end;
$$;

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
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only an authenticated manager can view reconciliation health' using errcode = '42501';
  end if;
  select * into latest from public.pod_reconciliation_runs order by started_at desc, id desc limit 1;
  select * into last_success from public.pod_reconciliation_runs where status = 'success' order by finished_at desc, id desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'started_at', started_at, 'finished_at', finished_at, 'status', status,
    'intents_scanned', intents_scanned, 'intents_expired', intents_expired,
    'storage_objects_removed', storage_objects_removed, 'mismatch_count', mismatch_count,
    'failure_count', failure_count, 'consecutive_failures', consecutive_failures
  ) order by started_at desc, id desc), '[]'::jsonb)
  into recent
  from (select * from public.pod_reconciliation_runs order by started_at desc, id desc limit 20) runs;
  return jsonb_build_object(
    'last_attempted_run', case when latest.id is null then null else to_jsonb(latest) end,
    'last_successful_run', case when last_success.id is null then null else to_jsonb(last_success) end,
    'consecutive_failures', coalesce(latest.consecutive_failures, 0),
    'maintenance_warning', coalesce(latest.consecutive_failures, 0) >= 3,
    'recent_runs', recent
  );
end;
$$;

revoke all on function public.reconcile_expired_job_evidence_uploads(integer) from public, anon, authenticated;
grant execute on function public.reconcile_expired_job_evidence_uploads(integer) to postgres;
revoke all on function public.get_pod_reconciliation_health() from public, anon;
grant execute on function public.get_pod_reconciliation_health() to authenticated;

comment on table public.pod_reconciliation_runs is 'Bounded POD maintenance run health. Detailed authorization/audit evidence remains in security_permission_audit_events.';
comment on function public.get_pod_reconciliation_health() is 'Manager-scoped operational summary of POD reconciliation attempts, counts, mismatches, failures, and repeated-failure warning state.';
