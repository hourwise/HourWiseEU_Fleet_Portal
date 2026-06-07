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
  - a local mock helper is now available for UI testing without the Windows executable
  - mock-only debug controls are now exposed in the reader panel when the mock helper is detected
  - the mock helper now simulates export file, upload receipt, backend job, and import correlation data
  - the mock helper now supports scenario switching for slow upload, backend failure, and missing-driver cases
  - a regression harness now validates all named mock-helper scenarios automatically
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

Still external or not fully executable from this repo alone:

- helper executable and localhost protocol implementation
- backend deployment confirmation
- real-file regression / parser validation
- release hardening, monitoring, RLS review, and UAT

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
| 8 | Reader helper | Frontend scaffold started | Import-centre helper polling, auto-open wiring, and upload fallback are now in place. The Windows helper itself still needs to be built and validated. |
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
  - weekly rest compensation
  - multi-manning
  - VU event categories from real files
  - reconciliation edge cases
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

1. Finish backend deploy for final Phase 4 changes.
2. Start Phase 5 with:
   - explicit driver picker
   - explicit vehicle picker
   - stronger selected-day context
3. Move into Phase 6 once analysis screens are stable enough to embed elsewhere.
4. Then Phase 7 navigation cleanup.
5. Then Phase 8 reader helper.
6. Then Phase 9 hardening and release.

---

## Immediate Resume Checklist

If work resumes after interruption, start with:

1. Check whether these are deployed:
   - `20260511093000_add_tacho_reconciliation_contract.sql`
   - `20260512100000_add_tacho_signal_review_focus.sql`
   - latest `process-tacho`
2. Confirm whether real test files are now available.
3. If no real files yet:
   - start Phase 5 driver/vehicle picker work
4. If real files are available:
   - test import pipeline first
   - validate findings/discrepancies/reconciliation
   - then continue Phase 5

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
