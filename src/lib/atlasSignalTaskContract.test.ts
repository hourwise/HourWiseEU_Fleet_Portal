import { describe, expect, it } from 'vitest';
import { SIGNAL_PRODUCER_REGISTRY, adaptOperationalTaskToCanonicalSignal, canonicalCompanySignalKey, canonicalSignalKey, canonicalTaskKey, dedupeOperationalSignals, projectOperationalSignal, taskProjectionForExistingTask } from './atlasSignalTaskContract';

describe('Batch19 canonical operational signal/task contract', () => {
  it('projects one active source signal to one stable task key', () => {
    const signal = { sourceType: 'job_evidence' as const, sourceId: 'evidence-1', fingerprint: 'pending:v1', severity: 'high' as const, title: 'Review POD', detail: 'Review', navigationTarget: '/jobs', resolved: false };
    expect(canonicalSignalKey(signal.sourceType, signal.sourceId)).toBe('job_evidence:evidence-1');
    expect(projectOperationalSignal(signal)).toMatchObject({ taskKey: 'task:job_evidence:evidence-1', sourceSignalKey: 'job_evidence:evidence-1' });
    expect(projectOperationalSignal({ ...signal, resolved: true })).toBeNull();
  });
  it('deduplicates source signals while retaining the strongest current state', () => {
    const base = { sourceType: 'driver_compliance' as const, sourceId: 'driver-1', fingerprint: 'old', severity: 'medium' as const, title: 'Compliance', detail: 'Review', navigationTarget: '/drivers', resolved: false };
    const result = dedupeOperationalSignals([base, { ...base, fingerprint: 'new', severity: 'critical' }]);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('critical');
    expect(canonicalTaskKey(base)).toBe(taskProjectionForExistingTask({ sourceType: base.sourceType, sourceId: base.sourceId, severity: base.severity, actionable: true }).taskKey);
  });

  it('registers every canonical producer and keeps companies isolated', () => {
    expect(SIGNAL_PRODUCER_REGISTRY).toHaveLength(9);
    const task = { sourceType: 'job_evidence', sourceId: 'evidence-1', severity: 'high' as const, title: 'Review POD', detail: 'Review', navigationTarget: '/jobs', actionable: true, occurredAt: '2026-08-22T08:00:00Z' };
    const one = adaptOperationalTaskToCanonicalSignal(task, 'company-a', 'pending:v1');
    const two = adaptOperationalTaskToCanonicalSignal(task, 'company-b', 'pending:v1');
    expect(one.signalType).toBe('pod_review');
    expect(canonicalCompanySignalKey('company-a', one.sourceType, one.sourceId)).not.toBe(canonicalCompanySignalKey('company-b', two.sourceType, two.sourceId));
    expect(projectOperationalSignal({ ...one, resolved: true })).toBeNull();
  });
});
