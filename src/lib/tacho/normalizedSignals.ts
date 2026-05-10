import { analyzeTachoCompliance, TachoActivity, WorkSession } from '../compliance';
import { detectMissingMileage, type MissingMileageGap } from '../tachoAnalysis';

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
  hasData: boolean;
  source: 'raw_activity' | 'normalized_findings';
}

export interface NormalizedDriverTachoRiskSignal {
  driverId: string;
  legalComplianceScore: number;
  violationCount: number;
  missingMileageCount: number;
  appMismatchCount: number;
  source: 'raw_activity' | 'normalized_findings';
}

export interface BuildTachoSignalInput {
  driverId: string;
  activities: (TachoActivity & { driver_id?: string | null })[];
  workSessions: WorkSession[];
}

export function buildDriverTachoComplianceSignal({
  driverId,
  activities,
  workSessions,
}: BuildTachoSignalInput): NormalizedDriverTachoComplianceSignal {
  const tachoAnalysis = analyzeTachoCompliance(activities);
  const missingMileage = detectMissingMileage(activities, workSessions);
  const recentViolations: NormalizedDriverViolationSignal[] = tachoAnalysis.violations.map((violation) => ({
    date: violation.date,
    violations: [violation.type],
    score: tachoAnalysis.score,
    sessionId: `tacho-${violation.date}`,
    source: 'tacho',
  }));

  return {
    driverId,
    averageScore: activities.length > 0 ? tachoAnalysis.score : 100,
    totalViolations: recentViolations.length,
    violations: [...new Set(recentViolations.flatMap((violation) => violation.violations))],
    recentViolations,
    missingMileage,
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
    appMismatchCount: 0,
    source: complianceSignal.source,
  };
}
