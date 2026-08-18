export type DriverComplianceEvidenceType = 'driving_licence' | 'cpc_dqc' | 'medical';
export type DriverForecastStatus = 'known_valid' | 'expiring' | 'expired' | 'missing' | 'unknown';
export type DriverForecastHorizon = 'overdue' | 7 | 14 | 30 | 60 | 90;
export type DriverForecastSeverity = 'critical' | 'high' | 'medium' | 'info';

export type DriverComplianceEvidence = {
  driverId: string;
  driverLabel: string;
  drivingLicenceNumber: string | null;
  drivingLicenceExpiry: string | null;
  cpcDqcNumber: string | null;
  cpcDqcExpiry: string | null;
  medicalDocuments: readonly DriverMedicalDocument[];
};

export type DriverMedicalDocument = {
  id: string;
  documentType: string;
  expiryDate: string | null;
  verifiedAt: string | null;
};

export type DriverComplianceAssignment = {
  id: string;
  plannedDate: string | null;
};

export type DriverComplianceForecastItem = {
  id: string;
  driverId: string;
  driverLabel: string;
  evidenceType: DriverComplianceEvidenceType;
  label: string;
  dueDate: string | null;
  daysRemaining: number | null;
  status: DriverForecastStatus;
  horizon: DriverForecastHorizon;
  severity: DriverForecastSeverity;
  missingEvidence: boolean;
  evidenceSource: 'profile' | 'driver_document' | 'none';
  planningRisk: 'none' | 'planned_after_expiry' | 'planned_with_missing_evidence';
  planningConflictDates: string[];
};

const HORIZONS: DriverForecastHorizon[] = ['overdue', 7, 14, 30, 60, 90];

export function buildDriverComplianceForecast(
  evidence: DriverComplianceEvidence,
  now = new Date(),
  assignments: readonly DriverComplianceAssignment[] = [],
): DriverComplianceForecastItem[] {
  const medical = [...evidence.medicalDocuments]
    .filter((document) => /medical|d4/i.test(document.documentType))
    .sort((left, right) => String(right.expiryDate ?? '').localeCompare(String(left.expiryDate ?? '')))[0] ?? null;

  return [
    evaluate(evidence, 'driving_licence', 'Driving licence', evidence.drivingLicenceExpiry, evidence.drivingLicenceNumber ? 'profile' : 'none', now, assignments),
    evaluate(evidence, 'cpc_dqc', 'CPC/DQC', evidence.cpcDqcExpiry, evidence.cpcDqcNumber ? 'profile' : 'none', now, assignments),
    evaluate(evidence, 'medical', 'Medical evidence', medical?.expiryDate ?? null, medical ? 'driver_document' : 'none', now, assignments),
  ];
}

export function driverForecastNeedsAction(item: DriverComplianceForecastItem): boolean {
  return item.status === 'missing' || item.status === 'expired' || (item.status === 'expiring' && item.daysRemaining !== null && item.daysRemaining <= 14);
}

export function driverForecastIsNewWarning(item: DriverComplianceForecastItem): boolean {
  return item.status === 'missing' || item.status === 'expired' || (item.status === 'expiring' && item.daysRemaining !== null && item.daysRemaining <= 30);
}

export async function fetchDriverComplianceForecast(companyId: string, now = new Date()): Promise<DriverComplianceForecastItem[]> {
  const [{ data: profiles, error: profileError }, { data: documents, error: documentError }, { data: assignments, error: assignmentError }, { data: shifts, error: shiftError }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, is_active, driving_licence_number, driving_licence_expiry, cpc_dqc_number, cpc_dqc_expiry').eq('company_id', companyId).eq('role', 'driver'),
    supabase.from('driver_documents').select('id, user_id, document_type, expiry_date, verified_at').eq('company_id', companyId),
    supabase.from('job_assignments').select('id, driver_id, shift_id, status').eq('company_id', companyId),
    supabase.from('shifts').select('id, date').eq('company_id', companyId),
  ]);
  if (profileError) throw new Error(profileError.message || 'Unable to load driver compliance profiles.');
  if (documentError) throw new Error(documentError.message || 'Unable to load driver compliance documents.');
  if (assignmentError) throw new Error(assignmentError.message || 'Unable to load driver compliance assignments.');
  if (shiftError) throw new Error(shiftError.message || 'Unable to load driver compliance shift dates.');

  const shiftDates = new Map((shifts ?? []).map((shift) => [shift.id, shift.date]));
  const assignmentsByDriver = new Map<string, DriverComplianceAssignment[]>();
  for (const assignment of assignments ?? []) {
    if (assignment.status === 'cancelled' || assignment.status === 'draft') continue;
    const plannedDate = shiftDates.get(assignment.shift_id) ?? null;
    if (!plannedDate || plannedDate < formatDateOnly(now)) continue;
    const current = assignmentsByDriver.get(assignment.driver_id) ?? [];
    current.push({ id: assignment.id, plannedDate });
    assignmentsByDriver.set(assignment.driver_id, current);
  }

  return (profiles ?? [])
    .filter((profile) => profile.is_active !== false)
    .flatMap((profile) => buildDriverComplianceForecast({
      driverId: profile.id,
      driverLabel: profile.full_name || 'Unnamed driver',
      drivingLicenceNumber: profile.driving_licence_number,
      drivingLicenceExpiry: profile.driving_licence_expiry,
      cpcDqcNumber: profile.cpc_dqc_number,
      cpcDqcExpiry: profile.cpc_dqc_expiry,
      medicalDocuments: (documents ?? []).filter((document) => document.user_id === profile.id).map((document) => ({ id: document.id, documentType: document.document_type, expiryDate: document.expiry_date, verifiedAt: document.verified_at })),
    }, now, assignmentsByDriver.get(profile.id) ?? []));
}

function evaluate(
  evidence: DriverComplianceEvidence,
  evidenceType: DriverComplianceEvidenceType,
  label: string,
  dueDate: string | null,
  evidenceSource: DriverComplianceForecastItem['evidenceSource'],
  now: Date,
  assignments: readonly DriverComplianceAssignment[],
): DriverComplianceForecastItem {
  const id = `${evidence.driverId}:${evidenceType}`;
  if (!dueDate) {
    return {
      id, driverId: evidence.driverId, driverLabel: evidence.driverLabel, evidenceType, label,
      dueDate: null, daysRemaining: null, status: 'missing', horizon: 90, severity: 'medium',
      missingEvidence: true, evidenceSource, planningRisk: assignments.some((assignment) => assignment.plannedDate) ? 'planned_with_missing_evidence' : 'none', planningConflictDates: assignments.map((assignment) => assignment.plannedDate).filter((date): date is string => Boolean(date)),
    };
  }

  const due = parseDate(dueDate);
  if (!due) {
    return {
      id, driverId: evidence.driverId, driverLabel: evidence.driverLabel, evidenceType, label,
      dueDate, daysRemaining: null, status: 'unknown', horizon: 90, severity: 'info', missingEvidence: false, evidenceSource, planningRisk: 'none', planningConflictDates: [],
    };
  }

  const daysRemaining = calendarDaysBetween(startOfDay(now), startOfDay(due));
  const status: DriverForecastStatus = daysRemaining < 0 ? 'expired' : daysRemaining <= 90 ? 'expiring' : 'known_valid';
  const horizon: DriverForecastHorizon = daysRemaining < 0 ? 'overdue' : HORIZONS.find((value) => typeof value === 'number' && daysRemaining <= value) ?? 90;
  const severity: DriverForecastSeverity = daysRemaining < 0 ? 'critical' : daysRemaining <= 14 ? 'high' : daysRemaining <= 30 ? 'medium' : 'info';
  const planningConflictDates = assignments.map((assignment) => assignment.plannedDate).filter((date): date is string => Boolean(date && date > dueDate));
  const planningRisk = planningConflictDates.length > 0
    ? 'planned_after_expiry'
    : 'none';
  return {
    id, driverId: evidence.driverId, driverLabel: evidence.driverLabel, evidenceType, label,
    dueDate, daysRemaining, status, horizon, severity, missingEvidence: false, evidenceSource, planningRisk, planningConflictDates,
  };
}

function parseDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function calendarDaysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
}

function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
import { supabase } from './supabase';
