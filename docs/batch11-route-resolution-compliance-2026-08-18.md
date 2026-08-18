# HourWise Fleet Portal — Batch 11: Route Planning, Operational Resolution & Compliance Forecasting

Status: deployed to the linked Supabase project and verified on 2026-08-18.

## Delivered

### Route planning

- Added company-scoped `job_stops` records with explicit contiguous sequence, stop type, site/address, optional coordinates, contact/instructions, driver notes, activity, and arrival windows.
- Added a manager-only `job_stop_manager_notes` boundary so private notes are not exposed through the driver stop read model.
- Added `save_job_stops(job_id, expected_job_updated_at, stops)` as the governed write path. It derives company and actor identity server-side, locks the job, rejects stale versions, validates sequence and location data, records an audit event, and makes a later route estimate stale by changing the job version.
- Extended the existing Job Planner with add/remove/reorder/edit stop controls. Driver Dashboard shows ordered published-assignment stops and manual lifecycle evidence only; it does not claim GPS, live next-stop, road distance, duration, or ETA.
- Added a provider-neutral route contract. The current deployment intentionally reports `provider_unavailable`, `restriction_incomplete`, `missing_address`, or `stale` when evidence/provider configuration is not available. No straight-line or fabricated HGV estimate is produced.

### Operational resolution

- Added `operational_task_handlings` as an optional workflow record keyed to the source type/id. Source records remain authoritative.
- Added `set_operational_task_handling(...)` with company/source validation, authorised manager ownership, bounded notes, stale handling protection, server-side actor/timestamps, audit event, and states `new`, `acknowledged`, `in_progress`, and `resolved`.
- Extended the deterministic manager queue with handling-state, Mine, In progress, and Resolved/recent filters. Resolving handling never closes a vehicle defect or changes a job lifecycle state; source-driven tasks disappear only when their source evidence no longer projects a task (for example, a defect reaches `fixed`).
- Atlas remains deterministic and includes structured operational signals only.

### Compliance forecasting

- Added deterministic evidence/date forecasting over actual asset fields currently in the portal: MOT/annual test, PMI/service, tachograph calibration, LOLER where applicable, and insurance.
- Forecast states are `known_valid`, `expiring`, `expired`, `missing`, and `unknown`; horizons are overdue, 7, 14, 30, 60, and 90 days.
- Added a manager forecast panel with horizon filters and future planning conflict wording. A future assignment after an evidence expiry is a planning warning, not an automatic statement of illegality or a new hard block.
- The 14-day/overdue/missing threshold feeds the task/Atlas surfaces without creating duplicate source tasks. Existing Batch 10 assignment readiness rules remain the only assignment hard-block authority.

## Security and deployment evidence

- Migration: `20260818211043_batch11_route_stops_and_task_handling.sql`.
- Live migration history contains this version.
- `job_stops`, `job_stop_manager_notes`, and `operational_task_handlings` have RLS enabled.
- New write paths are `SECURITY DEFINER` with `search_path = public, pg_temp`, authenticated-only execute grants, server-side `auth.uid()`/company checks, and no direct authenticated table writes.
- Supabase security-advisor warnings for the new authenticated RPCs are intentional and documented: the browser needs the RPC entry point, while the functions enforce the manager/company/source boundary. No new anonymous execute grant was introduced.

## Validation

- Focused Batch 11 route/forecast/queue/Atlas tests: passed, 4 files / 11 tests.
- Full TypeScript check: passed.
- `supabase db push --dry-run`: passed before deployment.
- `supabase db push`: applied successfully.
- Database types regenerated from the live schema.
- Full rule/regression suite: passed, 43 files / 295 tests. Production build: passed. Changed-file lint: passed. Full repository lint remains at the known baseline of 103 errors and 7 warnings in unrelated pre-existing files.

## Known limitations

- No route provider credentials/configuration are present in this deployment, so road distance, duration, navigation restrictions, and ETA remain unavailable by design.
- The current route editor captures the core stop location/instruction fields; provider-specific HGV dimensions remain an explicit future vehicle-profile integration rather than invented defaults.
- Compliance forecasting is a read-side forecast from current evidence. It is not a legal determination and does not replace the existing readiness/return-to-service rules.
