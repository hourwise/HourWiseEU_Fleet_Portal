# Parser Fixture Regression Tests

Date: 2026-07-02
Task: `TEST-002`
Status: Complete

## Purpose

Document the parser fixture regression coverage added for the tachograph parser pipeline.

## Test Coverage Added

Added:

- `src/lib/tacho/parserRegressionFixtures.ts`
- `src/lib/tacho/parserRegressionFixtures.test.ts`

The fixture suite locks:

- parser identity for `readesm@1.0.17`
- parser identity for `hourwise-read-only-capture@1`
- processed driver-card activity output
- continuous-driving breach output
- vehicle-unit cardless-driving event and discrepancy output
- vehicle-unit overspeed and power-interruption event output
- partial read-only helper capture warning behaviour
- malformed parser-like discrepancy timing failure behaviour
- aggregate parser fixture summary counts

## Test Command

```powershell
npm run test:rules
```

`package.json` now includes the parser fixture regression test in `test:rules`.

## Limitation

These tests use deterministic in-repo simulation fixtures. They do not parse real `.DDD`, `.C1B`, or `.V1B` binary files.

Real binary parser fixtures should be added after fixture storage, licensing, anonymisation, and retention rules are agreed.

## Acceptance Criteria

- Parser fixture inventory is stable.
- Parser source/version identity is tested.
- Successful, partial, and error parser outcomes are tested.
- Derived activity, finding, technical event, and discrepancy counts are tested.
- Existing test command includes the new parser fixture regression tests.
- Source-of-truth changelog and completion plan are updated.

