/**
 * Weekly roster request authority.
 *
 * Each weekly roster load (drivers, vehicles, shifts and the linked job
 * summaries) is identified by a monotonic request token allocated the moment
 * the week load starts. Only the latest request may settle the load, so a
 * slower older week can never clear loading for, or replace, a newer week.
 */

export interface WeeklyRosterLoadState {
  requestToken: number;
  /** Week start (yyyy-MM-dd) of the latest authoritative request; '' when none. */
  weekStart: string;
  loading: boolean;
}

export const INITIAL_WEEKLY_ROSTER_LOAD: WeeklyRosterLoadState = {
  requestToken: 0,
  weekStart: '',
  loading: true,
};

export type WeeklyRosterLoadAction =
  | { type: 'begin'; requestToken: number; weekStart: string }
  | { type: 'settle'; requestToken: number };

export function weeklyRosterLoadReducer(
  state: WeeklyRosterLoadState,
  action: WeeklyRosterLoadAction
): WeeklyRosterLoadState {
  switch (action.type) {
    case 'begin':
      return { requestToken: action.requestToken, weekStart: action.weekStart, loading: true };
    case 'settle': {
      // Only the latest request may finish the load; a stale week's completion
      // must never clear loading for a newer request.
      if (action.requestToken !== state.requestToken) return state;
      return { ...state, loading: false };
    }
  }
}
