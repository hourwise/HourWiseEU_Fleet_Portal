import type {
  DriverCardAnalysisData,
  ParserDriverCardDownload,
  ParserVehicleUnitDownload,
  TachoAnalysisRange,
  TachoDaySummary,
  TachoFinding,
  TachoImportFileType,
  TachoImportRecord,
  TachoImportSourceType,
  TachoImportStatus,
  TachoParserBundle,
  TachoReconciliationItem,
  TachoSummaryMetric,
  VehicleMotionDiscrepancy,
  VehicleUnitAnalysisData,
} from './rules/types';

function normalizeImportStatus(status: unknown): TachoImportStatus {
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

function buildProgress(status: unknown) {
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

function countRule(findings: { ruleCode: string }[], ...codes: string[]) {
  return findings.filter((finding) => codes.includes(finding.ruleCode)).length;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asImportSourceType(value: unknown): TachoImportSourceType {
  return value === 'vehicle_unit' ? 'vehicle_unit' : 'driver_card';
}

function asImportFileType(value: unknown): TachoImportFileType {
  const normalized = typeof value === 'string' ? value.toLowerCase() : '';
  if (normalized === 'c1b' || normalized === 'v1b') return normalized;
  return 'ddd';
}

function asDiscrepancyPreview(value: unknown): VehicleMotionDiscrepancy[] | undefined {
  return Array.isArray(value) ? value as VehicleMotionDiscrepancy[] : undefined;
}

function asReconciliationPreview(value: unknown): TachoReconciliationItem[] | undefined {
  return Array.isArray(value) ? value as TachoReconciliationItem[] : undefined;
}

export function adaptImportRecord(raw: Record<string, unknown> | null | undefined): TachoImportRecord {
  const input = asRecord(raw);
  const metadata = asRecord(input.metadata);
  const sourceType = input.sourceType ?? input.source_type ?? (input.vehicle_id ? 'vehicle_unit' : 'driver_card');
  const importedAt = input.importedAt ?? input.uploaded_at ?? new Date().toISOString();
  const status = normalizeImportStatus(input.status);
  const fileType = input.fileType ?? input.file_type ?? 'ddd';
  const isReadOnlyHelperCapture =
    metadata.export_format === 'hourwise_read_only_capture_v1' ||
    (metadata.ingest_source === 'reader_helper' && metadata.export_parser_ready === false);

  return {
    id: asString(input.id, crypto.randomUUID()),
    sourceType: asImportSourceType(sourceType),
    fileName: asString(input.fileName ?? input.filename, 'Unknown import'),
    fileType: asImportFileType(fileType),
    importedAt: asString(importedAt, new Date().toISOString()),
    status,
    progressPercent: asOptionalNumber(input.progressPercent) ?? buildProgress(status),
    driverName: asOptionalString(input.driverName ?? input.driver_name ?? metadata.driver_name),
    vehicleReg: asOptionalString(input.vehicleReg ?? input.vehicle_reg ?? metadata.vehicle_reg),
    summary: asOptionalString(input.summary ?? metadata.summary),
    technicalEventCount: asOptionalNumber(input.technicalEventCount ?? metadata.technical_event_count),
    discrepancyCount: asOptionalNumber(input.discrepancyCount ?? metadata.discrepancy_count),
    reconciliationIssueCount: asOptionalNumber(input.reconciliationIssueCount ?? metadata.reconciliation_issue_count),
    highSeverityCount: asOptionalNumber(input.highSeverityCount ?? metadata.high_severity_count),
    ingestSource: asOptionalString(input.ingestSource ?? metadata.ingest_source),
    parserStatus: asOptionalString(
      input.parserStatus ?? metadata.parser_status ?? (isReadOnlyHelperCapture ? 'partial_helper_capture' : undefined)
    ),
    helperCaptureSchema: asOptionalString(
      input.helperCaptureSchema ??
        metadata.helper_capture_schema ??
        (isReadOnlyHelperCapture ? 'hourwise.tachograph.driver-card.read-only-capture.v1' : undefined)
    ),
    helperCaptureWarning: asOptionalString(input.helperCaptureWarning ?? metadata.helper_capture_warning ?? metadata.export_note),
    helperCaptureFileCount: asOptionalNumber(input.helperCaptureFileCount ?? metadata.helper_capture_file_count),
    helperCaptureSelectedFileCount: asOptionalNumber(input.helperCaptureSelectedFileCount ?? metadata.helper_capture_selected_file_count),
    helperCaptureCapturedBytes: asOptionalNumber(input.helperCaptureCapturedBytes ?? metadata.helper_capture_captured_bytes),
    processingError: asOptionalString(input.processingError ?? metadata.processing_error),
    processingKickoffError: asOptionalString(input.processingKickoffError ?? metadata.processing_kickoff_error),
    triggerDispatchError: asOptionalString(input.triggerDispatchError ?? metadata.trigger_dispatch_error),
    triggerDispatchRequestedAt: asOptionalString(input.triggerDispatchRequestedAt ?? metadata.trigger_dispatch_requested_at),
    processingKickoffRequestedAt: asOptionalString(input.processingKickoffRequestedAt ?? metadata.processing_kickoff_requested_at),
    discrepancyPreview: asDiscrepancyPreview(input.discrepancyPreview),
    reconciliationPreview: asReconciliationPreview(input.reconciliationPreview),
  };
}

function getBundleImportRecord(bundle: TachoParserBundle | null): TachoImportRecord {
  return bundle?.importRecord ?? adaptImportRecord({});
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

function fallbackActivitySegments(bundle: TachoParserBundle) {
  if (Array.isArray(bundle.activitySegments) && bundle.activitySegments.length > 0) {
    return bundle.activitySegments;
  }

  return fallbackDaySummaries(bundle.daySummaries).flatMap((day) => day.activities);
}

export function deriveVehicleMotionDiscrepancies(
  technicalEvents: TachoFinding[],
  findings: TachoFinding[]
): VehicleMotionDiscrepancy[] {
  const resolveDiscrepancyStatus = (ruleCode: string): VehicleMotionDiscrepancy['status'] => {
    if (ruleCode === 'VU_DRIVING_WITHOUT_CARD') return 'unassigned_motion';
    if (ruleCode === 'VU_CARD_CONFLICT') return 'driver_mismatch';
    if (ruleCode === 'VU_CARD_INSERTION_WHILE_DRIVING') return 'card_gap';
    return 'needs_review';
  };

  const fromTechnicalEvents = technicalEvents
    .filter((event) =>
      ['VU_DRIVING_WITHOUT_CARD', 'VU_CARD_CONFLICT', 'VU_CARD_INSERTION_WHILE_DRIVING', 'VU_MOTION_CONFLICT'].includes(event.ruleCode)
    )
    .map((event) => ({
      id: `disc-${event.id}`,
      date: event.occurredAt.slice(0, 10),
      startTime: event.periodStart,
      endTime: event.periodEnd,
      durationMins: Math.max(0, Math.round((new Date(event.periodEnd).getTime() - new Date(event.periodStart).getTime()) / 60000)),
      severity: event.severity,
      status: resolveDiscrepancyStatus(event.ruleCode),
      summary: event.summary,
      evidenceRefs: event.evidenceRefs,
    }));

  const fromFindings = findings
    .filter((finding) => finding.ruleCode.startsWith('DISC_'))
    .map((finding) => ({
      id: `disc-${finding.id}`,
      date: finding.occurredAt.slice(0, 10),
      startTime: finding.periodStart,
      endTime: finding.periodEnd,
      durationMins: Math.max(0, Math.round((new Date(finding.periodEnd).getTime() - new Date(finding.periodStart).getTime()) / 60000)),
      severity: finding.severity,
      status: 'driver_mismatch' as const,
      summary: finding.summary,
      evidenceRefs: finding.evidenceRefs,
    }));

  return [...fromTechnicalEvents, ...fromFindings].sort((left, right) => right.startTime.localeCompare(left.startTime));
}

export function adaptDriverBundleToAnalysis(
  bundle: TachoParserBundle,
  range: TachoAnalysisRange,
  reconciliation: DriverCardAnalysisData['reconciliation'] = bundle.reconciliation ?? []
): DriverCardAnalysisData {
  const download = bundle.driverCardDownload;
  const importRecord = getBundleImportRecord(bundle);
  const daySummaries = fallbackDaySummaries(bundle.daySummaries);
  const findings = bundle.findings ?? [];
  const technicalEvents = bundle.technicalEvents ?? [];
  const drivingBreaches = findings.filter((finding) => finding.ruleCode.startsWith('DRV_')).length;
  const wtdAlerts = findings.filter((finding) => finding.ruleCode.startsWith('WTD_')).length;
  const mismatches = findings.filter((finding) => finding.ruleCode.startsWith('DISC_')).length;
  const linkedVuEvents = technicalEvents.length;

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
      metric('Linked VU Events', String(linkedVuEvents), linkedVuEvents > 0 ? 'warning' : 'good'),
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
    activitySegments: fallbackActivitySegments(bundle),
    dailySummaries: daySummaries,
    findings,
    technicalEvents,
    reconciliation,
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
  const unassignedMotion = bundle.vehicleMotionDiscrepancies ?? deriveVehicleMotionDiscrepancies(technicalEvents, findings);
  const overspeedCount = countRule(technicalEvents, 'VU_OVERSPEED');
  const cardEventCount = countRule(
    technicalEvents,
    'VU_DRIVING_WITHOUT_CARD',
    'VU_CARD_INSERTION_WHILE_DRIVING',
    'VU_CARD_CONFLICT'
  );
  const faultCount = countRule(
    technicalEvents,
    'VU_MOTION_CONFLICT',
    'VU_POWER_INTERRUPTION',
    'VU_SENSOR_FAULT',
    'VU_SECURITY_FAULT',
    'VU_CALIBRATION_EVENT'
  );
  const unassignedMotionCount = unassignedMotion.length;

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
      metric('Card / Driver Events', String(cardEventCount), cardEventCount > 0 ? 'warning' : 'good'),
      metric('Technical Faults', String(faultCount), faultCount > 0 ? 'warning' : 'good'),
      metric('Unassigned Motion', String(unassignedMotionCount), unassignedMotionCount > 0 ? 'danger' : 'good'),
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
    activitySegments: fallbackActivitySegments(bundle),
    dailySummaries: fallbackDaySummaries(bundle.daySummaries),
    findings,
    technicalEvents,
    unassignedMotion,
  };
}
