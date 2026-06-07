import type { TachoImportObservabilityIssue } from './importObservability';
import { canRetryTachoImportProcessing, getTachoImportObservabilityIssue, summarizeTachoImportObservability } from './importObservability';
import type { TachoImportRecord } from './rules/types';

export interface TachoRegressionFixture {
  id: string;
  description: string;
  importRecord: TachoImportRecord;
  expectedIssueKind: TachoImportObservabilityIssue['kind'] | null;
  expectedRetryable: boolean;
}

function buildImportRecord(overrides: Partial<TachoImportRecord>): TachoImportRecord {
  return {
    id: overrides.id ?? 'fixture-import',
    sourceType: overrides.sourceType ?? 'driver_card',
    fileName: overrides.fileName ?? 'FIXTURE.C1B',
    fileType: overrides.fileType ?? 'c1b',
    importedAt: overrides.importedAt ?? '2026-06-07T09:00:00.000Z',
    status: overrides.status ?? 'queued',
    progressPercent: overrides.progressPercent ?? 20,
    driverName: overrides.driverName,
    vehicleReg: overrides.vehicleReg,
    summary: overrides.summary,
    technicalEventCount: overrides.technicalEventCount,
    discrepancyCount: overrides.discrepancyCount,
    reconciliationIssueCount: overrides.reconciliationIssueCount,
    highSeverityCount: overrides.highSeverityCount,
    ingestSource: overrides.ingestSource,
    processingError: overrides.processingError,
    processingKickoffError: overrides.processingKickoffError,
    triggerDispatchError: overrides.triggerDispatchError,
    triggerDispatchRequestedAt: overrides.triggerDispatchRequestedAt,
    processingKickoffRequestedAt: overrides.processingKickoffRequestedAt,
    discrepancyPreview: overrides.discrepancyPreview,
    reconciliationPreview: overrides.reconciliationPreview,
  };
}

export const TACHO_REGRESSION_FIXTURES: TachoRegressionFixture[] = [
  {
    id: 'healthy-driver-card',
    description: 'Successful driver-card import with no observability issues.',
    importRecord: buildImportRecord({
      id: 'fixture-success-1',
      status: 'complete',
      progressPercent: 100,
      driverName: 'Lewis Carter',
      summary: 'Driver card processed successfully.',
      importedAt: '2026-06-07T08:30:00.000Z',
    }),
    expectedIssueKind: null,
    expectedRetryable: false,
  },
  {
    id: 'kickoff-warning',
    description: 'Browser kickoff warning should remain retryable.',
    importRecord: buildImportRecord({
      id: 'fixture-kickoff-1',
      sourceType: 'vehicle_unit',
      fileName: 'HX24FLT_20260607.DDD',
      fileType: 'ddd',
      status: 'queued',
      progressPercent: 20,
      vehicleReg: 'HX24 FLT',
      summary: 'Kickoff did not confirm.',
      processingKickoffError: 'Edge Function returned 401.',
      processingKickoffRequestedAt: '2026-06-07T08:45:00.000Z',
    }),
    expectedIssueKind: 'processing_kickoff',
    expectedRetryable: true,
  },
  {
    id: 'dispatch-warning',
    description: 'DB-trigger dispatch failure should remain retryable.',
    importRecord: buildImportRecord({
      id: 'fixture-dispatch-1',
      status: 'queued',
      progressPercent: 20,
      summary: 'Dispatch from pg_net timed out.',
      ingestSource: 'sftp_ingest',
      triggerDispatchError: 'pg_net timeout',
      triggerDispatchRequestedAt: '2026-06-07T09:10:00.000Z',
    }),
    expectedIssueKind: 'trigger_dispatch',
    expectedRetryable: true,
  },
  {
    id: 'partial-parse',
    description: 'Partial parser outputs should count toward attention backlog.',
    importRecord: buildImportRecord({
      id: 'fixture-partial-1',
      status: 'partial',
      progressPercent: 100,
      summary: 'Partial parse completed with one rejected block.',
      processingError: 'One activity block could not be normalized.',
    }),
    expectedIssueKind: 'processing_error',
    expectedRetryable: false,
  },
  {
    id: 'failed-parse',
    description: 'Failed parser outputs should remain retryable.',
    importRecord: buildImportRecord({
      id: 'fixture-failed-1',
      status: 'failed',
      progressPercent: 100,
      summary: 'Parser rejected the file.',
      processingError: 'Corrupted activity block at offset 21844.',
    }),
    expectedIssueKind: 'processing_error',
    expectedRetryable: true,
  },
];

export function evaluateTachoRegressionFixtures() {
  return TACHO_REGRESSION_FIXTURES.map((fixture) => {
    const issue = getTachoImportObservabilityIssue(fixture.importRecord);
    return {
      id: fixture.id,
      description: fixture.description,
      issueKind: issue?.kind ?? null,
      retryable: canRetryTachoImportProcessing(fixture.importRecord),
    };
  });
}

export function summarizeTachoRegressionFixtures(now = new Date('2026-06-07T12:00:00.000Z')) {
  return summarizeTachoImportObservability(
    TACHO_REGRESSION_FIXTURES.map((fixture) => fixture.importRecord),
    now
  );
}
