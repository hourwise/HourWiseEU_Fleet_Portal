# HourWise EU Fleet Portal - Consolidated Master Build Plan

**Document purpose:** combine the current portal roadmap/checklist `.md` files into one agent-friendly implementation plan that can be updated as work progresses.

**Created from uploaded planning files:**

- `tacho-roadmap-phases-1-9.md`
- `tacho-driver-card-view-build-plan.md`
- `tacho-reader-helper-production-checklist.md`
- `HourWise Atlas Assistant Implementation Plan.md`
- `PORTAL_SUPABASE_SECURITY_FIX_BRIEF_2026-06-14.md`
- `open-ui-and-product-followups.md`

**Important status note:** the tachograph roadmap and driver-card view plan appear to be the most recently updated. The UI/product follow-up and Supabase security brief may be stale in places. Treat items from those older docs as **verify first**, not automatically incomplete.

---

# 1. How The Agent Should Use This File

Use this file as the single working checklist for the portal build.

## Status Key

Use these markers when updating tasks:

- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete and locally verified
- `[?]` Needs repo/live verification because source docs may be stale
- `[!]` Blocker / must fix before release

## Update Rules For The Agent

When completing work:

1. Update the relevant checklist item.
2. Add a short note with date and commit/reference if available.
3. Do not mark `[x]` unless the change is verified with a test, build, or live workflow check.
4. If a source planning document is outdated, update this master file first, then optionally update or archive the old document.
5. Keep safety/security issues above polish work.
6. Do not remove fallback/manual upload paths until replacement workflows are proven.

## Current Handover - 2026-06-21

Latest local work is implemented but not yet pushed/deployed at the time of this note. The user plans to restart Android Studio, install Deno, then continue from this state.

Implemented locally:

- Driver File tachograph section cleanup:
  - Removed duplicate top-level licence/DQC quick-edit fields.
  - Kept evidence upload/OCR panels as the editable source for licence, CPC/DQC, and tacho card evidence.
  - Added tacho evidence match/mismatch messaging against the latest physical card read.
  - Added `Card Number` / `Card Expiry` summary cards from tacho summary/import fallback.
- Driver-card identity fallback:
  - `useDriverTachoSummary` now falls back to `tachograph_files.external_card_number` and helper metadata if `driver_card_downloads` does not have card identity.
- Reader workflow:
  - Auto-read now starts when the helper reports `cardPresent && canStartRead`, not only exact `card_inserted`.
  - Reader helper polling changed from 4s to 2s.
- Candidate/invite backend linking:
  - `accept_driver_invite` now returns `linked_import_ids`.
  - Existing invite-accept migration backfills candidate import ownership across derived tachograph rows.
- Signal rebuild controls:
  - Added `prepare_tacho_import_reprocess(...)` RPC.
  - Added `Rebuild Tacho Signals` button in Driver File; it prepares latest linked card import and invokes `process-tacho`.
  - `accept-driver-invite` Edge Function now attempts to auto-kick `process-tacho` for linked imports when `PROCESS_TACHO_TRIGGER_TOKEN` and service-role config exist.
- Test data cleanup controls:
  - Added `purge_company_driver_card_reads(...)` RPC with dry-run support.
  - Added Import Centre danger-zone panel: `Preview Delete`, optional storage deletion, then confirm by typing `DELETE CARD READS`.
- Driver Card Analysis report/export polish:
  - Added manager-facing report panel for linked cards and candidate screening cards.
  - Added report caveat that current HourWise read-only capture/parser output is provisional and not certified `.C1B/.DDD` output.
  - Expanded CSV export into an evidence report containing metadata, daily totals, findings, and app-vs-tacho cross-check rows.
  - Added print/save-PDF report action.
- Shared compliance trigger cleanup:
  - App repo confirmed production shift-end flow calculates compliance client-side and writes `work_sessions.compliance_score` / `work_sessions.compliance_violations`.
  - Portal repo search found no direct portal call to `calculate-compliance`; portal reporting reads stored `work_sessions` compliance columns.
  - Added migration `20260621114500_remove_legacy_work_session_compliance_triggers.sql` to drop the two stale `work_sessions` HTTP triggers and `public.trigger_compliance_function()`.
- Driver Card Analysis review/sign-off persistence:
  - Added `tachograph_finding_reviews` and `tachograph_finding_review_events`.
  - Added manager-scoped `save_tachograph_finding_review(...)` RPC so review edits write audit events.
  - Added Driver Card Analysis review panel for finding status, manager note, and corrective action type.
- Live retest follow-up fixes:
  - Added stale deploy/chunk-load recovery so missing dynamic import chunks prompt a portal reload instead of routing home.
  - Driver File now shows recent tacho review actions and assigned tacho refresher training records.
  - Rest-rule evaluation now ignores no-data/rest-only/unknown-only placeholder days when calculating daily/weekly rest gaps; existing stored false-positive findings need import reprocessing to clear.
  - Added migration `20260621133000_backfill_tacho_review_action_status.sql` so existing open reviews with corrective action types become `action_required`.

Files changed in this batch:

- `src/components/manager/DriverDetailsModal.tsx`
- `src/components/manager/tachograph/DriverCardAnalysis.tsx`
- `src/components/common/ErrorBoundary.tsx`
- `shared/tachoRuleEvaluation.ts`
- `src/lib/tacho/rules/engine.test.ts`
- `src/components/manager/tachograph/TachoImportCentre.tsx`
- `src/components/manager/tachograph/TachoReaderHelperPanel.tsx`
- `src/hooks/useDriverTachoSummary.ts`
- `src/lib/tacho/api.ts`
- `src/lib/tacho/helperImport.ts`
- `supabase/functions/accept-driver-invite/index.ts`
- `supabase/migrations/20260620222000_backfill_tacho_rows_on_invite_acceptance.sql`
- `supabase/migrations/20260621103000_add_tacho_rebuild_and_reset_controls.sql`
- `supabase/migrations/20260621114500_remove_legacy_work_session_compliance_triggers.sql`
- `supabase/migrations/20260621123000_add_tacho_finding_review_persistence.sql`
- `supabase/migrations/20260621133000_backfill_tacho_review_action_status.sql`

Local verification completed:

- Focused ESLint passed for changed frontend/helper files.
- `git diff --check` passed with CRLF warnings only.
- `npm run build` passed with existing large chunk warnings.
- `npm run test:rules` passed after the no-duty/rest-only regression test was added.
- Deno check was not run because Deno was not installed locally.

Before live retest:

```powershell
.\supabase.exe db push
.\supabase.exe functions deploy process-tacho --use-api
.\supabase.exe functions deploy accept-driver-invite --use-api
.\supabase.exe secrets set PROCESS_TACHO_TRIGGER_TOKEN="your-long-random-token"
git push
```

After Deno install/restart, recommended local checks:

```powershell
deno --version
deno check supabase/functions/accept-driver-invite/index.ts
npx eslint src\components\manager\DriverDetailsModal.tsx src\components\manager\tachograph\TachoImportCentre.tsx src\components\manager\tachograph\DriverCardAnalysis.tsx src\components\manager\tachograph\TachoReaderHelperPanel.tsx src\hooks\useDriverTachoSummary.ts src\lib\tacho\api.ts src\lib\tacho\helperImport.ts
npm run test:rules
npm run build
```

Live retest order:

1. Deploy DB/functions/frontend.
2. Use Import Centre `Test Data Reset: Driver Card Reads` if clearing test reads is still desired.
3. Re-read the driver card.
4. Create invite from candidate card.
5. Accept invite as driver.
6. Verify Driver File shows card number/expiry, latest download, Driver Card Analysis rows, and non-empty/updated tacho signal where supported by the parsed card data.
7. If existing Philip test record still shows `Awaiting tacho signal`, use `Rebuild Tacho Signals` from Driver File after deployment.
8. For the 2026-06-17 onward false rest finding, use `Rebuild Tacho Signals` on the affected driver/import after deployment; the stored old finding will not disappear until the import is reprocessed with the updated rules evaluator.
9. Open the Training button from Driver File after the Vercel deployment and confirm stale chunk errors show a reload prompt rather than logging the user out.
10. Confirm Driver File shows `Tacho Review Actions` and `Assigned Tacho Training` for the saved Driver Card Analysis corrective actions.

Latest local follow-up after the above retest:

- Driver Card Analysis report/export polish and manager-facing report buttons are implemented locally. Live visual review after frontend deployment is still pending.
- Review/action follow-up visibility and no-data rest false-positive fixes are implemented locally. Live retest after DB/function/frontend deployment is still pending.

---

# 2. Current Product Direction

HourWise EU Fleet Portal is becoming a connected compliance and fleet operations platform.

Core portal areas:

- Driver management
- Fleet / vehicle management
- Tachograph analysis
- Vehicle Unit analysis
- Driver card reader workflow
- App-vs-tacho comparison
- Payroll / hours management
- Incident and accident reporting
- Repair / maintenance management
- O-Licence document readiness
- Driver messaging
- Expenses, mileage and fuel reporting
- Daily vehicle checks
- Future Atlas assistant layer

Strategic direction:

> Tacho data should become the compliance source of truth. App data should support clock-in/out, payroll, manual-entry evidence, messaging, expenses, checks, and comparison against tachograph records.

---

# 3. Source Document Assessment

| Source file | Apparent freshness | How to treat it |
|---|---:|---|
| `tacho-roadmap-phases-1-9.md` | High | Primary truth for tachograph current state and next work. |
| `tacho-driver-card-view-build-plan.md` | High | Primary truth for Driver Card Analysis UI direction. |
| `tacho-reader-helper-production-checklist.md` | High | Primary truth for helper productionisation. |
| `HourWise Atlas Assistant Implementation Plan.md` | Strategic / future | Use for Atlas architecture, not immediate build unless requested. |
| `PORTAL_SUPABASE_SECURITY_FIX_BRIEF_2026-06-14.md` | Medium / may be stale | Treat as security verification checklist. Some fixes may already exist. |
| `open-ui-and-product-followups.md` | Older / narrow | Keep dashboard routing refresh issue as a known high-UX item. |

---

# 4. Confirmed / Likely Achieved Work

This section is based on the latest tachograph roadmap. Verify in repo before relying on it for release claims.

## Tachograph Programme

- `[x]` Normalised tachograph processing pipeline exists.
- `[x]` Driver card and VU analysis screens exist.
- `[x]` Import Centre exists.
- `[x]` Shared tacho rules engine exists.
- `[x]` Rule coverage includes 4h30 break, split break, daily/weekly/fortnightly limits, rest, WTD breaks, and reconciliation basics.
- `[x]` Driver/VU review queues and deep-link style navigation are substantially implemented.
- `[x]` Tacho integration is materially embedded across driver files, vehicle files, training links, infringement review, and reports.
- `[x]` Portal navigation is functionally grouped into Dashboard / People / Fleet / Compliance / Reports / Settings.
- `[x]` Reader helper frontend scaffold exists.
- `[x]` Local mock helper exists.
- `[x]` Contract probe exists.
- `[x]` First `.NET` Windows helper shell exists.
- `[x]` Helper detects Windows PC/SC smart card readers.
- `[x]` Helper exposes localhost HTTP API on `127.0.0.1`.
- `[x]` Helper has diagnostics endpoints and JSONL logging.
- `[x]` Helper has read-only APDU safety guard.
- `[x]` Real driver-card EF read-only capture has been tested with actual hardware.
- `[x]` `process-tacho` recognises HourWise read-only capture containers.
- `[x]` EF `0520` card identity decode works.
- `[x]` EF `0504` daily activity decode exists provisionally and has passed live read-only helper validation.
  - 2026-07-05: Live import `b9c8c986-445b-4411-82fc-c96b8ecf6178` decoded 1839 provisional activity segments across 69 days; visible review day `2026-06-29` aligned tachograph `58` / timeline `58`.
- `[~]` Driver-card import pairing/invite-from-card workflows exist and have had live testing.
  - 2026-06-21: Local code now backfills accepted candidate imports, returns linked import IDs from `accept_driver_invite`, and `accept-driver-invite` attempts post-accept signal rebuild via `process-tacho` when trigger-token config exists. Needs deployment/live retest.
- `[x]` Driver Card Analysis now owns first-pass live card read/import workflow through `useTachoReaderWorkflow`.
  - 2026-07-05: Real helper/card/browser/Supabase path reached `complete`, opened linked driver analysis, decoded card identity, and showed aligned timeline comparison.
- `[~]` Candidate/unmatched card analysis by `import_id` exists.
  - 2026-06-21: Candidate mode hides driver-only personnel/compliance/training actions while preserving Export CSV and Report View. Needs frontend deploy/live retest.
- `[x]` Local validation has passed for the latest Driver Card Analysis live-reader frontend work: focused ESLint, `npm run build`, and `git diff --check`.
- `[x]` Latest Driver Card Analysis live-reader frontend work has had real helper/card retest for Phase 1 read-only capture.

## Atlas Assistant

- `[x]` Name chosen: **HourWise Atlas Assistant**.
- `[x]` Short name chosen: **Atlas**.
- `[x]` Concept agreed: proactive fleet intelligence first, AI later.
- `[ ]` SQL/rules-based Atlas implementation not started unless repo has later work not reflected in docs.
- `[ ]` GPT API layer not started.

## UI / Product Follow-Up

- `[?]` Dashboard refresh/back/forward behaviour may still reset internal manager workspace state because navigation state may still be React-state only under `/dashboard`.
- `[?]` Verify whether nested dashboard routes or query-param backed state have since been implemented.

## Supabase Security

- `[?]` Verify whether exposed service-role/JWT secrets have been rotated.
  - 2026-06-21: `supabase secrets list` confirms current runtime secrets exist, but secret rotation history cannot be proven from the repo/CLI output alone.
- `[~]` Verify whether trigger bearer tokens have been removed from SQL trigger definitions.
  - 2026-06-21: Remote migrations are current through `20260621103000`; repo search found no hard-coded `Bearer ...` token in SQL migrations. Direct live catalog SQL could not be run because `psql` is unavailable and `supabase db dump` is blocked by missing Docker.
- `[~]` Verify whether `driver_invites` anonymous broad read has been removed.
  - 2026-06-21: Deployed hardening migration removes anon grants/public SELECT policies and uses safe lookup/accept RPCs. Direct `pg_policies` live query still pending due local tooling limitation.
- `[~]` Verify storage policies, RLS, SECURITY DEFINER functions, and Edge Function auth.
  - 2026-06-21: Repo/deployed migration audit is mostly positive. App repo confirmed `calculate-compliance` is stale for current shift-end compliance writes; portal migration `20260621114500_remove_legacy_work_session_compliance_triggers.sql` removes the two shared `work_sessions` HTTP trigger paths. Deployed app-owned function hardening/removal remains coordinated with the app repo.

---

# 5. Current Highest Priority Order

The recommended build order is:

1. **Security verification / blockers**
2. **Tachograph live-card workflow stabilisation**
3. **Driver Card Analysis presentation polish**
4. **Import Centre simplification**
5. **Review/sign-off persistence**
6. **Reader helper production hardening**
7. **VU workflow promotion**
8. **Portal routing / UX follow-ups**
9. **Phase 9 hardening, UAT and release prep**
10. **Atlas SQL engine**
11. **Atlas GPT explanation layer**
12. **Accreditation assistant features**

---

# 6. P0 Security Verification And Fixes

These items should be checked before release or before inviting real customer data into the portal.

## 6.1 Rotate Exposed Supabase Secrets

- `[?]` Confirm whether Supabase service-role/JWT secret was rotated after exposed metadata.
  - 2026-06-21: Current secret names/digests are present in Supabase (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEYS`, `SUPABASE_JWKS`, etc.), but CLI output does not prove historical rotation. Confirm in Supabase dashboard/audit history if customer data is involved.
- `[~]` Confirm no service-role bearer tokens remain embedded in SQL trigger definitions.
  - 2026-06-21: Repo search across `supabase/` found no hard-coded `Bearer ...` tokens in SQL. Live trigger SQL query still pending because this machine lacks `psql` and Supabase CLI schema dump requires Docker.
- `[~]` If any token remains, rotate the secret and replace the pattern.
  - 2026-06-21: No embedded SQL bearer token found in repo review; leave open until direct live catalog query returns no rows.

Verification SQL:

```sql
select
  event_object_table,
  trigger_name,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and action_statement ilike '%Bearer%';
```

Expected result:

```text
No rows.
```

## 6.2 Replace Unsafe Trigger Dispatch Pattern

Preferred safe patterns:

- Supabase Vault-backed SQL function, or
- Edge Function with environment secrets, or
- portal-owned server job that signs requests outside database DDL.

Checklist:

- `[~]` Verify `public.broadcasts.on_new_broadcast` contains no embedded bearer token.
  - 2026-06-21: Deployed hardening migration replaces it with `private.dispatch_new_broadcast()` using `private.broadcast_dispatch_runtime.trigger_token`; direct live trigger SQL still pending.
- `[~]` Verify `public.tachograph_files.process_tacho_files` contains no embedded bearer token.
  - 2026-06-21: Deployed hardening migration drops `process_tacho_files`; earlier tacho dispatch uses `private.tacho_processing_runtime.trigger_token`, not a service-role bearer token. Direct live trigger SQL still pending.
- `[x]` Verify optional DB-trigger tacho dispatch uses dedicated trigger token/runtime config, not service-role bearer in SQL.
  - 2026-06-21: `private.tacho_processing_runtime` and `private.broadcast_dispatch_runtime` store trigger-token config; `PROCESS_TACHO_TRIGGER_TOKEN` is configured in Supabase secrets.

## 6.3 Fix `driver_invites` Anonymous Read

- `[~]` Verify `driver_invites` no longer has public SELECT policy with `qual = true`.
  - 2026-06-21: Hardening migration revokes anon table access and drops public/anon SELECT policies. Direct `pg_policies` live query still pending due missing `psql`/Docker.
- `[x]` Verify invite lookup now uses safe RPC or Edge Function.
  - 2026-06-21: `lookup-driver-invite` calls `lookup_pending_driver_invite(...)`; no broad table read is used by the function.
- `[x]` Verify lookup requires exact invite code, pending status, and non-expired invite.
  - 2026-06-21: `lookup_pending_driver_invite(...)` filters by normalized exact invite code, `status = 'pending'`, and `expires_at > now()`.
- `[x]` Verify lookup returns only safe signup fields.
  - 2026-06-21: RPC returns invite code/status, invitee name/email, company name, expiry, and tachograph card prefill fields; it does not expose pay config, internal IDs, or all invites.
- `[x]` Verify manager invite management is company-scoped.
  - 2026-06-21: `create-driver-invite` checks authenticated manager role and company match before service-role insert; table policies restrict manager read/update/delete by `get_my_company_id()`.

Verification SQL:

```sql
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'driver_invites'
order by policyname;
```

Expected:

```text
No policy with roles = {public}, cmd = SELECT, qual = true.
```

## 6.4 `shift_jobs` RLS

- `[~]` Verify `shift_jobs` has RLS enabled.
  - 2026-06-21: Hardening migration enables RLS if `public.shift_jobs` exists. Direct live table check still pending.
- `[x]` Verify mobile users can read own shift jobs.
  - 2026-06-21: Migration policy permits authenticated SELECT where `user_id = auth.uid()`.
- `[x]` Verify managers can read company driver shift jobs.
  - 2026-06-21: Migration policy permits manager SELECT for `user_id` in same-company `profiles`.
- `[~]` Confirm whether `user_id` references `auth.users.id` or `profiles.id`.
  - 2026-06-21: Policy assumes `profiles.id` equals `auth.uid()`, which matches current profile model; direct FK/catalog check still pending.

## 6.5 Storage Policies

Buckets to verify:

- `defect-photos`
- `driver-documents`
- `vehicle-documents`
- `logos`
- `tachograph-files`

Checklist:

- `[x]` Confirm canonical storage path conventions for mobile and portal.
  - 2026-06-21: Migration documents and enforces driver docs as `<userId>/...` or `<companyId>/<driverId>/...`, vehicle docs as `<userId>/...`, `<companyId>/<vehicleId>/...`, or guarded legacy `solo/<vehicleId>/...`, defect photos as `<userId>/...`, `<companyId>/...`, or `<vehicleCheckId>/...`, and tachograph files as `<companyId>/<timestamp>_<filename>`.
- `[x]` Confirm `defect-photos` has INSERT policy for app uploads.
  - 2026-06-21: `Users can insert defect photo objects` permits authenticated inserts through `can_access_defect_photo_object(...)`.
- `[x]` Confirm `driver-documents` supports intended driver/company paths.
  - 2026-06-21: `can_access_driver_document_object(...)` supports self-user and company manager paths.
- `[x]` Confirm `vehicle-documents` supports intended vehicle/company paths.
  - 2026-06-21: `can_access_vehicle_document_object(...)` supports self-user, company manager, and guarded legacy solo paths.
- `[x]` Confirm `tachograph-files` is private and company-scoped.
  - 2026-06-21: Bucket migration sets `public = false`; storage policies restrict insert/select/update/delete to authenticated managers whose company id matches the first path segment.
- `[x]` Confirm private document buckets are not public.
  - 2026-06-21: Migration sets `defect-photos`, `driver-documents`, `vehicle-documents`, and `tachograph-files` to `public = false`; `logos` remains public by design.
- `[x]` Confirm file size and MIME limits exist where appropriate.
  - 2026-06-21: Migrations set bucket size/MIME limits for logos, defect photos, driver documents, vehicle documents, and tachograph files.

Verification SQL:

```sql
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('defect-photos', 'driver-documents', 'vehicle-documents', 'logos', 'tachograph-files')
order by id;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;
```

## 6.6 SECURITY DEFINER Function Audit

Functions to verify:

- `accept_driver_invite`
- `get_auth_user_company`
- `get_auth_user_role`
- `get_my_company_id`
- `get_my_role`
- `prevent_role_escalation`
- `update_user_claims`
- `validate_auth_code`
- `lookup_pending_driver_invite`
- `pair_tacho_card_import_to_driver`

Checklist:

- `[~]` Each SECURITY DEFINER function sets safe `search_path`.
  - 2026-06-21: Reviewed current migrations for listed functions; new/replaced functions set `search_path = public, pg_temp` or stricter. `update_user_claims` is altered to safe search path when present, but direct live function catalog check is still pending.
- `[x]` Each validates `auth.uid()` ownership/company membership.
  - 2026-06-21: Reviewed listed functions: helpers use current profile via `auth.uid()`, invite acceptance requires authenticated matching email/company checks, and manager-only RPCs verify role/company.
- `[x]` Invite acceptance blocks expired/accepted invites.
  - 2026-06-21: `accept_driver_invite(...)` selects `status = 'pending'` and `expires_at > now()` with row lock, then updates only pending invite rows.
- `[x]` Role/company updates cannot escalate privileges.
  - 2026-06-21: `prevent_role_escalation()` blocks role/company changes unless service role or the controlled invite acceptance setting is active, and requires same-company manager for membership changes.
- `[x]` Card pairing validates manager company scope.
  - 2026-06-21: `pair_tacho_card_import_to_driver(...)` requires current user to be manager for `p_company_id`, validates import/company/source, selected driver/company/role, and duplicate card assignment.

## 6.7 Edge Function Auth Review

Functions to review:

- `delete-user-data` / `request-account-deletion`
- `send-broadcast`
- `process-tacho`
- `calculate-compliance`
- `create-driver-invite`
- `lookup-driver-invite`
- `accept-driver-invite`

Checklist:

- `[!]` Resolve deployed-only/stale Edge Functions before closing review.
  - 2026-06-21: `supabase functions list` shows remote `calculate-compliance` is ACTIVE. Source was temporarily downloaded locally for audit, then removed from the portal repo to avoid accidental deployment of app-owned code. Do not deploy/delete it from the portal repo because the shared DB also serves the partner/mobile app and solo-driver flow. App-repo handoff created at `docs/calculate-compliance-app-repo-handoff-2026-06-21.md`. `delete-user-data` is not deployed and appears replaced by `request-account-deletion`.
  - 2026-06-21: App repo confirmed production shift-end code calculates compliance in-app and writes `work_sessions.compliance_score` / `work_sessions.compliance_violations`; portal search found no direct `calculate-compliance` call. Added DB migration to remove stale shared `work_sessions` HTTP triggers without touching the app-owned Edge Function deployment.
- `[~]` Server-side auth is checked.
  - 2026-06-21: Reviewed local functions: `create-driver-invite`, `accept-driver-invite`, and `process-tacho` authenticate users; `process-tacho` and `send-broadcast` also support dedicated trigger tokens; `lookup-driver-invite` intentionally uses safe anon RPC. Downloaded `calculate-compliance` currently trusts POST body data and needs app-repo hardening.
- `[~]` Company ownership is validated.
  - 2026-06-21: `create-driver-invite` validates manager/company; `process-tacho` validates manager company for user-triggered processing; `send-broadcast` is trigger-token protected and scopes driver token fetch by payload company. Downloaded `calculate-compliance` does not validate session ownership/company before service-role update.
- `[~]` Service-role use is limited to necessary operations.
  - 2026-06-21: Local reviewed portal functions use service role after auth/trigger checks for RLS-bypassing inserts, storage/file processing, and broadcast delivery. Downloaded `calculate-compliance` uses service role immediately and must be repaired in the app repo.
- `[~]` Logs do not contain tokens, PII, payroll data, private document URLs, or excessive tacho personal data.
  - 2026-06-21: No token logging found in local reviewed portal functions. Some error logging includes raw error messages and company ids; acceptable for support but review again before customer release. Downloaded `calculate-compliance` returns raw error messages and needs app-repo review.

---

# 7. Tachograph Programme - Immediate Build Plan

## 7.1 Confirm Current Live State

- `[ ]` Confirm latest frontend and Supabase changes are pushed/deployed.
- `[ ]` Confirm helper version expected by docs: `dotnet-shell-0.5.9` or newer.
- `[ ]` Restart helper and verify `/status` updates correctly on card insert/remove.
- `[ ]` Confirm helper state transitions during real read:
  - `card_inserted`
  - `reading`
  - `uploading`
  - `processing`
  - `complete`
  - `ready`
- `[ ]` Confirm Driver Card Analysis keeps the completed read visible after card removal until another card is read or Refresh clears stale reader state.
- `[~]` Confirm the compact live reader panel in Driver Card Analysis, not Import Centre, is the normal path for driver-card reads.
  - 2026-06-21: Code path has been moved/polished locally, but live helper/card retest is still required after deployment.
  - 2026-07-04: Driver Card Analysis now keeps completed read details visible after card removal and uses Refresh as the explicit stale-state reset.

## 7.2 Reprocess / Re-read Known Driver Card Imports

Known import IDs from roadmap:

- `ae681c85-fb6f-4b5a-aaf5-b7fa32312e39`
- `e872ed0c-b7d7-4894-b5a4-990da8a8acd8`
- `3fa66667-7ebb-408d-af36-6359aab15df3`
- `7e25babd-92e5-4b10-abf1-29ec17f0a12d`

Checklist:

- `[ ]` Use Import Centre retry for known imports where available.
- `[ ]` Prefer UI retry if local env lacks `PROCESS_TACHO_TRIGGER_TOKEN`.
- `[~]` Use Driver File `Rebuild Tacho Signals` for linked driver-card imports showing `Awaiting tacho signal`.
  - 2026-06-21: Local UI action added. It calls `prepare_tacho_import_reprocess(...)` then invokes existing `process-tacho` retry path for the latest linked card import.
- `[~]` Auto-rebuild linked candidate imports after invite acceptance.
  - 2026-06-21: `accept-driver-invite` now attempts `process-tacho` kickoff for `linked_import_ids` if `PROCESS_TACHO_TRIGGER_TOKEN` is configured. Needs function deploy and live invite retest.
- `[ ]` Expected final import state: `processed` where EF `0504` activity exists.
- `[ ]` Expected metadata includes:
  - `normalized_segments > 0`
  - `helper_capture_activity_day_count > 0`
  - `helper_capture_activity_change_count > 0`
- `[ ]` Confirm analysis screen does not rely on raw metadata for normal display.
- `[ ]` Capture any wrong dates, activity modes, totals, or odd timeline presentation.

## 7.3 Validate Driver Pairing / Invite Flows

### Existing Profile Pairing

- `[ ]` Create/use driver profile without `tacho_card_number`.
- `[ ]` Read card.
- `[ ]` Pair decoded card import to driver profile.
  - 2026-06-21 live test note: Pairing to an existing driver ultimately succeeded after screen refresh, but the initial UI message said it failed/could not pair. Treat as a UI/mutation-state follow-up: verify RPC response handling, stale query invalidation, and error-toast timing around successful pair operations.
  - 2026-06-21: Frontend pairing wrapper now verifies final import/profile linkage after a transient RPC/client error before showing failure. Import Centre pairing refresh is separated from the pair RPC result so refresh issues do not become false pair failures. Focused ESLint, tachograph rule tests, and `npm run build` passed; live retest still required.
- `[ ]` Verify `profiles.tacho_card_number` is set.
- `[ ]` Verify `tachograph_files.driver_id` is linked.
- `[ ]` Verify `driver_card_downloads.driver_id` is linked.
- `[ ]` Re-read same card and confirm automatic driver match.

### Pending Invite Pairing

- `[ ]` Create pending invite first.
- `[ ]` Read card.
- `[ ]` Pair decoded card to pending invite.
- `[ ]` Verify `driver_invites.tacho_card_number` is set.
- `[ ]` Accept invite through app flow.
- `[ ]` Verify accepted profile receives `profiles.tacho_card_number`.
- `[ ]` Verify prior imports/downloads for card number link to profile.

### Invite From Card

- `[ ]` Read unmatched card.
- `[ ]` Open Import Review.
- `[ ]` Click `Invite Driver From Card`.
- `[ ]` Confirm decoded name/card fields prefill invite modal.
- `[ ]` Send invite.
- `[ ]` Confirm pending invite exposes `Invite Details` in Driver Management.
- `[ ]` Edit pending invite/card fields if needed before acceptance.
- `[ ]` Accept invite as driver.
- `[ ]` Verify profile joins company as `role = driver`.
- `[~]` Verify card imports/downloads link to accepted profile.
  - 2026-06-21: Local migration updates `tachograph_files`, `driver_card_downloads`, activity/day/finding/event/reconciliation rows, profile `tacho_card_number`, and returns `linked_import_ids`; live deploy/retest pending.

## 7.4 Parser Milestone - EF `0504` Validation

The current HourWise helper capture is **not** a certified `.C1B/.DDD` card download. EF `0504` parsing is provisional.

Checklist:

- `[ ]` Obtain certified/known-good `.C1B` or `.DDD` output for the same or comparable card.
- `[ ]` Compare HourWise EF `0504` decoded dates against known-good parser output.
- `[ ]` Compare activity types.
- `[ ]` Compare segment start/end times.
- `[ ]` Compare daily totals.
- `[ ]` Compare findings/rules output.
- `[ ]` Add fixture coverage for captured EF `0504` sample.
- `[ ]` Store expected daily records and activity changes in tests.
- `[ ]` Keep UI labelling as provisional until validation passes.

## 7.5 Replace Placeholder Legal Totals

- `[ ]` Wire reader console legal totals to parsed activity/rule output.
- `[ ]` Remove placeholder totals from normal supervisor view.
- `[ ]` Keep parser/debug metadata behind technical disclosure only.
- `[ ]` Show clear data-source badge:
  - Certified `.C1B/.DDD`
  - HourWise read-only capture
  - Manual upload
  - Partial identity-only capture

## 7.6 Windows Helper Local Outbox And Sync Semantics

Decision record:

- `docs/adr/ADR-0019-windows-helper-local-outbox-and-sync-semantics.md`

Decision:

- `[x]` Supabase/backend imports remain the source of truth.
- `[x]` The helper must not contain Supabase service-role keys.
- `[x]` The helper must not become a local compliance database.
- `[x]` The helper must not retain raw card or vehicle-unit data indefinitely.
- `[x]` Any local outbox is limited to a short-lived encrypted delivery/retry queue.

Phase 1 current helper flow:

- `[x]` Keep helper read/export -> browser authenticated upload -> `process-tacho` -> analysis open as the default production path.
- `[x]` Prove the real .NET helper read/export/register contract in automated simulated-card mode.
  - 2026-07-04: `npm run tacho:helper:phase1` starts the real helper on port `47236`, uses the external-export command seam, runs the read-mode contract probe, and reaches `complete`. See `docs/helper-003-phase1-validation-2026-07-04.md`.
- `[x]` Prove real reader/export/browser upload path with live helper and card.
  - 2026-07-05: Baseline import `b9c8c986-445b-4411-82fc-c96b8ecf6178` completed through browser upload, `process-tacho`, and linked Driver Card Analysis.
- `[~]` Confirm failed uploads can be retried while the existing export is still retained by the normal helper session.
  - 2026-07-05: Portal duplicate-upload lock and helper `/imports/reset` prevent stale failed processing attempts from requiring helper restart. Full encrypted retry outbox remains `ADR-0019` Phase 2.
- `[x]` Confirm no helper code path requires service-role credentials.
  - 2026-07-04: Focused search across the helper .NET/PowerShell/Node paths found no Supabase service-role, bearer token, API key, or auth-header dependency in the helper.

Phase 2 encrypted retry cache:

- `[ ]` Do not implement until Phase 1 is stable.
- `[ ]` Queue only complete exports when browser upload or backend registration fails/interrupted.
- `[ ]` Encrypt queued raw bytes at rest.
- `[ ]` Delete queued raw bytes after successful backend registration.
- `[ ]` Apply short expiry, initially no longer than 24 hours unless reviewed.
- `[ ]` Show portal labels such as `1 read waiting to sync`, `Retry upload`, and `Local queued read expired`.
- `[ ]` Use SHA-256/idempotency to avoid duplicate backend imports.

Phase 3 Tachomaster-style sync:

- `[ ]` Do not start until the Phase 2 retry cache has passed UAT.
- `[ ]` Define offline reads, multiple queued files, Sync all, background retry, sync history, admin retention settings, support diagnostics, and duplicate-safe backend imports before implementation.

---

# 8. Driver Card Analysis Workspace Plan

## 8.1 Workspace Behaviour

Target behaviour:

- Graph/analysis screen fills the page.
- Reader status appears as overlay/status panel, not a separate page.
- Manual file import remains available.
- Results open matched driver analysis or candidate card mode.
- Card removal does not immediately clear the completed read; the result remains visible until another card is read or Refresh clears stale reader state.

Checklist:

- `[~]` Driver Card Analysis owns live read/import workflow through `useTachoReaderWorkflow`.
- `[ ]` Retest live flow after frontend deployment using real helper/card.
- `[ ]` Confirm blank 7-day calendar appears by default when no data is selected.
- `[ ]` Confirm matched reads open linked-driver analysis.
- `[ ]` Confirm unmatched reads open candidate card mode by `import_id`.
- `[~]` Confirm personnel/training/compliance actions are disabled in candidate mode.
  - 2026-06-21: Code now hides these actions for candidate cards; frontend deploy/live retest pending.
- `[~]` Confirm card removal keeps the completed live result visible and does not delete or hide stored historical imports.
  - 2026-07-04: Local workflow now preserves completed reader result after card removal; live retest still required after deployment.

## 8.2 Page Header / Action Bar

Add or verify actions:

- `[ ]` `Read From Card`
- `[ ]` `Import File`
- `[~]` `Export Report`
  - 2026-06-21: Report View/Screening Report opens a manager-facing report panel with print/save-PDF action; Export CSV now produces an evidence-style report. Needs live UI review after deployment.
- `[ ]` `Refresh`
- `[ ]` `Close`
- `[ ]` Progress bar/staged status during read/import.

Status labels:

- `[ ]` Ready
- `[ ]` Card detected
- `[ ]` Reading card
- `[ ]` Processing activities
- `[ ]` Analysis complete
- `[ ]` Card removed
- `[ ]` Reader not found
- `[ ]` Export tool missing
- `[ ]` Invalid card file

## 8.3 Driver Details Panel

Fields to display:

- `[ ]` Driver name
- `[ ]` Card number
- `[ ]` Issuing country
- `[ ]` Card expiry date
- `[ ]` Employer/company
- `[ ]` Depot/site
- `[ ]` Employee type
- `[ ]` Last card download date
- `[ ]` Last activity time
- `[ ]` File/card source
- `[ ]` Import timestamp

Badges:

- `[ ]` Expires within 90 days
- `[ ]` Expires within 60 days
- `[ ]` Expires within 30 days
- `[ ]` Expired
- `[ ]` Last download older than policy
- `[ ]` Card number does not match assigned driver

## 8.4 Quick Analysis Panel

Fields:

- `[ ]` Last activity time
- `[ ]` Drive available today
- `[ ]` Drive available tomorrow
- `[ ]` Drive available this week
- `[ ]` Drive available fortnight
- `[ ]` Weekly drive used
- `[ ]` Fortnightly drive used
- `[ ]` Extended driving days used
- `[ ]` Reduced daily rests this week
- `[ ]` Short daily rests this week
- `[ ]` Weekly rest status
- `[ ]` Next required break/rest
- `[ ]` Current compliance status

## 8.5 Infringements / Findings Panel

Show grouped findings by date:

- `[ ]` Daily driving exceeded
- `[ ]` Weekly driving exceeded
- `[ ]` Fortnightly driving exceeded
- `[ ]` 4.5h break rule breached
- `[ ]` Insufficient daily rest
- `[ ]` Insufficient weekly rest
- `[ ]` Too many reduced daily rests
- `[ ]` Working time break breach
- `[ ]` Working time daily/night limit breach
- `[ ]` Missing manual entry
- `[ ]` Unknown activity period
- `[ ]` Card download interval warning

Each item should support:

- `[ ]` Actual value
- `[ ]` Legal limit
- `[ ]` Severity
- `[ ]` Rule reference
- `[ ]` Manager note
- `[ ]` Acknowledged/reviewed checkbox
- `[ ]` Exportable flag

## 8.6 Visual Timeline

- `[ ]` One row per date.
- `[ ]` 00:00 to 24:00 x-axis.
- `[ ]` Activity blocks with consistent colours.
- `[ ]` Tooltip includes activity type, start/end, duration, source, vehicle, location/country if available.
- `[ ]` Date range selector: 7 days / 30 days / 3 months / 6 months / 12 months / custom where supported.
- `[ ]` Zoom controls where useful.
- `[ ]` Daily totals summary.
- `[ ]` Unknown/missing data shown as hatched grey.
- `[ ]` Infringement period shown with red outline/overlay.

## 8.7 Daily Detail Drawer

- `[ ]` Chronological activity list.
- `[ ]` Daily totals: driving, other work, rest/break, POA, unknown.
- `[ ]` Vehicles used.
- `[ ]` Start/end countries if present.
- `[ ]` Manual entries.
- `[ ]` Card insertion/removal events.
- `[ ]` Rule checks.
- `[ ]` Infringements/findings.
- `[ ]` Manager notes.
- `[ ]` Export day report.
- `[ ]` Link to incident/absence/manual explanation.

## 8.8 Tabs

Add workspace tabs:

- `[ ]` Overview
- `[ ]` Activities
- `[ ]` Infringements
- `[ ]` Downloads
- `[ ]` Vehicles
- `[ ]` Reports
- `[ ]` Diagnostics

## 8.9 Review / Sign-Off Persistence

Important design rule:

> Driver personnel files should store issues, actions and sign-offs, not full raw card reads.

Checklist:

- `[~]` Design persistence tables for review/sign-off.
  - 2026-06-21: Added `tachograph_finding_reviews` and `tachograph_finding_review_events` in migration `20260621123000_add_tacho_finding_review_persistence.sql`. Deployment/live retest pending.
- `[~]` Store manager review state.
  - 2026-06-21: Driver Card Analysis can save `open`, `reviewed`, `action_required`, and `closed` through manager-scoped RPC. Deployment/live retest pending.
- `[~]` Store manager notes.
  - 2026-06-21: Review panel and RPC persist manager notes per generated tachograph finding. Deployment/live retest pending.
- `[~]` Store corrective action references.
  - 2026-06-21: Schema stores `corrective_action_type` and optional `corrective_action_ref_id`; first UI supports selecting the action type, and Driver File now surfaces recent tacho review actions. Later work should wire concrete training/debrief record IDs into `corrective_action_ref_id`.
- `[~]` Store audit log of review edits.
  - 2026-06-21: `save_tachograph_finding_review(...)` inserts `created`/`updated` events into `tachograph_finding_review_events`. Deployment/live retest pending.
- `[ ]` Add optional driver acknowledgement later.
- `[ ]` Link signed-off findings into personnel/training/compliance views.
  - 2026-06-21: Driver File now shows recent tacho review actions and assigned tacho refresher training records. Wider personnel/training/compliance linking still needs final workflow polish.

---

# 9. Import Centre Cleanup

Goal: after Driver Card Analysis owns normal live card reads, Import Centre should stop feeling like the main reader page.

Keep:

- `[ ]` VU import/download controls.
- `[ ]` Manual driver-card file import fallback.
- `[x]` Import review and retry handling.
  - 2026-06-20: Import review remains in Import Centre with retry action preserved; verified with focused lint, `npm run test:rules`, and `npm run build`.
- `[x]` Candidate card review entry point.
  - 2026-06-20: Candidate card checks are filterable and still open Driver Card Analysis by import ID.
- `[x]` Support diagnostics behind disclosure.
  - 2026-06-20: Backend IDs, helper schema, storage path, kickoff/dispatch errors, parser status, and archive metadata are behind a Support Diagnostics disclosure.

Demote/collapse:

- `[x]` Backend IDs.
- `[x]` Helper correlation fields.
- `[x]` Raw metadata.
- `[x]` Trigger dispatch debug state.
- `[x]` Processor error internals.
  - 2026-06-20: Normal import rows show supervisor-readable badges; backend-heavy details are hidden by default.

Candidate cleanup and retention:

- `[x]` Add manager filters for candidate card checks, linked driver reads, failed imports, and VU/manual uploads.
  - 2026-06-20: Import Centre now has queue filters and hides archived/superseded audit rows by default.
- `[x]` Add status labels for candidate unreviewed, reviewed only, no hire, invited, paired, and superseded.
  - 2026-06-20: Labels are derived from `tachograph_files.metadata`, pairing state, and invite metadata.
- `[x]` Add safe manager archive action for candidate/no-hire reads.
  - 2026-06-20: `archive_tacho_candidate_import(...)` rejects linked driver imports, clears candidate-derived analysis rows, retains the audit row, and can request storage deletion.
- `[x]` Add storage deletion confirmation for archived candidate imports.
  - 2026-06-20: UI archives first, deletes from the private `tachograph-files` bucket when requested, then calls `confirm_tacho_candidate_import_storage_deleted(...)`.
- `[x]` Apply visible retention policy for helper reads.
  - 2026-06-20: Latest active helper read remains visible; archived and superseded helper/candidate audit rows are hidden unless the manager enables archived/audit rows. Manual/VU uploads remain filterable separately.
- `[x]` Add manager reset control for test driver-card reads.
  - 2026-06-21: Import Centre now has a danger-zone `Test Data Reset: Driver Card Reads` panel with dry-run preview, optional `tachograph-files` storage deletion, and typed confirmation `DELETE CARD READS`. Backend RPC `purge_company_driver_card_reads(...)` is manager/company-scoped. Locally verified with focused ESLint and `npm run build`; deployment pending.
- `[x]` Add manager rebuild control for linked driver-card signals.
  - 2026-06-21: Driver File now exposes `Rebuild Tacho Signals` for the latest linked driver-card import; backend RPC `prepare_tacho_import_reprocess(...)` clears import-derived rows before invoking the existing processor retry path. Locally verified; deployment/live retest pending.

Remove or reduce:

- `[~]` Live driver-card reader duplication now owned by Driver Card Analysis.
  - 2026-06-21: Auto-read and compact reader path are implemented locally; Import Centre remains for support/manual fallback and reset controls. Needs live retest.

Acceptance criteria:

- `[ ]` A normal supervisor sees a clean import/review page.
- `[ ]` Support staff can still expand diagnostics when needed.
- `[ ]` Manual fallback remains obvious.
- `[ ]` Retry processing remains available for failed/kickoff/partial states.

Driver File tacho/evidence decisions:

- `[x]` Remove duplicate top-level licence/DQC quick-edit fields from Driver File.
  - 2026-06-21: Evidence upload/OCR panels are now the editable source for licence, CPC/DQC, and tacho-card evidence.
- `[x]` Add tacho-card evidence cross-check.
  - 2026-06-21: Driver File compares uploaded/OCR tacho card number to latest physical card read and shows match/mismatch/missing-read guidance.
- `[x]` Add tacho-card identity fallback for Driver File summary.
  - 2026-06-21: `useDriverTachoSummary` reads card number/expiry from `driver_card_downloads`, `profiles.tacho_card_number`, `tachograph_files.external_card_number`, and helper metadata fallback.

---

# 10. Tacho Reader Helper Production Plan

## 10.1 Runtime Shape

Target:

- Windows desktop/tray app or user-level background process.
- Binds only to `127.0.0.1`.
- Default port `47231`.
- Starts automatically for signed-in Windows user.
- Writes logs and exports under predictable local folders.
- No long-lived Supabase credentials.
- Browser handles authenticated upload to Supabase.

Checklist:

- `[x]` Local HTTP shell exists.
- `[x]` `/status` exists.
- `[x]` `POST /commands/start-read` exists.
- `[x]` `POST /commands/cancel` exists.
- `[x]` `POST /imports/register` exists.
- `[x]` `GET /exports/:readSessionId/file` exists.
- `[x]` Diagnostics endpoints exist.
- `[~]` Built-in read-only driver-card capture exists.
- `[ ]` Certified `.C1B/.DDD` binary writer not complete.
- `[ ]` VU reader/download path not ready.
- `[ ]` Production packaging not complete beyond first-pass PowerShell scaffolding.

## 10.2 Acceptance Gates

- `[ ]` `npm run tacho:helper:probe -- --base-url http://127.0.0.1:47231` passes.
- `[ ]` `npm run tacho:helper:probe -- --mode read --company-id <company-id> --user-id <manager-user-id>` passes with real reader/card.
- `[x]` Driver Card Analysis shows helper state changes correctly for normal driver-card reads.
- `[ ]` Import Centre still shows enough helper/import state for support diagnostics and manual fallback.
- `[x]` Browser-assisted upload creates `tachograph_files` row.
- `[x]` `process-tacho` runs on uploaded file.
- `[x]` Import queue shows success, partial, or failure with clear metadata.
- `[x]` Successful driver-card import opens focused analysis where driver correlation exists.
- `[ ]` Manual upload fallback works when helper is stopped.
- `[ ]` Logs diagnose failures without exposing secrets.
- `[ ]` Uninstall/reinstall does not corrupt portal state or imports.

## 10.3 Production Hardening Tasks

- `[ ]` Decide final helper stack: .NET / Tauri / Electron / other.
- `[ ]` Decide final certified card export/encoder strategy.
- `[ ]` Define VU supported devices and download path.
- `[ ]` Add code signing plan.
- `[ ]` Add versioned installer/update route.
- `[ ]` Add tray/support action: copy diagnostics.
- `[ ]` Define export/log retention period.
- `[ ]` Restrict CORS to production portal and local dev origins where practical.
- `[ ]` Add short-lived local pairing token later if spoofing risk needs mitigation.

---

# 11. Vehicle Unit Workflow Plan

The VU path is scaffolded but intentionally behind/disabled until driver-card workflow is stable.

Checklist:

- `[ ]` Select/validate real VU download path and supported device list.
- `[ ]` Decide whether VU support uses same helper or separate workflow.
- `[ ]` Enable helper `vehicle_unit` source type only after real export path is known.
- `[ ]` Reuse same reader/status overlay pattern in `VehicleUnitAnalysis`.
- `[ ]` Build VU-specific identity panel:
  - registration
  - VU serial number
  - calibration date
  - download timestamp
  - source/import status
- `[ ]` Highlight VU-specific issues:
  - overspeed
  - card/driver events
  - technical faults
  - unassigned motion
  - driver mismatch
  - cardless driving
  - calibration/workshop/security events
- `[ ]` Link VU issues to vehicle file, maintenance, incidents, and driver reviews.
- `[ ]` Add VU reports/export pack.
- `[ ]` Validate event/fault mapping against real VU files.

---

# 12. Portal UI / Routing Follow-Ups

## 12.1 Dashboard Routing / Refresh

Known issue from older follow-up doc:

- Refreshing inside manager sub-screen may reset to default dashboard landing state.
- Browser back/forward may not restore internal workspace/tab state.
- Cause likely: manager navigation held only in React component state while URL remains `/dashboard`.

Checklist:

- `[?]` Verify issue still exists.
- `[ ]` Minimum fix: query-param backed workspace state on `/dashboard`.
- `[ ]` Better long-term fix: nested dashboard routes.
- `[ ]` Preserve current workspace after refresh.
- `[ ]` Make browser back/forward restore workspace state.
- `[ ]` Ensure deep links from alerts/reports/tacho review queues still work.

## 12.2 General UI Polish After Mechanics

These are not release blockers unless UX becomes confusing.

- `[ ]` Standardise dashboard card layout.
- `[ ]` Standardise status chips and severity colours.
- `[ ]` Hide technical noise from normal users.
- `[ ]` Improve empty states.
- `[ ]` Improve mobile/tablet responsive behaviour.
- `[ ]` Apply updated HourWise brand system when ready.
- `[ ]` Update favicons/app icons/logo assets after final approval.

---

# 13. HourWise Atlas Assistant Roadmap

Full name: **HourWise Atlas Assistant**

Short name: **Atlas**

Usage examples:

- Ask Atlas
- Atlas says...
- Atlas Alert
- Atlas Briefing
- Atlas Risk Score
- Atlas Recommendation

## 13.1 Atlas Design Principles

Atlas should:

- Be proactive, not reactive.
- Explain issues clearly.
- Never overwhelm users.
- Prefer silence over noise.
- Only surface meaningful items.
- Explain why something matters.
- Suggest corrective actions.
- Never fabricate information.

## 13.2 Phase 1 - SQL / Rules-Based Fleet Intelligence

No GPT API. No chatbot.

Goal:

> Generate deterministic, auditable alerts from existing portal data.

### New Tables

- `[ ]` `atlas_alerts`
- `[ ]` `atlas_daily_briefs`
- `[ ]` `atlas_risk_scores`

Suggested `atlas_alerts` fields:

- id
- company_id
- severity
- category
- title
- description
- action_url
- resolved
- created_at

Suggested `atlas_daily_briefs` fields:

- id
- company_id
- fleet_health_score
- summary
- generated_at

Suggested `atlas_risk_scores` fields:

- driver_id
- vehicle_id
- score
- category
- generated_at

### Scheduled Checks

Driver compliance:

- `[ ]` Weekly driving > 50h warning.
- `[ ]` Weekly driving > 54h warning.
- `[ ]` Weekly driving > 56h breach.
- `[ ]` Fortnight driving > 80h warning.
- `[ ]` Fortnight driving > 85h warning.
- `[ ]` Fortnight driving > 90h breach.
- `[ ]` Working time > 55h warning.
- `[ ]` Working time > 60h breach.
- `[ ]` Repeated reduced rests.
- `[ ]` Insufficient weekly rest.
- `[ ]` Excessive spreadovers.
- `[ ]` Missing tacho uploads.
- `[ ]` Missing clock-in/out.
- `[ ]` Missing vehicle checks.

Qualification monitoring:

- `[ ]` Driving licence expiry 90/30/7 days.
- `[ ]` Driver CPC expiry.
- `[ ]` Driver card expiry.
- `[ ]` Medical expiry.

Vehicle monitoring:

- `[ ]` PMI due 30/14/7 days.
- `[ ]` PMI overdue.
- `[ ]` MOT due 30/14/7 days.
- `[ ]` MOT overdue.
- `[ ]` Insurance due/expired.
- `[ ]` Tax due/expired.
- `[ ]` Open defects.
- `[ ]` Repeated defects.
- `[ ]` Critical defects.

Payroll monitoring:

- `[ ]` App hours vs tacho hours.
- `[ ]` Tacho hours vs payroll hours.
- `[ ]` Missing shifts.
- `[ ]` Duplicate claims.
- `[ ]` Excessive overtime.
- `[ ]` Mileage/expense anomalies.

Dashboard:

- `[ ]` Fleet Health Score.
- `[ ]` Driver Health Score.
- `[ ]` Vehicle Health Score.
- `[ ]` Daily Atlas Briefing.
- `[ ]` Action links into relevant portal screens.

Example output:

```text
Atlas says:

Good morning.
Fleet Health Score: 92%.

Attention required today:
- 2 drivers approaching weekly driving limits.
- Vehicle AB12 XYZ requires PMI in 10 days.
- One driver card expires this month.
- One unresolved defect report.
```

## 13.3 Phase 2 - GPT Explanation Layer

Only implement after Phase 1 alerts are reliable.

Rule:

> GPT should not query raw tables directly. It should receive validated structured risk objects from the rules engine.

Workflow:

```text
Database
↓
Risk Engine
↓
Structured JSON
↓
GPT Prompt
↓
Natural Language Summary
```

Checklist:

- `[ ]` Create server-side GPT function/Edge Function.
- `[ ]` Send only minimum required data.
- `[ ]` Redact unnecessary PII.
- `[ ]` Add per-company usage limits later.
- `[ ]` Store generated summaries in `atlas_daily_briefs`.
- `[ ]` Do not allow GPT output to create legal findings without deterministic rule backing.
- `[ ]` Add clear wording: Atlas provides assistance, not legal certification.

Initial GPT features:

- `[ ]` AI daily briefing.
- `[ ]` Driver risk explanation.
- `[ ]` Vehicle risk explanation.
- `[ ]` Payroll discrepancy explanation.
- `[ ]` Incident investigation checklist.
- `[ ]` Manager coaching message draft.

## 13.4 Phase 3 - Ask Atlas

Natural language search after structured Atlas data exists.

Example queries:

- Which drivers need attention this week?
- Which vehicles are highest risk?
- Show unresolved defects.
- Which drivers repeatedly reduce daily rest?
- Which vehicles are due PMI in the next 14 days?
- Which drivers have outstanding incidents?

Checklist:

- `[ ]` Build query-intent router.
- `[ ]` Only allow known safe query types initially.
- `[ ]` Return structured results plus natural language explanation.
- `[ ]` Add audit log for manager queries.

---

# 14. Accreditation / O-Licence / Incident Integration

Atlas should eventually help operators prepare evidence for audits and accreditation schemes.

## 14.1 O-Licence Readiness

Current system reportedly has a basic O-Licence page gathering paperwork for inspection-ready printing.

Build direction:

- `[ ]` Convert O-Licence page into readiness dashboard.
- `[ ]` Track missing documents.
- `[ ]` Track expiring documents.
- `[ ]` Track policy acknowledgements.
- `[ ]` Track maintenance contracts.
- `[ ]` Track driver files.
- `[ ]` Track vehicle files.
- `[ ]` Generate Operator Licence Readiness Score.
- `[ ]` Generate inspection-ready evidence pack.
- `[ ]` Add Atlas alerts for missing/expired evidence.

## 14.2 Incident / Accident Reporting

Current page is basic.

Upgrade path:

- `[ ]` Add structured incident categories.
- `[ ]` Add location, vehicle, driver, third-party, weather, injury, damage, photos, witness fields.
- `[ ]` Add root-cause analysis workflow.
- `[ ]` Add corrective actions.
- `[ ]` Add action owner and due date.
- `[ ]` Add closure/sign-off.
- `[ ]` Link incidents to driver risk score.
- `[ ]` Link incidents to vehicle risk score.
- `[ ]` Link repeated incident patterns to Atlas alerts.

Atlas incident outputs:

- `[ ]` Investigation checklist.
- `[ ]` Suggested manager questions.
- `[ ]` Required evidence list.
- `[ ]` Corrective action recommendations.
- `[ ]` Lessons learned summary.
- `[ ]` Case study / audit summary PDF.

## 14.3 FORS Readiness

Track evidence areas:

- `[ ]` Driver licence checks.
- `[ ]` CPC/training records.
- `[ ]` Fuel records.
- `[ ]` Vehicle inspections.
- `[ ]` Incidents.
- `[ ]` Policies.
- `[ ]` Defect records.
- `[ ]` Management review actions.

Outputs:

- `[ ]` FORS Readiness Score.
- `[ ]` Missing evidence list.
- `[ ]` Audit pack export.

## 14.4 EcoStars Readiness

Track:

- `[ ]` MPG / fuel economy.
- `[ ]` Fuel usage.
- `[ ]` Mileage.
- `[ ]` CO2 estimate.
- `[ ]` Vehicle age.
- `[ ]` Driver efficiency indicators.

Outputs:

- `[ ]` EcoStars readiness score.
- `[ ]` Fuel-efficiency improvement recommendations.

## 14.5 SQAS Readiness

Track:

- `[ ]` Incidents.
- `[ ]` Corrective actions.
- `[ ]` Training.
- `[ ]` Inspections.
- `[ ]` Maintenance records.

Outputs:

- `[ ]` SQAS evidence pack.
- `[ ]` Missing controls/evidence report.

## 14.6 DVSA Earned Recognition Readiness

Track:

- `[ ]` Driver hours.
- `[ ]` Defects.
- `[ ]` Maintenance.
- `[ ]` Compliance records.
- `[ ]` Audit trail.

Outputs:

- `[ ]` Earned Recognition readiness score.
- `[ ]` KPI gap list.
- `[ ]` Evidence pack.

---

# 15. Testing And Validation Commands

Known commands from roadmap/checklists:

```powershell
npm run test:rules
npm run build
deno check supabase/functions/accept-driver-invite/index.ts
```

Focused lint examples:

```powershell
npx eslint src\components\manager\tachograph\TachoImportCentre.tsx src\components\manager\InviteDriverModal.tsx src\lib\tacho\driverPairing.ts
npx eslint src\hooks\useDriverTachoSummary.ts
npx eslint src\components\manager\tachograph\TachoReaderHelperPanel.tsx
npx eslint src\components\manager\tachograph\TachoReaderStatusOverlay.tsx src\components\manager\tachograph\DriverCardAnalysis.tsx src\components\manager\tachograph\VehicleUnitAnalysis.tsx src\components\manager\tachograph\TachoComplianceWorkspace.tsx src\components\manager\tachograph\TachoActivityTimeline.tsx
npx eslint src\hooks\useTachoReaderWorkflow.ts src\components\manager\tachograph\DriverCardAnalysis.tsx
npx eslint src\components\manager\DriverDetailsModal.tsx src\components\manager\tachograph\TachoImportCentre.tsx src\components\manager\tachograph\DriverCardAnalysis.tsx src\components\manager\tachograph\TachoReaderHelperPanel.tsx src\hooks\useDriverTachoSummary.ts src\lib\tacho\api.ts src\lib\tacho\helperImport.ts
```

Helper probes:

```bash
npm run tacho:helper:probe -- --base-url http://127.0.0.1:47231
npm run tacho:helper:probe -- --mode read --company-id <company-id> --user-id <manager-user-id>
```

Deployment reminders:

```powershell
.\supabase.exe db push
.\supabase.exe functions deploy process-tacho --use-api
.\supabase.exe functions deploy create-driver-invite --use-api
.\supabase.exe functions deploy lookup-driver-invite --use-api
.\supabase.exe functions deploy accept-driver-invite --use-api
git push
```

Current tachograph deploy note:

```powershell
.\supabase.exe db push
.\supabase.exe functions deploy accept-driver-invite --use-api
.\supabase.exe secrets set PROCESS_TACHO_TRIGGER_TOKEN="your-long-random-token"
git push
```

`PROCESS_TACHO_TRIGGER_TOKEN` must match the secret used by `process-tacho` for server-triggered processing. Without it, invite acceptance still links imports but automatic signal rebuild returns a warning and managers must use `Rebuild Tacho Signals`.

Known warning:

- Vite may warn that `index` and `react-pdf.browser` chunks exceed 500 kB. This is pre-existing and not specific to tachograph work.

Known local limitation:

- Local TypeScript checks against Deno Supabase Edge Functions may not be clean because of Deno remote imports/globals and pre-existing type drift. Use deploy/runtime validation carefully.

---

# 16. Release Readiness Checklist

Do not consider customer release ready until these are complete.

## Security

- `[~]` No embedded bearer tokens in SQL triggers.
  - 2026-06-21: Repo/deployed migration review found no SQL `Bearer` token pattern; direct live catalog SQL still pending due missing `psql`/Docker.
- `[?]` Supabase secrets rotated if previously exposed.
  - 2026-06-21: Secret names/digests exist, but rotation history still needs dashboard/audit confirmation.
- `[~]` `driver_invites` anonymous broad read removed.
  - 2026-06-21: Migration/RPC review confirms intended fix; direct live `pg_policies` query still pending.
- `[ ]` RLS checked for new tachograph/Atlas/incident/accreditation tables.
- `[x]` Storage buckets private where needed.
  - 2026-06-21: Bucket migrations set document/tachograph buckets private and enforce company/user path policies; `logos` remains public by design.
- `[!]` Edge Functions reviewed for auth/company scope.
  - 2026-06-21: Local reviewed portal functions are mostly scoped. App repo confirmed `calculate-compliance` is no longer needed for normal shift-end compliance writes; portal migration removes stale DB trigger paths. Remote app-owned function still needs coordinated hardening/removal from the app repo before this can be closed.

## Tachograph

- `[ ]` Real driver-card files validated.
- `[ ]` Real VU files validated.
- `[ ]` EF `0504` provisional parser validated against certified parser output.
- `[ ]` Read-only capture correctly labelled if certified C1B/DDD writer still absent.
- `[ ]` Findings are explainable and evidence-backed.
- `[ ]` Manual upload fallback works.
- `[ ]` Import retry works.
- `[ ]` Partial/failure states are clear.

## Helper

- `[ ]` Real card read works repeatedly.
- `[ ]` Reader removal/insertion state clears correctly.
- `[ ]` Logs are useful and safe.
- `[ ]` Installer/uninstaller tested.
- `[ ]` Version visible in `/status`.

## UX

- `[ ]` Driver Card Analysis is supervisor-readable.
- `[ ]` Import Centre is not overwhelming.
- `[ ]` Dashboard refresh/back/forward behaviour verified or fixed.
- `[ ]` Empty/loading/error states are polished.

## Operational Validation

- `[ ]` Driver profile pairing tested.
- `[ ]` Pending invite pairing tested.
- `[ ]` Invite-from-card flow tested.
- `[ ]` Driver app invite acceptance tested.
- `[ ]` Driver file tacho summary updates after accepted/paird import.
- `[ ]` Reports/evidence packs generate with correct branding and data.

---

# 17. Suggested Next Agent Prompt

Use this if handing the next stage to Codex:

```text
You are working in the HourWiseEU_Fleet_Portal repo.
Use docs/hourwise-portal-master-build-plan.md as the single source of build priorities.
First, verify the P0 security items and mark each as complete, stale, or still outstanding.
Then focus on tachograph live-card workflow stabilisation and Driver Card Analysis polish.
Do not remove manual upload fallback.
Do not make release/legal claims that the current HourWise read-only capture is certified .C1B/.DDD.
Keep this markdown checklist updated as you complete or verify items.
```

---

# 18. Current Immediate Next Actions

Recommended next actions for the agent:

1. `[x]` Master plan exists in repo at `docs/hourwise-portal-master-build-plan.md`.
2. `[~]` Run security verification SQL and update Section 6 statuses.
   - 2026-06-21: Updated Section 6 from deployed migration/source review, `supabase migration list`, `supabase functions list`, and `supabase secrets list`. Direct SQL is still pending because this machine has no `psql` and Supabase CLI schema dump requires Docker.
3. `[~]` Coordinate cleanup of active shared-app `calculate-compliance` Edge Function dependency.
   - 2026-06-21: App repo confirmed production shift-end code writes compliance results directly to `work_sessions`; portal repo search found no direct Edge Function call. Added `supabase/migrations/20260621114500_remove_legacy_work_session_compliance_triggers.sql` to remove the two stale `work_sessions` HTTP trigger paths. Do not delete/deploy `calculate-compliance` itself from the portal repo; app repo still owns final function hardening/removal.
4. `[ ]` Run direct live catalog checks when tooling is available:
   - trigger `action_statement ilike '%Bearer%'`
   - `driver_invites` `pg_policies`
   - storage bucket/policy state
   - SECURITY DEFINER `search_path`
5. `[ ]` Confirm deployed helper/backend/frontend versions.
6. `[ ]` Run real card read through Driver Card Analysis, not just Import Centre.
7. `[ ]` Capture visual/UI issues from the real parsed card output.
8. `[~]` Fix pairing success/error feedback if the existing-driver pair flow can show a failed message while the database update succeeds.
   - 2026-06-21: Implemented client-side verification fallback and separated Import Centre refresh errors from pair RPC errors. Needs live retest with existing-driver card pairing.
9. `[~]` Polish Driver Card Analysis layout and labels.
   - 2026-06-21: Added manager report panel, screening report toggle, provisional-capture caveat, print/save-PDF action, and expanded evidence CSV. Focused ESLint and `npm run build` passed. Needs live visual review after deployment.
10. `[x]` Collapse Import Centre technical noise.
   - 2026-06-20: Added supervisor filters, lifecycle labels, candidate archive/delete controls, default-hidden diagnostics, and hidden-by-default archived/superseded audit rows.
11. `[~]` Design review/sign-off persistence tables before implementing personnel-file persistence.
   - 2026-06-21: Added review/sign-off tables, audit events table, manager-scoped save RPC, frontend API helpers, and Driver Card Analysis review panel. Verified with focused ESLint, `npm run build`, and `npm run test:rules`. Needs `supabase db push` and live save/reload retest.
12. `[ ]` Continue EF `0504` validation against known-good tachograph parser output.
13. `[ ]` Leave Atlas implementation until the main portal data sources are stable.
