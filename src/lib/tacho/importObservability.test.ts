import { describe, expect, it } from 'vitest';

import { canRetryTachoImportProcessing, getTachoImportObservabilityIssue, summarizeTachoImportObservability } from './importObservability';
import { evaluateTachoRegressionFixtures, summarizeTachoRegressionFixtures, TACHO_REGRESSION_FIXTURES } from './regressionFixtures';
import type { TachoImportRecord } from './rules/types';

function buildImport(overrides: Partial<TachoImportRecord> = {}): TachoImportRecord {
  return {
    id: overrides.id ?? 'import-test-1',
    sourceType: overrides.sourceType ?? 'driver_card',
    fileName: overrides.fileName ?? 'TEST.C1B',
    fileType: overrides.fileType ?? 'c1b',
    importedAt: overrides.importedAt ?? '2026-06-07T10:00:00.000Z',
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
    parserStatus: overrides.parserStatus,
    helperCaptureSchema: overrides.helperCaptureSchema,
    helperCaptureWarning: overrides.helperCaptureWarning,
    helperCaptureFileCount: overrides.helperCaptureFileCount,
    helperCaptureSelectedFileCount: overrides.helperCaptureSelectedFileCount,
    helperCaptureCapturedBytes: overrides.helperCaptureCapturedBytes,
    processingError: overrides.processingError,
    processingKickoffError: overrides.processingKickoffError,
    triggerDispatchError: overrides.triggerDispatchError,
    triggerDispatchRequestedAt: overrides.triggerDispatchRequestedAt,
    processingKickoffRequestedAt: overrides.processingKickoffRequestedAt,
    discrepancyPreview: overrides.discrepancyPreview,
    reconciliationPreview: overrides.reconciliationPreview,
  };
}

describe('getTachoImportObservabilityIssue', () => {
  it('prioritizes kickoff errors over later processing errors', () => {
    const issue = getTachoImportObservabilityIssue(
      buildImport({
        processingKickoffError: 'Kickoff failed with 401.',
        processingError: 'Parser error should not take priority here.',
        processingKickoffRequestedAt: '2026-06-07T10:02:00.000Z',
      })
    );

    expect(issue).toEqual({
      kind: 'processing_kickoff',
      title: 'Processing Kickoff Warning',
      message: 'Kickoff failed with 401.',
      timestamp: '2026-06-07T10:02:00.000Z',
      tone: 'warning',
      retryable: true,
    });
  });

  it('treats trigger dispatch failures as retryable warnings', () => {
    const issue = getTachoImportObservabilityIssue(
      buildImport({
        triggerDispatchError: 'pg_net timeout',
        triggerDispatchRequestedAt: '2026-06-07T10:03:00.000Z',
      })
    );

    expect(issue?.kind).toBe('trigger_dispatch');
    expect(issue?.retryable).toBe(true);
    expect(issue?.timestamp).toBe('2026-06-07T10:03:00.000Z');
  });

  it('treats failed processing errors as retryable danger states', () => {
    const issue = getTachoImportObservabilityIssue(
      buildImport({
        status: 'failed',
        processingError: 'Parser rejected activity block.',
      })
    );

    expect(issue?.kind).toBe('processing_error');
    expect(issue?.tone).toBe('danger');
    expect(issue?.retryable).toBe(true);
  });

  it('treats read-only helper captures as intentional non-retryable warnings', () => {
    const issue = getTachoImportObservabilityIssue(
      buildImport({
        status: 'partial',
        parserStatus: 'partial_helper_capture',
        helperCaptureSchema: 'hourwise.tachograph.driver-card.read-only-capture.v1',
        helperCaptureSelectedFileCount: 12,
        helperCaptureCapturedBytes: 39444,
      })
    );

    expect(issue).toEqual({
      kind: 'helper_capture',
      title: 'Read-only Helper Capture',
      message: 'The desktop helper stored a read-only EF capture (12 tachograph card files, 39,444 bytes). It is preserved for parser development and is not yet normalized into compliance records.',
      tone: 'warning',
      retryable: false,
    });
  });
});

describe('canRetryTachoImportProcessing', () => {
  it('returns false when no observability issue exists', () => {
    expect(canRetryTachoImportProcessing(buildImport({ status: 'complete', progressPercent: 100 }))).toBe(false);
  });

  it('returns true for retryable kickoff or dispatch issues', () => {
    expect(canRetryTachoImportProcessing(buildImport({ processingKickoffError: '401' }))).toBe(true);
    expect(canRetryTachoImportProcessing(buildImport({ triggerDispatchError: 'timeout' }))).toBe(true);
  });

  it('does not retry read-only helper captures automatically', () => {
    expect(canRetryTachoImportProcessing(buildImport({
      status: 'partial',
      parserStatus: 'partial_helper_capture',
      helperCaptureSchema: 'hourwise.tachograph.driver-card.read-only-capture.v1',
    }))).toBe(false);
  });
});

describe('summarizeTachoImportObservability', () => {
  it('groups import statuses and attention counts for monitoring cards', () => {
    const summary = summarizeTachoImportObservability(
      [
        buildImport({ id: 'processing-1', status: 'processing' }),
        buildImport({ id: 'complete-1', status: 'complete', progressPercent: 100 }),
        buildImport({ id: 'failed-1', status: 'failed', progressPercent: 100, processingError: 'Parser failed.' }),
        buildImport({ id: 'partial-1', status: 'partial', progressPercent: 100, processingError: 'Partial parse.' }),
        buildImport({ id: 'helper-capture-1', status: 'partial', progressPercent: 100, parserStatus: 'partial_helper_capture' }),
        buildImport({ id: 'kickoff-1', processingKickoffError: '401' }),
        buildImport({ id: 'dispatch-1', triggerDispatchError: 'timeout' }),
      ],
      new Date('2026-06-07T12:00:00.000Z')
    );

    expect(summary).toEqual({
      processingNow: 1,
      completedToday: 1,
      failedImports: 1,
      partialImports: 2,
      helperCaptureWarnings: 1,
      kickoffWarnings: 1,
      dispatchWarnings: 1,
      processingErrors: 2,
      retryBacklog: 3,
      attentionQueue: 5,
    });
  });
});

describe('TACHO_REGRESSION_FIXTURES', () => {
  it('keeps synthetic Phase 9 regression fixtures aligned with expected issue kinds and retryability', () => {
    const evaluations = evaluateTachoRegressionFixtures();

    expect(evaluations).toEqual(
      TACHO_REGRESSION_FIXTURES.map((fixture) => ({
        id: fixture.id,
        description: fixture.description,
        issueKind: fixture.expectedIssueKind,
        retryable: fixture.expectedRetryable,
      }))
    );
  });

  it('produces a stable monitoring summary across the synthetic fixture set', () => {
    expect(summarizeTachoRegressionFixtures()).toEqual({
      processingNow: 0,
      completedToday: 1,
      failedImports: 1,
      partialImports: 2,
      helperCaptureWarnings: 1,
      kickoffWarnings: 1,
      dispatchWarnings: 1,
      processingErrors: 2,
      retryBacklog: 3,
      attentionQueue: 5,
    });
  });
});
