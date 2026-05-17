export type SharedTachoRuleCode =
  | 'DRV_CONTINUOUS_4H30_EXCEEDED'
  | 'DRV_DAILY_9H_EXCEEDED'
  | 'DRV_DAILY_10H_EXCEEDED'
  | 'DRV_WEEKLY_56H_EXCEEDED'
  | 'DRV_FORTNIGHT_90H_EXCEEDED'
  | 'REST_DAILY_UNDER_9H'
  | 'REST_DAILY_REDUCED'
  | 'REST_WEEKLY_UNDER_24H'
  | 'REST_WEEKLY_REDUCED'
  | 'WTD_BREAK_AFTER_6H_MISSING'
  | 'WTD_BREAK_AFTER_9H_MISSING'
  | 'DATA_INVALID_ACTIVITY'
  | 'DATA_OVERLAPPING_ACTIVITY'
  | 'DISC_APP_TACHO_MISMATCH'
  | 'VU_OVERSPEED'
  | 'VU_MOTION_CONFLICT'
  | 'VU_POWER_INTERRUPTION'
  | 'VU_DRIVING_WITHOUT_CARD'
  | 'VU_CARD_INSERTION_WHILE_DRIVING'
  | 'VU_CARD_CONFLICT'
  | 'VU_SENSOR_FAULT'
  | 'VU_SECURITY_FAULT'
  | 'VU_CALIBRATION_EVENT';

export const TACHO_RULE_LIMITS = {
  CONTINUOUS_DRIVING_MINS: 270,
  DAILY_DRIVING_REGULAR_MINS: 540,
  DAILY_DRIVING_EXTENDED_MINS: 600,
  WEEKLY_DRIVING_MINS: 3360,
  FORTNIGHTLY_DRIVING_MINS: 5400,
  DAILY_REST_REGULAR_MINS: 660,
  DAILY_REST_REDUCED_MINS: 540,
  WEEKLY_REST_REDUCED_MINS: 1440,
  WEEKLY_REST_REGULAR_MINS: 2700,
  WTD_BREAK_AFTER_6H_WORK_MINS: 30,
  WTD_BREAK_AFTER_9H_WORK_MINS: 45,
} as const;

export const TACHO_RULE_TITLES: Record<SharedTachoRuleCode, string> = {
  DRV_CONTINUOUS_4H30_EXCEEDED: 'Continuous driving exceeded 4.5 hours',
  DRV_DAILY_9H_EXCEEDED: 'Daily driving exceeded 9 hours',
  DRV_DAILY_10H_EXCEEDED: 'Daily driving exceeded 10 hours',
  DRV_WEEKLY_56H_EXCEEDED: 'Weekly driving exceeded 56 hours',
  DRV_FORTNIGHT_90H_EXCEEDED: 'Fortnightly driving exceeded 90 hours',
  REST_DAILY_UNDER_9H: 'Daily rest below 9 hours',
  REST_DAILY_REDUCED: 'Reduced daily rest taken',
  REST_WEEKLY_UNDER_24H: 'Weekly rest below 24 hours',
  REST_WEEKLY_REDUCED: 'Reduced weekly rest taken',
  WTD_BREAK_AFTER_6H_MISSING: 'Break requirement after 6 hours of work not met',
  WTD_BREAK_AFTER_9H_MISSING: 'Break requirement after 9 hours of work not met',
  DATA_INVALID_ACTIVITY: 'Invalid activity record detected',
  DATA_OVERLAPPING_ACTIVITY: 'Overlapping activity records detected',
  DISC_APP_TACHO_MISMATCH: 'App and tachograph data mismatch',
  VU_OVERSPEED: 'Overspeed event',
  VU_MOTION_CONFLICT: 'Motion conflict event',
  VU_POWER_INTERRUPTION: 'Power interruption event',
  VU_DRIVING_WITHOUT_CARD: 'Driving without card event',
  VU_CARD_INSERTION_WHILE_DRIVING: 'Card insertion while driving',
  VU_CARD_CONFLICT: 'Card conflict event',
  VU_SENSOR_FAULT: 'Sensor fault event',
  VU_SECURITY_FAULT: 'Security fault event',
  VU_CALIBRATION_EVENT: 'Calibration or workshop event',
};

export const TACHO_RULE_LEGAL_BASIS: Record<SharedTachoRuleCode, string> = {
  DRV_CONTINUOUS_4H30_EXCEEDED: 'EU Drivers’ Hours: break required after 4.5 hours driving',
  DRV_DAILY_9H_EXCEEDED: 'EU Drivers’ Hours: regular daily driving limit',
  DRV_DAILY_10H_EXCEEDED: 'EU Drivers’ Hours: extended daily driving limit',
  DRV_WEEKLY_56H_EXCEEDED: 'EU Drivers’ Hours: weekly driving limit',
  DRV_FORTNIGHT_90H_EXCEEDED: 'EU Drivers’ Hours: fortnightly driving limit',
  REST_DAILY_UNDER_9H: 'EU Drivers’ Hours: minimum reduced daily rest',
  REST_DAILY_REDUCED: 'EU Drivers’ Hours: regular daily rest reduced below 11 hours',
  REST_WEEKLY_UNDER_24H: 'EU Drivers’ Hours: minimum reduced weekly rest',
  REST_WEEKLY_REDUCED: 'EU Drivers’ Hours: weekly rest reduced below 45 hours',
  WTD_BREAK_AFTER_6H_MISSING: 'Working Time Directive: break requirement after 6 hours work',
  WTD_BREAK_AFTER_9H_MISSING: 'Working Time Directive: break requirement after 9 hours work',
  DATA_INVALID_ACTIVITY: 'Data quality review required',
  DATA_OVERLAPPING_ACTIVITY: 'Data quality review required',
  DISC_APP_TACHO_MISMATCH: 'Operational reconciliation review required',
  VU_OVERSPEED: 'Vehicle Unit Event',
  VU_MOTION_CONFLICT: 'Vehicle Unit Event',
  VU_POWER_INTERRUPTION: 'Vehicle Unit Event',
  VU_DRIVING_WITHOUT_CARD: 'Vehicle Unit Event',
  VU_CARD_INSERTION_WHILE_DRIVING: 'Vehicle Unit Event',
  VU_CARD_CONFLICT: 'Vehicle Unit Event',
  VU_SENSOR_FAULT: 'Vehicle Unit Technical Fault',
  VU_SECURITY_FAULT: 'Vehicle Unit Technical Fault',
  VU_CALIBRATION_EVENT: 'Vehicle Unit Workshop / Calibration Event',
};

export function hasValidSplitBreak(breakParts: number[]) {
  if (breakParts.length < 2) return false;

  let accumulated = 0;
  let hasOpeningBreak = false;
  for (const mins of breakParts) {
    if (!hasOpeningBreak) {
      if (mins >= 15) {
        hasOpeningBreak = true;
        accumulated += mins;
      }
      continue;
    }

    accumulated += mins;
    if (mins >= 30 && accumulated >= TACHO_RULE_LIMITS.WTD_BREAK_AFTER_9H_WORK_MINS) {
      return true;
    }
  }

  return false;
}

export function findRollingWindowTotal<T>(
  items: T[],
  endIndex: number,
  windowDays: number,
  getDate: (item: T) => string,
  getValue: (item: T) => number
) {
  const endDate = new Date(`${getDate(items[endIndex])}T00:00:00.000Z`);
  const startMs = endDate.getTime() - (windowDays - 1) * 24 * 60 * 60 * 1000;
  let total = 0;
  let startIndex = endIndex;

  for (let index = endIndex; index >= 0; index -= 1) {
    const itemDateMs = new Date(`${getDate(items[index])}T00:00:00.000Z`).getTime();
    if (itemDateMs < startMs) break;
    total += getValue(items[index]);
    startIndex = index;
  }

  return { total, startIndex };
}

type SharedActivityType = 'driving' | 'work' | 'poa' | 'rest' | 'break_rest' | 'unknown';

export function evaluateSequentialWtdBreaks<T>(
  activities: T[],
  getActivityType: (activity: T) => SharedActivityType,
  getDurationMins: (activity: T) => number,
  getOccurredAt: (activity: T) => string
) {
  let totalWorkMins = 0;
  let qualifyingBreakMins = 0;
  let first6HourBreach: { occurredAt: string; workMins: number; breakMins: number } | null = null;
  let first9HourBreach: { occurredAt: string; workMins: number; breakMins: number } | null = null;

  for (const activity of activities) {
    const activityType = getActivityType(activity);
    const durationMins = getDurationMins(activity);

    if (activityType === 'driving' || activityType === 'work') {
      totalWorkMins += durationMins;

      if (
        !first6HourBreach &&
        totalWorkMins > 360 &&
        qualifyingBreakMins < TACHO_RULE_LIMITS.WTD_BREAK_AFTER_6H_WORK_MINS
      ) {
        first6HourBreach = {
          occurredAt: getOccurredAt(activity),
          workMins: totalWorkMins,
          breakMins: qualifyingBreakMins,
        };
      }

      if (
        !first9HourBreach &&
        totalWorkMins > 540 &&
        qualifyingBreakMins < TACHO_RULE_LIMITS.WTD_BREAK_AFTER_9H_WORK_MINS
      ) {
        first9HourBreach = {
          occurredAt: getOccurredAt(activity),
          workMins: totalWorkMins,
          breakMins: qualifyingBreakMins,
        };
      }

      continue;
    }

    if ((activityType === 'rest' || activityType === 'break_rest') && durationMins >= 15) {
      qualifyingBreakMins += durationMins;
    }
  }

  return {
    totalWorkMins,
    qualifyingBreakMins,
    first6HourBreach,
    first9HourBreach,
  };
}

type SharedDrivingActivityType = 'driving' | 'work' | 'poa' | 'rest' | 'break_rest' | 'unknown';

export function evaluateContinuousDrivingBlocks<T>(
  activities: T[],
  getActivityType: (activity: T) => SharedDrivingActivityType,
  getDurationMins: (activity: T) => number,
  getStartTime: (activity: T) => string,
  getEndTime: (activity: T) => string
) {
  const breaches: Array<{
    occurredAt: string;
    periodStart: string;
    periodEnd: string;
    continuousDrivingMins: number;
  }> = [];

  let continuousDrivingMins = 0;
  let continuousStart: string | null = null;
  let splitBreakParts: number[] = [];

  for (const activity of activities) {
    const activityType = getActivityType(activity);
    const durationMins = getDurationMins(activity);

    if (activityType === 'driving') {
      if (hasValidSplitBreak(splitBreakParts)) {
        continuousDrivingMins = 0;
        continuousStart = null;
        splitBreakParts = [];
      }

      continuousDrivingMins += durationMins;
      continuousStart = continuousStart ?? getStartTime(activity);
      if (continuousDrivingMins > TACHO_RULE_LIMITS.CONTINUOUS_DRIVING_MINS) {
        breaches.push({
          occurredAt: getEndTime(activity),
          periodStart: continuousStart,
          periodEnd: getEndTime(activity),
          continuousDrivingMins,
        });
        continuousDrivingMins = 0;
        continuousStart = null;
      }
      continue;
    }

    if ((activityType === 'rest' || activityType === 'break_rest') && durationMins >= TACHO_RULE_LIMITS.WTD_BREAK_AFTER_9H_WORK_MINS) {
      continuousDrivingMins = 0;
      continuousStart = null;
      splitBreakParts = [];
      continue;
    }

    if ((activityType === 'rest' || activityType === 'break_rest') && durationMins >= 15 && continuousDrivingMins > 0) {
      splitBreakParts.push(durationMins);
      continue;
    }

    splitBreakParts = [];
  }

  return breaches;
}

export type SharedRestGap = {
  fromDate: string;
  toDate: string;
  start: string;
  end: string;
  restMins: number;
};

function minsBetween(start: string, end: string) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export function buildRestGaps<T>(
  windows: T[],
  getDate: (window: T) => string,
  getDutyStart: (window: T) => string,
  getDutyEnd: (window: T) => string
): SharedRestGap[] {
  const gaps: SharedRestGap[] = [];

  for (let index = 1; index < windows.length; index += 1) {
    const previous = windows[index - 1];
    const current = windows[index];
    gaps.push({
      fromDate: getDate(previous),
      toDate: getDate(current),
      start: getDutyEnd(previous),
      end: getDutyStart(current),
      restMins: minsBetween(getDutyEnd(previous), getDutyStart(current)),
    });
  }

  return gaps;
}

export function findRollingBestRestGap<T>(
  windows: T[],
  gaps: SharedRestGap[],
  endIndex: number,
  getDate: (window: T) => string
) {
  const endDate = getDate(windows[endIndex]);
  const endDateMs = new Date(`${endDate}T00:00:00.000Z`).getTime();
  const startMs = endDateMs - 6 * 24 * 60 * 60 * 1000;
  const firstCoveredWindow = windows.find((window) => new Date(`${getDate(window)}T00:00:00.000Z`).getTime() >= startMs);
  if (!firstCoveredWindow) return null;
  if (endDateMs - new Date(`${getDate(firstCoveredWindow)}T00:00:00.000Z`).getTime() < 6 * 24 * 60 * 60 * 1000) {
    return null;
  }

  const relevantGaps = gaps.filter((gap) => {
    const gapEndMs = new Date(`${gap.toDate}T00:00:00.000Z`).getTime();
    return gapEndMs >= startMs && gapEndMs <= endDateMs;
  });

  return relevantGaps.reduce(
    (best, gap) => (gap.restMins > best.restMins ? gap : best),
    relevantGaps[0] ?? null
  );
}
