import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Gauge, ShieldAlert, Truck, Wrench, ShieldCheck, FileWarning } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { useVehicleUnitAnalysis } from '../../../hooks/useVehicleUnitAnalysis';
import { useDrivers } from '../../../hooks/useDrivers';
import { useVehicles } from '../../../hooks/useVehicles';
import { TachoActivityTimeline } from './TachoActivityTimeline';
import { TachoDayDetailDrawer } from './TachoDayDetailDrawer';
import { TachoFilters } from './TachoFilters';
import { TachoReaderStatusOverlay } from './TachoReaderStatusOverlay';
import { VehicleHistoryLedger } from './VehicleHistoryLedger';
import { TachoWorkspacePicker } from './TachoWorkspacePicker';
import { TachoFindingReviewPanel } from './TachoFindingReviewPanel';
import { TimelineComparisonStatus } from './TimelineComparisonStatus';
import { fetchTachoFindingReviews, saveTachoFindingReview } from '../../../lib/tacho/api';
import type {
  TachoAnalysisRange,
  TachoCorrectiveActionType,
  TachoDaySummary,
  TachoFinding,
  TachoFindingReview,
  TachoFindingReviewStatus,
  VehicleMotionDiscrepancy,
} from '../../../lib/tacho/rules/types';

interface VehicleUnitAnalysisProps {
  vehicleId?: string;
  focusedDate?: string;
  onOpenImportCentre?: () => void;
  onOpenFleetRecord?: (vehicleId: string) => void;
  onOpenMaintenance?: (vehicleId: string) => void;
  onOpenIncidents?: (vehicleId: string) => void;
}

const EMPTY_VU_EVENTS: TachoFinding[] = [];
const EMPTY_DISCREPANCIES: VehicleMotionDiscrepancy[] = [];

export function VehicleUnitAnalysis({ vehicleId, focusedDate, onOpenImportCentre, onOpenFleetRecord, onOpenMaintenance, onOpenIncidents }: VehicleUnitAnalysisProps) {
  const { profile } = useAuth();
  const [range, setRange] = useState<TachoAnalysisRange>('7d');
  const [selectedDay, setSelectedDay] = useState<TachoDaySummary | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicleId ?? '');
  const [findingReviews, setFindingReviews] = useState<Record<string, TachoFindingReview>>({});
  const [reviewPendingId, setReviewPendingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const { data: vehicles = [] } = useVehicles(profile?.company_id ?? undefined);
  const { data: drivers = [] } = useDrivers(profile?.company_id ?? undefined);
  const { data, loading, error, emptyState, isMock } = useVehicleUnitAnalysis(range, { vehicleId: selectedVehicleId || undefined });

  useEffect(() => { setSelectedVehicleId(vehicleId ?? ''); }, [vehicleId]);

  useEffect(() => {
    if (!data?.dailySummaries?.length) {
      setSelectedDay(null);
      return;
    }
    if (focusedDate) {
      const match = data.dailySummaries.find((day) => day.date === focusedDate);
      if (match) {
        setSelectedDay(match);
        return;
      }
    }
    setSelectedDay((current) => current ? data.dailySummaries.find((day) => day.date === current.date) ?? data.dailySummaries[0] ?? null : data.dailySummaries[0] ?? null);
  }, [data, focusedDate]);

  const activeVehicleId = selectedVehicleId || data?.identity.vehicleId;
  const filteredVehicles = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return vehicles
      .filter((entry) => !query || entry.reg_number.toLowerCase().includes(query) || entry.make.toLowerCase().includes(query) || (entry.model ?? '').toLowerCase().includes(query))
      .map((entry) => ({ id: entry.id, label: entry.reg_number, meta: `${entry.make} ${entry.model ?? ''}`.trim() }));
  }, [searchValue, vehicles]);

  const discrepancies = data?.unassignedMotion ?? EMPTY_DISCREPANCIES;
  const technicalEvents = data?.technicalEvents ?? EMPTY_VU_EVENTS;
  const reviewableFindings = useMemo(() => {
    const byId = new Map<string, TachoFinding>();
    [...(data?.findings ?? []), ...technicalEvents].forEach((finding) => byId.set(finding.id, finding));
    return [...byId.values()];
  }, [data?.findings, technicalEvents]);
  const findingIds = useMemo(() => reviewableFindings.map((finding) => finding.id), [reviewableFindings]);
  const multiManningFindings = data?.findings.filter((finding) => finding.ruleCode === 'DRV_MULTI_MANNING_DETECTED') ?? [];
  const selectedDayFindings = selectedDay
    ? reviewableFindings.filter((finding) => finding.periodStart.slice(0, 10) <= selectedDay.date && finding.periodEnd.slice(0, 10) >= selectedDay.date)
    : [];
  const reviewPanelFindings = selectedDayFindings.length > 0 ? selectedDayFindings : reviewableFindings.slice(0, 8);
  const reviewStats = useMemo(() => {
    const reviews = Object.values(findingReviews);
    return {
      total: reviewableFindings.length,
      open: reviewableFindings.filter((finding) => !findingReviews[finding.id] || findingReviews[finding.id].status === 'open').length,
      actionRequired: reviews.filter((review) => review.status === 'action_required').length,
      closed: reviews.filter((review) => review.status === 'closed').length,
    };
  }, [findingReviews, reviewableFindings]);

  useEffect(() => {
    if (!profile?.company_id || findingIds.length === 0) {
      setFindingReviews({});
      return;
    }

    let cancelled = false;
    fetchTachoFindingReviews(profile.company_id, findingIds)
      .then((reviews) => {
        if (cancelled) return;
        setFindingReviews(Object.fromEntries(reviews.map((review) => [review.findingId, review])));
      })
      .catch((error) => {
        if (cancelled) return;
        setReviewError(error instanceof Error ? error.message : 'Unable to load VU finding reviews.');
      });

    return () => {
      cancelled = true;
    };
  }, [findingIds, profile?.company_id]);

  const handleSaveFindingReview = async (
    finding: TachoFinding,
    values: {
      status: TachoFindingReviewStatus;
      managerNote: string;
      correctiveActionType: TachoCorrectiveActionType | '';
    }
  ) => {
    if (!profile?.company_id) return;
    setReviewPendingId(finding.id);
    setReviewError(null);
    try {
      const status = values.correctiveActionType && values.status === 'open' ? 'action_required' : values.status;
      const review = await saveTachoFindingReview({
        companyId: profile.company_id,
        findingId: finding.id,
        status,
        managerNote: values.managerNote,
        correctiveActionType: values.correctiveActionType || null,
      });
      setFindingReviews((current) => ({ ...current, [review.findingId]: review }));
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'Unable to save VU finding review.');
    } finally {
      setReviewPendingId(null);
    }
  };

  const driverNameById = useMemo(
    () =>
      Object.fromEntries(
        drivers
          .filter((entry) => entry.role === 'driver')
          .map((entry) => [entry.id, entry.full_name || entry.email])
      ),
    [drivers]
  );
  const dayReason = useMemo(() => {
    if (!selectedDay || !focusedDate) return null;
    if (selectedDay.date !== focusedDate) return `Opened from a review queue focused on ${format(new Date(`${focusedDate}T12:00:00`), 'dd MMM yyyy')}. That day was not present in the current range, so the workspace fell back to the nearest loaded day.`;
    return `Opened from a review queue or alert focused on ${format(new Date(`${focusedDate}T12:00:00`), 'dd MMM yyyy')}.`;
  }, [focusedDate, selectedDay]);

  const timelineDays = useMemo(() => (data?.dailySummaries ?? []).map((day) => ({
    date: new Date(day.date),
    activities: day.activities,
    markers: technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= day.date && event.periodEnd.slice(0, 10) >= day.date).length + discrepancies.filter((item) => item.date === day.date).length,
    markerGroups: [
      { label: 'Technical', count: technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= day.date && event.periodEnd.slice(0, 10) >= day.date).length, tone: 'warning' as const },
      { label: 'Discrepancies', count: discrepancies.filter((item) => item.date === day.date).length, tone: 'danger' as const },
    ],
  })), [data, discrepancies, technicalEvents]);

  const picker = <TachoWorkspacePicker title="Vehicle Workspace Target" searchLabel="Search vehicles" selectLabel="Open vehicle" searchValue={searchValue} onSearchChange={setSearchValue} selectedValue={selectedVehicleId} onSelectChange={setSelectedVehicleId} options={filteredVehicles} fallbackLabel="Latest imported vehicle unit" />;
  const readerOverlay = <TachoReaderStatusOverlay sourceType="vehicle_unit" onOpenImportCentre={onOpenImportCentre} />;

  if (loading) return <div className="space-y-6">{picker}{readerOverlay}<StateCard title="Loading vehicle unit analysis..." /></div>;
  if (error) return <div className="space-y-6">{picker}{readerOverlay}<StateCard title={error} tone="error" /></div>;
  if (!data) return <div className="space-y-6">{picker}{readerOverlay}<StateCard title={emptyState?.title ?? 'No vehicle-unit analysis available'} text={emptyState?.guidance ?? 'Pick a vehicle with imported VU data or upload a VU file.'} tone="warning" /></div>;

  const statusTone = data.identity.downloadStatus === 'overdue' ? 'bg-rose-100 text-rose-700' : data.identity.downloadStatus === 'due_soon' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

  return (
    <div className="space-y-6">
      {picker}
      {readerOverlay}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-xl"><Truck className="w-7 h-7 text-blue-600" /></div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle Unit Analysis</p>
                {isMock ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">Mock Fallback</span> : null}
              </div>
              <h2 className="text-3xl font-black text-slate-900">{data.identity.regNumber}</h2>
              <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                <span>VU: {data.identity.vuSerial}</span>
                <span>{data.identity.makeModel}</span>
                <span>Calibration Due: {format(new Date(data.identity.calibrationDue), 'dd MMM yyyy')}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start xl:items-end gap-3">
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest ${statusTone}`}>{data.identity.downloadStatus.replace('_', ' ')}</span>
            <TachoFilters value={range} onChange={setRange} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <ActionButton icon={<Truck className="w-4 h-4" />} label="Open Fleet Record" disabled={!activeVehicleId || !onOpenFleetRecord} onClick={() => activeVehicleId && onOpenFleetRecord?.(activeVehicleId)} />
          <ActionButton icon={<Wrench className="w-4 h-4" />} label="Open Maintenance" disabled={!activeVehicleId || !onOpenMaintenance} onClick={() => activeVehicleId && onOpenMaintenance?.(activeVehicleId)} />
          <ActionButton icon={<FileWarning className="w-4 h-4" />} label="Open Incidents" disabled={!activeVehicleId || !onOpenIncidents} onClick={() => activeVehicleId && onOpenIncidents?.(activeVehicleId)} />
          <ActionButton icon={<FileWarning className="w-4 h-4" />} label="Import VU File" disabled={!onOpenImportCentre} onClick={() => onOpenImportCentre?.()} />
        </div>
      </div>

      {dayReason ? <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-medium text-blue-950">{dayReason}</div> : null}

      <TimelineComparisonStatus comparison={data.timelineComparison} contextLabel="Vehicle timeline comparison" />

      <div className="grid grid-cols-1 xl:grid-cols-[2.25fr,1fr] gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Historical Timeline</p>
              <h3 className="text-lg font-black text-slate-900">Vehicle Unit Activity Strip</h3>
              <p className="text-sm text-slate-500">This is the primary VU review surface: scroll vehicle history first, then drill into dates, driver links, and motion anomalies.</p>
            </div>
            <button onClick={() => setSelectedDay(data.dailySummaries[0] ?? null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-black uppercase tracking-widest transition">Open Latest Day</button>
          </div>
          <TachoActivityTimeline days={timelineDays} selectedDate={selectedDay ? new Date(selectedDay.date) : undefined} onSelectDate={(date) => setSelectedDay(data.dailySummaries.find((day) => day.date === date.toISOString().slice(0, 10)) ?? null)} />
        </div>

        <div className="space-y-6">
          <InfoPanel title="Selected Day Overview" icon={<Gauge className="w-5 h-5 text-blue-600" />}>
            {selectedDay ? <StatList items={[`Driving: ${minsToHours(selectedDay.drivingMins)}`, `Technical events: ${technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= selectedDay.date && event.periodEnd.slice(0, 10) >= selectedDay.date).length}`, `Motion review rows: ${discrepancies.filter((item) => item.date === selectedDay.date).length}`, `Multi-manning windows: ${multiManningFindings.filter((finding) => finding.periodStart.slice(0, 10) <= selectedDay.date && finding.periodEnd.slice(0, 10) >= selectedDay.date).length}`]} /> : <p className="text-sm text-slate-500">Select a day in the timeline to inspect review context.</p>}
          </InfoPanel>

          <InfoPanel title="Selected Day Review Context" icon={<Gauge className="w-5 h-5 text-blue-600" />}>
            {selectedDay ? <StatList items={[`Technical events: ${technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= selectedDay.date && event.periodEnd.slice(0, 10) >= selectedDay.date).length}`, `Discrepancies: ${discrepancies.filter((item) => item.date === selectedDay.date).length}`, `Linked drivers: ${new Set(discrepancies.filter((item) => item.date === selectedDay.date).map((item) => item.linkedDriverName).filter(Boolean)).size}`]} /> : <p className="text-sm text-slate-500">Select a day in the timeline to inspect review context.</p>}
          </InfoPanel>

          <InfoPanel title="Sign-off State" icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}>
            <StatList items={[`Reviewable VU findings: ${reviewStats.total}`, `Open: ${reviewStats.open}`, `Action required: ${reviewStats.actionRequired}`, `Closed: ${reviewStats.closed}`]} />
          </InfoPanel>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        {data.metrics.map((metric) => <MetricTile key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />)}
      </div>

      <VehicleHistoryLedger
        range={range}
        days={data.dailySummaries}
        activitySegments={data.activitySegments}
        findings={data.findings}
        technicalEvents={technicalEvents}
        discrepancies={discrepancies}
        driverNameById={driverNameById}
        selectedDate={selectedDay?.date ?? null}
        onSelectDate={(date) => setSelectedDay(data.dailySummaries.find((day) => day.date === date) ?? null)}
      />

      <TachoFindingReviewPanel
        title="VU Finding Review / Sign-off"
        findings={reviewPanelFindings}
        reviewsByFindingId={findingReviews}
        pendingFindingId={reviewPendingId}
        error={reviewError}
        selectedDay={selectedDay?.date ?? null}
        emptyMessage="No VU findings or technical events are available to review for this selection."
        onSave={handleSaveFindingReview}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,1fr] gap-6">
        <InfoPanel title="Vehicle Evidence Summary" icon={<ShieldAlert className="w-5 h-5 text-rose-600" />}>
          <StatList items={[`Technical events in range: ${technicalEvents.length}`, `Unassigned motion rows: ${discrepancies.filter((item) => item.status === 'unassigned_motion').length}`, `Driver-link discrepancies: ${discrepancies.length}`, `Loaded activity segments: ${data.activitySegments.length}`]} />
        </InfoPanel>

        <InfoPanel title="Download / Calibration State" icon={<ShieldCheck className="w-5 h-5 text-amber-600" />}>
          <StatList items={[`Download status: ${data.identity.downloadStatus.replace('_', ' ')}`, `Last download: ${format(new Date(data.identity.lastDownloadAt), 'dd MMM yyyy HH:mm')}`, `Calibration due: ${format(new Date(data.identity.calibrationDue), 'dd MMM yyyy')}`]} />
        </InfoPanel>
      </div>

      <TachoDayDetailDrawer day={selectedDay} findings={data.findings} technicalEvents={technicalEvents} discrepancies={discrepancies} driverNameById={driverNameById} selectedReason={dayReason} onClose={() => setSelectedDay(null)} />
    </div>
  );
}

function minsToHours(mins: number) {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function ActionButton({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) { return <button onClick={onClick} disabled={disabled} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">{icon}{label}</button>; }
function StateCard({ title, text, tone = 'loading' }: { title: string; text?: string; tone?: 'loading' | 'error' | 'warning' }) { const isError = tone === 'error'; return <div className={`rounded-2xl border p-8 text-center ${isError ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'}`}>{isError ? <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" /> : <div className="w-10 h-10 border-b-2 border-blue-600 rounded-full animate-spin mx-auto mb-3" />}<p className={`font-bold ${isError ? 'text-rose-700' : 'text-slate-700'}`}>{title}</p>{text ? <p className="mt-2 text-sm text-slate-500">{text}</p> : null}</div>; }
function MetricTile({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'good' | 'warning' | 'danger' }) { const styles = { neutral: 'border-slate-200 bg-white text-slate-700', good: 'border-emerald-100 bg-emerald-50 text-emerald-700', warning: 'border-amber-100 bg-amber-50 text-amber-700', danger: 'border-rose-100 bg-rose-50 text-rose-700' }[tone]; return <div className={`rounded-2xl border p-5 shadow-sm ${styles}`}><p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p><p className="text-3xl font-black mt-2">{value}</p></div>; }
function InfoPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) { return <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"><div className="flex items-center gap-2 mb-4">{icon}<h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3></div>{children}</div>; }
function StatList({ items }: { items: string[] }) { return <div className="space-y-2">{items.map((item) => <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{item}</div>)}</div>; }
