import { describe, expect, it } from 'vitest';
import { evaluateAssetReadiness } from './assetCompliance';

const baseEvidence = {
  id: 'vehicle-1',
  label: 'AB12 CDE',
  kind: 'vehicle' as const,
  isVor: false,
  motDueDate: '2026-09-01',
  pmiDueDate: '2026-09-01',
  tachoCalibrationDue: '2026-09-01',
  lolerDueDate: null,
  insuranceExpiry: '2026-09-01',
  unresolvedSafetyDefects: 0,
  vehicleDocumentCount: 2,
};

describe('asset compliance rules', () => {
  it('returns ready only when the required evidence is present and current', () => {
    expect(evaluateAssetReadiness(baseEvidence, new Date('2026-08-01')).status).toBe('ready');
  });

  it('keeps missing evidence explicit instead of converting it to ready', () => {
    const result = evaluateAssetReadiness({ ...baseEvidence, motDueDate: null, unresolvedSafetyDefects: null, vehicleDocumentCount: 0 }, new Date('2026-08-01'));
    expect(result.status).toBe('unknown');
    expect(result.reasons.map((reason) => reason.code)).toEqual(expect.arrayContaining(['mot_due', 'safety_defects_unknown', 'documents_missing']));
  });

  it('prohibits assignment when VOR or an unresolved safety defect is authoritative', () => {
    expect(evaluateAssetReadiness({ ...baseEvidence, isVor: true }, new Date('2026-08-01')).status).toBe('prohibited');
    expect(evaluateAssetReadiness({ ...baseEvidence, unresolvedSafetyDefects: 1 }, new Date('2026-08-01')).status).toBe('prohibited');
  });

  it('distinguishes due-soon warnings from overdue action', () => {
    expect(evaluateAssetReadiness({ ...baseEvidence, motDueDate: '2026-08-10' }, new Date('2026-08-01')).status).toBe('warning');
    expect(evaluateAssetReadiness({ ...baseEvidence, motDueDate: '2026-07-31' }, new Date('2026-08-01')).status).toBe('action_required');
  });
});
