-- Batch 25: one manager-scoped planning read and bounded, idempotent bulk staffing.
-- Existing template, rota, shift, job and availability records are not modified.

create table if not exists public.planning_bulk_assignment_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_key uuid not null,
  result jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (company_id, request_key)
);

alter table public.planning_bulk_assignment_requests enable row level security;
revoke all on table public.planning_bulk_assignment_requests from public, anon, authenticated;

create or replace function public.get_planning_workspace_snapshot(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can view the planning workspace' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception 'The visible planning period must be between 1 and 63 days' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'templates', coalesce((
      select jsonb_agg(to_jsonb(rt) order by rt.name)
      from public.rota_templates rt
      where rt.company_id = actor_company_id and rt.active
    ), '[]'::jsonb),
    'template_slots', coalesce((
      select jsonb_agg(to_jsonb(rts) order by rts.template_id, rts.cycle_day, rts.sort_order, rts.id)
      from public.rota_template_slots rts
      join public.rota_templates rt on rt.id = rts.template_id
      where rts.company_id = actor_company_id and rt.active
    ), '[]'::jsonb),
    'slots', coalesce((
      select jsonb_agg(to_jsonb(rs) order by rs.slot_date, rs.start_time, rs.role_label)
      from public.rota_slots rs
      where rs.company_id = actor_company_id and rs.slot_date between p_from and p_to and rs.status <> 'cancelled'
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(rsa) order by rsa.created_at)
      from public.rota_slot_assignments rsa
      join public.rota_slots rs on rs.id = rsa.slot_id
      where rsa.company_id = actor_company_id and rs.slot_date between p_from and p_to and rsa.status <> 'cancelled'
    ), '[]'::jsonb),
    'availability', coalesce((
      select jsonb_agg(to_jsonb(sa) order by sa.starts_on, sa.driver_id)
      from public.staff_availability sa
      where sa.company_id = actor_company_id and sa.starts_on <= p_to and sa.ends_on >= p_from
    ), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(to_jsonb(pr) order by pr.run_date, pr.start_time, pr.run_label)
      from public.planned_runs pr
      where pr.company_id = actor_company_id and pr.run_date between p_from and p_to and pr.status <> 'cancelled'
    ), '[]'::jsonb),
    'run_jobs', coalesce((
      select jsonb_agg(to_jsonb(prj) order by prj.planned_run_id, prj.sequence)
      from public.planned_run_jobs prj
      join public.planned_runs pr on pr.id = prj.planned_run_id
      where prj.company_id = actor_company_id and pr.run_date between p_from and p_to and prj.status <> 'cancelled'
    ), '[]'::jsonb),
    'leave_policies', coalesce((
      select jsonb_agg(to_jsonb(lcp) order by lcp.role_label, lcp.availability_type)
      from public.leave_capacity_policies lcp
      where lcp.company_id = actor_company_id and lcp.active
    ), '[]'::jsonb),
    'driver_planning_profiles', coalesce((
      select jsonb_agg(to_jsonb(dpp) order by dpp.driver_id)
      from public.driver_planning_profiles dpp
      where dpp.company_id = actor_company_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_planning_recorded_work_summary(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can view recorded work for planning' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception 'The visible planning period must be between 1 and 63 days' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', ws.user_id,
      'date', ws.date,
      'start_time', ws.start_time,
      'end_time', ws.end_time,
      'total_work_minutes', ws.total_work_minutes
    ) order by ws.date, ws.start_time, ws.user_id)
    from public.work_sessions ws
    join public.profiles driver on driver.id = ws.user_id
    where driver.company_id = actor_company_id
      and driver.role = 'driver'
      and ws.date between p_from and p_to
  ), '[]'::jsonb);
end;
$$;

create or replace function public.bulk_assign_rota_positions(
  p_items jsonb,
  p_request_key uuid,
  p_commit boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  cached jsonb;
  item jsonb;
  slot_record public.rota_slots%rowtype;
  driver_id uuid;
  slot_id uuid;
  outcome jsonb := '[]'::jsonb;
  status text;
  reason text;
  assignment_result jsonb;
  filled integer;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can fill rota positions' using errcode = '42501';
  end if;
  if p_request_key is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 500 then
    raise exception 'Choose between 1 and 500 driver and duty combinations' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_company_id::text || ':' || p_request_key::text, 0));
  if p_commit then
    select request.result into cached
    from public.planning_bulk_assignment_requests request
    where request.company_id = actor_company_id and request.request_key = p_request_key;
    if cached is not null then
      return cached || jsonb_build_object('replayed', true);
    end if;
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    status := 'READY';
    reason := 'Ready';
    assignment_result := null;
    begin
      slot_id := (item ->> 'slot_id')::uuid;
      driver_id := (item ->> 'driver_id')::uuid;
    exception when others then
      slot_id := null;
      driver_id := null;
      status := 'UNAVAILABLE';
      reason := 'Driver or duty is not available';
    end;

    select * into slot_record
    from public.rota_slots rs
    where rs.id = slot_id and rs.company_id = actor_company_id and rs.status <> 'cancelled'
    for update;

    if slot_record.id is null or not exists (
      select 1 from public.profiles p
      where p.id = driver_id and p.company_id = actor_company_id and p.role = 'driver'
    ) then
      status := 'UNAVAILABLE'; reason := 'Driver or duty is not available';
    elsif exists (
      select 1 from public.rota_slot_assignments rsa
      where rsa.slot_id = slot_id and rsa.driver_id = driver_id and rsa.status <> 'cancelled'
    ) then
      status := 'CONFLICT'; reason := 'Already assigned';
    elsif exists (
      select 1 from public.staff_availability sa
      where sa.company_id = actor_company_id and sa.driver_id = driver_id
        and sa.starts_on <= slot_record.slot_date and sa.ends_on >= slot_record.slot_date
    ) then
      status := 'UNAVAILABLE'; reason := 'Holiday or other absence';
    else
      select count(*) into filled from public.rota_slot_assignments rsa
      where rsa.slot_id = slot_id and rsa.status <> 'cancelled';
      if filled >= slot_record.required_headcount then
        status := 'UNAVAILABLE'; reason := 'No vacancy remains';
      elsif exists (
        select 1
        from public.rota_slot_assignments rsa
        join public.rota_slots occupied on occupied.id = rsa.slot_id
        where rsa.company_id = actor_company_id and rsa.driver_id = driver_id and rsa.status <> 'cancelled'
          and tsrange(
            occupied.slot_date + occupied.start_time,
            occupied.slot_date + occupied.end_time + case when occupied.end_time <= occupied.start_time then interval '1 day' else interval '0' end,
            '[)'
          ) && tsrange(
            slot_record.slot_date + slot_record.start_time,
            slot_record.slot_date + slot_record.end_time + case when slot_record.end_time <= slot_record.start_time then interval '1 day' else interval '0' end,
            '[)'
          )
      ) then
        status := 'CONFLICT'; reason := 'Overlaps another duty';
      elsif coalesce((
        select dpp.regulatory_regime
        from public.driver_planning_profiles dpp
        where dpp.company_id = actor_company_id and dpp.driver_id = driver_id
      ), 'unknown') = 'unknown' then
        status := 'NEEDS_REVIEW'; reason := 'Rules need confirming';
      end if;
    end if;

    if p_commit and status in ('READY', 'NEEDS_REVIEW') then
      begin
        assignment_result := public.assign_rota_position(slot_id, driver_id, null, null, slot_record.updated_at);
      exception
        when unique_violation then status := 'CONFLICT'; reason := 'Already assigned';
        when check_violation then status := 'UNAVAILABLE'; reason := 'No vacancy remains';
        when others then status := 'CONFLICT'; reason := 'This item changed; refresh and review it';
      end;
    end if;

    outcome := outcome || jsonb_build_array(jsonb_build_object(
      'slot_id', slot_id,
      'driver_id', driver_id,
      'status', status,
      'reason', reason,
      'assignment_id', assignment_result ->> 'assignment_id'
    ));
  end loop;

  cached := jsonb_build_object(
    'items', outcome,
    'committed', p_commit,
    'replayed', false,
    'summary', jsonb_build_object(
      'ready', (select count(*) from jsonb_array_elements(outcome) item_result where item_result ->> 'status' = 'READY'),
      'needs_review', (select count(*) from jsonb_array_elements(outcome) item_result where item_result ->> 'status' = 'NEEDS_REVIEW'),
      'unavailable', (select count(*) from jsonb_array_elements(outcome) item_result where item_result ->> 'status' = 'UNAVAILABLE'),
      'conflict', (select count(*) from jsonb_array_elements(outcome) item_result where item_result ->> 'status' = 'CONFLICT')
    )
  );

  if p_commit then
    insert into public.planning_bulk_assignment_requests(company_id, request_key, result, created_by)
    values (actor_company_id, p_request_key, cached, actor_id);
  end if;
  return cached;
end;
$$;

revoke all on function public.get_planning_workspace_snapshot(date, date) from public, anon;
revoke all on function public.get_planning_recorded_work_summary(date, date) from public, anon;
revoke all on function public.bulk_assign_rota_positions(jsonb, uuid, boolean) from public, anon;
grant execute on function public.get_planning_workspace_snapshot(date, date) to authenticated;
grant execute on function public.get_planning_recorded_work_summary(date, date) to authenticated;
grant execute on function public.bulk_assign_rota_positions(jsonb, uuid, boolean) to authenticated;

comment on function public.get_planning_workspace_snapshot(date, date) is
  'Bounded manager-only weekly core planning snapshot.';
comment on function public.get_planning_recorded_work_summary(date, date) is
  'Bounded manager-only work summaries scoped through the drivers company profile membership.';
comment on function public.bulk_assign_rota_positions(jsonb, uuid, boolean) is
  'Evaluates and optionally commits up to 500 company-scoped rota assignments with idempotent request replay.';
