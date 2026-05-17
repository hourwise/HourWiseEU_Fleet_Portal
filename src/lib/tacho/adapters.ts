import type {
  DriverCardAnalysisData,
  ParserDriverCardDownload,
  ParserVehicleUnitDownload,
  TachoAnalysisRange,
  TachoDaySummary,
  TachoFinding,
  TachoImportRecord,
  TachoImportStatus,
  TachoParserBundle,
  TachoSummaryMetric,
  VehicleMotionDiscrepancy,
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

function countRule(findings: { ruleCode: string }[], ...codes: string[]) {
  return findings.filter((finding) => codes.includes(finding.ruleCode)).length;
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
    technicalEventCount: raw?.technicalEventCount ?? raw?.metadata?.technical_event_count,
    discrepancyCount: raw?.discrepancyCount ?? raw?.metadata?.discrepancy_count,
    reconciliationIssueCount: raw?.reconciliationIssueCount ?? raw?.metadata?.reconciliation_issue_count,
    highSeverityCount: raw?.highSeverityCount ?? raw?.metadata?.high_severity_count,
    discrepancyPreview: raw?.discrepancyPreview,
    reconciliationPreview: raw?.reconciliationPreview,
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
    dailySummaries: fallbackDaySummaries(bundle.daySummaries),
    findings,
    technicalEvents,
    unassignedMotion,
  };
}
