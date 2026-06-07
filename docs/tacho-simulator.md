# Tacho Simulator

## Purpose

This simulator is the interim test infrastructure for tachograph business logic while real `.ddd`, `.c1b`, and `.v1b` files are still unavailable.

It does not try to generate binary tachograph files.

Instead, it defines a small scenario DSL that compiles into:

- tachograph activity blocks
- optional app work-session rows
- rule-engine and reconciliation inputs

## Code locations

- compiler: `src/lib/tacho/simulator/scenarioCompiler.ts`
- scenario types: `src/lib/tacho/simulator/types.ts`
- in-repo scenarios: `src/lib/tacho/simulator/scenarioLibrary.ts`
- tests: `src/lib/tacho/simulator/scenarioCompiler.test.ts`

## What it covers

The first in-repo scenarios currently cover:

1. compliant split break
2. continuous driving breach
3. app-vs-tacho mismatch
4. rolling weekly 56-hour breach
5. rolling fortnight 90-hour breach
6. reduced daily rest
7. weekly rest under 24 hours
8. WTD 6-hour break breach
9. VU cardless driving
10. VU driver mismatch
11. VU overspeed and technical-event presentation
12. multi-driver vehicle history across consecutive days
13. same-day driver handover on one vehicle
14. partial assigned driving with unassigned motion
15. driver-attribution conflict against review context
16. overlapping activity data-quality warning
17. missing activity timestamp compile failure
18. malformed discrepancy timing compile failure

These are intended to validate:

- rolling driving/break logic
- rule findings
- reconciliation outputs
- parser-like bad-data handling in the simulator compiler and preview

## What it does not cover

This simulator does not validate:

- binary parser behavior
- `readesm` field shapes
- real card/VU metadata extraction
- real corruption patterns
- actual edge-function file processing

Those still require real-world tachograph files later.

## Usage

The simulator is currently wired into:

```bash
npm run test:rules
```

In development builds, it is also exposed through the tachograph workspace as a dev-only `Simulator` tab so the scenarios can be inspected in the real timeline and day-detail UI.

Intentionally malformed scenarios now render as a controlled error panel in that preview instead of crashing the workspace, which makes parser-like timestamp and timing failures easier to inspect during development.

Additional scenarios can now be added without touching parser code or mock UI data.
