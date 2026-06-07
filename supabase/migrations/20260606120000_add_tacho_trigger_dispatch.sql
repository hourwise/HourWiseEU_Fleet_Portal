create extension if not exists pg_net;

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.tacho_processing_runtime (
  singleton boolean primary key default true check (singleton),
  trigger_enabled boolean not null default false,
  process_tacho_url text null,
  trigger_token text null,
  updated_at timestamptz not null default now()
);

insert into private.tacho_processing_runtime (singleton, trigger_enabled)
values (true, false)
on conflict (singleton) do nothing;

create or replace function private.dispatch_tacho_import_processing()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  runtime_config private.tacho_processing_runtime%rowtype;
  upload_origin text;
  request_id bigint;
begin
  if new.status is distinct from 'pending' then
    return new;
  end if;

  upload_origin := coalesce(new.metadata ->> 'upload_origin', '');
  if upload_origin in ('browser_manual', 'browser_assisted') then
    return new;
  end if;

  select *
  into runtime_config
  from private.tacho_processing_runtime
  where singleton is true;

  if not coalesce(runtime_config.trigger_enabled, false)
     or runtime_config.process_tacho_url is null
     or runtime_config.trigger_token is null then
    return new;
  end if;

  begin
    select net.http_post(
      url := runtime_config.process_tacho_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-tacho-trigger-token', runtime_config.trigger_token
      ),
      body := jsonb_build_object(
        'record',
        jsonb_build_object(
          'id', new.id,
          'company_id', new.company_id,
          'driver_id', new.driver_id,
          'vehicle_id', new.vehicle_id,
          'file_path', new.file_path,
          'file_type', new.file_type,
          'filename', new.filename,
          'metadata', coalesce(new.metadata, '{}'::jsonb),
          'source_type', new.source_type
        )
      )
    )
    into request_id;

    update public.tachograph_files
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'trigger_dispatch_request_id', request_id,
      'trigger_dispatch_requested_at', now()
    )
    where id = new.id;
  exception
    when others then
      update public.tachograph_files
      set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'trigger_dispatch_error', sqlerrm,
        'trigger_dispatch_failed_at', now()
      )
      where id = new.id;
  end;

  return new;
end;
$$;

drop trigger if exists dispatch_tacho_processing_on_insert on public.tachograph_files;

create trigger dispatch_tacho_processing_on_insert
after insert on public.tachograph_files
for each row
execute function private.dispatch_tacho_import_processing();
