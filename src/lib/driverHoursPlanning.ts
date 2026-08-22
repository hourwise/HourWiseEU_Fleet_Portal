export type HoursPlanningShift = { driverId: string; date: string; startTime: string; endTime: string; status: string };
export type HoursPlanningSession = { driverId: string; date: string; startTime: string; endTime: string | null; totalWorkMinutes: number | null };

export type DriverHoursPlanningForecast = {
  driverId: string;
  actualMinutes: number;
  plannedMinutes: number;
  totalMinutes: number;
  plannedDutyCount: number;
  restReview: 'not_assessed' | 'needs_review' | 'no_conflict_seen';
  regime: 'unknown';
};

export function buildDriverHoursPlanningForecast(
  shifts: readonly HoursPlanningShift[],
  sessions: readonly HoursPlanningSession[],
): DriverHoursPlanningForecast[] {
  const driverIds = new Set([...shifts.map(shift => shift.driverId), ...sessions.map(session => session.driverId)]);
  return [...driverIds].sort().map(driverId => {
    const driverShifts = shifts.filter(shift => shift.driverId === driverId && shift.status !== 'cancelled');
    const driverSessions = sessions.filter(session => session.driverId === driverId);
    const actualMinutes = driverSessions.reduce((total, session) => total + (session.totalWorkMinutes ?? durationMinutes(session.startTime, session.endTime)), 0);
    const plannedMinutes = driverShifts.reduce((total, shift) => total + durationMinutes(shift.startTime, shift.endTime), 0);
    const ordered = [...driverShifts].sort((left, right) => `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`));
    const overlap = ordered.some((shift, index) => {
      const next = ordered[index + 1];
      return Boolean(next && `${shift.date}T${shift.endTime}` > `${next.date}T${next.startTime}`);
    });
    return { driverId, actualMinutes, plannedMinutes, totalMinutes: actualMinutes + plannedMinutes, plannedDutyCount: driverShifts.length, restReview: overlap ? 'needs_review' : ordered.length > 1 ? 'no_conflict_seen' : 'not_assessed', regime: 'unknown' };
  });
}

function durationMinutes(startTime: string, endTime: string | null): number {
  if (!endTime) return 0;
  const [startHours, startMinutes] = startTime.slice(0, 5).split(':').map(Number);
  const [endHours, endMinutes] = endTime.slice(0, 5).split(':').map(Number);
  const start = startHours * 60 + startMinutes;
  const end = endHours * 60 + endMinutes;
  return end >= start ? end - start : (24 * 60 - start) + end;
}
