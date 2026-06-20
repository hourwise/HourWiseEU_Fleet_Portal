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
- `[~]` EF `0504` daily activity decode exists provisionally and has processed at least one retry successfully.
- `[~]` Driver-card import pairing/invite-from-card workflows exist and have had live testing.
- `[~]` Driver Card Analysis now owns first-pass live card read/import workflow through `useTachoReaderWorkflow`.
- `[~]` Candidate/unmatched card analysis by `import_id` exists.
- `[x]` Local validation has passed for the latest Driver Card Analysis live-reader frontend work: focused ESLint, `npm run build`, and `git diff --check`.
- `[ ]` Latest Driver Card Analysis live-reader frontend work still needs push/deployment and real helper/card retest before marking production-stable.

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
- `[?]` Verify whether trigger bearer tokens have been removed from SQL trigger definitions.
- `[?]` Verify whether `driver_invites` anonymous broad read has been removed.
- `[?]` Verify storage policies, RLS, SECURITY DEFINER functions, and Edge Function auth.

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
- `[?]` Confirm no service-role bearer tokens remain embedded in SQL trigger definitions.
- `[ ]` If any token remains, rotate the secret and replace the pattern.

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

- `[?]` Verify `public.broadcasts.on_new_broadcast` contains no embedded bearer token.
- `[?]` Verify `public.tachograph_files.process_tacho_files` contains no embedded bearer token.
- `[?]` Verify optional DB-trigger tacho dispatch uses dedicated trigger token/runtime config, not service-role bearer in SQL.

## 6.3 Fix `driver_invites` Anonymous Read

- `[?]` Verify `driver_invites` no longer has public SELECT policy with `qual = true`.
- `[?]` Verify invite lookup now uses safe RPC or Edge Function.
- `[?]` Verify lookup requires exact invite code, pending status, and non-expired invite.
- `[?]` Verify lookup returns only safe signup fields.
- `[?]` Verify manager invite management is company-scoped.

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

- `[?]` Verify `shift_jobs` has RLS enabled.
- `[?]` Verify mobile users can read own shift jobs.
- `[?]` Verify managers can read company driver shift jobs.
- `[?]` Confirm whether `user_id` references `auth.users.id` or `profiles.id`.

## 6.5 Storage Policies

Buckets to verify:

- `defect-photos`
- `driver-documents`
- `vehicle-documents`
- `logos`
- `tachograph-files`

Checklist:

- `[?]` Confirm canonical storage path conventions for mobile and portal.
- `[?]` Confirm `defect-photos` has INSERT policy for app uploads.
- `[?]` Confirm `driver-documents` supports intended driver/company paths.
- `[?]` Confirm `vehicle-documents` supports intended vehicle/company paths.
- `[?]` Confirm `tachograph-files` is private and company-scoped.
- `[?]` Confirm private document buckets are not public.
- `[?]` Confirm file size and MIME limits exist where appropriate.

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

- `[?]` Each SECURITY DEFINER function sets safe `search_path`.
- `[?]` Each validates `auth.uid()` ownership/company membership.
- `[?]` Invite acceptance blocks expired/accepted invites.
- `[?]` Role/company updates cannot escalate privileges.
- `[?]` Card pairing validates manager company scope.

## 6.7 Edge Function Auth Review

Functions to review:

- `delete-user-data`
- `send-broadcast`
- `process-tacho`
- `calculate-compliance`
- `create-driver-invite`
- `lookup-driver-invite`
- `accept-driver-invite`

Checklist:

- `[?]` Server-side auth is checked.
- `[?]` Company ownership is validated.
- `[?]` Service-role use is limited to necessary operations.
- `[?]` Logs do not contain tokens, PII, payroll data, private document URLs, or excessive tacho personal data.

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
- `[ ]` Confirm Driver Card Analysis resets to blank calendar after card removal when appropriate.
- `[ ]` Confirm the compact live reader panel in Driver Card Analysis, not Import Centre, is the normal path for driver-card reads.

## 7.2 Reprocess / Re-read Known Driver Card Imports

Known import IDs from roadmap:

- `ae681c85-fb6f-4b5a-aaf5-b7fa32312e39`
- `e872ed0c-b7d7-4894-b5a4-990da8a8acd8`
- `3fa66667-7ebb-408d-af36-6359aab15df3`
- `7e25babd-92e5-4b10-abf1-29ec17f0a12d`

Checklist:

- `[ ]` Use Import Centre retry for known imports where available.
- `[ ]` Prefer UI retry if local env lacks `PROCESS_TACHO_TRIGGER_TOKEN`.
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
- `[ ]` Verify card imports/downloads link to accepted profile.

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

---

# 8. Driver Card Analysis Workspace Plan

## 8.1 Workspace Behaviour

Target behaviour:

- Graph/analysis screen fills the page.
- Reader status appears as overlay/status panel, not a separate page.
- Manual file import remains available.
- Results open matched driver analysis or candidate card mode.
- Card removal clears live auto-opened result back to blank calendar, without deleting stored imports.

Checklist:

- `[~]` Driver Card Analysis owns live read/import workflow through `useTachoReaderWorkflow`.
- `[ ]` Retest live flow after frontend deployment using real helper/card.
- `[ ]` Confirm blank 7-day calendar appears by default when no data is selected.
- `[ ]` Confirm matched reads open linked-driver analysis.
- `[ ]` Confirm unmatched reads open candidate card mode by `import_id`.
- `[ ]` Confirm personnel/training/compliance actions are disabled in candidate mode.
- `[ ]` Confirm card removal only clears the auto-opened live result and does not delete or hide stored historical imports.

## 8.2 Page Header / Action Bar

Add or verify actions:

- `[ ]` `Read From Card`
- `[ ]` `Import File`
- `[ ]` `Export Report`
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

- `[ ]` Design persistence tables for review/sign-off.
- `[ ]` Store manager review state.
- `[ ]` Store manager notes.
- `[ ]` Store corrective action references.
- `[ ]` Store audit log of review edits.
- `[ ]` Add optional driver acknowledgement later.
- `[ ]` Link signed-off findings into personnel/training/compliance views.

---

# 9. Import Centre Cleanup

Goal: after Driver Card Analysis owns normal live card reads, Import Centre should stop feeling like the main reader page.

Keep:

- `[ ]` VU import/download controls.
- `[ ]` Manual driver-card file import fallback.
- `[ ]` Import review and retry handling.
- `[ ]` Candidate card review entry point.
- `[ ]` Support diagnostics behind disclosure.

Demote/collapse:

- `[ ]` Backend IDs.
- `[ ]` Helper correlation fields.
- `[ ]` Raw metadata.
- `[ ]` Trigger dispatch debug state.
- `[ ]` Processor error internals.

Remove or reduce:

- `[ ]` Live driver-card reader duplication now owned by Driver Card Analysis.

Acceptance criteria:

- `[ ]` A normal supervisor sees a clean import/review page.
- `[ ]` Support staff can still expand diagnostics when needed.
- `[ ]` Manual fallback remains obvious.
- `[ ]` Retry processing remains available for failed/kickoff/partial states.

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
- `[ ]` Driver Card Analysis shows helper state changes correctly for normal driver-card reads.
- `[ ]` Import Centre still shows enough helper/import state for support diagnostics and manual fallback.
- `[ ]` Browser-assisted upload creates `tachograph_files` row.
- `[ ]` `process-tacho` runs on uploaded file.
- `[ ]` Import queue shows success, partial, or failure with clear metadata.
- `[ ]` Successful driver-card import opens focused analysis where driver correlation exists.
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
```

Focused lint examples:

```powershell
npx eslint src\components\manager\tachograph\TachoImportCentre.tsx src\components\manager\InviteDriverModal.tsx src\lib\tacho\driverPairing.ts
npx eslint src\hooks\useDriverTachoSummary.ts
npx eslint src\components\manager\tachograph\TachoReaderHelperPanel.tsx
npx eslint src\components\manager\tachograph\TachoReaderStatusOverlay.tsx src\components\manager\tachograph\DriverCardAnalysis.tsx src\components\manager\tachograph\VehicleUnitAnalysis.tsx src\components\manager\tachograph\TachoComplianceWorkspace.tsx src\components\manager\tachograph\TachoActivityTimeline.tsx
npx eslint src\hooks\useTachoReaderWorkflow.ts src\components\manager\tachograph\DriverCardAnalysis.tsx
```

Helper probes:

```bash
npm run tacho:helper:probe -- --base-url http://127.0.0.1:47231
npm run tacho:helper:probe -- --mode read --company-id <company-id> --user-id <manager-user-id>
```

Deployment reminders:

```powershell
supabase db push
supabase functions deploy process-tacho
supabase functions deploy create-driver-invite
supabase functions deploy lookup-driver-invite
supabase functions deploy accept-driver-invite
git push
```

Known warning:

- Vite may warn that `index` and `react-pdf.browser` chunks exceed 500 kB. This is pre-existing and not specific to tachograph work.

Known local limitation:

- Local TypeScript checks against Deno Supabase Edge Functions may not be clean because of Deno remote imports/globals and pre-existing type drift. Use deploy/runtime validation carefully.

---

# 16. Release Readiness Checklist

Do not consider customer release ready until these are complete.

## Security

- `[ ]` No embedded bearer tokens in SQL triggers.
- `[ ]` Supabase secrets rotated if previously exposed.
- `[ ]` `driver_invites` anonymous broad read removed.
- `[ ]` RLS checked for new tachograph/Atlas/incident/accreditation tables.
- `[ ]` Storage buckets private where needed.
- `[ ]` Edge Functions reviewed for auth/company scope.

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
2. `[ ]` Run security verification SQL and update Section 6 statuses.
3. `[ ]` Confirm deployed helper/backend/frontend versions.
4. `[ ]` Run real card read through Driver Card Analysis, not just Import Centre.
5. `[ ]` Capture visual/UI issues from the real parsed card output.
6. `[ ]` Polish Driver Card Analysis layout and labels.
7. `[ ]` Collapse Import Centre technical noise.
8. `[ ]` Design review/sign-off persistence tables before implementing personnel-file persistence.
9. `[ ]` Continue EF `0504` validation against known-good tachograph parser output.
10. `[ ]` Leave Atlas implementation until the main portal data sources are stable.
