import { describe, expect, it } from 'vitest';
import {
  INITIAL_WEEKLY_JOB_SUMMARY_LOAD,
  weeklyJobSummaryLoadReducer,
} from './weeklyJobSummaryLoad';

describe('weekly job summary load reducer', () => {
  it('begin invalidates any previous week summaries and marks the new week pending', () => {
    let state = weeklyJobSummaryLoadReducer(INITIAL_WEEKLY_JOB_SUMMARY_LOAD, {
      type: 'begin',
      requestToken: 1,
      weekStart: '2026-08-03',
    });
    state = weeklyJobSummaryLoadReducer(state, {
      type: 'resolve',
      requestToken: 1,
      weekStart: '2026-08-03',
      summaries: { 'shift-a': { activeJobCount: 2, firstJob: null } },
      error: null,
    });
    expect(state.loading).toBe(false);
    expect(state.summaries).toHaveProperty('shift-a');

    const next = weeklyJobSummaryLoadReducer(state, { type: 'begin', requestToken: 2, weekStart: '2026-08-10' });
    expect(next.loading).toBe(true);
    expect(next.loadedWeekStart).toBe('');
    expect(next.summaries).toEqual({});
  });

  it('ignores a stale response from an older week request', () => {
    let state = weeklyJobSummaryLoadReducer(INITIAL_WEEKLY_JOB_SUMMARY_LOAD, {
      type: 'begin',
      requestToken: 1,
      weekStart: '2026-08-03',
    });
    state = weeklyJobSummaryLoadReducer(state, { type: 'begin', requestToken: 2, weekStart: '2026-08-10' });
    const afterStale = weeklyJobSummaryLoadReducer(state, {
      type: 'resolve',
      requestToken: 1,
      weekStart: '2026-08-03',
      summaries: { 'stale-shift': { activeJobCount: 9, firstJob: null } },
      error: null,
    });
    expect(afterStale).toEqual(state);
    expect(afterStale.summaries).toEqual({});
  });

  it('applies only the latest request resolve', () => {
    let state = weeklyJobSummaryLoadReducer(INITIAL_WEEKLY_JOB_SUMMARY_LOAD, {
      type: 'begin',
      requestToken: 1,
      weekStart: '2026-08-03',
    });
    state = weeklyJobSummaryLoadReducer(state, { type: 'begin', requestToken: 2, weekStart: '2026-08-10' });
    const resolved = weeklyJobSummaryLoadReducer(state, {
      type: 'resolve',
      requestToken: 2,
      weekStart: '2026-08-10',
      summaries: { 'shift-b': { activeJobCount: 1, firstJob: null } },
      error: null,
    });
    expect(resolved.loading).toBe(false);
    expect(resolved.loadedWeekStart).toBe('2026-08-10');
    expect(resolved.summaries).toHaveProperty('shift-b');
  });

  it('a failed load clears summaries and preserves the error', () => {
    const state = weeklyJobSummaryLoadReducer(INITIAL_WEEKLY_JOB_SUMMARY_LOAD, {
      type: 'begin',
      requestToken: 1,
      weekStart: '2026-08-03',
    });
    const failed = weeklyJobSummaryLoadReducer(state, {
      type: 'resolve',
      requestToken: 1,
      weekStart: '2026-08-03',
      summaries: null,
      error: 'network down',
    });
    expect(failed.loading).toBe(false);
    expect(failed.error).toBe('network down');
    expect(failed.loadedWeekStart).toBe('');
    expect(failed.summaries).toEqual({});
  });
});
