# HELPER-003 Phase 1 Helper Flow Validation

Date: 2026-07-04

## Scope

Validate the current Phase 1 Windows helper flow without introducing any local sync queue:

```text
helper read/export bytes -> browser/authenticated upload path -> import registration -> processing/analysis routing
```

This validation uses the real .NET helper shell with simulated card presence and the reviewed external-export command seam. It does not validate physical smart-card APDU read speed or certified `.C1B/.DDD` export correctness.

## Implementation Added

- Added `tools/tacho-reader-helper/write-test-export.mjs`.
- Added `tools/tacho-reader-helper/phase1-validation.mjs`.
- Added npm script `tacho:helper:phase1`.
- Updated the mock scenario runner to use isolated default port `47237`, avoiding collisions with an already-running local helper on `47231`.

## Validation Command

```bash
npm run tacho:helper:phase1
```

The command:

- builds the .NET helper into a temporary folder so an installed/running helper does not lock the repo build output
- starts the helper on `127.0.0.1:47236`
- enables simulated card presence
- enables the reviewed external-export command seam
- writes a synthetic test export
- runs the existing read-mode contract probe
- downloads the export bytes
- registers the import with the helper
- expects helper stage `complete`
- removes temporary artifacts unless `--keep-artifacts` is supplied

## Result

Latest local run:

```text
HELPER-003 Phase 1 validation passed.
Tacho helper contract probe passed.
baseUrl: http://127.0.0.1:47236
mode: read
finalStage: complete
exportBytes: 292
errorCode: null
```

The existing mock scenario regression also passed after isolating its port:

```bash
npm run tacho:helper:test
```

Validated scenarios:

- success
- slow upload
- backend failure
- missing driver correlation

Focused credential-boundary check:

- helper .NET, PowerShell, and Node helper files were searched for Supabase service-role, bearer token, API key, and auth-header dependencies
- no helper code path requires or embeds Supabase service-role credentials
- the browser/backend handoff remains the authenticated boundary for Supabase upload and processing

## Live Reader / Supabase Validation

Date: 2026-07-05

Live validation was completed with a physical Windows smart-card reader and driver card through the portal-managed Phase 1 flow:

```text
helper read/export bytes -> browser authenticated upload -> tachograph_files registration -> process-tacho -> Driver Card Analysis
```

Observed successful import:

- Import id: `b9c8c986-445b-4411-82fc-c96b8ecf6178`
- Driver: `PHILIP CHRISTOPHER GERAN`
- Card number: `DB18220162003911`
- Card expiry: `2028-08-08`
- Helper summary: `Read-only helper capture decoded 1839 provisional EF 0504 activity segments across 69 days (2026-04-22 to 2026-06-29).`
- UI status: `complete`, `Card analysis ready`
- Visible review day: `2026-06-29`, `58` blocks, `08:39 - Tue 01:00`
- Timeline comparison: aligned
- Timeline events: tachograph `58` / timeline `58`
- Timeline gaps: tachograph `0` / timeline `0`
- Day summaries: tachograph `1` / timeline `1`

The first live attempts exposed two issues that were fixed before the successful read:

- stale helper/backend import state could leave the helper at `processing` after a terminal backend failure, so the helper now supports a constrained `/imports/reset` endpoint and the portal clears terminal failed imports without restarting the helper
- `process-tacho` exceeded Supabase CPU time while scanning EF `0504`, so the read-only capture parser now uses a bounded best-run scan instead of probing every byte offset repeatedly

The portal also now keeps a short-lived browser session lock per helper `readSessionId`, preventing refresh/remount loops from re-uploading the same helper export.

## Remaining Live Checks

Completed:

- restart helper and verify `/status` on card insert/remove
- run a real built-in read-only card capture
- verify browser upload to Supabase Storage using the manager session
- verify `tachograph_files` row creation
- verify `process-tacho` kickoff and completion
- verify processed import tracking
- verify Driver Card Analysis opens linked-driver analysis
- verify timeline comparison is count-aligned for the visible review day

Still outside HELPER-003 scope:

- standards-certified `.C1B/.DDD` binary output
- encrypted local retry outbox from `ADR-0019` Phase 2
- Tachomaster-style bulk sync
- vehicle-unit live import validation

## Boundary

This completes Phase 1 helper validation for the current read-only driver-card path. It does not enable `ADR-0019` Phase 2 encrypted retry cache, offline reads, background retry, Tachomaster-style bulk sync, or certified legal `.C1B/.DDD` output.
