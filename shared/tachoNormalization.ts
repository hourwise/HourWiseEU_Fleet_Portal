export type SharedNormalizedActivityType = 'driving' | 'work' | 'poa' | 'rest' | 'break_rest' | 'unknown';

export type SharedNormalizedActivity = {
  id: string;
  driverId?: string | null;
  vehicleId?: string | null;
  startTime: string;
  endTime: string;
  activityType: SharedNormalizedActivityType;
  durationMins: number;
  distanceKm?: number | null;
  label?: string;
};

export type SharedDutyWindow = {
  id: string;
  driverId?: string | null;
  vehicleId?: string | null;
  dutyDate: string;
  dutyStart: string;
  dutyEnd: string;
  activities: SharedNormalizedActivity[];
  drivingMins: number;
  workMins: number;
  poaMins: number;
  restMins: number;
};

export type SharedDaySummary = {
  date: string;
  drivingMins: number;
  workMins: number;
  poaMins: number;
  restMins: number;
  activities: SharedNormalizedActivity[];
};

export function toMs(value: string) {
  return new Date(value).getTime();
}

export function minutesBetween(start: string, end: string) {
  return Math.max(0, Math.round((toMs(end) - toMs(start)) / 60000));
}

export function mergeAdjacentNormalizedActivities(
  activities: SharedNormalizedActivity[]
): SharedNormalizedActivity[] {
  if (activities.length === 0) return [];

  const ordered = [...activities].sort((a, b) => toMs(a.startTime) - toMs(b.startTime));
  const merged: SharedNormalizedActivity[] = [];

  for (const activity of ordered) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.activityType === activity.activityType &&
      previous.driverId === activity.driverId &&
      previous.vehicleId === activity.vehicleId &&
      previous.endTime === activity.startTime
    ) {
      previous.endTime = activity.endTime;
      previous.durationMins += activity.durationMins;
      previous.distanceKm = (previous.distanceKm ?? 0) + (activity.distanceKm ?? 0);
      previous.label = previous.label || activity.label;
      continue;
    }

    merged.push({ ...activity });
  }

  return merged;
}

export function summarizeNormalizedActivities(activities: SharedNormalizedActivity[]) {
  return activities.reduce(
    (summary, activity) => {
      const mins = activity.durationMins;
      if (activity.activityType === 'driving') summary.drivingMins += mins;
      if (activity.activityType === 'work') summary.workMins += mins;
      if (activity.activityType === 'poa') summary.poaMins += mins;
      if (activity.activityType === 'rest' || activity.activityType === 'break_rest') summary.restMins += mins;
      return summary;
    },
    { drivingMins: 0, workMins: 0, poaMins: 0, restMins: 0 }
  );
}

export function buildSharedDutyWindows(activities: SharedNormalizedActivity[]): SharedDutyWindow[] {
  const byDate = new Map<string, SharedNormalizedActivity[]>();

  for (const activity of activities) {
    const date = activity.startTime.slice(0, 10);
    const bucket = byDate.get(date) ?? [];
    bucket.push(activity);
    byDate.set(date, bucket);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayActivities]) => {
      const ordered = [...dayActivities].sort((a, b) => toMs(a.startTime) - toMs(b.startTime));
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      const totals = summarizeNormalizedActivities(ordered);

      return {
        id: `duty-${date}`,
        driverId: first?.driverId ?? null,
        vehicleId: first?.vehicleId ?? null,
        dutyDate: date,
        dutyStart: first?.startTime ?? `${date}T00:00:00.000Z`,
        dutyEnd: last?.endTime ?? `${date}T23:59:59.000Z`,
        activities: ordered,
        drivingMins: totals.drivingMins,
        workMins: totals.workMins,
        poaMins: totals.poaMins,
        restMins: totals.restMins,
      };
    });
}

export function buildSharedDaySummaries(dutyWindows: SharedDutyWindow[]): SharedDaySummary[] {
  return dutyWindows.map((window) => ({
    date: window.dutyDate,
    drivingMins: window.drivingMins,
    workMins: window.workMins,
    poaMins: window.poaMins,
    restMins: window.restMins,
    activities: window.activities,
  }));
}
