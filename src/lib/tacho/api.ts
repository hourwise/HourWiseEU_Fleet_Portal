import { supabase } from '../supabase';
import type {
  ParserDriverTachoComplianceSignal,
  ParserDriverTachoRiskSignal,
  TachoImportRecord,
  TachoParserBundle,
  TachoAnalysisRange,
  TachoCorrectiveActionType,
  TachoFindingReview,
  TachoFindingReviewStatus,
  TachoReconciliationItem,
  VehicleMotionDiscrepancy,
} from './rules/types';
import { adaptImportRecord } from './adapters';

const TACHO_RPC = {
  companySignals: 'get_company_tacho_signals',
  driverAnalysisBundle: 'get_driver_tacho_analysis_bundle',
  vehicleAnalysisBundle: 'get_vehicle_unit_analysis_bundle',
  importBundle: 'get_tacho_import_bundle',
  archiveCandidateImport: 'archive_tacho_candidate_import',
  confirmCandidateStorageDeleted: 'confirm_tacho_candidate_import_storage_deleted',
  prepareImportReprocess: 'prepare_tacho_import_reprocess',
  purgeCompanyDriverCardReads: 'purge_company_driver_card_reads',
  saveFindingReview: 'save_tachograph_finding_review',
} as const;

interface CompanyTachoSignalsRow {
  driver_id: string;
  compliance_signal: ParserDriverTachoComplianceSignal | null;
  risk_signal: ParserDriverTachoRiskSignal | null;
}

interface TachoFindingReviewRow {
  id: string;
  finding_id?: string;
  findingId?: string;
  company_id?: string;
  companyId?: string;
  driver_id?: string | null;
  driverId?: string | null;
  import_id?: string;
  importId?: string;
  status: TachoFindingReviewStatus;
  manager_note?: string | null;
  managerNote?: string | null;
  corrective_action_type?: TachoCorrectiveActionType | null;
  correctiveActionType?: TachoCorrectiveActionType | null;
  corrective_action_ref_id?: string | null;
  correctiveActionRefId?: string | null;
  reviewed_at?: string | null;
  reviewedAt?: string | null;
  reviewed_by_user_id?: string | null;
  reviewedByUserId?: string | null;
  closed_at?: string | null;
  closedAt?: string | null;
  closed_by_user_id?: string | null;
  closedByUserId?: string | null;
  driver_acknowledged_at?: string | null;
  driverAcknowledgedAt?: string | null;
  driver_acknowledged_by_user_id?: string | null;
  driverAcknowledgedByUserId?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
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

function adaptFindingReview(row: TachoFindingReviewRow): TachoFindingReview {
  return {
    id: row.id,
    findingId: row.finding_id ?? row.findingId ?? '',
    companyId: row.company_id ?? row.companyId ?? '',
    driverId: row.driver_id ?? row.driverId ?? null,
    importId: row.import_id ?? row.importId ?? '',
    status: row.status,
    managerNote: row.manager_note ?? row.managerNote ?? null,
    correctiveActionType: row.corrective_action_type ?? row.correctiveActionType ?? null,
    correctiveActionRefId: row.corrective_action_ref_id ?? row.correctiveActionRefId ?? null,
    reviewedAt: row.reviewed_at ?? row.reviewedAt ?? null,
    reviewedByUserId: row.reviewed_by_user_id ?? row.reviewedByUserId ?? null,
    closedAt: row.closed_at ?? row.closedAt ?? null,
    closedByUserId: row.closed_by_user_id ?? row.closedByUserId ?? null,
    driverAcknowledgedAt: row.driver_acknowledged_at ?? row.driverAcknowledgedAt ?? null,
    driverAcknowledgedByUserId: row.driver_acknowledged_by_user_id ?? row.driverAcknowledgedByUserId ?? null,
    createdAt: row.created_at ?? row.createdAt ?? '',
    updatedAt: row.updated_at ?? row.updatedAt ?? '',
  };
}

export async function fetchTachoFindingReviews(
  companyId: string,
  findingIds: string[]
): Promise<TachoFindingReview[]> {
  const uniqueFindingIds = [...new Set(findingIds)].filter(Boolean);
  if (uniqueFindingIds.length === 0) return [];

  const { data, error } = await supabase
    .from('tachograph_finding_reviews' as never)
    .select('*')
    .eq('company_id', companyId)
    .in('finding_id', uniqueFindingIds);

  if (error) throw error;
  return ((data as unknown as TachoFindingReviewRow[] | null) ?? []).map(adaptFindingReview);
}

export async function saveTachoFindingReview(input: {
  companyId: string;
  findingId: string;
  status: TachoFindingReviewStatus;
  managerNote?: string | null;
  correctiveActionType?: TachoCorrectiveActionType | null;
  correctiveActionRefId?: string | null;
}): Promise<TachoFindingReview> {
  const { data, error } = await supabase.rpc(TACHO_RPC.saveFindingReview as never, {
    p_company_id: input.companyId,
    p_finding_id: input.findingId,
    p_status: input.status,
    p_manager_note: input.managerNote ?? null,
    p_corrective_action_type: input.correctiveActionType ?? null,
    p_corrective_action_ref_id: input.correctiveActionRefId ?? null,
  } as never);

  if (error) throw error;
  return adaptFindingReview(data as unknown as TachoFindingReviewRow);
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

interface ArchiveCandidateImportResponse {
  importId?: string;
  archived?: boolean;
  storagePath?: string | null;
  storageDeleteRequested?: boolean;
}

export async function archiveTachoCandidateImport(
  companyId: string,
  importId: string,
  options: { deleteStorageFile: boolean; reason?: string | null }
): Promise<ArchiveCandidateImportResponse> {
  const { data, error } = await supabase.rpc(TACHO_RPC.archiveCandidateImport as any, {
    p_company_id: companyId,
    p_import_id: importId,
    p_delete_storage_file: options.deleteStorageFile,
    p_reason: options.reason ?? null,
  } as any);

  if (error) throw error;

  const archiveResult = (data ?? {}) as ArchiveCandidateImportResponse;
  const storagePath = archiveResult.storagePath ?? null;

  if (options.deleteStorageFile && storagePath) {
    const { error: storageError } = await supabase.storage
      .from('tachograph-files')
      .remove([storagePath]);

    if (storageError) throw storageError;

    const { error: confirmError } = await supabase.rpc(TACHO_RPC.confirmCandidateStorageDeleted as any, {
      p_company_id: companyId,
      p_import_id: importId,
      p_storage_path: storagePath,
    } as any);

    if (confirmError) throw confirmError;

    return {
      ...archiveResult,
      storageDeletedAt: new Date().toISOString(),
    } as ArchiveCandidateImportResponse & { storageDeletedAt: string };
  }

  return archiveResult;
}

interface PrepareTachoImportReprocessResponse {
  importId?: string;
  driverId?: string;
  prepared?: boolean;
  preparedAt?: string;
}

export async function prepareTachoImportReprocess(
  companyId: string,
  importId: string,
  reason?: string | null
): Promise<PrepareTachoImportReprocessResponse> {
  const { data, error } = await supabase.rpc(TACHO_RPC.prepareImportReprocess as any, {
    p_company_id: companyId,
    p_import_id: importId,
    p_reason: reason ?? null,
  } as any);

  if (error) throw error;
  return (data ?? {}) as PrepareTachoImportReprocessResponse;
}

export interface PurgeDriverCardReadsResponse {
  dryRun?: boolean;
  deleted?: boolean;
  importCount?: number;
  linkedDriverCount?: number;
  storagePaths?: string[];
  storageDeletedCount?: number;
  storageDeleteErrors?: string[];
}

export async function purgeCompanyDriverCardReads(
  companyId: string,
  options: {
    dryRun?: boolean;
    includeLinked?: boolean;
    deleteStorageFiles?: boolean;
    reason?: string | null;
  } = {}
): Promise<PurgeDriverCardReadsResponse> {
  const dryRun = options.dryRun ?? true;
  const { data, error } = await supabase.rpc(TACHO_RPC.purgeCompanyDriverCardReads as any, {
    p_company_id: companyId,
    p_dry_run: dryRun,
    p_include_linked: options.includeLinked ?? true,
    p_reason: options.reason ?? null,
  } as any);

  if (error) throw error;

  const result = (data ?? {}) as PurgeDriverCardReadsResponse;
  const storagePaths = result.storagePaths ?? [];

  if (!dryRun && options.deleteStorageFiles && storagePaths.length > 0) {
    const { data: storageResult, error: storageError } = await supabase.storage
      .from('tachograph-files')
      .remove(storagePaths);

    return {
      ...result,
      storageDeletedCount: storageError ? 0 : storageResult?.length ?? 0,
      storageDeleteErrors: storageError ? [storageError.message] : [],
    };
  }

  return result;
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
