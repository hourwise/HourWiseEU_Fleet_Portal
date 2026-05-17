import type { WorkSession } from '../../compliance';
import type { RuleActivitySegment, TachoFinding, TachoReconciliationItem } from './types';
import { buildSharedAppTachoReconciliationItems } from '../../../../shared/tachoReconciliation';

export function buildAppTachoReconciliationItems(
  activities: RuleActivitySegment[],
  workSessions: WorkSession[]
): TachoReconciliationItem[] {
  return buildSharedAppTachoReconciliationItems(
    activities.map((activity) => ({
      id: activity.id,
      startTime: activity.startTime,
      endTime: activity.endTime,
      activityType: activity.activityType,
    })),
    workSessions.map((session) => ({
      startTime: session.start_time,
      drivingMins: Math.max(0, session.other_data?.driving ?? 0),
    }))
  ).map((item) => ({
    id: item.id,
    status: item.status,
    date: item.date,
    appLabel: item.appLabel,
    tachoLabel: item.tachoLabel,
    summary: item.summary,
  }));
}

export function evaluateAppTachoReconciliation(
  driverId: string,
  activities: RuleActivitySegment[],
  workSessions: WorkSession[]
): TachoFinding[] {
  return buildAppTachoReconciliationItems(activities, workSessions)
    .filter((item) => item.status !== 'matched')
    .map((item) => {
      const periodStart = `${item.date}T00:00:00.000Z`;
      const periodEnd = `${item.date}T23:59:59.999Z`;
      const severity: TachoFinding['severity'] =
        item.status === 'tacho_only'
          ? 'high'
          : item.status === 'mismatch_duration'
          ? 'medium'
          : 'low';
      const title =
        item.status === 'tacho_only'
          ? 'Tachograph driving has no matching app driving'
          : item.status === 'app_only'
          ? 'App driving has no matching tachograph driving'
          : 'App and tachograph driving totals differ';

      return {
        id: `DISC_APP_TACHO_MISMATCH-${driverId}-${item.date}`,
        driverId,
        source: 'combined',
        severity,
        status: 'warning',
        ruleCode: 'DISC_APP_TACHO_MISMATCH',
        title,
        summary: item.summary,
        occurredAt: periodEnd,
        periodStart,
        periodEnd,
        evidenceRefs: [{ kind: 'summary', refId: item.id, label: 'App and tacho day comparison' }],
        metadata: {
          reconciliationStatus: item.status,
          appLabel: item.appLabel,
          tachoLabel: item.tachoLabel,
        },
      };
    });
}
