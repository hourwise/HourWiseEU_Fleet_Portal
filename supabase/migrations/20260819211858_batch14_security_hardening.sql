-- Batch 14: bounded security-advisor reduction.
-- Trigger-only functions do not need a browser RPC surface. The mutable
-- search_path correction is limited to an existing shared trigger helper.

alter function public.update_updated_at_column()
  set search_path = public, pg_temp;

revoke all on function public.prevent_role_escalation() from public, anon, authenticated;
revoke all on function public.enforce_trailer_assignment_readiness() from public, anon, authenticated;

comment on function public.prevent_role_escalation() is 'Trigger-only role-escalation guard; direct API execution is deliberately revoked.';
comment on function public.enforce_trailer_assignment_readiness() is 'Trigger-only trailer readiness guard; direct API execution is deliberately revoked.';
