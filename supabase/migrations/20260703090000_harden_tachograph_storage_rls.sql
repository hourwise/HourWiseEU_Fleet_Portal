-- SEC-002: harden raw tachograph evidence storage and import metadata access.
-- Raw tachograph objects are immutable evidence; normal authenticated users may
-- insert/read scoped objects but must not update or delete storage objects.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tachograph-files',
  'tachograph-files',
  false,
  104857600,
  array['application/octet-stream']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.tachograph_files enable row level security;

create or replace function public.enforce_tachograph_files_raw_identity_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') in ('service_role', 'supabase_admin') then
    return new;
  end if;

  if old.company_id is distinct from new.company_id
    or old.file_path is distinct from new.file_path
    or old.filename is distinct from new.filename
    or old.file_type is distinct from new.file_type
    or old.uploaded_at is distinct from new.uploaded_at
    or old.source_type is distinct from new.source_type then
    raise exception 'Raw tachograph evidence identity fields are immutable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_tachograph_files_raw_identity_immutability on public.tachograph_files;

create trigger enforce_tachograph_files_raw_identity_immutability
before update on public.tachograph_files
for each row
execute function public.enforce_tachograph_files_raw_identity_immutability();

drop policy if exists "Managers can upload tachograph files" on storage.objects;
drop policy if exists "Managers can read tachograph files" on storage.objects;
drop policy if exists "Managers can update tachograph files" on storage.objects;
drop policy if exists "Managers can delete tachograph files" on storage.objects;
drop policy if exists "Managers can insert own company tachograph objects" on storage.objects;
drop policy if exists "Managers can read own company tachograph objects" on storage.objects;

create policy "Managers can insert own company tachograph objects"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tachograph-files'
    and public.get_my_role() = 'manager'
    and (storage.foldername(name))[1] = public.get_my_company_id()::text
  );

create policy "Managers can read own company tachograph objects"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tachograph-files'
    and public.get_my_role() = 'manager'
    and (storage.foldername(name))[1] = public.get_my_company_id()::text
  );

drop policy if exists "Managers can view company tacho files" on public.tachograph_files;
drop policy if exists "Managers can insert own company tachograph metadata" on public.tachograph_files;
drop policy if exists "Managers can read own company tachograph metadata" on public.tachograph_files;
drop policy if exists "Managers can update own company tachograph metadata" on public.tachograph_files;

create policy "Managers can insert own company tachograph metadata"
  on public.tachograph_files for insert
  to authenticated
  with check (
    public.get_my_role() = 'manager'
    and company_id = public.get_my_company_id()
    and split_part(file_path, '/', 1) = company_id::text
  );

create policy "Managers can read own company tachograph metadata"
  on public.tachograph_files for select
  to authenticated
  using (
    public.get_my_role() = 'manager'
    and company_id = public.get_my_company_id()
  );

create or replace function public.patch_tachograph_import_metadata(
  p_import_id uuid,
  p_metadata_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_metadata jsonb;
begin
  if public.get_my_role() <> 'manager' then
    raise exception 'Only managers can patch tachograph import metadata'
      using errcode = '42501';
  end if;

  update public.tachograph_files
  set metadata = jsonb_strip_nulls(coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata_patch, '{}'::jsonb))
  where id = p_import_id
    and company_id = public.get_my_company_id()
  returning metadata into updated_metadata;

  if updated_metadata is null then
    raise exception 'Tachograph import not found for current company'
      using errcode = '42501';
  end if;

  return updated_metadata;
end;
$$;

revoke all on function public.patch_tachograph_import_metadata(uuid, jsonb) from public;
revoke all on function public.patch_tachograph_import_metadata(uuid, jsonb) from anon;
grant execute on function public.patch_tachograph_import_metadata(uuid, jsonb) to authenticated;
