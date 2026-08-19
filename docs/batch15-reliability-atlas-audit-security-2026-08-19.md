# HourWise Fleet Portal — Batch 15

Date: 19–20 August 2026
Starting commit: `5cf33dd8d22d3071a568fd49219bba7a3a390af2`
Repository: `hourwise/HourWiseEU_Fleet_Portal`
Supabase project: `lcvahjmoobmpifrexurb`

## Starting state

Batch 14 was complete and deployed. The working tree was clean at the requested starting commit, and the linked migration history was aligned through Batch 14. Local Docker and disposable smoke credentials were not available.

Batch 15 deliberately does not add a model gateway, paid AI inference, live telemetry, conversational Atlas, or generic Atlas write authority. Atlas proposal generation and explanations remain deterministic Portal-state logic.

## Implemented slices

### 1. Governed Atlas proposal apply concurrency

`atlas_proposals` now has an explicit `applying` state and persisted apply-attempt metadata. Manager-only server-side wrappers cover the three existing governed operations:

- `atlas_apply_trailer_proposal`
- `atlas_apply_shift_vehicle_proposal`
- `atlas_apply_task_proposal`

Each wrapper authenticates through `auth.uid()`, checks manager/company scope, revalidates the proposal, locks the proposal row, compares the authoritative target version, and claims the apply exactly once. The task path also takes a transaction advisory lock for the task source. A retry of an already applied proposal returns the stored outcome with `already_applied` and does not rerun the governed operation.

Persisted outcomes distinguish `applied`, `already_applied`, `stale`, `validation_failed`, `permission_denied`, `conflict`, and `governed_operation_failed`. Trailer and shift results retain the resulting fleet event ID where the underlying governed operation returns one; task results retain the governed handling result.

The client no longer calls governed operations directly and no longer records an apply outcome from the browser. `record_atlas_proposal_outcome` is now postgres-only.

### 2. Proposal audit timeline, manager history, and export

Validation transitions and apply/review actions reuse the existing `security_permission_audit_events` infrastructure. `get_atlas_proposal_timeline` is a bounded, manager-only view of that history. The workbench adds status/type/date/target filters, a per-proposal history view, deterministic outcome display, and a CSV export.

The export intentionally contains proposal IDs, target IDs, status, validation status/reason codes, timestamps, apply outcome, and resulting event ID. It excludes evidence facts, raw snapshots, review notes, file paths, and other unnecessary operational detail.

### 3. POD reconciliation health

`pod_reconciliation_runs` records each scheduled reconciliation run with start/finish, status, batch limit, scanned/expired counts, removed objects, mismatches, failures, and consecutive failures. The existing exact-bucket/path/uploader-owned cleanup rule remains in force. Evidence-linked intents are treated as mismatches and are not broadly deleted.

Per-item failures are isolated so a single bad intent does not abort the entire bounded batch. A maintenance warning is surfaced after three consecutive whole-run failures. `get_pod_reconciliation_health` exposes only a bounded manager summary and recent run summaries; raw storage paths and uploader identifiers are not exposed. The existing cron schedule remains active at every 15 minutes.

### 4. Bounded security hardening

The Batch 15 security migration fixed `search_path` for the selected legacy identity helper functions and removed anonymous/public execution from compatibility helpers while preserving authenticated access. Anonymous invite/code functions were intentionally not changed because they are part of onboarding.

The trigger-only Atlas validation audit helper has no browser execution grant. The POD reconciliation run ledger has RLS plus an explicit deny policy for browser roles and no browser table grants. New privileged RPCs use fixed `search_path`, `auth.uid()` actor derivation, server-side manager/company checks, and deliberate authenticated execution grants.

Fresh advisor results after deployment were 124 findings:

| Category | Count |
| --- | ---: |
| RLS enabled without policy | 16 |
| Mutable function search path | 11 |
| Anonymous security-definer execution | 19 |
| Authenticated security-definer execution | 77 |
| Leaked password protection | 1 |

This is down from the pre-Batch15 total of 129. Remaining findings are bounded or pre-existing: intentional admin-only RLS ledgers, existing onboarding and operational security-definer surfaces, and the owner-controlled leaked-password setting. Supabase documents leaked-password protection as a HaveIBeenPwned-backed Auth feature available on Pro and above; it remains an owner decision and was not enabled implicitly. See the [Supabase password security documentation](https://supabase.com/docs/guides/auth/password-security).

## Migrations and generated types

Created with `supabase migration new`, dry-run checked, and deployed only as the expected Batch 15 set:

- `20260819222159_batch15_atlas_apply_concurrency.sql`
- `20260819222203_batch15_pod_reconciliation_health.sql`
- `20260819222204_batch15_security_legacy_helper_hardening.sql`
- `20260819224425_batch15_revoke_atlas_trigger_execution.sql`

The final filename was aligned to the exact deployed migration version recorded by Supabase. Database types were regenerated into `src/lib/database.types.ts` after deployment.

## Validation

- `npm.cmd run typecheck` — passed.
- `npm.cmd run test:rules` — 47 files, 311 tests passed.
- `npm.cmd test` — 50 files, 328 tests passed.
- `npm.cmd run build` — passed; Vite emitted existing large-chunk warnings.
- Changed-file ESLint — passed.
- `npm.cmd run lint` — 103 errors / 7 warnings, exactly the known repository-wide baseline; no Batch 15 changed-file findings.
- `git diff --check` — passed.
- Batch 15 contract test — 9 tests passed.

The contract coverage includes apply state/locking/idempotency boundaries, task advisory locking, event linkage, timeline filters, export privacy, POD exact-path cleanup, health thresholds, and security grants. A live race test was not run because no disposable manager credentials or safe fixture environment were present.

## Smoke status and remaining blockers

`SMOKE BLOCKED — ENVIRONMENT ONLY`: `SMOKE_BASE_URL`, manager credentials, and fixture service-role key were absent. No production or shared-data smoke was attempted. This does not block the deployed schema/application slices or their static and unit/contract validation.

Remaining operational decision: the project owner must decide whether the Supabase Auth plan supports and should enable leaked-password protection. Routing-provider integration remains secondary and was not expanded in this batch.

## Batch 16 recommendations

1. Add a disposable authenticated race harness that proves double-apply behavior against a real manager session and isolated fixtures.
2. Add an operational event viewer that joins proposal history, resulting fleet events, and governed task handling without duplicating audit storage.
3. Add alerting/retention policy for repeated POD reconciliation failures and mismatch backlog age.
4. Review the remaining security-definer inventory by business capability and reduce any legacy browser grants that no longer have an active caller.
5. Add deterministic driver-document forecast fixtures for missing evidence, expiry windows, and future assignment conflicts, including acknowledgement lifecycle coverage.
