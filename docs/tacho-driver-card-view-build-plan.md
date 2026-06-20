# HourWise Tachograph Driver Card View - Build Plan

## Goal

Build a clear, visual driver-card analysis screen for HourWise, inspired by the simple layout of Tachomaster's driver card capture screen, but using HourWise branding and our own UI. The screen should help a transport manager or driver quickly understand:

- Driver card identity
- Last activity time
- Driving availability
- Rest status
- Daily activity timeline
- Infringements / compliance issues
- Missing data or warnings
- Export/import status

Do not copy Tachomaster branding, colours, or exact UI. Recreate the concept in a clean HourWise style.

---

## Main Screen Layout

### 1. Page Header

Title:

`Driver Card Analysis`

Subtitle/status line:

`Card Reader Status: Ready / Reading / No Card / Error`

Actions:

- `Read From Card`
- `Import File`
- `Export Report`
- `Refresh`
- `Close`

Show a progress bar when reading/importing.

Example statuses:

- Ready
- Card detected
- Reading card
- Processing activities
- Analysis complete
- Card removed
- Reader not found
- Export tool missing
- Invalid card file

---

## 2. Driver Details Panel

Left-side card showing driver/card information.

Fields:

- Driver name
- Card number
- Issuing country
- Card expiry date
- Employer/company
- Depot/site
- Employee type
- Last card download date
- Last activity time
- File/card source
- Import timestamp

Add warning badges if:

- Card expires within 30/60/90 days
- Card already expired
- Last download older than legal/internal policy
- Card number does not match assigned driver

---

## 3. Quick Analysis Panel

Small summary card beside driver details.

Fields:

- Last activity time
- Drive available today
- Drive available tomorrow
- Drive available this week
- Drive available fortnight
- Weekly drive used
- Fortnightly drive used
- Extended driving days used
- Reduced daily rests this week
- Short daily rests this week
- Weekly rest status
- Next required break/rest
- Current compliance status

Use simple badge colours:

- Green = OK
- Amber = approaching limit / needs attention
- Red = infringement / expired / exceeded
- Grey = unknown or insufficient data

---

## 4. Infringements Panel

Large left-side panel below driver details.

Show:

- "No Driver Hours Infringements found" when clean.
- Otherwise list infringements grouped by date.

Each infringement should include:

- Date
- Rule breached
- Actual value
- Legal limit
- Severity
- Suggested explanation field
- Manager note field
- Acknowledged checkbox
- Exportable flag

Possible infringements:

- Daily driving exceeded
- Weekly driving exceeded
- Fortnightly driving exceeded
- 4.5 hour break rule breached
- Insufficient daily rest
- Insufficient weekly rest
- Too many reduced daily rests
- Working time break breach
- Working time daily/night limit breach
- Missing manual entry
- Unknown activity period
- Card not downloaded within required period

---

## 5. Visual Timeline

Main central area: horizontal day-by-day activity chart.

Rows:

- One row per date
- X-axis from 00:00 to 24:00
- Activity blocks shown as coloured bars

Activity colour mapping:

- Driving = dark green
- Other work = orange/red
- Rest/break = light blue or pale grey
- POA/availability = yellow
- Unknown/missing = hatched grey
- Infringement period = red overlay/outline

Each day row should show:

- Date label
- 24-hour horizontal timeline
- Activity blocks
- Hover/click tooltip
- Daily totals summary

Tooltip on activity block:

- Activity type
- Start time
- End time
- Duration
- Source: driver card / manual / vehicle unit / edited
- Related vehicle registration if available
- Location/country if available

Below chart:

- Time axis ticks every hour
- Zoom controls
- Date range selector
- Toggle: 7 days / 14 days / 28 days / custom

---

## 6. Daily Detail Drawer / Modal

When a day row is clicked, open a detail view.

Show:

- Full activity list in chronological order
- Daily totals:
  - Driving
  - Other work
  - Rest/break
  - POA
  - Unknown
- Vehicles used
- Start/end countries if present
- Manual entries
- Card insertion/removal events
- Rule checks for that day
- Infringements
- Manager notes

Actions:

- Add note
- Mark reviewed
- Export day report
- Link to incident/absence/manual explanation

---

## 7. Tabs

Top or side tabs:

- Overview
- Activities
- Infringements
- Downloads
- Vehicles
- Reports
- Raw Data / Diagnostics

---

## 8. Backend Data Requirements

Create normalised tables or views for:

### driver_cards

- id
- driver_id
- card_number
- issuing_country
- holder_name
- valid_from
- valid_until
- last_download_at
- raw_file_id
- created_at

### tachograph_imports

- id
- driver_id
- file_name
- file_type
- source
- imported_at
- parsed_status
- parser_version
- checksum
- errors

### driver_activities

- id
- driver_id
- card_id
- import_id
- activity_type
- start_time
- end_time
- duration_seconds
- vehicle_registration
- country
- source
- confidence
- raw_payload

### tachograph_infringements

- id
- driver_id
- activity_date
- infringement_type
- severity
- rule_reference
- description
- actual_value
- limit_value
- reviewed
- manager_note
- created_at

---

## 9. Rule Engine Requirements

The screen should consume calculated compliance results from the backend.

Rules to calculate:

- 4.5 hour driving break rule
- 45 minute break reset
- Split break 15 + 30
- Daily driving limit
- Extended 10 hour driving days
- Weekly driving limit
- Fortnightly driving limit
- Daily rest
- Reduced daily rest
- Weekly rest
- Reduced weekly rest
- Working time break rules
- Night work rule
- Missing/manual entry warnings
- Card download interval warnings

Return results as structured JSON, not just text.

---

## 10. Report Features

Add export buttons for:

- Driver card summary PDF
- Infringement report
- Daily activity report
- Weekly compliance report
- Raw parsed JSON
- CSV activity export

Reports should include:

- Driver details
- Card details
- Date range
- Timeline summary
- Infringements
- Manager notes
- Generated timestamp
- Company name/logo

---

## 11. UI Behaviour

Responsive design:

- Desktop: left details panel + main timeline
- Tablet: stacked cards + timeline
- Mobile: cards first, timeline scrollable horizontally

Loading states:

- Reading card
- Parsing file
- Running compliance checks
- Building timeline

Empty states:

- No card data
- No infringements
- No activity for selected date
- Unknown/missing activity

Error states:

- Invalid file
- Parser failed
- Card reader unavailable
- Backend save failed
- Partial import completed

---

## 12. Useful Extras Beyond Screenshot

Add features not visible in the Tachomaster screen:

- Search by driver/card/date
- Compare card data with vehicle unit data
- Highlight missing vehicle unit matches
- Flag unexplained gaps
- Manual-entry reminder
- Driver licence/card expiry reminders
- PMI / FORS / DVSA audit links
- Attach explanation documents
- Mark infringement as reviewed
- Manager sign-off
- Driver acknowledgement
- Audit log of edits/reviews
- AI assistant summary:
  - "What needs attention?"
  - "Any infringements this week?"
  - "Is this driver legal to drive tomorrow?"
  - "What explanation is needed for audit?"

---

## Implementation Steps

1. Create backend models for imports, cards, activities and infringements.
2. Store parsed tachograph data in normalised tables.
3. Create compliance rule engine output as JSON.
4. Build API endpoint:
   - `GET /api/tacho/driver-card/:driverId?from=&to=`
5. Build React page:
   - Header/status bar
   - Driver details panel
   - Quick analysis panel
   - Infringement panel
   - Timeline chart
6. Build reusable `ActivityTimeline` component.
7. Add daily detail drawer.
8. Add export/report buttons.
9. Add loading/error/empty states.
10. Add review/sign-off workflow.
11. Add tests using synthetic tachograph fixtures.
12. Add responsive/mobile layout.

---

## HourWise Reader Workflow Addendum

This screen should be the primary full-page tachograph analysis workspace for both driver card and similar VU reader flows.

Required behaviour:

- The graph/analysis screen should fill the page and remain visible as the stable workspace.
- Card reading should appear as an overlay or floating status layer on top of the analysis screen, not as a separate page that hides the graph.
- When no card is inserted, the overlay should show `Waiting for card`.
- When a card is inserted, the helper should automatically start reading where safe and supported.
- During read, the overlay should show the staged workflow: card detected, reading card, uploading/importing, processing, analysis ready.
- When results are ready, the overlay should collapse or become a compact status chip so the analysis screen remains the focus.
- If the card is removed, the live reader workspace should return to the blank calendar state ready for the next card insert. Previously processed reads remain retrievable from stored analysis/history until superseded by a newer processed read.
- The same layout pattern should be reused for VU reads, replacing driver-card identity with vehicle/VU identity and showing VU-specific discrepancies.

### Current implementation checkpoint

- First-pass `DriverCardAnalysis` polish is implemented:
  - no automatic latest-day drawer selection
  - blank calendar empty state
  - prominent provisional HourWise read-only capture warning
  - parsed-period summary before detailed rows
  - day-level grouping with detail opened only by explicit day selection
  - CSV export and report/print actions
  - import-id based candidate card checks for unmatched/unlinked card reads
- Candidate/pre-employment card check behavior:
  - a decoded card can be reviewed before a driver invite or personnel file exists
  - the analysis loads from the tachograph import bundle by `import_id`
  - personnel, training, and compliance action buttons are disabled while the card is unlinked
  - managers can return to Import Review to pair the card or create an invite from the decoded identity
- Live reader workflow move is now implemented in first pass:
  - `useTachoReaderWorkflow` owns helper polling, start/cancel commands, helper-export upload, import registration, processing kickoff, import tracking, and analysis routing
  - Driver Card Analysis shows a compact live reader panel above the calendar instead of relying on Import Centre for normal driver-card reads
  - inserted cards can auto-start a read when the helper reports `card_inserted`
  - matched reads open linked-driver analysis; unmatched reads open candidate card mode by `import_id`
  - card removal clears the auto-opened live result back to the blank calendar when the helper returns to ready/unavailable
- Remaining workflow/UI cleanup:
  - retest the new Driver Card Analysis live flow after frontend deployment with the real helper/card
  - reduce Import Centre to VU import/download, manual driver-card file import, and collapsed technical diagnostics
  - reuse the same reader workflow pattern for Vehicle Unit Analysis after the VU helper/download path is ready
- Review/sign-off still needs persistence design before implementation because personnel files should store issues/actions/sign-offs, not full card reads.
