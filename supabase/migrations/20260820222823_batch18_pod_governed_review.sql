-- Batch 18: governed, idempotent manager review for authoritative job evidence.
-- This intentionally does not change job_assignments.status. Evidence review and
-- lifecycle completion remain separate governed decisions.

create or replace function public.review_job_evidence_governed(
  p_evidence_id uuid,
  p_review_status text,
  p_review_notes text default null,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  current_evidence public.job_evidence;
  reviewed_evidence public.job_evidence;
  safe_note text := nullif(btrim(coalesce(p_review_notes, '')), '');
  outcome text;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' or actor_company_id is null then
    return jsonb_build_object('outcome', 'permission_denied');
  end if;

  if p_review_status not in ('accepted', 'rejected', 'needs_follow_up') then
    return jsonb_build_object('outcome', 'invalid_state', 'reason', 'Unsupported evidence review status.');
  end if;
  if safe_note is not null and char_length(safe_note) > 2000 then
    return jsonb_build_object('outcome', 'invalid_state', 'reason', 'Evidence review notes are limited to 2000 characters.');
  end if;
  if safe_note ~* '<|>|<script|javascript:' then
    return jsonb_build_object('outcome', 'invalid_state', 'reason', 'Evidence review notes cannot contain HTML or script content.');
  end if;

  select * into current_evidence
  from public.job_evidence
  where id = p_evidence_id and company_id = actor_company_id
  for update;

  if current_evidence.id is null then
    return jsonb_build_object('outcome', 'permission_denied');
  end if;

  if p_expected_updated_at is not null and current_evidence.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object(
      'outcome', 'stale',
      'evidence', jsonb_build_object(
        'id', current_evidence.id,
        'review_status', current_evidence.review_status,
        'reviewed_at', current_evidence.reviewed_at,
        'review_notes', current_evidence.review_notes,
        'updated_at', current_evidence.updated_at
      )
    );
  end if;

  if current_evidence.review_status is distinct from 'pending' then
    return jsonb_build_object(
      'outcome', 'already_reviewed',
      'evidence', jsonb_build_object(
        'id', current_evidence.id,
        'review_status', current_evidence.review_status,
        'reviewed_at', current_evidence.reviewed_at,
        'review_notes', current_evidence.review_notes,
        'updated_at', current_evidence.updated_at
      )
    );
  end if;

  update public.job_evidence
  set review_status = p_review_status,
      reviewed_by = actor_id,
      reviewed_at = now(),
      review_notes = safe_note,
      updated_at = now()
  where id = current_evidence.id
  returning * into reviewed_evidence;

  perform public.record_security_event(
    actor_company_id, null, 'operations.job.evidence.review', 'allowed', 'job_evidence_reviewed',
    'job_assignment', current_evidence.job_assignment_id, 'review', null,
    jsonb_build_object('job_evidence_id', current_evidence.id, 'review_status', p_review_status), 'user'
  );

  return jsonb_build_object(
    'outcome', 'reviewed',
    'evidence', jsonb_build_object(
      'id', reviewed_evidence.id,
      'review_status', reviewed_evidence.review_status,
      'reviewed_at', reviewed_evidence.reviewed_at,
      'review_notes', reviewed_evidence.review_notes,
      'updated_at', reviewed_evidence.updated_at
    )
  );
end;
$$;

create or replace function public.list_manager_pod_review_queue(
  p_review_status text default null,
  p_job_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit integer default 50
)
returns setof jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' or actor_company_id is null then
    return;
  end if;
  if p_review_status is not null and p_review_status not in ('pending', 'accepted', 'rejected', 'needs_follow_up') then
    raise exception 'Unsupported evidence review status' using errcode = '22023';
  end if;
  return query
  select jsonb_build_object(
    'id', evidence.id,
    'job_id', evidence.job_id,
    'job_reference', job_record.reference,
    'job_title', job_record.title,
    'job_assignment_id', evidence.job_assignment_id,
    'assignment_status', assignment.status,
    'evidence_type', evidence.evidence_type,
    'outcome', evidence.outcome,
    'source', evidence.source,
    'uploaded_at', evidence.uploaded_at,
    'uploader_role', uploader.role,
    'uploader_label', coalesce(uploader.full_name, 'Portal uploader'),
    'review_status', evidence.review_status,
    'reviewed_at', evidence.reviewed_at,
    'reviewed_by_label', reviewer.full_name,
    'review_notes', evidence.review_notes,
    'updated_at', evidence.updated_at
  )
  from public.job_evidence evidence
  join public.jobs job_record on job_record.id = evidence.job_id and job_record.company_id = actor_company_id
  join public.job_assignments assignment on assignment.id = evidence.job_assignment_id and assignment.company_id = actor_company_id
  left join public.profiles uploader on uploader.id = evidence.uploaded_by and uploader.company_id = actor_company_id
  left join public.profiles reviewer on reviewer.id = evidence.reviewed_by and reviewer.company_id = actor_company_id
  where evidence.company_id = actor_company_id
    and (p_review_status is null or evidence.review_status = p_review_status)
    and (p_job_id is null or evidence.job_id = p_job_id)
    and (p_from is null or evidence.uploaded_at >= p_from)
    and (p_to is null or evidence.uploaded_at < p_to)
  order by case evidence.review_status when 'pending' then 0 when 'needs_follow_up' then 1 when 'rejected' then 2 else 3 end,
           evidence.uploaded_at desc, evidence.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

revoke all on function public.review_job_evidence_governed(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.review_job_evidence_governed(uuid, text, text, timestamptz) to authenticated;
revoke all on function public.list_manager_pod_review_queue(text, uuid, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.list_manager_pod_review_queue(text, uuid, timestamptz, timestamptz, integer) to authenticated;

comment on function public.review_job_evidence_governed(uuid, text, text, timestamptz) is 'Manager-only, company-scoped, idempotent POD review. Uses auth.uid, row locking, expected updated_at, and never changes job lifecycle status.';
comment on function public.list_manager_pod_review_queue(text, uuid, timestamptz, timestamptz, integer) is 'Manager-only same-company POD queue. Returns bounded review metadata and never returns protected storage internals.';
