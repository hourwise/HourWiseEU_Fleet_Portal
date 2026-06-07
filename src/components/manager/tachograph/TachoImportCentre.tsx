import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, CreditCard, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { useTachoImports } from '../../../hooks/useTachoImports';
import {
  canRetryTachoImportProcessing,
  getTachoImportObservabilityIssue,
  summarizeTachoImportObservability,
} from '../../../lib/tacho/importObservability';
import { retryTachoImportProcessing } from '../../../lib/tacho/helperImport';
import type { TachoImportRecord, TachoReconciliationItem, VehicleMotionDiscrepancy } from '../../../lib/tacho/rules/types';
import { TachoReaderHelperPanel } from './TachoReaderHelperPanel';
import { TachoUploadZone } from './TachoUploadZone';

export function TachoImportCentre({
  onOpenDriverAnalysis,
}: {
  onOpenDriverAnalysis?: (driverId: string, date?: string) => void;
}) {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useTachoImports();
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [retryPending, setRetryPending] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const selectedImport = useMemo(
    () => data.find((item) => item.id === selectedImportId) ?? data[0] ?? null,
    [data, selectedImportId]
  );
  const selectedIssue = useMemo(
    () => (selectedImport ? getTachoImportObservabilityIssue(selectedImport) : null),
    [selectedImport]
  );
  const monitoringSummary = useMemo(() => summarizeTachoImportObservability(data), [data]);

  const handleRetryProcessing = async () => {
    if (!profile?.company_id || !selectedImport || !canRetryTachoImportProcessing(selectedImport)) return;

    setRetryPending(true);
    setRetryMessage(null);

    try {
      const result = await retryTachoImportProcessing(profile.company_id, selectedImport.id);
      setRetryMessage(
        result.started
          ? `Processing retry requested for import ${selectedImport.id}.`
          : `Retry request was sent for import ${selectedImport.id}, but the backend did not confirm kickoff: ${result.error ?? 'Unknown error'}.`
      );
      reload();
    } catch (retryError) {
      setRetryMessage(retryError instanceof Error ? retryError.message : 'Failed to retry processing.');
    } finally {
      setRetryPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tacho Import Centre</p>
            <h2 className="text-3xl font-black text-slate-900 mt-1">Import Driver Cards And VU Files</h2>
            <p className="text-sm text-slate-500 mt-2">
              The import queue now surfaces unassigned motion, driver-link discrepancies, and app-vs-tacho cross-check issues directly in the import workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.25fr,1fr] gap-6">
            <TachoReaderHelperPanel onOpenDriverAnalysis={onOpenDriverAnalysis} onImportRegistered={reload} />
            <TachoUploadZone onUploaded={reload} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="Processing Now" value={loading ? '...' : String(monitoringSummary.processingNow)} tone="warning" />
        <StatCard label="Completed Today" value={loading ? '...' : String(monitoringSummary.completedToday)} tone="good" />
        <StatCard label="Failed Imports" value={loading ? '...' : String(monitoringSummary.failedImports)} tone="danger" />
        <StatCard label="Open Motion Issues" value={loading ? '...' : String(data.reduce((total, item) => total + (item.discrepancyCount ?? 0), 0))} tone="danger" />
        <StatCard label="Cross-check Issues" value={loading ? '...' : String(data.reduce((total, item) => total + (item.reconciliationIssueCount ?? 0), 0))} tone="warning" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Retry Backlog" value={loading ? '...' : String(monitoringSummary.retryBacklog)} tone={monitoringSummary.retryBacklog > 0 ? 'warning' : 'good'} />
        <StatCard label="Kickoff Warnings" value={loading ? '...' : String(monitoringSummary.kickoffWarnings)} tone={monitoringSummary.kickoffWarnings > 0 ? 'warning' : 'good'} />
        <StatCard label="Dispatch Warnings" value={loading ? '...' : String(monitoringSummary.dispatchWarnings)} tone={monitoringSummary.dispatchWarnings > 0 ? 'warning' : 'good'} />
        <StatCard label="Attention Queue" value={loading ? '...' : String(monitoringSummary.attentionQueue)} tone={monitoringSummary.attentionQueue > 0 ? 'danger' : 'good'} />
      </div>

      {!loading && monitoringSummary.attentionQueue > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Import Monitoring</p>
          <p className="mt-2">
            {monitoringSummary.attentionQueue} import{monitoringSummary.attentionQueue === 1 ? '' : 's'} need supervisor attention across
            {' '}
            {monitoringSummary.retryBacklog} retryable issue{monitoringSummary.retryBacklog === 1 ? '' : 's'},
            {' '}
            {monitoringSummary.partialImports} partial parse{monitoringSummary.partialImports === 1 ? '' : 's'},
            {' '}
            and {monitoringSummary.processingErrors} processor error{monitoringSummary.processingErrors === 1 ? '' : 's'}.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr,1fr] gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Recent Imports</h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading import queue...</div>
          ) : error ? (
            <div className="p-8 text-center text-rose-600">{error}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedImportId(item.id)}
                  className={`w-full p-6 text-left transition ${
                    selectedImport?.id === item.id ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <ImportRow item={item} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Import Review</p>
              <h3 className="text-lg font-black text-slate-900 mt-1">{selectedImport?.fileName ?? 'Select an import'}</h3>
            </div>
            {selectedImport ? (
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusStyles(selectedImport.status)}`}>
                {selectedImport.status}
              </span>
            ) : null}
          </div>

          {!selectedImport ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-500">
              Select an import to inspect motion discrepancies and driver-link issues.
            </div>
          ) : (
            <div className="space-y-4">
              <ImportObservabilityNotice item={selectedImport} />

              {selectedIssue?.retryable ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recovery Action</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Request backend processing again for this import when kickoff or dispatch did not complete cleanly.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRetryProcessing}
                      disabled={retryPending}
                      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {retryPending ? 'Retrying...' : 'Retry Processing'}
                    </button>
                  </div>
                  {retryMessage ? <p className="mt-3 text-xs text-slate-600">{retryMessage}</p> : null}
                </div>
              ) : null}

              {(selectedImport.status === 'failed' || selectedImport.status === 'partial') && (
                <div className={`rounded-xl border p-4 text-sm ${selectedImport.status === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  <p className="font-black uppercase tracking-widest text-[10px] mb-2">
                    {selectedImport.status === 'failed' ? 'Parser Failure' : 'Partial Parse'}
                  </p>
                  <p>{selectedImport.summary ?? 'This import did not complete cleanly. Supervisor review and a re-upload may be required.'}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <ReviewStat label="Tech Events" value={String(selectedImport.technicalEventCount ?? 0)} tone="neutral" />
                <ReviewStat label="Discrepancies" value={String(selectedImport.discrepancyCount ?? 0)} tone={(selectedImport.discrepancyCount ?? 0) > 0 ? 'danger' : 'good'} />
                <ReviewStat label="Cross-check" value={String(selectedImport.reconciliationIssueCount ?? 0)} tone={(selectedImport.reconciliationIssueCount ?? 0) > 0 ? 'warning' : 'good'} />
                <ReviewStat label="High Severity" value={String(selectedImport.highSeverityCount ?? 0)} tone={(selectedImport.highSeverityCount ?? 0) > 0 ? 'danger' : 'good'} />
                <ReviewStat label="Source" value={selectedImport.sourceType === 'vehicle_unit' ? 'VU' : 'Card'} tone="neutral" />
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
                  {selectedImport.sourceType === 'driver_card' ? 'Cross-check Preview' : 'Discrepancy Preview'}
                </h4>
                {selectedImport.sourceType === 'driver_card' ? (
                  selectedImport.reconciliationPreview && selectedImport.reconciliationPreview.length > 0 ? (
                    <div className="space-y-3">
                      {selectedImport.reconciliationPreview.map((item) => (
                        <ReconciliationPreviewCard key={item.id} item={item} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
                      No cross-check issue rows were returned for this import.
                    </div>
                  )
                ) : selectedImport.discrepancyPreview && selectedImport.discrepancyPreview.length > 0 ? (
                  <div className="space-y-3">
                    {selectedImport.discrepancyPreview.map((item) => (
                      <DiscrepancyPreviewCard key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-700">
                    No discrepancy rows were returned for this import.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <InfoCard
          icon={<Clock3 className="w-5 h-5 text-blue-600" />}
          title="Processing states"
          text="Failed and partial parser states are now meant to be reviewed explicitly, not treated like silent edge cases."
        />
        <InfoCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          title="Driver card flow"
          text="The same import lifecycle now supports both the desktop helper polling path and the manual upload fallback."
        />
        <InfoCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          title="Import review"
          text="Supervisors can now see unassigned motion, driver-link issues, and app-vs-tacho cross-check issues at the import level before navigating into deeper driver or vehicle analysis."
        />
      </div>
    </div>
  );
}

function ImportRow({ item }: { item: TachoImportRecord }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-xl ${item.sourceType === 'driver_card' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
          {item.sourceType === 'driver_card' ? <CreditCard className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm font-black text-slate-900">{item.fileName}</p>
            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${statusStyles(item.status)}`}>
              {item.status}
            </span>
            {(item.discrepancyCount ?? 0) > 0 && (
              <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-700">
                {item.discrepancyCount} discrepancy{item.discrepancyCount === 1 ? '' : 'ies'}
              </span>
            )}
            {(item.reconciliationIssueCount ?? 0) > 0 && (
              <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
                {item.reconciliationIssueCount} cross-check
              </span>
            )}
            {item.processingKickoffError && (
              <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
                Kickoff issue
              </span>
            )}
            {item.triggerDispatchError && (
              <span className="px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700">
                Dispatch issue
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {item.sourceType === 'driver_card' ? item.driverName : item.vehicleReg} • {format(new Date(item.importedAt), 'dd MMM yyyy HH:mm')}
          </p>
          <p className="text-sm text-slate-600 mt-2">{item.summary}</p>
          {(item.processingKickoffError || item.triggerDispatchError) && (
            <p className="mt-2 text-xs text-amber-700">
              {item.processingKickoffError ?? item.triggerDispatchError}
            </p>
          )}
          {(item.technicalEventCount ?? 0) > 0 || (item.highSeverityCount ?? 0) > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {(item.technicalEventCount ?? 0) > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                  Tech Events: {item.technicalEventCount}
                </span>
              )}
              {(item.highSeverityCount ?? 0) > 0 && (
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-700">
                  High Severity: {item.highSeverityCount}
                </span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="w-full lg:w-64">
        <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
          <span>Processing</span>
          <span>{item.progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${
              item.status === 'failed' ? 'bg-rose-500' : item.status === 'complete' ? 'bg-emerald-500' : 'bg-blue-600'
            }`}
            style={{ width: `${item.progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function statusStyles(status: string) {
  if (status === 'failed') return 'bg-rose-100 text-rose-700';
  if (status === 'complete') return 'bg-emerald-100 text-emerald-700';
  if (status === 'processing') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-600';
}

function ImportObservabilityNotice({ item }: { item: TachoImportRecord }) {
  const issue = getTachoImportObservabilityIssue(item);
  if (!issue) return null;

  if (issue.kind === 'processing_kickoff') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="text-[10px] font-black uppercase tracking-widest mb-2">{issue.title}</p>
        <p>{issue.message}</p>
        {issue.timestamp ? (
          <p className="mt-2 text-xs text-amber-800">
            Requested at {format(new Date(issue.timestamp), 'dd MMM yyyy HH:mm')}
          </p>
        ) : null}
      </div>
    );
  }

  if (issue.kind === 'trigger_dispatch') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="text-[10px] font-black uppercase tracking-widest mb-2">{issue.title}</p>
        <p>{issue.message}</p>
        {issue.timestamp ? (
          <p className="mt-2 text-xs text-amber-800">
            Requested at {format(new Date(issue.timestamp), 'dd MMM yyyy HH:mm')}
          </p>
        ) : null}
      </div>
    );
  }

  if (issue.kind === 'processing_error') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <p className="text-[10px] font-black uppercase tracking-widest mb-2">{issue.title}</p>
        <p>{issue.message}</p>
      </div>
    );
  }

  return null;
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: 'warning' | 'good' | 'danger' }) {
  const styles = {
    warning: 'bg-amber-50 border-amber-100 text-amber-700',
    good: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    danger: 'bg-rose-50 border-rose-100 text-rose-700',
  }[tone];

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-3xl font-black mt-2">{value}</p>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}

function ReviewStat({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'good' | 'warning' | 'danger' }) {
  const styles = {
    neutral: 'bg-slate-50 border-slate-200 text-slate-700',
    good: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    warning: 'bg-amber-50 border-amber-100 text-amber-700',
    danger: 'bg-rose-50 border-rose-100 text-rose-700',
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function ReconciliationPreviewCard({ item }: { item: TachoReconciliationItem }) {
  const statusTone =
    item.status === 'tacho_only'
      ? 'border-rose-200 bg-rose-50/70'
      : item.status === 'app_only'
      ? 'border-amber-200 bg-amber-50/70'
      : 'border-slate-200 bg-white';

  return (
    <div className={`rounded-xl border p-4 ${statusTone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{item.summary}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
            {format(new Date(`${item.date}T12:00:00Z`), 'dd MMM yyyy')}
          </p>
          <div className="mt-3 space-y-1 text-[11px] text-slate-600">
            <p><span className="font-black text-slate-500 uppercase tracking-widest">App:</span> {item.appLabel}</p>
            <p><span className="font-black text-slate-500 uppercase tracking-widest">Tacho:</span> {item.tachoLabel}</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${reconciliationTone(item.status)}`}>
          {formatReconciliationStatus(item.status)}
        </span>
      </div>
    </div>
  );
}

function DiscrepancyPreviewCard({ item }: { item: VehicleMotionDiscrepancy }) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        item.severity === 'high' || item.severity === 'critical'
          ? 'border-rose-200 bg-rose-50/70'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{item.summary}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">
            {format(new Date(item.startTime), 'dd MMM yyyy HH:mm')} - {format(new Date(item.endTime), 'HH:mm')} ({item.durationMins} mins)
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${discrepancyTone(item)}`}>
          {formatDiscrepancyStatus(item.status)}
        </span>
      </div>
    </div>
  );
}

function formatReconciliationStatus(status: TachoReconciliationItem['status']) {
  return status.split('_').join(' ');
}

function formatDiscrepancyStatus(status: VehicleMotionDiscrepancy['status']) {
  return status.split('_').join(' ');
}

function reconciliationTone(status: TachoReconciliationItem['status']) {
  if (status === 'tacho_only') return 'bg-rose-100 text-rose-700';
  if (status === 'app_only') return 'bg-amber-100 text-amber-700';
  if (status === 'mismatch_duration') return 'bg-slate-100 text-slate-700';
  return 'bg-blue-100 text-blue-700';
}

function discrepancyTone(item: VehicleMotionDiscrepancy) {
  if (item.status === 'unassigned_motion') return 'bg-rose-100 text-rose-700';
  if (item.status === 'card_gap') return 'bg-amber-100 text-amber-700';
  if (item.status === 'driver_mismatch') return 'bg-slate-100 text-slate-700';
  return 'bg-blue-100 text-blue-700';
}
