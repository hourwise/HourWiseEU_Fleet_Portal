import { describe, expect, it } from 'vitest';
import { assessCandidate, buildCoverageRows, planningDates, type PlanningAssignment, type PlanningSlot } from './planningWorkspace';
import { buildBatch23PlanningFixture } from './batch23PlanningFixture';

const slots: PlanningSlot[] = [
  { id: 'day', slot_date: '2026-08-24', role_label: 'Day Driver', start_time: '06:00:00', end_time: '15:00:00', required_headcount: 2, status: 'partially_filled', updated_at: '2026-08-22T10:00:00Z' },
  { id: 'night', slot_date: '2026-08-24', role_label: 'Night Driver', start_time: '18:00:00', end_time: '03:00:00', required_headcount: 1, status: 'filled', updated_at: '2026-08-22T10:00:00Z' },
  { id: 'next-day', slot_date: '2026-08-25', role_label: 'Day Driver', start_time: '06:00:00', end_time: '15:00:00', required_headcount: 2, status: 'open', updated_at: '2026-08-22T10:00:00Z' },
];
const assignments: PlanningAssignment[] = [
  { id: 'a1', slot_id: 'day', driver_id: 'driver-1', shift_id: 'shift-1', vehicle_id: 'vehicle-1', trailer_id: 'trailer-1', status: 'planned' },
  { id: 'a2', slot_id: 'night', driver_id: 'driver-2', shift_id: 'shift-2', vehicle_id: 'vehicle-2', trailer_id: null, status: 'planned' },
];

describe('Batch 23 planning workspace model', () => {
  it('builds dense coverage counts and vacancies', () => {
    const dates = planningDates('2026-08-24', '2026-08-25');
    const rows = buildCoverageRows(slots, assignments, dates);
    expect(rows.find((row) => row.roleLabel === 'Day Driver')?.cells['2026-08-24']).toMatchObject({ required: 2, filled: 1, vacancies: 1 });
    expect(rows.find((row) => row.roleLabel === 'Day Driver')?.cells['2026-08-25']).toMatchObject({ required: 2, filled: 0, vacancies: 2 });
  });

  it('keeps unknown regimes explicit and leave unavailable', () => {
    expect(assessCandidate({ driverId: 'driver-3', slot: slots[2], allSlots: slots, assignments, availability: [], regime: 'unknown' })).toMatchObject({ group: 'needs_review', label: 'Rules need confirming' });
    expect(assessCandidate({ driverId: 'driver-3', slot: slots[2], allSlots: slots, assignments, availability: [{ id: 'leave', driver_id: 'driver-3', availability_type: 'annual_leave', starts_on: '2026-08-24', ends_on: '2026-08-30', note: null }], regime: 'unknown' })).toMatchObject({ group: 'unavailable', label: 'Holiday' });
  });

  it('handles overnight duties when forecasting rest', () => {
    const result = assessCandidate({ driverId: 'driver-2', slot: slots[2], allSlots: slots, assignments, availability: [], regime: 'assimilated_aetr' });
    expect(result.restMinutes).toBe(180);
    expect(result.group).toBe('unavailable');
  });

  it('covers the deterministic 25-driver acceptance workflow without 175 shift forms', () => {
    const fixture = buildBatch23PlanningFixture();
    const dates = planningDates('2026-08-24', '2026-08-30');
    const coverage = buildCoverageRows(fixture.slots, fixture.assignments, dates);
    expect(fixture.drivers).toHaveLength(25);
    expect(fixture.slots).toHaveLength(28);
    expect(fixture.slots.reduce((total, slot) => total + slot.required_headcount, 0)).toBe(161);
    expect(coverage).toHaveLength(4);
    expect(coverage.reduce((total, row) => total + dates.reduce((sum, date) => sum + row.cells[date].vacancies, 0), 0)).toBe(10);
    expect(fixture.runs.map((run) => run.jobIds.length)).toEqual([4, 4, 4]);
    expect(assessCandidate({ driverId: 'driver-01', slot: fixture.slots[0], allSlots: fixture.slots, assignments: fixture.assignments, availability: fixture.availability, regime: 'unknown' })).toMatchObject({ group: 'unavailable', label: 'Holiday' });
    expect(new Set(fixture.assignments.filter((entry) => entry.slot_id === fixture.slots[0].id).map((entry) => entry.vehicle_id)).size).toBe(fixture.assignments.filter((entry) => entry.slot_id === fixture.slots[0].id).length);
  });
});
