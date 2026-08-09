# Batch 5 workflow implementation

## Authorization-code lifecycle

`companies.auth_code` remains the shared, time-limited driver/company onboarding code consumed by `validate_auth_code`; it is not a staff or supervisor invitation. The broken public `Join Existing` / `Supervisor Signup` route was removed because it looked up a company and then called manager creation, so it created a new fleet rather than joining the selected fleet. Existing `driver_invites`, `lookup_pending_driver_invite`, and `accept_driver_invite` flows are unchanged.

`20260809201940_govern_fleet_authorization_codes.sql` adds server-side rotation using `pgcrypto.gen_random_bytes`, a seven-day expiry refresh, the existing primary-manager (`companies.created_by`) rule plus the additive settings permission, and an audited RPC. Company-name updates use a protected RPC in the same migration. Authenticated drivers can currently read their company row's `auth_code` under the existing shared RLS contract; changing that exposure requires coordinated Driver App work and is deferred.

## FIN-002 Expense Review

`20260809201941_add_fin002_expense_review.sql` adds one current `expense_reviews` row per captured expense. No row means `pending`; rows hold `approved` or `rejected`, reviewer, timestamp, and optional note. `review_expense` derives company membership from the expense's driver, enforces `finance.expense.read` / `finance.expense.review`, rejects invalid and cross-company IDs, uses `updated_at` optimistic concurrency for changes, and writes a security audit event. This is manager-reviewed operational acceptance, not payment or reimbursement.

`ExpenseApproval` now separates Pending, Approved, and Rejected views, preserves receipt downloads and captured evidence, and distinguishes no expenses from no pending expenses. Payroll and Reports continue to total captured expenses unchanged; whether rejected expenses should be excluded from reimbursement is deferred to a later finance decision.

Remote deployment and generated type refresh remain pending because Supabase CLI authentication was unavailable in this session.
