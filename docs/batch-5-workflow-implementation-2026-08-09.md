# Batch 5 workflow implementation

## Authorization-code lifecycle

`companies.auth_code` remains the shared, time-limited driver/company onboarding code consumed by `validate_auth_code`; it is not a staff or supervisor invitation. The broken public `Join Existing` / `Supervisor Signup` route was removed because it looked up a company and then called manager creation, so it created a new fleet rather than joining the selected fleet. Existing `driver_invites`, `lookup_pending_driver_invite`, and `accept_driver_invite` flows are unchanged.

`20260809201940_govern_fleet_authorization_codes.sql` adds server-side rotation using `pgcrypto.gen_random_bytes`, a seven-day expiry refresh, the existing primary-manager (`companies.created_by`) rule plus the additive settings permission, and an audited RPC. Company-name updates use a protected RPC in the same migration. Live RLS confirms company-row reads are creator-only, so drivers cannot retrieve `companies.auth_code` by selecting their company row; the Driver App remains compatible through `validate_auth_code` and the separate driver-invite RPCs.

## FIN-002 Expense Review

`20260809201941_add_fin002_expense_review.sql` adds one current `expense_reviews` row per captured expense. No row means `pending`; rows hold `approved` or `rejected`, reviewer, timestamp, and optional note. `review_expense` derives company membership from the expense's driver, enforces `finance.expense.read` / `finance.expense.review`, rejects invalid and cross-company IDs, uses `updated_at` optimistic concurrency for changes, and writes a security audit event. This is manager-reviewed operational acceptance, not payment or reimbursement.

`ExpenseApproval` now separates Pending, Approved, and Rejected views, preserves receipt downloads and captured evidence, and distinguishes no expenses from no pending expenses. Payroll and Reports continue to total captured expenses unchanged; whether rejected expenses should be excluded from reimbursement is deferred to a later finance decision.

## Deployment record

The linked project was verified as `lcvahjmoobmpifrexurb`. The known ROUTE-001 deployment-time aliases `20260809151811` and `20260809151823` were read-only-verified against the live RPCs, constraints, grants, lifecycle checks, event writes, and audit writes, then reconciled in migration history only:

```text
supabase migration repair --linked --status reverted 20260809151811
supabase migration repair --linked --status reverted 20260809151823
supabase migration repair --linked --status applied 20260809100000
supabase migration repair --linked --status applied 20260809151559
```

The dry run then proposed exactly the two Batch 5 migrations. Both were deployed normally and remote history now matches the canonical local versions through `20260809201941`. `npm run db:types` regenerated the authoritative contracts; no generated file was edited manually.
