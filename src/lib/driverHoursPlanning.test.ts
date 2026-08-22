import { describe, expect, it } from 'vitest';
import { buildDriverHoursPlanningForecast } from './driverHoursPlanning';

describe('deterministic driver hours planning', () => {
  it('keeps actual and planned minutes separate and marks the regime unknown', () => {
    const [forecast] = buildDriverHoursPlanningForecast(
      [{ driverId: 'driver-1', date: '2026-08-24', startTime: '08:00', endTime: '17:00', status: 'draft' }],
      [{ driverId: 'driver-1', date: '2026-08-23', startTime: '07:00', endTime: '15:00', totalWorkMinutes: 420 }],
    );
    expect(forecast).toMatchObject({ actualMinutes: 420, plannedMinutes: 540, totalMinutes: 960, regime: 'unknown' });
  });

  it('flags overlapping planned duties for review without claiming illegality', () => {
    const [forecast] = buildDriverHoursPlanningForecast([
      { driverId: 'driver-1', date: '2026-08-24', startTime: '08:00', endTime: '12:00', status: 'draft' },
      { driverId: 'driver-1', date: '2026-08-24', startTime: '11:00', endTime: '16:00', status: 'published' },
    ], []);
    expect(forecast.restReview).toBe('needs_review');
  });
});
