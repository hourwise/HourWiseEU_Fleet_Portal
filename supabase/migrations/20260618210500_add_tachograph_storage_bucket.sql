-- Private storage bucket for browser-assisted tachograph imports.
-- Object paths are scoped as: {company_id}/{timestamp}_{filename}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tachograph-files',
  'tachograph-files',
  false,
  104857600,
  array['application/octet-stream']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Managers can upload tachograph files" on storage.objects;
drop policy if exists "Managers can read tachograph files" on storage.objects;
drop policy if exists "Managers can update tachograph files" on storage.objects;
drop policy if exists "Managers can delete tachograph files" on storage.objects;

create policy "Managers can upload tachograph files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tachograph-files'
    and (storage.foldername(name))[1] in (
      select company_id::text
      from public.profiles
      where id = (select auth.uid())
        and role = 'manager'
    )
  );

create policy "Managers can read tachograph files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tachograph-files'
    and (storage.foldername(name))[1] in (
      select company_id::text
      from public.profiles
      where id = (select auth.uid())
        and role = 'manager'
    )
  );

create policy "Managers can update tachograph files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'tachograph-files'
    and (storage.foldername(name))[1] in (
      select company_id::text
      from public.profiles
      where id = (select auth.uid())
        and role = 'manager'
    )
  )
  with check (
    bucket_id = 'tachograph-files'
    and (storage.foldername(name))[1] in (
      select company_id::text
      from public.profiles
      where id = (select auth.uid())
        and role = 'manager'
    )
  );

create policy "Managers can delete tachograph files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tachograph-files'
    and (storage.foldername(name))[1] in (
      select company_id::text
      from public.profiles
      where id = (select auth.uid())
        and role = 'manager'
    )
  );
