import type { PlanningAssignment, PlanningAvailability, PlanningRegime, PlanningSlot } from './planningWorkspace';

export type PlanningDomain = 'core' | 'drivers' | 'vehicles' | 'jobs' | 'recordedHours';
export type DomainResult<T> = { data: T; error: Error | null };

export type PlanningLoadResult<Core, Driver, Vehicle, Job, Hours> = {
  core: DomainResult<Core>;
  drivers: DomainResult<Driver[]>;
  vehicles: DomainResult<Vehicle[]>;
  jobs: DomainResult<Job[]>;
  recordedHours: DomainResult<Hours[]>;
};

export async function loadPlanningDomains<Core, Driver, Vehicle, Job, Hours>(loaders: {
  core: () => Promise<DomainResult<Core>>;
  drivers: () => Promise<DomainResult<Driver[]>>;
  vehicles: () => Promise<DomainResult<Vehicle[]>>;
  jobs: () => Promise<DomainResult<Job[]>>;
  recordedHours: () => Promise<DomainResult<Hours[]>>;
}): Promise<PlanningLoadResult<Core, Driver, Vehicle, Job, Hours>> {
  const settled = await Promise.allSettled([
    loaders.core(), loaders.drivers(), loaders.vehicles(), loaders.jobs(), loaders.recordedHours(),
  ]);
  const unwrap = <T>(result: PromiseSettledResult<DomainResult<T>>, fallback: T): DomainResult<T> =>
    result.status === 'fulfilled' ? result.value : { data: fallback, error: toError(result.reason) };
  return {
    core: unwrap(settled[0], null as Core),
    drivers: unwrap(settled[1], [] as Driver[]),
    vehicles: unwrap(settled[2], [] as Vehicle[]),
    jobs: unwrap(settled[3], [] as Job[]),
    recordedHours: unwrap(settled[4], [] as Hours[]),
  };
}

export type BulkCandidateStatus = 'READY' | 'NEEDS_REVIEW' | 'UNAVAILABLE' | 'CONFLICT';
export type BulkCandidate = {
  driverId: string;
  slotId: string;
  date: string;
  status: BulkCandidateStatus;
  reason: string;
};

export function buildBulkAssignmentPreview(input: {
  driverIds: readonly string[];
  slotIds: readonly string[];
  slots: readonly PlanningSlot[];
  assignments: readonly PlanningAssignment[];
  availability: readonly PlanningAvailability[];
  regimes: Readonly<Record<string, PlanningRegime>>;
}): BulkCandidate[] {
  const active = input.assignments.filter((assignment) => assignment.status !== 'cancelled');
  const workingAssignments = [...active];
  const filledBySlot = new Map(input.slots.map((slot) => [
    slot.id,
    active.filter((assignment) => assignment.slot_id === slot.id).length,
  ]));
  const output: BulkCandidate[] = [];

  for (const slotId of input.slotIds) {
    const slot = input.slots.find((entry) => entry.id === slotId);
    if (!slot) continue;
    for (const driverId of input.driverIds) {
      let status: BulkCandidateStatus = 'READY';
      let reason = 'Ready';
      if (input.availability.some((entry) => entry.driver_id === driverId && entry.starts_on <= slot.slot_date && entry.ends_on >= slot.slot_date)) {
        status = 'UNAVAILABLE'; reason = 'Holiday or other absence';
      } else if (workingAssignments.some((entry) => entry.driver_id === driverId && entry.slot_id === slot.id)) {
        status = 'CONFLICT'; reason = 'Already assigned';
      } else if ((filledBySlot.get(slot.id) ?? 0) >= slot.required_headcount) {
        status = 'UNAVAILABLE'; reason = 'No vacancy remains';
      } else if (workingAssignments.some((entry) => {
        if (entry.driver_id !== driverId) return false;
        const occupied = input.slots.find((candidate) => candidate.id === entry.slot_id);
        return occupied ? dutiesOverlap(occupied, slot) : false;
      })) {
        status = 'CONFLICT'; reason = 'Overlaps another duty';
      } else if ((input.regimes[driverId] ?? 'unknown') === 'unknown') {
        status = 'NEEDS_REVIEW'; reason = 'Rules need confirming';
      }
      output.push({ driverId, slotId: slot.id, date: slot.slot_date, status, reason });
      if (status === 'READY' || status === 'NEEDS_REVIEW') {
        workingAssignments.push({ id: `preview:${slot.id}:${driverId}`, slot_id: slot.id, driver_id: driverId, shift_id: null, vehicle_id: null, trailer_id: null, status: 'planned' });
        filledBySlot.set(slot.id, (filledBySlot.get(slot.id) ?? 0) + 1);
      }
    }
  }
  return output;
}

function dutiesOverlap(left: PlanningSlot, right: PlanningSlot): boolean {
  const range = (slot: PlanningSlot) => {
    const start = new Date(`${slot.slot_date}T${slot.start_time.slice(0, 8)}`);
    const end = new Date(`${slot.slot_date}T${slot.end_time.slice(0, 8)}`);
    if (end <= start) end.setDate(end.getDate() + 1);
    return { start, end };
  };
  const a = range(left); const b = range(right);
  return a.start < b.end && a.end > b.start;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error('Planning data could not be loaded');
}
