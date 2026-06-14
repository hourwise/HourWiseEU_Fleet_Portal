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
8. reduced weekly rest with a later compensation window
9. WTD 6-hour break breach
10. VU cardless driving
11. VU multi-manning shared duty window
12. VU driver mismatch
13. VU overspeed and technical-event presentation
14. multi-driver vehicle history across consecutive days
15. same-day driver handover on one vehicle
16. partial assigned driving with unassigned motion
17. driver-attribution conflict against review context
18. overlapping activity data-quality warning
19. missing activity timestamp compile failure
20. malformed discrepancy timing compile failure

These are intended to validate:

- rolling driving/break logic
- rule findings
- reconciliation outputs
- parser-like bad-data handling in the simulator compiler and preview

Current limitation:

- the rules engine now tracks reduced weekly-rest compensation as `pending`, `completed`, or `missing`
- the rules engine now treats qualifying same-vehicle overlapping different-driver activity as `DRV_MULTI_MANNING_DETECTED` review context instead of generic overlap noise
- truly impossible overlap patterns, such as concurrent same-vehicle driving by two drivers, still remain data-quality issues
- the dev preview now surfaces multi-manning directly in the vehicle history ledger and day-detail drawer

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
