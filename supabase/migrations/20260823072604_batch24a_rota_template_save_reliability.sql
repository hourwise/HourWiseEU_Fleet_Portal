alter table public.rota_templates
  add column if not exists request_key uuid;

create unique index if not exists rota_templates_company_request_key_uidx
  on public.rota_templates(company_id, request_key)
  where request_key is not null;

comment on column public.rota_templates.request_key is
  'Manager-generated idempotency key. Replaying the same company/key returns the original template.';

drop function if exists public.create_cyclic_rota_template(text, text, integer, jsonb);

create function public.create_cyclic_rota_template(
  p_name text,
  p_description text,
  p_cycle_length_days integer,
  p_slots jsonb,
  p_request_key uuid
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid := public.get_my_company_id();
  template_id uuid;
  existing_cycle_length integer;
  existing_slot_count integer;
  slot jsonb;
  slot_count integer := 0;
  slot_cycle_day integer;
begin
  if actor_id is null or public.get_my_role() is distinct from 'manager' then
    raise exception 'Only a manager can create a rota pattern' using errcode = '42501';
  end if;
  if p_request_key is null then
    raise exception 'A request key is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_name), '') is null or p_cycle_length_days not between 1 and 56
     or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) not between 1 and 500 then
    raise exception 'A name, a 1 to 56 day cycle, and between 1 and 500 requirements are needed' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(actor_company_id::text || ':' || p_request_key::text, 0)
  );

  select rt.id, rt.cycle_length_days, count(rts.id)::integer
    into template_id, existing_cycle_length, existing_slot_count
  from public.rota_templates rt
  left join public.rota_template_slots rts on rts.template_id = rt.id
  where rt.company_id = actor_company_id and rt.request_key = p_request_key
  group by rt.id, rt.cycle_length_days;

  if template_id is not null then
    return jsonb_build_object(
      'template_id', template_id,
      'slot_count', existing_slot_count,
      'cycle_length_days', existing_cycle_length,
      'replayed', true
    );
  end if;

  insert into public.rota_templates(
    company_id, name, description, cycle_length_days, created_by, request_key
  ) values (
    actor_company_id, btrim(p_name), nullif(btrim(p_description), ''),
    p_cycle_length_days, actor_id, p_request_key
  )
  returning id into template_id;

  for slot in select value from jsonb_array_elements(p_slots) loop
    slot_cycle_day := coalesce((slot ->> 'cycle_day')::integer, 0);
    if slot_cycle_day not between 1 and p_cycle_length_days
       or nullif(btrim(slot ->> 'role_label'), '') is null
       or (slot ->> 'start_time')::time = (slot ->> 'end_time')::time
       or coalesce((slot ->> 'required_headcount')::integer, 0) not between 1 and 50 then
      raise exception 'Every requirement needs a valid cycle day, name, time, and headcount' using errcode = '22023';
    end if;
    insert into public.rota_template_slots(
      company_id, template_id, cycle_day, role_label, start_time, end_time,
      required_headcount, required_skill, sort_order
    ) values (
      actor_company_id, template_id, slot_cycle_day, btrim(slot ->> 'role_label'),
      (slot ->> 'start_time')::time, (slot ->> 'end_time')::time,
      (slot ->> 'required_headcount')::integer,
      nullif(btrim(slot ->> 'required_skill'), ''),
      coalesce((slot ->> 'sort_order')::integer, slot_count)
    );
    slot_count := slot_count + 1;
  end loop;

  return jsonb_build_object(
    'template_id', template_id,
    'slot_count', slot_count,
    'cycle_length_days', p_cycle_length_days,
    'replayed', false
  );
end;
$$;

revoke all on function public.create_cyclic_rota_template(text, text, integer, jsonb, uuid)
  from public, anon;
grant execute on function public.create_cyclic_rota_template(text, text, integer, jsonb, uuid)
  to authenticated;
