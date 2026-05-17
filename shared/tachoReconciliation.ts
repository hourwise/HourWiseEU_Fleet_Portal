export type SharedReconciliationStatus =
  | "matched"
  | "tacho_only"
  | "app_only"
  | "mismatch_activity"
  | "mismatch_duration"
  | "uncertain";

export interface SharedReconciliationActivity {
  id: string;
  startTime: string;
  endTime: string;
  activityType: "driving" | "work" | "poa" | "rest" | "break_rest";
}

export interface SharedReconciliationSession {
  startTime: string;
  drivingMins: number;
}

export interface SharedReconciliationItem {
  id: string;
  status: SharedReconciliationStatus;
  date: string;
  appLabel: string;
  tachoLabel: string;
  summary: string;
  appDrivingMins: number;
  tachoDrivingMins: number;
}

export interface SharedReconciliationSummary {
  matchedDays: number;
  tachoOnlyDays: number;
  appOnlyDays: number;
  mismatchDurationDays: number;
  mismatchActivityDays: number;
  uncertainDays: number;
  totalIssues: number;
}

interface DailyReconciliationBucket {
  date: string;
  appDrivingMins: number;
  tachoDrivingMins: number;
  appSessionCount: number;
  tachoSegmentCount: number;
}

function toMinutes(startTime: string, endTime: string) {
  return Math.max(0, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000));
}

function formatMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, totalMinutes);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function resolveStatus(bucket: DailyReconciliationBucket): SharedReconciliationStatus {
  if (bucket.appDrivingMins === 0 && bucket.tachoDrivingMins > 0) return "tacho_only";
  if (bucket.appDrivingMins > 0 && bucket.tachoDrivingMins === 0) return "app_only";
  if (Math.abs(bucket.appDrivingMins - bucket.tachoDrivingMins) >= 30) return "mismatch_duration";
  return "matched";
}

function buildSummary(status: SharedReconciliationStatus, bucket: DailyReconciliationBucket) {
  switch (status) {
    case "tacho_only":
      return `Tachograph recorded ${formatMinutes(bucket.tachoDrivingMins)} of driving with no matching app driving for the day.`;
    case "app_only":
      return `The app recorded ${formatMinutes(bucket.appDrivingMins)} of driving with no corresponding tachograph driving for the day.`;
    case "mismatch_duration":
      return `App and tachograph driving totals differ by ${formatMinutes(
        Math.abs(bucket.appDrivingMins - bucket.tachoDrivingMins)
      )} for the day.`;
    default:
      return "App and tachograph driving totals are aligned for the day.";
  }
}

export function buildSharedAppTachoReconciliationItems(
  activities: SharedReconciliationActivity[],
  workSessions: SharedReconciliationSession[]
): SharedReconciliationItem[] {
  if (activities.length === 0 && workSessions.length === 0) return [];

  const buckets = new Map<string, DailyReconciliationBucket>();

  const getBucket = (date: string) => {
    const existing = buckets.get(date);
    if (existing) return existing;

    const created: DailyReconciliationBucket = {
      date,
      appDrivingMins: 0,
      tachoDrivingMins: 0,
      appSessionCount: 0,
      tachoSegmentCount: 0,
    };
    buckets.set(date, created);
    return created;
  };

  for (const activity of activities) {
    if (activity.activityType !== "driving") continue;
    const bucket = getBucket(activity.startTime.slice(0, 10));
    bucket.tachoDrivingMins += toMinutes(activity.startTime, activity.endTime);
    bucket.tachoSegmentCount += 1;
  }

  for (const session of workSessions) {
    if (!session.startTime) continue;
    const bucket = getBucket(session.startTime.slice(0, 10));
    bucket.appDrivingMins += Math.max(0, session.drivingMins);
    bucket.appSessionCount += 1;
  }

  return Array.from(buckets.values())
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((bucket) => {
      const status = resolveStatus(bucket);
      return {
        id: `recon-${bucket.date}`,
        status,
        date: bucket.date,
        appLabel: `${formatMinutes(bucket.appDrivingMins)} driving in app`,
        tachoLabel: `${formatMinutes(bucket.tachoDrivingMins)} driving on tacho`,
        summary: buildSummary(status, bucket),
        appDrivingMins: bucket.appDrivingMins,
        tachoDrivingMins: bucket.tachoDrivingMins,
      };
    });
}

export function summarizeSharedReconciliation(
  items: SharedReconciliationItem[]
): SharedReconciliationSummary {
  return items.reduce<SharedReconciliationSummary>(
    (summary, item) => {
      switch (item.status) {
        case "matched":
          summary.matchedDays += 1;
          break;
        case "tacho_only":
          summary.tachoOnlyDays += 1;
          summary.totalIssues += 1;
          break;
        case "app_only":
          summary.appOnlyDays += 1;
          summary.totalIssues += 1;
          break;
        case "mismatch_duration":
          summary.mismatchDurationDays += 1;
          summary.totalIssues += 1;
          break;
        case "mismatch_activity":
          summary.mismatchActivityDays += 1;
          summary.totalIssues += 1;
          break;
        case "uncertain":
          summary.uncertainDays += 1;
          summary.totalIssues += 1;
          break;
      }
      return summary;
    },
    {
      matchedDays: 0,
      tachoOnlyDays: 0,
      appOnlyDays: 0,
      mismatchDurationDays: 0,
      mismatchActivityDays: 0,
      uncertainDays: 0,
      totalIssues: 0,
    }
  );
}
