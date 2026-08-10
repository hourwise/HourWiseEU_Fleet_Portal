-- BATCH 6: govern manager updates to existing driver personnel profiles.
-- Driver App onboarding/create contracts remain unchanged.
-- Protected fields: id, company_id, user_id, role, email, account identity,
-- authorization state, is_active, subscription state, and security-sensitive membership fields.

create or replace function public.update_driver_profile(
  p_driver_id uuid,
  p_patch jsonb,
  p_expected_updated_at timestamptz default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid;
  target_driver public.profiles%rowtype;
  next_driver public.profiles%rowtype;
  updated_driver public.profiles%rowtype;
  protected_key text;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if p_driver_id is null or p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'A driver profile update object is required';
  end if;

  select p.company_id
  into actor_company_id
  from public.profiles p
  where p.id = actor_id
    and p.company_id is not null;

  if actor_company_id is null then
    raise exception 'Company membership required';
  end if;

  select p.*
  into target_driver
  from public.profiles p
  where p.id = p_driver_id
    and p.company_id = actor_company_id
    and p.role = 'driver';

  if not found then
    raise exception 'Driver profile not found in the actor company';
  end if;

  if not public.actor_has_permission('drivers.profile.update', actor_company_id, null) then
    perform public.record_security_event(
      actor_company_id,
      null,
      'drivers.profile.update',
      'denied',
      'permission_missing',
      'driver_profile',
      p_driver_id,
      'update'
    );
    raise exception 'Driver profile update permission required';
  end if;

  if p_expected_updated_at is not null
     and target_driver.updated_at is distinct from p_expected_updated_at then
    raise exception 'Driver profile is stale; reload the current profile before trying again';
  end if;

  select key
  into protected_key
  from jsonb_object_keys(p_patch) as keys(key)
  where key not in (
    'full_name',
    'payroll_number',
    'national_insurance_number',
    'date_of_birth',
    'phone_number',
    'emergency_contact_name',
    'emergency_contact_phone',
    'is_contractor',
    'agency_name',
    'full_address',
    'driving_licence_number',
    'driving_licence_expiry',
    'cpc_dqc_number',
    'cpc_dqc_expiry',
    'tacho_card_number'
  )
  limit 1;

  if protected_key is not null then
    raise exception 'Profile field is protected from manager mutation: %', protected_key;
  end if;

  next_driver := jsonb_populate_record(target_driver, p_patch);

  update public.profiles
  set full_name = next_driver.full_name,
      payroll_number = next_driver.payroll_number,
      national_insurance_number = next_driver.national_insurance_number,
      date_of_birth = next_driver.date_of_birth,
      phone_number = next_driver.phone_number,
      emergency_contact_name = next_driver.emergency_contact_name,
      emergency_contact_phone = next_driver.emergency_contact_phone,
      is_contractor = next_driver.is_contractor,
      agency_name = next_driver.agency_name,
      full_address = next_driver.full_address,
      driving_licence_number = next_driver.driving_licence_number,
      driving_licence_expiry = next_driver.driving_licence_expiry,
      cpc_dqc_number = next_driver.cpc_dqc_number,
      cpc_dqc_expiry = next_driver.cpc_dqc_expiry,
      tacho_card_number = next_driver.tacho_card_number,
      updated_at = now()
  where id = target_driver.id
    and (
      p_expected_updated_at is null
      or updated_at is not distinct from p_expected_updated_at
    )
  returning * into updated_driver;

  if not found then
    raise exception 'Driver profile is stale; reload the current profile before trying again';
  end if;

  perform public.record_security_event(
    actor_company_id,
    null,
    'drivers.profile.update',
    'allowed',
    'driver_profile_updated',
    'driver_profile',
    updated_driver.id,
    'update',
    null,
    jsonb_build_object(
      'updated_fields', (
        select coalesce(jsonb_agg(key order by key), '[]'::jsonb)
        from jsonb_object_keys(p_patch) as keys(key)
      )
    )
  );

  return updated_driver;
end;
$$;

revoke all on function public.update_driver_profile(uuid, jsonb, timestamptz) from public;
revoke all on function public.update_driver_profile(uuid, jsonb, timestamptz) from anon;
grant execute on function public.update_driver_profile(uuid, jsonb, timestamptz) to authenticated;

comment on function public.update_driver_profile(uuid, jsonb, timestamptz) is
  'Governed same-company manager update for allowlisted driver personnel fields. Role, company, identity, authorization, and membership fields are protected.';
