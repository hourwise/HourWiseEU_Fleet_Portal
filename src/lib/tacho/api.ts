import { supabase } from '../supabase';
import type {
  ParserDriverTachoComplianceSignal,
  ParserDriverTachoRiskSignal,
  TachoImportRecord,
  TachoParserBundle,
  TachoAnalysisRange,
  TachoReconciliationItem,
  VehicleMotionDiscrepancy,
} from './rules/types';
import { adaptImportRecord } from './adapters';

const TACHO_RPC = {
  companySignals: 'get_company_tacho_signals',
  driverAnalysisBundle: 'get_driver_tacho_analysis_bundle',
  vehicleAnalysisBundle: 'get_vehicle_unit_analysis_bundle',
  importBundle: 'get_tacho_import_bundle',
} as const;

interface CompanyTachoSignalsRow {
  driver_id: string;
  compliance_signal: ParserDriverTachoComplianceSignal | null;
  risk_signal: ParserDriverTachoRiskSignal | null;
}

function resolveRangeStart(range: TachoAnalysisRange) {
  const start = new Date();
  switch (range) {
    case '30d':
      start.setUTCDate(start.getUTCDate() - 30);
      break;
    case '3m':
      start.setUTCMonth(start.getUTCMonth() - 3);
      break;
    case '6m':
      start.setUTCMonth(start.getUTCMonth() - 6);
      break;
    case '12m':
      start.setUTCMonth(start.getUTCMonth() - 12);
      break;
    default:
      start.setUTCDate(start.getUTCDate() - 7);
      break;
  }
  return start.toISOString();
}

async function fetchVehicleMotionDiscrepanciesByVehicle(
  companyId: string,
  vehicleId: string,
  range: TachoAnalysisRange
): Promise<VehicleMotionDiscrepancy[]> {
  const { data, error } = await supabase
    .from('tachograph_vehicle_motion_discrepancies' as any)
    .select('*')
    .eq('company_id', companyId)
    .eq('vehicle_id', vehicleId)
    .gte('start_time', resolveRangeStart(range))
    .order('start_time', { ascending: false });

  if (error) throw error;

  return ((data as any[] | null) ?? []).map((row) => ({
    id: row.id,
    date: row.discrepancy_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMins: row.duration_mins,
    severity: row.severity,
    status: row.status,
    summary: row.summary,
    linkedDriverName: row.linked_driver_name ?? undefined,
    evidenceRefs: row.evidence_refs ?? [],
  }));
}

async function fetchVehicleMotionDiscrepanciesByImport(
  importId: string
): Promise<VehicleMotionDiscrepancy[]> {
  const { data, error } = await supabase
    .from('tachograph_vehicle_motion_discrepancies' as any)
    .select('*')
    .eq('import_id', importId)
    .order('start_time', { ascending: false });

  if (error) throw error;

  return ((data as any[] | null) ?? []).map((row) => ({
    id: row.id,
    date: row.discrepancy_date,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMins: row.duration_mins,
    severity: row.severity,
    status: row.status,
    summary: row.summary,
    linkedDriverName: row.linked_driver_name ?? undefined,
    evidenceRefs: row.evidence_refs ?? [],
  }));
}

async function fetchImportReconciliationByImport(
  importId: string
): Promise<TachoReconciliationItem[]> {
  const { data, error } = await supabase
    .from('tachograph_reconciliation_items' as any)
    .select('*')
    .eq('import_id', importId)
    .order('recon_date', { ascending: false });

  if (error) throw error;

  return ((data as any[] | null) ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    date: row.recon_date,
    appLabel: row.app_label,
    tachoLabel: row.tacho_label,
    summary: row.summary,
  }));
}

export interface CompanyTachoSignalsResponse {
  complianceSignals: ParserDriverTachoComplianceSignal[];
  riskSignals: ParserDriverTachoRiskSignal[];
  source: 'normalized_findings';
}

export async function fetchCompanyTachoSignals(
  companyId: string,
  days: number
): Promise<CompanyTachoSignalsResponse> {
  const { data, error } = await supabase.rpc(TACHO_RPC.companySignals as any, {
    p_company_id: companyId,
    p_days: days,
  } as any);

  if (error) throw error;

  const rows = ((data as CompanyTachoSignalsRow[] | null) ?? []).filter(Boolean);

  return {
    complianceSignals: rows
      .map((row) => row.compliance_signal)
      .filter((signal): signal is ParserDriverTachoComplianceSignal => !!signal),
    riskSignals: rows
      .map((row) => row.risk_signal)
      .filter((signal): signal is ParserDriverTachoRiskSignal => !!signal),
    source: 'normalized_findings',
  };
}

export async function fetchDriverTachoAnalysisBundle(
  companyId: string,
  driverId: string,
  range: TachoAnalysisRange = '7d'
): Promise<TachoParserBundle | null> {
  const { data, error } = await supabase.rpc(TACHO_RPC.driverAnalysisBundle as any, {
    p_company_id: companyId,
    p_driver_id: driverId,
    p_range: range,
  } as any);

  if (error) throw error;

  return (data as TachoParserBundle | null) ?? null;
}

export async function fetchVehicleUnitAnalysisBundle(
  companyId: string,
  vehicleId: string,
  range: TachoAnalysisRange = '7d'
): Promise<TachoParserBundle | null> {
  const { data, error } = await supabase.rpc(TACHO_RPC.vehicleAnalysisBundle as any, {
    p_company_id: companyId,
    p_vehicle_id: vehicleId,
    p_range: range,
  } as any);

  if (error) throw error;

  const bundle = (data as TachoParserBundle | null) ?? null;
  if (!bundle) return null;

  if (!Array.isArray(bundle.vehicleMotionDiscrepancies)) {
    bundle.vehicleMotionDiscrepancies = await fetchVehicleMotionDiscrepanciesByVehicle(companyId, vehicleId, range);
  }
  return bundle;
}

export async function fetchTachoImportBundle(
  companyId: string,
  importId: string
): Promise<TachoParserBundle | null> {
  const { data, error } = await supabase.rpc(TACHO_RPC.importBundle as any, {
    p_company_id: companyId,
    p_import_id: importId,
  } as any);

  if (error) throw error;

  const bundle = (data as TachoParserBundle | null) ?? null;
  if (!bundle) return null;

  if (!Array.isArray(bundle.reconciliation) && bundle.importRecord?.sourceType === 'driver_card') {
    bundle.reconciliation = await fetchImportReconciliationByImport(importId);
  }

  if (!Array.isArray(bundle.vehicleMotionDiscrepancies)) {
    bundle.vehicleMotionDiscrepancies = await fetchVehicleMotionDiscrepanciesByImport(importId);
  }
  return bundle;
}

export async function fetchRecentTachoImports(
  companyId: string,
  limit = 12
): Promise<TachoImportRecord[]> {
  const { data, error } = await supabase
    .from('tachograph_files' as any)
    .select('*')
    .eq('company_id', companyId)
    .order('uploaded_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return ((data as any[] | null) ?? []).map((row) => adaptImportRecord(row));
}

export async function fetchLatestDriverCardTarget(companyId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('driver_card_downloads' as any)
    .select('driver_id')
    .eq('company_id', companyId)
    .not('driver_id', 'is', null)
    .order('downloaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return (data as { driver_id?: string | null } | null)?.driver_id ?? null;
}

export async function fetchLatestVehicleUnitTarget(companyId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('vehicle_unit_downloads' as any)
    .select('vehicle_id')
    .eq('company_id', companyId)
    .not('vehicle_id', 'is', null)
    .order('downloaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return (data as { vehicle_id?: string | null } | null)?.vehicle_id ?? null;
}
