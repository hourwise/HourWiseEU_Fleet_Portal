import type { AssetComplianceEvidence } from './assetCompliance';

export type ForecastHorizon = 'overdue' | 7 | 14 | 30 | 60 | 90;
export type ForecastEvidenceStatus = 'known_valid' | 'expiring' | 'expired' | 'missing' | 'unknown';
export type ForecastSeverity = 'critical' | 'high' | 'medium' | 'info';

export type ComplianceForecastItem = {
  id: string;
  assetId: string;
  assetLabel: string;
  evidenceType: 'mot' | 'pmi' | 'tacho_calibration' | 'loler' | 'insurance';
  label: string;
  dueDate: string | null;
  daysRemaining: number | null;
  status: ForecastEvidenceStatus;
  horizon: ForecastHorizon;
  severity: ForecastSeverity;
  missingEvidence: boolean;
  planningRisk: 'none' | 'planned_after_expiry';
};

export type ForecastAssignment = { id: string; vehicleId: string | null; plannedDate: string | null };

type DateEvidence = { type: ComplianceForecastItem['evidenceType']; label: string; value: string | null; required: boolean };

const HORIZONS: ForecastHorizon[] = ['overdue', 7, 14, 30, 60, 90];

export function buildComplianceForecast(evidence: AssetComplianceEvidence, now = new Date(), assignments: readonly ForecastAssignment[] = []): ComplianceForecastItem[] {
  const dateEvidence: DateEvidence[] = [
    { type: 'mot', label: evidence.kind === 'trailer' ? 'Annual test' : 'MOT', value: evidence.motDueDate, required: true },
    { type: 'pmi', label: 'PMI/service', value: evidence.pmiDueDate, required: true },
    ...(evidence.kind === 'vehicle' ? [{ type: 'tacho_calibration' as const, label: 'Tachograph calibration', value: evidence.tachoCalibrationDue, required: true }] : []),
    ...(evidence.kind === 'vehicle' ? [{ type: 'loler' as const, label: 'LOLER inspection', value: evidence.lolerDueDate, required: false }] : []),
    { type: 'insurance', label: 'Insurance', value: evidence.insuranceExpiry, required: true },
  ];
  return dateEvidence.map((item) => evaluateDate(evidence, item, now, assignments));
}

function evaluateDate(evidence: AssetComplianceEvidence, item: DateEvidence, now: Date, assignments: readonly ForecastAssignment[]): ComplianceForecastItem {
  const id = `${evidence.id}:${item.type}`;
  if (!item.value) return { id, assetId: evidence.id, assetLabel: evidence.label, evidenceType: item.type, label: item.label, dueDate: null, daysRemaining: null, status: item.required ? 'missing' : 'unknown', horizon: 90, severity: item.required ? 'medium' : 'info', missingEvidence: item.required, planningRisk: 'none' };
  const due = new Date(item.value);
  if (Number.isNaN(due.getTime())) return { id, assetId: evidence.id, assetLabel: evidence.label, evidenceType: item.type, label: item.label, dueDate: item.value, daysRemaining: null, status: 'unknown', horizon: 90, severity: 'info', missingEvidence: false, planningRisk: 'none' };
  const daysRemaining = calendarDaysBetween(startOfDay(now), startOfDay(due));
  const status: ForecastEvidenceStatus = daysRemaining < 0 ? 'expired' : daysRemaining <= 90 ? 'expiring' : 'known_valid';
  const horizon: ForecastHorizon = daysRemaining < 0 ? 'overdue' : HORIZONS.find((value) => typeof value === 'number' && daysRemaining <= value) ?? 90;
  const severity: ForecastSeverity = daysRemaining < 0 ? 'critical' : daysRemaining <= 14 ? 'high' : daysRemaining <= 60 ? 'medium' : 'info';
  const planningRisk = assignments.some((assignment) => assignment.vehicleId === evidence.id && assignment.plannedDate && assignment.plannedDate > item.value!) ? 'planned_after_expiry' : 'none';
  return { id, assetId: evidence.id, assetLabel: evidence.label, evidenceType: item.type, label: item.label, dueDate: item.value, daysRemaining, status, horizon, severity, missingEvidence: false, planningRisk };
}

export function forecastNeedsAction(item: ComplianceForecastItem): boolean {
  return item.status === 'expired' || (item.status === 'expiring' && item.daysRemaining !== null && item.daysRemaining <= 14) || item.missingEvidence;
}

function startOfDay(date: Date): Date { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; }
function calendarDaysBetween(from: Date, to: Date): number { return Math.ceil((to.getTime() - from.getTime()) / 86_400_000); }
