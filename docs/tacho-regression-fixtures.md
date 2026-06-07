# Tacho Regression Fixtures

## Purpose

This document defines the current Phase 9 regression-fixture approach for the tachograph pipeline.

It now has two layers:

1. Synthetic repo-backed fixtures for import-state and monitoring regressions.
2. A reserved process for adding anonymized real card and VU files when they become available.

## Synthetic fixtures now in repo

The current fixture set lives in:

- `src/lib/tacho/regressionFixtures.ts`
- `src/lib/tacho/importObservability.test.ts`

These fixtures deliberately cover:

- healthy import completion
- browser kickoff warning
- DB-trigger dispatch warning
- partial parse outcome
- failed parse outcome

They are not a replacement for real binary parser fixtures. They are meant to keep the import-centre monitoring and retry logic stable while real files are still unavailable for source control.

## What this protects today

The synthetic fixture set now asserts:

- observability issue prioritization
- retry eligibility rules
- import-monitoring summary counts
- stable attention-backlog behavior for the import centre

## Real fixture library plan

When anonymized production-like files are available, add a separate private fixture library with:

1. driver-card examples
2. VU examples
3. corrupted-file examples
4. edge cases for weekly rest, multi-manning, and VU event text variation

For each real fixture, capture:

- source type
- expected parser acceptance or rejection
- expected normalized segment count
- expected key findings
- expected discrepancy or reconciliation signals

## Suggested storage pattern

Keep binary files out of the main public repo unless policy allows it.

Recommended structure for a private fixture pack:

```text
tools/tacho-regression/
  manifest.json
  driver-cards/
  vehicle-units/
  corrupted/
```

The manifest should map each file to expected outcomes so automated regression runs can remain deterministic.

## Current gap

This repo now has the fixture contract and synthetic coverage, but it still does not contain anonymized real tachograph binaries.
