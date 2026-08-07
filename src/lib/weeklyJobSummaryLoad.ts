/**
 * Load-state reducer for the weekly shift-job summary lookup.
 *
 * Keeps summary loading and errors separate from the core roster load and
 * guards against out-of-order week responses with a monotonic request token,
 * so an older week's slower response can never replace the currently shown
 * week's summaries.
 */

import type { ShiftJobSummary } from './shiftJobSummary';

export interface WeeklyJobSummaryLoadState {
  loading: boolean;
  error: string | null;
  requestToken: number;
  /** Week start (yyyy-MM-dd) the current summaries belong to; '' when none. */
  loadedWeekStart: string;
  summaries: Record<string, ShiftJobSummary>;
}

export const INITIAL_WEEKLY_JOB_SUMMARY_LOAD: WeeklyJobSummaryLoadState = {
  loading: false,
  error: null,
  requestToken: 0,
  loadedWeekStart: '',
  summaries: {},
};

export type WeeklyJobSummaryLoadAction =
  | { type: 'begin'; requestToken: number; weekStart: string }
  | {
      type: 'resolve';
      requestToken: number;
      weekStart: string;
      summaries: Record<string, ShiftJobSummary> | null;
      error: string | null;
    };

export function weeklyJobSummaryLoadReducer(
  state: WeeklyJobSummaryLoadState,
  action: WeeklyJobSummaryLoadAction
): WeeklyJobSummaryLoadState {
  switch (action.type) {
    case 'begin': {
      // Invalidate any previous week's summaries and mark the new week pending.
      return {
        loading: true,
        error: null,
        requestToken: action.requestToken,
        loadedWeekStart: '',
        summaries: {},
      };
    }
    case 'resolve': {
      // Only the latest request may resolve; stale week responses are dropped.
      if (action.requestToken !== state.requestToken) return state;
      if (action.error) {
        return {
          ...state,
          loading: false,
          error: action.error,
          loadedWeekStart: '',
          summaries: {},
        };
      }
      return {
        ...state,
        loading: false,
        error: null,
        loadedWeekStart: action.weekStart,
        summaries: action.summaries ?? {},
      };
    }
  }
}
