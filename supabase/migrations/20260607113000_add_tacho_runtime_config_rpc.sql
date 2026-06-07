create or replace function public.get_tacho_processing_runtime()
returns table (
  trigger_enabled boolean,
  process_tacho_url text,
  trigger_token_configured boolean,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, private
as $$
  select
    trigger_enabled,
    process_tacho_url,
    trigger_token is not null as trigger_token_configured,
    updated_at
  from private.tacho_processing_runtime
  where singleton is true;
$$;

revoke all on function public.get_tacho_processing_runtime() from public;
revoke all on function public.get_tacho_processing_runtime() from anon;
revoke all on function public.get_tacho_processing_runtime() from authenticated;
grant execute on function public.get_tacho_processing_runtime() to service_role;

create or replace function public.configure_tacho_processing_runtime(p_patch jsonb default '{}'::jsonb)
returns table (
  trigger_enabled boolean,
  process_tacho_url text,
  trigger_token_configured boolean,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  current_row private.tacho_processing_runtime%rowtype;
  next_trigger_enabled boolean;
  next_process_tacho_url text;
  next_trigger_token text;
begin
  select *
  into current_row
  from private.tacho_processing_runtime
  where singleton is true
  for update;

  if current_row.singleton is null then
    insert into private.tacho_processing_runtime (singleton, trigger_enabled)
    values (true, false)
    on conflict (singleton) do nothing;

    select *
    into current_row
    from private.tacho_processing_runtime
    where singleton is true
    for update;
  end if;

  next_trigger_enabled := current_row.trigger_enabled;
  next_process_tacho_url := current_row.process_tacho_url;
  next_trigger_token := current_row.trigger_token;

  if p_patch ? 'triggerEnabled' then
    next_trigger_enabled := coalesce((p_patch ->> 'triggerEnabled')::boolean, current_row.trigger_enabled);
  end if;

  if p_patch ? 'processTachoUrl' then
    next_process_tacho_url := nullif(btrim(p_patch ->> 'processTachoUrl'), '');
  end if;

  if p_patch ? 'triggerToken' then
    next_trigger_token := nullif(p_patch ->> 'triggerToken', '');
  end if;

  update private.tacho_processing_runtime
  set
    trigger_enabled = next_trigger_enabled,
    process_tacho_url = next_process_tacho_url,
    trigger_token = next_trigger_token,
    updated_at = now()
  where singleton is true;

  return query
  select
    runtime.trigger_enabled,
    runtime.process_tacho_url,
    runtime.trigger_token is not null as trigger_token_configured,
    runtime.updated_at
  from private.tacho_processing_runtime as runtime
  where runtime.singleton is true;
end;
$$;

revoke all on function public.configure_tacho_processing_runtime(jsonb) from public;
revoke all on function public.configure_tacho_processing_runtime(jsonb) from anon;
revoke all on function public.configure_tacho_processing_runtime(jsonb) from authenticated;
grant execute on function public.configure_tacho_processing_runtime(jsonb) to service_role;
