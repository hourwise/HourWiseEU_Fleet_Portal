import { describe, expect, it } from 'vitest';
import {
  buildShiftJobSummaries,
  emptyShiftJobSummary,
  firstJobDestinationLabel,
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

describe('firstJobDestinationLabel', () => {
  it('prefers customer/site name over title, address and reference', () => {
    const firstJob = {
      sequence: 1,
      reference: 'JOB-9',
      title: 'Deliver goods',
      customerName: 'Acme Distribution',
      addressText: '99 Industrial Estate, Longtown',
      plannedArrivalAt: null,
    };
    expect(firstJobDestinationLabel(firstJob)).toBe('Acme Distribution');
  });

  it('falls back to title, then address, then reference', () => {
    expect(firstJobDestinationLabel({ sequence: 1, reference: 'JOB-1', title: 'Pallet drop', customerName: null, addressText: '2 Road', plannedArrivalAt: null })).toBe('Pallet drop');
    expect(firstJobDestinationLabel({ sequence: 1, reference: 'JOB-1', title: '', customerName: null, addressText: '3 High Street', plannedArrivalAt: null })).toBe('3 High Street');
    expect(firstJobDestinationLabel({ sequence: 1, reference: 'JOB-1', title: '', customerName: null, addressText: '', plannedArrivalAt: null })).toBe('JOB-1');
  });

  it('returns empty string when there is no first job', () => {
    expect(firstJobDestinationLabel(null)).toBe('');
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
