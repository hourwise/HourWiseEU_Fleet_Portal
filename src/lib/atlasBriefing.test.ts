import { describe, expect, it } from 'vitest';
import { buildAtlasBriefing } from './atlasBriefing';

describe('deterministic Atlas briefing', () => {
  it('creates traceable items from structured counts', () => {
    const items = buildAtlasBriefing({
      today: '2026-08-14',
      shiftsToday: 4,
      unallocatedJobsToday: 1,
      prohibitedAssets: 1,
      actionRequiredAssets: 0,
      unknownAssets: 2,
      outstandingAcknowledgements: 2,
      openSafetyDefects: 1,
      expiringComplianceItems: 3,
      delayedOrIncompleteJobs: 0,
    });
    expect(items.map((item) => item.id)).toEqual(['assets-prohibited', 'defects-open', 'jobs-unallocated', 'acknowledgements', 'compliance-expiring', 'assets-unknown']);
    expect(items.every((item) => item.href.startsWith('/dashboard?'))).toBe(true);
  });

  it('does not invent healthy claims when the rota is empty', () => {
    const items = buildAtlasBriefing({ today: '2026-08-14', shiftsToday: 0, unallocatedJobsToday: 0, prohibitedAssets: 0, actionRequiredAssets: 0, unknownAssets: 0, outstandingAcknowledgements: 0, openSafetyDefects: 0, expiringComplianceItems: 0, delayedOrIncompleteJobs: 0 });
    expect(items).toEqual([expect.objectContaining({ id: 'no-rota', title: 'No rota data is available for today' })]);
  });
});
