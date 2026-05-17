import type { RuleActivitySegment } from './types';
import type { TachoActivity } from '../../compliance';
import {
  mergeAdjacentNormalizedActivities,
  toMs,
  type SharedNormalizedActivity,
} from '../../../../shared/tachoNormalization';

function toRuleActivityType(activityType: SharedNormalizedActivity['activityType']) {
  return activityType === 'break_rest' ? 'rest' : activityType;
}

export function toRuleActivities(
  activities: (TachoActivity & { id?: string; driver_id?: string | null; vehicle_id?: string | null; is_manual_entry?: boolean | null })[]
): RuleActivitySegment[] {
  return activities
    .map((activity, index) => ({
      id: activity.id ?? `raw-${index}-${activity.start_time}`,
      driverId: activity.driver_id ?? null,
      vehicleId: activity.vehicle_id ?? null,
      startTime: activity.start_time,
      endTime: activity.end_time,
      activityType: activity.activity_type,
      distanceKm: activity.distance_km ?? null,
      isManualEntry: Boolean(activity.is_manual_entry),
      source: 'raw_activity' as const,
    }))
    .filter((activity) => Number.isFinite(toMs(activity.startTime)) && Number.isFinite(toMs(activity.endTime)))
    .sort((a, b) => toMs(a.startTime) - toMs(b.startTime));
}

export function mergeAdjacentActivities(activities: RuleActivitySegment[]): RuleActivitySegment[] {
  const normalized: SharedNormalizedActivity[] = activities.map((activity) => ({
    id: activity.id,
    driverId: activity.driverId,
    vehicleId: activity.vehicleId,
    startTime: activity.startTime,
    endTime: activity.endTime,
    activityType: activity.activityType,
    durationMins: Math.max(0, Math.round((toMs(activity.endTime) - toMs(activity.startTime)) / 60000)),
    distanceKm: activity.distanceKm ?? null,
    label: activity.isManualEntry ? 'Manual entry' : undefined,
  }));

  return mergeAdjacentNormalizedActivities(normalized)
    .map<RuleActivitySegment | null>((activity) => {
      const activityType = toRuleActivityType(activity.activityType);
      if (activityType === 'unknown') return null;

      return {
        id: activity.id,
        driverId: activity.driverId,
        vehicleId: activity.vehicleId,
        startTime: activity.startTime,
        endTime: activity.endTime,
        activityType,
        distanceKm: activity.distanceKm ?? null,
        isManualEntry: activity.label === 'Manual entry',
        source: 'raw_activity' as const,
      };
    })
    .filter((activity): activity is RuleActivitySegment => activity !== null);
}
