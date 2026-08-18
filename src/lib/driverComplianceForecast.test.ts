import { describe, expect, it } from 'vitest';
import { buildDriverComplianceForecast, driverForecastNeedsAction, type DriverComplianceEvidence } from './driverComplianceForecast';
import { buildOperationalTasks } from './operationalTaskQueue';

const evidence: DriverComplianceEvidence = {
  driverId: 'driver-1',
  driverLabel: 'Alex Driver',
  drivingLicenceNumber: 'LIC-1',
  drivingLicenceExpiry: '2026-08-25',
  cpcDqcNumber: 'CPC-1',
  cpcDqcExpiry: '2026-12-01',
  medicalDocuments: [{ id: 'doc-1', documentType: 'D4 medical', expiryDate: '2026-09-10', verifiedAt: '2026-01-01T00:00:00Z' }],
};

describe('driver compliance forecast', () => {
  it('separates missing medical evidence from profile expiry evidence', () => {
    const items = buildDriverComplianceForecast({ ...evidence, medicalDocuments: [] }, new Date('2026-08-18T09:00:00Z'));
    const medical = items.find((item) => item.evidenceType === 'medical');
    expect(medical?.status).toBe('missing');
    expect(medical?.evidenceSource).toBe('none');
    expect(medical?.missingEvidence).toBe(true);
  });

  it('flags a future assignment after expiry as a planning risk, not a legal conclusion', () => {
    const items = buildDriverComplianceForecast(evidence, new Date('2026-08-18T09:00:00Z'), [{ id: 'assignment-1', plannedDate: '2026-09-01' }]);
    const licence = items.find((item) => item.evidenceType === 'driving_licence');
    expect(licence?.planningRisk).toBe('planned_after_expiry');
    expect(licence?.planningConflictDates).toEqual(['2026-09-01']);
    expect(driverForecastNeedsAction(licence!)).toBe(true);
  });

  it('projects one canonical driver task for multiple evidence warnings', () => {
    const items = buildDriverComplianceForecast({ ...evidence, drivingLicenceExpiry: null, cpcDqcExpiry: null }, new Date('2026-08-18T09:00:00Z'));
    const tasks = buildOperationalTasks({ now: new Date('2026-08-18T09:00:00Z'), driverCompliance: items });
    expect(tasks.filter((task) => task.sourceType === 'driver_compliance')).toHaveLength(1);
    expect(tasks[0]?.sourceId).toBe('driver-1');
  });
});
