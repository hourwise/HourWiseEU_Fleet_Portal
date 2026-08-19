# HourWise Fleet Portal — Batch 14 Operational Proof, Atlas Proposals & Security

Date: 2026-08-19  
Starting point: `main` at `7b334d7c93452be7e9b3638d823b22e9e5ef39a5`  
Repository: `hourwise/HourWiseEU_Fleet_Portal`

## Starting state and deployment boundary

The worktree was clean, the checked-out branch was `main`, and `origin/main` matched the requested starting commit. Batch 13 migrations and application changes were already present and were not replayed or rewritten.

The linked Supabase project was used for migration dry-run, deployment, generated-contract refresh, live grant/RLS/search-path checks, cron verification, and security-advisor verification. Local Supabase could not be started because the Docker daemon was unavailable on the Windows workstation. No service-role key or smoke-user credentials were present in the workspace, so the linked project was not mutated with disposable smoke fixtures.

## Disposable operational proof harness

Two deliberately separate scripts now support proof in an approved local or staging environment:

- `tools/operational-smoke-fixtures.mjs` is the admin-only provision/reset path. It requires `SMOKE_FIXTURE_ENVIRONMENT=local|staging`, `SMOKE_FIXTURE_ALLOW_MUTATION=true`, a runtime-only `SMOKE_FIXTURE_SERVICE_ROLE_KEY`, a publishable Supabase URL, and a runtime-only `SMOKE_FIXTURE_PASSWORD`. It creates two companies, manager/driver/wrong-driver accounts, ready and VOR trailers, shifts, a cross-company assignment, and a cross-company storage object. It writes only a disposable manifest and browser-safe variable template; the service key is never emitted to browser variables.
- `tools/operational-smoke.mjs` is the browser-role path. It accepts only the publishable/anon key and signs in as manager, driver, and wrong driver. It refuses production, refuses service-role-looking keys, and covers both positive and negative authorization cases.

The intended disposable run is:

```text
SMOKE_FIXTURE_ENVIRONMENT=staging
SMOKE_FIXTURE_ALLOW_MUTATION=true
SMOKE_FIXTURE_SUPABASE_URL=<disposable-staging-url>
SMOKE_FIXTURE_SERVICE_ROLE_KEY=<runtime-only-service-key>
SMOKE_FIXTURE_PASSWORD=<runtime-only-disposable-password>
SMOKE_FIXTURE_MANIFEST=<runtime-only-manifest-path>
node tools/operational-smoke-fixtures.mjs create
```

Then export the printed browser variables and run `npm.cmd run test:e2e:operations`; finally run the printed reset command. That authenticated smoke was not executed in this batch because no disposable environment credentials were available and local Docker was unavailable. The negative paths are implemented and statically covered, but are not represented as a live-pass claim.

The smoke harness covers:

- manager read and governed trailer assignment;
- driver read and lifecycle transition for their own assignment;
- wrong-driver profile/read denial and lifecycle denial;
- cross-company assignment read denial and trailer mutation denial;
- VOR trailer assignment denial;
- cross-company POD download denial;
- finalized POD evidence cleanup denial;
- upload-intent creation and manager review without treating upload as job completion.

## Implemented vertical slices

### 1. Atlas governed proposals

`public.atlas_proposals` is an auditable, company-scoped proposal record with target identity, proposed change, evidence facts, source snapshot/version, deterministic validation status/reasons, origin, review state, reviewer decision, and apply outcome.

Supported proposal types are deliberately narrow:

- `change_trailer` maps only to `assign_trailer_to_job_assignment`;
- `change_shift_vehicle` maps only to `update_shift_with_asset_guard`;
- `acknowledge_task` maps only to `set_operational_task_handling`.

The UI in `AtlasProposalWorkbench` is manager-only and presents eligible alternatives rather than an asserted “best” answer. Proposal creation, revalidation, review, and outcome recording are separate governed routines. Approval requires a fresh valid revalidation. The apply path is an explicit client-side mapping to the existing governed RPCs; there is no generic Atlas write/apply function and no arbitrary table patch path.

The forward migration `20260819215131_batch14_atlas_task_revalidation.sql` adds current-source timestamp comparison for task proposals. Changes to a fleet event, job assignment, vehicle check, asset-readiness vehicle, shift, or driver profile make the proposal stale or invalid before approval. Asset proposals retain the existing company, lifecycle, active-driver, readiness, VOR/defect, collision, and shift constraint checks.

All proposal generation and validation is deterministic. There is no model gateway call, provider SDK, LLM/API inference, conversational Atlas, telemetry, routing credential, or paid AI inference in Batch 14.

### 2. Safe POD upload-intent reconciliation

`reconcile_expired_job_evidence_uploads(integer)` is a bounded, security-definer maintenance routine with fixed `search_path`. It processes pending intents older than two hours, uses `FOR UPDATE SKIP LOCKED`, enforces a 1–1000 batch limit, and changes only the intent state to `expired` while retaining provenance. Storage removal is exact-match only on the recorded bucket, full path, and uploader owner; there is no prefix delete. Finalized evidence is excluded. Each expiration is recorded in the security audit stream.

The routine is not callable by browser roles. It is granted to `postgres` for the scheduled job and is scheduled by `pg_cron` as `hourwise-pod-upload-intent-reconciliation` every 15 minutes. Upload remains two-phase, evidence remains tied to the actual assignment/job, and upload or reconciliation never marks a job complete; lifecycle transition remains authoritative.

### 3. Bounded security hardening

The Batch 14 security migration:

- fixes `public.update_updated_at_column()` to `search_path = public, pg_temp`;
- revokes public/anonymous/authenticated execution from trigger-only `prevent_role_escalation()`;
- revokes public/anonymous/authenticated execution from trigger-only `enforce_trailer_assignment_readiness()`.

Live checks confirmed the Atlas table has RLS enabled with only the manager company-scoped authenticated SELECT policy. Direct table inserts/updates/deletes are not granted to browser roles; writes go through the governed routines. New privileged routines use `auth.uid()` actor derivation and server-side company scope. No service-role or privileged browser key was added, and no `VITE_*` privileged secret was introduced.

## Security-advisor result

The recorded pre-change snapshot was 130 findings:

```text
rls_enabled_no_policy                              16
function_search_path_mutable                       15
anon_security_definer_function_executable          28
authenticated_security_definer_function_executable 70
auth_leaked_password_protection                     1
```

After deployment, the live snapshot was 129 findings:

```text
rls_enabled_no_policy                              16
function_search_path_mutable                       14
anon_security_definer_function_executable          26
authenticated_security_definer_function_executable 72
auth_leaked_password_protection                     1
```

The two additional authenticated security-definer findings are expected for the manager-facing governed Atlas proposal/review routines and are bounded by actor, role, company, target, validation, and audit checks. The remaining 16 no-policy findings and the leaked-password-protection setting are pre-existing follow-up work, not silently changed in this batch. Advisor remediation references: [RLS no-policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [mutable function search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [authenticated security-definer execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Migrations and generated contracts

Created with `supabase migration new`, dry-run verified, and deployed in this batch:

- `20260819211839_batch14_atlas_proposals.sql`
- `20260819211850_batch14_pod_reconciliation.sql`
- `20260819211858_batch14_security_hardening.sql`
- `20260819215131_batch14_atlas_task_revalidation.sql`

The dry-run showed only the four expected Batch 14 migrations at the time of deployment; no deployed migration was edited. `src/lib/database.types.ts` was regenerated after deployment and includes the Atlas table and RPC contracts.

## Validation

Passed:

- `npm.cmd run typecheck`
- `npm.cmd run test:rules` — 47 files, 311 tests
- `npm.cmd test` — 49 files, 319 tests
- `npm.cmd run build`
- changed-file ESLint for Batch 14 source, generated types, and smoke harness files
- `node --check` for both smoke scripts
- `git diff --check`

Full `npm.cmd run lint` remains non-zero at the documented repository baseline: 103 errors and 7 warnings. The output contains no Batch 14 changed-file error; the baseline errors are outside the Batch 14 scope.

## Actual smoke result and remaining blockers

The authenticated operational smoke result is **not executed**. This is a deliberate environment blocker, not a simulated pass: local Docker was unavailable, and no disposable staging/local service key, publishable key, or smoke credentials were supplied. The fixture and browser runners are ready for the next approved disposable-environment run.

For safety verification, an unconfigured `npm.cmd run test:e2e:operations` invocation was attempted and correctly stopped before creating a client or mutating data because `SMOKE_ENVIRONMENT` was not explicitly `local` or `staging`.

The remaining security-advisor follow-up is to review the 16 intentionally policy-less RLS tables, the 14 legacy mutable-search-path functions, the 26 legacy anonymous security-definer grants, the 72 authenticated security-definer grants, and leaked-password protection. Those are intentionally outside the bounded Batch 14 scope.

Batch 15 recommendations:

1. Execute the disposable authenticated smoke against a freshly isolated staging branch and archive the fixture manifest/result without retaining credentials.
2. Add a proposal event timeline and explicit stale-reason UI for manager review/audit export.
3. Add a scheduled reconciliation result/health surface with alerting for repeated storage cleanup failures.
4. Review the highest-risk legacy security-definer routines and convert or revoke them in small, tested groups.
5. Add end-to-end tests for proposal approval races, task-source changes between review and apply, and idempotent apply/outcome recording.
