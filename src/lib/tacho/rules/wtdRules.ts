import { TACHO_RULE_TITLES } from './constants';
import { evaluateSequentialWtdBreaks } from '../../../../shared/tachoRuleCore';
import type { RuleDutyWindow, RuleEvaluationInput, TachoFinding } from './types';

function makeWtdFinding(
  input: RuleEvaluationInput,
  window: RuleDutyWindow,
  ruleCode: 'WTD_BREAK_AFTER_6H_MISSING' | 'WTD_BREAK_AFTER_9H_MISSING',
  summary: string,
  occurredAt: string
): TachoFinding {
  return {
    id: `${ruleCode}-${occurredAt}`,
    driverId: input.driverId,
    vehicleId: input.vehicleId ?? null,
    source: input.source ?? 'driver_card',
    severity: ruleCode === 'WTD_BREAK_AFTER_9H_MISSING' ? 'high' : 'medium',
    status: ruleCode === 'WTD_BREAK_AFTER_9H_MISSING' ? 'breach' : 'warning',
    ruleCode,
    title: TACHO_RULE_TITLES[ruleCode],
    summary,
    occurredAt,
    periodStart: window.dutyStart,
    periodEnd: occurredAt,
    evidenceRefs: [{ kind: 'summary', refId: window.id, label: TACHO_RULE_TITLES[ruleCode] }],
  };
}

export function evaluateWtdRules(
  input: RuleEvaluationInput,
  dutyWindows: RuleDutyWindow[]
): TachoFinding[] {
  const findings: TachoFinding[] = [];

  for (const window of dutyWindows) {
    const evaluation = evaluateSequentialWtdBreaks(
      window.activities,
      (activity) => activity.activityType,
      (activity) => Math.max(0, Math.round((new Date(activity.endTime).getTime() - new Date(activity.startTime).getTime()) / 60000)),
      (activity) => activity.endTime
    );

    if (evaluation.first6HourBreach) {
      findings.push(
        makeWtdFinding(
          input,
          window,
          'WTD_BREAK_AFTER_6H_MISSING',
          `Only ${evaluation.first6HourBreach.breakMins} minutes of qualifying break had been recorded by the time work exceeded ${evaluation.first6HourBreach.workMins} minutes.`,
          evaluation.first6HourBreach.occurredAt
        )
      );
    }

    if (evaluation.first9HourBreach) {
      findings.push(
        makeWtdFinding(
          input,
          window,
          'WTD_BREAK_AFTER_9H_MISSING',
          `Only ${evaluation.first9HourBreach.breakMins} minutes of qualifying break had been recorded by the time work exceeded ${evaluation.first9HourBreach.workMins} minutes.`,
          evaluation.first9HourBreach.occurredAt
        )
      );
    }
  }

  return findings;
}
