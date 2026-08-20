-- Batch 17: bounded POD reconciliation drill-down and typed timeline metadata.
-- This migration adds read-only operational context. It never exposes storage
-- paths, original file names, uploader identities, or raw reconciliation text.

create or replace function public.list_pod_reconciliation_drilldown(
  p_signal_key text,
  p_limit integer default 50
)
returns setof jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  result_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only an authenticated manager can view POD reconciliation drill-down' using errcode = '42501';
  end if;

  if p_signal_key not in (
    'pod-reconciliation:stale-backlog',
    'pod-reconciliation:storage-outcome',
    'pod-reconciliation:consecutive-failures',
    'pod-reconciliation:consecutive-partials',
    'pod-reconciliation:overdue'
  ) then
    raise exception 'Unsupported POD reconciliation signal' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select
      intent.id as item_id,
      intent.job_assignment_id,
      intent.job_id,
      intent.status,
      intent.evidence_id,
      intent.created_at,
      intent.updated_at,
      intent.cleanup_reason,
      jobs.reference as job_reference,
      jobs.title as job_title,
      case
        when intent.evidence_id is not null then 'evidence_reference_mismatch'
        when intent.status = 'expired' and coalesce(intent.cleanup_reason, '') ilike '%no exact uploader-owned object%' then 'storage_object_mismatch'
        when intent.status = 'expired' and coalesce(intent.cleanup_reason, '') ilike '%bounded item failure%' then 'reconciliation_item_failure'
        else 'stale_pending_upload'
      end as reconciliation_category,
      case
        when intent.evidence_id is not null then 'warning'
        when intent.status = 'expired' and coalesce(intent.cleanup_reason, '') ilike '%bounded item failure%' then 'critical'
        else 'advisory'
      end as severity,
      case
        when intent.evidence_id is not null then 'Pending upload has an evidence reference'
        when intent.status = 'expired' and coalesce(intent.cleanup_reason, '') ilike '%no exact uploader-owned object%' then 'Evidence upload object did not reconcile'
        when intent.status = 'expired' and coalesce(intent.cleanup_reason, '') ilike '%bounded item failure%' then 'Evidence upload reconciliation item failed'
        else 'Evidence upload intent remains unresolved'
      end as title,
      case
        when intent.evidence_id is not null then 'Review the linked assignment evidence and confirm the lifecycle state independently.'
        when intent.status = 'expired' and coalesce(intent.cleanup_reason, '') ilike '%no exact uploader-owned object%' then 'Review the assignment evidence state; no broad storage retry is implied.'
        when intent.status = 'expired' and coalesce(intent.cleanup_reason, '') ilike '%bounded item failure%' then 'Review the assignment and maintenance run before taking any cleanup action.'
        else 'Review the assignment evidence state and decide whether a governed upload is required.'
      end as recommended_action
    from public.job_evidence_upload_intents intent
    join public.jobs jobs
      on jobs.id = intent.job_id
     and jobs.company_id = actor_company_id
    where intent.company_id = actor_company_id
      and (
        (p_signal_key = 'pod-reconciliation:stale-backlog'
          and intent.status = 'pending'
          and intent.created_at < now() - interval '2 hours')
        or
        (p_signal_key = 'pod-reconciliation:storage-outcome'
          and (
            (intent.status = 'pending' and intent.evidence_id is not null)
            or (intent.status = 'expired' and (
              coalesce(intent.cleanup_reason, '') ilike '%no exact uploader-owned object%'
              or coalesce(intent.cleanup_reason, '') ilike '%bounded item failure%'
            ))
          ))
      )
  )
  select jsonb_build_object(
    'id', candidates.item_id,
    'itemType', 'job_evidence_upload_intent',
    'occurredAt', candidates.updated_at,
    'jobAssignmentId', candidates.job_assignment_id,
    'jobReference', left(candidates.job_reference, 120),
    'jobTitle', left(candidates.job_title, 160),
    'entityLabel', 'Job ' || left(candidates.job_reference, 120),
    'reconciliationCategory', candidates.reconciliation_category,
    'severity', candidates.severity,
    'title', candidates.title,
    'recommendedAction', candidates.recommended_action,
    'navigationKey', 'job_assignment'
  )
  from candidates
  order by candidates.updated_at asc, candidates.item_id
  limit result_limit;
end;
$$;

revoke all on function public.list_pod_reconciliation_drilldown(text, integer) from public, anon;
grant execute on function public.list_pod_reconciliation_drilldown(text, integer) to authenticated;

comment on function public.list_pod_reconciliation_drilldown(text, integer)
is 'Manager-scoped POD reconciliation drill-down. Returns bounded job context and safe action keys only; never returns storage paths, file names, uploader identities, or raw cleanup details.';
