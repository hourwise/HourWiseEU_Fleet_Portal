import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, Radio, RefreshCw, Truck } from 'lucide-react';

type ReaderOverlayStage =
  | 'helper_unavailable'
  | 'ready'
  | 'card_inserted'
  | 'reading'
  | 'uploading'
  | 'processing'
  | 'complete'
  | 'error';

type ReaderSourceType = 'driver_card' | 'vehicle_unit';

interface ReaderOverlayStatus {
  stage: ReaderOverlayStage;
  progressPercent: number;
  headline: string;
  detail: string;
  helperVersion?: string;
  readerConnected?: boolean;
  readerDeviceName?: string;
  cardPresent?: boolean;
  sourceType?: string;
  importId?: string;
  exportFileName?: string;
  driverName?: string;
  driverCardNumberHint?: string;
  vehicleRegHint?: string;
}

interface ReaderOverlayResponse {
  stage?: string;
  status?: string;
  progressPercent?: number;
  progress?: number;
  headline?: string;
  message?: string;
  detail?: string;
  helperVersion?: string;
  readerConnected?: boolean;
  readerDetected?: boolean;
  readerDeviceName?: string;
  cardPresent?: boolean;
  cardInserted?: boolean;
  sourceType?: string;
  importId?: string;
  exportFileName?: string;
  driverName?: string;
  driverCardNumberHint?: string;
  vehicleRegHint?: string;
}

interface TachoReaderStatusOverlayProps {
  sourceType: ReaderSourceType;
  onOpenImportCentre?: () => void;
}

const DEFAULT_HELPER_URL = import.meta.env.VITE_TACHO_HELPER_URL || 'http://127.0.0.1:47231';
const POLL_INTERVAL_MS = 5000;

const WORKFLOW_STEPS: { id: Exclude<ReaderOverlayStage, 'helper_unavailable' | 'error'>; label: string }[] = [
  { id: 'ready', label: 'Ready' },
  { id: 'card_inserted', label: 'Detected' },
  { id: 'reading', label: 'Reading' },
  { id: 'uploading', label: 'Uploading' },
  { id: 'processing', label: 'Processing' },
  { id: 'complete', label: 'Ready' },
];

function normalizeStage(value: string | undefined): ReaderOverlayStage {
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

function defaultStatus(): ReaderOverlayStatus {
  return {
    stage: 'helper_unavailable',
    progressPercent: 0,
    headline: 'Reader helper offline',
    detail: 'Open Import Centre to use manual upload or start the desktop helper.',
    readerConnected: false,
    cardPresent: false,
  };
}

function buildStatus(response: ReaderOverlayResponse): ReaderOverlayStatus {
  const stage = normalizeStage(response.stage ?? response.status);
  const readerConnected =
    typeof response.readerConnected === 'boolean'
      ? response.readerConnected
      : Boolean(response.readerDetected);
  const cardPresent =
    typeof response.cardPresent === 'boolean'
      ? response.cardPresent
      : Boolean(response.cardInserted);

  const headline =
    response.headline ??
    (stage === 'complete'
      ? 'Analysis ready'
      : stage === 'error'
        ? 'Reader needs attention'
        : stage === 'processing'
          ? 'Processing card read'
          : stage === 'uploading'
            ? 'Uploading tachograph capture'
            : stage === 'reading'
              ? 'Reading tachograph card'
              : cardPresent
                ? 'Card detected'
                : readerConnected
                  ? 'Waiting for card'
                  : 'Reader helper online');

  return {
    stage,
    progressPercent: Math.max(0, Math.min(100, Math.round(response.progressPercent ?? response.progress ?? 0))),
    headline,
    detail: response.detail ?? response.message ?? 'Reader status is being monitored while the analysis workspace remains available.',
    helperVersion: response.helperVersion,
    readerConnected,
    readerDeviceName: response.readerDeviceName,
    cardPresent,
    sourceType: response.sourceType,
    importId: response.importId,
    exportFileName: response.exportFileName,
    driverName: response.driverName,
    driverCardNumberHint: response.driverCardNumberHint,
    vehicleRegHint: response.vehicleRegHint,
  };
}

function getStageTone(stage: ReaderOverlayStage) {
  if (stage === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-950';
  if (stage === 'error') return 'border-rose-200 bg-rose-50 text-rose-950';
  if (stage === 'helper_unavailable') return 'border-amber-200 bg-amber-50 text-amber-950';
  return 'border-cyan-200 bg-cyan-50 text-cyan-950';
}

function getProgress(status: ReaderOverlayStatus) {
  if (status.progressPercent > 0) return status.progressPercent;
  if (status.stage === 'complete') return 100;
  const index = WORKFLOW_STEPS.findIndex((step) => step.id === status.stage);
  return index >= 0 ? Math.round(((index + 1) / WORKFLOW_STEPS.length) * 100) : 0;
}

export function TachoReaderStatusOverlay({ sourceType, onOpenImportCentre }: TachoReaderStatusOverlayProps) {
  const [status, setStatus] = useState<ReaderOverlayStatus>(() => defaultStatus());
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const helperUrl = useMemo(() => DEFAULT_HELPER_URL.replace(/\/$/, ''), []);
  const sourceLabel = sourceType === 'vehicle_unit' ? 'Vehicle Unit Reader' : 'Driver Card Reader';
  const SourceIcon = sourceType === 'vehicle_unit' ? Truck : CreditCard;

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

      setStatus(buildStatus((await response.json()) as ReaderOverlayResponse));
      setLastError(null);
    } catch (error) {
      setStatus(defaultStatus());
      setLastError(error instanceof Error ? error.message : 'Unable to reach helper');
    } finally {
      setRefreshing(false);
    }
  }, [helperUrl]);

  useEffect(() => {
    void refreshStatus();
    const intervalId = window.setInterval(() => {
      void refreshStatus();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [refreshStatus]);

  const progress = getProgress(status);
  const completedIndex = status.stage === 'complete'
    ? WORKFLOW_STEPS.length - 1
    : WORKFLOW_STEPS.findIndex((step) => step.id === status.stage);

  return (
    <section className={`rounded-3xl border shadow-sm ${getStageTone(status.stage)}`}>
      <div className="p-4 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
              {status.stage === 'complete' ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : status.stage === 'error' || status.stage === 'helper_unavailable' ? (
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              ) : refreshing ? (
                <Loader2 className="h-6 w-6 animate-spin text-cyan-700" />
              ) : (
                <SourceIcon className="h-6 w-6 text-cyan-700" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{sourceLabel}</p>
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest">
                  {status.stage.replace(/_/g, ' ')}
                </span>
              </div>
              <h3 className="mt-1 text-lg font-black">{status.headline}</h3>
              <p className="mt-1 max-w-3xl text-sm opacity-80">{lastError ?? status.detail}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshStatus()}
              className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-widest shadow-sm transition hover:bg-white"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-widest shadow-sm transition hover:bg-white"
            >
              <Radio className="h-4 w-4" />
              {expanded ? 'Hide Flow' : 'Show Flow'}
            </button>
            <button
              type="button"
              onClick={onOpenImportCentre}
              disabled={!onOpenImportCentre}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SourceIcon className="h-4 w-4" />
              Read / Import
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-70">
            <span>Reader workflow</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/70">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-amber-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {expanded ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {WORKFLOW_STEPS.map((step, index) => {
              const isComplete = completedIndex >= index;
              const isActive = status.stage === step.id;
              return (
                <div
                  key={step.id}
                  className={`rounded-2xl border px-3 py-3 text-xs font-bold ${
                    isActive
                      ? 'border-slate-900 bg-white text-slate-950 shadow-sm'
                      : isComplete
                        ? 'border-emerald-200 bg-white/70 text-emerald-900'
                        : 'border-white/70 bg-white/40 opacity-70'
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Step {index + 1}</p>
                  <p className="mt-1">{step.label}</p>
                </div>
              );
            })}
          </div>
        ) : null}

        {expanded ? (
          <div className="mt-4 grid grid-cols-1 gap-3 text-xs md:grid-cols-2 xl:grid-cols-4">
            <StatusMeta label="Reader" value={status.readerConnected ? 'Online' : 'Not connected'} />
            <StatusMeta label="Card" value={status.cardPresent ? 'Inserted' : 'Waiting'} />
            <StatusMeta label="Device" value={status.readerDeviceName ?? 'Not reported'} />
            <StatusMeta label="Helper" value={status.helperVersion ?? 'Unknown'} />
            <StatusMeta label="Import" value={status.importId ?? 'Not registered'} />
            <StatusMeta label="Export" value={status.exportFileName ?? 'No export yet'} />
            <StatusMeta label="Identity" value={status.driverName ?? status.driverCardNumberHint ?? status.vehicleRegHint ?? 'Awaiting read'} />
            <StatusMeta label="Mode" value={status.sourceType ?? sourceType} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function StatusMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/60 px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</p>
      <p className="mt-1 truncate font-bold">{value}</p>
    </div>
  );
}
