import { supabase } from '../supabase';
import { reportTachoImportTelemetry } from './importTelemetry';

const SUPPORTED_TACHO_FILE_TYPES = ['ddd', 'v1b', 'c1b', 'tgd'] as const;

type SupportedTachoFileType = (typeof SUPPORTED_TACHO_FILE_TYPES)[number];

interface HelperImportMetadata {
  [key: string]: unknown;
}

export interface ReaderHelperExportDescriptor {
  helperUrl: string;
  readSessionId: string;
  helperVersion?: string;
  companyId?: string;
  requestedByUserId?: string;
  sourceType?: string;
  exportFileName?: string;
  exportDownloadPath?: string;
  exportFileSizeBytes?: number;
  exportSha256?: string;
  driverName?: string;
  driverCardNumberHint?: string;
  vehicleRegHint?: string;
}

export interface RegisteredReaderHelperImport {
  importId: string;
  fileName: string;
  fileType: SupportedTachoFileType;
  filePath: string;
  sourceType?: string;
  metadata: HelperImportMetadata;
  record: ProcessTachoImportRecord;
}

export interface ReaderHelperImportStatus {
  importId: string;
  status: string;
  driverId: string | null;
  vehicleId: string | null;
  sourceType?: string | null;
  fileName?: string | null;
  filePath?: string | null;
  driverName?: string | null;
  vehicleReg?: string | null;
  summary?: string | null;
  focusedDate?: string | null;
}

export interface ProcessTachoImportRecord {
  id: string;
  company_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  file_path: string;
  file_type: string;
  filename: string;
  metadata: HelperImportMetadata;
  source_type: string | null;
}

export interface TachoProcessingKickoffResult {
  started: boolean;
  error?: string;
}

interface TachographFileStatusRow {
  id: string;
  status: string;
  driver_id: string | null;
  vehicle_id: string | null;
  source_type: string | null;
  filename: string | null;
  file_path: string | null;
  metadata: HelperImportMetadata | null;
}

interface TachographFileProcessingRow extends TachographFileStatusRow {
  company_id: string;
  file_type: string;
}

function deriveFileName(descriptor: ReaderHelperExportDescriptor) {
  if (descriptor.exportFileName) return descriptor.exportFileName;
  if (descriptor.exportDownloadPath) {
    const normalizedPath = descriptor.exportDownloadPath.replace(/\\/g, '/');
    const pathSegments = normalizedPath.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    if (lastSegment && lastSegment.includes('.')) return lastSegment;
  }
  throw new Error('Helper export file name was not provided.');
}

function deriveFileType(fileName: string): SupportedTachoFileType {
  const fileType = fileName.split('.').pop()?.toLowerCase();
  if (!fileType || !SUPPORTED_TACHO_FILE_TYPES.includes(fileType as SupportedTachoFileType)) {
    throw new Error(`Unsupported helper export type for '${fileName}'.`);
  }
  return fileType as SupportedTachoFileType;
}

function buildExportUrl(helperUrl: string, exportDownloadPath: string) {
  return new URL(exportDownloadPath, `${helperUrl.replace(/\/$/, '')}/`).toString();
}

async function downloadHelperExportBlob(descriptor: ReaderHelperExportDescriptor) {
  if (!descriptor.exportDownloadPath) {
    throw new Error('Helper export download path was not provided.');
  }

  let response: Response;
  try {
    response = await fetch(buildExportUrl(descriptor.helperUrl, descriptor.exportDownloadPath), {
      method: 'GET',
    });
  } catch (error) {
    reportTachoImportTelemetry({
      level: 'error',
      message: 'Failed to reach the local helper export endpoint.',
      error,
      context: {
        stage: 'helper_download',
        readSessionId: descriptor.readSessionId,
        fileName: descriptor.exportFileName,
        sourceType: descriptor.sourceType ?? null,
        ingestSource: 'reader_helper',
      },
    });
    throw error;
  }

  if (!response.ok) {
    reportTachoImportTelemetry({
      level: 'error',
      message: `Helper export download returned ${response.status}.`,
      context: {
        stage: 'helper_download',
        readSessionId: descriptor.readSessionId,
        fileName: descriptor.exportFileName,
        sourceType: descriptor.sourceType ?? null,
        ingestSource: 'reader_helper',
      },
    });
    throw new Error(`Failed to download helper export: ${response.status}`);
  }

  return response.blob();
}

function toProcessTachoRecord(input: {
  id: string;
  companyId: string;
  filePath: string;
  fileType: string;
  fileName: string;
  metadata: HelperImportMetadata;
  sourceType?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
}): ProcessTachoImportRecord {
  return {
    id: input.id,
    company_id: input.companyId,
    driver_id: input.driverId ?? null,
    vehicle_id: input.vehicleId ?? null,
    file_path: input.filePath,
    file_type: input.fileType,
    filename: input.fileName,
    metadata: input.metadata,
    source_type: input.sourceType ?? null,
  };
}

async function insertPendingTachoImport(args: {
  companyId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  sourceType?: string | null;
  metadata: HelperImportMetadata;
  driverId?: string | null;
  vehicleId?: string | null;
}) {
  const insertPayload = {
    company_id: args.companyId,
    filename: args.fileName,
    file_path: args.filePath,
    file_type: args.fileType,
    status: 'pending',
    source_type: args.sourceType ?? null,
    driver_id: args.driverId ?? null,
    vehicle_id: args.vehicleId ?? null,
    metadata: args.metadata,
  };

  const { data, error } = await supabase
    .from('tachograph_files' as never)
    .insert(insertPayload as never)
    .select('id')
    .single();

  if (error) {
    reportTachoImportTelemetry({
      level: 'error',
      message: 'Failed to insert tachograph import record.',
      error,
      context: {
        stage: 'import_insert',
        companyId: args.companyId,
        fileName: args.fileName,
        filePath: args.filePath,
        sourceType: args.sourceType ?? null,
        ingestSource: typeof args.metadata.ingest_source === 'string' ? args.metadata.ingest_source : undefined,
      },
    });
    throw error;
  }

  return toProcessTachoRecord({
    id: (data as { id: string }).id,
    companyId: args.companyId,
    filePath: args.filePath,
    fileType: args.fileType,
    fileName: args.fileName,
    metadata: args.metadata,
    sourceType: args.sourceType,
    driverId: args.driverId,
    vehicleId: args.vehicleId,
  });
}

async function persistImportMetadata(importId: string, metadata: HelperImportMetadata) {
  const { error } = await supabase
    .from('tachograph_files' as never)
    .update({ metadata } as never)
    .eq('id', importId);

  if (error) {
    reportTachoImportTelemetry({
      level: 'error',
      message: 'Failed to persist tachograph import metadata.',
      error,
      context: {
        stage: 'metadata_persist',
        importId,
      },
    });
    throw error;
  }
}

export async function kickoffTachoImportProcessing(record: ProcessTachoImportRecord): Promise<TachoProcessingKickoffResult> {
  const requestedAt = new Date().toISOString();
  const { error } = await supabase.functions.invoke('process-tacho', {
    body: { record },
  });

  if (error) {
    reportTachoImportTelemetry({
      level: 'warning',
      message: 'Tachograph processing kickoff did not confirm successfully.',
      error,
      context: {
        stage: 'processing_kickoff',
        companyId: record.company_id,
        importId: record.id,
        fileName: record.filename,
        filePath: record.file_path,
        sourceType: record.source_type,
        ingestSource: typeof record.metadata.ingest_source === 'string' ? record.metadata.ingest_source : undefined,
      },
    });
  }

  const nextMetadata: HelperImportMetadata = {
    ...record.metadata,
    processing_kickoff_requested_at: requestedAt,
    processing_kickoff_origin: 'browser_direct',
    processing_kickoff_error: error?.message ?? null,
  };

  try {
    await persistImportMetadata(record.id, nextMetadata);
    record.metadata = nextMetadata;
  } catch (metadataError) {
    return {
      started: false,
      error:
        metadataError instanceof Error
          ? `Processing request result could not be recorded: ${metadataError.message}`
          : 'Processing request result could not be recorded.',
    };
  }

  if (error) {
    return {
      started: false,
      error: error.message,
    };
  }

  return { started: true };
}

export async function registerManualTachoImport(args: {
  companyId: string;
  file: File;
}) {
  const fileType = deriveFileType(args.file.name);
  const storageFileName = `${Date.now()}_${args.file.name}`;
  const filePath = `${args.companyId}/${storageFileName}`;

  const { error: uploadError } = await supabase.storage
    .from('tachograph-files')
    .upload(filePath, args.file, {
      contentType: 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    reportTachoImportTelemetry({
      level: 'error',
      message: 'Manual tachograph upload to storage failed.',
      error: uploadError,
      context: {
        stage: 'storage_upload',
        companyId: args.companyId,
        fileName: args.file.name,
        filePath,
        ingestSource: 'manual_upload',
      },
    });
    throw uploadError;
  }

  const metadata: HelperImportMetadata = {
    ingest_source: 'manual_upload',
    upload_origin: 'browser_manual',
  };

  const record = await insertPendingTachoImport({
    companyId: args.companyId,
    fileName: args.file.name,
    filePath,
    fileType,
    metadata,
  });

  return {
    record,
    kickoff: await kickoffTachoImportProcessing(record),
  };
}

export async function registerReaderHelperImport(args: {
  companyId: string;
  descriptor: ReaderHelperExportDescriptor;
}): Promise<RegisteredReaderHelperImport> {
  const { companyId, descriptor } = args;

  if (descriptor.companyId && descriptor.companyId !== companyId) {
    throw new Error('Helper company context does not match the signed-in company.');
  }

  const fileName = deriveFileName(descriptor);
  const fileType = deriveFileType(fileName);
  const fileBlob = await downloadHelperExportBlob(descriptor);
  const storageFileName = `${Date.now()}_${fileName}`;
  const filePath = `${companyId}/${storageFileName}`;

  const { error: uploadError } = await supabase.storage
    .from('tachograph-files')
    .upload(filePath, fileBlob, {
      contentType: 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    reportTachoImportTelemetry({
      level: 'error',
      message: 'Reader-helper tachograph upload to storage failed.',
      error: uploadError,
      context: {
        stage: 'storage_upload',
        companyId,
        readSessionId: descriptor.readSessionId,
        fileName,
        filePath,
        sourceType: descriptor.sourceType ?? null,
        ingestSource: 'reader_helper',
      },
    });
    throw uploadError;
  }

  const metadata: HelperImportMetadata = {
    ingest_source: 'reader_helper',
    upload_origin: 'browser_assisted',
    helper_version: descriptor.helperVersion ?? null,
    read_session_id: descriptor.readSessionId,
    requested_by_user_id: descriptor.requestedByUserId ?? null,
    export_file_name: fileName,
    export_file_size_bytes: descriptor.exportFileSizeBytes ?? fileBlob.size,
    export_sha256: descriptor.exportSha256 ?? null,
    driver_name: descriptor.driverName ?? null,
    driver_card_number_hint: descriptor.driverCardNumberHint ?? null,
    vehicle_reg: descriptor.vehicleRegHint ?? null,
  };

  const record = await insertPendingTachoImport({
    companyId,
    fileName,
    filePath,
    fileType,
    sourceType: descriptor.sourceType ?? null,
    metadata,
  });

  return {
    importId: record.id,
    fileName,
    fileType,
    filePath,
    sourceType: descriptor.sourceType,
    metadata,
    record,
  };
}

export async function acknowledgeReaderHelperImport(args: {
  helperUrl: string;
  readSessionId: string;
  importId: string;
  uploadedStoragePath: string;
  fileName: string;
  fileType: string;
  sourceType?: string;
}) {
  const response = await fetch(`${args.helperUrl.replace(/\/$/, '')}/imports/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requestedAt: new Date().toISOString(),
      readSessionId: args.readSessionId,
      importId: args.importId,
      uploadedStoragePath: args.uploadedStoragePath,
      fileName: args.fileName,
      fileType: args.fileType,
      sourceType: args.sourceType,
    }),
  });

  if (!response.ok) {
    reportTachoImportTelemetry({
      level: 'warning',
      message: `Helper import acknowledgement returned ${response.status}.`,
      context: {
        stage: 'helper_acknowledge',
        importId: args.importId,
        readSessionId: args.readSessionId,
        fileName: args.fileName,
        filePath: args.uploadedStoragePath,
        sourceType: args.sourceType ?? null,
        ingestSource: 'reader_helper',
      },
    });
    throw new Error(`Helper import registration failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchReaderHelperImportStatus(companyId: string, importId: string): Promise<ReaderHelperImportStatus | null> {
  const { data, error } = await supabase
    .from('tachograph_files' as never)
    .select('id,status,driver_id,vehicle_id,source_type,filename,file_path,metadata')
    .eq('company_id', companyId)
    .eq('id', importId)
    .maybeSingle();

  if (error) {
    reportTachoImportTelemetry({
      level: 'warning',
      message: 'Failed to fetch helper import status from Supabase.',
      error,
      context: {
        stage: 'import_status',
        companyId,
        importId,
      },
    });
    throw error;
  }
  const row = data as TachographFileStatusRow | null;
  if (!row) return null;

  const metadata = row.metadata ?? {};

  return {
    importId: row.id,
    status: row.status,
    driverId: row.driver_id ?? null,
    vehicleId: row.vehicle_id ?? null,
    sourceType: row.source_type ?? null,
    fileName: row.filename ?? null,
    filePath: row.file_path ?? null,
    driverName: typeof metadata.driver_name === 'string' ? metadata.driver_name : null,
    vehicleReg: typeof metadata.vehicle_reg === 'string' ? metadata.vehicle_reg : null,
    summary: typeof metadata.summary === 'string' ? metadata.summary : null,
  };
}

interface ReviewFocusRow {
  review_focus?: {
    date?: string;
  } | null;
}

async function fetchLatestReviewFocusFromTable(
  table: 'driver_tacho_compliance_signals' | 'driver_tacho_risk_signals',
  companyId: string,
  driverId: string
) {
  const { data, error } = await supabase
    .from(table as never)
    .select('review_focus, generated_at')
    .eq('company_id', companyId)
    .eq('driver_id', driverId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const row = (data as ReviewFocusRow | null) ?? null;
  return typeof row?.review_focus?.date === 'string' ? row.review_focus.date : null;
}

export async function fetchDriverReviewFocusDate(companyId: string, driverId: string) {
  const complianceFocus = await fetchLatestReviewFocusFromTable('driver_tacho_compliance_signals', companyId, driverId);
  if (complianceFocus) return complianceFocus;
  return fetchLatestReviewFocusFromTable('driver_tacho_risk_signals', companyId, driverId);
}

export async function retryTachoImportProcessing(companyId: string, importId: string): Promise<TachoProcessingKickoffResult> {
  const { data, error } = await supabase
    .from('tachograph_files' as never)
    .select('id,company_id,driver_id,vehicle_id,file_path,file_type,filename,metadata,source_type')
    .eq('company_id', companyId)
    .eq('id', importId)
    .maybeSingle();

  if (error) {
    reportTachoImportTelemetry({
      level: 'warning',
      message: 'Failed to reload tachograph import for retry.',
      error,
      context: {
        stage: 'processing_retry',
        companyId,
        importId,
      },
    });
    throw error;
  }

  const row = data as TachographFileProcessingRow | null;

  if (!row) {
    reportTachoImportTelemetry({
      level: 'warning',
      message: 'Retry was requested for an import that could not be found.',
      context: {
        stage: 'processing_retry',
        companyId,
        importId,
      },
    });
    throw new Error('Import record not found for retry.');
  }

  const filePath = row.file_path;
  if (!filePath) {
    reportTachoImportTelemetry({
      level: 'warning',
      message: 'Retry was requested for an import without a storage path.',
      context: {
        stage: 'processing_retry',
        companyId,
        importId,
      },
    });
    throw new Error('Import record has no storage path for retry.');
  }

  const record = toProcessTachoRecord({
    id: row.id,
    companyId: row.company_id,
    filePath,
    fileType: row.file_type,
    fileName: row.filename ?? row.id,
    metadata: row.metadata ?? {},
    sourceType: row.source_type,
    driverId: row.driver_id,
    vehicleId: row.vehicle_id,
  });

  return kickoffTachoImportProcessing(record);
}
