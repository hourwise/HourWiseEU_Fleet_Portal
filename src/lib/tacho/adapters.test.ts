import { describe, expect, it } from 'vitest';

import { attachTimelineComparison, adaptImportRecord, deriveVehicleMotionDiscrepancies } from './adapters';
import type { TachoFinding, TachoParserBundle, TachoTimelineBundle } from './rules/types';

function buildFinding(overrides: Partial<TachoFinding>): TachoFinding {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    source: overrides.source ?? 'vehicle_unit',
    severity: overrides.severity ?? 'medium',
    status: overrides.status ?? 'warning',
    ruleCode: overrides.ruleCode ?? 'VU_MOTION_CONFLICT',
    title: overrides.title ?? 'Test finding',
    summary: overrides.summary ?? 'Test summary',
    occurredAt: overrides.occurredAt ?? '2026-05-10T10:00:00.000Z',
    periodStart: overrides.periodStart ?? '2026-05-10T10:00:00.000Z',
    periodEnd: overrides.periodEnd ?? '2026-05-10T10:15:00.000Z',
    evidenceRefs: overrides.evidenceRefs ?? [],
    legalBasis: overrides.legalBasis,
    metadata: overrides.metadata,
    driverId: overrides.driverId,
    vehicleId: overrides.vehicleId,
  };
}

describe('deriveVehicleMotionDiscrepancies', () => {
  it('maps cardless and card-conflict technical events into operational discrepancies', () => {
    const discrepancies = deriveVehicleMotionDiscrepancies(
      [
        buildFinding({
          id: 'event-1',
          ruleCode: 'VU_DRIVING_WITHOUT_CARD',
          severity: 'high',
          summary: 'Driving without card',
          periodStart: '2026-05-10T07:00:00.000Z',
          periodEnd: '2026-05-10T07:20:00.000Z',
        }),
        buildFinding({
          id: 'event-2',
          ruleCode: 'VU_CARD_CONFLICT',
          severity: 'medium',
          summary: 'Card conflict',
          periodStart: '2026-05-10T06:00:00.000Z',
          periodEnd: '2026-05-10T06:10:00.000Z',
        }),
      ],
      []
    );

    expect(discrepancies).toHaveLength(2);
    expect(discrepancies[0].status).toBe('unassigned_motion');
    expect(discrepancies[0].durationMins).toBe(20);
    expect(discrepancies[1].status).toBe('driver_mismatch');
  });

  it('includes DISC findings as driver mismatches and sorts newest first', () => {
    const discrepancies = deriveVehicleMotionDiscrepancies(
      [],
      [
        buildFinding({
          id: 'disc-older',
          source: 'combined',
          ruleCode: 'DISC_APP_TACHO_MISMATCH',
          summary: 'Older mismatch',
          periodStart: '2026-05-09T06:00:00.000Z',
          periodEnd: '2026-05-09T06:45:00.000Z',
          occurredAt: '2026-05-09T06:45:00.000Z',
        }),
        buildFinding({
          id: 'disc-newer',
          source: 'combined',
          ruleCode: 'DISC_APP_TACHO_MISMATCH',
          summary: 'Newer mismatch',
          periodStart: '2026-05-10T08:00:00.000Z',
          periodEnd: '2026-05-10T08:30:00.000Z',
          occurredAt: '2026-05-10T08:30:00.000Z',
        }),
      ]
    );

    expect(discrepancies).toHaveLength(2);
    expect(discrepancies[0].summary).toBe('Newer mismatch');
    expect(discrepancies[0].status).toBe('driver_mismatch');
    expect(discrepancies[1].summary).toBe('Older mismatch');
  });
});

describe('adaptImportRecord', () => {
  it('surfaces observability metadata from tachograph_files rows', () => {
    const record = adaptImportRecord({
      id: 'import-obs-1',
      source_type: 'driver_card',
      filename: 'OBSERVE.C1B',
      file_type: 'c1b',
      uploaded_at: '2026-06-07T10:30:00.000Z',
      status: 'pending',
      metadata: {
        ingest_source: 'reader_helper',
        parser_status: 'partial_helper_capture',
        helper_capture_schema: 'hourwise.tachograph.driver-card.read-only-capture.v1',
        helper_capture_warning: 'Read-only helper capture is not parser-ready.',
        helper_capture_file_count: 14,
        helper_capture_selected_file_count: 12,
        helper_capture_captured_bytes: 39444,
        processing_kickoff_error: 'Function returned 401.',
        processing_kickoff_requested_at: '2026-06-07T10:31:00.000Z',
        trigger_dispatch_error: 'pg_net timeout',
        trigger_dispatch_requested_at: '2026-06-07T10:31:05.000Z',
        processing_error: 'Parser rejected a corrupted block.',
      },
    });

    expect(record.ingestSource).toBe('reader_helper');
    expect(record.parserStatus).toBe('partial_helper_capture');
    expect(record.helperCaptureSchema).toBe('hourwise.tachograph.driver-card.read-only-capture.v1');
    expect(record.helperCaptureWarning).toBe('Read-only helper capture is not parser-ready.');
    expect(record.helperCaptureFileCount).toBe(14);
    expect(record.helperCaptureSelectedFileCount).toBe(12);
    expect(record.helperCaptureCapturedBytes).toBe(39444);
    expect(record.processingKickoffError).toBe('Function returned 401.');
    expect(record.processingKickoffRequestedAt).toBe('2026-06-07T10:31:00.000Z');
    expect(record.triggerDispatchError).toBe('pg_net timeout');
    expect(record.triggerDispatchRequestedAt).toBe('2026-06-07T10:31:05.000Z');
    expect(record.processingError).toBe('Parser rejected a corrupted block.');
  });
});

describe('attachTimelineComparison', () => {
  const parserBundle: TachoParserBundle = {
    contractVersion: '1.0',
    importRecord: adaptImportRecord({
      id: 'import-timeline-1',
      source_type: 'driver_card',
      filename: 'TIMELINE.C1B',
      uploaded_at: '2026-07-03T08:00:00.000Z',
      status: 'processed',
    }),
    processingRun: {
      importId: 'import-timeline-1',
      parserVersion: 'readesm@1.0.17',
      source: 'normalized_findings',
      processedAt: '2026-07-03T08:10:00.000Z',
      warnings: [],
      errors: [],
    },
    activitySegments: [
      {
        id: 'activity-1',
        source: 'driver_card',
        activityType: 'driving',
        startTime: '2026-07-03T08:00:00.000Z',
        endTime: '2026-07-03T09:00:00.000Z',
        durationMins: 60,
      },
    ],
    findings: [],
    technicalEvents: [],
    reconciliation: [],
    vehicleMotionDiscrepancies: [],
    daySummaries: [
      {
        date: '2026-07-03',
        drivingMins: 60,
        workMins: 0,
        poaMins: 0,
        restMins: 0,
        findingsCount: 0,
        activities: [],
      },
    ],
    driverComplianceSignals: [],
    driverRiskSignals: [],
  };

  it('attaches timeline output and non-destructive count comparison to existing parser bundle', () => {
    const timelineBundle: TachoTimelineBundle = {
      contractVersion: 'timeline-mvp-1',
      timelineGeneration: {
        id: 'generation-1',
        version: 'timeline-mvp@1',
        status: 'completed',
        isCurrent: true,
      },
      events: [
        {
          id: 'event-1',
          eventType: 'driving',
          startTime: '2026-07-03T08:00:00.000Z',
          endTime: '2026-07-03T09:00:00.000Z',
          durationSeconds: 3600,
        },
      ],
      gaps: [],
      dailySummaries: [
        {
          id: 'summary-1',
          date: '2026-07-03',
          drivingSeconds: 3600,
          workSeconds: 0,
          availabilitySeconds: 0,
          restSeconds: 0,
          breakSeconds: 0,
          unknownSeconds: 0,
          gapCount: 0,
          findingCount: 0,
          confidenceState: 'confirmed',
        },
      ],
      warnings: [],
    };

    const enriched = attachTimelineComparison(parserBundle, timelineBundle);

    expect(enriched.timelineBundle).toBe(timelineBundle);
    expect(enriched.activitySegments).toEqual(parserBundle.activitySegments);
    expect(enriched.timelineComparison).toMatchObject({
      available: true,
      tachographActivityCount: 1,
      timelineEventCount: 1,
      tachographGapCount: 0,
      timelineGapCount: 0,
      tachographDaySummaryCount: 1,
      timelineDailySummaryCount: 1,
      eventCountMatches: true,
      gapCountMatches: true,
      daySummaryCountMatches: true,
      timelineGenerationId: 'generation-1',
    });
  });
});
