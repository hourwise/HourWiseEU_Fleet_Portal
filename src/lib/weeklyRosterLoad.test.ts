import { describe, expect, it } from 'vitest';
import {
  INITIAL_WEEKLY_ROSTER_LOAD,
  weeklyRosterLoadReducer,
} from './weeklyRosterLoad';

describe('weekly roster load reducer', () => {
  it('tracks the latest authoritative weekly request', () => {
    let state = weeklyRosterLoadReducer(INITIAL_WEEKLY_ROSTER_LOAD, { type: 'begin', requestToken: 1, weekStart: '2026-08-03' });
    state = weeklyRosterLoadReducer(state, { type: 'begin', requestToken: 2, weekStart: '2026-08-10' });
    expect(state.requestToken).toBe(2);
    expect(state.weekStart).toBe('2026-08-10');
    expect(state.loading).toBe(true);
  });

  it('rejects a stale week completion from an older request', () => {
    let state = weeklyRosterLoadReducer(INITIAL_WEEKLY_ROSTER_LOAD, { type: 'begin', requestToken: 1, weekStart: '2026-08-03' });
    state = weeklyRosterLoadReducer(state, { type: 'begin', requestToken: 2, weekStart: '2026-08-10' });
    const afterStaleSettle = weeklyRosterLoadReducer(state, { type: 'settle', requestToken: 1 });
    expect(afterStaleSettle).toEqual(state);
    expect(afterStaleSettle.loading).toBe(true);
  });

  it('Week B remains authoritative when Week A resolves late', () => {
    // Week A starts.
    let state = weeklyRosterLoadReducer(INITIAL_WEEKLY_ROSTER_LOAD, { type: 'begin', requestToken: 1, weekStart: '2026-08-03' });
    // Week B starts.
    state = weeklyRosterLoadReducer(state, { type: 'begin', requestToken: 2, weekStart: '2026-08-10' });
    // Week B settles first.
    state = weeklyRosterLoadReducer(state, { type: 'settle', requestToken: 2 });
    expect(state.weekStart).toBe('2026-08-10');
    expect(state.loading).toBe(false);
    // Week A settles late — ignored; Week B remains authoritative.
    const afterStale = weeklyRosterLoadReducer(state, { type: 'settle', requestToken: 1 });
    expect(afterStale).toEqual(state);
    expect(afterStale.weekStart).toBe('2026-08-10');
    expect(afterStale.loading).toBe(false);
  });

  it('lets only the latest request clear the load', () => {
    let state = weeklyRosterLoadReducer(INITIAL_WEEKLY_ROSTER_LOAD, { type: 'begin', requestToken: 1, weekStart: '2026-08-03' });
    state = weeklyRosterLoadReducer(state, { type: 'begin', requestToken: 2, weekStart: '2026-08-10' });
    const settled = weeklyRosterLoadReducer(state, { type: 'settle', requestToken: 2 });
    expect(settled.loading).toBe(false);
    expect(settled.weekStart).toBe('2026-08-10');
  });
});
