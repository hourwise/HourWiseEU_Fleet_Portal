import { describe, expect, it } from 'vitest';
import { INITIAL_WEEKLY_ROSTER_LOAD, weeklyRosterLoadReducer } from './weeklyRosterLoad';
import { INITIAL_WEEKLY_JOB_SUMMARY_LOAD, weeklyJobSummaryLoadReducer } from './weeklyJobSummaryLoad';

const activeSummary = () => ({ activeJobCount: 1, firstJob: null });

describe('separate roster and summary request authority', () => {
  it('a summary retry does not change roster request authority', () => {
    // Roster load begins with its own roster token.
    const roster = weeklyRosterLoadReducer(INITIAL_WEEKLY_ROSTER_LOAD, { type: 'begin', requestToken: 5, weekStart: '2026-08-03' });
    // Summary retry allocates a separate summary token; roster state untouched.
    weeklyJobSummaryLoadReducer(INITIAL_WEEKLY_JOB_SUMMARY_LOAD, { type: 'begin', requestToken: 6, weekStart: '2026-08-03' });
    expect(roster.requestToken).toBe(5);
    expect(roster.weekStart).toBe('2026-08-03');
    expect(roster.loading).toBe(true);
  });

  it('an in-flight current roster request can still settle after a summary retry', () => {
    let roster = weeklyRosterLoadReducer(INITIAL_WEEKLY_ROSTER_LOAD, { type: 'begin', requestToken: 5, weekStart: '2026-08-03' });
    // Summary retry runs concurrently with the roster load.
    weeklyJobSummaryLoadReducer(INITIAL_WEEKLY_JOB_SUMMARY_LOAD, { type: 'begin', requestToken: 6, weekStart: '2026-08-03' });
    // The roster request is still authoritative and settles normally.
    roster = weeklyRosterLoadReducer(roster, { type: 'settle', requestToken: 5 });
    expect(roster.loading).toBe(false);
    expect(roster.weekStart).toBe('2026-08-03');
  });

  it('a summary retry supersedes an older summary request and stale responses are ignored', () => {
    let summary = weeklyJobSummaryLoadReducer(INITIAL_WEEKLY_JOB_SUMMARY_LOAD, { type: 'begin', requestToken: 5, weekStart: '2026-08-03' });
    summary = weeklyJobSummaryLoadReducer(summary, { type: 'begin', requestToken: 6, weekStart: '2026-08-03' });
    // Older summary response arrives late — dropped.
    summary = weeklyJobSummaryLoadReducer(summary, {
      type: 'resolve',
      requestToken: 5,
      weekStart: '2026-08-03',
      summaries: { 'stale-shift': activeSummary() },
      error: null,
    });
    expect(summary.summaries).toEqual({});
    // Retry response applies.
    summary = weeklyJobSummaryLoadReducer(summary, {
      type: 'resolve',
      requestToken: 6,
      weekStart: '2026-08-03',
      summaries: { 'shift-a': activeSummary() },
      error: null,
    });
    expect(summary.loading).toBe(false);
    expect(summary.summaries).toHaveProperty('shift-a');
  });

  it('Week A stale roster response cannot begin authoritative summaries after Week B starts', () => {
    // Roster authority: Week B is current.
    let roster = weeklyRosterLoadReducer(INITIAL_WEEKLY_ROSTER_LOAD, { type: 'begin', requestToken: 1, weekStart: '2026-08-03' });
    roster = weeklyRosterLoadReducer(roster, { type: 'begin', requestToken: 2, weekStart: '2026-08-10' });
    // Week A settles late — rejected; Week B remains authoritative.
    roster = weeklyRosterLoadReducer(roster, { type: 'settle', requestToken: 1 });
    expect(roster.weekStart).toBe('2026-08-10');

    // Summary authority mirrors it: only Week B's begin can produce summaries;
    // Week A's late resolve is dropped and cannot manufacture summaries.
    let summary = weeklyJobSummaryLoadReducer(INITIAL_WEEKLY_JOB_SUMMARY_LOAD, { type: 'begin', requestToken: 1, weekStart: '2026-08-03' });
    summary = weeklyJobSummaryLoadReducer(summary, { type: 'begin', requestToken: 2, weekStart: '2026-08-10' });
    summary = weeklyJobSummaryLoadReducer(summary, {
      type: 'resolve',
      requestToken: 1,
      weekStart: '2026-08-03',
      summaries: { 'stale-shift': activeSummary() },
      error: null,
    });
    expect(summary.summaries).toEqual({});
    expect(summary.loadedWeekStart).toBe('');
  });
});
