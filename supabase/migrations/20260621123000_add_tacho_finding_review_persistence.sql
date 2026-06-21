begin;

create table if not exists public.tachograph_finding_reviews (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null unique references public.tachograph_findings(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  driver_id uuid null references public.profiles(id) on delete set null,
  import_id uuid not null references public.tachograph_files(id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'reviewed', 'action_required', 'closed')),
  manager_note text null,
  corrective_action_type text null
    check (corrective_action_type is null or corrective_action_type in ('training', 'manager_debrief', 'manual_entry', 'other')),
  corrective_action_ref_id uuid null,
  reviewed_at timestamptz null,
  reviewed_by_user_id uuid null references public.profiles(id) on delete set null,
  closed_at timestamptz null,
  closed_by_user_id uuid null references public.profiles(id) on delete set null,
  driver_acknowledged_at timestamptz null,
  driver_acknowledged_by_user_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tachograph_finding_review_events (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.tachograph_finding_reviews(id) on delete cascade,
  finding_id uuid not null references public.tachograph_findings(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid null references public.profiles(id) on delete set null,
  event_type text not null check (event_type in ('created', 'updated', 'driver_acknowledged')),
  previous_status text null,
  new_status text not null,
  note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tachograph_finding_reviews_company_driver
  on public.tachograph_finding_reviews(company_id, driver_id, updated_at desc);

create index if not exists idx_tachograph_finding_reviews_import
  on public.tachograph_finding_reviews(import_id, updated_at desc);

create index if not exists idx_tachograph_finding_review_events_review
  on public.tachograph_finding_review_events(review_id, created_at desc);

alter table public.tachograph_finding_reviews enable row level security;
alter table public.tachograph_finding_review_events enable row level security;

drop policy if exists "Managers can read company tacho finding reviews" on public.tachograph_finding_reviews;
create policy "Managers can read company tacho finding reviews"
  on public.tachograph_finding_reviews
  for select
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'manager'
  );

drop policy if exists "Drivers can read own tacho finding reviews" on public.tachograph_finding_reviews;
create policy "Drivers can read own tacho finding reviews"
  on public.tachograph_finding_reviews
  for select
  to authenticated
  using (
    driver_id = auth.uid()
    and public.get_my_role() = 'driver'
  );

drop policy if exists "Managers can read company tacho review events" on public.tachograph_finding_review_events;
create policy "Managers can read company tacho review events"
  on public.tachograph_finding_review_events
  for select
  to authenticated
  using (
    company_id = public.get_my_company_id()
    and public.get_my_role() = 'manager'
  );

drop policy if exists "Drivers can read own tacho review events" on public.tachograph_finding_review_events;
create policy "Drivers can read own tacho review events"
  on public.tachograph_finding_review_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tachograph_finding_reviews r
      where r.id = tachograph_finding_review_events.review_id
        and r.driver_id = auth.uid()
    )
    and public.get_my_role() = 'driver'
  );

grant select on public.tachograph_finding_reviews to authenticated;
grant select on public.tachograph_finding_review_events to authenticated;

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
  finding_record public.tachograph_findings%rowtype;
  existing_review public.tachograph_finding_reviews%rowtype;
  saved_review public.tachograph_finding_reviews%rowtype;
  normalized_status text := lower(btrim(coalesce(p_status, 'open')));
  normalized_action text := nullif(lower(btrim(coalesce(p_corrective_action_type, ''))), '');
  event_type text := 'updated';
begin
  if public.get_my_role() is distinct from 'manager'
     or public.get_my_company_id() is distinct from p_company_id then
    raise exception 'Only a manager can review tachograph findings for their own company';
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
    and company_id = p_company_id;

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
    p_company_id,
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

grant execute on function public.save_tachograph_finding_review(uuid, uuid, text, text, text, uuid) to authenticated;

commit;
