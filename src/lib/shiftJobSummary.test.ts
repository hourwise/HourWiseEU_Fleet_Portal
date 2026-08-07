import { describe, expect, it } from 'vitest';
import {
  buildShiftJobSummaries,
  emptyShiftJobSummary,
  firstJobDisplayLabel,
  formatPlannedArrivalTime,
  type ShiftJobSummaryRow,
} from './shiftJobSummary';

function row(overrides: Partial<ShiftJobSummaryRow> = {}): ShiftJobSummaryRow {
  return {
    shift_id: 'shift-a',
    sequence: 1,
    status: 'published',
    planned_arrival_at: null,
    jobs: { reference: 'JOB-1', title: 'Deliver goods', job_type: 'delivery', customer_name: null, address_text: '1 High Street' },
    ...overrides,
  };
}

describe('buildShiftJobSummaries', () => {
  it('groups assignments by shift', () => {
    const summaries = buildShiftJobSummaries([
      row({ shift_id: 'shift-a', sequence: 1 }),
      row({ shift_id: 'shift-b', sequence: 1, status: 'updated' }),
      row({ shift_id: 'shift-a', sequence: 2 }),
    ]);
    expect(summaries['shift-a'].activeJobCount).toBe(2);
    expect(summaries['shift-b'].activeJobCount).toBe(1);
  });

  it('counts only published and updated assignments', () => {
    const summaries = buildShiftJobSummaries([
      row({ sequence: 1, status: 'published' }),
      row({ sequence: 2, status: 'updated' }),
      row({ sequence: 3, status: 'draft' }),
      row({ sequence: 4, status: 'cancelled' }),
    ]);
    expect(summaries['shift-a'].activeJobCount).toBe(2);
  });

  it('ignores draft and cancelled assignments entirely', () => {
    const summaries = buildShiftJobSummaries([
      row({ sequence: 1, status: 'draft' }),
      row({ sequence: 2, status: 'cancelled' }),
    ]);
    expect(summaries['shift-a']).toBeUndefined();
  });

  it('chooses the lowest sequence as the first planned job', () => {
    const summaries = buildShiftJobSummaries([
      row({ sequence: 3, jobs: { reference: 'JOB-3', title: 'Third', job_type: 'delivery', customer_name: null, address_text: '3 Road' } }),
      row({ sequence: 1, jobs: { reference: 'JOB-1', title: 'First', job_type: 'delivery', customer_name: null, address_text: '1 Road' } }),
      row({ sequence: 2, jobs: { reference: 'JOB-2', title: 'Second', job_type: 'delivery', customer_name: null, address_text: '2 Road' } }),
    ]);
    expect(summaries['shift-a'].firstJob?.sequence).toBe(1);
    expect(summaries['shift-a'].firstJob?.reference).toBe('JOB-1');
  });

  it('produces the same result regardless of input row order', () => {
    const rows = [
      row({ sequence: 2, jobs: { reference: 'JOB-2', title: 'Second', job_type: 'delivery', customer_name: 'Acme', address_text: '2 Road' } }),
      row({ sequence: 1, jobs: { reference: 'JOB-1', title: 'First', job_type: 'delivery', customer_name: 'Beta', address_text: '1 Road' } }),
      row({ sequence: 3, jobs: { reference: 'JOB-3', title: 'Third', job_type: 'delivery', customer_name: 'Gamma', address_text: '3 Road' } }),
    ];
    const shuffled = [rows[2], rows[0], rows[1]];
    expect(buildShiftJobSummaries(rows)).toEqual(buildShiftJobSummaries(shuffled));
  });

  it('tolerates missing joined job data without crashing', () => {
    const summaries = buildShiftJobSummaries([
      row({ sequence: 1, jobs: null }),
      row({ sequence: 2, status: 'updated', jobs: null }),
    ]);
    expect(summaries['shift-a'].activeJobCount).toBe(2);
    expect(summaries['shift-a'].firstJob?.sequence).toBe(1);
    expect(summaries['shift-a'].firstJob?.reference).toBe('');
  });

  it('produces no active jobs for a shift with no active assignments', () => {
    expect(buildShiftJobSummaries([])).toEqual({});
    expect(buildShiftJobSummaries([row({ status: 'draft' })])).toEqual({});
    expect(emptyShiftJobSummary()).toEqual({ activeJobCount: 0, firstJob: null });
  });

  it('keeps separate shifts from contaminating one another', () => {
    const summaries = buildShiftJobSummaries([
      row({ shift_id: 'shift-a', sequence: 1 }),
      row({ shift_id: 'shift-b', sequence: 1 }),
      row({ shift_id: 'shift-b', sequence: 2, status: 'cancelled' }),
    ]);
    expect(summaries['shift-a'].activeJobCount).toBe(1);
    expect(summaries['shift-b'].activeJobCount).toBe(1);
    expect(summaries['shift-a'].firstJob).toEqual(summaries['shift-b'].firstJob);
  });
});

describe('firstJobDisplayLabel', () => {
  const firstJob = (overrides: Record<string, unknown> = {}) => ({
    sequence: 1,
    reference: 'JOB-102',
    title: 'Deliver goods',
    customerName: null as string | null,
    addressText: '',
    plannedArrivalAt: null as string | null,
    ...overrides,
  });

  it('shows reference with customer/site context', () => {
    expect(firstJobDisplayLabel(firstJob({ customerName: 'Acme Distribution' }))).toBe('JOB-102 · Acme Distribution');
  });

  it('shows reference with title context', () => {
    expect(firstJobDisplayLabel(firstJob({ title: 'Pallet drop' }))).toBe('JOB-102 · Pallet drop');
  });

  it('shows reference with shortened address context', () => {
    expect(firstJobDisplayLabel(firstJob({ title: '', addressText: '99 Industrial Estate, Longtown' }))).toBe('JOB-102 · 99 Industrial Estate, Longtown');
  });

  it('shows reference only when no context exists', () => {
    expect(firstJobDisplayLabel(firstJob({ title: '', addressText: '' }))).toBe('JOB-102');
  });

  it('prefers customer context over title and address', () => {
    expect(
      firstJobDisplayLabel(firstJob({ customerName: 'Acme', title: 'Pallet drop', addressText: '1 Road' }))
    ).toBe('JOB-102 · Acme');
  });

  it('tolerates missing joined job data without a dangling separator', () => {
    expect(firstJobDisplayLabel(firstJob({ reference: '', title: '', addressText: '', customerName: null }))).toBe('');
    expect(firstJobDisplayLabel(null)).toBe('');
    // Context present but reference missing.
    expect(firstJobDisplayLabel(firstJob({ reference: '', customerName: 'Acme' }))).toBe('Acme');
    // Reference present but context missing.
    expect(firstJobDisplayLabel(firstJob({ title: '', addressText: '' }))).toBe('JOB-102');
  });

  it('never renders a duplicated reference/context pair', () => {
    expect(firstJobDisplayLabel(firstJob({ customerName: 'JOB-102' }))).toBe('JOB-102');
  });
});

describe('formatPlannedArrivalTime', () => {
  it('formats an ISO timestamp as a local HH:mm time', () => {
    expect(formatPlannedArrivalTime(null)).toBe('');
    expect(formatPlannedArrivalTime('not-a-date')).toBe('');
    // 2026-08-07 09:30:00 local (no offset -> parsed as local wall time).
    expect(formatPlannedArrivalTime('2026-08-07T09:30:00')).toBe('09:30');
  });
});
