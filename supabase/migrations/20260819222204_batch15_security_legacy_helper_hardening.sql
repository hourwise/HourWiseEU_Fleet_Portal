-- Batch 15: bounded legacy helper hardening.
-- These identity helpers are used by policies and authenticated Portal code,
-- not anonymous onboarding. Invite/code lookup RPCs remain intentionally
-- anonymous and are not changed here.

alter function public.check_is_manager() set search_path = public, pg_temp;
alter function public.get_auth_user_company_id() set search_path = public, pg_temp;
alter function public.is_manager() set search_path = public, pg_temp;
alter function public.get_user_company_id() set search_path = public, pg_temp;

revoke all on function public.get_my_company_id() from public, anon;
revoke all on function public.get_my_role() from public, anon;
revoke all on function public.get_auth_user_company() from public, anon;
revoke all on function public.get_auth_user_company_id() from public, anon;
revoke all on function public.get_user_company_id() from public, anon;
revoke all on function public.is_manager() from public, anon;
revoke all on function public.check_is_manager() from public, anon;

grant execute on function public.get_my_company_id() to authenticated;
grant execute on function public.get_my_role() to authenticated;
grant execute on function public.get_auth_user_company() to authenticated;
grant execute on function public.get_auth_user_company_id() to authenticated;
grant execute on function public.get_user_company_id() to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.check_is_manager() to authenticated;

comment on function public.check_is_manager() is 'Authenticated-only compatibility helper. Policy-internal calls remain supported; anonymous RPC execution is intentionally revoked.';
comment on function public.get_auth_user_company_id() is 'Authenticated-only compatibility helper with fixed search_path.';
comment on function public.is_manager() is 'Authenticated-only compatibility helper with fixed search_path.';
