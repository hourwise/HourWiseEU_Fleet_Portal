import type { PlanningAssignment, PlanningAvailability, PlanningSlot } from './planningWorkspace';

export type Batch23PlanningFixture = {
  drivers: Array<{ id: string; name: string }>;
  slots: PlanningSlot[];
  assignments: PlanningAssignment[];
  availability: PlanningAvailability[];
  jobs: Array<{ id: string; reference: string }>;
  runs: Array<{ id: string; jobIds: string[] }>;
};

/** Deterministic 25-driver acceptance fixture; no production data or inferred route values. */
export function buildBatch23PlanningFixture(): Batch23PlanningFixture {
  const drivers = Array.from({ length: 25 }, (_, index) => ({
    id: `driver-${String(index + 1).padStart(2, '0')}`,
    name: index === 0 ? 'Bob Smith' : `Test Driver ${String(index + 1).padStart(2, '0')}`,
  }));
  const requirements = [
    { role: 'Day Driver', start: '06:00:00', end: '15:00:00', headcount: 12 },
    { role: 'Night Driver', start: '18:00:00', end: '03:00:00', headcount: 8 },
    { role: 'Shunter', start: '06:00:00', end: '18:00:00', headcount: 1 },
    { role: 'Standby', start: '06:00:00', end: '18:00:00', headcount: 2 },
  ];
  const slots = Array.from({ length: 7 }, (_, dayIndex) => requirements.map((requirement, requirementIndex): PlanningSlot => ({
    id: `slot-${dayIndex + 1}-${requirementIndex + 1}`,
    slot_date: `2026-08-${String(24 + dayIndex).padStart(2, '0')}`,
    role_label: requirement.role,
    start_time: requirement.start,
    end_time: requirement.end,
    required_headcount: requirement.headcount,
    status: 'open',
    updated_at: '2026-08-22T12:00:00Z',
  }))).flat();
  const assignments = slots.flatMap((slot, slotIndex) => Array.from({ length: Math.max(slot.required_headcount - (slotIndex % 3 === 0 ? 1 : 0), 0) }, (_, position): PlanningAssignment => ({
    id: `assignment-${slot.id}-${position + 1}`,
    slot_id: slot.id,
    driver_id: drivers[(slotIndex + position + 1) % drivers.length].id,
    shift_id: `shift-${slot.id}-${position + 1}`,
    vehicle_id: `vehicle-${String(position + 1).padStart(2, '0')}`,
    trailer_id: position % 2 === 0 ? `trailer-${String(position + 1).padStart(2, '0')}` : null,
    status: 'planned',
  })));
  const jobs = Array.from({ length: 12 }, (_, index) => ({ id: `job-${index + 1}`, reference: `JOB-${1044 + index}` }));
  return {
    drivers,
    slots,
    assignments,
    availability: [{ id: 'bob-holiday', driver_id: 'driver-01', availability_type: 'annual_leave', starts_on: '2026-08-24', ends_on: '2026-09-06', note: 'Annual leave' }],
    jobs,
    runs: [{ id: 'run-01', jobIds: jobs.slice(0, 4).map((job) => job.id) }, { id: 'run-02', jobIds: jobs.slice(4, 8).map((job) => job.id) }, { id: 'run-03', jobIds: jobs.slice(8).map((job) => job.id) }],
  };
}
