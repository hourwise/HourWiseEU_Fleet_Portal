-- Trigger-only audit helper: no browser execution surface.
revoke all on function public.audit_atlas_proposal_validation_transition() from public, anon, authenticated;
grant execute on function public.audit_atlas_proposal_validation_transition() to postgres;

-- Keep the operational run ledger private while giving the RLS advisor an explicit deny policy.
drop policy if exists "No browser access to POD reconciliation runs" on public.pod_reconciliation_runs;
create policy "No browser access to POD reconciliation runs"
on public.pod_reconciliation_runs
for all
to anon, authenticated
using (false)
with check (false);
