-- Batch 14: bounded server-side cleanup for abandoned pending POD uploads.
-- Finalized evidence is never selected. Storage deletion is exact bucket/path
-- and uploader-owner scoped; the intent row is retained as audit evidence.

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
  deleted_object_id uuid;
  inspected_count integer := 0;
  deleted_count integer := 0;
  retained_count integer := 0;
  cutoff timestamptz := now() - interval '2 hours';
begin
  if coalesce(p_max_rows, 100) < 1 or coalesce(p_max_rows, 100) > 1000 then
    raise exception 'POD reconciliation batch size must be between 1 and 1000' using errcode = '22023';
  end if;

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

    -- Never delete by prefix. The exact server-generated path and uploader
    -- owner must both match the retained intent provenance.
    delete from storage.objects
    where bucket_id = intent.storage_bucket
      and name = intent.storage_path
      and owner_id = intent.uploaded_by
    returning id into deleted_object_id;

    if deleted_object_id is null then
      retained_count := retained_count + 1;
    else
      deleted_count := deleted_count + 1;
    end if;

    update public.job_evidence_upload_intents
    set status = 'expired',
        cleaned_at = now(),
        cleanup_reason = left(
          case
            when deleted_object_id is null then 'Batch 14 reconciliation expired intent; no matching uploader-owned object was deleted.'
            else 'Batch 14 reconciliation expired intent and deleted the exact uploader-owned storage object.'
          end,
          1000
        ),
        updated_at = now()
    where id = intent.id and status = 'pending';

    perform public.record_security_event(
      intent.company_id, null, 'operations.job.evidence.reconcile', 'allowed', 'job_evidence_upload_reconciled',
      'job_assignment', intent.job_assignment_id, 'cleanup', null,
      jsonb_build_object(
        'upload_intent_id', intent.id,
        'storage_bucket', intent.storage_bucket,
        'storage_path', intent.storage_path,
        'uploaded_by', intent.uploaded_by,
        'storage_object_deleted', deleted_object_id is not null,
        'cutoff', cutoff
      ),
      'system'
    );
  end loop;

  return jsonb_build_object(
    'status', 'completed',
    'cutoff', cutoff,
    'batch_limit', coalesce(p_max_rows, 100),
    'inspected_count', inspected_count,
    'deleted_count', deleted_count,
    'retained_count', retained_count
  );
end;
$$;

revoke all on function public.reconcile_expired_job_evidence_uploads(integer) from public, anon, authenticated;
grant execute on function public.reconcile_expired_job_evidence_uploads(integer) to postgres;

do $batch14$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'hourwise-pod-upload-intent-reconciliation'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
  perform cron.schedule(
    'hourwise-pod-upload-intent-reconciliation',
    '*/15 * * * *',
    $cron$select public.reconcile_expired_job_evidence_uploads(100);$cron$
  );
end;
$batch14$;

comment on function public.reconcile_expired_job_evidence_uploads(integer) is 'Bounded pg_cron cleanup of expired pending POD intents. It retains intent provenance and never deletes finalized evidence or arbitrary storage prefixes.';
