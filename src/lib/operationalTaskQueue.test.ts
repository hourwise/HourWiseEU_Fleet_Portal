import { describe, expect, it } from 'vitest';
import { buildOperationalTasks } from './operationalTaskQueue';

describe('operational task queue', () => {
  it('projects deterministic tasks with stable source ids and safe wording', () => {
    const tasks = buildOperationalTasks({
      now: new Date('2026-08-14T12:00:00Z'),
      events: [{ id: 'event-1', priority: 'warning', title: 'Rota change', body: 'Please acknowledge', created_at: '2026-08-14T08:00:00Z', requires_ack: true }],
      acknowledgedEventIds: [],
      defects: [{ id: 'check-1', reg_number: 'HW01', check_status: 'defect', defect_lifecycle_status: null, defect_details: 'Brake concern', created_at: '2026-08-14T07:00:00Z' }],
      assignments: [{ id: 'assignment-1', shift_id: 'shift-1', status: 'vehicle_issue', driver_id: 'driver-1', vehicle_id: 'vehicle-1', planned_arrival_at: '2026-08-14T10:00:00Z', updated_at: '2026-08-14T10:15:00Z' }],
      shifts: [{ id: 'shift-1', date: '2026-08-14', status: 'published', vehicle_id: 'vehicle-1', updated_at: '2026-08-14T06:00:00Z' }],
    });

    expect(tasks.map((task) => task.id)).toEqual(['job-exception:assignment-1', 'defect:check-1', 'event:event-1']);
    expect(tasks.find((task) => task.id === 'job-exception:assignment-1')?.detail).not.toContain('late');
    expect(tasks.every((task) => task.navigationTarget.startsWith('/dashboard?'))).toBe(true);
  });

  it('does not create acknowledgement or no-start tasks after completion', () => {
    const tasks = buildOperationalTasks({
      now: new Date('2026-08-14T12:00:00Z'),
      assignments: [{ id: 'assignment-2', shift_id: 'shift-2', status: 'completed', driver_id: 'driver-1', vehicle_id: null, planned_arrival_at: '2026-08-14T10:00:00Z', updated_at: '2026-08-14T11:00:00Z' }],
      shifts: [{ id: 'shift-2', date: '2026-08-14', status: 'published', vehicle_id: null, updated_at: '2026-08-14T06:00:00Z' }],
    });
    expect(tasks).toHaveLength(0);
  });

  it('projects one stable task per pending or follow-up evidence record', () => {
    const tasks = buildOperationalTasks({ podEvidence: [{ id: 'evidence-1', evidence_type: 'pod', outcome: 'delivered', review_status: 'needs_follow_up', uploaded_at: '2026-08-14T08:00:00Z', job_id: 'job-1', job_assignment_id: 'assignment-1' }] });
    expect(tasks).toMatchObject([{ id: 'pod-review:evidence-1', severity: 'high', sourceType: 'job_evidence', sourceId: 'evidence-1' }]);
    expect(tasks[0].navigationTarget).toContain('panel=pod-review');
  });
});
