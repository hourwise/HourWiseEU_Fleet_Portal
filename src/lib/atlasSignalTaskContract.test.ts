import { describe, expect, it } from 'vitest';
import { canonicalSignalKey, canonicalTaskKey, dedupeOperationalSignals, projectOperationalSignal, taskProjectionForExistingTask } from './atlasSignalTaskContract';

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
});
