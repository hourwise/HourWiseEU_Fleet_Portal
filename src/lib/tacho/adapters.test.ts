import { describe, expect, it } from 'vitest';

import { adaptImportRecord, deriveVehicleMotionDiscrepancies } from './adapters';
import type { TachoFinding } from './rules/types';

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
        processing_kickoff_error: 'Function returned 401.',
        processing_kickoff_requested_at: '2026-06-07T10:31:00.000Z',
        trigger_dispatch_error: 'pg_net timeout',
        trigger_dispatch_requested_at: '2026-06-07T10:31:05.000Z',
        processing_error: 'Parser rejected a corrupted block.',
      },
    });

    expect(record.ingestSource).toBe('reader_helper');
    expect(record.processingKickoffError).toBe('Function returned 401.');
    expect(record.processingKickoffRequestedAt).toBe('2026-06-07T10:31:00.000Z');
    expect(record.triggerDispatchError).toBe('pg_net timeout');
    expect(record.triggerDispatchRequestedAt).toBe('2026-06-07T10:31:05.000Z');
    expect(record.processingError).toBe('Parser rejected a corrupted block.');
  });
});
