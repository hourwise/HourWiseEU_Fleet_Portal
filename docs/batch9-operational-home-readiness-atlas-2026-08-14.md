# Batch 9 — Driver operational home, asset readiness, and deterministic Atlas

Date: 2026-08-14

## Status

Implemented locally on `main` after the Batch 8 operational hardening work.

## What now works

- The driver operational home loads the driver’s published/updated shifts, the linked job assignments for those shifts, and recent vehicle-check action rows.
- Driver job cards preserve assignment sequence and planned windows. They are deliberately labelled as planned work and do not claim live completion or ETA data.
- Missing rota, missing jobs, missing vehicle-check actions, loading failures, and successful reads have separate truthful UI states.
- `src/lib/assetCompliance.ts` evaluates vehicle/trailer readiness deterministically from current VOR state, safety defects, statutory/service dates, insurance, LOLER where present, and document evidence.
- Missing evidence is `unknown`; VOR and unresolved safety defects are `prohibited`; expired dates are `action_required`; near-term dates are `warning`.
- Manager dashboard includes an asset readiness summary and a deterministic Atlas attention queue. Each Atlas item carries a source label and dashboard route.

## Backend and security boundary

This pass uses existing RLS-backed reads and does not add a browser service-role path, privileged key, or direct cross-tenant read. Company scoping is derived from the authenticated profile and remains enforced by the existing Supabase policies. No new write path or migration was required.

The existing governed job assignment RPCs remain authoritative for create/update/cancel actions. This pass adds read-side integration only and does not introduce a parallel rota/job model.

## Tests

Added deterministic regression coverage for:

- asset readiness precedence and missing-evidence behaviour;
- Atlas item ordering, traceability, and empty-rota behaviour;
- driver job read-model filtering and absent relation handling.

The new tests are included in `npm run test:rules`.

## Remaining limitations

- Route distance and ETA remain unavailable because no routing provider is configured; the UI does not fabricate them.
- Job assignments still use the existing `draft/published/updated/cancelled` lifecycle. Live stop arrival/completion states remain a later schema/RPC slice.
- The current asset engine evaluates the authoritative fields already present in the schema; trailer-specific fields remain limited to the shared vehicle record.
- Supabase migrations and generated database types were not changed or deployed in this pass.
