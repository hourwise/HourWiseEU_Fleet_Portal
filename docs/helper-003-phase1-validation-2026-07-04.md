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

## Remaining Live Checks

These still require a physical reader/card and deployed portal session:

- restart installed helper and verify `/status` on card insert/remove
- run a real built-in read-only card capture
- verify browser upload to Supabase Storage using the manager session
- verify `tachograph_files` row creation
- verify `process-tacho` kickoff
- verify partial/processed import tracking
- verify Driver Card Analysis opens linked-driver or candidate-card analysis
- verify completed read remains visible after card removal until another card read or manual Refresh

## Boundary

This completes automated Phase 1 contract validation only. It does not enable `ADR-0019` Phase 2 encrypted retry cache, offline reads, background retry, or Tachomaster-style bulk sync.
