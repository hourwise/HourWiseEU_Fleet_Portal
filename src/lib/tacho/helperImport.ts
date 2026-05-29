import { supabase } from '../supabase';

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

function deriveFileName(descriptor: ReaderHelperExportDescriptor) {
  if (descriptor.exportFileName) return descriptor.exportFileName;
  if (descriptor.exportDownloadPath) {
    const normalizedPath = descriptor.exportDownloadPath.replace(/\\/g, '/');
    const lastSegment = normalizedPath.split('/').filter(Boolean).at(-1);
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

  const response = await fetch(buildExportUrl(descriptor.helperUrl, descriptor.exportDownloadPath), {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to download helper export: ${response.status}`);
  }

  return response.blob();
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
    throw uploadError;
  }

  const metadata: HelperImportMetadata = {
    ingest_source: 'reader_helper',
    upload_origin: 'browser_assisted',
    helper_version: descriptor.helperVersion ?? null,
    read_session_id: descriptor.readSessionId,
    export_file_name: fileName,
    export_file_size_bytes: descriptor.exportFileSizeBytes ?? fileBlob.size,
    export_sha256: descriptor.exportSha256 ?? null,
    driver_name: descriptor.driverName ?? null,
    driver_card_number_hint: descriptor.driverCardNumberHint ?? null,
    vehicle_reg: descriptor.vehicleRegHint ?? null,
  };

  const insertPayload = {
    company_id: companyId,
    filename: fileName,
    file_path: filePath,
    file_type: fileType,
    status: 'pending',
    source_type: descriptor.sourceType ?? null,
    metadata,
  };

  const { data, error: insertError } = await supabase
    .from('tachograph_files' as never)
    .insert(insertPayload as never)
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  return {
    importId: (data as { id: string }).id,
    fileName,
    fileType,
    filePath,
    sourceType: descriptor.sourceType,
    metadata,
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

  if (error) throw error;
  if (!data) return null;

  const metadata = (data as { metadata?: HelperImportMetadata | null }).metadata ?? {};

  return {
    importId: data.id,
    status: data.status,
    driverId: data.driver_id ?? null,
    vehicleId: data.vehicle_id ?? null,
    sourceType: data.source_type ?? null,
    fileName: data.filename ?? null,
    filePath: data.file_path ?? null,
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
