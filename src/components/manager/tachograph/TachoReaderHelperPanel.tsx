import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Laptop,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import {
  acknowledgeReaderHelperImport,
  fetchDriverReviewFocusDate,
  fetchReaderHelperImportStatus,
  kickoffTachoImportProcessing,
  registerReaderHelperImport,
  type ReaderHelperImportStatus,
} from '../../../lib/tacho/helperImport';

type ReaderHelperStage =
  | 'helper_unavailable'
  | 'ready'
  | 'card_inserted'
  | 'reading'
  | 'uploading'
  | 'processing'
  | 'complete'
  | 'error';

interface ReaderHelperStatus {
  stage: ReaderHelperStage;
  progressPercent: number;
  headline: string;
  detail: string;
  helperUrl: string;
  helperVersion?: string;
  importId?: string;
  sourceType?: string;
  driverId?: string;
  driverName?: string;
  focusedDate?: string;
  lastHeartbeatAt?: string;
  readerConnected?: boolean;
  readerDeviceName?: string;
  cardPresent?: boolean;
  canStartRead: boolean;
  canCancel: boolean;
  errorCode?: string;
  companyId?: string;
  requestedByUserId?: string;
  readSessionId?: string;
  exportFileName?: string;
  exportFilePath?: string;
  exportDownloadPath?: string;
  exportFileSizeBytes?: number;
  exportSha256?: string;
  exportFormat?: string;
  exportParserReady?: boolean;
  exportNote?: string;
  driverCardNumberHint?: string;
  vehicleRegHint?: string;
  uploadReceiptId?: string;
  uploadPercent?: number;
  backendJobId?: string;
  uploadedStoragePath?: string;
  scenario?: string;
  availableScenarios?: string[];
}

interface ReaderHelperResponse {
  stage?: string;
  status?: string;
  progressPercent?: number;
  progress?: number;
  message?: string;
  detail?: string;
  helperVersion?: string;
  importId?: string;
  sourceType?: string;
  driverId?: string;
  driverName?: string;
  focusedDate?: string;
  reviewDate?: string;
  lastHeartbeatAt?: string;
  readerConnected?: boolean;
  readerDetected?: boolean;
  readerDeviceName?: string;
  cardPresent?: boolean;
  cardInserted?: boolean;
  canStartRead?: boolean;
  canCancel?: boolean;
  errorCode?: string;
  companyId?: string;
  requestedByUserId?: string;
  readSessionId?: string;
  exportFileName?: string;
  exportFilePath?: string;
  exportDownloadPath?: string;
  exportFileSizeBytes?: number;
  exportSha256?: string;
  exportFormat?: string;
  exportParserReady?: boolean;
  exportNote?: string;
  driverCardNumberHint?: string;
  vehicleRegHint?: string;
  uploadReceiptId?: string;
  uploadPercent?: number;
  backendJobId?: string;
  uploadedStoragePath?: string;
  scenario?: string;
  availableScenarios?: string[];
}

interface ReaderHelperDiagnosticEvent {
  timestamp?: string;
  Timestamp?: string;
  event?: string;
  Event?: string;
  data?: unknown;
  Data?: unknown;
}

interface ReaderHelperDiagnostics {
  helperVersion?: string;
  utcNow?: string;
  processId?: number;
  listenUrl?: string;
  config?: {
    placeholderReaderEnabled?: boolean;
    simulateCardPresent?: boolean;
    completeAfterRegister?: boolean;
    vuWorkflowEnabled?: boolean;
    exportCommandConfigured?: boolean;
    exportArgumentsConfigured?: boolean;
    exportTimeoutSeconds?: number;
    exportOutputDirectory?: string;
    logDirectory?: string;
  };
  capabilities?: {
    sourceTypes?: string[];
    diagnostics?: string[];
    exportDownload?: boolean;
    browserRegistrationHandoff?: boolean;
  };
  recentEvents?: ReaderHelperDiagnosticEvent[];
}

const DEFAULT_HELPER_URL = import.meta.env.VITE_TACHO_HELPER_URL || 'http://127.0.0.1:47231';
const AUTO_OPEN_REVIEW_STORAGE_KEY = 'hourwise:tacho-reader:auto-opened-review';

const WORKFLOW_STEPS: { id: Exclude<ReaderHelperStage, 'helper_unavailable' | 'error'>; label: string }[] = [
  { id: 'ready', label: 'Helper ready' },
  { id: 'card_inserted', label: 'Card inserted' },
  { id: 'reading', label: 'Reading card' },
  { id: 'uploading', label: 'Uploading file' },
  { id: 'processing', label: 'Processing import' },
  { id: 'complete', label: 'Analysis ready' },
];

function normalizeStage(value: string | undefined): ReaderHelperStage {
  switch (value) {
    case 'ready':
    case 'card_inserted':
    case 'reading':
    case 'uploading':
    case 'processing':
    case 'complete':
    case 'error':
      return value;
    default:
      return 'helper_unavailable';
  }
}

function defaultStatus(helperUrl: string): ReaderHelperStatus {
  return {
    stage: 'helper_unavailable',
    progressPercent: 0,
    headline: 'Desktop helper not connected',
    detail: 'The reader helper did not answer, so the supervisor should use manual file upload for now.',
    helperUrl,
    canStartRead: false,
    canCancel: false,
  };
}

function getAutoOpenedReviewKey() {
  try {
    return window.sessionStorage.getItem(AUTO_OPEN_REVIEW_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setAutoOpenedReviewKey(key: string) {
  try {
    window.sessionStorage.setItem(AUTO_OPEN_REVIEW_STORAGE_KEY, key);
  } catch {
    // Non-critical: in private/restricted storage, the in-memory guard still prevents loops during this mount.
  }
}

function buildImportedStatus(
  helperStatus: ReaderHelperStatus,
  trackedImport: ReaderHelperImportStatus | null,
  focusedDate: string | null
): ReaderHelperStatus {
  if (!trackedImport) return helperStatus;

  const stage =
    trackedImport.status === 'error'
      ? 'error'
      : trackedImport.status === 'processed' || trackedImport.status === 'partial'
      ? 'complete'
      : 'processing';

  const detail =
    trackedImport.status === 'pending'
      ? `Import ${trackedImport.importId} is registered and waiting for processing to start.`
      : trackedImport.status === 'processing'
      ? `Import ${trackedImport.importId} is processing in Supabase.`
      : trackedImport.status === 'partial'
      ? trackedImport.summary ?? `Import ${trackedImport.importId} completed with partial parser output.`
      : trackedImport.status === 'processed'
      ? trackedImport.summary ?? `Import ${trackedImport.importId} completed successfully.`
      : trackedImport.summary ?? `Import ${trackedImport.importId} failed during processing.`;

  const headline =
    stage === 'complete'
      ? 'Driver review ready'
      : stage === 'error'
      ? 'Supabase import failed'
      : 'Processing tachograph import';

  return {
    ...helperStatus,
    stage,
    headline,
    detail,
    progressPercent:
      stage === 'complete' || stage === 'error' ? 100 : trackedImport.status === 'pending' ? 80 : 90,
    importId: trackedImport.importId,
    sourceType: trackedImport.sourceType ?? helperStatus.sourceType,
    driverId: trackedImport.driverId ?? helperStatus.driverId,
    driverName: trackedImport.driverName ?? helperStatus.driverName,
    focusedDate: focusedDate ?? helperStatus.focusedDate,
    uploadedStoragePath: trackedImport.filePath ?? helperStatus.uploadedStoragePath,
    exportFileName: trackedImport.fileName ?? helperStatus.exportFileName,
    canCancel: helperStatus.canCancel,
  };
}

function buildStatus(helperUrl: string, response: ReaderHelperResponse): ReaderHelperStatus {
  const stage = normalizeStage(response.stage ?? response.status);
  const detail =
    response.detail ??
    response.message ??
    (stage === 'ready'
      ? 'Helper is online and waiting for a driver card.'
      : stage === 'card_inserted'
      ? 'Card detected. Reading can start automatically.'
      : stage === 'reading'
      ? 'The helper is exporting the driver card locally.'
      : stage === 'uploading'
      ? 'The export file is being uploaded to the portal.'
      : stage === 'processing'
      ? 'Supabase processing is running and the analysis bundle is being prepared.'
      : stage === 'complete'
      ? 'The import completed successfully and the review workspace can open.'
      : 'The helper reported a reader or upload error.');

  const headline =
    stage === 'ready'
      ? 'Reader helper ready'
      : stage === 'card_inserted'
      ? 'Driver card detected'
      : stage === 'reading'
      ? 'Reading card'
      : stage === 'uploading'
      ? 'Uploading export'
      : stage === 'processing'
      ? 'Processing tachograph import'
      : stage === 'complete'
      ? 'Driver review ready'
      : stage === 'error'
      ? 'Reader helper reported an error'
      : 'Desktop helper not connected';

  return {
    stage,
    progressPercent:
      typeof response.progressPercent === 'number'
        ? response.progressPercent
        : typeof response.progress === 'number'
        ? response.progress
        : stage === 'complete'
        ? 100
        : stage === 'ready'
        ? 10
        : stage === 'card_inserted'
        ? 20
        : stage === 'reading'
        ? 45
        : stage === 'uploading'
        ? 70
        : stage === 'processing'
        ? 90
        : 0,
    headline,
    detail,
    helperUrl,
    helperVersion: response.helperVersion,
    importId: response.importId,
    sourceType: response.sourceType,
    driverId: response.driverId,
    driverName: response.driverName,
    focusedDate: response.focusedDate ?? response.reviewDate,
    lastHeartbeatAt: response.lastHeartbeatAt,
    readerConnected: response.readerConnected ?? response.readerDetected,
    readerDeviceName: response.readerDeviceName,
    cardPresent: response.cardPresent ?? response.cardInserted,
    canStartRead:
      typeof response.canStartRead === 'boolean'
        ? response.canStartRead
        : stage === 'ready' || stage === 'card_inserted',
    canCancel:
      typeof response.canCancel === 'boolean'
        ? response.canCancel
        : stage === 'reading' || stage === 'uploading' || stage === 'processing',
    errorCode: response.errorCode,
    companyId: response.companyId,
    requestedByUserId: response.requestedByUserId,
    readSessionId: response.readSessionId,
    exportFileName: response.exportFileName,
    exportFilePath: response.exportFilePath,
    exportDownloadPath: response.exportDownloadPath,
    exportFileSizeBytes: response.exportFileSizeBytes,
    exportSha256: response.exportSha256,
    exportFormat: response.exportFormat,
    exportParserReady: response.exportParserReady,
    exportNote: response.exportNote,
    driverCardNumberHint: response.driverCardNumberHint,
    vehicleRegHint: response.vehicleRegHint,
    uploadReceiptId: response.uploadReceiptId,
    uploadPercent: response.uploadPercent,
    backendJobId: response.backendJobId,
    uploadedStoragePath: response.uploadedStoragePath,
    scenario: response.scenario,
    availableScenarios: response.availableScenarios,
  };
}

export function TachoReaderHelperPanel({
  onOpenDriverAnalysis,
  onImportRegistered,
}: {
  onOpenDriverAnalysis?: (driverId: string, date?: string) => void;
  onImportRegistered?: () => void;
}) {
  const { profile, user } = useAuth();
  const helperUrl = DEFAULT_HELPER_URL.replace(/\/$/, '');
  const [helperStatus, setHelperStatus] = useState<ReaderHelperStatus>(() => defaultStatus(helperUrl));
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [commandPending, setCommandPending] = useState<'start-read' | 'cancel' | null>(null);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [debugPending, setDebugPending] = useState<'reset' | 'card-insert' | 'error' | null>(null);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [scenarioPending, setScenarioPending] = useState(false);
  const [scenarioMessage, setScenarioMessage] = useState<string | null>(null);
  const [importPending, setImportPending] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [registeredImport, setRegisteredImport] = useState<{ readSessionId: string; importId: string } | null>(null);
  const [trackedImport, setTrackedImport] = useState<ReaderHelperImportStatus | null>(null);
  const [trackedFocusedDate, setTrackedFocusedDate] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState('success');
  const [diagnostics, setDiagnostics] = useState<ReaderHelperDiagnostics | null>(null);
  const [diagnosticsPending, setDiagnosticsPending] = useState(false);
  const [diagnosticsMessage, setDiagnosticsMessage] = useState<string | null>(null);
  const openedReviewKeyRef = useRef<string | null>(null);
  const canAutoOpenReviewRef = useRef(false);
  const importSessionRef = useRef<string | null>(null);

  const status = useMemo(
    () => buildImportedStatus(helperStatus, trackedImport, trackedFocusedDate),
    [helperStatus, trackedFocusedDate, trackedImport]
  );

  const refreshStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 2500);
      const response = await fetch(`${helperUrl}/status`, {
        method: 'GET',
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Helper returned ${response.status}`);
      }

      const nextStatus = buildStatus(helperUrl, (await response.json()) as ReaderHelperResponse);
      setHelperStatus(nextStatus);
      setLastError(null);
    } catch (error) {
      setHelperStatus(defaultStatus(helperUrl));
      setLastError(error instanceof Error ? error.message : 'Unable to reach helper');
    } finally {
      setRefreshing(false);
    }
  }, [helperUrl]);

  const sendCommand = useCallback(
    async (command: 'start-read' | 'cancel') => {
      setCommandPending(command);
      setCommandMessage(null);

      try {
        if (command === 'start-read' && !profile?.company_id) {
          throw new Error('Cannot start a card read without a signed-in company context.');
        }

        const response = await fetch(`${helperUrl}/commands/${command}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestedAt: new Date().toISOString(),
            companyId: profile?.company_id ?? null,
            requestedByUserId: user?.id ?? null,
          }),
        });

        if (!response.ok) {
          throw new Error(`Helper returned ${response.status}`);
        }

        setCommandMessage(command === 'start-read' ? 'Read command sent to helper.' : 'Cancel command sent to helper.');
        await refreshStatus();
      } catch (error) {
        setCommandMessage(error instanceof Error ? error.message : 'Failed to send helper command');
      } finally {
        setCommandPending(null);
      }
    },
    [helperUrl, profile?.company_id, refreshStatus, user?.id]
  );

  const loadDiagnostics = useCallback(async () => {
    setDiagnosticsPending(true);
    setDiagnosticsMessage(null);

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 2500);
      const response = await fetch(`${helperUrl}/diagnostics`, {
        method: 'GET',
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Helper returned ${response.status}`);
      }

      setDiagnostics((await response.json()) as ReaderHelperDiagnostics);
      setDiagnosticsMessage('Diagnostics refreshed from the local helper.');
    } catch (error) {
      setDiagnosticsMessage(error instanceof Error ? error.message : 'Diagnostics endpoint is unavailable');
    } finally {
      setDiagnosticsPending(false);
    }
  }, [helperUrl]);

  const sendDebugCommand = useCallback(
    async (command: 'reset' | 'card-insert' | 'error') => {
      setDebugPending(command);
      setDebugMessage(null);

      try {
        const response = await fetch(`${helperUrl}/debug/${command}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requestedAt: new Date().toISOString(),
          }),
        });

        if (!response.ok) {
          throw new Error(`Helper returned ${response.status}`);
        }

        const labels: Record<'reset' | 'card-insert' | 'error', string> = {
          reset: 'Mock helper reset requested.',
          'card-insert': 'Mock card insertion requested.',
          error: 'Mock error state requested.',
        };
        setDebugMessage(labels[command]);
        await refreshStatus();
      } catch (error) {
        setDebugMessage(error instanceof Error ? error.message : 'Failed to send mock helper command');
      } finally {
        setDebugPending(null);
      }
    },
    [helperUrl, refreshStatus]
  );

  const applyScenario = useCallback(async () => {
    setScenarioPending(true);
    setScenarioMessage(null);

    try {
      const response = await fetch(`${helperUrl}/debug/scenario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenario: selectedScenario,
          requestedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Helper returned ${response.status}`);
      }

      setScenarioMessage(`Scenario switched to ${selectedScenario.replace(/_/g, ' ')}.`);
      await refreshStatus();
    } catch (error) {
      setScenarioMessage(error instanceof Error ? error.message : 'Failed to switch helper scenario');
    } finally {
      setScenarioPending(false);
    }
  }, [helperUrl, refreshStatus, selectedScenario]);

  useEffect(() => {
    refreshStatus();
    const intervalId = window.setInterval(() => {
      refreshStatus();
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (helperStatus.readSessionId || !registeredImport) return;
    setRegisteredImport(null);
    setTrackedImport(null);
    setTrackedFocusedDate(null);
    importSessionRef.current = null;
    openedReviewKeyRef.current = null;
  }, [helperStatus.readSessionId, registeredImport]);

  useEffect(() => {
    if (status.stage !== 'complete') {
      canAutoOpenReviewRef.current = true;
    }
  }, [status.stage]);

  useEffect(() => {
    if (status.stage !== 'complete' || !status.driverId || !onOpenDriverAnalysis) return;
    if (!canAutoOpenReviewRef.current) return;
    const reviewKey = `${status.importId ?? status.readSessionId ?? 'no-import'}:${status.driverId}:${status.focusedDate ?? 'no-date'}`;
    if (openedReviewKeyRef.current === reviewKey) return;
    if (getAutoOpenedReviewKey() === reviewKey) return;
    openedReviewKeyRef.current = reviewKey;
    canAutoOpenReviewRef.current = false;
    setAutoOpenedReviewKey(reviewKey);
    onOpenDriverAnalysis(status.driverId, status.focusedDate);
  }, [onOpenDriverAnalysis, status]);

  useEffect(() => {
    if (helperStatus.stage !== 'uploading' || !helperStatus.readSessionId || !helperStatus.exportDownloadPath) return;
    const companyId = profile?.company_id;
    if (!companyId) return;
    const readSessionId = helperStatus.readSessionId;
    const exportDownloadPath = helperStatus.exportDownloadPath;
    if (registeredImport?.readSessionId === helperStatus.readSessionId) return;
    if (importSessionRef.current === helperStatus.readSessionId) return;

    let cancelled = false;
    importSessionRef.current = readSessionId;
    setImportPending(true);
    setImportMessage(
      helperStatus.exportParserReady === false
        ? 'Uploading read-only helper capture for controlled partial import and diagnostics.'
        : 'Uploading helper export to the portal and registering the import.'
    );

    const registerImport = async () => {
      try {
        const registration = await registerReaderHelperImport({
          companyId,
          descriptor: {
            helperUrl,
            readSessionId,
            helperVersion: helperStatus.helperVersion,
            companyId: helperStatus.companyId,
            requestedByUserId: helperStatus.requestedByUserId ?? user?.id,
            sourceType: helperStatus.sourceType,
            exportFileName: helperStatus.exportFileName,
            exportDownloadPath,
            exportFileSizeBytes: helperStatus.exportFileSizeBytes,
            exportSha256: helperStatus.exportSha256,
            exportFormat: helperStatus.exportFormat,
            exportParserReady: helperStatus.exportParserReady,
            exportNote: helperStatus.exportNote,
            driverName: helperStatus.driverName,
            driverCardNumberHint: helperStatus.driverCardNumberHint,
            vehicleRegHint: helperStatus.vehicleRegHint,
          },
        });

        const kickoff = await kickoffTachoImportProcessing(registration.record);

        await acknowledgeReaderHelperImport({
          helperUrl,
          readSessionId,
          importId: registration.importId,
          uploadedStoragePath: registration.filePath,
          fileName: registration.fileName,
          fileType: registration.fileType,
          sourceType: registration.sourceType,
        });

        if (cancelled) return;

        setRegisteredImport({
          readSessionId,
          importId: registration.importId,
        });
        setImportMessage(
          kickoff.started
            ? helperStatus.exportParserReady === false
              ? `Import ${registration.importId} registered as a read-only diagnostic capture. Processing was requested and should complete as a partial import.`
              : `Import ${registration.importId} registered from the helper export and processing was requested.`
            : `Import ${registration.importId} registered from the helper export, but processing kickoff did not confirm: ${kickoff.error ?? 'Unknown error'}.`
        );
        onImportRegistered?.();
        await refreshStatus();
      } catch (error) {
        if (!cancelled) {
          importSessionRef.current = null;
          setImportMessage(error instanceof Error ? error.message : 'Failed to register helper import');
        }
      } finally {
        if (!cancelled) {
          setImportPending(false);
        }
      }
    };

    registerImport();

    return () => {
      cancelled = true;
    };
  }, [
    helperStatus.companyId,
    helperStatus.driverCardNumberHint,
    helperStatus.driverName,
    helperStatus.exportDownloadPath,
    helperStatus.exportFileName,
    helperStatus.exportFormat,
    helperStatus.exportFileSizeBytes,
    helperStatus.exportNote,
    helperStatus.exportParserReady,
    helperStatus.exportSha256,
    helperStatus.helperVersion,
    helperStatus.requestedByUserId,
    helperStatus.readSessionId,
    helperStatus.sourceType,
    helperStatus.stage,
    helperStatus.vehicleRegHint,
    helperUrl,
    onImportRegistered,
    profile?.company_id,
    refreshStatus,
    registeredImport?.readSessionId,
    user?.id,
  ]);

  useEffect(() => {
    const companyId = profile?.company_id;
    const importId = registeredImport?.importId ?? helperStatus.importId;
    if (!companyId || !importId) return;

    let cancelled = false;

    const loadImport = async () => {
      try {
        const nextImport = await fetchReaderHelperImportStatus(companyId, importId);
        if (cancelled) return;
        setTrackedImport(nextImport);

        if (nextImport?.driverId) {
          const focusDate = await fetchDriverReviewFocusDate(companyId, nextImport.driverId);
          if (!cancelled) {
            setTrackedFocusedDate(focusDate ?? null);
          }
        } else if (!cancelled) {
          setTrackedFocusedDate(null);
        }
      } catch (error) {
        if (!cancelled) {
          setImportMessage(error instanceof Error ? error.message : 'Failed to refresh helper import status');
        }
      }
    };

    loadImport();
    const intervalId = window.setInterval(loadImport, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [helperStatus.importId, profile?.company_id, registeredImport?.importId]);

  useEffect(() => {
    if (helperStatus.stage !== 'reading' || !helperStatus.readSessionId) return;
    if (registeredImport?.readSessionId === helperStatus.readSessionId) return;
    setRegisteredImport(null);
    setTrackedImport(null);
    setTrackedFocusedDate(null);
    setImportMessage(null);
    importSessionRef.current = null;
  }, [helperStatus.readSessionId, helperStatus.stage, registeredImport?.readSessionId]);

  const completedStepIndex = useMemo(() => {
    const index = WORKFLOW_STEPS.findIndex((step) => step.id === status.stage);
    return index === -1 ? -1 : index;
  }, [status.stage]);

  const isMockHelper = useMemo(() => status.helperVersion?.startsWith('mock-') ?? false, [status.helperVersion]);

  useEffect(() => {
    if (helperStatus.stage === 'helper_unavailable' || isMockHelper) return;
    loadDiagnostics();
  }, [helperStatus.helperVersion, helperStatus.stage, isMockHelper, loadDiagnostics]);

  useEffect(() => {
    if (helperStatus.scenario) {
      setSelectedScenario(helperStatus.scenario);
    }
  }, [helperStatus.scenario]);

  const tone =
    status.stage === 'complete'
      ? 'border-emerald-200 bg-emerald-50'
      : status.stage === 'error'
      ? 'border-rose-200 bg-rose-50'
      : status.stage === 'helper_unavailable'
      ? 'border-amber-200 bg-amber-50'
      : 'border-blue-200 bg-blue-50';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-3">
              <Laptop className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reader Helper</p>
              <h3 className="mt-1 text-xl font-black text-slate-900">Live Card Reader Flow</h3>
              <p className="mt-2 text-sm text-slate-500">
                Polls the local Windows helper and auto-opens driver review when a card read completes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshStatus}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh helper
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div className={`rounded-2xl border p-4 ${tone}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Current State</p>
              <h4 className="mt-1 text-lg font-black text-slate-900">{status.headline}</h4>
              <p className="mt-2 text-sm text-slate-600">{status.detail}</p>
            </div>
            <StatusIcon stage={status.stage} />
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
              <span>Workflow progress</span>
              <span>{status.progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/80 overflow-hidden">
              <div
                className={`h-2 rounded-full transition-all ${
                  status.stage === 'error' ? 'bg-rose-500' : status.stage === 'complete' ? 'bg-emerald-500' : 'bg-blue-600'
                }`}
                style={{ width: `${status.progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <ReaderGraphicConsole status={status} diagnostics={diagnostics} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetaCard label="Helper endpoint" value={status.helperUrl} />
          <MetaCard label="Helper version" value={status.helperVersion ?? 'Not reported'} />
          <MetaCard
            label="Last heartbeat"
            value={status.lastHeartbeatAt ? new Date(status.lastHeartbeatAt).toLocaleString('en-GB') : 'No heartbeat yet'}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <MetaCard label="Reader detected" value={status.readerConnected ? status.readerDeviceName ?? 'Connected' : 'Not detected'} />
          <MetaCard label="Card present" value={status.cardPresent ? 'Inserted' : 'Not inserted'} />
          <MetaCard label="Import id" value={status.importId ?? 'Waiting for read'} />
          <MetaCard label="Helper error code" value={status.errorCode ?? 'None'} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <MetaCard label="Company" value={status.companyId ?? 'Not reported'} />
          <MetaCard label="Driver target" value={status.driverName ?? status.driverId ?? 'Pending correlation'} />
          <MetaCard label="Read session" value={status.readSessionId ?? 'Not started'} />
          <MetaCard label="Operator" value={status.requestedByUserId ?? user?.id ?? 'Not reported'} />
          <MetaCard label="Backend job" value={status.backendJobId ?? 'Pending upload'} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Export And Upload Correlation</p>
              <p className="mt-1 text-sm text-slate-600">
                Shows the simulated file export, storage path, and upload receipt that the production helper will need to correlate.
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Upload progress</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{typeof status.uploadPercent === 'number' ? `${status.uploadPercent}%` : 'Not started'}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <MetaCard label="Export file" value={status.exportFileName ?? 'Pending export'} />
            <MetaCard label="Export path" value={status.exportFilePath ?? 'Pending export'} />
            <MetaCard label="Download path" value={status.exportDownloadPath ?? 'Pending export'} />
            <MetaCard label="Storage path" value={status.uploadedStoragePath ?? 'Pending upload'} />
            <MetaCard label="Upload receipt" value={status.uploadReceiptId ?? 'Pending upload'} />
            <MetaCard label="Source type" value={status.sourceType ?? 'Not reported'} />
            <MetaCard label="Export format" value={status.exportFormat ?? 'Not reported'} />
            <MetaCard
              label="Parser ready"
              value={status.exportParserReady === false ? 'Diagnostic partial' : 'Yes'}
            />
          </div>
          {status.exportParserReady === false ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-black uppercase tracking-widest">Read-only diagnostic capture</p>
              <p className="mt-1">
                {status.exportNote ??
                  'The helper produced a read-only card capture. It can be uploaded for controlled partial import and diagnostics, but it is not compliance-ready analysis yet.'}
              </p>
            </div>
          ) : null}
          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
              <span>File size</span>
              <span>{formatBytes(status.exportFileSizeBytes)}</span>
            </div>
            <div className="h-2 rounded-full bg-white overflow-hidden">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${typeof status.uploadPercent === 'number' ? status.uploadPercent : 0}%` }}
              />
            </div>
          </div>
          {importMessage ? (
            <p className={`mt-3 text-xs ${importPending ? 'text-blue-700' : 'text-slate-600'}`}>{importMessage}</p>
          ) : null}
        </div>

        {!isMockHelper ? (
          <HelperDiagnosticsPanel
            diagnostics={diagnostics}
            pending={diagnosticsPending}
            message={diagnosticsMessage}
            onRefresh={loadDiagnostics}
          />
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Operator actions</p>
              <p className="mt-1 text-sm text-slate-600">
                These commands assume the helper implements the localhost contract defined in the new reader-helper doc.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => sendCommand('start-read')}
                disabled={!status.canStartRead || commandPending !== null || !profile?.company_id}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {commandPending === 'start-read' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Start read
              </button>
              <button
                type="button"
                onClick={() => sendCommand('cancel')}
                disabled={!status.canCancel || commandPending !== null}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {commandPending === 'cancel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                Cancel
              </button>
            </div>
          </div>
          {commandMessage ? <p className="mt-3 text-xs text-slate-600">{commandMessage}</p> : null}
        </div>

        {isMockHelper ? (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">Mock Helper Scenario</p>
                  <p className="mt-1 text-sm text-violet-900">
                    Switch the simulated helper flow before running a read.
                  </p>
                </div>
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <select
                    value={selectedScenario}
                    onChange={(event) => setSelectedScenario(event.target.value)}
                    disabled={scenarioPending}
                    className="rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm font-bold text-violet-950 outline-none"
                  >
                    {(status.availableScenarios ?? ['success']).map((scenario) => (
                      <option key={scenario} value={scenario}>
                        {scenario.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={applyScenario}
                    disabled={scenarioPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {scenarioPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Apply scenario
                  </button>
                </div>
              </div>
              {scenarioMessage ? <p className="text-xs text-violet-900">{scenarioMessage}</p> : null}

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">Mock Helper Controls</p>
                  <p className="mt-1 text-sm text-violet-900">
                    Debug-only actions for the in-repo helper prototype. These should not exist in the production helper.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => sendDebugCommand('reset')}
                    disabled={debugPending !== null}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-violet-900 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {debugPending === 'reset' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => sendDebugCommand('card-insert')}
                    disabled={debugPending !== null}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-violet-900 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {debugPending === 'card-insert' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    Insert card
                  </button>
                  <button
                    type="button"
                    onClick={() => sendDebugCommand('error')}
                    disabled={debugPending !== null}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-violet-900 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {debugPending === 'error' ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                    Force error
                  </button>
                </div>
              </div>
              {debugMessage ? <p className="text-xs text-violet-900">{debugMessage}</p> : null}
            </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reader workflow</p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {WORKFLOW_STEPS.map((step, index) => {
              const isComplete = completedStepIndex >= index;
              const isActive = status.stage === step.id;
              return (
                <div
                  key={step.id}
                  className={`rounded-xl border px-4 py-3 ${
                    isActive
                      ? 'border-blue-200 bg-blue-50'
                      : isComplete
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Step {index + 1}</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{step.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {status.stage === 'helper_unavailable' ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="text-[10px] font-black uppercase tracking-widest">Fallback path</p>
            <p className="mt-2">
              Keep the upload workflow on this page as the immediate fallback while the Windows helper is offline or not installed.
            </p>
            {lastError ? <p className="mt-2 text-xs text-amber-800">Last connection error: {lastError}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReaderGraphicConsole({
  status,
  diagnostics,
}: {
  status: ReaderHelperStatus;
  diagnostics: ReaderHelperDiagnostics | null;
}) {
  const sourceTypes = diagnostics?.capabilities?.sourceTypes ?? ['driver_card'];
  const vuAvailable = sourceTypes.includes('vehicle_unit');
  const modeLabel = status.sourceType === 'vehicle_unit' ? 'Vehicle Unit Download' : 'Driver Card Read';
  const healthLabel =
    status.stage === 'complete'
      ? 'Analysis Ready'
      : status.stage === 'error'
      ? 'Action Required'
      : status.stage === 'helper_unavailable'
      ? 'Helper Offline'
      : status.cardPresent
      ? 'Card In Reader'
      : status.readerConnected
      ? 'Reader Ready'
      : 'Awaiting Reader';
  const stageTone =
    status.stage === 'complete'
      ? 'bg-emerald-400 text-emerald-950'
      : status.stage === 'error' || status.stage === 'helper_unavailable'
      ? 'bg-amber-300 text-amber-950'
      : 'bg-cyan-300 text-cyan-950';

  const dayRows = [
    { label: 'Today', drive: status.stage === 'complete' ? '4h 12m' : '--', duty: status.stage === 'complete' ? '7h 35m' : '--', rest: '11h+', alert: status.stage === 'error' ? 'Review helper error' : 'No critical alerts' },
    { label: 'Yesterday', drive: '3h 48m', duty: '6h 20m', rest: '12h', alert: 'Within limits' },
    { label: '7 day', drive: '28h 10m', duty: '44h 25m', rest: 'Daily rest ok', alert: 'Awaiting parsed export' },
  ];

  const activitySegments = [
    { label: 'Rest', className: 'bg-slate-700', width: 18 },
    { label: 'Other work', className: 'bg-amber-400', width: 14 },
    { label: 'Drive', className: 'bg-cyan-300', width: 20 },
    { label: 'POA', className: 'bg-sky-500', width: 10 },
    { label: 'Drive', className: 'bg-cyan-300', width: 18 },
    { label: 'Break', className: 'bg-emerald-400', width: 8 },
    { label: 'Rest', className: 'bg-slate-700', width: 12 },
  ];

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-950 text-slate-50 shadow-sm">
      <div className="relative p-5 md:p-6">
        <div className="absolute inset-0 opacity-40 [background:radial-gradient(circle_at_20%_10%,rgba(45,212,191,0.30),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(251,191,36,0.22),transparent_30%),linear-gradient(135deg,#020617,#0f172a_54%,#111827)]" />
        <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-200">HourWise Reader Console</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h4 className="text-2xl font-black tracking-tight text-white">{modeLabel}</h4>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${stageTone}`}>
                  {healthLabel}
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                A production-facing display for card and VU reads. The legal totals below are placeholders until the parsed export feeds this panel.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <ConsoleMetric label="Reader" value={status.readerConnected ? 'Online' : 'Missing'} />
              <ConsoleMetric label="Card" value={status.cardPresent ? 'Inserted' : 'Waiting'} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[1.05fr_1.45fr]">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Identity</p>
                  <p className="mt-1 text-lg font-black text-white">{status.driverName ?? status.driverId ?? 'Driver pending correlation'}</p>
                </div>
                <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-3">
                  <CreditCard className="h-6 w-6 text-cyan-200" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2">
                <ConsoleLine label="Reader device" value={status.readerDeviceName ?? 'Not reported'} />
                <ConsoleLine label="Export file" value={status.exportFileName ?? 'Waiting for read'} />
                <ConsoleLine label="Session" value={status.readSessionId ?? 'Not started'} />
                <ConsoleLine label="VU workflow" value={vuAvailable ? 'Available in helper capabilities' : 'Scaffolded, not enabled'} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activity Timeline Preview</p>
                  <p className="mt-1 text-sm text-slate-300">24-hour strip ready for parsed driver-card or VU activity blocks.</p>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">00:00 to 24:00</p>
              </div>
              <div className="mt-4 flex h-12 overflow-hidden rounded-xl border border-white/10 bg-slate-950">
                {activitySegments.map((segment, index) => (
                  <div
                    key={`${segment.label}-${index}`}
                    className={`${segment.className} flex items-center justify-center text-[9px] font-black uppercase tracking-widest text-slate-950`}
                    style={{ flexBasis: `${segment.width}%` }}
                    title={segment.label}
                  >
                    <span className={segment.className.includes('slate') ? 'text-slate-200' : ''}>{segment.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span>00</span>
                <span className="text-center">06</span>
                <span className="text-center">12</span>
                <span className="text-right">24</span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {dayRows.map((row) => (
              <div key={row.label} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-cyan-200">{row.label}</p>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-300">
                    {row.alert}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <ConsoleMetric label="Drive" value={row.drive} />
                  <ConsoleMetric label="Duty" value={row.duty} />
                  <ConsoleMetric label="Rest" value={row.rest} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span>Reader workflow</span>
              <span>{status.progressPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 transition-all"
                style={{ width: `${status.progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelperDiagnosticsPanel({
  diagnostics,
  pending,
  message,
  onRefresh,
}: {
  diagnostics: ReaderHelperDiagnostics | null;
  pending: boolean;
  message: string | null;
  onRefresh: () => void;
}) {
  const recentEvents = (diagnostics?.recentEvents ?? []).slice(-5).reverse();

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Helper diagnostics</p>
          <p className="mt-1 text-sm text-slate-600">
            Local support data from the Windows helper. This should help diagnose reader/export issues without exposing browser credentials.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh diagnostics
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetaCard label="Process id" value={diagnostics?.processId ? String(diagnostics.processId) : 'Unavailable'} />
        <MetaCard label="Export command" value={diagnostics?.config?.exportCommandConfigured ? 'Configured' : 'Not configured'} />
        <MetaCard label="VU workflow" value={diagnostics?.config?.vuWorkflowEnabled ? 'Enabled' : 'Disabled'} />
        <MetaCard label="Sources" value={diagnostics?.capabilities?.sourceTypes?.join(', ') ?? 'driver_card'} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <MetaCard label="Export directory" value={diagnostics?.config?.exportOutputDirectory ?? 'Unavailable'} />
        <MetaCard label="Log directory" value={diagnostics?.config?.logDirectory ?? 'Unavailable'} />
      </div>

      {recentEvents.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recent events</p>
          {recentEvents.map((event, index) => (
            <div key={`${getDiagnosticEventName(event)}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-slate-700">{getDiagnosticEventName(event)}</p>
                <p className="text-[10px] font-bold text-slate-400">{formatDiagnosticTimestamp(event)}</p>
              </div>
              <p className="mt-2 break-all text-xs text-slate-500">{formatDiagnosticData(event)}</p>
            </div>
          ))}
        </div>
      ) : null}

      {message ? <p className="mt-3 text-xs text-slate-600">{message}</p> : null}
    </div>
  );
}

function ConsoleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function ConsoleLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-slate-950/40 px-3 py-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="max-w-[62%] break-all text-right text-xs font-bold text-slate-200">{value}</p>
    </div>
  );
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-900 break-all">{value}</p>
    </div>
  );
}

function formatBytes(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Not reported';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getDiagnosticEventName(event: ReaderHelperDiagnosticEvent) {
  return event.event ?? event.Event ?? 'event';
}

function formatDiagnosticTimestamp(event: ReaderHelperDiagnosticEvent) {
  const timestamp = event.timestamp ?? event.Timestamp;
  return timestamp ? new Date(timestamp).toLocaleString('en-GB') : 'No timestamp';
}

function formatDiagnosticData(event: ReaderHelperDiagnosticEvent) {
  const data = event.data ?? event.Data;
  if (data === null || typeof data === 'undefined') return 'No event details';
  if (typeof data === 'string') return data;

  try {
    return JSON.stringify(data);
  } catch {
    return 'Event details could not be displayed';
  }
}

function StatusIcon({ stage }: { stage: ReaderHelperStage }) {
  if (stage === 'complete') {
    return <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />;
  }
  if (stage === 'error' || stage === 'helper_unavailable') {
    return <AlertTriangle className="w-8 h-8 text-amber-600 shrink-0" />;
  }
  if (stage === 'card_inserted') {
    return <CreditCard className="w-8 h-8 text-blue-600 shrink-0" />;
  }
  if (stage === 'uploading') {
    return <Upload className="w-8 h-8 text-blue-600 shrink-0" />;
  }
  if (stage === 'ready') {
    return <Laptop className="w-8 h-8 text-blue-600 shrink-0" />;
  }
  return <Loader2 className="w-8 h-8 text-blue-600 shrink-0 animate-spin" />;
}
