begin;

-- Batch 7 repair: enforce the return-to-service invariant at the database
-- boundary so direct vehicles updates cannot bypass defect lifecycle review.

create or replace function public.prevent_vehicle_return_to_service_with_open_defects()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Use the row's existing company and registration identity. This also
  -- prevents a combined identity/VOR update from evading a defect attached
  -- to the vehicle that was in service. Company-less solo vehicles retain
  -- their existing behaviour because there is no same-company defect scope.
  if old.is_vor is true
     and new.is_vor is false
     and old.company_id is not null
     and exists (
       select 1
       from public.vehicle_checks as check_record
       where check_record.company_id = old.company_id
         and upper(check_record.reg_number) = upper(old.reg_number)
         and check_record.check_status = 'defect'
         and coalesce(check_record.defect_lifecycle_status, 'reported') <> 'fixed'
     ) then
    raise exception using
      errcode = '23514',
      message = 'Vehicle cannot return to service while unresolved defects remain';
  end if;

  return new;
end;
$$;

-- The function is only a trigger implementation, never a public callable
-- SECURITY DEFINER API. The trigger remains the invariant enforcement point
-- for browser, RPC, service, and other database update paths alike.
revoke all on function public.prevent_vehicle_return_to_service_with_open_defects() from public;
revoke all on function public.prevent_vehicle_return_to_service_with_open_defects() from anon;
revoke all on function public.prevent_vehicle_return_to_service_with_open_defects() from authenticated;

drop trigger if exists vehicles_guard_return_to_service on public.vehicles;
create trigger vehicles_guard_return_to_service
before update of is_vor on public.vehicles
for each row
execute function public.prevent_vehicle_return_to_service_with_open_defects();

comment on function public.prevent_vehicle_return_to_service_with_open_defects() is
  'Private SECURITY DEFINER trigger guard: prevents a company vehicle from clearing VOR while same-registration defects remain unresolved.';

comment on trigger vehicles_guard_return_to_service on public.vehicles is
  'Database invariant boundary for vehicle return-to-service transitions; direct browser updates must not bypass unresolved defect checks.';

commit;
