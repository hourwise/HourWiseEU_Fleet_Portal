-- Follow-on cleanup for the deployed Batch 18 function. Do not edit the
-- deployed migration; this replacement only removes an unused local variable.
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
  select * into current_evidence from public.job_evidence where id = p_evidence_id and company_id = actor_company_id for update;
  if current_evidence.id is null then
    return jsonb_build_object('outcome', 'permission_denied');
  end if;
  if p_expected_updated_at is not null and current_evidence.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('outcome', 'stale', 'evidence', jsonb_build_object('id', current_evidence.id, 'review_status', current_evidence.review_status, 'reviewed_at', current_evidence.reviewed_at, 'review_notes', current_evidence.review_notes, 'updated_at', current_evidence.updated_at));
  end if;
  if current_evidence.review_status is distinct from 'pending' then
    return jsonb_build_object('outcome', 'already_reviewed', 'evidence', jsonb_build_object('id', current_evidence.id, 'review_status', current_evidence.review_status, 'reviewed_at', current_evidence.reviewed_at, 'review_notes', current_evidence.review_notes, 'updated_at', current_evidence.updated_at));
  end if;
  update public.job_evidence
  set review_status = p_review_status, reviewed_by = actor_id, reviewed_at = now(), review_notes = safe_note, updated_at = now()
  where id = current_evidence.id
  returning * into reviewed_evidence;
  perform public.record_security_event(actor_company_id, null, 'operations.job.evidence.review', 'allowed', 'job_evidence_reviewed', 'job_assignment', current_evidence.job_assignment_id, 'review', null, jsonb_build_object('job_evidence_id', current_evidence.id, 'review_status', p_review_status), 'user');
  return jsonb_build_object('outcome', 'reviewed', 'evidence', jsonb_build_object('id', reviewed_evidence.id, 'review_status', reviewed_evidence.review_status, 'reviewed_at', reviewed_evidence.reviewed_at, 'review_notes', reviewed_evidence.review_notes, 'updated_at', reviewed_evidence.updated_at));
end;
$$;

revoke all on function public.review_job_evidence_governed(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.review_job_evidence_governed(uuid, text, text, timestamptz) to authenticated;
