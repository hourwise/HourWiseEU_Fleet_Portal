-- Apply the canonical vehicle policy to trailers selected during planning.
-- Draft planning may carry a warning, but a hard-prohibited trailer is never
-- treated as publish-valid.
create or replace function public.assign_rota_slot_driver(p_slot_id uuid, p_driver_id uuid, p_vehicle_id uuid default null, p_trailer_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
  slot_record public.rota_slots%rowtype;
  assignment_id uuid;
  shift_id uuid;
  filled_count integer;
  warning text := null;
  vehicle_policy jsonb;
  trailer_policy jsonb;
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'manager' then raise exception 'Only a manager can fill a rota slot' using errcode = '42501'; end if;
  select * into slot_record from public.rota_slots where id = p_slot_id and company_id = actor_company_id for update;
  if slot_record.id is null then raise exception 'Rota slot is not available in this company' using errcode = '42501'; end if;
  if slot_record.status = 'cancelled' then raise exception 'This rota slot is closed' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_driver_id and company_id = actor_company_id and role = 'driver') then raise exception 'Driver is not available in this company' using errcode = '42501'; end if;
  if exists (select 1 from public.staff_availability where company_id = actor_company_id and driver_id = p_driver_id and starts_on <= slot_record.slot_date and ends_on >= slot_record.slot_date) then raise exception 'Driver is marked unavailable for this date' using errcode = '22023'; end if;
  if p_vehicle_id is not null and not exists (select 1 from public.vehicles where id = p_vehicle_id and company_id = actor_company_id and not (vehicle_class = 'trailer' or vehicle_type = 'trailer')) then raise exception 'Vehicle is not available in this company' using errcode = '42501'; end if;
  if p_trailer_id is not null and not exists (select 1 from public.vehicles where id = p_trailer_id and company_id = actor_company_id and (vehicle_class = 'trailer' or vehicle_type = 'trailer')) then raise exception 'Trailer is not available in this company' using errcode = '42501'; end if;
  if p_vehicle_id is not null then
    vehicle_policy := public.get_asset_assignment_policy(actor_company_id, p_vehicle_id);
    if coalesce((vehicle_policy ->> 'hard_block')::boolean, true) then raise exception 'Vehicle cannot be planned: %', vehicle_policy -> 'reasons' using errcode = '42501'; end if;
    if (vehicle_policy ->> 'status') in ('unknown', 'action_required') then warning := 'Vehicle evidence needs review before publication.'; end if;
  end if;
  if p_trailer_id is not null then
    trailer_policy := public.get_asset_assignment_policy(actor_company_id, p_trailer_id);
    if coalesce((trailer_policy ->> 'hard_block')::boolean, true) then raise exception 'Trailer cannot be planned: %', trailer_policy -> 'reasons' using errcode = '42501'; end if;
    if (trailer_policy ->> 'status') in ('unknown', 'action_required') then warning := coalesce(warning || ' ', '') || 'Trailer evidence needs review before publication.'; end if;
  end if;
  select rsa.id, rsa.shift_id into assignment_id, shift_id from public.rota_slot_assignments as rsa where rsa.slot_id = p_slot_id and rsa.driver_id = p_driver_id and rsa.status <> 'cancelled' for update;
  if assignment_id is null then
    insert into public.shifts(company_id, driver_id, vehicle_id, date, start_time, end_time, status, notes)
    values (actor_company_id, p_driver_id, p_vehicle_id, slot_record.slot_date, slot_record.start_time, slot_record.end_time, 'draft', 'Created from rota planning') returning id into shift_id;
    insert into public.rota_slot_assignments(company_id, slot_id, driver_id, shift_id, created_by) values (actor_company_id, p_slot_id, p_driver_id, shift_id, auth.uid()) returning id into assignment_id;
  end if;
  select count(*) into filled_count from public.rota_slot_assignments where slot_id = p_slot_id and status <> 'cancelled';
  update public.rota_slots set vehicle_id = coalesce(p_vehicle_id, vehicle_id), trailer_id = coalesce(p_trailer_id, trailer_id), status = case when filled_count >= required_headcount then 'filled' when filled_count > 0 then 'partially_filled' else 'open' end, updated_at = now() where id = p_slot_id;
  return jsonb_build_object('slot_id', p_slot_id, 'assignment_id', assignment_id, 'shift_id', shift_id, 'status', 'planned', 'warning', warning);
end;
$$;
revoke all on function public.assign_rota_slot_driver(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.assign_rota_slot_driver(uuid, uuid, uuid, uuid) to authenticated;
