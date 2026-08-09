import { describe, expect, it } from 'vitest';
import {
  buildComplianceReportCsv,
  buildComplianceReportRows,
  filterComplianceActivities,
  filterComplianceInfringements,
  summariseInfringements,
  type ComplianceActivityRow,
  type ComplianceInfringementRow,
} from './complianceReports';

const activities: ComplianceActivityRow[] = [
  {
    driver_id: 'driver-a',
    activity_type: 'driving',
    start_time: '2026-08-01T08:00:00.000Z',
    end_time: '2026-08-01T09:00:00.000Z',
    duration_mins: 60,
    vehicle_id: 'vehicle-a',
    label: 'Morning, run',
  },
  {
    driver_id: 'driver-a',
    activity_type: 'rest',
    start_time: '2026-08-02T22:00:00.000Z',
    end_time: '2026-08-02T23:00:00.000Z',
    duration_mins: 60,
    vehicle_id: 'vehicle-a',
    label: null,
  },
  {
    driver_id: 'driver-b',
    activity_type: 'work',
    start_time: '2026-08-03T08:00:00.000Z',
    end_time: '2026-08-03T09:00:00.000Z',
    duration_mins: 60,
    vehicle_id: 'vehicle-b',
    label: null,
  },
];

const infringements: ComplianceInfringementRow[] = [
  {
    driver_id: 'driver-a',
    occurred_at: '2026-08-01T10:00:00.000Z',
    severity: 'high',
    status: 'open',
    debriefed_at: null,
    violation_type: 'daily_rest',
  },
  {
    driver_id: 'driver-a',
    occurred_at: '2026-08-02T10:00:00.000Z',
    severity: 'high',
    status: 'closed',
    debriefed_at: '2026-08-03T10:00:00.000Z',
    violation_type: 'break',
  },
  {
    driver_id: 'driver-b',
    occurred_at: '2026-08-03T10:00:00.000Z',
    severity: 'warning',
    status: 'in_review',
    debriefed_at: null,
    violation_type: 'unknown',
  },
];

describe('compliance report evidence helpers', () => {
  it('filters activities and infringements by inclusive dates and driver', () => {
    const filter = { startDate: '2026-08-01', endDate: '2026-08-02', driverId: 'driver-a' };

    expect(filterComplianceActivities(activities, filter)).toHaveLength(2);
    expect(filterComplianceInfringements(infringements, filter)).toHaveLength(2);
    expect(filterComplianceActivities(activities, { ...filter, driverId: 'driver-b' })).toHaveLength(0);
  });

  it('keeps zero-infringement evidence at zero without inventing a compliance rate', () => {
    const rows = buildComplianceReportRows(activities.slice(0, 1), [], [
      { id: 'driver-a', full_name: 'A Driver', driver_license_number: 'LIC-A' },
    ]);
    const csv = buildComplianceReportCsv(rows);

    expect(rows[0]).toMatchObject({
      activitySegments: 1,
      infringements: 0,
      openInfringements: 0,
      debriefedInfringements: 0,
      severityCounts: {},
      statusCounts: {},
    });
    expect(csv).toContain('"Activity Segments","Infringements","Open Infringements"');
    expect(csv).not.toContain('100');
    expect(csv).not.toContain('Compliance Rate');
  });

  it('groups the authoritative infringement evidence by exact severity and status', () => {
    expect(summariseInfringements(infringements)).toEqual({
      total: 3,
      open: 1,
      debriefed: 1,
      bySeverity: { high: 2, warning: 1 },
      byStatus: { open: 1, closed: 1, in_review: 1 },
    });
  });

  it('escapes CSV values instead of changing their meaning', () => {
    const rows = buildComplianceReportRows(activities.slice(0, 1), [], [
      { id: 'driver-a', full_name: 'A, Driver', driver_license_number: 'LIC-A' },
    ]);

    expect(buildComplianceReportCsv(rows)).toContain('"A, Driver"');
  });
});
