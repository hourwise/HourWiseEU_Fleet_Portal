import { describe, expect, it } from 'vitest';
import { evaluateDriverDocumentCompliance } from './driverCompliance';

describe('Batch 7 driver document compliance', () => {
  const today = new Date('2026-08-10T12:00:00.000Z');

  it('distinguishes missing evidence', () => {
    expect(evaluateDriverDocumentCompliance([], today).state).toBe('missing');
  });

  it('does not call an uploaded unverified document compliant', () => {
    expect(evaluateDriverDocumentCompliance([
      { expiry_date: '2027-08-10', verified_at: null },
    ], today).state).toBe('unverified');
  });

  it('recognises verified valid evidence', () => {
    expect(evaluateDriverDocumentCompliance([
      { expiry_date: '2027-08-10', verified_at: '2026-08-09T10:00:00.000Z' },
    ], today).state).toBe('verified_valid');
  });

  it('recognises verified evidence that is expiring', () => {
    expect(evaluateDriverDocumentCompliance([
      { expiry_date: '2026-08-20', verified_at: '2026-08-09T10:00:00.000Z' },
    ], today).state).toBe('expiring');
  });

  it('prioritises expired evidence over verification status', () => {
    expect(evaluateDriverDocumentCompliance([
      { expiry_date: '2026-08-09', verified_at: null },
    ], today).state).toBe('expired');
  });
});
