import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  acknowledgeReaderHelperImport,
  fetchDriverReviewFocusDate,
  fetchReaderHelperImportStatus,
  kickoffTachoImportProcessing,
  registerReaderHelperImport,
  type ReaderHelperImportStatus,
} from '../lib/tacho/helperImport';

export type TachoReaderStage =
  | 'helper_unavailable'
  | 'ready'
  | 'card_inserted'
  | 'reading'
  | 'uploading'
  | 'processing'
  | 'complete'
  | 'error';

export interface TachoReaderStatus {
  stage: TachoReaderStage;
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
}

export interface TachoReaderAnalysisTarget {
  importId: string;
  driverId?: string | null;
  focusedDate?: string | null;
  sourceType?: string | null;
}

interface UseTachoReaderWorkflowOptions {
  sourceType: string;
  targetDriverId?: string | null;
  onImportRegistered?: () => void;
  onAnalysisReady?: (target: TachoReaderAnalysisTarget) => void;
}

const DEFAULT_HELPER_URL = import.meta.env.VITE_TACHO_HELPER_URL || 'http://127.0.0.1:47231';
const AUTO_OPEN_REVIEW_STORAGE_KEY = 'hourwise:tacho-reader:auto-opened-review';

function normalizeStage(value: string | undefined): TachoReaderStage {
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

function defaultStatus(helperUrl: string): TachoReaderStatus {
  return {
    stage: 'helper_unavailable',
    progressPercent: 0,
    headline: 'Desktop helper not connected',
    detail: 'Start the local reader helper, then insert a driver card. Manual import remains available in Import Centre.',
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
    // Non-critical: in-memory guards still prevent duplicate auto-opens during this mount.
  }
}

function buildStatus(helperUrl: string, response: ReaderHelperResponse): TachoReaderStatus {
  const stage = normalizeStage(response.stage ?? response.status);
  const detail =
    response.detail ??
    response.message ??
    (stage === 'ready'
      ? 'Helper is online and waiting for a driver card.'
      : stage === 'card_inserted'
      ? 'Card detected. Driver Card Analysis can start the read automatically.'
      : stage === 'reading'
      ? 'The helper is exporting the inserted driver card locally.'
      : stage === 'uploading'
      ? 'The export file is being uploaded to the portal.'
      : stage === 'processing'
      ? 'Supabase processing is running and the analysis bundle is being prepared.'
      : stage === 'complete'
      ? 'The import completed successfully and the card analysis is ready.'
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
      ? 'Card analysis ready'
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
  };
}

function buildImportedStatus(
  helperStatus: TachoReaderStatus,
  trackedImport: ReaderHelperImportStatus | null,
  focusedDate: string | null
): TachoReaderStatus {
  if (!trackedImport) return helperStatus;

  const stage =
    trackedImport.status === 'error' || trackedImport.status === 'failed'
      ? 'error'
      : trackedImport.status === 'processed' || trackedImport.status === 'partial' || trackedImport.status === 'complete'
      ? 'complete'
      : 'processing';

  const detail =
    trackedImport.status === 'pending'
      ? `Import ${trackedImport.importId} is registered and waiting for processing to start.`
      : trackedImport.status === 'processing'
      ? `Import ${trackedImport.importId} is processing in Supabase.`
      : trackedImport.status === 'partial'
      ? trackedImport.summary ?? `Import ${trackedImport.importId} completed with partial parser output.`
      : trackedImport.status === 'processed' || trackedImport.status === 'complete'
      ? trackedImport.summary ?? `Import ${trackedImport.importId} completed successfully.`
      : trackedImport.summary ?? `Import ${trackedImport.importId} failed during processing.`;

  const headline =
    stage === 'complete'
      ? 'Card analysis ready'
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

export function useTachoReaderWorkflow({
  sourceType,
  targetDriverId,
  onImportRegistered,
  onAnalysisReady,
}: UseTachoReaderWorkflowOptions) {
  const { profile, user } = useAuth();
  const helperUrl = DEFAULT_HELPER_URL.replace(/\/$/, '');
  const [helperStatus, setHelperStatus] = useState<TachoReaderStatus>(() => defaultStatus(helperUrl));
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [commandPending, setCommandPending] = useState<'start-read' | 'cancel' | null>(null);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [importPending, setImportPending] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [registeredImport, setRegisteredImport] = useState<{ readSessionId: string; importId: string } | null>(null);
  const [trackedImport, setTrackedImport] = useState<ReaderHelperImportStatus | null>(null);
  const [trackedFocusedDate, setTrackedFocusedDate] = useState<string | null>(null);
  const openedReviewKeyRef = useRef<string | null>(null);
  const canAutoOpenReviewRef = useRef(false);
  const importSessionRef = useRef<string | null>(null);
  const activeReadDriverIdRef = useRef<string | null | undefined>(undefined);
  const ignoredImportIdsRef = useRef<Set<string>>(new Set());

  const status = useMemo(
    () => buildImportedStatus(helperStatus, trackedImport, trackedFocusedDate),
    [helperStatus, trackedFocusedDate, trackedImport]
  );

  const clearCompletedReaderResult = useCallback(() => {
    const importId = registeredImport?.importId ?? trackedImport?.importId ?? helperStatus.importId;
    if (importId) {
      ignoredImportIdsRef.current.add(importId);
    }
    setRegisteredImport(null);
    setTrackedImport(null);
    setTrackedFocusedDate(null);
    importSessionRef.current = null;
    openedReviewKeyRef.current = null;
  }, [helperStatus.importId, registeredImport?.importId, trackedImport?.importId]);

  const refreshStatus = useCallback(async (options?: { clearCompletedResult?: boolean }) => {
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
        if (
          options?.clearCompletedResult &&
          (!nextStatus.readSessionId || nextStatus.stage === 'ready' || nextStatus.stage === 'helper_unavailable') &&
          (!nextStatus.importId || ignoredImportIdsRef.current.has(nextStatus.importId))
        ) {
          clearCompletedReaderResult();
        }
        setLastError(null);
    } catch (error) {
      setHelperStatus(defaultStatus(helperUrl));
      if (options?.clearCompletedResult) {
        clearCompletedReaderResult();
      }
      setLastError(error instanceof Error ? error.message : 'Unable to reach helper');
    } finally {
      setRefreshing(false);
    }
  }, [clearCompletedReaderResult, helperUrl]);

  const sendCommand = useCallback(
    async (command: 'start-read' | 'cancel') => {
      setCommandPending(command);
      setCommandMessage(null);

      try {
        if (command === 'start-read' && !profile?.company_id) {
          throw new Error('Cannot start a card read without a signed-in company context.');
        }

        const requestedTargetDriverId = command === 'start-read' ? targetDriverId ?? null : null;
        if (command === 'start-read') {
          activeReadDriverIdRef.current = requestedTargetDriverId;
        } else {
          activeReadDriverIdRef.current = undefined;
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
            sourceType,
            targetDriverId: requestedTargetDriverId,
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
    [helperUrl, profile?.company_id, refreshStatus, sourceType, targetDriverId, user?.id]
  );

  useEffect(() => {
    refreshStatus();
    const intervalId = window.setInterval(() => {
      refreshStatus();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (status.stage !== 'complete') {
      canAutoOpenReviewRef.current = true;
    }
  }, [status.stage]);

  useEffect(() => {
    if (status.stage !== 'complete' || !status.importId || !onAnalysisReady) return;
    if (!canAutoOpenReviewRef.current) return;
    const reviewKey = `${status.importId}:${status.driverId ?? 'candidate'}:${status.focusedDate ?? 'no-date'}`;
    if (openedReviewKeyRef.current === reviewKey) return;
    if (getAutoOpenedReviewKey() === reviewKey) return;
    openedReviewKeyRef.current = reviewKey;
    canAutoOpenReviewRef.current = false;
    setAutoOpenedReviewKey(reviewKey);
    onAnalysisReady({
      importId: status.importId,
      driverId: status.driverId ?? null,
      focusedDate: status.focusedDate ?? null,
      sourceType: status.sourceType ?? null,
    });
  }, [onAnalysisReady, status]);

  useEffect(() => {
    if (helperStatus.stage !== 'uploading' || !helperStatus.readSessionId || !helperStatus.exportDownloadPath) return;
    const companyId = profile?.company_id;
    if (!companyId) return;
    const readSessionId = helperStatus.readSessionId;
    const exportDownloadPath = helperStatus.exportDownloadPath;
    const driverId =
      activeReadDriverIdRef.current !== undefined ? activeReadDriverIdRef.current : targetDriverId ?? null;
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
            sourceType: helperStatus.sourceType ?? sourceType,
            exportFileName: helperStatus.exportFileName,
            exportDownloadPath,
            exportFileSizeBytes: helperStatus.exportFileSizeBytes,
            exportSha256: helperStatus.exportSha256,
            exportFormat: helperStatus.exportFormat,
            exportParserReady: helperStatus.exportParserReady,
            exportNote: helperStatus.exportNote,
            driverId,
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
    sourceType,
    targetDriverId,
    user?.id,
  ]);

  useEffect(() => {
    const companyId = profile?.company_id;
    const importId = registeredImport?.importId ?? helperStatus.importId;
    if (!companyId || !importId) return;
    if (ignoredImportIdsRef.current.has(importId)) {
      setTrackedImport(null);
      setTrackedFocusedDate(null);
      return;
    }

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

  return {
    status,
    refreshing,
    lastError,
    commandPending,
    commandMessage,
    importPending,
    importMessage,
    registeredImport,
    trackedImport,
    refreshStatus,
    clearCompletedReaderResult,
    sendCommand,
  };
}
