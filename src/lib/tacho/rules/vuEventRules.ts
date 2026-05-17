import type { TachoFinding } from './types';

export interface VuSpeedLog {
  timestamp: string;
  speedKmh: number;
}

export function evaluateVuOverspeedEvents(
  importId: string,
  speedLogs: VuSpeedLog[],
  vehicleId?: string | null,
  driverId?: string | null
): TachoFinding[] {
  return speedLogs
    .filter((log) => log.speedKmh >= 90)
    .map((log) => ({
      id: `VU_OVERSPEED-${log.timestamp}`,
      driverId: driverId ?? null,
      vehicleId: vehicleId ?? null,
      source: 'vehicle_unit',
      severity: 'medium' as const,
      status: 'warning' as const,
      ruleCode: 'VU_OVERSPEED',
      title: 'Overspeed event',
      summary: `Recorded speed ${log.speedKmh} km/h.`,
      occurredAt: log.timestamp,
      periodStart: log.timestamp,
      periodEnd: log.timestamp,
      evidenceRefs: [{ kind: 'event', refId: importId, label: 'Speed log' }],
      metadata: { speedKmh: log.speedKmh },
    }));
}
