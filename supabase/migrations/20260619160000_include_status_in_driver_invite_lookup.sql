-- Keep the invite lookup response compatible with app code that validates
-- invite.status before continuing the fleet-driver setup flow.

drop function if exists public.lookup_pending_driver_invite(text);

create function public.lookup_pending_driver_invite(p_invite_code text)
returns table (
  invite_code text,
  status text,
  email text,
  full_name text,
  company_name text,
  expires_at timestamptz,
  tacho_card_number text,
  tacho_card_holder_name text,
  tacho_card_expiry date,
  tacho_card_issuing_authority text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  select
    di.invite_code,
    di.status::text,
    di.email,
    di.full_name,
    c.name as company_name,
    di.expires_at,
    di.tacho_card_number,
    di.tacho_card_holder_name,
    di.tacho_card_expiry,
    di.tacho_card_issuing_authority
  from public.driver_invites di
  join public.companies c on c.id = di.company_id
  where di.invite_code = upper(trim(p_invite_code))
    and di.status = 'pending'
    and di.expires_at > now()
  limit 1;
end;
$$;

grant execute on function public.lookup_pending_driver_invite(text) to anon, authenticated;
