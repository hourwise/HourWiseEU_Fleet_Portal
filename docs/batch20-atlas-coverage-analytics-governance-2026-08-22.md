# HourWise Fleet Portal — Batch 20 Atlas Coverage, Analytics & Governance

Date: 2026-08-22  
Repository: `hourwise/HourWiseEU_Fleet_Portal`  
Starting commit: `644d16bf89795263fac3d90e6ccad0fb2a447cab` (sealed Batch 19)

## Outcome

Batch 20 is implemented as four cohesive slices. Atlas remains deterministic and provider-free. No live AI/model API, provider credential, browser AI secret, telemetry stream, paid route provider, fake ETA/distance, or conversational Atlas path was added.

## Deterministic Atlas knowledge and benchmark

- Knowledge version: `2026-08-22.1`.
- Canonical intent surface: 34 intents, including the conservative `unknown` route.
- Reviewed phrase corpus: 330 owner-reviewed phrases across formal, informal, short, manager, industry, and grammar variants.
- Negative/unsupported/reasoning examples: 20.
- Deterministic FAQ entries: 15, with fixed answers and navigation targets.
- Benchmark: 374 cases: 330 reviewed phrases, 20 negative examples, and 24 edge cases.
- Edge coverage includes entity resolution, temporal questions, compounds, FAQ, typos, ambiguity, negation, unsupported requests, privacy boundaries, and reasoning-required prompts.

Final benchmark metrics:

| Metric | Result |
| --- | ---: |
| Correctly classified | 373 / 374 |
| False-positive deterministic answers | 0 |
| False-negative deterministic opportunities | 0 |
| Clarification accuracy | 100% |
| FAQ accuracy | 100% |
| Entity-resolution accuracy | 100% |
| Negation safety | 100% |
| Compound accuracy | 100% |
| Reasoning-required accuracy | 100% |
| Deterministic containment rate | 97.3262% |
| Routine operational containment rate | 100% |
| Unsafe containment rate | 0% |

Reviewed phrase matching is indexed and typo normalization is bounded to known operational corrections. Compounds over the supported deterministic boundary, legal/history questions, negation, unsupported requests, and planning requests remain clarification or reasoning routes rather than being guessed.

## Analytics and privacy

Migration `20260822060921_batch20_atlas_analytics_authority.sql` adds the governed, company-scoped `get_atlas_containment_analytics(date,date)` read surface. It returns daily aggregate counts for deterministic answers, FAQs, clarifications, reasoning candidates, unknown questions, entity resolution, compounds, and containment rate across a maximum 31-day range. Raw question text is never stored or returned; the existing bounded fingerprint is only an internal aggregate upsert key and is not exposed by the read surface.

The analytics RPC derives the actor from `auth.uid()`, resolves the server-side company, requires `atlas.policy.admin`, uses `SECURITY DEFINER` with `search_path = public, private, pg_temp`, revokes anonymous/public execution, and grants deliberate execution only to `authenticated`. The manager screen displays aggregate counts only.

## Canonical signal producers

`SIGNAL_PRODUCER_REGISTRY` now defines nine adapters for:

1. driver compliance
2. POD review
3. asset readiness
4. asset compliance
5. job acknowledgement
6. job exception
7. tachograph warning
8. reconciliation health
9. Atlas proposal

Each adapter defines company/source identity, state fingerprint, navigation, and authoritative resolution semantics. Company-scoped signal and task keys prevent cross-company collisions. Existing source-driven task handling and lifecycle transitions remain authoritative; the registry is an adapter/contract surface and does not invent source evidence or mutate jobs. Duplicate review tests cover stable identity, changed fingerprints, resolution suppression, and same-source/different-company isolation.

## Policy versus paid activation authority

`atlas.policy.admin` remains a governed policy-administration permission for `fleet_administrator`; it is not permanent paid-spending authority. The database policy now records `paid_inference_activation_authority`, which is `unavailable` in this release. No role was granted `atlas.inference.activate`.

The future admission interlock is explicit and ordered: deterministic `NONE` containment first; approved tier; provider and price table; policy enabled; request/day/month limits; separate paid activation authority; server-side privacy-redaction pass; request cost cap; per-request and monthly budget. In Batch 20 the provider and paid authority are absent, so the gateway cannot call anything and returns a deterministic boundary outcome. No model gateway or paid inference implementation was added.

## Migration, security and generated types

- Created the migration with `supabase migration new`; no deployed migration was edited or replayed.
- `supabase db push --dry-run --linked` showed only `20260822060921_batch20_atlas_analytics_authority.sql` pending.
- The expected migration was deployed successfully.
- Private Atlas policy/containment tables retain RLS and revoked table access; access is through guarded RPCs only. The security advisor reports the existing intentional `private` RLS-without-table-policy informational finding for server-only tables, plus the repository’s existing baseline findings; there is no Batch 20 public table surface.
- Post-DDL security and performance advisors were run.
- `src/lib/database.types.ts` was regenerated from the deployed schema.
- No `service_role` or privileged browser secret was added, and no `VITE_*` privileged key was introduced.

## Validation

- `npm.cmd run typecheck` — passed.
- `npm.cmd run test:rules` — 52 files / 336 tests passed.
- `npm.cmd test` — 58 files / 362 tests passed.
- `npm.cmd run build` — passed.
- Changed-file ESLint — passed with no Batch 20 findings.
- `npm.cmd run lint` — known repository baseline: 103 errors / 7 warnings; no Batch 20 changed-file findings.
- `git diff --check` — passed.
- Smoke: `SMOKE BLOCKED — ENVIRONMENT ONLY`.

## Logical commits

The implementation slices are:

- `8dbe861` — `feat(atlas): expand deterministic question coverage`
- `54dbf90` — `feat(atlas): separate policy and spending authority`
- `8f9ee8a` — `test(atlas): add containment benchmark corpus`
- `bbadaca` — `feat(operations): register canonical signal producers`

The final documentation seal is committed separately after this report is added. The final pushed HEAD is recorded in the delivery handoff after that seal commit.

## Remaining blockers

- Live smoke remains environment-only blocked.
- A provider-neutral future server gateway still needs an approved provider, price table, privacy-redaction implementation, budget ledger integration, and a real owner/billing activation authority source before any paid inference can be considered.
- Existing repository-wide lint debt remains outside Batch 20 scope.

## Top five Batch 21 recommendations

1. Add a server-only activation authority sourced from an explicit organisation owner or billing workflow, with audit and revocation tests.
2. Expand the reviewed corpus with production-derived, privacy-redacted ambiguity cases and human acceptance review, preserving the versioned benchmark contract.
3. Connect all remaining operational load producers to the canonical signal registry and publish a duplicate-suppression audit report.
4. Add a deterministic analytics retention/roll-up policy and manager export that remains aggregate-only.
5. Run the protected operational smoke suite in a configured environment, including cross-company and storage-access probes.
