-- Batch 13: close the POD upload-orphan gap without adding client delete power.
-- The client must obtain an intent before it can upload. Finalization records
-- evidence and cleanup is limited to the same actor's recent pending intent.

create table if not exists public.job_evidence_upload_intents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_assignment_id uuid not null references public.job_assignments(id) on delete cascade,
  storage_bucket text not null default 'pod-evidence' check (storage_bucket = 'pod-evidence'),
  storage_path text not null unique,
  original_file_name text not null check (length(btrim(original_file_name)) between 1 and 255),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'finalized', 'cleaned', 'expired')),
  evidence_id uuid references public.job_evidence(id) on delete set null,
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  finalized_at timestamptz,
  cleaned_at timestamptz,
  cleanup_reason text check (cleanup_reason is null or length(btrim(cleanup_reason)) <= 1000),
  updated_at timestamptz not null default now()
);

create index if not exists job_evidence_upload_intents_actor_status_idx
  on public.job_evidence_upload_intents(company_id, uploaded_by, status, created_at desc);

alter table public.job_evidence_upload_intents enable row level security;
drop policy if exists "Managers can view company POD upload intents" on public.job_evidence_upload_intents;
create policy "Managers can view company POD upload intents"
  on public.job_evidence_upload_intents for select to authenticated
  using (company_id = public.get_my_company_id() and public.get_my_role() = 'manager');
drop policy if exists "Uploaders can view own POD upload intents" on public.job_evidence_upload_intents;
create policy "Uploaders can view own POD upload intents"
  on public.job_evidence_upload_intents for select to authenticated
  using (uploaded_by = auth.uid() and company_id = public.get_my_company_id());

revoke insert, update, delete on public.job_evidence_upload_intents from public, anon, authenticated;
grant select on public.job_evidence_upload_intents to authenticated;

-- Replace the Batch 12 broad assignment-path INSERT policy. Reads remain
-- assignment/company scoped, while writes require a server-created intent.
drop policy if exists "POD evidence objects can be uploaded in company scope" on storage.objects;
create policy "POD evidence objects require an upload intent"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pod-evidence'
    and exists (
      select 1
      from public.job_evidence_upload_intents intent
      join public.job_assignments ja on ja.id = intent.job_assignment_id
      where intent.storage_bucket = 'pod-evidence'
        and intent.storage_path = name
        and intent.status = 'pending'
        and intent.uploaded_by = auth.uid()
        and intent.company_id = public.get_my_company_id()
        and ja.company_id = intent.company_id
        and ja.job_id = intent.job_id
        and (
          ja.driver_id = auth.uid()
          or public.get_my_role() = 'manager'
        )
    )
  );

create or replace function public.begin_job_evidence_upload(
  p_job_assignment_id uuid,
  p_original_file_name text
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
  safe_file_name text;
  intent public.job_evidence_upload_intents;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_original_file_name), '') is null or length(p_original_file_name) > 255 or p_original_file_name ~ '[\\/]' then
    raise exception 'Invalid evidence file name' using errcode = '22023';
  end if;
  select * into target_assignment
  from public.job_assignments
  where id = p_job_assignment_id and company_id = actor_company_id
  for update;
  if target_assignment.id is null then raise exception 'Job assignment not found for this company' using errcode = '42501'; end if;
  if target_assignment.status in ('draft', 'cancelled') then raise exception 'Evidence cannot be uploaded for a draft or cancelled assignment' using errcode = '22023'; end if;
  if target_assignment.driver_id is distinct from actor_id and public.get_my_role() is distinct from 'manager' then
    raise exception 'Actor is not authorised for this job evidence upload' using errcode = '42501';
  end if;

  safe_file_name := left(regexp_replace(lower(btrim(p_original_file_name)), '[^a-z0-9._-]+', '-', 'g'), 180);
  if nullif(safe_file_name, '') is null then safe_file_name := 'evidence'; end if;
  insert into public.job_evidence_upload_intents (
    company_id, job_id, job_assignment_id, storage_path, original_file_name, uploaded_by
  ) values (
    actor_company_id, target_assignment.job_id, target_assignment.id,
    actor_company_id::text || '/' || target_assignment.id::text || '/' || gen_random_uuid()::text || '-' || safe_file_name,
    btrim(p_original_file_name), actor_id
  ) returning * into intent;

  perform public.record_security_event(actor_company_id, null, 'operations.job.evidence', 'allowed', 'job_evidence_upload_intent_created', 'job_assignment', target_assignment.id, 'upload_intent', null, jsonb_build_object('upload_intent_id', intent.id, 'storage_path', intent.storage_path), 'user');
  return jsonb_build_object('id', intent.id, 'company_id', intent.company_id, 'job_id', intent.job_id, 'job_assignment_id', intent.job_assignment_id, 'storage_bucket', intent.storage_bucket, 'storage_path', intent.storage_path, 'status', intent.status);
end;
$$;

create or replace function public.finalize_job_evidence_upload(
  p_upload_intent_id uuid,
  p_evidence_type text,
  p_outcome text,
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
  intent public.job_evidence_upload_intents;
  created_evidence public.job_evidence;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  select * into intent from public.job_evidence_upload_intents
  where id = p_upload_intent_id and company_id = actor_company_id and uploaded_by = actor_id
  for update;
  if intent.id is null then raise exception 'POD upload intent not found for this actor and company' using errcode = '42501'; end if;
  if intent.status <> 'pending' then raise exception 'POD upload intent is no longer pending' using errcode = '22023'; end if;
  if intent.created_at < now() - interval '2 hours' then raise exception 'POD upload intent has expired; start a new upload' using errcode = '22023'; end if;
  if p_evidence_type not in ('pod', 'delivery_note', 'failed_delivery', 'unable_to_complete', 'damage', 'other') then raise exception 'Unsupported evidence type' using errcode = '22023'; end if;
  if p_outcome not in ('delivered', 'failed_delivery', 'unable_to_complete', 'unknown') then raise exception 'Unsupported evidence outcome' using errcode = '22023'; end if;
  if p_source not in ('portal_upload', 'mobile_camera', 'mobile_file') then raise exception 'Unsupported evidence source' using errcode = '22023'; end if;
  if not exists (select 1 from storage.objects where bucket_id = intent.storage_bucket and name = intent.storage_path and owner_id = actor_id) then
    raise exception 'POD object was not uploaded by the authenticated actor' using errcode = '42501';
  end if;

  insert into public.job_evidence (
    company_id, job_id, job_assignment_id, evidence_type, outcome, storage_bucket, storage_path, source, uploaded_by, metadata
  ) values (
    intent.company_id, intent.job_id, intent.job_assignment_id, p_evidence_type, p_outcome, intent.storage_bucket, intent.storage_path, p_source, actor_id, coalesce(p_metadata, '{}'::jsonb)
  ) returning * into created_evidence;

  update public.job_evidence_upload_intents
  set status = 'finalized', evidence_id = created_evidence.id, uploaded_at = now(), finalized_at = now(), updated_at = now()
  where id = intent.id;
  perform public.record_security_event(actor_company_id, null, 'operations.job.evidence', 'allowed', 'job_evidence_registered', 'job_assignment', intent.job_assignment_id, 'finalize_upload', null, jsonb_build_object('upload_intent_id', intent.id, 'job_evidence_id', created_evidence.id), 'user');
  return created_evidence;
end;
$$;

create or replace function public.cleanup_failed_job_evidence_upload(
  p_upload_intent_id uuid,
  p_reason text default 'evidence registration failed'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  intent public.job_evidence_upload_intents;
  deleted_object_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null or length(p_reason) > 1000 then raise exception 'A bounded cleanup reason is required' using errcode = '22023'; end if;
  select * into intent from public.job_evidence_upload_intents
  where id = p_upload_intent_id and company_id = actor_company_id and uploaded_by = actor_id
  for update;
  if intent.id is null then raise exception 'POD upload intent not found for this actor and company' using errcode = '42501'; end if;
  if intent.status <> 'pending' then raise exception 'Only a pending failed upload can be cleaned up; registered evidence is retained' using errcode = '22023'; end if;
  if intent.created_at < now() - interval '2 hours' then raise exception 'Only a recent failed upload can be cleaned up' using errcode = '22023'; end if;

  delete from storage.objects
  where bucket_id = intent.storage_bucket and name = intent.storage_path and owner_id = actor_id
  returning id into deleted_object_id;
  update public.job_evidence_upload_intents
  set status = 'cleaned', cleaned_at = now(), cleanup_reason = left(btrim(p_reason), 1000), updated_at = now()
  where id = intent.id;
  perform public.record_security_event(actor_company_id, null, 'operations.job.evidence', 'allowed', 'job_evidence_upload_cleaned', 'job_assignment', intent.job_assignment_id, 'cleanup_upload', null, jsonb_build_object('upload_intent_id', intent.id, 'storage_path', intent.storage_path, 'storage_object_deleted', deleted_object_id is not null, 'reason', left(btrim(p_reason), 1000)), 'user');
  return jsonb_build_object('upload_intent_id', intent.id, 'status', 'cleaned', 'storage_object_deleted', deleted_object_id is not null);
end;
$$;

-- Remove the Batch 12 direct-path RPC from the browser API. The function body
-- remains in migration history for compatibility, but all browser callers use
-- begin -> upload -> finalize and cleanup on failure.
revoke all on function public.create_job_evidence(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.begin_job_evidence_upload(uuid, text) from public, anon;
grant execute on function public.begin_job_evidence_upload(uuid, text) to authenticated;
revoke all on function public.finalize_job_evidence_upload(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.finalize_job_evidence_upload(uuid, text, text, text, jsonb) to authenticated;
revoke all on function public.cleanup_failed_job_evidence_upload(uuid, text) from public, anon;
grant execute on function public.cleanup_failed_job_evidence_upload(uuid, text) to authenticated;

comment on table public.job_evidence_upload_intents is 'Two-phase POD upload intents. Pending objects are cleanable only by their authenticated uploader; finalized evidence is retained.';
comment on function public.cleanup_failed_job_evidence_upload(uuid, text) is 'Uploader-scoped, recent, audited cleanup for a failed POD registration. It cannot delete registered evidence or arbitrary storage objects.';
