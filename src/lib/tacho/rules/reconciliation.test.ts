import { describe, expect, it } from 'vitest';

import type { WorkSession } from '../../compliance';
import { buildDayActivities } from './testFixtures';
import { buildAppTachoReconciliationItems, evaluateAppTachoReconciliation } from './reconciliation';

function buildSession(
  startTime: string,
  drivingMins: number
): WorkSession {
  return {
    start_time: startTime,
    end_time: startTime,
    total_work_minutes: drivingMins,
    total_break_minutes: 0,
    other_data: { driving: drivingMins },
  };
}

describe('buildAppTachoReconciliationItems', () => {
  it('marks aligned daily totals as matched', () => {
    const activities = buildDayActivities('2026-05-01', [
      { start: '08:00', end: '10:00', activityType: 'driving' },
      { start: '10:30', end: '12:00', activityType: 'driving' },
    ]);
    const items = buildAppTachoReconciliationItems(activities, [
      buildSession('2026-05-01T08:00:00.000Z', 210),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('matched');
  });

  it('flags tacho-only and app-only days separately', () => {
    const activities = buildDayActivities('2026-05-02', [
      { start: '07:00', end: '09:00', activityType: 'driving' },
    ]);
    const items = buildAppTachoReconciliationItems(activities, [
      buildSession('2026-05-01T08:00:00.000Z', 120),
    ]);

    expect(items).toHaveLength(2);
    expect(items.find((item) => item.date === '2026-05-02')?.status).toBe('tacho_only');
    expect(items.find((item) => item.date === '2026-05-01')?.status).toBe('app_only');
  });

  it('flags duration mismatches when daily totals differ by 30 minutes or more', () => {
    const activities = buildDayActivities('2026-05-03', [
      { start: '08:00', end: '11:00', activityType: 'driving' },
    ]);
    const items = buildAppTachoReconciliationItems(activities, [
      buildSession('2026-05-03T08:00:00.000Z', 120),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('mismatch_duration');
  });
});

describe('evaluateAppTachoReconciliation', () => {
  it('creates findings only for non-matched reconciliation days', () => {
    const activities = [
      ...buildDayActivities('2026-05-04', [{ start: '08:00', end: '11:00', activityType: 'driving' }]),
      ...buildDayActivities('2026-05-05', [{ start: '08:00', end: '10:00', activityType: 'driving' }]),
    ];
    const sessions = [
      buildSession('2026-05-04T08:00:00.000Z', 180),
      buildSession('2026-05-05T08:00:00.000Z', 60),
    ];

    const findings = evaluateAppTachoReconciliation('driver-1', activities, sessions);

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleCode).toBe('DISC_APP_TACHO_MISMATCH');
    expect(findings[0].summary).toContain('differ');
  });
});
