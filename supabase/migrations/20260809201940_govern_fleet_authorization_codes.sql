-- Secure the legacy driver/company onboarding code lifecycle without changing
-- the shared validate_auth_code consumer contract used by the Driver App.

create extension if not exists pgcrypto;

insert into public.security_permissions (key, area, resource, operation, description, risk_level, requires_audit)
values ('administration.company_settings.update', 'administration', 'company_settings', 'update', 'Update sensitive company settings and rotate the driver onboarding code.', 'critical', true)
on conflict (key) do update set description = excluded.description, risk_level = excluded.risk_level, requires_audit = excluded.requires_audit;

insert into public.security_role_permissions (role_key, permission_key, effect, scope_level)
values ('fleet_administrator', 'administration.company_settings.update', 'allow', 'organisation')
on conflict (role_key, permission_key, scope_level) do update set effect = excluded.effect;

create or replace function public.rotate_company_auth_code()
returns table (auth_code text, auth_code_expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid;
  next_code text;
  next_expiry timestamptz := now() + interval '7 days';
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select p.company_id into actor_company_id
  from public.profiles p
  where p.id = actor_id and p.company_id is not null
  for update;

  if actor_company_id is null then
    raise exception 'Company membership required';
  end if;

  if not exists (
    select 1 from public.companies c
    where c.id = actor_company_id
      and c.created_by = actor_id
  ) or not public.actor_has_permission('administration.company_settings.update', actor_company_id, null) then
    perform public.record_security_event(actor_company_id, null, 'administration.company_settings.update', 'denied', 'primary_manager_required', 'company', actor_company_id, 'rotate_auth_code');
    raise exception 'Only the primary fleet administrator can rotate the authorization code';
  end if;

  loop
    next_code := upper(encode(gen_random_bytes(9), 'hex'));
    begin
      update public.companies
      set auth_code = next_code, auth_code_expires_at = next_expiry
      where id = actor_company_id;
      exit when found;
    exception when unique_violation then
      -- Retry only the extremely unlikely unique-code collision.
    end;
  end loop;

  perform public.record_security_event(actor_company_id, null, 'administration.company_settings.update', 'allowed', 'auth_code_rotated', 'company', actor_company_id, 'rotate_auth_code', null, jsonb_build_object('expires_at', next_expiry));
  return query select next_code, next_expiry;
end;
$$;

create or replace function public.update_company_name(p_name text)
returns public.companies
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  actor_company_id uuid;
  updated_company public.companies;
begin
  if actor_id is null or nullif(trim(p_name), '') is null then
    raise exception 'A company name is required';
  end if;
  select p.company_id into actor_company_id from public.profiles p where p.id = actor_id;
  if actor_company_id is null or not exists (select 1 from public.companies c where c.id = actor_company_id and c.created_by = actor_id)
     or not public.actor_has_permission('administration.company_settings.update', actor_company_id, null) then
    raise exception 'Only the primary fleet administrator can update company settings';
  end if;
  update public.companies set name = trim(p_name) where id = actor_company_id returning * into updated_company;
  perform public.record_security_event(actor_company_id, null, 'administration.company_settings.update', 'allowed', 'company_name_updated', 'company', actor_company_id, 'update_company_name');
  return updated_company;
end;
$$;

revoke all on function public.rotate_company_auth_code() from public;
revoke all on function public.rotate_company_auth_code() from anon;
grant execute on function public.rotate_company_auth_code() to authenticated;
revoke all on function public.update_company_name(text) from public;
revoke all on function public.update_company_name(text) from anon;
grant execute on function public.update_company_name(text) to authenticated;

comment on function public.rotate_company_auth_code() is 'Primary-manager-only server-side rotation for the shared driver onboarding code. Drivers continue to use validate_auth_code.';
