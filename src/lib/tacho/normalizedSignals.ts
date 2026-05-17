import { TachoActivity, WorkSession } from '../compliance';
import { detectMissingMileage, type MissingMileageGap } from '../tachoAnalysis';
import { evaluateRawActivityCompliance } from './rules/engine';
import type { TachoReconciliationSummary, TachoReviewFocus } from './rules/types';
import { summarizeSharedReconciliation } from '../../../shared/tachoReconciliation';

export interface NormalizedDriverViolationSignal {
  date: string;
  violations: string[];
  score: number;
  sessionId: string;
  source: 'tacho';
}

export interface NormalizedDriverTachoComplianceSignal {
  driverId: string;
  averageScore: number;
  totalViolations: number;
  violations: string[];
  recentViolations: NormalizedDriverViolationSignal[];
  missingMileage: MissingMileageGap[];
  reconciliationSummary?: TachoReconciliationSummary;
  reviewFocus?: TachoReviewFocus;
  appMismatchCount?: number;
  hasData: boolean;
  source: 'raw_activity' | 'normalized_findings';
}

export interface NormalizedDriverTachoRiskSignal {
  driverId: string;
  legalComplianceScore: number;
  violationCount: number;
  missingMileageCount: number;
  appMismatchCount: number;
  reconciliationSummary?: TachoReconciliationSummary;
  reviewFocus?: TachoReviewFocus;
  source: 'raw_activity' | 'normalized_findings';
}

export interface BuildTachoSignalInput {
  driverId: string;
  activities: (TachoActivity & { driver_id?: string | null })[];
  workSessions: WorkSession[];
}

function buildReconciliationSummary(
  items: ReturnType<typeof evaluateRawActivityCompliance>['reconciliationItems']
): TachoReconciliationSummary {
  return summarizeSharedReconciliation(
    items.map((item) => ({
      ...item,
      appDrivingMins: 0,
      tachoDrivingMins: 0,
    }))
  );
}

function buildReviewFocus(input: {
  recentViolations: NormalizedDriverViolationSignal[];
  reconciliationSummary: TachoReconciliationSummary;
  reconciliationItems: ReturnType<typeof evaluateRawActivityCompliance>['reconciliationItems'];
  missingMileage: MissingMileageGap[];
}): TachoReviewFocus | undefined {
  const firstViolation = input.recentViolations[0];
  if (firstViolation) {
    return {
      date: firstViolation.date,
      kind: 'violation',
      summary: firstViolation.violations[0] ?? 'Tacho violation requires review.',
    };
  }

  const firstReconciliation = input.reconciliationItems.find((item) => item.status !== 'matched');
  if (firstReconciliation && input.reconciliationSummary.totalIssues > 0) {
    return {
      date: firstReconciliation.date,
      kind: 'reconciliation',
      summary: firstReconciliation.summary,
    };
  }

  const firstMissingMileage = input.missingMileage[0];
  if (firstMissingMileage) {
    return {
      date: firstMissingMileage.start.slice(0, 10),
      kind: 'missing_mileage',
      summary: `Missing mileage gap from ${firstMissingMileage.start.slice(11, 16)} to ${firstMissingMileage.end.slice(11, 16)}.`,
    };
  }

  return undefined;
}

export function buildDriverTachoComplianceSignal({
  driverId,
  activities,
  workSessions,
}: BuildTachoSignalInput): NormalizedDriverTachoComplianceSignal {
  const tachoAnalysis = evaluateRawActivityCompliance({
    driverId,
    activities,
    workSessions,
  });
  const missingMileage = detectMissingMileage(activities, workSessions);
  const reconciliationSummary = buildReconciliationSummary(tachoAnalysis.reconciliationItems);
  const recentViolations: NormalizedDriverViolationSignal[] = tachoAnalysis.combinedFindings.map((finding) => ({
    date: finding.occurredAt.slice(0, 10),
    violations: [finding.title],
    score: tachoAnalysis.score,
    sessionId: `tacho-${finding.ruleCode}-${finding.occurredAt}`,
    source: 'tacho',
  }));
  const reviewFocus = buildReviewFocus({
    recentViolations,
    reconciliationSummary,
    reconciliationItems: tachoAnalysis.reconciliationItems,
    missingMileage,
  });

  return {
    driverId,
    averageScore: activities.length > 0 ? tachoAnalysis.score : 100,
    totalViolations: recentViolations.length,
    violations: [...new Set(recentViolations.flatMap((violation) => violation.violations))],
    recentViolations,
    missingMileage,
    reconciliationSummary,
    reviewFocus,
    appMismatchCount: reconciliationSummary.totalIssues,
    hasData: activities.length > 0,
    source: 'raw_activity',
  };
}

export function buildDriverTachoRiskSignal(
  complianceSignal: NormalizedDriverTachoComplianceSignal
): NormalizedDriverTachoRiskSignal {
  return {
    driverId: complianceSignal.driverId,
    legalComplianceScore: complianceSignal.averageScore,
    violationCount: complianceSignal.totalViolations,
    missingMileageCount: complianceSignal.missingMileage.length,
    appMismatchCount: complianceSignal.appMismatchCount ?? 0,
    reconciliationSummary: complianceSignal.reconciliationSummary,
    reviewFocus: complianceSignal.reviewFocus,
    source: complianceSignal.source,
  };
}
