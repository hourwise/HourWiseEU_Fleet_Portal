/**
 * Job-assignment loading contract for the Job Planner.
 *
 * Assignment data (and the derived "next safe sequence") are only usable when
 * they are confirmed for the shift currently selected in the UI. This reducer
 * guarantees that a response from an older shift selection, or an
 * out-of-order response, can never become the active assignment state, and
 * that a failed load leaves the selected shift unresolved so publication stays
 * blocked until a confirmed load succeeds.
 */

export interface JobAssignmentRow {
  id: string;
  vehicle_id?: string | null;
  trailer_id?: string | null;
  sequence: number;
  status: string;
  updated_at: string;
  planned_arrival_at: string | null;
  planned_departure_at: string | null;
  expected_duration_minutes: number | null;
  jobs: {
    id: string;
    updated_at: string;
    reference: string;
    title: string;
    job_type: string;
    customer_name: string | null;
    address_text: string;
    contact_name: string | null;
    contact_phone: string | null;
    instructions: string | null;
  } | null;
}

export interface JobAssignmentLoadState {
  /** Shift the current assignments are confirmed for ('' when unresolved). */
  loadedShiftId: string;
  /** Shift currently being loaded ('' when idle). */
  loadingShiftId: string;
  /** Monotonic token of the latest begin; a resolve is ignored unless it matches. */
  requestToken: number;
  assignments: JobAssignmentRow[];
  loading: boolean;
  error: string | null;
}

export const INITIAL_JOB_ASSIGNMENT_LOAD: JobAssignmentLoadState = {
  loadedShiftId: '',
  loadingShiftId: '',
  requestToken: 0,
  assignments: [],
  loading: false,
  error: null,
};

export type JobAssignmentLoadAction =
  | { type: 'begin'; shiftId: string; requestToken: number }
  | {
      type: 'resolve';
      requestToken: number;
      shiftId: string;
      assignments: JobAssignmentRow[] | null;
      error: string | null;
    };

export function jobAssignmentLoadReducer(
  state: JobAssignmentLoadState,
  action: JobAssignmentLoadAction
): JobAssignmentLoadState {
  switch (action.type) {
    case 'begin': {
      if (!action.shiftId) {
        // No shift selected: reset to a clean, unresolved state.
        return INITIAL_JOB_ASSIGNMENT_LOAD;
      }
      return {
        loadedShiftId: '',
        loadingShiftId: action.shiftId,
        requestToken: action.requestToken,
        assignments: [],
        loading: true,
        error: null,
      };
    }
    case 'resolve': {
      // A response only applies when it belongs to the latest request for the
      // shift currently loading; stale or out-of-order responses are dropped.
      if (action.requestToken !== state.requestToken) return state;
      if (state.loadingShiftId !== action.shiftId) return state;
      if (action.error) {
        return {
          ...state,
          loadedShiftId: '',
          loadingShiftId: '',
          assignments: [],
          loading: false,
          error: action.error,
        };
      }
      return {
        ...state,
        loadedShiftId: action.shiftId,
        loadingShiftId: '',
        assignments: action.assignments ?? [],
        loading: false,
        error: null,
      };
    }
  }
}

/** Assignments are usable only when confirmed for the given shift and not loading/failed. */
export function isJobAssignmentLoadReady(state: JobAssignmentLoadState, shiftId: string): boolean {
  return Boolean(shiftId) && state.loadedShiftId === shiftId && !state.loading && !state.error;
}

/** Detect a unique (shift_id, sequence) collision raised by the publication RPC. */
export function isJobSequenceCollision(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === '23505') return true;
  if (typeof candidate.message === 'string') {
    return /unique constraint|duplicate key/i.test(candidate.message);
  }
  return false;
}

/** Detect the serializable/stale-version error returned by lifecycle RPCs. */
export function isJobAssignmentStale(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === '40001') return true;
  return typeof candidate.message === 'string' && /changed since it was loaded|stale/i.test(candidate.message);
}
