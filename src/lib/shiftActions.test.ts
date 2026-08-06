import { describe, expect, it } from 'vitest';
import { canCancelShift, canPlanJobsForShift, canPublishShift, type ShiftStatus } from './shiftActions';

const STATUSES: ShiftStatus[] = ['draft', 'published', 'updated', 'cancelled'];

describe('shift action availability helpers', () => {
  it('allows job planning only for published and updated shifts', () => {
    expect(STATUSES.filter(canPlanJobsForShift)).toEqual(['published', 'updated']);
  });

  it('allows publishing only for draft and updated shifts', () => {
    expect(STATUSES.filter(canPublishShift)).toEqual(['draft', 'updated']);
  });

  it('allows cancellation for every state except cancelled', () => {
    expect(STATUSES.filter(canCancelShift)).toEqual(['draft', 'published', 'updated']);
  });
});
