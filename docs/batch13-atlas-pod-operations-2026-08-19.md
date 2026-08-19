# Batch 13 — Atlas query routing, POD hardening, and operational verification

Starting point: `main` at `c89ef9685ad8548d0b9f2f75cf86e588d24f92f2`, with Batch 12 already deployed. Batch 12 migrations were not replayed.

## Atlas query router

`src/lib/atlasQueryRouter.ts` classifies manager questions into stable Portal intents and complexity tiers:

- Tier 0: deterministic read-only answers from the morning briefing, task queue, asset readiness, driver forecasts, and pending POD review state.
- Tier 1: bounded synthesis over the same authoritative snapshot; it currently returns a truthful not-configured response rather than inventing an answer.
- Tier 2: reasoning packet preparation for comparisons and explanations.
- Tier 3: reasoning packet preparation for planning requests.

Supported intent contracts include yesterday carry-over, today, tomorrow, next 30 days, asset readiness/VOR/defects, acknowledgements, delayed or exception jobs, driver and asset compliance, upcoming expiry, missing evidence, operational tasks, POD review, and incomplete jobs. Each deterministic fact retains a stable source identifier and navigation target. Duplicate source facts are suppressed before rendering.

The reasoning packet is assembled locally from the same snapshot. It uses pseudonymous driver references and compliance codes, omits names, email addresses, phone numbers, free-text notes, and raw evidence metadata, and states that it is not sent externally. `src/lib/atlasModelGateway.ts` is only a provider-neutral future interface. Atlas paid/model inference remains disabled: this batch makes no LLM/API/model call and adds no model gateway implementation.

The manager operations briefing now exposes a small deterministic query surface. It shows the selected intent, answer mode, facts, navigation targets, and—when applicable—the local reasoning packet boundary.

## POD upload hardening

The new `job_evidence_upload_intents` table and RPCs implement a two-phase flow:

1. `begin_job_evidence_upload` authenticates the actor, checks company and assignment scope, validates the filename, and returns a server-generated private storage path.
2. Storage insert is permitted only for that pending, exact-path intent and the authenticated uploader.
3. `finalize_job_evidence_upload` verifies the exact object owner, registers the evidence with provenance, and leaves job lifecycle unchanged.
4. `cleanup_failed_job_evidence_upload` can remove only the same actor’s recent pending object and marks the intent cleaned. Finalized evidence cannot be deleted through this path.

The old direct browser `create_job_evidence` execute grant was revoked. Evidence upload never completes a job; the governed lifecycle transition remains authoritative. Existing company-scoped review and private-bucket access remain in force.

## Authenticated operational verification

`tools/operational-smoke.mjs` and `npm.cmd run test:e2e:operations` provide a mutation-gated smoke runner for a disposable local or staging company. It authenticates separate manager and driver identities with the publishable key, verifies same-company scope, creates and publishes work through governed RPCs, assigns a ready trailer, proves a prohibited trailer is rejected, reads work as the driver, walks completed and unable-to-complete lifecycles, uploads and manager-reviews POD evidence, handles task-queue signals, and persists one deterministic Atlas observation.

The runner refuses production, refuses to run without `SMOKE_ALLOW_MUTATION=true`, and refuses service-role credentials. It requires explicit manager/driver credentials, a published shift, ready and prohibited trailer IDs, and records created by the disposable company must be reset after review. It was not run against a live environment in this validation pass because no disposable authenticated smoke credentials were supplied.

## Database and security

Migration `20260819060656_batch13_pod_upload_intents.sql` was created with `supabase migration new`, dry-run, and deployed as the only pending migration. New table access is RLS-protected; privileged functions derive actors from `auth.uid()`, enforce company scope, use `set search_path = public, pg_temp`, and receive deliberate authenticated execute grants. No service-role or `VITE_*` privileged key was added.

The generated contract in `src/lib/database.types.ts` was regenerated after deployment. Supabase security advisors were run after DDL; repository-wide pre-existing findings remain outside this Batch 13 surface and are recorded in the final handoff.

