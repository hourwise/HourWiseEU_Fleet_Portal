-- BATCH 6 follow-up: move legacy SECURITY DEFINER tachograph readers behind
-- authenticated, same-company, permission-checked public wrappers.

alter function public.get_company_tacho_signals(uuid, integer) rename to get_company_tacho_signals_unchecked;
alter function public.get_company_tacho_signals_unchecked(uuid, integer) set schema private;

create or replace function public.get_company_tacho_signals(
  p_company_id uuid,
  p_days integer default 14
)
returns table(driver_id uuid, compliance_signal jsonb, risk_signal jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null
     or public.get_my_role() is distinct from 'manager'
     or actor_company_id is distinct from p_company_id
     or not public.actor_has_permission('compliance.timeline.read', actor_company_id, null) then
    raise exception 'Tachograph signal access is not authorised for this company';
  end if;

  return query select * from private.get_company_tacho_signals_unchecked(p_company_id, p_days);
end;
$$;

alter function public.get_driver_tacho_analysis_bundle(uuid, uuid, text) rename to get_driver_tacho_analysis_bundle_unchecked;
alter function public.get_driver_tacho_analysis_bundle_unchecked(uuid, uuid, text) set schema private;

create or replace function public.get_driver_tacho_analysis_bundle(
  p_company_id uuid,
  p_driver_id uuid,
  p_range text default '7d'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null
     or public.get_my_role() is distinct from 'manager'
     or actor_company_id is distinct from p_company_id
     or not public.actor_has_permission('compliance.timeline.read', actor_company_id, null)
     or not exists (
       select 1 from public.profiles p
       where p.id = p_driver_id
         and p.company_id = actor_company_id
         and p.role = 'driver'
     ) then
    raise exception 'Driver tachograph analysis access is not authorised for this company';
  end if;

  return private.get_driver_tacho_analysis_bundle_unchecked(p_company_id, p_driver_id, p_range);
end;
$$;

alter function public.get_driver_timeline_bundle(uuid, uuid, text) rename to get_driver_timeline_bundle_unchecked;
alter function public.get_driver_timeline_bundle_unchecked(uuid, uuid, text) set schema private;

create or replace function public.get_driver_timeline_bundle(
  p_company_id uuid,
  p_driver_id uuid,
  p_range text default '7d'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null
     or public.get_my_role() is distinct from 'manager'
     or actor_company_id is distinct from p_company_id
     or not public.actor_has_permission('compliance.timeline.read', actor_company_id, null)
     or not exists (
       select 1 from public.profiles p
       where p.id = p_driver_id
         and p.company_id = actor_company_id
         and p.role = 'driver'
     ) then
    raise exception 'Driver timeline access is not authorised for this company';
  end if;

  return private.get_driver_timeline_bundle_unchecked(p_company_id, p_driver_id, p_range);
end;
$$;

alter function public.get_import_timeline_bundle(uuid, uuid) rename to get_import_timeline_bundle_unchecked;
alter function public.get_import_timeline_bundle_unchecked(uuid, uuid) set schema private;

create or replace function public.get_import_timeline_bundle(
  p_company_id uuid,
  p_import_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null
     or public.get_my_role() is distinct from 'manager'
     or actor_company_id is distinct from p_company_id
     or not public.actor_has_permission('compliance.timeline.read', actor_company_id, null)
     or not exists (
       select 1 from public.tachograph_files tf
       where tf.id = p_import_id
         and tf.company_id = actor_company_id
     ) then
    raise exception 'Tachograph import timeline access is not authorised for this company';
  end if;

  return private.get_import_timeline_bundle_unchecked(p_company_id, p_import_id);
end;
$$;

alter function public.get_tacho_import_bundle(uuid, uuid) rename to get_tacho_import_bundle_unchecked;
alter function public.get_tacho_import_bundle_unchecked(uuid, uuid) set schema private;

create or replace function public.get_tacho_import_bundle(
  p_company_id uuid,
  p_import_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null
     or public.get_my_role() is distinct from 'manager'
     or actor_company_id is distinct from p_company_id
     or not public.actor_has_permission('compliance.timeline.read', actor_company_id, null)
     or not exists (
       select 1 from public.tachograph_files tf
       where tf.id = p_import_id
         and tf.company_id = actor_company_id
     ) then
    raise exception 'Tachograph import access is not authorised for this company';
  end if;

  return private.get_tacho_import_bundle_unchecked(p_company_id, p_import_id);
end;
$$;

alter function public.get_vehicle_timeline_bundle(uuid, uuid, text) rename to get_vehicle_timeline_bundle_unchecked;
alter function public.get_vehicle_timeline_bundle_unchecked(uuid, uuid, text) set schema private;

create or replace function public.get_vehicle_timeline_bundle(
  p_company_id uuid,
  p_vehicle_id uuid,
  p_range text default '7d'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null
     or public.get_my_role() is distinct from 'manager'
     or actor_company_id is distinct from p_company_id
     or not public.actor_has_permission('compliance.timeline.read', actor_company_id, null)
     or not exists (
       select 1 from public.vehicles v
       where v.id = p_vehicle_id
         and v.company_id = actor_company_id
     ) then
    raise exception 'Vehicle timeline access is not authorised for this company';
  end if;

  return private.get_vehicle_timeline_bundle_unchecked(p_company_id, p_vehicle_id, p_range);
end;
$$;

alter function public.get_vehicle_unit_analysis_bundle(uuid, uuid, text) rename to get_vehicle_unit_analysis_bundle_unchecked;
alter function public.get_vehicle_unit_analysis_bundle_unchecked(uuid, uuid, text) set schema private;

create or replace function public.get_vehicle_unit_analysis_bundle(
  p_company_id uuid,
  p_vehicle_id uuid,
  p_range text default '7d'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_company_id uuid := public.get_my_company_id();
begin
  if auth.uid() is null
     or public.get_my_role() is distinct from 'manager'
     or actor_company_id is distinct from p_company_id
     or not public.actor_has_permission('compliance.timeline.read', actor_company_id, null)
     or not exists (
       select 1 from public.vehicles v
       where v.id = p_vehicle_id
         and v.company_id = actor_company_id
     ) then
    raise exception 'Vehicle tachograph analysis access is not authorised for this company';
  end if;

  return private.get_vehicle_unit_analysis_bundle_unchecked(p_company_id, p_vehicle_id, p_range);
end;
$$;

-- Keep the implementation functions private and callable only by the wrappers.
revoke all on function private.get_company_tacho_signals_unchecked(uuid, integer) from public, anon, authenticated;
revoke all on function private.get_driver_tacho_analysis_bundle_unchecked(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.get_driver_timeline_bundle_unchecked(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.get_import_timeline_bundle_unchecked(uuid, uuid) from public, anon, authenticated;
revoke all on function private.get_tacho_import_bundle_unchecked(uuid, uuid) from public, anon, authenticated;
revoke all on function private.get_vehicle_timeline_bundle_unchecked(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.get_vehicle_unit_analysis_bundle_unchecked(uuid, uuid, text) from public, anon, authenticated;

revoke all on function public.get_company_tacho_signals(uuid, integer) from public, anon;
revoke all on function public.get_driver_tacho_analysis_bundle(uuid, uuid, text) from public, anon;
revoke all on function public.get_driver_timeline_bundle(uuid, uuid, text) from public, anon;
revoke all on function public.get_import_timeline_bundle(uuid, uuid) from public, anon;
revoke all on function public.get_tacho_import_bundle(uuid, uuid) from public, anon;
revoke all on function public.get_vehicle_timeline_bundle(uuid, uuid, text) from public, anon;
revoke all on function public.get_vehicle_unit_analysis_bundle(uuid, uuid, text) from public, anon;

grant execute on function public.get_company_tacho_signals(uuid, integer) to authenticated;
grant execute on function public.get_driver_tacho_analysis_bundle(uuid, uuid, text) to authenticated;
grant execute on function public.get_driver_timeline_bundle(uuid, uuid, text) to authenticated;
grant execute on function public.get_import_timeline_bundle(uuid, uuid) to authenticated;
grant execute on function public.get_tacho_import_bundle(uuid, uuid) to authenticated;
grant execute on function public.get_vehicle_timeline_bundle(uuid, uuid, text) to authenticated;
grant execute on function public.get_vehicle_unit_analysis_bundle(uuid, uuid, text) to authenticated;
