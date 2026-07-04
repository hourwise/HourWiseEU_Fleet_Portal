export type TachoActivityType = 'driving' | 'work' | 'poa' | 'break_rest' | 'unknown';

export type TachoFindingSource = 'app' | 'driver_card' | 'vehicle_unit' | 'combined';

export type TachoFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type TachoFindingStatus = 'breach' | 'warning' | 'info';

export type TachoAnalysisRange = '7d' | '30d' | '3m' | '6m' | '12m';

export type TachoImportStatus = 'uploaded' | 'queued' | 'processing' | 'complete' | 'partial' | 'failed';

export type TachoImportSourceType = 'driver_card' | 'vehicle_unit';

export type TachoImportFileType = 'ddd' | 'c1b' | 'v1b';

export type TachoEvidenceKind = 'raw_file' | 'activity_segment' | 'event' | 'fault' | 'summary' | 'finding';

export type TachoDownloadComplianceStatus = 'ok' | 'due_soon' | 'overdue';

export type TachoReconciliationStatus =
  | 'matched'
  | 'tacho_only'
  | 'app_only'
  | 'mismatch_activity'
  | 'mismatch_duration'
  | 'uncertain';

export interface TachoImportRecord {
  id: string;
  sourceType: TachoImportSourceType;
  fileName: string;
  filePath?: string | null;
  fileType: TachoImportFileType;
  importedAt: string;
  status: TachoImportStatus;
  progressPercent: number;
  driverId?: string | null;
  driverName?: string;
  externalCardNumber?: string;
  driverCardNumberHint?: string;
  cardDriverName?: string;
  cardExpiryDate?: string;
  cardIssuingAuthorityName?: string;
  identityDecoded?: boolean;
  vehicleReg?: string;
  summary?: string;
  technicalEventCount?: number;
  discrepancyCount?: number;
  reconciliationIssueCount?: number;
  highSeverityCount?: number;
  ingestSource?: string;
  parserStatus?: string;
  helperCaptureSchema?: string;
  helperCaptureWarning?: string;
  helperCaptureFileCount?: number;
  helperCaptureSelectedFileCount?: number;
  helperCaptureCapturedBytes?: number;
  processingError?: string;
  processingKickoffError?: string;
  triggerDispatchError?: string;
  triggerDispatchRequestedAt?: string;
  processingKickoffRequestedAt?: string;
  candidateReviewDecision?: 'reviewed' | 'no_hire' | 'defer';
  candidateReviewedAt?: string;
  candidateInviteStatus?: string;
  candidateInvitedAt?: string;
  pairedAt?: string;
  pairedDriverName?: string;
  supersededByImportId?: string;
  supersededAt?: string;
  activeAnalysisRows?: boolean;
  archivedAt?: string;
  archiveReason?: string;
  archiveStorageAction?: 'keep_file' | 'delete_file';
  storageDeleteRequestedAt?: string;
  storageDeletedAt?: string;
  discrepancyPreview?: VehicleMotionDiscrepancy[];
  reconciliationPreview?: TachoReconciliationItem[];
}

export interface TachoEvidenceRef {
  kind: TachoEvidenceKind;
  refId: string;
  label?: string;
}

export interface TachoProcessingRun {
  importId: string;
  parserVersion: string;
  source: 'raw_activity' | 'normalized_findings' | 'hourwise_read_only_capture';
  processedAt: string;
  warnings: string[];
  errors: string[];
}

export interface TachoActivitySegment {
  id: string;
  source: TachoFindingSource;
  activityType: TachoActivityType;
  driverId?: string | null;
  vehicleId?: string | null;
  startTime: string;
  endTime: string;
  durationMins: number;
  distanceKm?: number;
  confidence?: 'high' | 'medium' | 'low';
  label?: string;
}

export interface TachoFinding {
  id: string;
  driverId?: string | null;
  vehicleId?: string | null;
  source: TachoFindingSource;
  severity: TachoFindingSeverity;
  status: TachoFindingStatus;
  ruleCode: string;
  title: string;
  summary: string;
  occurredAt: string;
  periodStart: string;
  periodEnd: string;
  legalBasis?: string;
  evidenceRefs?: TachoEvidenceRef[];
  metadata?: Record<string, string | number | boolean | null>;
}

export type TachoFindingReviewStatus = 'open' | 'reviewed' | 'action_required' | 'closed';

export type TachoCorrectiveActionType = 'training' | 'manager_debrief' | 'manual_entry' | 'other';

export interface TachoFindingReview {
  id: string;
  findingId: string;
  companyId: string;
  driverId?: string | null;
  importId: string;
  status: TachoFindingReviewStatus;
  managerNote?: string | null;
  correctiveActionType?: TachoCorrectiveActionType | null;
  correctiveActionRefId?: string | null;
  reviewedAt?: string | null;
  reviewedByUserId?: string | null;
  closedAt?: string | null;
  closedByUserId?: string | null;
  driverAcknowledgedAt?: string | null;
  driverAcknowledgedByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TachoSummaryMetric {
  label: string;
  value: string;
  tone: 'neutral' | 'good' | 'warning' | 'danger';
}

export interface TachoReconciliationItem {
  id: string;
  status: TachoReconciliationStatus;
  date: string;
  appLabel: string;
  tachoLabel: string;
  summary: string;
}

export interface TachoReconciliationSummary {
  matchedDays: number;
  tachoOnlyDays: number;
  appOnlyDays: number;
  mismatchDurationDays: number;
  mismatchActivityDays: number;
  uncertainDays: number;
  totalIssues: number;
}

export interface TachoReviewFocus {
  date: string;
  kind: 'violation' | 'reconciliation' | 'missing_mileage';
  summary: string;
}

export interface TachoDaySummary {
  date: string;
  drivingMins: number;
  workMins: number;
  poaMins: number;
  restMins: number;
  appDrivingMins?: number;
  findingsCount: number;
  vuEventCount?: number;
  activities: TachoActivitySegment[];
}

export interface TimelineGenerationSummary {
  id: string;
  companyId?: string;
  driverId?: string | null;
  vehicleId?: string | null;
  scopeType?: string;
  scopeId?: string | null;
  rangeStart?: string;
  rangeEnd?: string;
  version?: string;
  status?: string;
  isCurrent?: boolean;
  generatedReason?: string;
  sourceImportId?: string | null;
  parserRunId?: string | null;
  supersedesGenerationId?: string | null;
  supersededByGenerationId?: string | null;
  supersededAt?: string | null;
  startedAt?: string;
  completedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TimelineEventSummary {
  id: string;
  timelineGenerationId?: string;
  eventType: string;
  driverId?: string | null;
  vehicleId?: string | null;
  startTime: string;
  endTime?: string | null;
  durationSeconds?: number | null;
  timezone?: string;
  confidenceState?: string;
  status?: string;
  isCurrent?: boolean;
  sourceSummary?: string;
  parserRunId?: string | null;
  importFileId?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TimelineGapSummary {
  id: string;
  timelineGenerationId?: string;
  driverId?: string | null;
  vehicleId?: string | null;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  gapType: string;
  severity: TachoFindingSeverity;
  reason: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface DailyTimelineSummary {
  id: string;
  timelineGenerationId?: string;
  driverId?: string | null;
  vehicleId?: string | null;
  date: string;
  drivingSeconds: number;
  workSeconds: number;
  availabilitySeconds: number;
  restSeconds: number;
  breakSeconds: number;
  unknownSeconds: number;
  dutyStart?: string | null;
  dutyEnd?: string | null;
  gapCount: number;
  findingCount: number;
  confidenceState: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineEventSourceSummary {
  id: string;
  timelineEventId: string;
  timelineGenerationId: string;
  sourceType: string;
  sourceId?: string | null;
  sourceExternalId?: string | null;
  parserRunId?: string | null;
  parserOutputId?: string | null;
  importFileId?: string | null;
  sourceReference?: Record<string, unknown>;
}

export interface TachoTimelineBundle {
  contractVersion: 'timeline-mvp-1';
  timelineGeneration?: TimelineGenerationSummary | null;
  timelineGenerations?: TimelineGenerationSummary[];
  events: TimelineEventSummary[];
  gaps: TimelineGapSummary[];
  dailySummaries: DailyTimelineSummary[];
  sources?: TimelineEventSourceSummary[];
  warnings: string[];
}

export interface TachoTimelineComparison {
  available: boolean;
  checkedAt: string;
  warnings: string[];
  tachographActivityCount: number;
  timelineEventCount: number;
  tachographGapCount: number;
  timelineGapCount: number;
  tachographDaySummaryCount: number;
  timelineDailySummaryCount: number;
  eventCountMatches: boolean;
  gapCountMatches: boolean;
  daySummaryCountMatches: boolean;
  timelineGenerationId?: string | null;
}

export interface DriverCardIdentity {
  driverId: string;
  driverName: string;
  cardNumber: string;
  cardExpiry: string;
  issuingCountry: string;
  lastDownloadAt: string;
  downloadStatus: TachoDownloadComplianceStatus;
  periodStart?: string;
  periodEnd?: string;
}

export interface VehicleUnitIdentity {
  vehicleId: string;
  regNumber: string;
  vuSerial: string;
  makeModel: string;
  calibrationDue: string;
  lastDownloadAt: string;
  downloadStatus: TachoDownloadComplianceStatus;
  periodStart?: string;
  periodEnd?: string;
}

export type VehicleDiscrepancyStatus = 'unassigned_motion' | 'card_gap' | 'driver_mismatch' | 'needs_review';

export interface VehicleMotionDiscrepancy {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMins: number;
  severity: TachoFindingSeverity;
  status: VehicleDiscrepancyStatus;
  summary: string;
  linkedDriverName?: string;
  evidenceRefs?: TachoEvidenceRef[];
}

export interface DriverCardAnalysisData {
  identity: DriverCardIdentity;
  range: TachoAnalysisRange;
  importId?: string;
  isCandidateCard?: boolean;
  metrics: TachoSummaryMetric[];
  dailySummaries: TachoDaySummary[];
  activitySegments: TachoActivitySegment[];
  findings: TachoFinding[];
  technicalEvents: TachoFinding[];
  reconciliation: TachoReconciliationItem[];
}

export interface VehicleUnitAnalysisData {
  identity: VehicleUnitIdentity;
  range: TachoAnalysisRange;
  metrics: TachoSummaryMetric[];
  dailySummaries: TachoDaySummary[];
  activitySegments: TachoActivitySegment[];
  findings: TachoFinding[];
  technicalEvents: TachoFinding[];
  unassignedMotion: VehicleMotionDiscrepancy[];
}

export interface ParserDriverCardDownload {
  importId: string;
  companyId: string;
  driverId?: string | null;
  driverName?: string | null;
  cardNumber: string;
  cardExpiry?: string | null;
  issuingCountry?: string | null;
  downloadedAt: string;
  periodStart: string;
  periodEnd: string;
  downloadStatus: TachoDownloadComplianceStatus;
}

export interface ParserVehicleUnitDownload {
  importId: string;
  companyId: string;
  vehicleId?: string | null;
  regNumber?: string | null;
  vuSerial: string;
  calibrationDue?: string | null;
  downloadedAt: string;
  periodStart: string;
  periodEnd: string;
  downloadStatus: TachoDownloadComplianceStatus;
}

export interface ParserDriverTachoComplianceSignal {
  driverId: string;
  source: 'normalized_findings';
  averageScore: number;
  totalViolations: number;
  violations: string[];
  recentViolations: {
    date: string;
    violations: string[];
    score: number;
    sessionId: string;
    source: 'tacho';
  }[];
  missingMileage: {
    start: string;
    end: string;
    durationMins: number;
    distanceKm: number;
  }[];
  reconciliationSummary?: TachoReconciliationSummary;
  reviewFocus?: TachoReviewFocus;
  hasData: boolean;
}

export interface ParserDriverTachoRiskSignal {
  driverId: string;
  source: 'normalized_findings';
  legalComplianceScore: number;
  violationCount: number;
  missingMileageCount: number;
  appMismatchCount: number;
  reconciliationSummary?: TachoReconciliationSummary;
  reviewFocus?: TachoReviewFocus;
}

export interface TachoParserBundle {
  contractVersion: '1.0';
  importRecord: TachoImportRecord;
  processingRun: TachoProcessingRun;
  driverCardDownload?: ParserDriverCardDownload;
  vehicleUnitDownload?: ParserVehicleUnitDownload;
  activitySegments: TachoActivitySegment[];
  findings: TachoFinding[];
  technicalEvents: TachoFinding[];
  reconciliation?: TachoReconciliationItem[];
  vehicleMotionDiscrepancies?: VehicleMotionDiscrepancy[];
  daySummaries: TachoDaySummary[];
  driverComplianceSignals: ParserDriverTachoComplianceSignal[];
  driverRiskSignals: ParserDriverTachoRiskSignal[];
  timelineBundle?: TachoTimelineBundle | null;
  timelineComparison?: TachoTimelineComparison;
}

export type TachoRuleCode =
  | 'DRV_CONTINUOUS_4H30_EXCEEDED'
  | 'DRV_DAILY_9H_EXCEEDED'
  | 'DRV_DAILY_10H_EXCEEDED'
  | 'DRV_WEEKLY_56H_EXCEEDED'
  | 'DRV_FORTNIGHT_90H_EXCEEDED'
  | 'DRV_MULTI_MANNING_DETECTED'
  | 'REST_DAILY_UNDER_9H'
  | 'REST_DAILY_REDUCED'
  | 'REST_WEEKLY_UNDER_24H'
  | 'REST_WEEKLY_REDUCED'
  | 'REST_WEEKLY_COMPENSATION_PENDING'
  | 'REST_WEEKLY_COMPENSATION_COMPLETED'
  | 'REST_WEEKLY_COMPENSATION_MISSING'
  | 'WTD_BREAK_AFTER_6H_MISSING'
  | 'WTD_BREAK_AFTER_9H_MISSING'
  | 'DATA_INVALID_ACTIVITY'
  | 'DATA_OVERLAPPING_ACTIVITY'
  | 'DISC_APP_TACHO_MISMATCH'
  | 'VU_OVERSPEED'
  | 'VU_MOTION_CONFLICT'
  | 'VU_POWER_INTERRUPTION'
  | 'VU_DRIVING_WITHOUT_CARD'
  | 'VU_CARD_INSERTION_WHILE_DRIVING'
  | 'VU_CARD_CONFLICT'
  | 'VU_SENSOR_FAULT'
  | 'VU_SECURITY_FAULT'
  | 'VU_CALIBRATION_EVENT';

export interface RuleActivitySegment {
  id: string;
  driverId?: string | null;
  vehicleId?: string | null;
  startTime: string;
  endTime: string;
  activityType: 'driving' | 'work' | 'poa' | 'rest';
  distanceKm?: number | null;
  isManualEntry?: boolean;
  source: 'raw_activity' | 'normalized_findings';
}

export interface RuleDutyWindow {
  id: string;
  driverId?: string | null;
  vehicleId?: string | null;
  dutyDate: string;
  dutyStart: string;
  dutyEnd: string;
  activities: RuleActivitySegment[];
  drivingMins: number;
  workMins: number;
  poaMins: number;
  restMins: number;
}

export interface RuleEvaluationInput {
  driverId: string;
  activities: RuleActivitySegment[];
  vehicleId?: string | null;
  source?: 'driver_card' | 'vehicle_unit';
}

export interface RuleEvaluationResult {
  driverId: string;
  vehicleId?: string | null;
  source: 'driver_card' | 'vehicle_unit';
  activities: RuleActivitySegment[];
  dutyWindows: RuleDutyWindow[];
  daySummaries: TachoDaySummary[];
  findings: TachoFinding[];
  dataQualityIssues: TachoFinding[];
}
