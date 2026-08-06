/**
 * Which manager actions are valid for a given shift status.
 *
 * Kept as pure helpers so the rota card actions and their tests stay focused
 * and consistent with the ROTA-002 status model.
 */

export type ShiftStatus = 'draft' | 'published' | 'updated' | 'cancelled';

/** Jobs can only be planned against a shift that is on the driver rota: published or updated. */
export function canPlanJobsForShift(status: ShiftStatus): boolean {
  return status === 'published' || status === 'updated';
}

/** Draft and updated shifts can be published (or re-published after a manager edit). */
export function canPublishShift(status: ShiftStatus): boolean {
  return status === 'draft' || status === 'updated';
}

/** Cancelled shifts are already off the rota and cannot be cancelled again. */
export function canCancelShift(status: ShiftStatus): boolean {
  return status !== 'cancelled';
}
