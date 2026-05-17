import { describe, expect, it } from 'vitest';

import { deriveVehicleMotionDiscrepancies } from './adapters';
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
