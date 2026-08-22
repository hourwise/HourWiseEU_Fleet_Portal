# Batch 21 dashboard and Atlas UX remediation — 2026-08-22

## Delivered experience

- Added Atlas as a first-class primary navigation workspace using the existing `/dashboard?workspace=atlas` route convention.
- Added full-width Atlas tabs: Overview, Tasks, Compliance, Operations, Proposals, History, and Administration.
- Kept Ask Atlas in the Atlas Overview, with deterministic Portal-state wording and source-linked answer facts.
- Reduced the dashboard operational rail to one compact Atlas attention summary with loading, error, empty, count, and source-link states.
- Removed the unsupported AI/Beta marketing card and the hard-coded training alert card from the ordinary production dashboard.
- Added strict response normalization for Atlas proposal rows and POD review rows; empty POD/timeline responses are valid empty states, while incomplete rows become bounded errors.
- Added bounded product error copy for the reviewed Atlas/POD/timeline surfaces. Technical database details remain diagnostic-only.

## Deterministic and governed boundaries

Atlas remains zero-inference. The workspace reads authoritative Portal state/events and performs no LLM or provider call. Existing governed proposal review/apply RPCs remain the only supported write path; no generic write authority was added. No live telemetry, routing provider, paid inference, or conversational mode was enabled.

## Acceptance notes

The layout uses responsive overflow for the tab strip, full-width workspace content, keyboard-focusable native buttons, explicit tab roles, and source links. Empty, loading, success, and error states are represented for the compact summary and repaired runtime surfaces. Final browser acceptance remains dependent on an authenticated manager session and reachable production environment.
