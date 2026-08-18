-- Batch 10 corrective migration: restrict direct execution of asset-guard
-- wrappers and the readiness trigger function. The original Batch 10
-- migration is already applied and remains immutable.

begin;

revoke all on function public.create_job_assignment_with_asset_guard(
  uuid, text, text, text, text, text, text, text, text, text,
  integer, timestamptz, timestamptz, integer, boolean
) from public;
revoke all on function public.create_job_assignment_with_asset_guard(
  uuid, text, text, text, text, text, text, text, text, text,
  integer, timestamptz, timestamptz, integer, boolean
) from anon;
grant execute on function public.create_job_assignment_with_asset_guard(
  uuid, text, text, text, text, text, text, text, text, text,
  integer, timestamptz, timestamptz, integer, boolean
) to authenticated;

revoke all on function public.update_shift_with_asset_guard(
  uuid, date, time, time, uuid, text, boolean
) from public;
revoke all on function public.update_shift_with_asset_guard(
  uuid, date, time, time, uuid, text, boolean
) from anon;
grant execute on function public.update_shift_with_asset_guard(
  uuid, date, time, time, uuid, text, boolean
) to authenticated;

revoke all on function public.enforce_asset_assignment_readiness() from public;
revoke all on function public.enforce_asset_assignment_readiness() from anon;
revoke all on function public.enforce_asset_assignment_readiness() from authenticated;

commit;
