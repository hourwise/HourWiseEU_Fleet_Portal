import type { Database } from './database.types';
import { supabase } from './supabase';
import { evaluateAssetReadiness, type AssetReadinessResult } from './assetCompliance';

type VehicleRow = Database['public']['Tables']['vehicles']['Row'];

export async function fetchAssetReadinessSnapshot(companyId: string, now = new Date()): Promise<AssetReadinessResult[]> {
  const [{ data: vehicles, error: vehicleError }, { data: checks, error: checkError }, { data: documents, error: documentError }] = await Promise.all([
    supabase.from('vehicles').select('*').eq('company_id', companyId).order('reg_number'),
    supabase.from('vehicle_checks').select('reg_number, check_status, defect_lifecycle_status').eq('company_id', companyId),
    supabase.from('vehicle_documents').select('vehicle_id').eq('company_id', companyId),
  ]);

  if (vehicleError) throw new Error(vehicleError.message || 'Unable to load vehicle readiness.');
  if (checkError) throw new Error(checkError.message || 'Unable to load vehicle defect evidence.');
  if (documentError) throw new Error(documentError.message || 'Unable to load vehicle document evidence.');

  const defectEvidenceByReg = new Map<string, number>();
  for (const check of checks ?? []) {
    const key = check.reg_number.trim().toUpperCase();
    if (!defectEvidenceByReg.has(key)) defectEvidenceByReg.set(key, 0);
    if (check.check_status === 'defect' && (check.defect_lifecycle_status ?? 'reported') !== 'fixed') {
      defectEvidenceByReg.set(key, (defectEvidenceByReg.get(key) ?? 0) + 1);
    }
  }
  const documentsByVehicle = new Map<string, number>();
  for (const document of documents ?? []) {
    if (document.vehicle_id) documentsByVehicle.set(document.vehicle_id, (documentsByVehicle.get(document.vehicle_id) ?? 0) + 1);
  }

  return ((vehicles ?? []) as VehicleRow[]).map((vehicle) => evaluateAssetReadiness({
    id: vehicle.id,
    label: vehicle.reg_number,
    kind: vehicle.vehicle_class === 'trailer' || vehicle.vehicle_type === 'trailer' ? 'trailer' : 'vehicle',
    isVor: vehicle.is_vor,
    motDueDate: vehicle.mot_due_date,
    pmiDueDate: vehicle.pmi_due_date,
    tachoCalibrationDue: vehicle.tacho_calibration_due,
    lolerDueDate: vehicle.loler_due_date,
    insuranceExpiry: vehicle.insurance_expiry,
    unresolvedSafetyDefects: defectEvidenceByReg.has(vehicle.reg_number.trim().toUpperCase())
      ? defectEvidenceByReg.get(vehicle.reg_number.trim().toUpperCase()) ?? 0
      : null,
    vehicleDocumentCount: documentsByVehicle.get(vehicle.id) ?? 0,
  }, now));
}

type OverrideRpc = (functionName: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;

export async function createAssetAssignmentOverride(input: {
  shiftId: string;
  vehicleId: string;
  expectedShiftUpdatedAt: string;
  reason: string;
  jobAssignmentId?: string | null;
}) {
  const rpc = supabase.rpc as unknown as OverrideRpc;
  const { data, error } = await rpc('create_asset_assignment_override', {
    p_shift_id: input.shiftId,
    p_vehicle_id: input.vehicleId,
    p_job_assignment_id: input.jobAssignmentId ?? null,
    p_reason: input.reason,
    p_expected_shift_updated_at: input.expectedShiftUpdatedAt,
  });
  if (error) throw new Error(error.message || 'Unable to record the asset readiness override.');
  return data;
}
