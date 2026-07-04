# Cross-Tenant Upload/Read Regression Tests

Date: 2026-07-02
Task: `TEST-001`
Status: Complete

## Purpose

Document the regression coverage added for cross-tenant tachograph upload and read boundaries.

## Test Coverage Added

Added `src/lib/tacho/securityRegression.test.ts`.

The tests verify:

- `tachograph-files` upload policy is private, authenticated, manager-only, and scoped by the first storage path folder matching the actor's `company_id`
- `tachograph-files` read policy is private, authenticated, manager-only, and scoped by the first storage path folder matching the actor's `company_id`
- driver analysis bundle reads remain scoped by both `company_id` and `driver_id`
- vehicle analysis bundle reads remain scoped by both `company_id` and `vehicle_id`
- import bundle reads remain scoped by both `company_id` and import ID
- client RPC wrappers continue passing tenant IDs into the server-side RPCs

## Test Command

```powershell
npm run test:rules
```

`package.json` now includes the new test file in `test:rules`.

## Limitation

These are static regression tests over source-controlled migrations and client wiring.

They do not replace live Supabase RLS tests. A later `SEC-*` implementation task should add integration tests against a local or hosted Supabase test database that proves cross-tenant access is denied at runtime.

## Acceptance Criteria

- Cross-tenant storage upload/read policy assumptions are covered.
- Cross-tenant tacho read RPC assumptions are covered.
- Existing test command includes the new regression tests.
- Source-of-truth changelog and completion plan are updated.

