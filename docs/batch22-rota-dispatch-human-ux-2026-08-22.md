# Batch 22 — Rota planning, dispatch and human-language UX

Date: 2026-08-22  
Starting main: `47a1d8d068a6658bc7cfbcab0118bb9607fd93e6`

## Scope delivered

Batch 22 adds a planning layer above the existing assigned shift record. Rota patterns create dated empty places; a place can remain open without a driver, vehicle or trailer. Filling a place creates a linked draft shift. The existing `shifts.driver_id` contract remains required and unchanged.

Managers can record leave and availability, create jobs before shifts, keep jobs in an unassigned pool, and place a job on a draft duty. Job planning stores structure only: stop order, addresses and job details are available, but no routing provider, distance, ETA or driving duration is invented.

New shift creation uses `create_shift_draft`. Draft records may contain incomplete readiness information for planning. The existing readiness trigger remains authoritative when a shift is published; hard-prohibited vehicles or trailers cannot become publish-valid through the planning layer.

The planning workspace uses plain language such as “Open places”, “Needs attention”, “Vehicle later”, “Trailer later”, “Create cover”, and “Add driver to duty”. Technical implementation terms remain out of routine manager copy. Atlas question suggestions are buttons and populate the Ask Atlas field.

## Security and database changes

Migration: `20260822202340_batch22_rota_planning_job_pool.sql`

- fixed the deployed `signal_key` ambiguity in `sync_atlas_signal_observations(jsonb)` by qualifying the observation table alias;
- retained `auth.uid()` actor derivation, server-side company scope, manager checks, fixed `search_path`, RLS and deliberate authenticated-only function execution;
- added manager-only rota patterns, dated slots, slot assignments and staff availability;
- added bounded server-side functions for draft shifts, pattern application, filling a slot, planned jobs, draft job placement and publication assessment;
- no service-role or privileged browser key was introduced.

## Explicit product boundaries

PLANNING FORECASTS ARE NOT A SUBSTITUTE FOR THE DRIVER'S TACHOGRAPH OR AUTHORITATIVE LEGAL ASSESSMENT.

ATLAS REMAINS ZERO-INFERENCE.

NO ROUTING PROVIDER IS ENABLED.

NO FAKE ETA OR DRIVING DURATION IS GENERATED.

## Known follow-up

The planning view intentionally keeps assignment and publication separate. A future batch can add richer multi-slot patterns, a dedicated vacancy review screen, and a more detailed hours/rest forecast once the authoritative tachograph inputs and applicable operating regime are available.
