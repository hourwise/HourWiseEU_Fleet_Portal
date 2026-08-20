import { supabase } from './supabase';

export type PodReconciliationRun = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'partial' | 'failure';
  intents_scanned: number;
  intents_expired: number;
  storage_objects_removed: number;
  mismatch_count: number;
  failure_count: number;
  consecutive_failures: number;
};

export type PodReconciliationHealth = {
  lastAttemptedRun: PodReconciliationRun | null;
  lastSuccessfulRun: PodReconciliationRun | null;
  consecutiveFailures: number;
  consecutiveUnhealthyRuns: number;
  consecutivePartialRuns: number;
  mismatchBacklogCount: number;
  oldestMismatchAgeHours: number | null;
  lastRunAgeMinutes: number | null;
  thresholds: PodReconciliationThresholds;
  alerts: PodReconciliationAlert[];
  maintenanceWarning: boolean;
  recentRuns: readonly PodReconciliationRun[];
};

export type PodReconciliationThresholds = {
  warningConsecutiveRuns: number;
  criticalConsecutiveRuns: number;
  warningStaleHours: number;
  criticalStaleHours: number;
  warningOverdueMinutes: number;
  criticalOverdueMinutes: number;
};

export type PodReconciliationAlert = {
  signalKey: string;
  fingerprint: string;
  section: 'today';
  severity: 'critical' | 'warning' | 'advisory';
  title: string;
  detail: string;
  sourceLabel: string;
  sourceUpdatedAt: string | null;
  isNew: boolean;
  firstSeenAt: string | null;
};

export type PodReconciliationDrilldownItem = {
  id: string;
  itemType: 'job_evidence_upload_intent';
  occurredAt: string;
  jobAssignmentId: string;
  jobReference: string;
  jobTitle: string;
  entityLabel: string;
  reconciliationCategory: 'stale_pending_upload' | 'evidence_reference_mismatch' | 'storage_object_mismatch' | 'reconciliation_item_failure';
  severity: 'critical' | 'warning' | 'advisory';
  title: string;
  recommendedAction: string;
  navigationKey: 'job_assignment';
};

type PodHealthOptions = { syncSignals?: boolean };
type PodHealthRpc = (functionName: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function fetchPodReconciliationHealth(options: PodHealthOptions = {}): Promise<PodReconciliationHealth> {
  const { data, error } = await supabase.rpc('get_pod_reconciliation_health');
  if (error || !data) throw new Error(error?.message || 'Unable to load POD reconciliation health.');
  const result = data as unknown as {
    last_attempted_run?: PodReconciliationRun | null;
    last_successful_run?: PodReconciliationRun | null;
    consecutive_failures?: number;
    consecutive_unhealthy_runs?: number;
    consecutive_partial_runs?: number;
    mismatch_backlog_count?: number;
    oldest_mismatch_age_hours?: number | null;
    last_run_age_minutes?: number | null;
    thresholds?: Partial<PodReconciliationThresholds>;
    alerts?: Array<Record<string, unknown>>;
    maintenance_warning?: boolean;
    recent_runs?: readonly PodReconciliationRun[];
  };
  const thresholds: PodReconciliationThresholds = {
    warningConsecutiveRuns: result.thresholds?.warningConsecutiveRuns ?? (result.thresholds as { warning_failures?: number } | undefined)?.warning_failures ?? 3,
    criticalConsecutiveRuns: result.thresholds?.criticalConsecutiveRuns ?? (result.thresholds as { critical_failures?: number } | undefined)?.critical_failures ?? 6,
    warningStaleHours: result.thresholds?.warningStaleHours ?? (result.thresholds as { warning_stale_hours?: number } | undefined)?.warning_stale_hours ?? 24,
    criticalStaleHours: result.thresholds?.criticalStaleHours ?? (result.thresholds as { critical_stale_hours?: number } | undefined)?.critical_stale_hours ?? 72,
    warningOverdueMinutes: result.thresholds?.warningOverdueMinutes ?? (result.thresholds as { warning_overdue_minutes?: number } | undefined)?.warning_overdue_minutes ?? 45,
    criticalOverdueMinutes: result.thresholds?.criticalOverdueMinutes ?? (result.thresholds as { critical_overdue_minutes?: number } | undefined)?.critical_overdue_minutes ?? 90,
  };
  const baseAlerts = (result.alerts ?? []).map(parseAlert).filter((alert): alert is Omit<PodReconciliationAlert, 'isNew' | 'firstSeenAt'> => alert !== null);
  const alerts = options.syncSignals === false ? baseAlerts.map((alert) => ({ ...alert, isNew: false, firstSeenAt: null })) : await syncPodAlerts(baseAlerts);
  return {
    lastAttemptedRun: result.last_attempted_run ?? null,
    lastSuccessfulRun: result.last_successful_run ?? null,
    consecutiveFailures: result.consecutive_failures ?? 0,
    consecutiveUnhealthyRuns: result.consecutive_unhealthy_runs ?? result.consecutive_failures ?? 0,
    consecutivePartialRuns: result.consecutive_partial_runs ?? 0,
    mismatchBacklogCount: result.mismatch_backlog_count ?? 0,
    oldestMismatchAgeHours: result.oldest_mismatch_age_hours ?? null,
    lastRunAgeMinutes: result.last_run_age_minutes ?? null,
    thresholds,
    alerts,
    maintenanceWarning: result.maintenance_warning ?? false,
    recentRuns: result.recent_runs ?? [],
  };
}

export async function fetchPodReconciliationDrilldown(signalKey: string, limit = 50): Promise<PodReconciliationDrilldownItem[]> {
  const rpc = supabase.rpc as unknown as PodHealthRpc;
  const { data, error } = await rpc('list_pod_reconciliation_drilldown', { p_signal_key: signalKey, p_limit: Math.min(Math.max(limit, 1), 100) });
  if (error) throw new Error(error.message || 'Unable to load POD reconciliation drill-down.');
  return (Array.isArray(data) ? data : []).map(parseDrilldownItem).filter((item): item is PodReconciliationDrilldownItem => item !== null);
}

async function syncPodAlerts(alerts: Array<Omit<PodReconciliationAlert, 'isNew' | 'firstSeenAt'>>): Promise<PodReconciliationAlert[]> {
  if (alerts.length === 0) return [];
  const rpc = supabase.rpc as unknown as PodHealthRpc;
  const { data, error } = await rpc('sync_atlas_signal_observations', {
    p_signals: alerts.map((alert) => ({ signal_key: alert.signalKey, fingerprint: alert.fingerprint, section: alert.section, severity: alert.severity, source_updated_at: alert.sourceUpdatedAt })),
  });
  if (error) throw new Error(error.message || 'Unable to persist POD reconciliation observations.');
  const observations = new Map((Array.isArray(data) ? data : []).filter(isRecord).map((row) => [String(row.signal_key), row]));
  return alerts.map((alert) => {
    const observation = observations.get(alert.signalKey);
    return { ...alert, isNew: observation?.is_new === true, firstSeenAt: typeof observation?.first_seen_at === 'string' ? observation.first_seen_at : null };
  });
}

function parseAlert(value: Record<string, unknown>): Omit<PodReconciliationAlert, 'isNew' | 'firstSeenAt'> | null {
  if (typeof value.signal_key !== 'string' || typeof value.fingerprint !== 'string' || typeof value.title !== 'string' || typeof value.detail !== 'string' || typeof value.source_label !== 'string') return null;
  const severity = value.severity;
  if (severity !== 'critical' && severity !== 'warning' && severity !== 'advisory') return null;
  return { signalKey: value.signal_key, fingerprint: value.fingerprint, section: 'today', severity, title: value.title, detail: value.detail, sourceLabel: value.source_label, sourceUpdatedAt: typeof value.source_updated_at === 'string' ? value.source_updated_at : null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseDrilldownItem(value: unknown): PodReconciliationDrilldownItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.itemType !== 'job_evidence_upload_intent' || typeof value.occurredAt !== 'string' || typeof value.jobAssignmentId !== 'string' || typeof value.jobReference !== 'string' || typeof value.jobTitle !== 'string' || typeof value.entityLabel !== 'string' || typeof value.title !== 'string' || typeof value.recommendedAction !== 'string' || value.navigationKey !== 'job_assignment') return null;
  const categories = ['stale_pending_upload', 'evidence_reference_mismatch', 'storage_object_mismatch', 'reconciliation_item_failure'] as const;
  const severities = ['critical', 'warning', 'advisory'] as const;
  if (!categories.includes(value.reconciliationCategory as typeof categories[number]) || !severities.includes(value.severity as typeof severities[number])) return null;
  return {
    id: value.id,
    itemType: 'job_evidence_upload_intent',
    occurredAt: value.occurredAt,
    jobAssignmentId: value.jobAssignmentId,
    jobReference: value.jobReference,
    jobTitle: value.jobTitle,
    entityLabel: value.entityLabel,
    reconciliationCategory: value.reconciliationCategory as PodReconciliationDrilldownItem['reconciliationCategory'],
    severity: value.severity as PodReconciliationDrilldownItem['severity'],
    title: value.title,
    recommendedAction: value.recommendedAction,
    navigationKey: 'job_assignment',
  };
}
