/**
 * Deterministic asset readiness rules.
 *
 * This module deliberately treats missing evidence as unknown. A vehicle is
 * never considered ready merely because no warning row was returned.
 */

export type AssetReadinessStatus = 'ready' | 'warning' | 'action_required' | 'prohibited' | 'unknown';

export type AssetComplianceEvidence = {
  id: string;
  label: string;
  kind: 'vehicle' | 'trailer';
  isVor: boolean | null;
  motDueDate: string | null;
  pmiDueDate: string | null;
  tachoCalibrationDue: string | null;
  lolerDueDate: string | null;
  insuranceExpiry: string | null;
  unresolvedSafetyDefects: number | null;
  vehicleDocumentCount: number | null;
};

export type AssetReadinessReason = {
  code: string;
  label: string;
  severity: 'info' | 'warning' | 'action_required' | 'prohibited' | 'unknown';
  dueDate?: string;
};

export type AssetReadinessResult = AssetComplianceEvidence & {
  status: AssetReadinessStatus;
  reasons: AssetReadinessReason[];
};

const WARNING_WINDOW_DAYS = 14;

export function evaluateAssetReadiness(
  evidence: AssetComplianceEvidence,
  now = new Date(),
): AssetReadinessResult {
  const reasons: AssetReadinessReason[] = [];

  if (evidence.isVor === true) {
    reasons.push({ code: 'vehicle_off_road', label: 'Vehicle is marked off road', severity: 'prohibited' });
  }

  if (evidence.unresolvedSafetyDefects === null) {
    reasons.push({ code: 'safety_defects_unknown', label: 'Safety defect evidence is unavailable', severity: 'unknown' });
  } else if (evidence.unresolvedSafetyDefects > 0) {
    reasons.push({
      code: 'unresolved_safety_defect',
      label: `${evidence.unresolvedSafetyDefects} unresolved safety defect${evidence.unresolvedSafetyDefects === 1 ? '' : 's'}`,
      severity: 'prohibited',
    });
  }

  const requiredDates: Array<{ code: string; label: string; value: string | null }> = [
    { code: 'mot_due', label: evidence.kind === 'trailer' ? 'Annual test date is missing' : 'MOT date is missing', value: evidence.motDueDate },
    { code: 'pmi_due', label: 'PMI/service due date is missing', value: evidence.pmiDueDate },
    ...(evidence.kind === 'vehicle'
      ? [{ code: 'tacho_calibration_due', label: 'Tachograph calibration date is missing', value: evidence.tachoCalibrationDue }]
      : []),
  ];

  for (const field of requiredDates) {
    if (!field.value) {
      reasons.push({ code: field.code, label: field.label, severity: 'unknown' });
      continue;
    }
    const dueDate = new Date(field.value);
    if (Number.isNaN(dueDate.getTime())) {
      reasons.push({ code: field.code, label: `${field.label.replace(' is missing', '')} is not a valid date`, severity: 'unknown' });
      continue;
    }
    const daysRemaining = Math.ceil((startOfDay(dueDate).getTime() - startOfDay(now).getTime()) / 86_400_000);
    if (daysRemaining < 0) {
      reasons.push({ code: `${field.code}_expired`, label: `${field.label.replace(' is missing', '')} has expired`, severity: 'action_required', dueDate: field.value });
    } else if (daysRemaining <= WARNING_WINDOW_DAYS) {
      reasons.push({ code: `${field.code}_expiring`, label: `${field.label.replace(' is missing', '')} is due within ${WARNING_WINDOW_DAYS} days`, severity: 'warning', dueDate: field.value });
    }
  }

  if (evidence.insuranceExpiry) {
    const expiry = new Date(evidence.insuranceExpiry);
    if (!Number.isNaN(expiry.getTime())) {
      const daysRemaining = Math.ceil((startOfDay(expiry).getTime() - startOfDay(now).getTime()) / 86_400_000);
      if (daysRemaining < 0) reasons.push({ code: 'insurance_expired', label: 'Insurance evidence has expired', severity: 'action_required', dueDate: evidence.insuranceExpiry });
      else if (daysRemaining <= WARNING_WINDOW_DAYS) reasons.push({ code: 'insurance_expiring', label: 'Insurance evidence expires within 14 days', severity: 'warning', dueDate: evidence.insuranceExpiry });
    }
  } else {
    reasons.push({ code: 'insurance_unknown', label: 'Insurance expiry evidence is unavailable', severity: 'unknown' });
  }

  if (evidence.lolerDueDate) {
    const loler = new Date(evidence.lolerDueDate);
    if (!Number.isNaN(loler.getTime())) {
      const daysRemaining = Math.ceil((startOfDay(loler).getTime() - startOfDay(now).getTime()) / 86_400_000);
      if (daysRemaining < 0) reasons.push({ code: 'loler_expired', label: 'LOLER inspection has expired', severity: 'action_required', dueDate: evidence.lolerDueDate });
      else if (daysRemaining <= WARNING_WINDOW_DAYS) reasons.push({ code: 'loler_expiring', label: 'LOLER inspection is due within 14 days', severity: 'warning', dueDate: evidence.lolerDueDate });
    }
  }

  if (evidence.vehicleDocumentCount === null) {
    reasons.push({ code: 'documents_unknown', label: 'Vehicle document evidence could not be loaded', severity: 'unknown' });
  } else if (evidence.vehicleDocumentCount === 0) {
    reasons.push({ code: 'documents_missing', label: 'No vehicle documents are recorded', severity: 'unknown' });
  }

  const status = deriveStatus(reasons);
  return { ...evidence, status, reasons };
}

export function deriveStatus(reasons: readonly AssetReadinessReason[]): AssetReadinessStatus {
  if (reasons.some((reason) => reason.severity === 'prohibited')) return 'prohibited';
  if (reasons.some((reason) => reason.severity === 'action_required')) return 'action_required';
  if (reasons.some((reason) => reason.severity === 'warning')) return 'warning';
  if (reasons.some((reason) => reason.severity === 'unknown')) return 'unknown';
  return 'ready';
}

function startOfDay(value: Date): Date {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}
