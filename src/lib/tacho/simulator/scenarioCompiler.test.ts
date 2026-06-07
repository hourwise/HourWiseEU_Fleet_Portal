import { describe, expect, it } from 'vitest';

import { getTachoSimulationScenario, TACHO_SIMULATION_SCENARIOS } from './scenarioLibrary';
import { compileTachoSimulationScenario, evaluateTachoSimulationScenario } from './scenarioCompiler';

describe('compileTachoSimulationScenario', () => {
  it('compiles sequential activity blocks into ordered rule activities', () => {
    const scenario = getTachoSimulationScenario('split-break-compliant');
    expect(scenario).not.toBeNull();

    const compiled = compileTachoSimulationScenario(scenario!);

    expect(compiled.activities).toHaveLength(5);
    expect(compiled.activities[0].startTime).toBe('2026-05-01T08:00:00.000Z');
    expect(compiled.activities[0].endTime).toBe('2026-05-01T10:00:00.000Z');
    expect(compiled.activities[1].activityType).toBe('rest');
    expect(compiled.activities[4].endTime).toBe('2026-05-01T14:15:00.000Z');
  });
});

describe('evaluateTachoSimulationScenario', () => {
  it('keeps the compliant split-break scenario free of continuous driving breaches', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('split-break-compliant')!);

    expect(
      result.result.findings.filter((finding) => finding.ruleCode === 'DRV_CONTINUOUS_4H30_EXCEEDED')
    ).toHaveLength(0);
  });

  it('flags the invalid split-break scenario with a continuous driving breach', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('continuous-driving-breach')!);

    expect(
      result.result.findings.filter((finding) => finding.ruleCode === 'DRV_CONTINUOUS_4H30_EXCEEDED')
    ).toHaveLength(1);
  });

  it('can drive reconciliation findings from simulated app sessions', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('app-vs-tacho-mismatch')!);

    expect(
      result.result.reconciliationItems.filter((item) => item.status !== 'matched')
    ).toHaveLength(1);
    expect(
      result.result.combinedFindings.filter((finding) => finding.ruleCode === 'DISC_APP_TACHO_MISMATCH')
    ).toHaveLength(1);
  });

  it('flags the weekly-driving-breach scenario at the 56-hour rolling threshold', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('weekly-driving-breach')!);

    expect(
      result.result.findings.filter((finding) => finding.ruleCode === 'DRV_WEEKLY_56H_EXCEEDED')
    ).toHaveLength(1);
  });

  it('flags the fortnight-driving-breach scenario at the 90-hour rolling threshold', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('fortnight-driving-breach')!);

    expect(
      result.result.findings.filter((finding) => finding.ruleCode === 'DRV_FORTNIGHT_90H_EXCEEDED')
    ).toHaveLength(1);
  });

  it('flags reduced daily rest when inter-duty rest drops below 11 hours', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('reduced-daily-rest')!);

    expect(
      result.result.findings.filter((finding) => finding.ruleCode === 'REST_DAILY_REDUCED')
    ).toHaveLength(1);
    expect(
      result.result.findings.filter((finding) => finding.ruleCode === 'REST_DAILY_UNDER_9H')
    ).toHaveLength(0);
  });

  it('flags missing weekly rest when no 24-hour weekly rest exists in the rolling window', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('weekly-rest-under-24h')!);

    expect(
      result.result.findings.filter((finding) => finding.ruleCode === 'REST_WEEKLY_UNDER_24H')
    ).toHaveLength(1);
  });

  it('flags a WTD 6-hour break breach when the first qualifying break arrives too late', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('wtd-break-breach')!);

    expect(
      result.result.findings.filter((finding) => finding.ruleCode === 'WTD_BREAK_AFTER_6H_MISSING')
    ).toHaveLength(1);
  });

  it('flags overlapping activities as a data-quality issue', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('data-overlapping-activities')!);

    expect(
      result.result.dataQualityIssues.filter((finding) => finding.ruleCode === 'DATA_OVERLAPPING_ACTIVITY')
    ).toHaveLength(1);
  });

  it('fails fast when an explicit activity timestamp is missing', () => {
    expect(() =>
      evaluateTachoSimulationScenario(getTachoSimulationScenario('data-missing-activity-timestamp')!)
    ).toThrowError("Missing simulator timestamp for activity 2 startAt in 'data-missing-activity-timestamp'.");
  });

  it('fails fast when discrepancy timing is malformed', () => {
    expect(() =>
      evaluateTachoSimulationScenario(getTachoSimulationScenario('data-malformed-discrepancy-timing')!)
    ).toThrowError(
      "Malformed simulator timing for discrepancy 1 in 'data-malformed-discrepancy-timing': end must be after start."
    );
  });

  it('compiles VU cardless driving scenarios into technical events and unassigned-motion discrepancies', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('vu-cardless-driving')!);

    expect(result.technicalEvents.map((event) => event.ruleCode)).toEqual(['VU_DRIVING_WITHOUT_CARD']);
    expect(result.discrepancies.map((item) => item.status)).toEqual(['unassigned_motion']);
  });

  it('compiles VU driver mismatch scenarios into conflict events and driver-mismatch discrepancies', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('vu-driver-mismatch')!);

    expect(result.technicalEvents.map((event) => event.ruleCode)).toEqual(['VU_CARD_CONFLICT']);
    expect(result.discrepancies.map((item) => item.status)).toEqual(['driver_mismatch']);
  });

  it('supports VU overspeed scenarios without forcing a discrepancy row', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('vu-overspeed-event')!);

    expect(result.technicalEvents.map((event) => event.ruleCode)).toEqual([
      'VU_OVERSPEED',
      'VU_POWER_INTERRUPTION',
    ]);
    expect(result.discrepancies).toHaveLength(0);
  });

  it('supports multi-driver vehicle history across consecutive days', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('vu-multi-driver-consecutive-days')!);

    expect([...new Set(result.activities.map((activity) => activity.driverId))]).toEqual([
      'sim-driver-011',
      'sim-driver-012',
    ]);
    expect(result.result.daySummaries).toHaveLength(2);
  });

  it('supports same-day driver handover within one vehicle timeline', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('vu-same-day-handover')!);

    expect(result.activities.filter((activity) => activity.startTime.slice(0, 10) === '2026-05-16')).toHaveLength(6);
    expect([...new Set(result.activities.map((activity) => activity.driverId))]).toEqual([
      'sim-driver-013',
      'sim-driver-014',
    ]);
  });

  it('supports mixed assigned and unassigned vehicle motion on one day', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('vu-partial-assigned-motion-gap')!);

    expect(result.activities.some((activity) => activity.driverId === null)).toBe(true);
    expect(result.discrepancies.map((item) => item.status)).toEqual(['unassigned_motion']);
  });

  it('supports attribution conflicts between the paired card and review context', () => {
    const result = evaluateTachoSimulationScenario(getTachoSimulationScenario('vu-driver-attribution-conflict')!);

    expect(result.activities.every((activity) => activity.driverId === 'sim-driver-016')).toBe(true);
    expect(result.discrepancies[0]?.linkedDriverName).toBe('Emma Collins');
  });

  it('keeps a stable in-repo scenario library', () => {
    expect(TACHO_SIMULATION_SCENARIOS.map((scenario) => scenario.id)).toEqual([
      'split-break-compliant',
      'continuous-driving-breach',
      'app-vs-tacho-mismatch',
      'weekly-driving-breach',
      'fortnight-driving-breach',
      'reduced-daily-rest',
      'weekly-rest-under-24h',
      'wtd-break-breach',
      'data-overlapping-activities',
      'data-missing-activity-timestamp',
      'data-malformed-discrepancy-timing',
      'vu-cardless-driving',
      'vu-multi-driver-consecutive-days',
      'vu-same-day-handover',
      'vu-partial-assigned-motion-gap',
      'vu-driver-attribution-conflict',
      'vu-driver-mismatch',
      'vu-overspeed-event',
    ]);
  });
});
