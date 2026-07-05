# ADR-0019 - Windows Helper Local Outbox And Sync Semantics

**Status:** Accepted  
**Date:** 2026-07-04  
**Related documents:**  
- `docs/tacho-reader-helper-production-checklist.md`
- `docs/tacho-reader-helper-contract.md`
- `docs/tacho-reader-helper-backend-handoff.md`
- `docs/hourwise-portal-master-build-plan.md`
- `docs/source-of-truth-completion-plan-2026-07-02.md`
- `SOT-18-03` - Evidence Import Pipeline
- `SOT-22` - Security Model Specification
- `SOT-23` - Integration Architecture

---

## Context

The Windows tachograph helper reads/export tachograph data from local hardware and exposes the export to the authenticated Fleet Portal browser session. The current safe flow is:

```text
helper reads/export bytes -> browser uploads using authenticated session -> process-tacho runs -> analysis opens
```

Driver Card Analysis owns the live reader workflow through `useTachoReaderWorkflow`, including helper polling, start/cancel, helper export download, browser upload, import registration, processing kickoff, tracking, and analysis routing.

This browser-assisted flow keeps the helper small and avoids putting Supabase credentials into a desktop process. It also means failed or interrupted uploads can lose the delivery opportunity unless the user retries while the export is still retained locally.

The product needs better reliability, but not a full Tachomaster-style offline database at this stage.

---

## Decision

HourWise will support a constrained encrypted local outbox in the Windows helper, but only as a short-lived delivery/retry queue for tachograph exports.

Supabase and the backend import system remain the source of truth.

The helper must not:

- contain Supabase service-role keys
- store browser session tokens long term
- become a local compliance database
- retain raw card or vehicle-unit data indefinitely
- calculate authoritative compliance outcomes
- expose queued files to anything other than the authenticated local portal handoff

The first production phase remains the current browser-assisted upload flow. The outbox is a Phase 2 reliability feature for failed or interrupted delivery, not the default source of truth.

---

## Phased Build Model

### Phase 1 - Current Simple Helper Flow

Keep the current design:

```text
helper reads/export bytes -> browser uploads using authenticated session -> process-tacho runs -> analysis opens
```

Characteristics:

- helper binds only to localhost
- helper exports bytes and exposes them to the browser
- browser performs Supabase Storage upload with the authenticated user session
- browser inserts/import-registers backend records
- `process-tacho` performs server-side parsing
- portal tracks backend state and opens analysis
- helper stores no service-role key
- helper does not run a background sync engine

This remains the safest route for finishing the helper and validating real card reads.

### Phase 2 - Encrypted Retry Cache

Add a small local cache only for failed or interrupted uploads.

Example:

```text
export succeeds
browser upload fails because the connection drops
helper stores encrypted file in local outbox
portal shows "1 read waiting to sync"
user retries when online
browser uploads queued file using authenticated session
helper deletes queued raw bytes after successful backend registration
```

This phase provides reliability without becoming a full local tachograph database.

### Phase 3 - Tachomaster-Style Bulk Sync

Only after the reader/export path and Phase 2 retry cache are proven, consider:

- offline reads
- multiple queued card or vehicle-unit files
- "Sync all"
- background retry
- sync history
- admin retention settings
- support diagnostics
- duplicate-safe backend imports

Phase 3 requires additional acceptance criteria and should not be implemented as part of the initial helper completion.

---

## Why This Is Not A Local Database

The helper outbox is a delivery mechanism, not an operational record store.

The outbox may store:

- encrypted exported tachograph file bytes
- export filename
- file size
- SHA-256 hash
- source type
- read session id
- created timestamp
- last retry timestamp
- retry count
- upload/import correlation after browser registration
- minimal safe driver/card hint if already exposed by the read flow

The outbox must not store:

- service-role credentials
- long-lived user auth tokens
- compliance outcomes
- timeline events
- driver compliance history
- rule results
- editable driver records
- fleet-wide reporting cache

Backend records in Supabase remain authoritative after upload/import registration.

---

## Security Requirements

The helper must:

- bind only to `127.0.0.1`
- keep all Supabase service-role access on the backend
- use browser-authenticated upload for queued retry delivery
- encrypt queued raw tachograph bytes at rest
- prefer Windows DPAPI or an equivalent per-user/per-machine OS-protected key
- protect queue metadata against accidental disclosure where practical
- use unpredictable read/session identifiers
- validate all local HTTP request bodies
- restrict CORS to approved portal origins and local development origins where practical
- avoid logging raw tachograph bytes, browser tokens, or excessive personal data
- expose diagnostics without dumping raw queued file contents
- allow the user/support flow to clear the local outbox

The helper must not treat `companyId`, `driverId`, or browser-supplied metadata as locally trusted authority. These values only help correlate the browser-assisted upload and backend import.

---

## Retention Policy

The outbox is short-lived.

Default retention should be conservative:

- delete queued raw bytes immediately after successful browser upload and backend import registration
- delete cancelled or superseded queued entries as soon as the workflow is cancelled
- automatically purge failed queued entries after a short fixed window, initially no longer than 24 hours unless a product/legal decision extends it
- expose a manual "clear local queued reads" control before production rollout
- keep only non-sensitive diagnostic summaries after raw bytes are purged

Any retention longer than the short retry window requires a separate product/security review.

The helper must not retain raw card data indefinitely.

---

## Duplicate Detection And Idempotency

Every queued export must calculate a SHA-256 hash of the exported bytes.

The browser/backend upload path should use the hash as part of duplicate detection and idempotency, combined with available import metadata such as:

- company id
- source type
- original filename
- export timestamp
- card number hint where safely available
- vehicle unit identity where safely available

Backend imports must be duplicate-safe. Retrying a queued upload must not create multiple active authoritative imports for the same file unless explicitly allowed by a reprocessing workflow.

The backend remains responsible for final duplicate decisions.

---

## Sync States And UI Labels

Recommended local outbox states:

```text
not_queued
queued_waiting_for_upload
uploading
registered_with_backend
processing
complete
retry_available
failed_retryable
failed_expired
cancelled
purged
```

Recommended portal labels:

- `Read ready to upload`
- `Uploading read`
- `1 read waiting to sync`
- `Retry upload`
- `Upload registered`
- `Processing in HourWise`
- `Synced`
- `Sync failed - retry available`
- `Local queued read expired`
- `Local queue cleared`

The UI must make clear when data is only local and not yet imported into HourWise.

---

## Failure And Retry Behaviour

If export fails, no queue entry should be created unless there are complete exported bytes.

If export succeeds but browser upload fails:

- encrypt and queue the export
- show retry state in the portal
- keep the original SHA-256 hash
- allow retry through the browser-authenticated session
- avoid direct helper-to-Supabase upload in Phase 2

If upload succeeds but backend registration fails:

- keep the queued entry until registration succeeds, expires, or is manually cleared
- avoid deleting the local raw bytes prematurely
- show a retryable state with clear operator wording

If backend registration succeeds:

- store backend correlation metadata briefly
- delete local raw bytes as soon as safe
- keep only diagnostic metadata needed to show that local delivery completed

If the user clears the queue:

- delete queued raw bytes
- retain only minimal audit/support metadata where appropriate
- do not delete backend imports that were already registered

---

## GDPR And Privacy Implications

Tachograph exports include personal data and work/activity history.

The outbox design supports data minimisation by:

- storing raw bytes only when delivery fails or is interrupted
- encrypting queued raw bytes at rest
- deleting raw bytes after successful backend registration
- applying a short automatic expiry window
- avoiding a local searchable compliance database
- keeping authoritative records in the backend where retention, audit, and access controls can be enforced centrally

Production rollout should confirm:

- local storage path disclosure in privacy/support documentation
- user/support ability to clear local queued reads
- retention window and expiry behaviour
- support diagnostic redaction
- whether machine-wide installs require different retention or access controls from per-user installs

---

## Migration Path From Current Helper

1. Keep Phase 1 browser-assisted upload as the default path.
2. Add status fields that report outbox availability without enabling queue writes.
3. Add encrypted write/read/delete primitives behind a feature flag.
4. Queue only complete exports when browser upload or registration fails.
5. Add portal UI for "read waiting to sync" and "retry upload".
6. Delete queued raw bytes after successful backend registration.
7. Add expiry cleanup and manual clear controls.
8. Add duplicate/idempotency checks in the backend path before supporting multiple queued items.
9. Only then consider Phase 3 bulk sync.

---

## Acceptance Criteria Before Enabling Phase 2

Phase 2 encrypted retry cache may be enabled only when:

- helper still works with the no-cache browser-assisted flow
- queued raw bytes are encrypted at rest
- queued raw bytes are deleted after successful registration
- queue expiry cleanup is implemented and tested
- manual queue clearing is implemented
- helper contains no service-role key
- helper does not persist browser auth tokens long term
- portal clearly labels local-only queued reads
- retry upload uses the authenticated browser session
- SHA-256 hash is calculated and sent through the retry path
- duplicate-safe backend import behaviour is verified
- diagnostics redact raw data and auth material
- uninstall/reinstall behaviour is defined for queued files

---

## Acceptance Criteria Before Phase 3 Bulk Sync

Tachomaster-style bulk sync may be considered only after:

- Phase 1 real reader/export path is stable
- Phase 2 encrypted retry cache has passed UAT
- duplicate-safe imports are proven with repeated retries
- support can diagnose queue failures without raw data exposure
- admin retention settings are specified
- sync history is specified
- offline read limits are specified
- background retry behaviour is specified
- legal/privacy review accepts local raw-data retention boundaries

---

## Consequences

Positive consequences:

- improves reliability for interrupted uploads
- preserves the current backend source-of-truth boundary
- avoids putting privileged credentials in the helper
- keeps the helper small enough to finish safely
- creates a controlled path toward richer sync later

Negative consequences:

- adds local encryption, expiry, and cleanup complexity
- requires careful UI wording so users know what is local versus imported
- does not make physical smart-card reads faster
- still requires duplicate-safe backend import behaviour
- introduces a local personal-data surface that must be tested and documented

---

## Review Triggers

Review this ADR if:

- HourWise starts supporting full offline card reads
- helper uploads directly to backend endpoints
- helper needs long-lived queue retention
- vehicle-unit downloads are added to the same outbox
- support needs remote diagnostics over queued files
- customers request Tachomaster-style bulk sync
- legal/privacy requirements change
- duplicate import handling changes materially
