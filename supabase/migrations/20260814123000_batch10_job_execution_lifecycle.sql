-- Batch 10: governed driver execution lifecycle for job assignments.

begin;

drop policy if exists "Drivers can view own published job assignments" on public.job_assignments;
create policy "Drivers can view own active job assignments"
  on public.job_assignments for select
  to authenticated
  using (
    driver_id = auth.uid()
    and status not in ('draft', 'cancelled')
  );

drop policy if exists "Drivers can view jobs from own assignments" on public.jobs;
create policy "Drivers can view jobs from own active assignments"
  on public.jobs for select
  to authenticated
  using (
    exists (
      select 1 from public.job_assignments ja
      where ja.job_id = jobs.id
        and ja.driver_id = auth.uid()
        and ja.status not in ('draft', 'cancelled')
    )
  );

create or replace function public.transition_job_assignment_with_event(
  p_assignment_id uuid,
  p_to_status text,
  p_expected_updated_at timestamptz,
  p_reason text default null,
  p_requires_ack boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  actor_role text := public.get_my_role();
  target_assignment public.job_assignments%rowtype;
  target_shift public.shifts%rowtype;
  target_job public.jobs%rowtype;
  previous_status text;
  next_status text := lower(btrim(coalesce(p_to_status, '')));
  permission_key text := null;
  manager_action boolean := false;
  driver_action boolean := false;
  event_type text;
  event_priority text := 'advisory';
  event_title text;
  event_body text;
  thread_id uuid;
  event_id uuid;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
  event_payload jsonb;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if next_status not in ('acknowledged', 'started', 'arrived', 'completed', 'delayed', 'unable_to_complete', 'vehicle_issue', 'site_issue', 'route_issue', 'cancelled') then
    raise exception 'Unsupported job execution status' using errcode = '22023';
  end if;
  if next_status in ('delayed', 'unable_to_complete', 'vehicle_issue', 'site_issue', 'route_issue', 'cancelled')
     and (reason is null or length(reason) < 5 or length(reason) > 1000) then
    raise exception 'A meaningful reason between 5 and 1000 characters is required for this transition' using errcode = '22023';
  end if;

  select * into target_assignment from public.job_assignments where id = p_assignment_id for update;
  if target_assignment.id is null then raise exception 'Job assignment not found' using errcode = '42501'; end if;
  select * into target_shift from public.shifts where id = target_assignment.shift_id for update;
  if target_shift.id is null then raise exception 'Shift not found' using errcode = '42501'; end if;
  select * into target_job from public.jobs where id = target_assignment.job_id for update;
  if target_job.id is null then raise exception 'Job not found' using errcode = '42501'; end if;
  if target_assignment.company_id is distinct from actor_company_id or target_shift.company_id is distinct from actor_company_id or target_job.company_id is distinct from actor_company_id then
    raise exception 'Job assignment is outside the actor company' using errcode = '42501';
  end if;
  if p_expected_updated_at is null or target_assignment.updated_at is distinct from p_expected_updated_at then
    raise exception 'Job assignment changed since it was loaded; refresh before transitioning' using errcode = '40001';
  end if;
  if target_assignment.status = 'cancelled' then raise exception 'Cancelled job assignments cannot transition' using errcode = '22023'; end if;

  driver_action := actor_role = 'driver' and target_assignment.driver_id = actor_id and target_shift.driver_id = actor_id and target_shift.status in ('published', 'updated');
  manager_action := actor_role = 'manager' and public.actor_has_permission('operations.job.transition', actor_company_id, null);
  if not driver_action and not manager_action then
    perform public.record_security_event(actor_company_id, null, case when actor_role = 'manager' then 'operations.job.transition' else null end, 'denied', 'job_transition_authority_mismatch', 'job_assignment', p_assignment_id, 'transition');
    raise exception 'Actor is not authorised for this job assignment' using errcode = '42501';
  end if;
  if manager_action then permission_key := 'operations.job.transition'; end if;
  if manager_action and next_status <> 'cancelled' then
    raise exception 'Manager execution intervention is limited to cancellation; driver-owned states require the assigned driver' using errcode = '42501';
  end if;

  previous_status := target_assignment.status::text;
  if manager_action and next_status = 'cancelled' then
    if previous_status in ('completed', 'unable_to_complete') then raise exception 'Completed or unable-to-complete jobs cannot be cancelled by this action' using errcode = '22023'; end if;
  elsif driver_action then
     if next_status = 'acknowledged' and previous_status not in ('published', 'updated') then raise exception 'Only published or updated jobs can be acknowledged' using errcode = '22023'; end if;
    if next_status = 'started' and previous_status not in ('acknowledged', 'delayed') then raise exception 'Only acknowledged or delayed jobs can be started' using errcode = '22023'; end if;
    if next_status = 'arrived' and previous_status <> 'started' then raise exception 'Only started jobs can be marked arrived' using errcode = '22023'; end if;
    if next_status = 'completed' and previous_status <> 'arrived' then raise exception 'Only arrived jobs can be completed' using errcode = '22023'; end if;
    if next_status = 'delayed' and previous_status not in ('published', 'acknowledged', 'started', 'arrived') then raise exception 'This job cannot currently be marked delayed' using errcode = '22023'; end if;
    if next_status in ('unable_to_complete', 'vehicle_issue', 'site_issue', 'route_issue') and previous_status not in ('started', 'arrived', 'delayed') then raise exception 'This exception can only be reported during active work' using errcode = '22023'; end if;
    if next_status = 'cancelled' then raise exception 'Drivers cannot cancel assigned jobs' using errcode = '42501'; end if;
  end if;

  event_type := case next_status
    when 'acknowledged' then 'job_acknowledged'
    when 'started' then 'job_started'
    when 'arrived' then 'job_arrived'
    when 'completed' then 'job_completed'
    when 'delayed' then 'job_delayed'
    when 'unable_to_complete' then 'job_unable_to_complete'
    when 'vehicle_issue' then 'job_vehicle_issue'
    when 'site_issue' then 'job_site_issue'
    when 'route_issue' then 'job_route_issue'
    else 'job_cancelled'
  end;
  event_priority := case when next_status in ('unable_to_complete', 'vehicle_issue', 'site_issue', 'route_issue', 'cancelled') then 'warning' when next_status = 'delayed' then 'warning' when next_status = 'completed' then 'info' else 'advisory' end;
  event_title := case next_status
    when 'acknowledged' then 'Job acknowledged'
    when 'started' then 'Job started'
    when 'arrived' then 'Stop reached'
    when 'completed' then 'Job completed'
    when 'delayed' then 'Job delayed'
    when 'unable_to_complete' then 'Job unable to complete'
    when 'vehicle_issue' then 'Vehicle issue reported'
    when 'site_issue' then 'Site issue reported'
    when 'route_issue' then 'Route issue reported'
    else 'Job cancelled'
  end;
  event_body := format('%s moved from %s to %s.%s', target_job.reference, previous_status, next_status, case when reason is null then '' else format(' Reason: %s', reason) end);
  event_payload := jsonb_build_object('job_id', target_assignment.job_id, 'job_assignment_id', target_assignment.id, 'previous_status', previous_status, 'new_status', next_status, 'reason', reason, 'actor_role', actor_role);

  update public.job_assignments
  set status = next_status::public.job_assignment_status, updated_at = now()
  where id = target_assignment.id;

  select fe.thread_id into thread_id from public.fleet_events fe where fe.related_shift_id = target_shift.id and fe.thread_id is not null order by fe.created_at desc limit 1;
  if thread_id is null then
    insert into public.message_threads (company_id, thread_type, subject, driver_id, created_by)
    values (target_shift.company_id, 'rota', 'Rota updates', target_shift.driver_id, actor_id)
    returning id into thread_id;
  end if;
  insert into public.fleet_events (company_id, thread_id, event_type, priority, actor_id, recipient_driver_id, related_shift_id, title, body, payload, requires_ack)
  values (target_assignment.company_id, thread_id, event_type, event_priority, actor_id, target_assignment.driver_id, target_assignment.shift_id, event_title, event_body, event_payload, case when next_status in ('delayed', 'unable_to_complete', 'vehicle_issue', 'site_issue', 'route_issue') then true else coalesce(p_requires_ack, false) end)
  returning id into event_id;
  update public.message_threads set last_event_id = event_id, updated_at = now() where id = thread_id;

  perform public.record_security_event(target_assignment.company_id, null, permission_key, 'allowed', event_type, 'job_assignment', target_assignment.id, 'transition', null, jsonb_build_object('event_id', event_id, 'previous_status', previous_status, 'new_status', next_status, 'reason', reason, 'actor_role', actor_role));
  return jsonb_build_object('job_assignment_id', target_assignment.id, 'job_id', target_assignment.job_id, 'previous_status', previous_status, 'status', next_status, 'event_id', event_id, 'updated_at', (select updated_at from public.job_assignments where id = target_assignment.id));
end;
$$;

revoke all on function public.transition_job_assignment_with_event(uuid, text, timestamptz, text, boolean) from public, anon;
grant execute on function public.transition_job_assignment_with_event(uuid, text, timestamptz, text, boolean) to authenticated;

comment on function public.transition_job_assignment_with_event(uuid, text, timestamptz, text, boolean) is
  'Driver-owned or permissioned manager job execution transition with stale-write protection and fleet event/audit creation.';

commit;
