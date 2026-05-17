import {
  buildSharedDaySummaries,
  buildSharedDutyWindows,
  minutesBetween,
  type SharedNormalizedActivity,
} from '../../../../shared/tachoNormalization';
import type { RuleActivitySegment, RuleDutyWindow, TachoDaySummary } from './types';

function toRuleActivityType(activityType: SharedNormalizedActivity['activityType']) {
  return activityType === 'break_rest' ? 'rest' : activityType;
}

function toSharedActivities(activities: RuleActivitySegment[]): SharedNormalizedActivity[] {
  return activities.map((activity) => ({
    id: activity.id,
    driverId: activity.driverId,
    vehicleId: activity.vehicleId,
    startTime: activity.startTime,
    endTime: activity.endTime,
    activityType: activity.activityType,
    durationMins: minutesBetween(activity.startTime, activity.endTime),
    distanceKm: activity.distanceKm ?? null,
    label: activity.isManualEntry ? 'Manual entry' : undefined,
  }));
}

export function buildDutyWindows(activities: RuleActivitySegment[]): RuleDutyWindow[] {
  return buildSharedDutyWindows(toSharedActivities(activities)).map((window) => ({
    id: window.id,
    driverId: window.driverId ?? null,
    vehicleId: window.vehicleId ?? null,
    dutyDate: window.dutyDate,
    dutyStart: window.dutyStart,
    dutyEnd: window.dutyEnd,
    activities: window.activities
      .map<RuleActivitySegment | null>((activity) => {
        const activityType = toRuleActivityType(activity.activityType);
        if (activityType === 'unknown') return null;

        return {
          id: activity.id,
          driverId: activity.driverId ?? null,
          vehicleId: activity.vehicleId ?? null,
          startTime: activity.startTime,
          endTime: activity.endTime,
          activityType,
          distanceKm: activity.distanceKm ?? null,
          isManualEntry: activity.label === 'Manual entry',
          source: 'raw_activity' as const,
        };
      })
      .filter((activity): activity is RuleActivitySegment => activity !== null),
    drivingMins: window.drivingMins,
    workMins: window.workMins,
    poaMins: window.poaMins,
    restMins: window.restMins,
  }));
}

export function buildDaySummariesFromDutyWindows(dutyWindows: RuleDutyWindow[]): TachoDaySummary[] {
  return buildSharedDaySummaries(
    dutyWindows.map((window) => ({
      id: window.id,
      driverId: window.driverId ?? null,
      vehicleId: window.vehicleId ?? null,
      dutyDate: window.dutyDate,
      dutyStart: window.dutyStart,
      dutyEnd: window.dutyEnd,
      activities: window.activities.map((activity) => ({
        id: activity.id,
        driverId: activity.driverId ?? null,
        vehicleId: activity.vehicleId ?? null,
        startTime: activity.startTime,
        endTime: activity.endTime,
        activityType: activity.activityType,
        durationMins: minutesBetween(activity.startTime, activity.endTime),
        distanceKm: activity.distanceKm ?? null,
        label: activity.isManualEntry ? 'Manual entry' : undefined,
      })),
      drivingMins: window.drivingMins,
      workMins: window.workMins,
      poaMins: window.poaMins,
      restMins: window.restMins,
    }))
  ).map((summary) => ({
    date: summary.date,
    drivingMins: summary.drivingMins,
    workMins: summary.workMins,
    poaMins: summary.poaMins,
    restMins: summary.restMins,
    findingsCount: 0,
    activities: summary.activities.map((activity) => ({
      id: activity.id,
      source: 'driver_card',
      activityType: activity.activityType === 'rest' ? 'break_rest' : activity.activityType,
      driverId: activity.driverId,
      vehicleId: activity.vehicleId,
      startTime: activity.startTime,
      endTime: activity.endTime,
      durationMins: activity.durationMins,
      distanceKm: activity.distanceKm ?? undefined,
      label: activity.label,
    })),
  }));
}
