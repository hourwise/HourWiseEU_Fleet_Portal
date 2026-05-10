# Tacho Backend API

## Purpose

This document defines the Supabase-facing API and RPC contract used by the frontend tacho workspace.

It complements:

- `docs/tacho-parser-contract.md`
- `src/lib/tacho/api.ts`
- `src/lib/tacho/rules/types.ts`

## Frontend API entry points

The frontend expects these RPC names:

1. `get_company_tacho_signals`
2. `get_driver_tacho_analysis_bundle`
3. `get_vehicle_unit_analysis_bundle`
4. `get_tacho_import_bundle`

## RPC: `get_company_tacho_signals`

Purpose:

1. Return normalized driver-level compliance and risk signals for a company period.
2. Feed `useCompanyCompliance.ts` and `useDriverRiskScores.ts`.

Arguments:

1. `p_company_id uuid`
2. `p_days integer default 14`

Return shape:

```sql
table (
  driver_id uuid,
  compliance_signal jsonb,
  risk_signal jsonb
)
```

`compliance_signal` must match `ParserDriverTachoComplianceSignal`.

`risk_signal` must match `ParserDriverTachoRiskSignal`.

## RPC: `get_driver_tacho_analysis_bundle`

Purpose:

1. Return a full driver-card analysis bundle for one driver and range.
2. Feed the driver-card analysis screen.

Arguments:

1. `p_company_id uuid`
2. `p_driver_id uuid`
3. `p_range text default '7d'`

Return shape:

1. `jsonb`
2. Must match `TachoParserBundle`

## RPC: `get_vehicle_unit_analysis_bundle`

Purpose:

1. Return a full VU analysis bundle for one vehicle and range.
2. Feed the vehicle-unit analysis screen.

Arguments:

1. `p_company_id uuid`
2. `p_vehicle_id uuid`
3. `p_range text default '7d'`

Return shape:

1. `jsonb`
2. Must match `TachoParserBundle`

## RPC: `get_tacho_import_bundle`

Purpose:

1. Return the normalized bundle for one specific import.
2. Feed import-centre drilldown, processing audit, and evidence views.

Arguments:

1. `p_company_id uuid`
2. `p_import_id uuid`

Return shape:

1. `jsonb`
2. Must match `TachoParserBundle`

## Behaviour rules

1. If normalized signals exist, the frontend will treat them as truth and use them in preference to raw `tachograph_activities`.
2. If RPCs fail or return nothing, the frontend can fall back to raw-activity adapters temporarily.
3. RPCs should not return parser-internal raw blobs that the frontend must decode further.
4. Timestamps must be ISO UTC strings.
