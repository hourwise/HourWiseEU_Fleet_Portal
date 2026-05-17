import { describe, expect, it } from 'vitest';

import { evaluateDriverRules } from './engine';
import { buildDayActivities } from './testFixtures';
import type { RuleActivitySegment, TachoFinding } from './types';

function evaluate(activities: RuleActivitySegment[]) {
  return evaluateDriverRules({
    driverId: 'driver-1',
    vehicleId: 'vehicle-1',
    source: 'driver_card',
    activities,
  });
}

function findByRule(findings: TachoFinding[], ruleCode: string) {
  return findings.filter((finding) => finding.ruleCode === ruleCode);
}

describe('evaluateDriverRules', () => {
  it('accepts a valid 15 + 30 split break without raising a continuous driving breach', () => {
    const activities = buildDayActivities('2026-05-01', [
      { start: '08:00', end: '10:00', activityType: 'driving' },
      { start: '10:00', end: '10:15', activityType: 'rest' },
      { start: '10:15', end: '12:45', activityType: 'driving' },
      { start: '12:45', end: '13:15', activityType: 'rest' },
      { start: '13:15', end: '14:15', activityType: 'driving' },
    ]);

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'DRV_CONTINUOUS_4H30_EXCEEDED')).toHaveLength(0);
  });

  it('flags continuous driving when the second split break is too short', () => {
    const activities = buildDayActivities('2026-05-01', [
      { start: '08:00', end: '10:00', activityType: 'driving' },
      { start: '10:00', end: '10:15', activityType: 'rest' },
      { start: '10:15', end: '12:45', activityType: 'driving' },
      { start: '12:45', end: '13:05', activityType: 'rest' },
      { start: '13:05', end: '14:05', activityType: 'driving' },
    ]);

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'DRV_CONTINUOUS_4H30_EXCEEDED')).toHaveLength(1);
  });

  it('does not raise a weekly driving breach when only the full selected range exceeds 56 hours', () => {
    const activities = Array.from({ length: 8 }, (_, index) =>
      buildDayActivities(`2026-05-0${index + 1}`, [
        { start: '08:00', end: '12:00', activityType: 'driving' },
        { start: '12:00', end: '13:00', activityType: 'rest' },
        { start: '13:00', end: '17:00', activityType: 'driving' },
      ])
    ).flat();

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'DRV_WEEKLY_56H_EXCEEDED')).toHaveLength(0);
  });

  it('raises a weekly driving breach when a rolling 7-day period exceeds 56 hours', () => {
    const activities = Array.from({ length: 7 }, (_, index) =>
      buildDayActivities(`2026-05-0${index + 1}`, [
        { start: '08:00', end: '12:10', activityType: 'driving' },
        { start: '12:10', end: '13:00', activityType: 'rest' },
        { start: '13:00', end: '17:00', activityType: 'driving' },
      ])
    ).flat();

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'DRV_WEEKLY_56H_EXCEEDED')).toHaveLength(1);
  });

  it('does not raise a fortnight breach when only the total selected range exceeds 90 hours', () => {
    const activities = Array.from({ length: 15 }, (_, index) =>
      buildDayActivities(`2026-05-${String(index + 1).padStart(2, '0')}`, [
        { start: '08:00', end: '11:10', activityType: 'driving' },
        { start: '11:10', end: '12:00', activityType: 'rest' },
        { start: '12:00', end: '15:10', activityType: 'driving' },
      ])
    ).flat();

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'DRV_FORTNIGHT_90H_EXCEEDED')).toHaveLength(0);
  });

  it('raises a fortnight breach when a rolling 14-day period exceeds 90 hours', () => {
    const activities = Array.from({ length: 14 }, (_, index) =>
      buildDayActivities(`2026-05-${String(index + 1).padStart(2, '0')}`, [
        { start: '08:00', end: '11:15', activityType: 'driving' },
        { start: '11:15', end: '12:00', activityType: 'rest' },
        { start: '12:00', end: '15:15', activityType: 'driving' },
      ])
    ).flat();

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'DRV_FORTNIGHT_90H_EXCEEDED')).toHaveLength(1);
  });

  it('raises a 6-hour WTD break finding when the first 30 minutes of break come too late', () => {
    const activities = buildDayActivities('2026-05-01', [
      { start: '08:00', end: '14:15', activityType: 'work' },
      { start: '14:15', end: '14:45', activityType: 'rest' },
      { start: '14:45', end: '15:30', activityType: 'work' },
    ]);

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'WTD_BREAK_AFTER_6H_MISSING')).toHaveLength(1);
  });

  it('does not raise a 6-hour WTD finding when two 15-minute breaks happen before crossing 6 hours', () => {
    const activities = buildDayActivities('2026-05-01', [
      { start: '08:00', end: '10:45', activityType: 'work' },
      { start: '10:45', end: '11:00', activityType: 'rest' },
      { start: '11:00', end: '13:45', activityType: 'work' },
      { start: '13:45', end: '14:00', activityType: 'rest' },
      { start: '14:00', end: '15:00', activityType: 'work' },
    ]);

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'WTD_BREAK_AFTER_6H_MISSING')).toHaveLength(0);
  });

  it('raises a 9-hour WTD break finding when the final 15 minutes of break come too late', () => {
    const activities = buildDayActivities('2026-05-01', [
      { start: '08:00', end: '11:00', activityType: 'work' },
      { start: '11:00', end: '11:30', activityType: 'rest' },
      { start: '11:30', end: '17:45', activityType: 'work' },
      { start: '17:45', end: '18:00', activityType: 'rest' },
      { start: '18:00', end: '18:15', activityType: 'work' },
    ]);

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'WTD_BREAK_AFTER_9H_MISSING')).toHaveLength(1);
  });

  it('does not raise a 9-hour WTD finding when 45 minutes of qualifying break happen before crossing 9 hours', () => {
    const activities = buildDayActivities('2026-05-01', [
      { start: '08:00', end: '11:00', activityType: 'work' },
      { start: '11:00', end: '11:30', activityType: 'rest' },
      { start: '11:30', end: '16:45', activityType: 'work' },
      { start: '16:45', end: '17:00', activityType: 'rest' },
      { start: '17:00', end: '17:45', activityType: 'work' },
    ]);

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'WTD_BREAK_AFTER_9H_MISSING')).toHaveLength(0);
  });

  it('raises a reduced daily rest finding when the inter-duty rest is below 11 hours but above 9 hours', () => {
    const activities = [
      ...buildDayActivities('2026-05-01', [
        { start: '08:00', end: '18:00', activityType: 'work' },
      ]),
      ...buildDayActivities('2026-05-02', [
        { start: '03:30', end: '11:30', activityType: 'work' },
      ]),
    ];

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'REST_DAILY_REDUCED')).toHaveLength(1);
    expect(findByRule(result.findings, 'REST_DAILY_UNDER_9H')).toHaveLength(0);
  });

  it('raises a reduced weekly rest finding when the longest 7-day rest is between 24 and 45 hours', () => {
    const activities = [
      ...buildDayActivities('2026-05-01', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
      ...buildDayActivities('2026-05-02', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
      ...buildDayActivities('2026-05-03', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
      ...buildDayActivities('2026-05-04', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
      ...buildDayActivities('2026-05-05', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
      ...buildDayActivities('2026-05-06', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
      ...buildDayActivities('2026-05-08', [{ start: '14:00', end: '18:00', activityType: 'work' }]),
    ];

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'REST_WEEKLY_REDUCED')).toHaveLength(1);
  });

  it('raises a weekly rest breach when no 24-hour weekly rest exists in the 7-day window', () => {
    const activities = [
      ...buildDayActivities('2026-05-01', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
      ...buildDayActivities('2026-05-02', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
      ...buildDayActivities('2026-05-03', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
      ...buildDayActivities('2026-05-04', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
      ...buildDayActivities('2026-05-05', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
      ...buildDayActivities('2026-05-06', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
      ...buildDayActivities('2026-05-07', [{ start: '08:00', end: '18:00', activityType: 'work' }]),
    ];

    const result = evaluate(activities);

    expect(findByRule(result.findings, 'REST_WEEKLY_UNDER_24H')).toHaveLength(1);
  });
});
