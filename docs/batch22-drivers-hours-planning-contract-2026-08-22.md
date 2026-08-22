# Batch 22 — Driver hours and planning contract

## Contract

The rota planning layer is a forward-looking planning aid. It can combine the dates and times of draft or published shifts with current Portal records, but it must not present a forecast as a tachograph result or legal determination.

The planner distinguishes:

- actual authoritative records already held in Portal;
- planned duties that are still drafts;
- missing inputs or an unknown operating regime;
- a future assignment that deserves review before publication.

An assignment conflict is phrased as “Review this future plan” or “Driver availability needs attention”. It is not phrased as “illegal”, “non-compliant”, or “driver exceeded the limit” unless an authoritative record supports that statement.

The existing `shifts` table remains the driver-facing operational record and keeps its required `driver_id`. Empty demand is represented only by `rota_slots` and its related planning tables. A driver added to an empty slot receives a linked draft shift, so the normal publication and acknowledgement lifecycle remains the boundary before driver visibility.

## Availability and readiness

`staff_availability` records manager-entered leave, sickness, training or unavailability ranges. It is a planning check, not a legal absence determination. The slot-fill function refuses a driver whose recorded availability covers the slot date.

Vehicle and trailer readiness remain server-side concerns. Draft planning may leave an asset unresolved or carry an evidence warning. Publication rechecks the current policy. A vehicle marked off road or carrying an unresolved safety defect remains prohibited.

## User-facing wording

Use “planned duty”, “open place”, “needs attention”, “recorded leave”, “vehicle evidence”, and “review before publishing”. Keep terms such as RLS, RPC, fingerprint, search path, and signal key in Help, Admin or Audit material only.

PLANNING FORECASTS ARE NOT A SUBSTITUTE FOR THE DRIVER'S TACHOGRAPH OR AUTHORITATIVE LEGAL ASSESSMENT.

ATLAS REMAINS ZERO-INFERENCE.

NO ROUTING PROVIDER IS ENABLED.

NO FAKE ETA OR DRIVING DURATION IS GENERATED.
