# HourWise Fleet Portal — Batch 16

Date: 2026-08-20  
Repository: `hourwise/HourWiseEU_Fleet_Portal`  
Starting commit: `21bb203b8537f0e56b31e16625b7c2c4d027c57f`  
Database project: `lcvahjmoobmpifrexurb`

## Starting state

The worktree started clean on `main` at the requested Batch 15 commit, with `origin/main` aligned. Batch 15’s Atlas proposal apply boundary, POD reconciliation health, task handling, trailer assignment guards, deterministic Atlas morning briefing, and provider-free route planning were already deployed.

The pre-Batch 16 security advisor snapshot contained 124 findings:

- 16 RLS-enabled tables with no policies;
- 11 mutable function search paths;
- 19 anonymous SECURITY DEFINER execution findings;
- 77 authenticated SECURITY DEFINER execution findings;
- 1 leaked-password protection warning.

The existing operational history UI was a narrow browser-side `fleet_events` view. There was no duplicate timeline table, and no single bounded manager projection across proposals, task handling, POD, driver documents, and security audit decisions.

## Implemented vertical slices

### 1. Unified manager operational timeline

Migration `20260820204758_batch16_operational_timeline.sql` adds indexes to the existing source tables and creates the manager-only `list_manager_operational_timeline` projection RPC. It does not add an event store or copy source records.

The projection joins these authoritative sources:

| Category | Source | Projection purpose |
| --- | --- | --- |
| job / assignment | `fleet_events`, `job_assignments`, `shifts` | Lifecycle event, shift, assignment, acknowledgement, and exception history |
| proposal | `atlas_proposals`, proposal-linked security audit records | Governed Atlas review/apply/reject history |
| task | `operational_task_handlings` | Manager handling state, without replacing source truth |
| POD | `job_evidence`, `job_assignments` | Upload and review history tied to an actual assignment |
| compliance | `driver_documents` | Driver evidence-recorded history |
| security | `security_permission_audit_events` | Bounded decision history with no raw metadata |

The RPC derives company scope from the authenticated actor and checks the current manager role server-side. It has fixed `search_path`, a maximum page size of 100, descending cursor pagination by `(occurred_at, source_id)`, optional date/category/event/driver/vehicle/trailer/assignment/proposal/task filters, and an unresolved-only filter. The returned shape contains stable source identifiers, actor/entity labels, severity, summary, related proposal/event IDs, and navigation targets. Raw payloads, metadata, storage paths, and document contents are not returned.

`OperationalTimeline` is mounted inside the manager operations briefing. It displays bounded source labels and IDs and follows only server-provided navigation targets.

### 2. POD reconciliation alerting and retention

Migration `20260820204801_batch16_pod_alerting_retention.sql` adds:

- `prune_pod_reconciliation_runs(180, 500)`, callable only by the database maintenance role;
- a daily `hourwise-pod-reconciliation-retention` cron at `17 2 * * *`;
- a replacement `get_pod_reconciliation_health()` summary with deterministic thresholds and stable alert fingerprints.

The retention job deletes only old completed reconciliation-run metadata outside the latest 500 retained runs. It never deletes `job_evidence` or `job_evidence_upload_intents`. The existing 15-minute reconciliation cron remains active.

Thresholds are centralised in the health RPC:

- warning: 3 consecutive failures/partials, 24-hour stale backlog, or 45-minute overdue run;
- critical: 6 consecutive failures/partials, 72-hour stale backlog, or 90-minute overdue run.

Stable alert keys include `pod-reconciliation:consecutive-failures`, `pod-reconciliation:consecutive-partials`, `pod-reconciliation:stale-backlog`, `pod-reconciliation:overdue`, and `pod-reconciliation:storage-outcome`. The UI persists these through the existing Atlas signal-observation mechanism, so an unchanged alert is known rather than repeatedly presented as new. Atlas consumes the same alert facts without a second inference path.

### 3. Driver document compliance depth and source-driven task handling

The forecast continues to use only fields already present in Portal state:

- `profiles.driving_licence_number` and `profiles.driving_licence_expiry`;
- `profiles.cpc_dqc_number` and `profiles.cpc_dqc_expiry`;
- `driver_documents` records whose `document_type` matches the existing medical/D4 convention, including `expiry_date` and `verified_at`.

Medical selection is deterministic: dated medical/D4 documents take precedence over undated records, then the latest expiry, verification presence, and stable document ID break ties. No-expiry medical evidence is reported as `unknown` with missing evidence quality, separately from no medical document (`missing`). Licence/CPC/medical expiry, missing evidence, and future assignment-after-expiry conflicts remain separate signals. A future conflict is explicitly a planning warning and does not claim future illegality.

Driver compliance produces one canonical task per driver. The browser projection reopens an old resolved handling while the authoritative forecast still projects an actionable compliance task. Migration `20260820204802_batch16_compliance_security_hardening.sql` adds a fixed-search-path trigger that rejects resolving an active driver-compliance task while the authoritative licence, CPC/DQC, or medical evidence remains missing/expired. Inactive or no-longer-driver profiles are not blocked by that trigger.

### 4. Provider-neutral routing boundary and bounded security review

`routePlanning.ts` now exposes a provider-neutral adapter contract, capability declaration, route options, structured provider errors, and capability validation. The current provider remains `unconfigured`. No provider is selected, no paid request is made, and no distance, duration, ETA, live location, or traffic value is fabricated. Vehicle dimensions and restrictions remain explicit/unknown rather than assumed. Any future provider credential is expected to remain server-only.

The security migration pins the remaining reviewed mutable search paths and removes inherited browser execution from the old UUID-based invite overload, storage helpers, tacho maintenance actions, and trigger/event-trigger helpers. The invite-code onboarding function, pending-invite lookup, and auth-code validation remain intentionally exposed for the existing onboarding flow; this is documented rather than silently broken.

## Atlas morning briefing

Atlas remains deterministic and zero-inference. The briefing is constructed from Portal rows, source events, date arithmetic, stable signal keys/fingerprints, and persisted observations. There is no LLM call, model SDK call, paid AI inference, conversational agent, or model gateway invocation in this batch.

The four sections retain their existing meaning:

- **Yesterday — unresolved carry-over:** unacknowledged events, unresolved execution exceptions, and prior-day unresolved operational signals;
- **Today — work and current exceptions:** today’s rota/job work, readiness blockers, current exceptions, and current POD/reconciliation alerts;
- **Tomorrow — assignment/acknowledgement/compliance conflicts:** tomorrow’s unacknowledged or conflicting assignment/compliance signals;
- **Next 30 Days — new warnings:** deterministic 7/14/30-day compliance warnings and other near-term forecast signals.

Each signal has a stable key and fingerprint. `sync_atlas_signal_observations` marks whether that fingerprint is newly surfaced or already known; unchanged warnings are not marked new. Signal construction suppresses duplicates at the canonical signal-key layer, while the existing source-specific projections prevent lifecycle/task/compliance duplicates from becoming separate Atlas cards. Severity and navigation targets remain deterministic. Explanatory follow-ups are fixed Portal copy, not generated text.

## Migrations and security

The following migrations were created with `supabase migration new`, dry-run, deployed, and verified:

1. `20260820204758_batch16_operational_timeline.sql`
2. `20260820204801_batch16_pod_alerting_retention.sql`
3. `20260820204802_batch16_compliance_security_hardening.sql`

Live verification confirmed all three migration versions, both POD cron jobs, fixed search paths on the new SECURITY DEFINER functions, deliberate authenticated execution for manager RPCs, and no anonymous access to the timeline, compliance trigger, or maintenance-only functions.

The 16 policyless RLS tables remain classified as internal/service-ledger or tachograph processing stores with no browser grants. They are not exposed through the new timeline RPC. The leaked-password protection advisor remains an account-level configuration decision and was not changed by a migration.

Post-deployment security advisors reported 93 findings: 16 policyless internal tables, 3 intentional anonymous onboarding findings, 73 existing authenticated SECURITY DEFINER findings, and 1 leaked-password protection warning. Mutable search-path findings fell from 11 to 0. The remaining authenticated findings include the new manager-only functions because Supabase’s advisor intentionally flags authenticated execution of SECURITY DEFINER functions even when server-side role/company checks and fixed paths are present.

No service-role key or privileged browser key was added. No `VITE_*` privileged credential was introduced.

## Validation

- `npm.cmd run typecheck` — passed.
- `npm.cmd run test:rules` — passed, 48 files / 318 tests.
- `npm.cmd test` — passed, 51 files / 335 tests.
- `npm.cmd run build` — passed. Vite emitted only the existing large-chunk advisory.
- Changed-file ESLint — passed with no findings.
- `npm.cmd run lint` — reports the known repository baseline: 103 errors / 7 warnings outside Batch 16 changed-file scope.
- `git diff --check` — passed.
- Database types regenerated from the deployed schema; `src/lib/database.types.ts` contains the new timeline RPC.

Operational smoke was not run: `SMOKE BLOCKED — ENVIRONMENT ONLY`. The disposable smoke base URL, manager credentials, and fixture service-role key were not present in the environment. No live telemetry or external routing provider was introduced as a substitute.

## Commits and push

Logical commits created for handoff:

- `feat(operations): add unified event timeline`
- `feat(compliance): deepen driver document forecasting`
- `feat(operations): add reconciliation alerting`
- `fix(security): reduce legacy privileged exposure`
- `feat(routes): prepare provider-neutral route adapter`
- documentation and validation report commit.

Commit SHAs for the five logical implementation slices: `fa5f553`, `43b89d5`, `990ccb6`, `cf06a30`, `0a99c73`. This report and the regression/type artifacts are the final documentation commit in the series; the pushed commit is recorded in the agent handoff. No Batch 17 implementation is included.

## Remaining blockers

1. Disposable authenticated smoke/race validation is blocked by missing environment-only smoke variables.
2. The 73 existing authenticated SECURITY DEFINER advisor findings require a separate bounded inventory; Batch 16 reduced the highest-risk reviewed set but did not replay or rewrite unrelated deployed migrations.
3. The 16 policyless internal RLS tables need an owner-confirmed service/runtime access decision before policies can be added safely.
4. Leaked-password protection remains an account-level Supabase Auth setting requiring an owner decision.
5. A routing provider remains intentionally unconfigured; there are no road distances, durations, or ETAs until a server-side provider and capability review are approved.

## Top five Batch 17 recommendations

1. Provide the disposable smoke environment and add authenticated cross-company/race coverage for the timeline, POD review, task resolution, and trailer assignment guards.
2. Complete the remaining authenticated SECURITY DEFINER inventory, prioritising high-risk write functions and proving each caller, grant, company-scope check, and fixed path.
3. Add manager-facing POD evidence reconciliation drill-down from a stable alert to the exact assignment/evidence review workflow without exposing storage internals.
4. Extend the timeline with a tested source-link registry and richer entity labels while preserving the no-duplicate-source-table and no-raw-metadata boundaries.
5. Evaluate one provider-neutral routing adapter in a server-only disposable environment, with HGV restrictions, trailer dimensions, capability mismatch handling, and explicit cost/credential approval before any paid call.
