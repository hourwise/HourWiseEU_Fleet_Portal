export function durationSecondsBetween(start: Date, end: Date) {
  const durationMilliseconds = end.getTime() - start.getTime();
  if (!Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0) return 0;
  return Math.round(durationMilliseconds / 1000);
}

export function formatDurationSeconds(value: number) {
  const totalSeconds = Math.max(0, Math.round(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

export type ReportTimeResolution = 'minute' | 'second';

export function inferReportTimeResolution(
  activities: Array<{ startTime: string; endTime: string; label?: string }>
): ReportTimeResolution {
  if (activities.some((activity) => activity.label?.includes('EF 0504'))) return 'minute';

  return activities.some((activity) =>
    [activity.startTime, activity.endTime].some((timestamp) => {
      const milliseconds = new Date(timestamp).getTime();
      return Number.isFinite(milliseconds) && milliseconds % 60_000 !== 0;
    })
  )
    ? 'second'
    : 'minute';
}
