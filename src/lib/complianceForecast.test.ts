import { describe, expect, it } from 'vitest';
import { buildComplianceForecast, forecastNeedsAction } from './complianceForecast';

const evidence = { id: 'vehicle-1', label: 'AB12 CDE', kind: 'vehicle' as const, isVor: false, motDueDate: '2026-08-25', pmiDueDate: '2026-10-01', tachoCalibrationDue: '2026-12-01', lolerDueDate: null, insuranceExpiry: null, unresolvedSafetyDefects: 0, vehicleDocumentCount: 2 };

describe('Batch 11 compliance forecasting', () => {
  it('classifies overdue, near-term, valid, and missing evidence deterministically', () => {
    const forecast = buildComplianceForecast(evidence, new Date('2026-08-14'));
    expect(forecast.find((item) => item.evidenceType === 'mot')).toMatchObject({ status: 'expiring', horizon: 14, severity: 'high' });
    expect(forecast.find((item) => item.evidenceType === 'insurance')).toMatchObject({ status: 'missing', missingEvidence: true });
    expect(forecast.find((item) => item.evidenceType === 'pmi')).toMatchObject({ status: 'expiring', horizon: 60 });
    expect(forecast.find((item) => item.evidenceType === 'tacho_calibration')).toMatchObject({ status: 'known_valid' });
  });
  it('flags future planning conflict without asserting illegality or hard blocking', () => {
    const forecast = buildComplianceForecast({ ...evidence, motDueDate: '2026-08-20' }, new Date('2026-08-18'), [{ id: 'assignment-1', vehicleId: 'vehicle-1', plannedDate: '2026-08-21' }]);
    expect(forecast.find((item) => item.evidenceType === 'mot')).toMatchObject({ planningRisk: 'planned_after_expiry' });
  });
  it('uses the action threshold for overdue, <=14 day, or missing required evidence', () => {
    const forecast = buildComplianceForecast(evidence, new Date('2026-08-18'));
    expect(forecast.filter(forecastNeedsAction).map((item) => item.evidenceType)).toEqual(expect.arrayContaining(['mot', 'insurance']));
  });
});
