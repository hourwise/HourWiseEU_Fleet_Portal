# HourWise Fleet Portal — Batch 17

Date: 2026-08-20  
Repository: `hourwise/HourWiseEU_Fleet_Portal`  
Starting commit: `25c76dcd77c792b4695d90278991f7b47d48a031`  
Database project: `lcvahjmoobmpifrexurb`

## Starting state

The worktree started clean on `main` at the requested Batch 16 deployment commit, with `origin/main` aligned. Batch 16 had already deployed deterministic Atlas operations, POD health and retention, driver compliance forecasting, trailer assignment/readiness guards, the unified timeline projection, and a provider-neutral route contract.

The live security advisor baseline was 93 findings: 16 RLS-enabled internal tables without browser policies, 3 intentional anonymous onboarding functions, 73 authenticated SECURITY DEFINER execution notices, and 1 leaked-password-protection warning. Mutable function search-path findings were already at zero.

## Implemented slices

### 1. POD reconciliation drill-down and tenant-boundary hardening

Migration `20260820212642_batch17_pod_drilldown_timeline_links.sql` adds manager-only `list_pod_reconciliation_drilldown(p_signal_key, p_limit)`. It starts from authoritative `job_evidence_upload_intents`, joins same-company `jobs`, and returns bounded job reference/title context, deterministic reconciliation category/severity, a recommended action, and the stable `job_assignment` navigation key.

The response does not expose storage bucket/path, original file name, uploader identity, raw cleanup text, or storage internals. It does not retry cleanup, delete evidence, or transition the job lifecycle. The manager UI expands an alert into affected jobs and links to the existing job workflow.

Migration `20260820213943_batch17_pod_health_company_scope.sql` replaces the existing POD health projection so stale pending-intent counts use `company_id = actor_company_id`. The run ledger remains explicitly treated as global scheduler metadata because the existing reconciliation cron writes one platform maintenance run for its bounded batch.

### 2. Typed operational timeline source-link registry

Migration `20260820212800_batch17_timeline_source_registry.sql` replaces the timeline projection shape so source rows return a small `navigationKey` and explicit `relationships` object rather than database-generated URLs. Labels are privacy-bounded and richer where authoritative joins exist: job references are used for assignments/POD, vehicle registration is used for vehicle proposals, and driver document events remain a generic “Driver compliance evidence” label. Names, addresses, customer contacts, raw notes, metadata, and storage values are not added.

`operationalTimeline.ts` owns `TIMELINE_SOURCE_LINK_REGISTRY`, validates UUID relationship values, maps known sources to existing Portal workspaces, and returns `null` for unknown sources. The timeline UI renders no link for an unknown source and no longer trusts a URL from the database. Relationship IDs remain explicit and are only used as bounded filter/navigation context.

### 3. Security-definer inventory and proven hardening

The remaining public SECURITY DEFINER routines were inventoried from live `pg_proc` definitions, privileges, fixed search-path configuration, and repository callers. The authenticated tacho bundle, company signal, vehicle timeline, driver timeline, import, and asset policy functions all already derive the actor company from `auth.uid()`, enforce the current manager/RBAC permission, and validate the requested driver/vehicle/import ownership. They were documented rather than rewritten speculatively.

The bounded legacy findings are classified as follows:

- superseded/revoked overloads: old UUID invite acceptance, direct job assignment/event creation, direct job evidence creation, and pre-Batch15 Atlas outcome recording;
- internal-only maintenance/trigger helpers: tachograph runtime configuration, reconciliation cleanup, run retention, security-event recording, trigger functions, and private unchecked helpers;
- governed authenticated routines: current manager/driver/vehicle/tacho/POD/proposal/task workflows with deliberate execution and server-side checks.

The concrete proven risk found in this batch was the unscoped stale POD backlog count; it is now company-scoped in the third migration. No live provider credential, service-role browser secret, privileged `VITE_*` key, telemetry, model gateway, or AI inference code was added.

## Atlas and routing decision

Atlas remains deterministic and zero-inference. This batch did not add a model call, LLM/API inference, conversational Atlas, arbitrary Atlas write authority, or paid AI inference. Existing deterministic signals, stable fingerprints, suppression, severity, and navigation rules remain authoritative.

One realistic HGV provider candidate was evaluated: HERE Routing API v8. HERE documents truck routing with dimensions, weights, axle weight, hazardous goods, and tunnel restrictions, including the need to describe the complete vehicle/trailer combination in the vehicle properties. Its public Limited/Base plan page also excludes asset-management and optimization use cases and publishes request-rate limits. That is not an approved production basis for a fleet SaaS product without commercial/product approval. TomTom documentation was checked as a comparison for truck dimensions and restrictions, but no provider was selected because current commercial suitability, price, SLA, and approved server credentials were not established for this project.

The route adapter therefore remains `unconfigured`: no paid request, fake distance/duration/ETA, browser key, or server endpoint was added. A future choice must record provider, plan/use-case approval, secret storage, capability validation, cost limits, and a disposable integration proof before activation.

## Migrations and security verification

All three migrations were created with `supabase migration new`, dry-run, deployed, and then checked live:

1. `20260820212642_batch17_pod_drilldown_timeline_links.sql`
2. `20260820212800_batch17_timeline_source_registry.sql`
3. `20260820213943_batch17_pod_health_company_scope.sql`

Live checks confirmed the new/changed manager functions have fixed `search_path = public, pg_temp`, authenticated execution only, no anonymous execute, and server-side manager/company guards. Security advisors remain at the known 93-finding baseline; no new mutable search-path finding was introduced.

## Validation

- `npm.cmd run typecheck` — passed.
- `npm.cmd run test:rules` — passed, 48 files / 318 tests.
- `npm.cmd test` — passed, 52 files / 338 tests, including the Batch 17 contracts.
- `npm.cmd run build` — passed; only the existing large-chunk advisory was emitted.
- Changed-file ESLint — passed with no findings.
- `npm.cmd run lint` — reports the known repository baseline: 103 errors / 7 warnings outside the changed-file scope.
- `git diff --check` — passed.
- `src/lib/database.types.ts` regenerated from the deployed schema and contains `list_pod_reconciliation_drilldown` and the timeline RPC.

Operational smoke/race proof was not run: `SMOKE BLOCKED — ENVIRONMENT ONLY`. The disposable authenticated smoke URL, manager credentials, and fixture service-role key were absent from the environment. No repeated environment setup or external provider call was attempted.

## Commits and push

Logical Batch 17 commits are intended to be:

- `fix(security): harden legacy governed function surface`
- `feat(operations): add POD reconciliation drilldown`
- `feat(operations): enrich operational timeline links`
- `docs(routes): record provider decision boundary`
- final Batch 17 validation/documentation commit.

The final commit SHA and push result are recorded in the handoff after all validation gates pass.

## Remaining blockers

1. Authenticated disposable smoke/race validation remains blocked by missing environment-only variables.
2. The 73 authenticated SECURITY DEFINER advisor notices still require owner-reviewed disposition; this batch inventoried them and changed only the proven POD company-scope gap.
3. The 16 policyless internal/tachograph RLS tables need an owner-confirmed service/runtime policy decision.
4. Leaked-password protection remains an account-level Auth setting.
5. Routing remains intentionally unconfigured pending commercial, credential, capability, and cost approval.

## Top five Batch 18 recommendations

1. Provide a disposable authenticated environment and prove cross-company isolation plus race behaviour for POD review, timeline access, task handling, and trailer assignment.
2. Finish owner-reviewed disposition of the remaining authenticated SECURITY DEFINER routines, prioritising high-risk write paths and old overload cleanup.
3. Add a first-class manager POD evidence review drill-down with assignment-level review status and controlled review notes, without exposing storage internals.
4. Add a typed timeline source registry for new sources through contract tests before any new operational source is projected.
5. Decide on a server-only routing provider and commercial plan, then implement capability/cost guards and a disposable integration test before enabling paid calls.
