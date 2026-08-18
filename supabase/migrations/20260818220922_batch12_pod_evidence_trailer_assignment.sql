-- Batch 12: governed POD evidence and explicit trailer assignment.
-- Evidence is deliberately separate from lifecycle state: recording proof never
-- changes job_assignments.status.

alter table public.job_assignments
  add column if not exists trailer_id uuid references public.vehicles(id) on delete set null;

create index if not exists job_assignments_trailer_idx
  on public.job_assignments(company_id, trailer_id, planned_arrival_at);

create table if not exists public.job_evidence (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_assignment_id uuid not null references public.job_assignments(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('pod', 'delivery_note', 'failed_delivery', 'unable_to_complete', 'damage', 'other')),
  outcome text not null check (outcome in ('delivered', 'failed_delivery', 'unable_to_complete', 'unknown')),
  storage_bucket text not null default 'pod-evidence' check (storage_bucket = 'pod-evidence'),
  storage_path text not null,
  source text not null default 'portal_upload' check (source in ('portal_upload', 'mobile_camera', 'mobile_file')),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  review_status text not null default 'pending' check (review_status in ('pending', 'accepted', 'rejected', 'needs_follow_up')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_evidence_assignment_idx on public.job_evidence(company_id, job_assignment_id, uploaded_at desc);
create index if not exists job_evidence_review_idx on public.job_evidence(company_id, review_status, uploaded_at desc);

alter table public.job_evidence enable row level security;

drop policy if exists "Managers can review company job evidence" on public.job_evidence;
create policy "Managers can review company job evidence"
  on public.job_evidence for select to authenticated
  using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');

drop policy if exists "Drivers can view own assignment evidence" on public.job_evidence;
create policy "Drivers can view own assignment evidence"
  on public.job_evidence for select to authenticated
  using (
    exists (
      select 1
      from public.job_assignments ja
      where ja.id = job_evidence.job_assignment_id
        and ja.job_id = job_evidence.job_id
        and ja.company_id = job_evidence.company_id
        and ja.driver_id = auth.uid()
    )
  );

-- No direct client INSERT/UPDATE/DELETE policy is intentional. The RPCs below
-- derive actor/company/uploader identity from auth.uid() and validate scope.
revoke all on table public.job_evidence from anon, authenticated;
grant select on table public.job_evidence to authenticated;

insert into storage.buckets (id, name, public)
values ('pod-evidence', 'pod-evidence', false)
on conflict (id) do update set public = false;

drop policy if exists "POD evidence objects can be uploaded in company scope" on storage.objects;
create policy "POD evidence objects can be uploaded in company scope"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pod-evidence'
    and exists (
      select 1
      from public.job_assignments ja
      where ja.id::text = split_part(name, '/', 2)
        and ja.company_id::text = split_part(name, '/', 1)
        and (
          ja.driver_id = auth.uid()
          or (public.get_my_role() = 'manager' and ja.company_id = public.get_my_company_id())
        )
    )
  );

drop policy if exists "POD evidence objects can be read in company scope" on storage.objects;
create policy "POD evidence objects can be read in company scope"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pod-evidence'
    and exists (
      select 1
      from public.job_assignments ja
      where ja.id::text = split_part(name, '/', 2)
        and ja.company_id::text = split_part(name, '/', 1)
        and (
          ja.driver_id = auth.uid()
          or (public.get_my_role() = 'manager' and ja.company_id = public.get_my_company_id())
        )
    )
  );

create or replace function public.create_job_evidence(
  p_job_assignment_id uuid,
  p_evidence_type text,
  p_outcome text,
  p_storage_path text,
  p_source text default 'portal_upload',
  p_metadata jsonb default '{}'::jsonb
)
returns public.job_evidence
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  target_assignment public.job_assignments%rowtype;
  created_evidence public.job_evidence;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if p_evidence_type not in ('pod', 'delivery_note', 'failed_delivery', 'unable_to_complete', 'damage', 'other') then
    raise exception 'Unsupported evidence type' using errcode = '22023';
  end if;
  if p_outcome not in ('delivered', 'failed_delivery', 'unable_to_complete', 'unknown') then
    raise exception 'Unsupported evidence outcome' using errcode = '22023';
  end if;
  if p_source not in ('portal_upload', 'mobile_camera', 'mobile_file') then
    raise exception 'Unsupported evidence source' using errcode = '22023';
  end if;
  if nullif(btrim(p_storage_path), '') is null
     or p_storage_path !~ ('^' || actor_company_id::text || '/[0-9a-fA-F-]{36}/[^/]+$') then
    raise exception 'Evidence storage path is outside the company assignment scope' using errcode = '22023';
  end if;

  select * into target_assignment
  from public.job_assignments
  where id = p_job_assignment_id and company_id = actor_company_id
  for update;
  if target_assignment.id is null then raise exception 'Job assignment not found for this company' using errcode = '42501'; end if;
  if not (
    target_assignment.driver_id = actor_id
    or public.get_my_role() = 'manager'
  ) then
    raise exception 'Actor is not authorised for this job evidence' using errcode = '42501';
  end if;
  if target_assignment.status in ('draft', 'cancelled') then
    raise exception 'Evidence cannot be recorded for a draft or cancelled assignment' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'pod-evidence'
      and name = p_storage_path
      and owner_id = actor_id
  ) then
    raise exception 'Evidence object was not uploaded by the authenticated actor' using errcode = '42501';
  end if;

  insert into public.job_evidence (
    company_id, job_id, job_assignment_id, evidence_type, outcome,
    storage_path, source, uploaded_by, metadata
  ) values (
    actor_company_id, target_assignment.job_id, target_assignment.id,
    p_evidence_type, p_outcome, p_storage_path, p_source, actor_id,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning * into created_evidence;

  perform public.record_security_event(
    actor_company_id, null, 'operations.job.evidence', 'allowed', 'job_evidence_uploaded',
    'job_assignment', target_assignment.id, 'upload', null,
    jsonb_build_object('job_evidence_id', created_evidence.id, 'job_id', target_assignment.job_id, 'evidence_type', p_evidence_type, 'outcome', p_outcome), 'user'
  );
  return created_evidence;
end;
$$;

create or replace function public.review_job_evidence(
  p_evidence_id uuid,
  p_review_status text,
  p_review_notes text default null,
  p_expected_updated_at timestamptz default null
)
returns public.job_evidence
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  current_evidence public.job_evidence;
  reviewed_evidence public.job_evidence;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can review job evidence' using errcode = '42501';
  end if;
  if p_review_status not in ('accepted', 'rejected', 'needs_follow_up') then
    raise exception 'Unsupported evidence review status' using errcode = '22023';
  end if;
  if p_review_notes is not null and length(p_review_notes) > 2000 then
    raise exception 'Evidence review notes are limited to 2000 characters' using errcode = '22023';
  end if;
  select * into current_evidence from public.job_evidence
  where id = p_evidence_id and company_id = actor_company_id for update;
  if current_evidence.id is null then raise exception 'Job evidence not found for this company' using errcode = '42501'; end if;
  if p_expected_updated_at is not null and current_evidence.updated_at is distinct from p_expected_updated_at then
    raise exception 'Evidence changed since it was loaded; refresh before reviewing' using errcode = '40001';
  end if;

  update public.job_evidence
  set review_status = p_review_status,
      reviewed_by = actor_id,
      reviewed_at = now(),
      review_notes = nullif(btrim(coalesce(p_review_notes, '')), ''),
      updated_at = now()
  where id = current_evidence.id
  returning * into reviewed_evidence;

  perform public.record_security_event(
    actor_company_id, null, 'operations.job.evidence.review', 'allowed', 'job_evidence_reviewed',
    'job_assignment', current_evidence.job_assignment_id, 'review', null,
    jsonb_build_object('job_evidence_id', current_evidence.id, 'review_status', p_review_status), 'user'
  );
  return reviewed_evidence;
end;
$$;

create or replace function public.assign_trailer_to_job_assignment(
  p_assignment_id uuid,
  p_trailer_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  target_assignment public.job_assignments%rowtype;
  trailer_record public.vehicles%rowtype;
  policy jsonb;
  event_id uuid;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can assign a trailer' using errcode = '42501';
  end if;
  select * into target_assignment from public.job_assignments
  where id = p_assignment_id and company_id = actor_company_id for update;
  if target_assignment.id is null then raise exception 'Job assignment not found for this company' using errcode = '42501'; end if;
  if p_expected_updated_at is null or target_assignment.updated_at is distinct from p_expected_updated_at then
    raise exception 'Assignment changed since it was loaded; refresh before assigning a trailer' using errcode = '40001';
  end if;
  if p_trailer_id is not null then
    select * into trailer_record from public.vehicles where id = p_trailer_id and company_id = actor_company_id for update;
    if trailer_record.id is null then raise exception 'Trailer not found for this company' using errcode = '42501'; end if;
    if lower(coalesce(trailer_record.vehicle_class, '')) <> 'trailer'
       and lower(coalesce(trailer_record.vehicle_type, '')) <> 'trailer' then
      raise exception 'Selected asset is not recorded as a trailer' using errcode = '22023';
    end if;
    policy := public.get_asset_assignment_policy(actor_company_id, p_trailer_id);
    if coalesce((policy ->> 'hard_block')::boolean, true) or (policy ->> 'status') = 'prohibited' then
      raise exception 'Trailer assignment prohibited: %', policy -> 'reasons' using errcode = '42501';
    end if;
    if (policy ->> 'status') in ('unknown', 'action_required') and not exists (
      select 1 from public.asset_assignment_overrides o
      where o.company_id = actor_company_id and o.shift_id = target_assignment.shift_id
        and o.vehicle_id = p_trailer_id and o.revoked_at is null
    ) then
      raise exception 'Trailer assignment requires a recorded readiness override: %', policy -> 'reasons' using errcode = '42501';
    end if;
  end if;
  update public.job_assignments set trailer_id = p_trailer_id, updated_at = now() where id = target_assignment.id;
  insert into public.fleet_events (company_id, event_type, priority, actor_id, recipient_driver_id, related_shift_id, title, body, payload, requires_ack)
  values (
    actor_company_id, 'job_trailer_assigned', 'advisory', actor_id, target_assignment.driver_id, target_assignment.shift_id,
    case when p_trailer_id is null then 'Trailer removed from job' else 'Trailer assigned to job' end,
    case when p_trailer_id is null then 'The planned trailer was removed from the assignment.' else 'A trailer was assigned to this job; review the current route plan.' end,
    jsonb_build_object('job_assignment_id', target_assignment.id, 'job_id', target_assignment.job_id, 'trailer_id', p_trailer_id), true
  ) returning id into event_id;
  perform public.record_security_event(actor_company_id, null, 'operations.job.trailer_assign', 'allowed', 'job_trailer_assigned', 'job_assignment', target_assignment.id, 'assign', null, jsonb_build_object('trailer_id', p_trailer_id, 'event_id', event_id), 'user');
  return jsonb_build_object('job_assignment_id', target_assignment.id, 'trailer_id', p_trailer_id, 'event_id', event_id, 'updated_at', (select updated_at from public.job_assignments where id = target_assignment.id));
end;
$$;

create or replace function public.enforce_trailer_assignment_readiness()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  policy jsonb;
  has_override boolean;
begin
  if new.trailer_id is null then return new; end if;
  policy := public.get_asset_assignment_policy(new.company_id, new.trailer_id);
  if coalesce((policy ->> 'hard_block')::boolean, true) or (policy ->> 'status') = 'prohibited' then
    raise exception 'Trailer assignment prohibited: %', policy -> 'reasons' using errcode = '42501';
  end if;
  if (policy ->> 'status') in ('unknown', 'action_required') then
    select exists (
      select 1 from public.asset_assignment_overrides o
      where o.company_id = new.company_id and o.shift_id = new.shift_id
        and o.vehicle_id = new.trailer_id and o.revoked_at is null
    ) into has_override;
    if not has_override then raise exception 'Trailer assignment requires a recorded readiness override: %', policy -> 'reasons' using errcode = '42501'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_job_trailer_assignment_readiness on public.job_assignments;
create trigger enforce_job_trailer_assignment_readiness
before insert or update of trailer_id, shift_id, company_id on public.job_assignments
for each row execute function public.enforce_trailer_assignment_readiness();

revoke all on function public.create_job_evidence(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_job_evidence(uuid, text, text, text, text, jsonb) to authenticated;
revoke all on function public.review_job_evidence(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.review_job_evidence(uuid, text, text, timestamptz) to authenticated;
revoke all on function public.assign_trailer_to_job_assignment(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.assign_trailer_to_job_assignment(uuid, uuid, timestamptz) to authenticated;

comment on table public.job_evidence is 'Protected proof tied to a real job assignment. Evidence provenance and review are separate from lifecycle completion.';
comment on function public.assign_trailer_to_job_assignment(uuid, uuid, timestamptz) is 'Manager-only same-company trailer assignment with canonical asset readiness enforcement.';
