import { TACHO_RULE_TITLES } from './constants';
import {
  TACHO_RULE_LIMITS,
  buildRestGaps,
  findRollingBestRestGap,
} from '../../../../shared/tachoRuleCore';
import type { RuleDutyWindow, RuleEvaluationInput, TachoFinding } from './types';

type DailyRestRuleCode = 'REST_DAILY_UNDER_9H' | 'REST_DAILY_REDUCED';
type WeeklyRestRuleCode = 'REST_WEEKLY_UNDER_24H' | 'REST_WEEKLY_REDUCED';

function makeRestFinding(
  input: RuleEvaluationInput,
  ruleCode: DailyRestRuleCode | WeeklyRestRuleCode,
  summary: string,
  occurredAt: string,
  periodStart: string,
  periodEnd: string,
  severity: TachoFinding['severity'],
  status: TachoFinding['status']
): TachoFinding {
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
    evidenceRefs: [{ kind: 'summary', refId: periodStart, label: TACHO_RULE_TITLES[ruleCode] }],
  };
}

function dedupeWeeklyRestFindings(findings: TachoFinding[]) {
  const seen = new Set<string>();

  return findings.filter((finding) => {
    const key = `${finding.ruleCode}-${finding.periodStart}-${finding.periodEnd}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function evaluateRestRules(
  input: RuleEvaluationInput,
  dutyWindows: RuleDutyWindow[]
): TachoFinding[] {
  const findings: TachoFinding[] = [];
  const gaps = buildRestGaps(
    dutyWindows,
    (window) => window.dutyDate,
    (window) => window.dutyStart,
    (window) => window.dutyEnd
  );

  for (const gap of gaps) {
    if (gap.restMins < TACHO_RULE_LIMITS.DAILY_REST_REDUCED_MINS) {
      findings.push(
        makeRestFinding(
          input,
          'REST_DAILY_UNDER_9H',
          `Only ${gap.restMins} minutes of rest were recorded between ${gap.fromDate} and ${gap.toDate}.`,
          gap.end,
          gap.start,
          gap.end,
          'high',
          'breach'
        )
      );
    } else if (gap.restMins < TACHO_RULE_LIMITS.DAILY_REST_REGULAR_MINS) {
      findings.push(
        makeRestFinding(
          input,
          'REST_DAILY_REDUCED',
          `A reduced rest of ${gap.restMins} minutes was recorded between ${gap.fromDate} and ${gap.toDate}.`,
          gap.end,
          gap.start,
          gap.end,
          'medium',
          'warning'
        )
      );
    }
  }

  for (let index = 0; index < dutyWindows.length; index += 1) {
    const window = dutyWindows[index];
    const bestGap = findRollingBestRestGap(dutyWindows, gaps, index, (dutyWindow) => dutyWindow.dutyDate);
    if (!bestGap) continue;

    if (bestGap.restMins < TACHO_RULE_LIMITS.WEEKLY_REST_REDUCED_MINS) {
      findings.push(
        makeRestFinding(
          input,
          'REST_WEEKLY_UNDER_24H',
          `No qualifying weekly rest was found in the 7-day period ending ${window.dutyDate}; the longest rest recorded was ${bestGap.restMins} minutes.`,
          window.dutyEnd,
          bestGap.start,
          window.dutyEnd,
          'high',
          'breach'
        )
      );
    } else if (bestGap.restMins < TACHO_RULE_LIMITS.WEEKLY_REST_REGULAR_MINS) {
      findings.push(
        makeRestFinding(
          input,
          'REST_WEEKLY_REDUCED',
          `A reduced weekly rest of ${bestGap.restMins} minutes was the longest rest recorded in the 7-day period ending ${window.dutyDate}.`,
          window.dutyEnd,
          bestGap.start,
          bestGap.end,
          'medium',
          'warning'
        )
      );
    }
  }

  return dedupeWeeklyRestFindings(findings);
}
