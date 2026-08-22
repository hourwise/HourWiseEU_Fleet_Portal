import type { OperationalTask, OperationalTaskSeverity } from './operationalTaskQueue';

export type OperationalSignalSource = 'fleet_event' | 'vehicle_check' | 'job_assignment' | 'shift' | 'asset_readiness' | 'asset_compliance' | 'driver_compliance' | 'job_evidence' | 'atlas_signal' | 'pod_review' | 'job_acknowledgement' | 'job_exception' | 'tacho_warning' | 'reconciliation_health' | 'atlas_proposal';
export type CanonicalSignalType = 'driver_compliance' | 'pod_review' | 'asset_readiness' | 'asset_compliance' | 'job_acknowledgement' | 'job_exception' | 'tacho_warning' | 'reconciliation_health' | 'atlas_proposal';
export type CanonicalSignalRelationship = { type: string; id: string };
export type CanonicalOperationalSignal = {
  sourceType: OperationalSignalSource;
  sourceId: string;
  fingerprint: string;
  severity: OperationalTaskSeverity;
  title: string;
  detail: string;
  navigationTarget: string;
  resolved: boolean;
  companyId?: string;
  signalType?: CanonicalSignalType;
  observedAt?: string | null;
  relationships?: readonly CanonicalSignalRelationship[];
  actionable?: boolean;
};
export type CanonicalTaskProjection = {
  taskKey: string;
  sourceSignalKey: string;
  sourceType: OperationalSignalSource;
  sourceId: string;
  severity: OperationalTaskSeverity;
  actionable: boolean;
  navigationTarget?: string;
  signalType?: CanonicalSignalType;
};
export type CanonicalSignalInput = Omit<CanonicalOperationalSignal, 'fingerprint'> & { fingerprint: string; companyId: string; signalType: CanonicalSignalType; observedAt: string | null; relationships: readonly CanonicalSignalRelationship[]; actionable: boolean };

export type SignalProducerDefinition = {
  signalType: CanonicalSignalType;
  sourceTypes: readonly OperationalSignalSource[];
  identityRule: string;
  fingerprintRule: string;
  navigationRule: string;
  resolvedRule: string;
};

export const SIGNAL_PRODUCER_REGISTRY: readonly SignalProducerDefinition[] = [
  { signalType: 'driver_compliance', sourceTypes: ['driver_compliance'], identityRule: 'company + driver/evidence source id', fingerprintRule: 'authoritative evidence status, due date, and planning conflict', navigationRule: 'drivers compliance workspace', resolvedRule: 'authoritative evidence becomes valid or the forecast no longer applies' },
  { signalType: 'pod_review', sourceTypes: ['job_evidence', 'pod_review'], identityRule: 'company + job evidence id', fingerprintRule: 'review status, outcome, and evidence timestamp', navigationRule: 'job POD review panel', resolvedRule: 'authoritative manager review is completed' },
  { signalType: 'asset_readiness', sourceTypes: ['asset_readiness'], identityRule: 'company + asset id', fingerprintRule: 'readiness status and blocking defect state', navigationRule: 'fleet vehicle/trailer readiness panel', resolvedRule: 'asset readiness is authoritative and clear' },
  { signalType: 'asset_compliance', sourceTypes: ['asset_compliance'], identityRule: 'company + asset compliance source id', fingerprintRule: 'test/inspection due date and status', navigationRule: 'fleet compliance panel', resolvedRule: 'authoritative compliance state is current' },
  { signalType: 'job_acknowledgement', sourceTypes: ['fleet_event', 'job_acknowledgement'], identityRule: 'company + event/assignment id', fingerprintRule: 'acknowledgement state and assignment state', navigationRule: 'job or message workspace', resolvedRule: 'authoritative acknowledgement is recorded' },
  { signalType: 'job_exception', sourceTypes: ['job_assignment', 'job_exception'], identityRule: 'company + assignment id', fingerprintRule: 'assignment lifecycle and exception state', navigationRule: 'job workspace', resolvedRule: 'assignment lifecycle leaves the exception state' },
  { signalType: 'tacho_warning', sourceTypes: ['shift', 'tacho_warning'], identityRule: 'company + shift/tacho source id', fingerprintRule: 'authoritative hours/acknowledgement warning state', navigationRule: 'driver compliance workspace', resolvedRule: 'authoritative warning is cleared' },
  { signalType: 'reconciliation_health', sourceTypes: ['reconciliation_health'], identityRule: 'company + reconciliation run/source id', fingerprintRule: 'source freshness and reconciliation outcome', navigationRule: 'operations health workspace', resolvedRule: 'the next authoritative reconciliation is healthy' },
  { signalType: 'atlas_proposal', sourceTypes: ['atlas_signal', 'atlas_proposal'], identityRule: 'company + proposal id', fingerprintRule: 'proposal status and safe state fingerprint', navigationRule: 'Atlas proposal review', resolvedRule: 'proposal is approved, rejected, withdrawn, or superseded' },
];

export function canonicalSignalKey(sourceType: OperationalSignalSource, sourceId: string): string { return `${sourceType}:${sourceId}`; }
export function canonicalCompanySignalKey(companyId: string, sourceType: OperationalSignalSource, sourceId: string): string { return `${companyId}:${canonicalSignalKey(sourceType, sourceId)}`; }
export function canonicalTaskKey(signal: Pick<CanonicalOperationalSignal, 'sourceType' | 'sourceId'>): string { return `task:${canonicalSignalKey(signal.sourceType, signal.sourceId)}`; }
export function canonicalCompanyTaskKey(companyId: string, signal: Pick<CanonicalOperationalSignal, 'sourceType' | 'sourceId'>): string { return `task:${canonicalCompanySignalKey(companyId, signal.sourceType, signal.sourceId)}`; }

export function findSignalProducer(sourceType: OperationalSignalSource): SignalProducerDefinition | null { return SIGNAL_PRODUCER_REGISTRY.find((definition) => definition.sourceTypes.includes(sourceType)) ?? null; }
export function buildCanonicalOperationalSignal(input: CanonicalSignalInput): CanonicalOperationalSignal { return { ...input }; }
export function adaptOperationalTaskToCanonicalSignal(task: Pick<OperationalTask, 'sourceType' | 'sourceId' | 'severity' | 'title' | 'detail' | 'navigationTarget' | 'actionable' | 'occurredAt'>, companyId: string, fingerprint: string, resolved = false): CanonicalOperationalSignal {
  const sourceType = task.sourceType as OperationalSignalSource;
  const producer = findSignalProducer(sourceType);
  if (!producer) throw new Error(`No canonical producer registered for ${task.sourceType}`);
  return buildCanonicalOperationalSignal({ companyId, sourceType, sourceId: task.sourceId, signalType: producer.signalType, fingerprint, severity: task.severity, title: task.title, detail: task.detail, navigationTarget: task.navigationTarget, resolved, observedAt: task.occurredAt, relationships: [], actionable: task.actionable });
}

export function projectOperationalSignal(signal: CanonicalOperationalSignal): CanonicalTaskProjection | null {
  if (signal.resolved) return null;
  return { taskKey: signal.companyId ? canonicalCompanyTaskKey(signal.companyId, signal) : canonicalTaskKey(signal), sourceSignalKey: signal.companyId ? canonicalCompanySignalKey(signal.companyId, signal.sourceType, signal.sourceId) : canonicalSignalKey(signal.sourceType, signal.sourceId), sourceType: signal.sourceType, sourceId: signal.sourceId, severity: signal.severity, actionable: signal.actionable ?? true, navigationTarget: signal.navigationTarget, signalType: signal.signalType };
}
export function dedupeOperationalSignals(signals: readonly CanonicalOperationalSignal[]): CanonicalOperationalSignal[] {
  const byKey = new Map<string, CanonicalOperationalSignal>();
  for (const signal of signals) { const key = signal.companyId ? canonicalCompanySignalKey(signal.companyId, signal.sourceType, signal.sourceId) : canonicalSignalKey(signal.sourceType, signal.sourceId); const previous = byKey.get(key); if (!previous || severityRank(signal.severity) < severityRank(previous.severity) || signal.fingerprint !== previous.fingerprint) byKey.set(key, signal); }
  return [...byKey.values()];
}
export function taskProjectionForExistingTask(task: Pick<OperationalTask, 'sourceType' | 'sourceId' | 'severity' | 'actionable'>): CanonicalTaskProjection { return { taskKey: canonicalTaskKey({ sourceType: task.sourceType as OperationalSignalSource, sourceId: task.sourceId }), sourceSignalKey: canonicalSignalKey(task.sourceType as OperationalSignalSource, task.sourceId), sourceType: task.sourceType as OperationalSignalSource, sourceId: task.sourceId, severity: task.severity, actionable: task.actionable }; }
function severityRank(value: OperationalTaskSeverity): number { return value === 'critical' ? 0 : value === 'high' ? 1 : value === 'medium' ? 2 : 3; }
