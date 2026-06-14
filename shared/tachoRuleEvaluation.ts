import {
  evaluateContinuousDrivingBlocks,
  TACHO_RULE_LEGAL_BASIS,
  TACHO_RULE_LIMITS,
  TACHO_RULE_TITLES,
  buildRestGaps,
  evaluateSequentialWtdBreaks,
  findRollingBestRestGap,
  findRollingWindowTotal,
  type SharedRestGap,
} from './tachoRuleCore.ts';

export type SharedRuleActivity = {
  id: string;
  driverId?: string | null;
  vehicleId?: string | null;
  startTime: string;
  endTime: string;
  activityType: 'driving' | 'work' | 'poa' | 'rest' | 'break_rest' | 'unknown';
  durationMins: number;
};

export type SharedRuleDutyWindow = {
  id: string;
  dutyDate: string;
  dutyStart: string;
  dutyEnd: string;
  activities: SharedRuleActivity[];
  drivingMins: number;
  workMins: number;
  poaMins: number;
  restMins: number;
};

export type SharedRuleFinding = {
  ruleCode: keyof typeof TACHO_RULE_TITLES;
  title: string;
  summary: string;
  severity: 'high' | 'medium' | 'info';
  status: 'breach' | 'warning' | 'info';
  occurredAt: string;
  periodStart: string;
  periodEnd: string;
  legalBasis: string;
  evidenceKind: 'activity_segment' | 'summary';
  evidenceRefId: string;
  evidenceLabel: string;
  metadata: Record<string, string | number | boolean | null>;
};

type SharedEvaluationInput = {
  dutyWindows: SharedRuleDutyWindow[];
  activities: SharedRuleActivity[];
};

function toMs(value: string) {
  return new Date(value).getTime();
}

function addDays(value: string, days: number) {
  return new Date(toMs(value) + days * 24 * 60 * 60 * 1000).toISOString();
}

function durationMins(startTime: string, endTime: string) {
  return Math.max(0, Math.round((toMs(endTime) - toMs(startTime)) / 60000));
}

function makeFinding(
  ruleCode: SharedRuleFinding['ruleCode'],
  summary: string,
  severity: SharedRuleFinding['severity'],
  status: SharedRuleFinding['status'],
  occurredAt: string,
  periodStart: string,
  periodEnd: string,
  evidenceKind: SharedRuleFinding['evidenceKind'],
  evidenceRefId: string,
  evidenceLabel: string,
  metadata: SharedRuleFinding['metadata'] = {}
): SharedRuleFinding {
  return {
    ruleCode,
    title: TACHO_RULE_TITLES[ruleCode],
    summary,
    severity,
    status,
    occurredAt,
    periodStart,
    periodEnd,
    legalBasis: TACHO_RULE_LEGAL_BASIS[ruleCode],
    evidenceKind,
    evidenceRefId,
    evidenceLabel,
    metadata,
  };
}

function dedupeAggregateFindings(findings: SharedRuleFinding[]) {
  const seen = new Set<string>();

  return findings.filter((finding) => {
    const key = `${finding.ruleCode}-${finding.periodStart}-${finding.periodEnd}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeRestGaps(gaps: SharedRestGap[]) {
  const seen = new Set<string>();

  return gaps.filter((gap) => {
    const key = `${gap.start}-${gap.end}-${gap.restMins}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isQualifyingMultiManningPair(current: SharedRuleActivity, next: SharedRuleActivity) {
  if (!current.driverId || !next.driverId) return false;
  if (!current.vehicleId || !next.vehicleId) return false;
  if (current.driverId === next.driverId) return false;
  if (current.vehicleId !== next.vehicleId) return false;
  if (toMs(next.startTime) >= toMs(current.endTime)) return false;
  if (current.activityType === 'driving' && next.activityType === 'driving') return false;

  return true;
}

function buildMultiManningWindows(activities: SharedRuleActivity[]) {
  const windows: Array<{
    vehicleId: string;
    startTime: string;
    endTime: string;
    driverIds: string[];
    activityTypes: SharedRuleActivity['activityType'][];
  }> = [];

  for (let index = 0; index < activities.length - 1; index += 1) {
    const current = activities[index];
    const next = activities[index + 1];
    if (!isQualifyingMultiManningPair(current, next)) continue;

    const startTime = new Date(Math.max(toMs(current.startTime), toMs(next.startTime))).toISOString();
    const endTime = new Date(Math.min(toMs(current.endTime), toMs(next.endTime))).toISOString();
    const previous = windows[windows.length - 1];

    if (
      previous &&
      previous.vehicleId === current.vehicleId &&
      toMs(startTime) <= toMs(previous.endTime)
    ) {
      previous.endTime = new Date(Math.max(toMs(previous.endTime), toMs(endTime))).toISOString();
      previous.driverIds = [...new Set([...previous.driverIds, current.driverId!, next.driverId!])];
      previous.activityTypes = [...new Set([...previous.activityTypes, current.activityType, next.activityType])];
      continue;
    }

    windows.push({
      vehicleId: current.vehicleId!,
      startTime,
      endTime,
      driverIds: [current.driverId!, next.driverId!],
      activityTypes: [current.activityType, next.activityType],
    });
  }

  return windows.map((window) => ({
    ...window,
    overlapMins: durationMins(window.startTime, window.endTime),
  }));
}

function findCompensatingRestGap(reducedGap: SharedRestGap, restGaps: SharedRestGap[]) {
  const owedMins = TACHO_RULE_LIMITS.WEEKLY_REST_REGULAR_MINS - reducedGap.restMins;
  const dueBy = addDays(reducedGap.end, TACHO_RULE_LIMITS.WEEKLY_REST_COMPENSATION_WINDOW_DAYS);
  const minimumAttachedRestMins = TACHO_RULE_LIMITS.WEEKLY_REST_COMPENSATION_ATTACH_MIN_MINS + owedMins;

  const compensatingGap =
    restGaps.find(
      (gap) =>
        toMs(gap.start) > toMs(reducedGap.end) &&
        toMs(gap.end) <= toMs(dueBy) &&
        gap.restMins >= minimumAttachedRestMins
    ) ?? null;

  return {
    owedMins,
    dueBy,
    minimumAttachedRestMins,
    compensatingGap,
  };
}

export function detectSharedDataQualityIssues(input: SharedEvaluationInput) {
  const findings: SharedRuleFinding[] = [];

  for (let index = 0; index < input.activities.length; index += 1) {
    const activity = input.activities[index];
    if (toMs(activity.endTime) <= toMs(activity.startTime)) {
      findings.push(
        makeFinding(
          'DATA_INVALID_ACTIVITY',
          'One activity record has an end time before or equal to its start time.',
          'medium',
          'warning',
          activity.endTime,
          activity.startTime,
          activity.endTime,
          'activity_segment',
          activity.id,
          'Invalid activity',
          { reason: 'end_before_or_equal_start' }
        )
      );
    }

    const next = input.activities[index + 1];
    if (next && toMs(next.startTime) < toMs(activity.endTime)) {
      if (isQualifyingMultiManningPair(activity, next)) {
        continue;
      }

      findings.push(
        makeFinding(
          'DATA_OVERLAPPING_ACTIVITY',
          'Two adjacent activity records overlap and should be reviewed.',
          'medium',
          'warning',
          next.startTime,
          activity.startTime,
          next.endTime,
          'activity_segment',
          activity.id,
          'Overlapping activity',
          { reason: 'overlap_detected' }
        )
      );
    }
  }

  return findings;
}

export function evaluateSharedRuleFindings(input: SharedEvaluationInput) {
  const findings: SharedRuleFinding[] = [];
  const dataQualityIssues = detectSharedDataQualityIssues(input);
  const reducedWeeklyRestGaps: SharedRestGap[] = [];
  const restGaps = buildRestGaps(
    input.dutyWindows,
    (window) => window.dutyDate,
    (window) => window.dutyStart,
    (window) => window.dutyEnd
  );

  for (const window of input.dutyWindows) {
    if (window.drivingMins > TACHO_RULE_LIMITS.DAILY_DRIVING_EXTENDED_MINS) {
      findings.push(
        makeFinding(
          'DRV_DAILY_10H_EXCEEDED',
          `Driving recorded for ${window.drivingMins} minutes on ${window.dutyDate}.`,
          'high',
          'breach',
          `${window.dutyDate}T23:59:59.000Z`,
          `${window.dutyDate}T00:00:00.000Z`,
          `${window.dutyDate}T23:59:59.000Z`,
          'summary',
          window.id,
          window.dutyDate,
          { measuredMins: window.drivingMins, thresholdMins: TACHO_RULE_LIMITS.DAILY_DRIVING_EXTENDED_MINS }
        )
      );
    } else if (window.drivingMins > TACHO_RULE_LIMITS.DAILY_DRIVING_REGULAR_MINS) {
      findings.push(
        makeFinding(
          'DRV_DAILY_9H_EXCEEDED',
          `Driving recorded for ${window.drivingMins} minutes on ${window.dutyDate}.`,
          'medium',
          'warning',
          `${window.dutyDate}T23:59:59.000Z`,
          `${window.dutyDate}T00:00:00.000Z`,
          `${window.dutyDate}T23:59:59.000Z`,
          'summary',
          window.id,
          window.dutyDate,
          { measuredMins: window.drivingMins, thresholdMins: TACHO_RULE_LIMITS.DAILY_DRIVING_REGULAR_MINS }
        )
      );
    }

    for (const breach of evaluateContinuousDrivingBlocks(
      window.activities,
      (activity) => activity.activityType,
      (activity) => activity.durationMins,
      (activity) => activity.startTime,
      (activity) => activity.endTime
    )) {
      const breachActivity = window.activities.find((activity) => activity.endTime === breach.occurredAt);
      findings.push(
        makeFinding(
          'DRV_CONTINUOUS_4H30_EXCEEDED',
          `A continuous driving block reached ${breach.continuousDrivingMins} minutes before a compliant break.`,
          'high',
          'breach',
          breach.occurredAt,
          breach.periodStart,
          breach.periodEnd,
          breachActivity ? 'activity_segment' : 'summary',
          breachActivity?.id ?? window.id,
          'Continuous driving block',
          { measuredMins: breach.continuousDrivingMins, thresholdMins: TACHO_RULE_LIMITS.CONTINUOUS_DRIVING_MINS }
        )
      );
    }

    const wtdEvaluation = evaluateSequentialWtdBreaks(
      window.activities,
      (activity) => activity.activityType,
      (activity) => activity.durationMins,
      (activity) => activity.endTime
    );

    if (wtdEvaluation.first6HourBreach) {
      findings.push(
        makeFinding(
          'WTD_BREAK_AFTER_6H_MISSING',
          `Only ${wtdEvaluation.first6HourBreach.breakMins} minutes of qualifying break had been recorded by the time work exceeded ${wtdEvaluation.first6HourBreach.workMins} minutes.`,
          'medium',
          'warning',
          wtdEvaluation.first6HourBreach.occurredAt,
          window.dutyStart,
          wtdEvaluation.first6HourBreach.occurredAt,
          'summary',
          window.id,
          'Working time summary',
          {
            workMinsAtBreach: wtdEvaluation.first6HourBreach.workMins,
            breakMinsAtBreach: wtdEvaluation.first6HourBreach.breakMins,
            thresholdMins: TACHO_RULE_LIMITS.WTD_BREAK_AFTER_6H_WORK_MINS,
          }
        )
      );
    }

    if (wtdEvaluation.first9HourBreach) {
      findings.push(
        makeFinding(
          'WTD_BREAK_AFTER_9H_MISSING',
          `Only ${wtdEvaluation.first9HourBreach.breakMins} minutes of qualifying break had been recorded by the time work exceeded ${wtdEvaluation.first9HourBreach.workMins} minutes.`,
          'high',
          'breach',
          wtdEvaluation.first9HourBreach.occurredAt,
          window.dutyStart,
          wtdEvaluation.first9HourBreach.occurredAt,
          'summary',
          window.id,
          'Working time summary',
          {
            workMinsAtBreach: wtdEvaluation.first9HourBreach.workMins,
            breakMinsAtBreach: wtdEvaluation.first9HourBreach.breakMins,
            thresholdMins: TACHO_RULE_LIMITS.WTD_BREAK_AFTER_9H_WORK_MINS,
          }
        )
      );
    }
  }

  for (const gap of restGaps) {
    if (gap.restMins < TACHO_RULE_LIMITS.DAILY_REST_REDUCED_MINS) {
      findings.push(
        makeFinding(
          'REST_DAILY_UNDER_9H',
          `Only ${gap.restMins} minutes of rest were recorded between ${gap.fromDate} and ${gap.toDate}.`,
          'high',
          'breach',
          gap.end,
          gap.start,
          gap.end,
          'summary',
          gap.start,
          'Daily rest gap',
          { measuredMins: gap.restMins, thresholdMins: TACHO_RULE_LIMITS.DAILY_REST_REDUCED_MINS }
        )
      );
    } else if (gap.restMins < TACHO_RULE_LIMITS.DAILY_REST_REGULAR_MINS) {
      findings.push(
        makeFinding(
          'REST_DAILY_REDUCED',
          `A reduced rest of ${gap.restMins} minutes was recorded between ${gap.fromDate} and ${gap.toDate}.`,
          'medium',
          'warning',
          gap.end,
          gap.start,
          gap.end,
          'summary',
          gap.start,
          'Reduced daily rest',
          { measuredMins: gap.restMins, thresholdMins: TACHO_RULE_LIMITS.DAILY_REST_REGULAR_MINS }
        )
      );
    }
  }

  for (const window of buildMultiManningWindows(input.activities)) {
    findings.push(
      makeFinding(
        'DRV_MULTI_MANNING_DETECTED',
        `Concurrent driver activity was detected on vehicle ${window.vehicleId} for ${window.overlapMins} minutes, consistent with a multi-manning review period.`,
        'info',
        'info',
        window.endTime,
        window.startTime,
        window.endTime,
        'summary',
        window.vehicleId,
        'Multi-manning review',
        {
          vehicleId: window.vehicleId,
          overlapMins: window.overlapMins,
          driverIds: window.driverIds.join(','),
          activityTypes: window.activityTypes.join(','),
        }
      )
    );
  }

  for (let index = 0; index < input.dutyWindows.length; index += 1) {
    const window = input.dutyWindows[index];
    const bestGap = findRollingBestRestGap(input.dutyWindows, restGaps, index, (dutyWindow) => dutyWindow.dutyDate);
    if (!bestGap) continue;

    if (bestGap.restMins < TACHO_RULE_LIMITS.WEEKLY_REST_REDUCED_MINS) {
      findings.push(
        makeFinding(
          'REST_WEEKLY_UNDER_24H',
          `No qualifying weekly rest was found in the 7-day period ending ${window.dutyDate}; the longest rest recorded was ${bestGap.restMins} minutes.`,
          'high',
          'breach',
          window.dutyEnd,
          bestGap.start,
          window.dutyEnd,
          'summary',
          window.id,
          'Weekly rest review',
          { measuredMins: bestGap.restMins, thresholdMins: TACHO_RULE_LIMITS.WEEKLY_REST_REDUCED_MINS, windowDays: 7 }
        )
      );
    } else if (bestGap.restMins < TACHO_RULE_LIMITS.WEEKLY_REST_REGULAR_MINS) {
      const compensation = findCompensatingRestGap(bestGap, restGaps);
      reducedWeeklyRestGaps.push(bestGap);
      findings.push(
        makeFinding(
          'REST_WEEKLY_REDUCED',
          `A reduced weekly rest of ${bestGap.restMins} minutes was the longest rest recorded in the 7-day period ending ${window.dutyDate}.`,
          'medium',
          'warning',
          window.dutyEnd,
          bestGap.start,
          bestGap.end,
          'summary',
          window.id,
          'Weekly rest review',
          {
            measuredMins: bestGap.restMins,
            thresholdMins: TACHO_RULE_LIMITS.WEEKLY_REST_REGULAR_MINS,
            windowDays: 7,
            compensationMins: compensation.owedMins,
            compensationDueBy: compensation.dueBy.slice(0, 10),
            minimumAttachedRestMins: compensation.minimumAttachedRestMins,
          }
        )
      );
    }
  }

  const latestKnownTimestamp = input.dutyWindows[input.dutyWindows.length - 1]?.dutyEnd ?? null;
  for (const reducedGap of dedupeRestGaps(reducedWeeklyRestGaps)) {
    const compensation = findCompensatingRestGap(reducedGap, restGaps);
    if (compensation.compensatingGap) {
      findings.push(
        makeFinding(
          'REST_WEEKLY_COMPENSATION_COMPLETED',
          `Reduced weekly rest compensation of ${compensation.owedMins} minutes was attached to a later rest of ${compensation.compensatingGap.restMins} minutes.`,
          'info',
          'info',
          compensation.compensatingGap.end,
          reducedGap.start,
          compensation.compensatingGap.end,
          'summary',
          reducedGap.start,
          'Weekly rest compensation',
          {
            compensationMins: compensation.owedMins,
            compensationDueBy: compensation.dueBy.slice(0, 10),
            attachedRestMins: compensation.compensatingGap.restMins,
            attachedRestStart: compensation.compensatingGap.start,
            attachedRestEnd: compensation.compensatingGap.end,
          }
        )
      );
      continue;
    }

    if (latestKnownTimestamp && toMs(latestKnownTimestamp) > toMs(compensation.dueBy)) {
      findings.push(
        makeFinding(
          'REST_WEEKLY_COMPENSATION_MISSING',
          `Reduced weekly rest compensation of ${compensation.owedMins} minutes was not identified within ${TACHO_RULE_LIMITS.WEEKLY_REST_COMPENSATION_WINDOW_DAYS} days of the reduced weekly rest ending.`,
          'high',
          'breach',
          compensation.dueBy,
          reducedGap.start,
          compensation.dueBy,
          'summary',
          reducedGap.start,
          'Weekly rest compensation',
          {
            compensationMins: compensation.owedMins,
            compensationDueBy: compensation.dueBy.slice(0, 10),
            minimumAttachedRestMins: compensation.minimumAttachedRestMins,
          }
        )
      );
      continue;
    }

    findings.push(
      makeFinding(
        'REST_WEEKLY_COMPENSATION_PENDING',
        `Reduced weekly rest compensation of ${compensation.owedMins} minutes is still outstanding and must be attached to a later rest of at least ${compensation.minimumAttachedRestMins} minutes by ${compensation.dueBy.slice(0, 10)}.`,
        'info',
        'info',
        reducedGap.end,
        reducedGap.start,
        compensation.dueBy,
        'summary',
        reducedGap.start,
        'Weekly rest compensation',
        {
          compensationMins: compensation.owedMins,
          compensationDueBy: compensation.dueBy.slice(0, 10),
          minimumAttachedRestMins: compensation.minimumAttachedRestMins,
        }
      )
    );
  }

  for (let endIndex = 0; endIndex < input.dutyWindows.length; endIndex += 1) {
    const current = input.dutyWindows[endIndex];
    const weeklyWindow = findRollingWindowTotal(
      input.dutyWindows,
      endIndex,
      7,
      (window) => window.dutyDate,
      (window) => window.drivingMins
    );
    if (weeklyWindow.total > TACHO_RULE_LIMITS.WEEKLY_DRIVING_MINS) {
      const firstWindow = input.dutyWindows[weeklyWindow.startIndex];
      findings.push(
        makeFinding(
          'DRV_WEEKLY_56H_EXCEEDED',
          `Driving totalled ${weeklyWindow.total} minutes across the 7-day period ending ${current.dutyDate}.`,
          'high',
          'breach',
          current.dutyEnd,
          firstWindow.dutyStart,
          current.dutyEnd,
          'summary',
          current.id,
          'Weekly driving total',
          { measuredMins: weeklyWindow.total, thresholdMins: TACHO_RULE_LIMITS.WEEKLY_DRIVING_MINS, windowDays: 7 }
        )
      );
    }

    const fortnightWindow = findRollingWindowTotal(
      input.dutyWindows,
      endIndex,
      14,
      (window) => window.dutyDate,
      (window) => window.drivingMins
    );
    if (fortnightWindow.total > TACHO_RULE_LIMITS.FORTNIGHTLY_DRIVING_MINS) {
      const firstWindow = input.dutyWindows[fortnightWindow.startIndex];
      findings.push(
        makeFinding(
          'DRV_FORTNIGHT_90H_EXCEEDED',
          `Driving totalled ${fortnightWindow.total} minutes across the 14-day period ending ${current.dutyDate}.`,
          'high',
          'breach',
          current.dutyEnd,
          firstWindow.dutyStart,
          current.dutyEnd,
          'summary',
          current.id,
          'Fortnightly driving total',
          { measuredMins: fortnightWindow.total, thresholdMins: TACHO_RULE_LIMITS.FORTNIGHTLY_DRIVING_MINS, windowDays: 14 }
        )
      );
    }
  }

  const combinedFindings = [...dedupeAggregateFindings(findings), ...dataQualityIssues];
  const findingsPerDate = combinedFindings.reduce<Record<string, number>>((acc, finding) => {
    const date = finding.occurredAt.slice(0, 10);
    acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {});

  return {
    findings: dedupeAggregateFindings(findings),
    dataQualityIssues,
    combinedFindings,
    findingsPerDate,
  };
}
