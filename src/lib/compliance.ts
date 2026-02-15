// Note: This is a modified version for the web portal.
// It does not include the i18n translation logic.

export type WorkSession = {
  start_time: string;
  end_time: string | null;
  total_work_minutes: number | null;
  total_break_minutes: number | null;
  other_data: { driving?: number } | null;
  [key: string]: any;
};

type ViolationDetail = {
  title: string;
  tip: string;
};

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
  default: { title: 'Unknown Violation', tip: 'An unspecified compliance violation has occurred.' },
};

// --- COMPLIANCE CALCULATION ---
const VIOLATION_RULES = {
  MAX_DAILY_DRIVING_HOURS_REGULAR: 9,
  MAX_DAILY_DRIVING_HOURS_EXTENDED: 10,
  MAX_FORTNIGHTLY_DRIVING_HOURS: 90,
  MIN_DAILY_REST_HOURS_REGULAR: 11,
  MIN_DAILY_REST_HOURS_REDUCED: 9,
  BREAK_AFTER_6_HOURS_WORK_MINS: 30,
  BREAK_AFTER_9_HOURS_WORK_MINS: 45,
};

interface ComplianceResult {
  score: number;
  violations: string[];
}

export const calculateCompliance = (
  daySessions: WorkSession[],
  previousDaySessions: WorkSession[] | null,
  fortnightlyDrivingMinutes: number,
  weeklyDrivingExtensionsUsed: number
): ComplianceResult => {
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
