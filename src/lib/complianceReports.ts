import { supabase } from './supabase';
import type { Database } from './database.types';

type ActivityTableRow = Database['public']['Tables']['tachograph_activity_segments']['Row'];
type InfringementTableRow = Database['public']['Tables']['infringements']['Row'];
type ProfileTableRow = Database['public']['Tables']['profiles']['Row'];

export type ComplianceActivityRow = Pick<
  ActivityTableRow,
  'driver_id' | 'activity_type' | 'start_time' | 'end_time' | 'duration_mins' | 'vehicle_id' | 'label'
>;

export type ComplianceInfringementRow = Pick<
  InfringementTableRow,
  'driver_id' | 'occurred_at' | 'severity' | 'status' | 'debriefed_at' | 'violation_type'
>;

export type ComplianceProfileRow = Pick<ProfileTableRow, 'id' | 'full_name' | 'driver_license_number'>;

export type ComplianceDateFilter = {
  startDate: string;
  endDate: string;
  driverId?: string;
};

export type InfringementSummary = {
  total: number;
  open: number;
  debriefed: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
};

export type ComplianceReportRow = {
  driverId: string;
  driverName: string;
  licenceNumber: string;
  activitySegments: number;
  infringements: number;
  openInfringements: number;
  debriefedInfringements: number;
  severityCounts: Record<string, number>;
  statusCounts: Record<string, number>;
};

export type ComplianceReportRequest = {
  companyId: string;
  startDate: string;
  endDate: string;
  driverId?: string;
};

function dateAtUtcStart(date: string): number {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid report date: ${date}`);
  }
  return timestamp;
}

export function reportDateRangeToIso(startDate: string, endDate: string): { start: string; endExclusive: string } {
  const start = dateAtUtcStart(startDate);
  const end = dateAtUtcStart(endDate);
  if (end < start) {
    throw new Error('Report end date must not be before the start date');
  }

  return {
    start: new Date(start).toISOString(),
    endExclusive: new Date(end + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function filterComplianceActivities(
  rows: ComplianceActivityRow[],
  filter: ComplianceDateFilter,
): ComplianceActivityRow[] {
  const { start, endExclusive } = reportDateRangeToIso(filter.startDate, filter.endDate);
  return rows.filter((row) => {
    const hasDriver = !filter.driverId || row.driver_id === filter.driverId;
    return hasDriver && row.start_time >= start && row.start_time < endExclusive;
  });
}

export function filterComplianceInfringements(
  rows: ComplianceInfringementRow[],
  filter: ComplianceDateFilter,
): ComplianceInfringementRow[] {
  const { start, endExclusive } = reportDateRangeToIso(filter.startDate, filter.endDate);
  return rows.filter((row) => {
    const hasDriver = !filter.driverId || row.driver_id === filter.driverId;
    return hasDriver && row.occurred_at >= start && row.occurred_at < endExclusive;
  });
}

function incrementCount(counts: Record<string, number>, value: string | null): void {
  const key = value?.trim() || 'unspecified';
  counts[key] = (counts[key] ?? 0) + 1;
}

export function summariseInfringements(rows: ComplianceInfringementRow[]): InfringementSummary {
  const summary: InfringementSummary = {
    total: rows.length,
    open: 0,
    debriefed: 0,
    bySeverity: {},
    byStatus: {},
  };

  for (const row of rows) {
    if (row.status === 'open') summary.open += 1;
    if (row.debriefed_at !== null) summary.debriefed += 1;
    incrementCount(summary.bySeverity, row.severity);
    incrementCount(summary.byStatus, row.status);
  }

  return summary;
}

export function buildComplianceReportRows(
  activities: ComplianceActivityRow[],
  infringements: ComplianceInfringementRow[],
  profiles: ComplianceProfileRow[],
): ComplianceReportRow[] {
  const driverIds = new Set<string>();
  for (const row of activities) {
    if (row.driver_id) driverIds.add(row.driver_id);
  }
  for (const row of infringements) {
    if (row.driver_id) driverIds.add(row.driver_id);
  }

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  return [...driverIds]
    .sort((left, right) => {
      const leftName = profileMap.get(left)?.full_name ?? '';
      const rightName = profileMap.get(right)?.full_name ?? '';
      return leftName.localeCompare(rightName) || left.localeCompare(right);
    })
    .map((driverId) => {
      const driverInfringements = infringements.filter((row) => row.driver_id === driverId);
      const summary = summariseInfringements(driverInfringements);
      const profile = profileMap.get(driverId);

      return {
        driverId,
        driverName: profile?.full_name || 'Unknown',
        licenceNumber: profile?.driver_license_number || 'N/A',
        activitySegments: activities.filter((row) => row.driver_id === driverId).length,
        infringements: summary.total,
        openInfringements: summary.open,
        debriefedInfringements: summary.debriefed,
        severityCounts: summary.bySeverity,
        statusCounts: summary.byStatus,
      };
    });
}

function escapeCsvValue(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function serialiseCounts(counts: Record<string, number>): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))),
  );
}

export function buildComplianceReportCsv(rows: ComplianceReportRow[]): string {
  const headers = [
    'Driver Name',
    'Licence Number',
    'Activity Segments',
    'Infringements',
    'Open Infringements',
    'Debriefed Infringements',
    'Severity Counts',
    'Status Counts',
  ];

  const records = rows.map((row) => [
    row.driverName,
    row.licenceNumber,
    row.activitySegments,
    row.infringements,
    row.openInfringements,
    row.debriefedInfringements,
    serialiseCounts(row.severityCounts),
    serialiseCounts(row.statusCounts),
  ]);

  return [headers, ...records].map((record) => record.map(escapeCsvValue).join(',')).join('\n');
}

export async function loadComplianceReportRows(request: ComplianceReportRequest): Promise<ComplianceReportRow[]> {
  const range = reportDateRangeToIso(request.startDate, request.endDate);
  let activityQuery = supabase
    .from('tachograph_activity_segments')
    .select('driver_id, activity_type, start_time, end_time, duration_mins, vehicle_id, label')
    .eq('company_id', request.companyId)
    .gte('start_time', range.start)
    .lt('start_time', range.endExclusive);

  let infringementQuery = supabase
    .from('infringements')
    .select('driver_id, occurred_at, severity, status, debriefed_at, violation_type')
    .eq('company_id', request.companyId)
    .gte('occurred_at', range.start)
    .lt('occurred_at', range.endExclusive);

  if (request.driverId) {
    activityQuery = activityQuery.eq('driver_id', request.driverId);
    infringementQuery = infringementQuery.eq('driver_id', request.driverId);
  }

  const [activitiesResponse, infringementsResponse] = await Promise.all([activityQuery, infringementQuery]);
  if (activitiesResponse.error) throw activitiesResponse.error;
  if (infringementsResponse.error) throw infringementsResponse.error;

  const activities = activitiesResponse.data ?? [];
  const infringements = infringementsResponse.data ?? [];
  const driverIds = [...new Set([
    ...activities.map((row) => row.driver_id),
    ...infringements.map((row) => row.driver_id),
  ].filter((driverId): driverId is string => Boolean(driverId)))];

  if (driverIds.length === 0) return [];

  const profilesResponse = await supabase
    .from('profiles')
    .select('id, full_name, driver_license_number')
    .eq('company_id', request.companyId)
    .in('id', driverIds);
  if (profilesResponse.error) throw profilesResponse.error;

  return buildComplianceReportRows(activities, infringements, profilesResponse.data ?? []);
}
