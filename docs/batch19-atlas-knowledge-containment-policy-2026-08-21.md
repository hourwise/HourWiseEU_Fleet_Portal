# HourWise Fleet Portal — Batch 19

## Starting state

Batch 19 started from `main` at `8e251f497aa16cc070ddb76a4d3296b0e8cb4215`, the sealed Batch 18 documentation correction. The worktree was clean. Existing Batch 18 Atlas routing, disabled model admission, persisted signal observations, governed proposal paths, company-scoped operational loaders, and private inference policy tables were preserved.

This batch does not add live telemetry, conversational Atlas, paid inference, a model gateway, or a routing-provider integration.

## Deterministic Atlas knowledge layer

`src/lib/atlasKnowledge.ts` adds a typed language layer in front of the existing router:

- NFKC/lowercase/whitespace/punctuation normalization.
- A bounded UK fleet glossary covering VOR/off-road, lorry/unit/vehicle, POD/delivery notes, CPC/DQC, medical evidence, rota/shift, and unable-to-complete language.
- A catalogue of 34 canonical intents spanning morning sections, work/exception/task views, asset and trailer compliance, driver forecasting, POD review, proposals/health, and static FAQs.
- Deterministic temporal phrases for yesterday, today, tomorrow, next 7/14/30 days, this week, and next week.
- Deterministic confidence bands and clarification output. No probabilistic model is involved.
- Conservative entity extraction for vehicle registrations, trailer references, job/assignment references, driver labels, proposal/task IDs, and bounded dates/temporal phrases. Entity matching uses the supplied company snapshot where available; no cross-company lookup is introduced.
- Exact FAQ answers for VOR, POD, compliance evidence, and Atlas behavior, with stable navigation targets.
- Compound questions are retained as multiple canonical intents and clarified when the request spans more than one operational area.
- Negated safety/compliance wording is not guessed through: unsupported negation returns `unknown` rather than reversing a prohibition.
- Fuzzy matching is intentionally limited to glossary normalization; operational identifiers are not fuzzy-matched.

The existing `AtlasIntent` and source/fact contracts remain compatible. Legacy intents are selected for existing deterministic handlers, while the canonical intent, entities, confidence, and clarification metadata are retained on the route classification/answer.

The initial catalogue contains 34 canonical intents and the glossary plus explicit handler patterns provide a bounded first paraphrase set. Expanding the catalogue with owner-reviewed aliases remains a Batch 20 recommendation rather than introducing uncontrolled aliases in this batch.

## Static knowledge and operational handlers

FAQ responses are deterministic and do not query a model. Operational responses continue to use the existing authoritative Portal snapshot and handlers for:

- morning briefing, yesterday carry-over, today, tomorrow, and next-30-day sections;
- VOR/prohibited assets, readiness reasons, defects, asset/trailer compliance, and evidence gaps;
- acknowledgement, delayed/exception/incomplete jobs, operational tasks, and job evidence review;
- driver licence/CPC/medical compliance forecasts, including missing evidence and future planning risk;
- navigation targets and source provenance from existing fact/task records.

The underlying morning briefing continues to use stable signal fingerprints and persisted observations. An unchanged fingerprint remains known; a changed/new fingerprint is surfaced as new. Duplicate source signals are collapsed before presentation.

## Containment and cost boundary

`src/lib/atlasContainment.ts` provides the deterministic outcome contract, privacy-bounded FNV-style fingerprints, aggregate rate calculation, and the invariant that `NONE` plus `deterministic_answer` is free and not admitted to inference.

The new private `atlas_containment_daily` table stores only company/date/outcome/fingerprint aggregates and entity counts. It does not store raw questions. The authenticated manager-only RPC `record_atlas_containment_outcome` validates the bounded outcome and fingerprint shape before incrementing an aggregate.

The focused Batch 19 containment corpus covered deterministic, FAQ, clarification, and unresolved cases: 3 contained of 4 synthetic contract events, a deterministic containment rate of 75%. Every deterministic/FAQ/clarification event is required by the contract to use logical tier `NONE`, outcome `deterministic_answer`, and no provider admission. Unresolved/reasoning candidates remain visible as non-contained candidates and are not executed because the existing policy is disabled/provider-unconfigured.

## Governed AI policy administration

`src/lib/atlasPolicyAdministration.ts` and `AtlasPolicyAdministration.tsx` add a manager briefing surface backed only by governed RPCs. The surface is disabled by default and reports that no provider is configured. It does not expose private policy tables directly to the browser.

Migration `20260821214339_batch19_atlas_containment_policy_admin.sql`:

- adds `atlas.policy.admin` to the existing permission foundation and grants it to the current `fleet_administrator` role, which is the repository’s compatibility role for managers;
- adds `get_atlas_inference_policy()` and `update_atlas_inference_policy(...)` with company scope derived from `auth.uid()` and permission checks through `actor_has_permission`;
- keeps provider slot and cost admission inside the existing server-side policy seam;
- adds the private, RLS-enabled containment aggregate table and manager-only telemetry RPC;
- revokes anon/public function execution and grants only authenticated execution for the governed RPCs.

Deterministic Atlas remains available when the policy is disabled. Enabling the policy does not create a provider, fabricate a price, or cause a browser/API model call.

## Canonical signal → task projection

`src/lib/atlasSignalTaskContract.ts` defines canonical source identity, stable task keys, active/resolved projection, severity-preserving deduplication, and the one-source/one-task invariant. Existing operational task loading now adds a stable `sourceSignalKey` to fetched tasks while preserving existing task IDs and handling behavior.

Source-driven handling remains subordinate to the authoritative source: a resolved handling cannot suppress an active compliance/POD source, a source change reopens/reprojects the task, and a resolved source is not projected. Timeline source additions continue to use the existing typed timeline registry; Batch 19 adds no unregistered timeline source.

## Security and privacy

All new privileged functions derive the actor with `auth.uid()`, derive company scope server-side, use the current RBAC permission helper, set `search_path = public, private, pg_temp`, and have deliberate authenticated-only EXECUTE grants. Private policy and aggregate tables have RLS enabled, public/anon/authenticated table access revoked, and no browser service-role or `VITE_*` privileged secret is introduced. Unknown-question telemetry stores no raw question text.

## Migrations and database verification

- Created with `supabase migration new`.
- `supabase db push --dry-run --linked` showed exactly `20260821214339_batch19_atlas_containment_policy_admin.sql`.
- The expected migration was deployed and is present in local/remote migration history.
- Post-deployment SQL verification confirmed all three new RPCs are `SECURITY DEFINER` with `search_path=public, private, pg_temp`.
- Post-deployment SQL verification confirmed the three private Atlas tables have RLS enabled.
- Anon EXECUTE is false and authenticated EXECUTE is true for the new RPCs.
- Supabase security/performance advisors were run after DDL. The new private aggregate is reported as the expected informational `rls_enabled_no_policy` item because it is private, has no grants, and is accessed only by governed functions. Existing repository-wide advisor findings remain outside Batch 19 scope.
- `src/lib/database.types.ts` was regenerated from the deployed schema and contains the new public RPC contracts.

## Validation

- `npm.cmd run typecheck` — passed.
- `npm.cmd run test:rules` — 50 files / 328 tests passed.
- `npm.cmd test` — 57 files / 356 tests passed.
- `npm.cmd run build` — passed.
- Changed-file ESLint — passed with no Batch 19 findings.
- `npm.cmd run lint` — known baseline 103 errors / 7 warnings; no Batch 19 changed-file findings.
- `git diff --check` — passed.
- `SMOKE BLOCKED — ENVIRONMENT ONLY` — no authenticated production smoke credentials/session were available in this environment.

## Commits and push

The logical Batch 19 commits are:

- `96b9ecc` — `feat(atlas): add deterministic glossary and intent catalogue`
- `6ca2161` — `feat(atlas): add entity and compound query resolution`
- `634fc11` — `feat(atlas): add containment analytics`
- `483bbe8` — `feat(atlas): add governed AI policy administration`
- `9a14850` — `feat(operations): canonicalise signal task projection`

The documentation seal and generated database type update are the final Batch19 commit. The exact pushed HEAD is reported in the handoff alongside the push result.

## Remaining blockers

1. No production authenticated smoke run is available in this environment.
2. No approved inference provider or price table is configured; this is intentional for Batch 19.
3. The Supabase CLI in the repository is older than the current CLI and does not expose its local `db advisors` subcommand; the connected Supabase advisor API was used instead.
4. The private aggregate advisor informational finding is retained because the table is deliberately not browser-readable.

## Top five Batch 20 recommendations

1. Expand the owner-reviewed glossary and alias catalogue with measured, privacy-safe phrase coverage and explicit false-positive tests.
2. Add a governed containment analytics read surface for authorised administrators, with date ranges and no raw-question exposure.
3. Add authenticated staging smoke coverage for policy read/update denial, deterministic Atlas queries, POD review, and source-driven task reopening.
4. Add a formal adapter registry so every operational signal producer emits the canonical signal contract directly rather than relying on additive task projection.
5. Decide whether an approved inference provider is needed; if so, add a server-only gateway with a reviewed price table, usage ledger integration, redaction tests, and an explicit owner approval process.
