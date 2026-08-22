import { addDays, format, parseISO } from 'date-fns';
import { TACHO_RULE_LIMITS } from './tacho/rules/constants';

export type PlanningRegime = 'assimilated_aetr' | 'gb_domestic' | 'other_not_applicable' | 'unknown';
export type PlanningSlot = {
  id: string;
  slot_date: string;
  role_label: string;
  start_time: string;
  end_time: string;
  required_headcount: number;
  status: string;
  updated_at: string;
};
export type PlanningAssignment = {
  id: string;
  slot_id: string;
  driver_id: string;
  shift_id: string | null;
  vehicle_id: string | null;
  trailer_id: string | null;
  status: string;
};
export type PlanningAvailability = {
  id: string;
  driver_id: string;
  availability_type: 'annual_leave' | 'sickness' | 'training' | 'unavailable' | 'other';
  starts_on: string;
  ends_on: string;
  note: string | null;
};

export type CoverageRow = {
  key: string;
  roleLabel: string;
  startTime: string;
  endTime: string;
  cells: Record<string, { slot: PlanningSlot | null; required: number; filled: number; vacancies: number }>;
};

export function planningDates(fromDate: string, toDate: string): string[] {
  const start = parseISO(fromDate);
  const end = parseISO(toDate);
  const dates: string[] = [];
  for (let value = start; value <= end; value = addDays(value, 1)) dates.push(format(value, 'yyyy-MM-dd'));
  return dates;
}

export function buildCoverageRows(
  slots: readonly PlanningSlot[],
  assignments: readonly PlanningAssignment[],
  dates: readonly string[],
): CoverageRow[] {
  const activeAssignments = assignments.filter((assignment) => assignment.status !== 'cancelled');
  const groups = new Map<string, CoverageRow>();
  for (const slot of slots.filter((entry) => entry.status !== 'cancelled')) {
    const key = `${slot.role_label}\u0000${slot.start_time}\u0000${slot.end_time}`;
    const row = groups.get(key) ?? {
      key,
      roleLabel: slot.role_label,
      startTime: slot.start_time,
      endTime: slot.end_time,
      cells: Object.fromEntries(dates.map((date) => [date, { slot: null, required: 0, filled: 0, vacancies: 0 }])),
    };
    const filled = activeAssignments.filter((assignment) => assignment.slot_id === slot.id).length;
    row.cells[slot.slot_date] = {
      slot,
      required: slot.required_headcount,
      filled,
      vacancies: Math.max(slot.required_headcount - filled, 0),
    };
    groups.set(key, row);
  }
  return [...groups.values()].sort((left, right) => left.startTime.localeCompare(right.startTime) || left.roleLabel.localeCompare(right.roleLabel));
}

export function availabilityForDate(
  availability: readonly PlanningAvailability[],
  driverId: string,
  date: string,
): PlanningAvailability | null {
  return availability.find((entry) => entry.driver_id === driverId && entry.starts_on <= date && entry.ends_on >= date) ?? null;
}

export function availabilityLabel(type: PlanningAvailability['availability_type']): string {
  return ({ annual_leave: 'Holiday', sickness: 'Sick', training: 'Training', unavailable: 'Unavailable', other: 'Other' })[type];
}

export type CandidateAssessment = {
  group: 'available' | 'needs_review' | 'unavailable';
  label: string;
  reason: string;
  restMinutes: number | null;
};

export function assessCandidate(input: {
  driverId: string;
  slot: PlanningSlot;
  allSlots: readonly PlanningSlot[];
  assignments: readonly PlanningAssignment[];
  availability: readonly PlanningAvailability[];
  regime: PlanningRegime;
}): CandidateAssessment {
  const unavailable = availabilityForDate(input.availability, input.driverId, input.slot.slot_date);
  if (unavailable) return { group: 'unavailable', label: availabilityLabel(unavailable.availability_type), reason: unavailable.note ?? availabilityLabel(unavailable.availability_type), restMinutes: null };

  const duties = input.assignments
    .filter((assignment) => assignment.driver_id === input.driverId && assignment.status !== 'cancelled' && assignment.slot_id !== input.slot.id)
    .map((assignment) => input.allSlots.find((slot) => slot.id === assignment.slot_id))
    .filter((slot): slot is PlanningSlot => Boolean(slot));
  const targetStart = dutyStart(input.slot);
  const targetEnd = dutyEnd(input.slot);
  if (duties.some((duty) => dutyStart(duty) < targetEnd && dutyEnd(duty) > targetStart)) {
    return { group: 'unavailable', label: 'Conflict', reason: 'Overlaps another planned duty', restMinutes: 0 };
  }
  const previous = duties.filter((duty) => dutyEnd(duty) <= targetStart).sort((left, right) => dutyEnd(right).getTime() - dutyEnd(left).getTime())[0];
  const restMinutes = previous ? Math.floor((targetStart.getTime() - dutyEnd(previous).getTime()) / 60_000) : null;
  if (input.regime !== 'assimilated_aetr') {
    return { group: 'needs_review', label: 'Rules need confirming', reason: 'Operating regime is not confirmed for planning', restMinutes };
  }
  if (restMinutes !== null && restMinutes < TACHO_RULE_LIMITS.DAILY_REST_REDUCED_MINS) {
    return { group: 'unavailable', label: 'Cannot currently fit', reason: `Only ${formatDuration(restMinutes)} rest before duty`, restMinutes };
  }
  if (restMinutes !== null && restMinutes < TACHO_RULE_LIMITS.DAILY_REST_REGULAR_MINS) {
    return { group: 'needs_review', label: 'Reduced daily rest', reason: `${formatDuration(restMinutes)} rest before duty`, restMinutes };
  }
  return { group: 'available', label: 'Available', reason: restMinutes === null ? 'No earlier planned duty in view' : `${formatDuration(restMinutes)} rest before duty`, restMinutes };
}

export function plannedMinutesForDriver(
  driverId: string,
  slots: readonly PlanningSlot[],
  assignments: readonly PlanningAssignment[],
): number {
  return assignments.filter((entry) => entry.driver_id === driverId && entry.status !== 'cancelled').reduce((total, assignment) => {
    const slot = slots.find((entry) => entry.id === assignment.slot_id);
    return total + (slot ? Math.round((dutyEnd(slot).getTime() - dutyStart(slot).getTime()) / 60_000) : 0);
  }, 0);
}

export function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

function dutyStart(slot: PlanningSlot): Date {
  return new Date(`${slot.slot_date}T${slot.start_time.slice(0, 8)}`);
}

function dutyEnd(slot: PlanningSlot): Date {
  const start = dutyStart(slot);
  const end = new Date(`${slot.slot_date}T${slot.end_time.slice(0, 8)}`);
  return end > start ? end : addDays(end, 1);
}
