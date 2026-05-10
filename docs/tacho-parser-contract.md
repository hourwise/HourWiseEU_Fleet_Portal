# Tacho Parser To Frontend Contract

## Purpose

This contract defines the payload shape the tachograph parser/backend must return for the portal frontend.

The core rule is:

1. Tachograph card and VU data are the compliance source of truth.
2. App data remains a secondary operational source for clocking, payroll support, and Timeright cross-checks.
3. The parser must return normalized signals, not just raw decoded blobs.

The frontend canonical TypeScript contract lives in:

- `src/lib/tacho/rules/types.ts`

## Delivery model

The parser should produce one normalized bundle per processed import or per requested analysis window.

Top-level payload:

```ts
interface TachoParserBundle {
  contractVersion: '1.0';
  importRecord: TachoImportRecord;
  processingRun: TachoProcessingRun;
  driverCardDownload?: ParserDriverCardDownload;
  vehicleUnitDownload?: ParserVehicleUnitDownload;
  activitySegments: TachoActivitySegment[];
  findings: TachoFinding[];
  technicalEvents: TachoFinding[];
  daySummaries: TachoDaySummary[];
  driverComplianceSignals: ParserDriverTachoComplianceSignal[];
  driverRiskSignals: ParserDriverTachoRiskSignal[];
}
```

## Required top-level fields

### `importRecord`

Describes the file/import lifecycle visible in the Import Centre.

Required:

1. `id`
2. `sourceType`: `driver_card | vehicle_unit`
3. `fileName`
4. `fileType`: `ddd | c1b | v1b`
5. `importedAt`
6. `status`: `uploaded | queued | processing | complete | partial | failed`
7. `progressPercent`

Recommended:

1. `driverName`
2. `vehicleReg`
3. `summary`

### `processingRun`

Describes the parser execution used to produce this payload.

Required:

1. `importId`
2. `parserVersion`
3. `source`: `raw_activity | normalized_findings`
4. `processedAt`
5. `warnings`
6. `errors`

This allows the frontend to show whether the data came from:

1. temporary raw-activity fallback logic
2. true parser-produced normalized findings

## Download identity payloads

### `driverCardDownload`

Required:

1. `importId`
2. `companyId`
3. `cardNumber`
4. `downloadedAt`
5. `periodStart`
6. `periodEnd`
7. `downloadStatus`

Recommended:

1. `driverId`
2. `driverName`
3. `cardExpiry`
4. `issuingCountry`

### `vehicleUnitDownload`

Required:

1. `importId`
2. `companyId`
3. `vuSerial`
4. `downloadedAt`
5. `periodStart`
6. `periodEnd`
7. `downloadStatus`

Recommended:

1. `vehicleId`
2. `regNumber`
3. `calibrationDue`

## Activity segments

`activitySegments` are the normalized timeline blocks used by:

1. driver card day view
2. VU day view
3. duty-window construction
4. fallback calculations

Required per segment:

1. `id`
2. `source`
3. `activityType`
4. `startTime`
5. `endTime`
6. `durationMins`

Recommended:

1. `driverId`
2. `vehicleId`
3. `distanceKm`
4. `confidence`
5. `label`

Allowed `activityType` values:

1. `driving`
2. `work`
3. `poa`
4. `break_rest`
5. `unknown`

## Findings

`findings` are the normalized rule-engine outputs used as the truth source in compliance displays.

Required per finding:

1. `id`
2. `source`
3. `severity`
4. `status`
5. `ruleCode`
6. `title`
7. `summary`
8. `occurredAt`
9. `periodStart`
10. `periodEnd`

Recommended:

1. `driverId`
2. `vehicleId`
3. `legalBasis`
4. `evidenceRefs`
5. `metadata`

## Technical events

`technicalEvents` are primarily VU-side events/faults. They should use the same `TachoFinding` shape as normal findings.

Expected examples:

1. `VU_OVERSPEED`
2. `VU_DRIVING_WITHOUT_CARD`
3. `VU_INSERTION_WHILE_DRIVING`
4. `VU_CARD_CONFLICT`
5. `VU_MOTION_CONFLICT`
6. `VU_POWER_INTERRUPTION`
7. `VU_SENSOR_FAULT`
8. `VU_SECURITY_FAULT`
9. `VU_CALIBRATION_ALERT`

## Day summaries

`daySummaries` support:

1. timeline KPI strips
2. selected day drilldown
3. range summaries

Required:

1. `date`
2. `drivingMins`
3. `workMins`
4. `poaMins`
5. `restMins`
6. `findingsCount`
7. `activities`

Recommended:

1. `appDrivingMins`
2. `vuEventCount`

## Driver compliance signals

`driverComplianceSignals` are the normalized, frontend-ready tacho truth summaries that should replace the current raw fallback path.

Required:

1. `driverId`
2. `source`: always `normalized_findings`
3. `averageScore`
4. `totalViolations`
5. `violations`
6. `recentViolations`
7. `missingMileage`
8. `hasData`

These are consumed by:

1. `useCompanyCompliance.ts`
2. `ComplianceScoreboard.tsx`
3. `DriverComplianceSnapshot.tsx`

## Driver risk signals

`driverRiskSignals` are the normalized tacho-side risk summaries.

Required:

1. `driverId`
2. `source`: always `normalized_findings`
3. `legalComplianceScore`
4. `violationCount`
5. `missingMileageCount`
6. `appMismatchCount`

These are consumed by:

1. `useDriverRiskScores.ts`
2. `DriverRiskSnapshot.tsx`

## Evidence references

`evidenceRefs` should allow the frontend to drill from a finding back to its source material.

Allowed `kind` values:

1. `raw_file`
2. `activity_segment`
3. `event`
4. `fault`
5. `summary`
6. `finding`

Required:

1. `kind`
2. `refId`

Recommended:

1. `label`

## Source precedence rules

Frontend behaviour assumes:

1. If normalized tacho compliance signals exist for a driver, they take precedence over app compliance in all compliance scoreboards.
2. App compliance remains visible as a cross-check and operational aid.
3. The app is not allowed to overwrite verified tacho truth in any compliance view.

## Minimum backend guarantees

The parser/backend should guarantee:

1. ISO timestamps in UTC
2. stable IDs for imports, segments, findings, and events
3. dedupe-safe imports
4. parser version visibility
5. partial-processing support via `status = partial`
6. explicit warnings and errors rather than silent omission

## Versioning

Current contract version:

1. `1.0`

Rules for future changes:

1. Additive fields may be introduced without breaking existing consumers.
2. Renames or removals require a contract version bump.
3. New rule codes do not require a version bump if the base finding shape is unchanged.
