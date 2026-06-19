# Tachograph Roadmap: Phases 1-9

## Purpose

This document is the working recovery plan for the tachograph programme if work is interrupted.

It covers:

- what the portal is trying to achieve
- what has already been implemented
- what still remains from earlier phases
- the detailed delivery plan for Phases 5-9

The target product remains:

- driver card and VU analysis that is clear, fast, and operationally useful
- tachograph truth taking precedence over app-derived clocking summaries
- direct workflows for supervisors similar in spirit to Tachomaster
- cleaner portal navigation with fewer duplicated entry points

## Repo Assessment Update (2026-05-19)

This repo now appears to be past the original "Phase 4 complete / Phase 5 not started" checkpoint.

Based on the current frontend and this implementation pass:

- Phase 5 is now functionally advanced:
  - explicit driver and vehicle selection is in place
  - deep-link date context is surfaced in the analysis workspaces
  - driver and vehicle analysis now expose direct supervisor follow-up actions
  - empty / no-data / partial-state handling has been strengthened
- Phase 6 is now materially implemented in frontend:
  - driver files show live tacho summary status and direct analysis/training/compliance actions
  - vehicle files show VU summary status and direct analysis / maintenance / incident actions
  - training assignment from driver-card analysis is wired for repeated tacho patterns
  - infringement records can reopen the underlying driver tacho review context
  - reports now support focused tacho follow-up exports and preselected evidence-pack generation
- Phase 7 is now functionally implemented in the manager frontend:
  - navigation is grouped into Dashboard / People / Fleet / Compliance / Reports / Settings
  - legacy modules remain reachable through grouped subnavigation
  - tacho destinations are consolidated under the compliance workspace
- Phase 8 is now scaffolded in frontend:
  - the import centre includes a reader-helper panel that polls a local helper endpoint
  - helper operator actions and a localhost API contract are now defined in-repo
  - a production Windows helper implementation checklist is now defined in-repo
  - a local mock helper is now available for UI testing without the Windows executable
  - mock-only debug controls are now exposed in the reader panel when the mock helper is detected
  - the mock helper now simulates export file, upload receipt, backend job, and import correlation data
  - the mock helper now supports scenario switching for slow upload, backend failure, and missing-driver cases
  - a regression harness now validates all named mock-helper scenarios automatically
  - a standalone contract probe now validates any running helper in smoke or staged read mode
  - a first `.NET` Windows-helper shell now exists and passes the localhost smoke probe
  - the `.NET` shell now polls Windows PC/SC smart-card readers and maps reader/card presence into helper status
  - the `.NET` shell now has a configurable external export-command seam that can expose a produced card file through the browser handoff route
  - the `.NET` shell now has JSONL support logging and `/diagnostics` endpoints for config, capabilities, state, and recent events
  - the `.NET` shell now includes a disabled-by-default `vehicle_unit` source-type shape for the future VU reader/download workflow
  - the `.NET` shell also supports explicit placeholder-reader mode for full read/register contract probing without hardware
  - the `.NET` shell now has first-pass Windows install/uninstall PowerShell scaffolding for published app placement, startup registration, version metadata, logs, and exports
  - the `.NET` shell now includes a first PC/SC APDU probe endpoint for inserted cards as the foundation for the bundled exporter
  - the PC/SC probe has now confirmed the first real-card tachograph application path via EF.DIR AID `FF544143484F` and initial reads from application files `0501`, `050E`, `0520`, and `0504`
  - the helper now guards every APDU transmit with a read-only allowlist and includes a bounded file-map probe that reads confirmed tachograph EFs without write/security commands
  - the helper now defaults `start-read` to a built-in read-only driver-card capture container with real EF bytes and per-file hashes while the final certified `.C1B` encoder remains outstanding
  - `process-tacho` now recognizes the HourWise read-only capture container and records it as a controlled `partial` import with sanitized EF metadata instead of treating it as a parser failure
  - the helper contract has been validated with placeholder bytes and a simulated external export command producing fake bytes
  - the reader panel now includes a first customer-facing HourWise reader console inspired by the Tachomaster-style reference without copying its visual scheme
  - a production helper-to-Supabase handoff contract is now defined against the live import pipeline
  - browser-assisted helper imports now upload exported files into Supabase Storage and register `tachograph_files` rows
  - browser-originated imports now request `process-tacho` directly instead of depending on undeclared deployment glue
  - an optional DB-trigger dispatch path now exists for non-browser ingest, using a dedicated trigger token instead of a bearer secret in SQL
  - import-centre observability now surfaces kickoff failures, trigger-dispatch failures, and processor errors from import metadata
  - runtime SQL configuration guidance now exists for the optional DB-trigger dispatch path
  - a dedicated admin edge function and local script now exist to configure or inspect the optional DB-trigger runtime without direct SQL tooling
  - import monitoring now has repo-backed summary logic, telemetry hooks, and a synthetic regression fixture set for failure-state stability
  - imports with kickoff, dispatch, or failed-processing issues can now request a direct processing retry from the review pane
  - successful helper completion can auto-open focused driver analysis
  - the manual upload fallback now sits beside the helper workflow on the same page
  - driver and vehicle workspaces now put the historical activity strip first, support a 12-month range, and expose a vehicle-history ledger focused on who drove which vehicle on each recorded day
- parser-simulation infrastructure now exists in-repo so rule and reconciliation scenarios can be exercised without real tachograph binaries
- the simulator library now covers split-break, weekly, fortnight, daily-rest, weekly-rest, WTD-break, and app-vs-tacho mismatch scenarios
- a dev-only simulator preview tab now renders those scenarios through the actual tachograph timeline and day-detail components
- the simulator preview now also covers VU technical events and motion-discrepancy presentation for cardless driving, driver mismatch, and overspeed-style scenarios
- vehicle-history simulator coverage now includes multi-driver consecutive-day use, same-day handover, partial assigned motion gaps, and attribution-conflict scenarios
- parser-like bad-data simulator coverage now includes overlapping activities, missing timestamps, and malformed timing, with the preview handling those cases as controlled errors instead of crashing
- Phase 9 simulator coverage now also includes multi-manning review windows and reduced-weekly-rest compensation context
- reduced weekly rest is now tracked through compensation `pending`, `completed`, and `missing` outcomes in the shared rules engine and simulator coverage
- qualifying same-vehicle overlapping different-driver activity is now treated as multi-manning review context rather than generic overlap data quality, while impossible concurrent driving overlaps still raise data-quality issues
- vehicle review surfaces now expose that context directly in the vehicle history ledger and day-detail drawer so supervisors can see team-driving periods without parsing raw findings

Still external or not fully executable from this repo alone:

- production helper executable packaging beyond the first-pass PowerShell install scaffold
- full tachograph card file traversal and `.C1B/.DDD` writer on top of the new PC/SC APDU probe
- selected/validated real VU download path and supported device list
- backend deployment confirmation
- real-file regression / parser validation
- release hardening, monitoring, RLS review, and UAT

---

## Latest Resume Snapshot (2026-06-19)

This section captures the current live-card progress so work can resume after a machine restart without relying on chat history.

### Live Reader / Helper State

- Real hardware test has been performed with:
  - Alcorlink USB Smart Card Reader
  - real inserted driver card
  - local helper endpoint `http://127.0.0.1:47231`
- Expected helper version after the latest restart is:
  - `dotnet-shell-0.5.9`
- Helper `0.5.9` includes the state-machine fix for stale reader/card state:
  - card/reader removal is no longer ignored after `processing` or `complete`
  - helper can clear active workflow fields when hardware state changes
  - browser UI can recover from completed/partial reads and start another read
- Built-in read-only EF capture works on the real card:
  - helper reads the confirmed tachograph AID path
  - helper captures the safe EF set into the HourWise JSON container
  - browser downloads the helper export
  - browser uploads to Supabase Storage
  - browser inserts `tachograph_files`
  - browser invokes `process-tacho`
  - import completes as controlled `partial`
- Current capture remains diagnostic:
  - `export_format = hourwise_read_only_capture_v1`
  - `parser_status = partial_helper_capture`
  - no certified `.C1B/.DDD` binary writer yet
  - no normalized activity segments yet
  - legal totals in the reader console remain placeholders until EF activity parsing is implemented

### Real Card Decode Progress

- `process-tacho` now recognizes `hourwise.tachograph.driver-card.read-only-capture.v1`.
- The read-only parser now decodes EF `0520` card identity.
- Confirmed decoded fields from the real test card include:
  - driver holder name
  - tachograph card number hint
  - issuing authority
  - issue date
  - validity begin date
  - expiry date
  - preferred language
- The exact card number/name are intentionally not repeated in this roadmap. They are visible in the relevant `tachograph_files.metadata` rows in the live DB if needed.
- Identity decode confirmed the key operational case:
  - if no profile has `profiles.tacho_card_number` matching the decoded card, the import remains unpaired with `driver_id = null`
  - the import review now treats this as an explicit supervisor workflow, not a parser failure

### Supabase / Backend Changes Added

Recent migrations added during the live-card work:

- `20260618210500_add_tachograph_storage_bucket.sql`
  - creates the private `tachograph-files` bucket
  - adds company-scoped storage policies
- `20260619113000_add_tacho_card_pairing.sql`
  - adds `profiles.tacho_card_number`
  - adds a per-company unique index for tacho card numbers
  - adds `pair_tacho_card_import_to_driver(...)`
  - lets a manager safely pair a decoded card import to an existing driver profile
  - backfills the import/download/normalized rows for that import
- `20260619131500_add_tacho_card_invite_prefill.sql`
  - adds tachograph card identity fields to `driver_invites`
  - updates `accept_driver_invite(...)`
  - when a driver accepts an invite, the accepted profile receives the stored `tacho_card_number`
  - prior unmatched imports/downloads for that card number are linked to the new profile where possible

Backend functions changed:

- `supabase/functions/process-tacho/index.ts`
  - detects the HourWise read-only capture container before ReadESM parsing
  - stores sanitized helper EF metadata as a controlled partial import
  - decodes EF `0520` identity from the capture
  - attempts exact card-number match against `profiles.tacho_card_number`
  - writes a `driver_card_downloads` identity-only row with `download_status = partial_identity`
- `supabase/functions/create-driver-invite/index.ts`
  - accepts optional `tachographCardSnapshot`
  - stores decoded card number/name/expiry/issuer/source import id on the invite
- `supabase/functions/lookup-driver-invite/index.ts`
  - added after mobile invite lookup reported `permission denied for table driver_invites`
  - mobile invite lookup must call this Edge Function or the `lookup_pending_driver_invite(...)` RPC, not read `driver_invites` directly
- `supabase/functions/accept-driver-invite/index.ts`
  - already calls the safe `accept_driver_invite(...)` RPC
  - deploy after invite/card migrations so accepted invites can write `profiles.tacho_card_number`

Deployment reminder:

```powershell
supabase db push
supabase functions deploy process-tacho
supabase functions deploy create-driver-invite
supabase functions deploy lookup-driver-invite
supabase functions deploy accept-driver-invite
git push
```

If `supabase db push` fails near the start of `20260614115811_security_hardening_shared_database.sql`, check for a UTF-8 BOM. That BOM was previously removed locally after causing a syntax error at statement 0.

### Frontend Changes Added

Reader/import UI:

- `src/components/manager/tachograph/TachoReaderHelperPanel.tsx`
  - allows read-only helper captures to upload as controlled diagnostic partial imports
  - shows `Diagnostic partial` instead of blocking on `exportParserReady=false`
  - preserves cancel/restart ability from helper state
  - clears stale tracked import state when helper read session resets
- `src/components/manager/tachograph/TachoImportCentre.tsx`
  - shows decoded card identity in Import Review
  - shows `Unmatched Card Identity` when card is decoded but no driver profile is matched
  - supports pairing a decoded card to an existing driver profile
  - supports pairing a decoded card to an existing pending driver invite
  - supports `Invite Driver From Card` when no driver profile exists yet
  - passes decoded card snapshot into the invite modal
- `src/components/manager/InviteDriverModal.tsx`
  - accepts optional initial full name
  - accepts optional tachograph card snapshot
  - shows a tachograph-card prefill notice
  - sends the card snapshot to `create-driver-invite`
- `src/components/manager/DriverManagement.tsx`
  - pending invites now expose `Invite Details`
  - managers can edit pending invite name/email/tachograph card fields before the driver accepts
  - this addresses the flow gap where pending invited drivers could not be amended because no `profiles` row exists yet
- `src/lib/tacho/driverPairing.ts`
  - fetches available company driver profiles for pairing
  - calls `pair_tacho_card_import_to_driver(...)`
  - fetches pending company driver invites and writes decoded card identity onto the selected invite
- `src/lib/tacho/adapters.ts` and `src/lib/tacho/rules/types.ts`
  - expose decoded card identity fields on `TachoImportRecord`

Planning doc added:

- `docs/tacho-driver-card-view-build-plan.md`
  - full-page driver-card analysis UI plan
  - reader overlay behaviour
  - similar layout direction for VU reader/analysis flow

### Validation Already Run Locally

Recent validation commands that passed:

```powershell
npx eslint src\components\manager\tachograph\TachoImportCentre.tsx src\components\manager\InviteDriverModal.tsx src\lib\tacho\driverPairing.ts
npm run test:rules
npm run build
```

Known build warning:

- Vite still warns that `index` and `react-pdf.browser` chunks exceed 500 kB.
- This warning is pre-existing and not specific to the tachograph card-reader work.

### Current Known Limitations

- The helper is still producing a read-only HourWise JSON capture, not a certified `.C1B/.DDD` tachograph download file.
- EF identity parsing is working, but EF activity parsing is not yet normalized into driver activities.
- Reader console legal totals are placeholders until EF `0504` driver activity is decoded and fed into the existing rules engine.
- VU workflow is still scaffolded/disabled in helper `0.5.9`.
- Existing imports before identity parsing may remain `Unmatched card` if their metadata lacks decoded identity fields.
- If a company has no driver profiles, the card can now create a prefilled invite, but the real `profiles` row is still only created/linked when the driver accepts the invite through the normal app flow.

### Immediate Next Steps After Restart

Latest confirmed checkpoint before restart:

- `Pair To Pending Invite` has been tested in Import Review.
- A decoded card was successfully attached to pending invite `Philip Christopher Geran - philgeran+test55@gmail.com`.
- UI confirmation shown:
  - `Card DB18220162003911 will pair to Philip Christopher Geran when the invite is accepted.`
- Next external blocker is the EAS mobile app build in the app repo.
- Resume by testing invite lookup/acceptance on the updated app build.

1. Confirm clean helper state:
   - restart helper if needed
   - confirm `/status` reports `dotnet-shell-0.5.9`
   - confirm reader/card state updates correctly when card is removed/reinserted
2. Deploy pending DB/function changes:
   - `supabase db push`
   - `supabase functions deploy process-tacho`
   - `supabase functions deploy create-driver-invite`
   - `supabase functions deploy lookup-driver-invite`
   - `supabase functions deploy accept-driver-invite`
3. Push frontend to Vercel:
   - `git push`
4. Test unmatched-card invite flow:
   - read the card
   - open Import Review
   - click `Invite Driver From Card`
   - send invite with decoded name/card snapshot
   - in Driver Management, confirm pending invite has `Invite Details`
   - edit pending invite/card fields there if needed before acceptance
   - accept invite as the driver
   - verify accepted profile has `profiles.tacho_card_number`
   - verify prior imports/downloads for the same card number are linked to the profile
5. Test existing-profile pairing flow:
   - create or use a driver profile without `tacho_card_number`
   - read the card
   - select that driver in `Pair To Driver Profile`
   - click `Pair Card`
   - verify `tachograph_files.driver_id`, `driver_card_downloads.driver_id`, and `profiles.tacho_card_number`
6. Test pending-invite pairing flow:
   - create a pending invite first
   - read the card
   - select the invite in `Pair To Pending Invite`
   - click `Pair Pending Invite`
   - verify `driver_invites.tacho_card_number` is set
   - accept the invite and verify the new profile receives `profiles.tacho_card_number`
7. After EAS app build completes, test mobile invite acceptance:
   - app must use `lookup-driver-invite` or `lookup_pending_driver_invite(...)`, not direct `driver_invites` reads
   - app must use `accept-driver-invite` or `accept_driver_invite(...)`, not direct `driver_invites` updates
   - confirm accepted user profile joins the company as `role = driver`
   - confirm `profiles.tacho_card_number` is populated from the pending invite
   - confirm the pending invite moves to `accepted`
   - confirm prior card imports/downloads for the same card number link to the accepted profile
8. Re-read the same card after invite acceptance:
   - import should auto-match the driver profile
   - Import Review should no longer show the card as unmatched
   - Reader console should show the driver target without manual pairing
9. Start next parser milestone:
   - decode EF `0504` driver activity records from the read-only capture
   - normalize activities into `tachograph_activity_segments`
   - feed those segments into the existing rules engine
   - replace reader-console placeholder totals with parsed activity/rule output
10. Start UI-layout milestone from:
   - `docs/tacho-driver-card-view-build-plan.md`
   - target: analysis graph fills the page, reader state appears as an overlay/status layer

---

## End Goal

The intended end state is:

1. A browser-first tachograph import system for `.ddd`, `.c1b`, and `.v1b` files, with a future desktop helper for live card-reader flow.
2. A real rules engine for card and VU data with evidence-backed driver hours, WTD, reconciliation, and VU event findings.
3. Driver card and VU analysis screens that support:
   - last 7 days
   - last 30 days
   - last 3 months
   - last 6 months
4. Tacho data treated as the compliance source of truth.
5. App data treated as:
   - clock-in / clock-out record
   - manual-entry support
   - Timeright cross-check source
6. Cross-links from dashboard and compliance review rows directly into the exact driver, vehicle, and day that needs review.
7. A simpler manager UI with fewer top-level tabs and clearer grouped workspaces.

---

## Current Phase Status

| Phase | Name | Status | Notes |
|---|---|---|---|
| 1 | Stabilize pipeline | Mostly complete | Core schema, frontend contracts, and import path are in place. Live file testing still depends on obtaining real card/VU files. |
| 2 | Rules engine | Strongly complete | Shared normalization, shared rule core, shared evaluator, rolling limits, rest, WTD, and reconciliation base are implemented and tested. |
| 3 | VU event deepening | Strongly complete | Severity-aware VU events, discrepancy storage, import-centre review, and vehicle review UX are in place. |
| 4 | App vs tacho reconciliation | Functionally complete | Driver/vehicle/day deep-linking is implemented; review focus is now part of normalized signals. Final backend deploy still required. |
| 5 | Finish analysis workspaces | Largely complete in frontend | Explicit driver/vehicle targeting, selected-day context, follow-up actions, and stronger empty states are now in place. |
| 6 | Embed tacho across portal | Largely complete in frontend | Driver and vehicle record integration, training links, infringement review linking, and focused tacho evidence exports are now in place. |
| 7 | Navigation cleanup | Functionally complete in frontend | Grouped top-level workspaces and consolidated compliance destinations are now implemented while keeping legacy reachability. |
| 8 | Reader helper | Live read-only card flow working | Windows helper `0.5.9` reads real driver-card EFs through PC/SC, browser uploads the helper capture, Supabase records controlled partial imports, EF `0520` identity decoding works, and manager pairing/invite-from-card flows are now in place. Certified `.C1B/.DDD` writer and activity parsing remain next. |
| 9 | Hardening and release | Not started | Real file regression set, monitoring, RLS review, and rollout prep still to do. |

---

## Completed So Far

### Phase 1

Completed:

- Normalized tacho contract created.
- Normalized storage model introduced in Supabase migrations.
- `process-tacho` edge function reworked to store:
  - raw compatibility rows
  - normalized activities
  - findings
  - technical events
  - signal rows
  - discrepancy rows
  - reconciliation rows
- Frontend analysis hooks now prefer live RPC-backed bundles and fall back to mocks.
- Import centre, driver card analysis, vehicle unit analysis, timeline, filters, and day drawer were scaffolded.

Still to cover:

- End-to-end validation with real `.ddd/.c1b/.v1b` files.
- Confirm live parser shape against real DigiVu exports.
- Confirm no remaining schema drift between repo and live Supabase.
- Replace the exposed trigger bearer pattern safely and rotate the credential if not already done.

### Phase 2

Completed:

- Shared tacho rules layer created.
- Shared normalization extracted.
- Shared evaluator extracted.
- Frontend and backend aligned to common rule model.
- Covered:
  - 4h30 continuous driving
  - split break `15 + 30`
  - daily 9h / 10h
  - rolling weekly 56h
  - rolling fortnight 90h
  - daily rest
  - reduced daily rest
  - weekly rest under 24h
  - reduced weekly rest
  - sequential WTD break checks
  - base data-quality findings
  - base app-vs-tacho reconciliation
- Focused rules suite is passing.

Still to cover:

- weekly rest compensation
- multi-manning
- ferry/train interruption logic
- richer legal explanation templates if needed
- more regression fixtures once real files exist

### Phase 3

Completed:

- VU event classification expanded.
- Severity-aware VU review UX built.
- Vehicle-side discrepancy model introduced.
- Import centre now surfaces VU discrepancy rows.
- Vehicle analysis now highlights:
  - overspeed
  - card/driver events
  - technical faults
  - unassigned motion
  - mismatch/review issues
- Driver analysis now surfaces linked VU context.
- Backend now stores `tachograph_vehicle_motion_discrepancies`.

Still to cover:

- validate real parser event text mapping with real VU files
- confirm event/fault category breadth with actual ReadESM payloads
- expand calibration/workshop/security nuance if real files require it

### Phase 4

Completed:

- Reconciliation rows are stored and surfaced.
- Driver-card timeline shows cross-check markers.
- Import centre shows driver-card cross-check previews.
- Vehicle and driver dashboard review queues deep-link into focused tacho screens.
- Focused driver/vehicle/day navigation is now implemented.
- `reviewFocus` is now part of normalized signal planning and local code path.

Still to cover:

- deploy the final `review_focus` migration and updated `process-tacho`
- verify live company-level signals return `reviewFocus`
- confirm real-world deep links behave correctly with real imported data

---

## Required Deployment Before Phase 5 Testing

Before Phase 5 work is considered live-ready, deploy the latest backend changes:

1. `supabase db push`
2. `supabase functions deploy process-tacho`

Specifically ensure the following migrations are live:

- `20260511093000_add_tacho_reconciliation_contract.sql`
- `20260512100000_add_tacho_signal_review_focus.sql`
- `20260606120000_add_tacho_trigger_dispatch.sql`
- `20260607113000_add_tacho_runtime_config_rpc.sql`
- `20260607124500_add_tacho_12m_range.sql`

---

## Phase 5: Finish Analysis Workspaces

### Goal

Turn the current review-capable driver/VU screens into full supervisor workspaces that can be used daily without relying on surrounding context.

### Outcomes

1. Driver card analysis becomes a full operational workspace.
2. Vehicle unit analysis becomes a full operational workspace.
3. Supervisors can intentionally choose a driver or vehicle rather than always falling back to latest import.
4. Screens clearly separate:
   - legal findings
   - technical events
   - cross-check items
   - training/action follow-up

### Main tasks

#### 5.1 Driver selection and navigation

- Add explicit driver picker / search into `DriverCardAnalysis`.
- Support opening by:
  - focused driver only
  - focused driver + focused date
  - latest driver fallback
- Preserve selection when changing date range.

#### 5.2 Vehicle selection and navigation

- Add explicit vehicle picker / search into `VehicleUnitAnalysis`.
- Support opening by:
  - focused vehicle only
  - focused vehicle + focused date
  - latest VU fallback
- Preserve selection when changing date range.

#### 5.3 Driver workspace improvements

- Add header actions for:
  - open linked personnel file
  - open related compliance actions
  - open training recommendations
- Add stronger grouping for:
  - card identity
  - download compliance
  - findings
  - linked VU context
  - reconciliation
  - evidence
- Add explicit “why this day was selected” messaging when opened from a queue or alert.

#### 5.4 Vehicle workspace improvements

- Add header actions for:
  - open fleet record
  - open maintenance/compliance context
  - open related incidents if present
- Add stronger grouping for:
  - VU identity
  - calibration/download state
  - technical events
  - unassigned motion
  - driver-link discrepancies
  - evidence

#### 5.5 Day detail and evidence improvements

- Add clearer evidence grouping:
  - findings
  - technical events
  - reconciliation
  - discrepancy rows
- Add source labels consistently:
  - app
  - driver card
  - vehicle unit
  - derived finding

#### 5.6 Empty / partial / failed states

- Make parser partial/failure states first-class in:
  - import centre
  - driver analysis
  - vehicle analysis
- Add clear supervisor guidance for:
  - no matching driver
  - no matching vehicle
  - parsed but incomplete data

### Dependencies

- Real file testing strongly recommended but not strictly required to continue UI refinement.
- Latest reconciliation and `reviewFocus` backend deploy should be live.

### Acceptance criteria

- A manager can intentionally open any driver card analysis, not only the latest one.
- A manager can intentionally open any VU analysis, not only the latest one.
- Driver and vehicle screens remain usable even when launched from a dashboard deep link.
- Each selected day clearly explains why it needs review.

---

## Phase 6: Embed Tacho Across The Portal

### Goal

Stop the tachograph system from feeling separate from the rest of the portal.

### Outcomes

1. Tacho status appears inside driver files.
2. VU status appears inside vehicle files.
3. Findings can create or support training and infringement workflows.
4. Reports can include tacho evidence without the manager manually cross-referencing multiple screens.

### Main tasks

#### 6.1 Driver file integration

- Add tacho summary panel into driver record.
- Show:
  - card status
  - last download
  - current truth score
  - cross-check issues
  - latest review focus
- Add “open driver card analysis” action.

#### 6.2 Vehicle file integration

- Add VU summary panel into vehicle record.
- Show:
  - last VU download
  - calibration due
  - high-severity VU issues
  - unassigned motion count
  - latest review focus
- Add “open VU analysis” action.

#### 6.3 Training integration

- Map certain findings into training recommendations.
- Initial likely mapping:
  - repeated mode / break failures
  - repeated cross-check mismatches
  - repeated missing mileage patterns
- Add “assign refresher” actions from tacho findings.

#### 6.4 Infringement workflow integration

- Use verified tacho findings to prefill infringement raising where appropriate.
- Preserve manual manager review before final infringement creation.

#### 6.5 Reports and exports

- Add tacho sections to compliance exports.
- Add driver and vehicle evidence summaries to report packs.
- Support:
  - recent driver review pack
  - VU discrepancy pack
  - compliance evidence pack

### Dependencies

- Phase 5 should be stable enough that deep-linking into analysis screens is reliable.

### Acceptance criteria

- Driver and vehicle records show live tacho status.
- Training and infringement flows can be triggered from verified tacho context.
- Reports can reference normalized findings and evidence rows directly.

---

## Phase 7: Navigation Cleanup

### Goal

Reduce the number of top-level tabs and make the portal easier to understand at first glance.

### Target information architecture

Top level:

1. Dashboard
2. People
3. Fleet
4. Compliance
5. Reports
6. Settings

Grouped subareas:

#### People

- Drivers
- Driver Compliance
- Training
- Tacho Cards

#### Fleet

- Vehicles
- VU Downloads
- Vehicle Compliance
- Checks
- Fuel
- O-Licence

#### Compliance

- Overview
- Import Centre
- Infringements
- Review Queues

### Main tasks

#### 7.1 Manager dashboard refactor

- Replace the current flat tab model in `ManagerDashboard`.
- Introduce grouped workspaces with subnavigation.

#### 7.2 Preserve legacy reachability during migration

- Keep old modules accessible until all routes are switched cleanly.

#### 7.3 Remove duplicate tacho entry points

- Consolidate old upload and analysis entry points into:
  - Import Centre
  - Driver Cards
  - Vehicle Units
  - Compliance Overview

#### 7.4 Cross-link consistency

- Ensure dashboard cards, alerts, and queue items route into grouped workspaces, not deprecated flat tabs.

### Dependencies

- Phase 5 and Phase 6 should define the stable destinations first.

### Acceptance criteria

- Top-level tabs are reduced.
- Tacho workflows are easier to find.
- People/fleet/compliance journeys feel intentional rather than scattered.

---

## Phase 8: Reader Helper / Tachomaster-Style Flow

### Goal

Deliver the live card-reader workflow:

- supervisor opens reader page
- inserts card
- progress bar shows read/upload progress
- analysis page opens automatically

### Strategy

Browser-only direct DigiVu access remains a future enhancement, not the baseline.

Primary design:

1. Windows helper detects reader and card insertion.
2. Helper reads/export card data locally.
3. Helper uploads to portal backend.
4. Browser reflects:
   - ready
   - card inserted
   - reading
   - uploading
   - processing
   - complete
5. Browser opens focused `Driver Card Analysis`.

### Main tasks

#### 8.1 Desktop helper specification

- Define process model for Windows helper.
- Define localhost/API handshake with the portal.
- Define failure handling and fallback.
- Initial contract doc now exists at `docs/tacho-reader-helper-contract.md`.
- Supabase-facing handoff doc now exists at `docs/tacho-reader-helper-backend-handoff.md`.
- Local mock helper now exists at `tools/tacho-reader-helper/mock-helper.mjs` for frontend testing.
- First-pass Windows install/startup scaffolding now exists at `tools/tacho-reader-helper/windows-helper/install.ps1` and `tools/tacho-reader-helper/windows-helper/uninstall.ps1`.
- First PC/SC APDU probing now exists at `GET /diagnostics/card-probe`; full exporter implementation remains next.

#### 8.2 Reader page in portal

- Build card-reader page state machine.
- Keep file-upload fallback on same page.
- Frontend scaffold is now in place with helper polling plus start/cancel command hooks.

#### 8.3 Progress reporting

- Show meaningful local + backend progress states.
- Preserve import-centre consistency.
- Browser-assisted registration is now wired so helper exports can enter the real import queue without manual file picking.
- Browser-originated uploads now also request backend processing directly after registration.

#### 8.4 Auto-open analysis

- On success, open driver card analysis with focused driver/date if available.

### Dependencies

- Phase 5 driver-card workspace should already be operational.

### Acceptance criteria

- Supervisor can read a card with minimal manual steps.
- Fallback upload still works if helper is missing.

---

## Phase 9: Hardening And Release

### Goal

Make the full tacho system safe for operational rollout.

### Main tasks

#### 9.1 Real file regression set

- Create internal anonymized regression library:
  - card file examples
  - VU file examples
  - edge-case files
- Track expected outputs for parser and findings.

#### 9.2 Rules-engine regression coverage

- Add more targeted fixtures for:
  - VU event categories from real files
  - reconciliation edge cases
- Synthetic simulator coverage now also exercises:
  - reduced weekly rest followed by a later compensation window
  - multi-manning shared-duty timelines on one vehicle
- Weekly-rest hardening now covers:
  - reduced weekly rest compensation still pending
  - reduced weekly rest compensation completed by a later qualifying rest
  - reduced weekly rest compensation missing after the tracking window
- Multi-manning hardening now covers:
  - same-vehicle overlapping different-driver activity as explicit review context
  - impossible concurrent same-vehicle driving still treated as invalid overlap
- Synthetic simulator coverage now also exercises parser-like bad-data conditions:
  - overlapping activity records
  - missing timestamps
  - malformed discrepancy timing

#### 9.3 Import observability

- Add error monitoring for:
  - parser failures
  - partial imports
  - mapping failures
  - unexpected payload shapes
- Import queue now surfaces:
  - `processing_error`
  - `processing_kickoff_error`
  - `trigger_dispatch_error`
  from `tachograph_files.metadata`
- Import review now exposes a retry action for imports that can safely request processing again.
- Repo-backed synthetic regression fixtures now cover import monitoring and retry-state handling while real binary files are still pending.

#### 9.4 Security and RLS review

- Review all new normalized tables and RPCs.
- Confirm least-privilege access patterns.
- Confirm trigger/function auth patterns are safe.
- `process-tacho` now requires either an authenticated manager session for the import company or a dedicated trigger token header.
- Optional non-browser DB dispatch now uses `private.tacho_processing_runtime` plus `x-tacho-trigger-token`, not a service-role bearer in SQL.
- Runtime inspection and configuration can now also be performed through a dedicated admin edge function instead of requiring direct SQL access.

#### 9.5 Data migration / backfill

- Decide whether legacy raw tacho data should be backfilled into normalized tables.
- If yes, add controlled backfill scripts.

#### 9.6 UAT and operational validation

- Test with real driver and VU files from actual workflow.
- Validate:
  - parser outputs
  - rules
  - deep links
  - dashboard review queues
  - export/report usefulness

### Acceptance criteria

- Real-world imports are stable.
- Managers can trust review queues and findings.
- Support/debug path is clear when imports fail.

---

## Recommended Next Order

1. After restart, deploy the pending tachograph DB/function/frontend changes listed in the 2026-06-19 snapshot.
2. Retest the real-card reader flow with helper `dotnet-shell-0.5.9`.
3. Test both decoded-card identity workflows:
   - pair to existing driver profile
   - invite driver from card, then accept invite and verify automatic card pairing
4. Start the next parser milestone:
   - decode EF `0504` driver activities from the read-only capture
   - normalize to `tachograph_activity_segments`
   - run existing rules engine against those segments
   - replace placeholder reader-console totals
5. Start the full-page analysis UI milestone from `docs/tacho-driver-card-view-build-plan.md`.
6. Continue VU workflow once driver-card activity decode is stable.
7. Then Phase 9 hardening, real binary regression files, monitoring, RLS review, and release prep.

---

## Immediate Resume Checklist

If work resumes after interruption, start with:

1. Check whether these latest reader/card migrations are deployed:
   - `20260618210500_add_tachograph_storage_bucket.sql`
   - `20260619113000_add_tacho_card_pairing.sql`
   - `20260619131500_add_tacho_card_invite_prefill.sql`
2. Check whether these functions are deployed:
   - latest `process-tacho`
   - latest `create-driver-invite`
   - latest `lookup-driver-invite`
   - latest `accept-driver-invite`
3. Confirm helper version:
   - expected `dotnet-shell-0.5.9`
4. Run a real card read and confirm:
   - import reaches `partial`
   - decoded identity appears in Import Review
   - unmatched card panel appears if no profile card match exists
5. Test one of:
   - pair card to existing profile
   - invite driver from card
6. Continue with EF `0504` activity decode and the full-page analysis UI plan.

---

## Key Files

Current main implementation areas:

- frontend tacho workspace:
  - `src/components/manager/tachograph/`
- compliance/risk integration:
  - `src/components/manager/ComplianceScoreboard.tsx`
  - `src/components/manager/DriverComplianceSnapshot.tsx`
  - `src/components/manager/DriverRiskSnapshot.tsx`
  - `src/components/manager/VehicleComplianceSnapshot.tsx`
- hooks:
  - `src/hooks/useCompanyCompliance.ts`
  - `src/hooks/useDriverRiskScores.ts`
  - `src/hooks/useDriverCardAnalysis.ts`
  - `src/hooks/useVehicleUnitAnalysis.ts`
  - `src/hooks/useTachoImports.ts`
- tacho contracts and adapters:
  - `src/lib/tacho/`
- shared rule logic:
  - `shared/tachoNormalization.ts`
  - `shared/tachoRuleCore.ts`
  - `shared/tachoRuleEvaluation.ts`
  - `shared/tachoReconciliation.ts`
- backend parser/processor:
  - `supabase/functions/process-tacho/index.ts`
- backend contract docs:
  - `docs/tacho-parser-contract.md`
  - `docs/tacho-backend-api.md`
- Windows helper scaffold:
  - `tools/tacho-reader-helper/windows-helper/Program.cs`
  - `tools/tacho-reader-helper/windows-helper/install.ps1`
  - `tools/tacho-reader-helper/windows-helper/uninstall.ps1`
  - `tools/tacho-reader-helper/windows-helper/README.md`
- current reader/UI planning:
  - `docs/tacho-driver-card-view-build-plan.md`
- card identity pairing/invite flow:
  - `src/lib/tacho/driverPairing.ts`
  - `src/components/manager/InviteDriverModal.tsx`
  - `src/components/manager/DriverManagement.tsx`
  - `supabase/functions/create-driver-invite/index.ts`
  - `supabase/functions/lookup-driver-invite/index.ts`
  - `supabase/functions/accept-driver-invite/index.ts`
  - `supabase/migrations/20260619113000_add_tacho_card_pairing.sql`
  - `supabase/migrations/20260619131500_add_tacho_card_invite_prefill.sql`
