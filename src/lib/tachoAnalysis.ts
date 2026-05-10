import { TachoActivity, WorkSession } from './compliance';
import { differenceInMinutes } from 'date-fns';

export interface MissingMileageGap {
  start: string;
  end: string;
  durationMins: number;
  distanceKm: number;
}

/**
 * Identifies periods where the vehicle was moving (driving) but no app work session exists.
 */
export function detectMissingMileage(
  tachoActivities: TachoActivity[],
  workSessions: WorkSession[]
): MissingMileageGap[] {
  const gaps: MissingMileageGap[] = [];

  // Filter only driving activities
  const drivingPeriods = tachoActivities.filter(a => a.activity_type === 'driving');

  for (const drive of drivingPeriods) {
    const driveStart = new Date(drive.start_time);
    const driveEnd = new Date(drive.end_time);

    // Check if this drive overlaps with any app session
    const isCovered = workSessions.some(session => {
      const sessionStart = new Date(session.start_time);
      const sessionEnd = session.end_time ? new Date(session.end_time) : new Date();

      // Allow a 5-minute buffer for logging in/out
      return (
        (driveStart >= new Date(sessionStart.getTime() - 5*60000) && driveStart <= new Date(sessionEnd.getTime() + 5*60000)) ||
        (driveEnd >= new Date(sessionStart.getTime() - 5*60000) && driveEnd <= new Date(sessionEnd.getTime() + 5*60000))
      );
    });

    if (!isCovered) {
      gaps.push({
        start: drive.start_time,
        end: drive.end_time,
        durationMins: differenceInMinutes(driveEnd, driveStart),
        distanceKm: drive.distance_km || 0
      });
    }
  }

  return gaps;
}
