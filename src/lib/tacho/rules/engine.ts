import type { WorkSession } from '../../compliance';
import { mergeAdjacentActivities, toRuleActivities } from './activityTimeline';
import { buildDaySummariesFromDutyWindows, buildDutyWindows } from './dutyBuilder';
import { buildAppTachoReconciliationItems, evaluateAppTachoReconciliation } from './reconciliation';
import { scoreLegalCompliance, summarizeViolationTitles } from './scoring';
import type { RuleEvaluationInput, RuleEvaluationResult, TachoFinding } from './types';
import { evaluateSharedRuleFindings } from '../../../../shared/tachoRuleEvaluation';

function toMs(value: string) {
  return new Date(value).getTime();
}

export function evaluateDriverRules(input: RuleEvaluationInput): RuleEvaluationResult {
  const normalizedActivities = mergeAdjacentActivities(
    [...input.activities].sort((a, b) => toMs(a.startTime) - toMs(b.startTime))
  );
  const dutyWindows = buildDutyWindows(normalizedActivities);
  const daySummaries = buildDaySummariesFromDutyWindows(dutyWindows);
  const sharedEvaluation = evaluateSharedRuleFindings({
    activities: normalizedActivities.map((activity) => ({
      id: activity.id,
      driverId: activity.driverId,
      vehicleId: activity.vehicleId,
      startTime: activity.startTime,
      endTime: activity.endTime,
      activityType: activity.activityType,
      durationMins: Math.max(0, Math.round((toMs(activity.endTime) - toMs(activity.startTime)) / 60000)),
    })),
    dutyWindows: dutyWindows.map((window) => ({
      id: window.id,
      dutyDate: window.dutyDate,
      dutyStart: window.dutyStart,
      dutyEnd: window.dutyEnd,
      activities: window.activities.map((activity) => ({
        id: activity.id,
        driverId: activity.driverId,
        vehicleId: activity.vehicleId,
        startTime: activity.startTime,
        endTime: activity.endTime,
        activityType: activity.activityType,
        durationMins: Math.max(0, Math.round((toMs(activity.endTime) - toMs(activity.startTime)) / 60000)),
      })),
      drivingMins: window.drivingMins,
      workMins: window.workMins,
      poaMins: window.poaMins,
      restMins: window.restMins,
    })),
  });

  const findings = mapSharedFindings(input, sharedEvaluation.findings);
  const dataQualityIssues = mapSharedFindings(input, sharedEvaluation.dataQualityIssues);

  for (const summary of daySummaries) {
    summary.findingsCount = sharedEvaluation.findingsPerDate[summary.date] ?? 0;
  }

  return {
    driverId: input.driverId,
    vehicleId: input.vehicleId ?? null,
    source: input.source ?? 'driver_card',
    activities: normalizedActivities,
    dutyWindows,
    daySummaries,
    findings,
    dataQualityIssues,
  };
}

export function evaluateRawActivityCompliance(params: {
  driverId: string;
  activities: Parameters<typeof toRuleActivities>[0];
  workSessions?: WorkSession[];
}) {
  const ruleActivities = toRuleActivities(params.activities);
  const evaluation = evaluateDriverRules({
    driverId: params.driverId,
    activities: ruleActivities,
    vehicleId: ruleActivities[0]?.vehicleId ?? null,
    source: 'driver_card',
  });
  const reconciliation = evaluateAppTachoReconciliation(
    params.driverId,
    evaluation.activities,
    params.workSessions ?? []
  );
  const reconciliationItems = buildAppTachoReconciliationItems(
    evaluation.activities,
    params.workSessions ?? []
  );
  const combinedFindings = [...evaluation.findings, ...evaluation.dataQualityIssues, ...reconciliation];
  const score = scoreLegalCompliance(combinedFindings);

  return {
    ...evaluation,
    reconciliation,
    reconciliationItems,
    combinedFindings,
    score,
    violationTitles: summarizeViolationTitles(combinedFindings),
  };
}

function mapSharedFindings(
  input: RuleEvaluationInput,
  findings: Array<{
    ruleCode: string;
    title: string;
    summary: string;
    severity: TachoFinding['severity'];
    status: TachoFinding['status'];
    occurredAt: string;
    periodStart: string;
    periodEnd: string;
    legalBasis: string;
    evidenceKind: 'activity_segment' | 'summary';
    evidenceRefId: string;
    evidenceLabel: string;
    metadata: Record<string, string | number | boolean | null>;
  }>
): TachoFinding[] {
  return findings.map((finding) => ({
    id: `${finding.ruleCode}-${finding.occurredAt}`,
    driverId: input.driverId,
    vehicleId: input.vehicleId ?? null,
    source: input.source ?? 'driver_card',
    severity: finding.severity,
    status: finding.status,
    ruleCode: finding.ruleCode,
    title: finding.title,
    summary: finding.summary,
    occurredAt: finding.occurredAt,
    periodStart: finding.periodStart,
    periodEnd: finding.periodEnd,
    legalBasis: finding.legalBasis,
    evidenceRefs: [{ kind: finding.evidenceKind, refId: finding.evidenceRefId, label: finding.evidenceLabel }],
    metadata: finding.metadata,
  }));
}
