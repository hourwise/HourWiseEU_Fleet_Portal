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
  driverId?: string;
  focusedDate?: string;
  lastHeartbeatAt?: string;
  readerConnected?: boolean;
  cardPresent?: boolean;
  canStartRead: boolean;
  canCancel: boolean;
  errorCode?: string;
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
  driverId?: string;
  focusedDate?: string;
  reviewDate?: string;
  lastHeartbeatAt?: string;
  readerConnected?: boolean;
  readerDetected?: boolean;
  cardPresent?: boolean;
  cardInserted?: boolean;
  canStartRead?: boolean;
  canCancel?: boolean;
  errorCode?: string;
}

const DEFAULT_HELPER_URL = import.meta.env.VITE_TACHO_HELPER_URL || 'http://127.0.0.1:47231';

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
    driverId: response.driverId,
    focusedDate: response.focusedDate ?? response.reviewDate,
    lastHeartbeatAt: response.lastHeartbeatAt,
    readerConnected: response.readerConnected ?? response.readerDetected,
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
  };
}

export function TachoReaderHelperPanel({
  onOpenDriverAnalysis,
}: {
  onOpenDriverAnalysis?: (driverId: string, date?: string) => void;
}) {
  const helperUrl = DEFAULT_HELPER_URL.replace(/\/$/, '');
  const [status, setStatus] = useState<ReaderHelperStatus>(() => defaultStatus(helperUrl));
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [commandPending, setCommandPending] = useState<'start-read' | 'cancel' | null>(null);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);
  const [debugPending, setDebugPending] = useState<'reset' | 'card-insert' | 'error' | null>(null);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const openedReviewKeyRef = useRef<string | null>(null);

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
      setStatus(nextStatus);
      setLastError(null);
    } catch (error) {
      setStatus(defaultStatus(helperUrl));
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
        const response = await fetch(`${helperUrl}/commands/${command}`, {
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

        setCommandMessage(command === 'start-read' ? 'Read command sent to helper.' : 'Cancel command sent to helper.');
        await refreshStatus();
      } catch (error) {
        setCommandMessage(error instanceof Error ? error.message : 'Failed to send helper command');
      } finally {
        setCommandPending(null);
      }
    },
    [helperUrl, refreshStatus]
  );

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
    if (status.stage !== 'complete' || !status.driverId || !onOpenDriverAnalysis) return;
    const reviewKey = `${status.importId ?? 'no-import'}:${status.driverId}:${status.focusedDate ?? 'no-date'}`;
    if (openedReviewKeyRef.current === reviewKey) return;
    openedReviewKeyRef.current = reviewKey;
    onOpenDriverAnalysis(status.driverId, status.focusedDate);
  }, [onOpenDriverAnalysis, status]);

  const completedStepIndex = useMemo(() => {
    const index = WORKFLOW_STEPS.findIndex((step) => step.id === status.stage);
    return index === -1 ? -1 : index;
  }, [status.stage]);

  const isMockHelper = useMemo(() => status.helperVersion?.startsWith('mock-') ?? false, [status.helperVersion]);

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetaCard label="Helper endpoint" value={status.helperUrl} />
          <MetaCard label="Helper version" value={status.helperVersion ?? 'Not reported'} />
          <MetaCard
            label="Last heartbeat"
            value={status.lastHeartbeatAt ? new Date(status.lastHeartbeatAt).toLocaleString('en-GB') : 'No heartbeat yet'}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <MetaCard label="Reader detected" value={status.readerConnected ? 'Connected' : 'Not detected'} />
          <MetaCard label="Card present" value={status.cardPresent ? 'Inserted' : 'Not inserted'} />
          <MetaCard label="Import id" value={status.importId ?? 'Waiting for read'} />
          <MetaCard label="Helper error code" value={status.errorCode ?? 'None'} />
        </div>

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
                disabled={!status.canStartRead || commandPending !== null}
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
            {debugMessage ? <p className="mt-3 text-xs text-violet-900">{debugMessage}</p> : null}
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

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-900 break-all">{value}</p>
    </div>
  );
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
