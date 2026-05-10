import { supabase } from '../supabase';
import type {
  ParserDriverTachoComplianceSignal,
  ParserDriverTachoRiskSignal,
  TachoImportRecord,
  TachoParserBundle,
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
  range: '7d' | '30d' | '3m' | '6m' = '7d'
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
  range: '7d' | '30d' | '3m' | '6m' = '7d'
): Promise<TachoParserBundle | null> {
  const { data, error } = await supabase.rpc(TACHO_RPC.vehicleAnalysisBundle as any, {
    p_company_id: companyId,
    p_vehicle_id: vehicleId,
    p_range: range,
  } as any);

  if (error) throw error;

  return (data as TachoParserBundle | null) ?? null;
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

  return (data as TachoParserBundle | null) ?? null;
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
