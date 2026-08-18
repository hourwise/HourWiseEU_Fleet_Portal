import { describe, expect, it } from 'vitest';
import { normaliseDriverJobRows } from './driverJobs';

describe('driver job read model', () => {
  it('keeps only driver-visible published assignments and preserves ordering data', () => {
    expect(normaliseDriverJobRows([
      { id: 'a', shift_id: 'shift-1', sequence: 2, status: 'updated', updated_at: '2026-08-14T08:00:00Z', planned_arrival_at: null, planned_departure_at: null, expected_duration_minutes: 30, jobs: { reference: 'JOB-2', title: 'Collection', job_type: 'collection', customer_name: 'Customer', address_text: 'Site', instructions: 'Call ahead' } },
      { id: 'draft', shift_id: 'shift-1', sequence: 3, status: 'draft', jobs: { reference: 'DRAFT', title: 'Hidden', address_text: 'Hidden' } },
    ])).toEqual([expect.objectContaining({ id: 'a', status: 'updated', customerName: 'Customer', instructions: 'Call ahead' })]);
  });

  it('returns no assignment rather than fabricating a job when the relation is absent', () => {
    expect(normaliseDriverJobRows([{ id: 'a', shift_id: 'shift-1', sequence: 1, status: 'published', updated_at: '2026-08-14T08:00:00Z', jobs: null }])).toEqual([]);
  });
});
