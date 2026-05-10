export type TachoActivityType = 'driving' | 'work' | 'poa' | 'break_rest' | 'unknown';

export type TachoFindingSource = 'app' | 'driver_card' | 'vehicle_unit' | 'combined';

export type TachoFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type TachoFindingStatus = 'breach' | 'warning' | 'info';

export type TachoAnalysisRange = '7d' | '30d' | '3m' | '6m';

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
  fileType: TachoImportFileType;
  importedAt: string;
  status: TachoImportStatus;
  progressPercent: number;
  driverName?: string;
  vehicleReg?: string;
  summary?: string;
}

export interface TachoEvidenceRef {
  kind: TachoEvidenceKind;
  refId: string;
  label?: string;
}

export interface TachoProcessingRun {
  importId: string;
  parserVersion: string;
  source: 'raw_activity' | 'normalized_findings';
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

export interface DriverCardAnalysisData {
  identity: DriverCardIdentity;
  range: TachoAnalysisRange;
  metrics: TachoSummaryMetric[];
  dailySummaries: TachoDaySummary[];
  findings: TachoFinding[];
  reconciliation: TachoReconciliationItem[];
}

export interface VehicleUnitAnalysisData {
  identity: VehicleUnitIdentity;
  range: TachoAnalysisRange;
  metrics: TachoSummaryMetric[];
  dailySummaries: TachoDaySummary[];
  findings: TachoFinding[];
  technicalEvents: TachoFinding[];
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
  hasData: boolean;
}

export interface ParserDriverTachoRiskSignal {
  driverId: string;
  source: 'normalized_findings';
  legalComplianceScore: number;
  violationCount: number;
  missingMileageCount: number;
  appMismatchCount: number;
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
  daySummaries: TachoDaySummary[];
  driverComplianceSignals: ParserDriverTachoComplianceSignal[];
  driverRiskSignals: ParserDriverTachoRiskSignal[];
}
