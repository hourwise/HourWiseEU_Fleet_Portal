import type { OperationalTask, OperationalTaskSeverity } from './operationalTaskQueue';

export type OperationalSignalSource = 'fleet_event' | 'vehicle_check' | 'job_assignment' | 'shift' | 'asset_readiness' | 'driver_compliance' | 'job_evidence' | 'atlas_signal';
export type CanonicalOperationalSignal = {
  sourceType: OperationalSignalSource;
  sourceId: string;
  fingerprint: string;
  severity: OperationalTaskSeverity;
  title: string;
  detail: string;
  navigationTarget: string;
  resolved: boolean;
};
export type CanonicalTaskProjection = {
  taskKey: string;
  sourceSignalKey: string;
  sourceType: OperationalSignalSource;
  sourceId: string;
  severity: OperationalTaskSeverity;
  actionable: boolean;
};

export function canonicalSignalKey(sourceType: OperationalSignalSource, sourceId: string): string { return `${sourceType}:${sourceId}`; }
export function canonicalTaskKey(signal: Pick<CanonicalOperationalSignal, 'sourceType' | 'sourceId'>): string { return `task:${canonicalSignalKey(signal.sourceType, signal.sourceId)}`; }
export function projectOperationalSignal(signal: CanonicalOperationalSignal): CanonicalTaskProjection | null {
  if (signal.resolved) return null;
  return { taskKey: canonicalTaskKey(signal), sourceSignalKey: canonicalSignalKey(signal.sourceType, signal.sourceId), sourceType: signal.sourceType, sourceId: signal.sourceId, severity: signal.severity, actionable: true };
}
export function dedupeOperationalSignals(signals: readonly CanonicalOperationalSignal[]): CanonicalOperationalSignal[] {
  const byKey = new Map<string, CanonicalOperationalSignal>();
  for (const signal of signals) { const key = canonicalSignalKey(signal.sourceType, signal.sourceId); const previous = byKey.get(key); if (!previous || severityRank(signal.severity) < severityRank(previous.severity) || signal.fingerprint !== previous.fingerprint) byKey.set(key, signal); }
  return [...byKey.values()];
}
export function taskProjectionForExistingTask(task: Pick<OperationalTask, 'sourceType' | 'sourceId' | 'severity' | 'actionable'>): CanonicalTaskProjection { return { taskKey: canonicalTaskKey({ sourceType: task.sourceType as OperationalSignalSource, sourceId: task.sourceId }), sourceSignalKey: canonicalSignalKey(task.sourceType as OperationalSignalSource, task.sourceId), sourceType: task.sourceType as OperationalSignalSource, sourceId: task.sourceId, severity: task.severity, actionable: task.actionable }; }
function severityRank(value: OperationalTaskSeverity): number { return value === 'critical' ? 0 : value === 'high' ? 1 : value === 'medium' ? 2 : 3; }
