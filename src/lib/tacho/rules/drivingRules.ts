import { TACHO_RULE_TITLES } from './constants';
import {
  evaluateContinuousDrivingBlocks,
  TACHO_RULE_LIMITS,
  findRollingWindowTotal,
} from '../../../../shared/tachoRuleCore';
import type { RuleDutyWindow, RuleEvaluationInput, RuleActivitySegment, TachoFinding } from './types';

function toMs(value: string) {
  return new Date(value).getTime();
}

function minsBetween(start: string, end: string) {
  return Math.max(0, Math.round((toMs(end) - toMs(start)) / 60000));
}

function makeFinding(
  input: RuleEvaluationInput,
  activity: RuleActivitySegment | RuleDutyWindow,
  ruleCode: keyof typeof TACHO_RULE_TITLES,
  summary: string,
  severity: TachoFinding['severity'],
  status: TachoFinding['status'],
  periodStart: string,
  periodEnd: string
): TachoFinding {
  const occurredAt = 'endTime' in activity ? activity.endTime : activity.dutyEnd;
  return {
    id: `${ruleCode}-${occurredAt}`,
    driverId: input.driverId,
    vehicleId: input.vehicleId ?? null,
    source: input.source ?? 'driver_card',
    severity,
    status,
    ruleCode,
    title: TACHO_RULE_TITLES[ruleCode],
    summary,
    occurredAt,
    periodStart,
    periodEnd,
    evidenceRefs: [{ kind: 'activity_segment', refId: activity.id, label: TACHO_RULE_TITLES[ruleCode] }],
  };
}

function dedupeAggregateFindings(findings: TachoFinding[]) {
  const seen = new Set<string>();

  return findings.filter((finding) => {
    const key = `${finding.ruleCode}-${finding.periodStart}-${finding.periodEnd}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function evaluateDrivingRules(
  input: RuleEvaluationInput,
  dutyWindows: RuleDutyWindow[]
): TachoFinding[] {
  const findings: TachoFinding[] = [];

  for (const window of dutyWindows) {
    if (window.drivingMins > TACHO_RULE_LIMITS.DAILY_DRIVING_EXTENDED_MINS) {
      findings.push(
        makeFinding(
          input,
          window,
          'DRV_DAILY_10H_EXCEEDED',
          `Driving recorded for ${window.drivingMins} minutes on ${window.dutyDate}.`,
          'high',
          'breach',
          window.dutyStart,
          window.dutyEnd
        )
      );
    } else if (window.drivingMins > TACHO_RULE_LIMITS.DAILY_DRIVING_REGULAR_MINS) {
      findings.push(
        makeFinding(
          input,
          window,
          'DRV_DAILY_9H_EXCEEDED',
          `Driving recorded for ${window.drivingMins} minutes on ${window.dutyDate}.`,
          'medium',
          'warning',
          window.dutyStart,
          window.dutyEnd
        )
      );
    }

    for (const breach of evaluateContinuousDrivingBlocks(
      window.activities,
      (activity) => activity.activityType,
      (activity) => minsBetween(activity.startTime, activity.endTime),
      (activity) => activity.startTime,
      (activity) => activity.endTime
    )) {
      const breachActivity = window.activities.find((activity) => activity.endTime === breach.occurredAt) ?? window;
      findings.push(
        makeFinding(
          input,
          breachActivity,
          'DRV_CONTINUOUS_4H30_EXCEEDED',
          `A continuous driving block reached ${breach.continuousDrivingMins} minutes before a compliant break.`,
          'high',
          'breach',
          breach.periodStart,
          breach.periodEnd
        )
      );
    }
  }

  for (let endIndex = 0; endIndex < dutyWindows.length; endIndex += 1) {
    const current = dutyWindows[endIndex];
    const weeklyWindow = findRollingWindowTotal(
      dutyWindows,
      endIndex,
      7,
      (window) => window.dutyDate,
      (window) => window.drivingMins
    );
    if (weeklyWindow.total > TACHO_RULE_LIMITS.WEEKLY_DRIVING_MINS) {
      const first = dutyWindows[weeklyWindow.startIndex];
      findings.push(
        makeFinding(
          input,
          current,
          'DRV_WEEKLY_56H_EXCEEDED',
          `Driving totalled ${weeklyWindow.total} minutes across the 7-day period ending ${current.dutyDate}.`,
          'high',
          'breach',
          first.dutyStart,
          current.dutyEnd
        )
      );
    }

    const fortnightWindow = findRollingWindowTotal(
      dutyWindows,
      endIndex,
      14,
      (window) => window.dutyDate,
      (window) => window.drivingMins
    );
    if (fortnightWindow.total > TACHO_RULE_LIMITS.FORTNIGHTLY_DRIVING_MINS) {
      const first = dutyWindows[fortnightWindow.startIndex];
      findings.push(
        makeFinding(
          input,
          current,
          'DRV_FORTNIGHT_90H_EXCEEDED',
          `Driving totalled ${fortnightWindow.total} minutes across the 14-day period ending ${current.dutyDate}.`,
          'high',
          'breach',
          first.dutyStart,
          current.dutyEnd
        )
      );
    }
  }

  return dedupeAggregateFindings(findings);
}
