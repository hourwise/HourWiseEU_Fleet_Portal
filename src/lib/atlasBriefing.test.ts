import { describe, expect, it } from 'vitest';
import { buildAtlasBriefing, buildAtlasMorningBriefing } from './atlasBriefing';

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

describe('change-aware Atlas morning briefing', () => {
  it('keeps the required sections, deduplicates repeated source signals, and marks known warnings', () => {
    const signals = [
      { signalKey: 'compliance:driver:driver-1:medical', fingerprint: 'missing', section: 'next30' as const, severity: 'warning' as const, title: 'Medical evidence is missing', detail: 'Review the document', sourceLabel: 'Driver compliance', href: '/drivers' },
      { signalKey: 'compliance:driver:driver-1:medical', fingerprint: 'missing', section: 'next30' as const, severity: 'warning' as const, title: 'Duplicate medical task', detail: 'Duplicate source', sourceLabel: 'Task queue', href: '/tasks' },
      { signalKey: 'job:assignment-1', fingerprint: 'exception-v1', section: 'yesterday' as const, severity: 'critical' as const, title: 'Unresolved job exception', detail: 'Review job', sourceLabel: 'Job execution', href: '/jobs' },
    ];
    const briefing = buildAtlasMorningBriefing(signals, new Map([['job:assignment-1', { isNew: false, firstSeenAt: '2026-08-17T08:00:00Z' }]]), new Date('2026-08-18T08:00:00Z'));
    expect(Object.keys(briefing.sections)).toEqual(['yesterday', 'today', 'tomorrow', 'next30']);
    expect(briefing.totalItems).toBe(2);
    expect(briefing.sections.yesterday[0].isNew).toBe(false);
    expect(briefing.sections.next30[0].sourceLabel).toBe('Driver compliance');
    expect(briefing.sections.next30[0].isNew).toBe(true);
  });
});
