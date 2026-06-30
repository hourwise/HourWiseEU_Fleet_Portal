begin;

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
  review_record public.tachograph_finding_reviews%rowtype;
  was_acknowledged boolean := false;
begin
  select *
  into review_record
  from public.tachograph_finding_reviews
  where id = p_review_id
  for update;

  if review_record.id is null then
    raise exception 'Tachograph finding review not found';
  end if;

  if public.get_my_role() is distinct from 'driver'
     or review_record.driver_id is distinct from auth.uid() then
    raise exception 'Only the linked driver can acknowledge this tachograph review';
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

grant execute on function public.acknowledge_tachograph_finding_review(uuid, text) to authenticated;

commit;
