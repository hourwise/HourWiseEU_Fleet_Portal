# HourWise Fleet Portal — Batch 18

Date: 2026-08-20  
Starting commit: `11ebb0edaf2ffb5c193e7564154a24399bf5b410`  
Repository: `hourwise/HourWiseEU_Fleet_Portal`  
Database project: `lcvahjmoobmpifrexurb`

## Starting state

Batch 17 was complete, pushed on `main`, and the worktree was clean at the requested commit. Its three migrations were already deployed. The prior validation baseline was typecheck, rules, full tests, build, changed-file ESLint, and diff check passing; full-repository lint remained at 103 errors / 7 warnings outside changed-file scope. The live security advisor baseline was 93 findings: 16 internal policyless RLS tables, 3 intentional anonymous onboarding functions, 73 authenticated SECURITY DEFINER notices, and one account-level leaked-password-protection setting.

## Implemented slices

### 1. Governed POD review workflow

`20260820222823_batch18_pod_governed_review.sql` adds:

- `review_job_evidence_governed`, a manager-only, same-company RPC deriving the actor from `auth.uid()`;
- row locking with `FOR UPDATE` and an optional expected `updated_at` freshness check;
- explicit outcomes `reviewed`, `already_reviewed`, `stale`, `permission_denied`, and `invalid_state`;
- bounded notes (2,000 characters) with HTML/script markers rejected;
- idempotent repeat decisions that do not write a second review audit event;
- no mutation of `job_assignments.status` or any job lifecycle transition;
- `list_manager_pod_review_queue` with status, job, and uploaded-date filters, bounded same-company joins, job reference/title, assignment lifecycle state, evidence type/outcome, provenance, reviewer state, and no storage bucket/path or raw metadata.

`src/components/manager/PodReviewQueue.tsx` provides the manager queue with filters, deterministic review actions, notes, lifecycle display, and 60-second signed evidence viewing. Protected storage remains private; the UI never displays a raw storage path. The existing per-assignment review panel now routes through the governed RPC wrapper as well.

Pending and follow-up evidence also project one stable `pod-review:<evidence-id>` operational task and Atlas signal. A resolved handling is reopened while authoritative review is still pending/follow-up; accepted or rejected evidence removes the active projected task. The signal fingerprint is based on review state and `updated_at`, preventing unchanged warnings from being surfaced as new.

### 2. Deterministic-first Atlas inference/cost gateway foundation

`src/lib/atlasModelGateway.ts` now defines logical tiers `NONE`, `SYNTHESIS`, `STANDARD`, `DEEP`, and `FALLBACK`, cost classes `free`, `low`, `medium`, and `high`, company policy fields, usage summaries, and explicit admission outcomes:

- `deterministic_answer`
- `inference_disabled`
- `tier_not_allowed`
- `budget_exceeded`
- `daily_limit_reached`
- `monthly_limit_reached`
- `provider_not_configured`
- `reasoning_required`

Deterministic briefing and Portal fact questions route to `NONE` and have a zero-cost result. Non-zero tiers have a cost band, but no currency amount is fabricated until an approved provider price table exists. `DisabledAtlasModelGateway` is a provider-neutral seam that returns a truthful disabled result and makes no network call.

`20260820222832_batch18_atlas_inference_policy.sql` stores future company policy and usage-ledger contracts in the private schema. Both tables are RLS-enabled and revoked from browser roles. They contain no prompt/response bodies. A follow-on migration, `20260820223951_batch18_review_lint_cleanup.sql`, removes the one new unused-variable warning without editing the deployed migration.

Atlas remains zero-inference in Batch 18: no LLM/API request, model gateway call, paid provider, browser secret, arbitrary SQL/RPC execution, telemetry, or conversational Atlas was added. The existing bounded reasoning packet now identifies intent rather than returning the raw question and uses pseudonymous references, status codes, and deterministic constraints.

### 3. Timeline source contracts and route cache identity

`TIMELINE_SOURCE_DEFINITIONS` now registers every Batch 17 database projection source (`fleet_events`, `atlas_proposals`, `security_permission_audit_events`, `operational_task_handlings`, `job_evidence`, and `driver_documents`) with typed categories, label/navigation builders, privacy exclusions, and supported UUID relationships. Unknown sources return no navigation target; arbitrary URLs are never accepted. Contract tests compare the SQL projection source list with the frontend registry and protect storage/identity/private-note exclusions.

Route planning now supports a trailer routing profile and `buildRouteRequestFingerprint`. Stop order, vehicle profile, trailer profile, route options, provider version, and provider capability declarations all invalidate the cache identity. Rendering a stored route remains local and never charges or calls a provider.

### 4. Owner-reviewable security disposition

The full disposition record is [batch18-security-definer-disposition-2026-08-20.md](batch18-security-definer-disposition-2026-08-20.md). Batch 18 retains only proven governed boundaries, documents internal/maintenance helpers, marks legacy paths as revoke/defer/remove after caller proof, and adds no permissive RLS policies merely to silence an advisor.

## Atlas morning briefing rules

The morning briefing is still built entirely from authoritative Portal state and persisted signal observations:

- `Yesterday`: unresolved carry-over from the previous date;
- `Today`: current work, acknowledgements, execution exceptions, readiness, and POD review state;
- `Tomorrow`: assignment, acknowledgement, and compliance conflicts;
- `Next 30 Days`: deterministic 7/14/30-day compliance warnings, with missing evidence separate from expiry forecasting.

Each signal retains a stable key, fingerprint, severity, source label, and navigation target. The observation ledger decides whether a signal is newly surfaced; unchanged fingerprints are known, not new. POD review and the operational task queue use the same evidence identity and source state, preventing duplicate cards across task/compliance/lifecycle projections. Follow-up wording stays deterministic and explicitly avoids claims about future illegality, live location, ETA, or driver capacity.

## Routing provider decision

No provider is enabled or called. The current commercial/technical shortlist is:

| Provider | Technical fit | Commercial state | Evidence reviewed |
|---|---|---|---|
| HERE Routing API v8 | `TECHNICALLY_SUITABLE — COMMERCIAL APPROVAL REQUIRED`: truck mode, vehicle dimensions/weights/axle data, traffic, tolls, zones, waypoints, and route planning APIs are documented. Trailer/combination properties must be represented in the vehicle profile. | Limited/Base terms include published RPS limits and exclude asset-management use cases; production fleet SaaS terms, SLA, attribution, resale, and predictable price need approval. | [HERE truck routing](https://docs.here.com/routing/docs/routing-v8-truck-routing), [HERE vehicle properties](https://docs.here.com/routing/docs/routing-v8-vehicle-properties), [HERE RPS limits and excluded use cases](https://www.here.com/get-started/pricing/rps-limits-excluded-use-cases) |
| TomTom Routing API | `TECHNICALLY_SUITABLE — COMMERCIAL APPROVAL REQUIRED`: official routing documentation exposes commercial vehicle, dimensions, weight, load type, ADR tunnel restrictions, traffic, and batch/matrix patterns. | Current plan/price, SLA, asset-management/resale rights, and server credential approval are not established in this batch. | [TomTom truck vehicle model](https://developer.tomtom.com/assets/downloads/tomtom-sdks/android/api-reference/0.3.602/routing/common/com.tomtom.sdk.routing.common.options.vehicle/-vehicle/-truck/-truck.html), [TomTom reachable range parameters](https://developer.tomtom.com/routing-api/documentation/tomtom-maps/calculate-reachable-range) |
| PTV Developer / xServer | `TECHNICALLY_SUITABLE — COMMERCIAL APPROVAL REQUIRED`: HGV dimensions, weight, hazmat/access restrictions, traffic, tolls, working/rest constraints, trailers, optimization, and cloud/on-premise options are documented. | Free trial/quotas exist, but production plan, SLA, rate limits, use-case offer, attribution/resale, and predictable pricing require a quote and owner approval. | [PTV Developer truck routing](https://www.ptvlogistics.com/en-us/products/ptv-developer), [PTV logistics developer APIs](https://www.ptvlogistics.com/en/logistics-developer-apis), [PTV API rate-limit guidance](https://support.ptvlogistics.com/hc/en-001/articles/21354677083420-PTV-Developer-Are-there-any-rate-limits-to-the-calculation) |

PTV is the additional UK/EU HGV candidate retained for commercial evaluation because its official materials explicitly cover professional freight restrictions, trailers, tolls, working/rest constraints, and cloud/on-premise deployment. It is not approved for implementation until commercial terms and a disposable server-side proof are signed off.

Cost scenarios are intentionally expressed as request-volume scenarios rather than invented prices. For 10, 50, and 200 fleets, the future cost model must count initial route calculations, stop/order changes, vehicle/trailer/dimension changes, provider-version changes, and stale recalculations; it should reuse a fingerprinted cache for unchanged inputs, batch/matrix calls where the selected provider contract allows it, and never charge for rendering or local display. Price per request, quota, rate, SLA, and cache/resale treatment remain provider-specific approval fields.

## Migrations and security

Created with `supabase migration new`, dry-run before each deployment, and deployed only as the expected Batch 18 migrations:

1. `20260820222823_batch18_pod_governed_review.sql`
2. `20260820222832_batch18_atlas_inference_policy.sql`
3. `20260820223951_batch18_review_lint_cleanup.sql` (post-deploy warning cleanup)

Post-deploy linked database lint reports no issue for the Batch 18 functions after the cleanup migration. Existing legacy lint errors remain in older functions (`rotate_company_auth_code`, storage-owner comparisons in old POD helpers, Atlas proposal ambiguity, POD health ambiguity, and unrelated tachograph warning) and were not replayed or broadened. The private Atlas tables have RLS, no browser grants, and no public RPC. Database types were regenerated after deployment.

## Validation

- `npm.cmd run typecheck` — passed.
- `npm.cmd run test:rules` — passed: 50 files / 327 tests.
- `npm.cmd test` — passed: 54 files / 347 tests.
- `npm.cmd run build` — passed.
- Changed-file ESLint — passed with no Batch 18 changed-file findings.
- `npm.cmd run lint` — known baseline: 103 errors / 7 warnings, with no Batch 18 changed-file findings.
- `git diff --check` — passed.
- `src/lib/database.types.ts` was regenerated from the deployed schema.

Authenticated disposable smoke/race was checked once. Required environment variables were not available, so the exact disposition is: `SMOKE BLOCKED — ENVIRONMENT ONLY`. No service-role credential or production mutation was attempted.

## Commits, push, and blockers

The final logical commits were pushed to `main`:

- `bdd2afe` — `feat(pod): complete governed evidence review workflow`
- `591a828` — `feat(atlas): add inference policy and cost router foundation`
- `10cc45d` — `test(operations): enforce timeline source contracts`
- `dbe1828` — `fix(security): apply owner-reviewed function disposition`

Final pushed HEAD: `dbe1828a956e9764d7f2f113f9fa6508515a1ccc`.

No Batch 19 work is included.

Remaining blockers:

1. Authenticated disposable smoke/race proof needs a safe local/staging fixture environment.
2. Production routing provider, pricing, SLA, attribution/resale, and server-secret approval are still outstanding.
3. Owner confirmation is still needed for deferred legacy SECURITY DEFINER compatibility paths and the 16 internal policyless RLS tables.
4. The account-level leaked-password-protection setting remains outside migration scope.
5. Full-repository lint retains the known unrelated baseline until those files are separately owned.

## Top five Batch 19 recommendations

1. Run the disposable authenticated POD review race matrix: same decision, conflicting decision, stale update, cross-company access, signed-view expiry, and follow-up resolution.
2. Add an owner-approved policy administration surface for the private Atlas gateway, still default-disabled and without enabling a provider.
3. Complete the live SECURITY DEFINER caller inventory and revoke the legacy review/compatibility grants only after mobile/external clients are proved migrated.
4. Execute a provider-neutral routing capability conformance suite against a commercial sandbox, including trailer combination, ADR/tunnel, bridge/height, toll, waypoint, quota, cache, and attribution checks.
5. Reconcile all timeline sources added after Batch 17 through the typed source registry and add a single canonical signal-to-task projection contract for future operational domains.
