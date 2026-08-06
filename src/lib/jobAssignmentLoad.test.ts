import { describe, expect, it } from 'vitest';
import {
  INITIAL_JOB_ASSIGNMENT_LOAD,
  isJobAssignmentLoadReady,
  isJobSequenceCollision,
  jobAssignmentLoadReducer,
  type JobAssignmentRow,
} from './jobAssignmentLoad';

function assignment(id: string, sequence: number): JobAssignmentRow {
  return {
    id,
    sequence,
    status: 'published',
    planned_arrival_at: null,
    planned_departure_at: null,
    expected_duration_minutes: null,
    jobs: null,
  };
}

describe('job assignment loading contract', () => {
  it('starts a load for a shift and clears any prior confirmed data', () => {
    const confirmed = jobAssignmentLoadReducer(
      jobAssignmentLoadReducer(INITIAL_JOB_ASSIGNMENT_LOAD, { type: 'begin', shiftId: 'shift-a', requestToken: 1 }),
      { type: 'resolve', requestToken: 1, shiftId: 'shift-a', assignments: [assignment('a1', 1)], error: null }
    );
    expect(isJobAssignmentLoadReady(confirmed, 'shift-a')).toBe(true);

    const next = jobAssignmentLoadReducer(confirmed, { type: 'begin', shiftId: 'shift-b', requestToken: 2 });
    expect(next.loading).toBe(true);
    expect(next.loadedShiftId).toBe('');
    expect(next.assignments).toEqual([]);
    expect(isJobAssignmentLoadReady(next, 'shift-b')).toBe(false);
  });

  it('ignores a stale response from an older shift selection', () => {
    let state = jobAssignmentLoadReducer(INITIAL_JOB_ASSIGNMENT_LOAD, { type: 'begin', shiftId: 'shift-a', requestToken: 1 });
    state = jobAssignmentLoadReducer(state, { type: 'begin', shiftId: 'shift-b', requestToken: 2 });
    const afterStale = jobAssignmentLoadReducer(state, {
      type: 'resolve',
      requestToken: 1,
      shiftId: 'shift-a',
      assignments: [assignment('stale', 99)],
      error: null,
    });
    expect(afterStale).toEqual(state);
    expect(afterStale.assignments).toEqual([]);
    expect(isJobAssignmentLoadReady(afterStale, 'shift-a')).toBe(false);
  });

  it('ignores a resolve for a shift that is no longer loading', () => {
    let state = jobAssignmentLoadReducer(INITIAL_JOB_ASSIGNMENT_LOAD, { type: 'begin', shiftId: 'shift-a', requestToken: 1 });
    state = jobAssignmentLoadReducer(state, { type: 'begin', shiftId: 'shift-b', requestToken: 2 });
    const afterWrongShift = jobAssignmentLoadReducer(state, {
      type: 'resolve',
      requestToken: 2,
      shiftId: 'shift-a',
      assignments: [assignment('wrong', 1)],
      error: null,
    });
    expect(afterWrongShift).toEqual(state);
  });

  it('a failed load leaves the selected shift unresolved and publication disallowed', () => {
    let state = jobAssignmentLoadReducer(INITIAL_JOB_ASSIGNMENT_LOAD, { type: 'begin', shiftId: 'shift-a', requestToken: 1 });
    state = jobAssignmentLoadReducer(state, {
      type: 'resolve',
      requestToken: 1,
      shiftId: 'shift-a',
      assignments: null,
      error: 'connection failed',
    });
    expect(state.error).toBe('connection failed');
    expect(state.loading).toBe(false);
    expect(state.loadedShiftId).toBe('');
    expect(state.assignments).toEqual([]);
    expect(isJobAssignmentLoadReady(state, 'shift-a')).toBe(false);
  });

  it('a confirmed load enables readiness for only its own shift', () => {
    let state = jobAssignmentLoadReducer(INITIAL_JOB_ASSIGNMENT_LOAD, { type: 'begin', shiftId: 'shift-a', requestToken: 1 });
    state = jobAssignmentLoadReducer(state, {
      type: 'resolve',
      requestToken: 1,
      shiftId: 'shift-a',
      assignments: [assignment('a1', 1), assignment('a2', 2)],
      error: null,
    });
    expect(isJobAssignmentLoadReady(state, 'shift-a')).toBe(true);
    expect(isJobAssignmentLoadReady(state, 'shift-b')).toBe(false);
    expect(isJobAssignmentLoadReady(state, '')).toBe(false);
  });

  it('clearing the shift resets to a clean unresolved state', () => {
    let state = jobAssignmentLoadReducer(INITIAL_JOB_ASSIGNMENT_LOAD, { type: 'begin', shiftId: 'shift-a', requestToken: 1 });
    state = jobAssignmentLoadReducer(state, {
      type: 'resolve',
      requestToken: 1,
      shiftId: 'shift-a',
      assignments: [assignment('a1', 1)],
      error: null,
    });
    const cleared = jobAssignmentLoadReducer(state, { type: 'begin', shiftId: '', requestToken: 2 });
    expect(cleared).toEqual(INITIAL_JOB_ASSIGNMENT_LOAD);
  });
});

describe('job sequence collision detection', () => {
  it('detects the Postgres unique-violation code', () => {
    expect(
      isJobSequenceCollision({
        code: '23505',
        message: 'duplicate key value violates unique constraint "job_assignments_shift_id_sequence_key"',
      })
    ).toBe(true);
  });

  it('detects unique-constraint wording from other error shapes', () => {
    expect(isJobSequenceCollision(new Error('duplicate key value violates unique constraint'))).toBe(true);
    expect(isJobSequenceCollision(new Error('unique constraint violated on job_assignments'))).toBe(true);
  });

  it('does not flag unrelated errors', () => {
    expect(isJobSequenceCollision(new Error('Shift not found'))).toBe(false);
    expect(isJobSequenceCollision(null)).toBe(false);
    expect(isJobSequenceCollision('just a string')).toBe(false);
  });
});
