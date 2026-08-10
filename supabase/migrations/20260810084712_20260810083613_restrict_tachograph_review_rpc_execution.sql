-- BATCH 6: remove anonymous execution from tachograph review and read RPCs.
-- Driver Card Analysis remains authenticated and uses the existing RPC contracts.

create or replace function public.save_tachograph_finding_review(
  p_company_id uuid,
  p_finding_id uuid,
  p_status text,
  p_manager_note text default null,
  p_corrective_action_type text default null,
  p_corrective_action_ref_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  finding_record public.tachograph_findings%rowtype;
  existing_review public.tachograph_finding_reviews%rowtype;
  saved_review public.tachograph_finding_reviews%rowtype;
  normalized_status text := lower(btrim(coalesce(p_status, 'open')));
  normalized_action text := nullif(lower(btrim(coalesce(p_corrective_action_type, ''))), '');
  event_type text := 'updated';
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.get_my_role() is distinct from 'manager'
     or actor_company_id is distinct from p_company_id
     or not public.actor_has_permission('compliance.finding.review', actor_company_id, null) then
    perform public.record_security_event(
      actor_company_id,
      null,
      'compliance.finding.review',
      'denied',
      'manager_company_or_permission_mismatch',
      'tachograph_finding',
      p_finding_id,
      'review'
    );
    raise exception 'Only an authorised manager can review findings for their own company';
  end if;

  if normalized_status not in ('open', 'reviewed', 'action_required', 'closed') then
    raise exception 'Unsupported tachograph finding review status';
  end if;

  if normalized_action is not null and normalized_action not in ('training', 'manager_debrief', 'manual_entry', 'other') then
    raise exception 'Unsupported tachograph finding corrective action type';
  end if;

  select *
  into finding_record
  from public.tachograph_findings
  where id = p_finding_id
    and company_id = actor_company_id;

  if finding_record.id is null then
    raise exception 'Tachograph finding not found for this company';
  end if;

  select *
  into existing_review
  from public.tachograph_finding_reviews
  where finding_id = p_finding_id
  for update;

  if existing_review.id is null then
    event_type := 'created';
  end if;

  insert into public.tachograph_finding_reviews (
    finding_id,
    company_id,
    driver_id,
    import_id,
    status,
    manager_note,
    corrective_action_type,
    corrective_action_ref_id,
    reviewed_at,
    reviewed_by_user_id,
    closed_at,
    closed_by_user_id,
    updated_at
  )
  values (
    finding_record.id,
    actor_company_id,
    finding_record.driver_id,
    finding_record.import_id,
    normalized_status,
    nullif(btrim(coalesce(p_manager_note, '')), ''),
    normalized_action,
    p_corrective_action_ref_id,
    case when normalized_status in ('reviewed', 'action_required', 'closed') then now() else null end,
    case when normalized_status in ('reviewed', 'action_required', 'closed') then auth.uid() else null end,
    case when normalized_status = 'closed' then now() else null end,
    case when normalized_status = 'closed' then auth.uid() else null end,
    now()
  )
  on conflict (finding_id) do update
  set status = excluded.status,
      manager_note = excluded.manager_note,
      corrective_action_type = excluded.corrective_action_type,
      corrective_action_ref_id = excluded.corrective_action_ref_id,
      reviewed_at = case
        when excluded.status in ('reviewed', 'action_required', 'closed') then coalesce(public.tachograph_finding_reviews.reviewed_at, now())
        else null
      end,
      reviewed_by_user_id = case
        when excluded.status in ('reviewed', 'action_required', 'closed') then coalesce(public.tachograph_finding_reviews.reviewed_by_user_id, auth.uid())
        else null
      end,
      closed_at = case
        when excluded.status = 'closed' then coalesce(public.tachograph_finding_reviews.closed_at, now())
        else null
      end,
      closed_by_user_id = case
        when excluded.status = 'closed' then coalesce(public.tachograph_finding_reviews.closed_by_user_id, auth.uid())
        else null
      end,
      updated_at = now()
  returning * into saved_review;

  insert into public.tachograph_finding_review_events (
    review_id,
    finding_id,
    company_id,
    actor_user_id,
    event_type,
    previous_status,
    new_status,
    note,
    metadata
  )
  values (
    saved_review.id,
    saved_review.finding_id,
    saved_review.company_id,
    auth.uid(),
    event_type,
    existing_review.status,
    saved_review.status,
    saved_review.manager_note,
    jsonb_build_object(
      'correctiveActionType', saved_review.corrective_action_type,
      'correctiveActionRefId', saved_review.corrective_action_ref_id
    )
  );

  return jsonb_build_object(
    'id', saved_review.id,
    'findingId', saved_review.finding_id,
    'companyId', saved_review.company_id,
    'driverId', saved_review.driver_id,
    'importId', saved_review.import_id,
    'status', saved_review.status,
    'managerNote', saved_review.manager_note,
    'correctiveActionType', saved_review.corrective_action_type,
    'correctiveActionRefId', saved_review.corrective_action_ref_id,
    'reviewedAt', saved_review.reviewed_at,
    'reviewedByUserId', saved_review.reviewed_by_user_id,
    'closedAt', saved_review.closed_at,
    'closedByUserId', saved_review.closed_by_user_id,
    'driverAcknowledgedAt', saved_review.driver_acknowledged_at,
    'driverAcknowledgedByUserId', saved_review.driver_acknowledged_by_user_id,
    'createdAt', saved_review.created_at,
    'updatedAt', saved_review.updated_at
  );
end;
$$;

create or replace function public.acknowledge_tachograph_finding_review(
  p_review_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  review_record public.tachograph_finding_reviews%rowtype;
  was_acknowledged boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into review_record
  from public.tachograph_finding_reviews
  where id = p_review_id
  for update;

  if review_record.id is null then
    raise exception 'Tachograph finding review not found';
  end if;

  if public.get_my_role() is distinct from 'driver'
     or actor_company_id is distinct from review_record.company_id
     or review_record.driver_id is distinct from auth.uid()
     or not public.actor_has_permission('compliance.finding.acknowledge', review_record.company_id, null) then
    perform public.record_security_event(
      actor_company_id,
      null,
      'compliance.finding.acknowledge',
      'denied',
      'driver_company_or_permission_mismatch',
      'tachograph_finding_review',
      review_record.id,
      'acknowledge'
    );
    raise exception 'Only the linked authorised driver can acknowledge this tachograph review';
  end if;

  was_acknowledged := review_record.driver_acknowledged_at is not null;

  update public.tachograph_finding_reviews
  set driver_acknowledged_at = coalesce(driver_acknowledged_at, now()),
      driver_acknowledged_by_user_id = coalesce(driver_acknowledged_by_user_id, auth.uid()),
      updated_at = now()
  where id = review_record.id
  returning * into review_record;

  if not was_acknowledged then
    insert into public.tachograph_finding_review_events (
      review_id,
      finding_id,
      company_id,
      actor_user_id,
      event_type,
      previous_status,
      new_status,
      note,
      metadata
    )
    values (
      review_record.id,
      review_record.finding_id,
      review_record.company_id,
      auth.uid(),
      'driver_acknowledged',
      review_record.status,
      review_record.status,
      nullif(btrim(coalesce(p_note, '')), ''),
      jsonb_build_object(
        'driverAcknowledgedAt', review_record.driver_acknowledged_at,
        'driverAcknowledgedByUserId', review_record.driver_acknowledged_by_user_id
      )
    );
  end if;

  return jsonb_build_object(
    'id', review_record.id,
    'findingId', review_record.finding_id,
    'companyId', review_record.company_id,
    'driverId', review_record.driver_id,
    'importId', review_record.import_id,
    'status', review_record.status,
    'managerNote', review_record.manager_note,
    'correctiveActionType', review_record.corrective_action_type,
    'correctiveActionRefId', review_record.corrective_action_ref_id,
    'reviewedAt', review_record.reviewed_at,
    'reviewedByUserId', review_record.reviewed_by_user_id,
    'closedAt', review_record.closed_at,
    'closedByUserId', review_record.closed_by_user_id,
    'driverAcknowledgedAt', review_record.driver_acknowledged_at,
    'driverAcknowledgedByUserId', review_record.driver_acknowledged_by_user_id,
    'createdAt', review_record.created_at,
    'updatedAt', review_record.updated_at
  );
end;
$$;

revoke all on function public.save_tachograph_finding_review(uuid, uuid, text, text, text, uuid) from public;
revoke all on function public.save_tachograph_finding_review(uuid, uuid, text, text, text, uuid) from anon;
grant execute on function public.save_tachograph_finding_review(uuid, uuid, text, text, text, uuid) to authenticated;

revoke all on function public.acknowledge_tachograph_finding_review(uuid, text) from public;
revoke all on function public.acknowledge_tachograph_finding_review(uuid, text) from anon;
grant execute on function public.acknowledge_tachograph_finding_review(uuid, text) to authenticated;

-- These related SECURITY DEFINER reads accept caller-supplied authority identifiers.
-- They are used by authenticated portal analysis paths, never anonymous onboarding.
revoke all on function public.get_company_tacho_signals(uuid, integer) from public;
revoke all on function public.get_company_tacho_signals(uuid, integer) from anon;
grant execute on function public.get_company_tacho_signals(uuid, integer) to authenticated;

revoke all on function public.get_driver_tacho_analysis_bundle(uuid, uuid, text) from public;
revoke all on function public.get_driver_tacho_analysis_bundle(uuid, uuid, text) from anon;
grant execute on function public.get_driver_tacho_analysis_bundle(uuid, uuid, text) to authenticated;

revoke all on function public.get_driver_timeline_bundle(uuid, uuid, text) from public;
revoke all on function public.get_driver_timeline_bundle(uuid, uuid, text) from anon;
grant execute on function public.get_driver_timeline_bundle(uuid, uuid, text) to authenticated;

revoke all on function public.get_import_timeline_bundle(uuid, uuid) from public;
revoke all on function public.get_import_timeline_bundle(uuid, uuid) from anon;
grant execute on function public.get_import_timeline_bundle(uuid, uuid) to authenticated;

revoke all on function public.get_tacho_import_bundle(uuid, uuid) from public;
revoke all on function public.get_tacho_import_bundle(uuid, uuid) from anon;
grant execute on function public.get_tacho_import_bundle(uuid, uuid) to authenticated;

revoke all on function public.get_vehicle_timeline_bundle(uuid, uuid, text) from public;
revoke all on function public.get_vehicle_timeline_bundle(uuid, uuid, text) from anon;
grant execute on function public.get_vehicle_timeline_bundle(uuid, uuid, text) to authenticated;

revoke all on function public.get_vehicle_unit_analysis_bundle(uuid, uuid, text) from public;
revoke all on function public.get_vehicle_unit_analysis_bundle(uuid, uuid, text) from anon;
grant execute on function public.get_vehicle_unit_analysis_bundle(uuid, uuid, text) to authenticated;

comment on function public.save_tachograph_finding_review(uuid, uuid, text, text, text, uuid) is
  'Authenticated manager-only same-company tachograph finding review with permission enforcement and audit events.';

comment on function public.acknowledge_tachograph_finding_review(uuid, text) is
  'Authenticated driver-only acknowledgement for the linked driver and company with permission enforcement and audit events.';
