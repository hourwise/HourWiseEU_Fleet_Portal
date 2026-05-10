// Legacy app-side compliance helpers.
// This file still supports the existing portal workflows, but it is not the long-term
// tachograph rules engine for normalized driver card and vehicle unit analysis.

export type WorkSession = {
  start_time: string;
  end_time: string | null;
  total_work_minutes: number | null;
  total_break_minutes: number | null;
  other_data: { driving?: number } | null;
  [key: string]: any;
};

export type TachoActivity = {
  driver_id?: string | null;
  vehicle_id?: string | null;
  start_time: string;
  end_time: string;
  activity_type: 'driving' | 'work' | 'poa' | 'rest';
  distance_km?: number;
};

type ViolationDetail = {
  title: string;
  tip: string;
};

export interface ComplianceViolation {
  type: string;
  severity: 'low' | 'medium' | 'high';
  date: string;
}

export const VIOLATION_KEYS = {
  EXCEEDED_6H_WORK: 'EXCEEDED_6H_WORK',
  INSUFFICIENT_BREAK_FOR_9H_WORK: 'INSUFFICIENT_BREAK_FOR_9H_WORK',
  INSUFFICIENT_DAILY_REST: 'INSUFFICIENT_DAILY_REST',
  REDUCED_DAILY_REST_TAKEN: 'REDUCED_DAILY_REST_TAKEN',
  EXCEEDED_4_5H_DRIVING: 'EXCEEDED_4_5H_DRIVING',
  EXCEEDED_DAILY_DRIVING_LIMIT: 'EXCEEDED_DAILY_DRIVING_LIMIT',
  USED_10H_DRIVING_EXTENSION: 'USED_10H_DRIVING_EXTENSION',
  EXCEEDED_WEEKLY_DRIVING_LIMIT: 'EXCEEDED_WEEKLY_DRIVING_LIMIT',
  EXCEEDED_WEEKLY_WORK_LIMIT: 'EXCEEDED_WEEKLY_WORK_LIMIT',
  WORK_TIME_LIMIT_EXCEEDED: 'WORK_TIME_LIMIT_EXCEEDED',
  FORTNIGHTLY_DRIVING_LIMIT_EXCEEDED: 'FORTNIGHTLY_DRIVING_LIMIT_EXCEEDED',
  INSUFFICIENT_WEEKLY_REST: 'INSUFFICIENT_WEEKLY_REST',
  REDUCED_WEEKLY_REST_TAKEN: 'REDUCED_WEEKLY_REST_TAKEN',
};

export const VIOLATION_DETAILS: Record<string, ViolationDetail> = {
  [VIOLATION_KEYS.EXCEEDED_6H_WORK]: { title: 'Exceeded 6h Continuous Work', tip: 'A break of at least 30 minutes is required after 6 hours of work.' },
  [VIOLATION_KEYS.INSUFFICIENT_BREAK_FOR_9H_WORK]: { title: 'Insufficient Break for >9h Work', tip: 'For a work day over 9 hours, a total of 45 minutes of breaks are required.' },
  [VIOLATION_KEYS.INSUFFICIENT_DAILY_REST]: { title: 'Insufficient Daily Rest', tip: 'A minimum of 9 hours of daily rest is required between shifts.' },
  [VIOLATION_KEYS.REDUCED_DAILY_REST_TAKEN]: { title: 'Reduced Daily Rest Taken', tip: 'A reduced daily rest (9-11 hours) was taken. This is allowed up to 3 times a week.' },
  [VIOLATION_KEYS.EXCEEDED_4_5H_DRIVING]: { title: 'Exceeded 4.5h Continuous Driving', tip: 'A break of at least 45 minutes is required after 4.5 hours of cumulative driving.' },
  [VIOLATION_KEYS.EXCEEDED_DAILY_DRIVING_LIMIT]: { title: 'Exceeded Daily Driving Limit', tip: 'The daily driving limit of 9 hours (or 10 hours if extended) has been passed.' },
  [VIOLATION_KEYS.USED_10H_DRIVING_EXTENSION]: { title: '10h Driving Extension Used', tip: 'The daily driving limit was extended to 10 hours. This is allowed twice a week.' },
  [VIOLATION_KEYS.EXCEEDED_WEEKLY_DRIVING_LIMIT]: { title: 'Exceeded Weekly Driving Limit', tip: 'The weekly driving limit of 56 hours has been exceeded.' },
  [VIOLATION_KEYS.EXCEEDED_WEEKLY_WORK_LIMIT]: { title: 'Exceeded Weekly Work Limit', tip: 'The weekly working time limit of 60 hours has been exceeded.' },
  [VIOLATION_KEYS.WORK_TIME_LIMIT_EXCEEDED]: { title: 'Work Time Limit Exceeded', tip: 'Generic work time limit violation.' },
  [VIOLATION_KEYS.FORTNIGHTLY_DRIVING_LIMIT_EXCEEDED]: { title: 'Fortnightly Driving Limit Exceeded', tip: 'The two-week driving limit of 90 hours has been exceeded.' },
  [VIOLATION_KEYS.INSUFFICIENT_WEEKLY_REST]: { title: 'Insufficient Weekly Rest', tip: 'A minimum of 45 hours (or 24h reduced) of weekly rest is required.' },
  [VIOLATION_KEYS.REDUCED_WEEKLY_REST_TAKEN]: { title: 'Reduced Weekly Rest Taken', tip: 'A reduced weekly rest (24-45 hours) was taken. Compensation is required.' },
  default: { title: 'Unknown Violation', tip: 'An unspecified compliance violation has occurred.' },
};

// --- COMPLIANCE CALCULATION ---
const VIOLATION_RULES = {
  MAX_DAILY_DRIVING_HOURS_REGULAR: 9,
  MAX_DAILY_DRIVING_HOURS_EXTENDED: 10,
  MAX_WEEKLY_DRIVING_HOURS: 56,
  MAX_FORTNIGHTLY_DRIVING_HOURS: 90,
  MIN_DAILY_REST_HOURS_REGULAR: 11,
  MIN_DAILY_REST_HOURS_REDUCED: 9,
  MIN_WEEKLY_REST_HOURS_REGULAR: 45,
  MIN_WEEKLY_REST_HOURS_REDUCED: 24,
  MAX_CONTINUOUS_DRIVING_MINS: 270, // 4.5 hours
  REQUIRED_BREAK_AFTER_DRIVING_MINS: 45,
  BREAK_AFTER_6_HOURS_WORK_MINS: 30,
  BREAK_AFTER_9_HOURS_WORK_MINS: 45,
};

interface TachoComplianceResult {
  score: number;
  violations: { type: string; date: string; metadata?: any }[];
}

interface SessionComplianceResult {
  score: number;
  violations: string[];
}

/**
 * Analyzes granular Tachograph activities for EU 561/2006 violations.
 * This is the high-precision engine used for .DDD file analysis.
 */
export const analyzeTachoCompliance = (activities: TachoActivity[]): TachoComplianceResult => {
  const violations: { type: string; date: string; metadata?: any }[] = [];
  if (!activities || activities.length === 0) return { score: 100, violations: [] };

  // Sort activities by start time
  const sorted = [...activities].sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  let continuousDrivingMins = 0;
  let dailyDrivingMins = 0;
  let currentDay = new Date(sorted[0].start_time).toDateString();

  for (let i = 0; i < sorted.length; i++) {
    const act = sorted[i];
    const duration = (new Date(act.end_time).getTime() - new Date(act.start_time).getTime()) / 60000;
    const actDay = new Date(act.start_time).toDateString();

    if (actDay !== currentDay) {
      dailyDrivingMins = 0;
      currentDay = actDay;
    }

    if (act.activity_type === 'driving') {
      continuousDrivingMins += duration;
      dailyDrivingMins += duration;

      // 4.5h Continuous Driving Rule
      if (continuousDrivingMins > VIOLATION_RULES.MAX_CONTINUOUS_DRIVING_MINS) {
        violations.push({
          type: VIOLATION_KEYS.EXCEEDED_4_5H_DRIVING,
          date: act.start_time,
          metadata: { value: Math.round(continuousDrivingMins) }
        });
        continuousDrivingMins = 0; // Reset after flagging
      }

      // Daily Driving Limit (simplified - doesn't track 10h extensions yet)
      if (dailyDrivingMins > VIOLATION_RULES.MAX_DAILY_DRIVING_HOURS_EXTENDED * 60) {
        violations.push({
          type: VIOLATION_KEYS.EXCEEDED_DAILY_DRIVING_LIMIT,
          date: act.start_time,
          metadata: { value: Math.round(dailyDrivingMins) }
        });
      }
    } else if (act.activity_type === 'rest' || act.activity_type === 'poa') {
      // If break is >= 45 mins, reset continuous driving
      if (duration >= VIOLATION_RULES.REQUIRED_BREAK_AFTER_DRIVING_MINS) {
        continuousDrivingMins = 0;
      }
      // Note: split breaks (15+30) should be handled in a more advanced version
    }

    // Daily Rest Rule: Gap between shifts
    if (i > 0 && act.activity_type !== 'rest') {
      const prev = sorted[i-1];
      if (prev.activity_type === 'rest') {
        const restDuration = (new Date(act.start_time).getTime() - new Date(prev.start_time).getTime()) / 3600000;
        if (restDuration > 1 && restDuration < VIOLATION_RULES.MIN_DAILY_REST_HOURS_REDUCED) {
          violations.push({
            type: VIOLATION_KEYS.INSUFFICIENT_DAILY_REST,
            date: act.start_time,
            metadata: { value: restDuration.toFixed(1) }
          });
        }
      }
    }
  }

  // Calculate score based on number of violations
  const score = Math.max(0, 100 - violations.length * 10);

  return {
    score,
    violations
  };
};

export const calculateCompliance = (
  daySessions: WorkSession[],
  previousDaySessions: WorkSession[] | null,
  fortnightlyDrivingMinutes: number,
  weeklyDrivingExtensionsUsed: number
): SessionComplianceResult => {
  const violations: string[] = [];

  if (!daySessions || daySessions.length === 0) {
    return { score: 100, violations: [] };
  }

  const totalWorkMinutesToday = daySessions.reduce((acc, s) => acc + (s.total_work_minutes || 0), 0);
  const totalDrivingMinutesToday = daySessions.reduce((acc, s) => acc + (s.other_data?.driving || 0), 0);
  const totalBreakMinutesToday = daySessions.reduce((acc, s) => acc + (s.total_break_minutes || 0), 0);

  const workHours = totalWorkMinutesToday / 60;
  const drivingHours = totalDrivingMinutesToday / 60;

  // Rule: Breaks after 6 and 9 hours of work
  if (workHours > 9 && totalBreakMinutesToday < VIOLATION_RULES.BREAK_AFTER_9_HOURS_WORK_MINS) {
    violations.push(VIOLATION_KEYS.INSUFFICIENT_BREAK_FOR_9H_WORK);
  } else if (workHours > 6 && totalBreakMinutesToday < VIOLATION_RULES.BREAK_AFTER_6_HOURS_WORK_MINS) {
    violations.push(VIOLATION_KEYS.EXCEEDED_6H_WORK);
  }

  // Rule: Daily driving limits
  if (drivingHours > VIOLATION_RULES.MAX_DAILY_DRIVING_HOURS_REGULAR) {
    if (drivingHours > VIOLATION_RULES.MAX_DAILY_DRIVING_HOURS_EXTENDED || weeklyDrivingExtensionsUsed >= 2) {
      violations.push(VIOLATION_KEYS.EXCEEDED_DAILY_DRIVING_LIMIT);
    } else {
      violations.push(VIOLATION_KEYS.USED_10H_DRIVING_EXTENSION);
    }
  }
  
  // Rule: Fortnightly driving limit
  if (fortnightlyDrivingMinutes / 60 > VIOLATION_RULES.MAX_FORTNIGHTLY_DRIVING_HOURS) {
    violations.push(VIOLATION_KEYS.FORTNIGHTLY_DRIVING_LIMIT_EXCEEDED);
  }

  // Rule: Daily rest
  if (previousDaySessions && previousDaySessions.length > 0 && daySessions[0]?.start_time) {
    const lastSessionPreviousDay = previousDaySessions.sort((a, b) => new Date(b.end_time || '').getTime() - new Date(a.end_time || '').getTime())[0];
    if (lastSessionPreviousDay?.end_time) {
      const restHours = (new Date(daySessions[0].start_time).getTime() - new Date(lastSessionPreviousDay.end_time).getTime()) / (1000 * 3600);
      if (restHours < VIOLATION_RULES.MIN_DAILY_REST_HOURS_REDUCED) {
        violations.push(VIOLATION_KEYS.INSUFFICIENT_DAILY_REST);
      } else if (restHours < VIOLATION_RULES.MIN_DAILY_REST_HOURS_REGULAR) {
        violations.push(VIOLATION_KEYS.REDUCED_DAILY_REST_TAKEN);
      }
    }
  }
  
  const score = Math.max(0, 100 - violations.filter(v => v !== VIOLATION_KEYS.USED_10H_DRIVING_EXTENSION && v !== VIOLATION_KEYS.REDUCED_DAILY_REST_TAKEN).length * 20);

  return {
    score,
    violations: [...new Set(violations)],
  };
};
