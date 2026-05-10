import type {
  DriverCardAnalysisData,
  ParserDriverCardDownload,
  ParserVehicleUnitDownload,
  TachoAnalysisRange,
  TachoDaySummary,
  TachoImportRecord,
  TachoImportStatus,
  TachoParserBundle,
  TachoSummaryMetric,
  VehicleUnitAnalysisData,
} from './rules/types';

function normalizeImportStatus(status: string | null | undefined): TachoImportStatus {
  switch (status) {
    case 'complete':
    case 'queued':
    case 'processing':
    case 'partial':
    case 'failed':
    case 'uploaded':
      return status;
    case 'processed':
      return 'complete';
    case 'error':
      return 'failed';
    default:
      return 'queued';
  }
}

function buildProgress(status: string | null | undefined) {
  switch (normalizeImportStatus(status)) {
    case 'uploaded':
      return 10;
    case 'queued':
      return 20;
    case 'processing':
      return 60;
    case 'complete':
    case 'partial':
    case 'failed':
      return 100;
    default:
      return 0;
  }
}

function metric(label: string, value: string, tone: TachoSummaryMetric['tone']): TachoSummaryMetric {
  return { label, value, tone };
}

export function adaptImportRecord(raw: any): TachoImportRecord {
  const sourceType = raw?.sourceType ?? raw?.source_type ?? (raw?.vehicle_id ? 'vehicle_unit' : 'driver_card');
  const importedAt = raw?.importedAt ?? raw?.uploaded_at ?? new Date().toISOString();
  const status = normalizeImportStatus(raw?.status);

  return {
    id: raw?.id ?? crypto.randomUUID(),
    sourceType,
    fileName: raw?.fileName ?? raw?.filename ?? 'Unknown import',
    fileType: (raw?.fileType ?? raw?.file_type ?? 'ddd').toLowerCase(),
    importedAt,
    status,
    progressPercent: raw?.progressPercent ?? buildProgress(status),
    driverName: raw?.driverName ?? raw?.driver_name ?? raw?.metadata?.driver_name,
    vehicleReg: raw?.vehicleReg ?? raw?.vehicle_reg ?? raw?.metadata?.vehicle_reg,
    summary: raw?.summary ?? raw?.metadata?.summary,
  };
}

function getBundleImportRecord(bundle: TachoParserBundle | null): TachoImportRecord {
  return adaptImportRecord(bundle?.importRecord ?? {});
}

function driverDownloadStatus(download?: ParserDriverCardDownload) {
  return download?.downloadStatus ?? 'ok';
}

function vehicleDownloadStatus(download?: ParserVehicleUnitDownload) {
  return download?.downloadStatus ?? 'ok';
}

function fallbackDaySummaries(daySummaries: TachoDaySummary[] | undefined) {
  if (daySummaries && daySummaries.length > 0) return daySummaries;
  return [];
}

export function adaptDriverBundleToAnalysis(
  bundle: TachoParserBundle,
  range: TachoAnalysisRange
): DriverCardAnalysisData {
  const download = bundle.driverCardDownload;
  const importRecord = getBundleImportRecord(bundle);
  const daySummaries = fallbackDaySummaries(bundle.daySummaries);
  const findings = bundle.findings ?? [];
  const drivingBreaches = findings.filter((finding) => finding.ruleCode.startsWith('DRV_')).length;
  const wtdAlerts = findings.filter((finding) => finding.ruleCode.startsWith('WTD_')).length;
  const mismatches = findings.filter((finding) => finding.ruleCode.startsWith('DISC_')).length;

  return {
    identity: {
      driverId: download?.driverId ?? '',
      driverName: download?.driverName ?? importRecord.driverName ?? 'Unlinked driver',
      cardNumber: download?.cardNumber ?? 'Unknown card',
      cardExpiry: download?.cardExpiry ?? new Date().toISOString().slice(0, 10),
      issuingCountry: download?.issuingCountry ?? 'Unknown',
      lastDownloadAt: download?.downloadedAt ?? importRecord.importedAt,
      downloadStatus: driverDownloadStatus(download),
      periodStart: download?.periodStart,
      periodEnd: download?.periodEnd,
    },
    range,
    metrics: [
      metric('Driving Breaches', String(drivingBreaches), drivingBreaches > 0 ? 'warning' : 'good'),
      metric('WTD Alerts', String(wtdAlerts), wtdAlerts > 0 ? 'warning' : 'good'),
      metric('App/Tacho Mismatches', String(mismatches), mismatches > 0 ? 'danger' : 'good'),
      metric(
        'Download Status',
        driverDownloadStatus(download) === 'overdue'
          ? 'Overdue'
          : driverDownloadStatus(download) === 'due_soon'
          ? 'Due soon'
          : 'Current',
        driverDownloadStatus(download) === 'ok' ? 'good' : 'warning'
      ),
    ],
    dailySummaries: daySummaries,
    findings,
    reconciliation: [],
  };
}

export function adaptVehicleBundleToAnalysis(
  bundle: TachoParserBundle,
  range: TachoAnalysisRange
): VehicleUnitAnalysisData {
  const download = bundle.vehicleUnitDownload;
  const importRecord = getBundleImportRecord(bundle);
  const findings = bundle.findings ?? [];
  const technicalEvents = bundle.technicalEvents ?? [];
  const overspeedCount = technicalEvents.filter((finding) => finding.ruleCode === 'VU_OVERSPEED').length;

  return {
    identity: {
      vehicleId: download?.vehicleId ?? '',
      regNumber: download?.regNumber ?? importRecord.vehicleReg ?? 'Unknown vehicle',
      vuSerial: download?.vuSerial ?? 'Unknown VU',
      makeModel: importRecord.vehicleReg ?? 'Vehicle unit',
      calibrationDue: download?.calibrationDue ?? new Date().toISOString().slice(0, 10),
      lastDownloadAt: download?.downloadedAt ?? importRecord.importedAt,
      downloadStatus: vehicleDownloadStatus(download),
      periodStart: download?.periodStart,
      periodEnd: download?.periodEnd,
    },
    range,
    metrics: [
      metric('Overspeed Events', String(overspeedCount), overspeedCount > 0 ? 'danger' : 'good'),
      metric('Technical Events', String(technicalEvents.length), technicalEvents.length > 0 ? 'warning' : 'good'),
      metric('Compliance Findings', String(findings.length), findings.length > 0 ? 'warning' : 'good'),
      metric(
        'Download Status',
        vehicleDownloadStatus(download) === 'overdue'
          ? 'Overdue'
          : vehicleDownloadStatus(download) === 'due_soon'
          ? 'Due soon'
          : 'Current',
        vehicleDownloadStatus(download) === 'ok' ? 'good' : 'warning'
      ),
    ],
    dailySummaries: fallbackDaySummaries(bundle.daySummaries),
    findings,
    technicalEvents,
  };
}
