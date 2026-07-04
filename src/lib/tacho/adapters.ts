import type {
  DriverCardAnalysisData,
  ParserDriverCardDownload,
  ParserVehicleUnitDownload,
  TachoAnalysisRange,
  TachoActivitySegment,
  TachoDaySummary,
  TachoFinding,
  TachoImportFileType,
  TachoImportRecord,
  TachoImportSourceType,
  TachoImportStatus,
  TachoParserBundle,
  TachoReconciliationItem,
  TachoSummaryMetric,
  TachoTimelineBundle,
  TachoTimelineComparison,
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

function asOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function asCandidateReviewDecision(value: unknown): TachoImportRecord['candidateReviewDecision'] {
  return value === 'reviewed' || value === 'no_hire' || value === 'defer' ? value : undefined;
}

function asArchiveStorageAction(value: unknown): TachoImportRecord['archiveStorageAction'] {
  return value === 'keep_file' || value === 'delete_file' ? value : undefined;
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
    filePath: asOptionalString(input.filePath ?? input.file_path) ?? null,
    fileType: asImportFileType(fileType),
    importedAt: asString(importedAt, new Date().toISOString()),
    status,
    progressPercent: asOptionalNumber(input.progressPercent) ?? buildProgress(status),
    driverId: asOptionalString(input.driverId ?? input.driver_id) ?? null,
    driverName: asOptionalString(input.driverName ?? input.driver_name ?? metadata.driver_name),
    externalCardNumber: asOptionalString(input.externalCardNumber ?? input.external_card_number ?? metadata.external_card_number),
    driverCardNumberHint: asOptionalString(input.driverCardNumberHint ?? metadata.driver_card_number_hint),
    cardDriverName: asOptionalString(input.cardDriverName ?? metadata.card_driver_name),
    cardExpiryDate: asOptionalString(input.cardExpiryDate ?? metadata.helper_capture_card_expiry_date),
    cardIssuingAuthorityName: asOptionalString(
      input.cardIssuingAuthorityName ?? metadata.helper_capture_card_issuing_authority_name
    ),
    identityDecoded: typeof metadata.helper_capture_identity_decoded === 'boolean'
      ? metadata.helper_capture_identity_decoded
      : undefined,
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
    candidateReviewDecision: asCandidateReviewDecision(metadata.candidate_review_decision),
    candidateReviewedAt: asOptionalString(metadata.candidate_reviewed_at),
    candidateInviteStatus: asOptionalString(metadata.candidate_invite_status),
    candidateInvitedAt: asOptionalString(metadata.candidate_invited_at),
    pairedAt: asOptionalString(metadata.paired_at),
    pairedDriverName: asOptionalString(metadata.paired_driver_name),
    supersededByImportId: asOptionalString(metadata.helper_capture_superseded_by_import_id),
    supersededAt: asOptionalString(metadata.helper_capture_superseded_at),
    activeAnalysisRows: asOptionalBoolean(metadata.helper_capture_active_analysis_rows),
    archivedAt: asOptionalString(metadata.candidate_import_archived_at ?? metadata.driver_card_purge_archived_at),
    archiveReason: asOptionalString(metadata.candidate_import_archive_reason ?? metadata.driver_card_purge_archive_reason),
    archiveStorageAction: asArchiveStorageAction(metadata.candidate_import_archive_storage_action),
    storageDeleteRequestedAt: asOptionalString(metadata.candidate_import_storage_delete_requested_at),
    storageDeletedAt: asOptionalString(metadata.candidate_import_storage_deleted_at),
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

function segmentDurationMins(segment: Pick<TachoActivitySegment, 'startTime' | 'endTime' | 'durationMins'>) {
  if (Number.isFinite(segment.durationMins) && segment.durationMins > 0) return segment.durationMins;
  return Math.max(0, Math.round((new Date(segment.endTime).getTime() - new Date(segment.startTime).getTime()) / 60000));
}

function dedupeActivitySegments(segments: TachoActivitySegment[]) {
  const bySignature = new Map<string, TachoActivitySegment>();

  segments.forEach((segment) => {
    const durationMins = segmentDurationMins(segment);
    const signature = [
      segment.driverId ?? '',
      segment.vehicleId ?? '',
      segment.source,
      segment.activityType,
      segment.startTime,
      segment.endTime,
      durationMins,
      segment.label ?? '',
    ].join('|');

    const existing = bySignature.get(signature);
    if (!existing) {
      bySignature.set(signature, { ...segment, durationMins });
      return;
    }

    if (segment.confidence === 'high' && existing.confidence !== 'high') {
      bySignature.set(signature, { ...segment, durationMins });
    }
  });

  return Array.from(bySignature.values()).sort((left, right) => left.startTime.localeCompare(right.startTime));
}

function generationIdFromTimelineBundle(timelineBundle: TachoTimelineBundle | null | undefined) {
  return timelineBundle?.timelineGeneration?.id ?? timelineBundle?.timelineGenerations?.[0]?.id ?? null;
}

function timelineWarnings(timelineBundle: TachoTimelineBundle | null | undefined, fallbackWarnings: string[] = []) {
  const warnings = timelineBundle?.warnings ?? fallbackWarnings;
  return Array.isArray(warnings) ? warnings.filter((warning): warning is string => typeof warning === 'string') : [];
}

export function compareTachoBundleToTimeline(
  bundle: TachoParserBundle,
  timelineBundle: TachoTimelineBundle | null | undefined,
  fallbackWarnings: string[] = []
): TachoTimelineComparison {
  const timelineEvents = timelineBundle?.events ?? [];
  const timelineGaps = timelineBundle?.gaps ?? [];
  const timelineDailySummaries = timelineBundle?.dailySummaries ?? [];
  const tachographGapCount = (bundle.vehicleMotionDiscrepancies?.length ?? 0) +
    (bundle.reconciliation?.filter((item) => item.status !== 'matched').length ?? 0);

  return {
    available: Boolean(timelineBundle && generationIdFromTimelineBundle(timelineBundle)),
    checkedAt: new Date().toISOString(),
    warnings: timelineWarnings(timelineBundle, fallbackWarnings),
    tachographActivityCount: fallbackActivitySegments(bundle).length,
    timelineEventCount: timelineEvents.length,
    tachographGapCount,
    timelineGapCount: timelineGaps.length,
    tachographDaySummaryCount: bundle.daySummaries?.length ?? 0,
    timelineDailySummaryCount: timelineDailySummaries.length,
    eventCountMatches: timelineEvents.length === fallbackActivitySegments(bundle).length ||
      timelineEvents.length >= fallbackActivitySegments(bundle).length,
    gapCountMatches: timelineGaps.length === tachographGapCount,
    daySummaryCountMatches: timelineDailySummaries.length === (bundle.daySummaries?.length ?? 0),
    timelineGenerationId: generationIdFromTimelineBundle(timelineBundle),
  };
}

export function attachTimelineComparison(
  bundle: TachoParserBundle,
  timelineBundle: TachoTimelineBundle | null | undefined,
  fallbackWarnings: string[] = []
): TachoParserBundle {
  return {
    ...bundle,
    timelineBundle: timelineBundle ?? null,
    timelineComparison: compareTachoBundleToTimeline(bundle, timelineBundle, fallbackWarnings),
  };
}

function buildDaySummariesFromSegments(segments: TachoActivitySegment[]): TachoDaySummary[] {
  const byDate = new Map<string, TachoDaySummary>();

  segments.forEach((segment) => {
    const date = segment.startTime.slice(0, 10);
    const current = byDate.get(date) ?? {
      date,
      drivingMins: 0,
      workMins: 0,
      poaMins: 0,
      restMins: 0,
      findingsCount: 0,
      vuEventCount: 0,
      activities: [],
    };
    const durationMins = segmentDurationMins(segment);

    if (segment.activityType === 'driving') current.drivingMins += durationMins;
    if (segment.activityType === 'work') current.workMins += durationMins;
    if (segment.activityType === 'poa') current.poaMins += durationMins;
    if (segment.activityType === 'break_rest') current.restMins += durationMins;

    current.activities.push({ ...segment, durationMins });
    current.activities.sort((left, right) => left.startTime.localeCompare(right.startTime));
    byDate.set(date, current);
  });

  return Array.from(byDate.values()).sort((left, right) => right.date.localeCompare(left.date));
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
  const resolvedDriverId = download?.driverId ?? importRecord.driverId ?? '';
  const isCandidateCard = !resolvedDriverId;
  const activitySegments = dedupeActivitySegments(fallbackActivitySegments(bundle));
  const daySummaries = buildDaySummariesFromSegments(activitySegments);
  const findings = bundle.findings ?? [];
  const technicalEvents = bundle.technicalEvents ?? [];
  const drivingBreaches = findings.filter((finding) => finding.ruleCode.startsWith('DRV_')).length;
  const wtdAlerts = findings.filter((finding) => finding.ruleCode.startsWith('WTD_')).length;
  const mismatches = findings.filter((finding) => finding.ruleCode.startsWith('DISC_')).length;
  const linkedVuEvents = technicalEvents.length;

  return {
    identity: {
      driverId: resolvedDriverId,
      driverName: download?.driverName ?? importRecord.driverName ?? importRecord.cardDriverName ?? 'Candidate card',
      cardNumber: download?.cardNumber ?? importRecord.externalCardNumber ?? importRecord.driverCardNumberHint ?? 'Unknown card',
      cardExpiry: download?.cardExpiry ?? importRecord.cardExpiryDate ?? new Date().toISOString().slice(0, 10),
      issuingCountry: download?.issuingCountry ?? importRecord.cardIssuingAuthorityName ?? 'Unknown',
      lastDownloadAt: download?.downloadedAt ?? importRecord.importedAt,
      downloadStatus: driverDownloadStatus(download),
      periodStart: download?.periodStart,
      periodEnd: download?.periodEnd,
    },
    range,
    importId: importRecord.id,
    isCandidateCard,
    timelineComparison: bundle.timelineComparison,
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
    activitySegments,
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
    timelineComparison: bundle.timelineComparison,
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
