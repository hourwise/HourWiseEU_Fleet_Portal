import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, BadgeAlert, CreditCard, GraduationCap, ShieldAlert, UserRound } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { useDriverCardAnalysis } from '../../../hooks/useDriverCardAnalysis';
import { useDrivers } from '../../../hooks/useDrivers';
import { supabase } from '../../../lib/supabase';
import { TachoActivityTimeline } from './TachoActivityTimeline';
import { TachoDayDetailDrawer } from './TachoDayDetailDrawer';
import { TachoFilters } from './TachoFilters';
import { TachoReaderStatusOverlay } from './TachoReaderStatusOverlay';
import { TachoWorkspacePicker } from './TachoWorkspacePicker';
import type { TachoAnalysisRange, TachoDaySummary, TachoFinding, TachoReconciliationItem } from '../../../lib/tacho/rules/types';

interface DriverCardAnalysisProps {
  driverId?: string;
  focusedDate?: string;
  onOpenImportCentre?: () => void;
  onOpenPersonnelFile?: (driverId: string) => void;
  onOpenComplianceActions?: (driverId: string) => void;
  onOpenTraining?: (driverId: string) => void;
}

interface TrainingRecommendation {
  id: string;
  moduleId: string;
  title: string;
  reason: string;
}

const EMPTY_FINDINGS: TachoFinding[] = [];
const EMPTY_RECONCILIATION: TachoReconciliationItem[] = [];

export function DriverCardAnalysis({ driverId, focusedDate, onOpenImportCentre, onOpenPersonnelFile, onOpenComplianceActions, onOpenTraining }: DriverCardAnalysisProps) {
  const { profile } = useAuth();
  const [range, setRange] = useState<TachoAnalysisRange>('7d');
  const [selectedDay, setSelectedDay] = useState<TachoDaySummary | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState(driverId ?? '');
  const [assigningTrainingId, setAssigningTrainingId] = useState<string | null>(null);
  const [justAssignedTrainingId, setJustAssignedTrainingId] = useState<string | null>(null);
  const { data: drivers = [] } = useDrivers(profile?.company_id ?? undefined);
  const { data, loading, error, emptyState, isMock } = useDriverCardAnalysis(range, { driverId: selectedDriverId || undefined });

  useEffect(() => { setSelectedDriverId(driverId ?? ''); }, [driverId]);

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

  const activeDriverId = selectedDriverId || data?.identity.driverId;
  const filteredDrivers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return drivers
      .filter((entry) => entry.role === 'driver')
      .filter((entry) => !query || entry.full_name.toLowerCase().includes(query) || entry.email.toLowerCase().includes(query))
      .map((entry) => ({ id: entry.id, label: entry.full_name || entry.email, meta: entry.email }));
  }, [drivers, searchValue]);

  const findings = data?.findings ?? EMPTY_FINDINGS;
  const technicalEvents = data?.technicalEvents ?? EMPTY_FINDINGS;
  const reconciliation = data?.reconciliation ?? EMPTY_RECONCILIATION;
  const dayReason = useMemo(() => {
    if (!selectedDay || !focusedDate) return null;
    if (selectedDay.date !== focusedDate) return `Opened from a review queue focused on ${format(new Date(`${focusedDate}T12:00:00`), 'dd MMM yyyy')}. That day was not present in the current range, so the workspace fell back to the nearest loaded day.`;
    return `Opened from a review queue or alert focused on ${format(new Date(`${focusedDate}T12:00:00`), 'dd MMM yyyy')}.`;
  }, [focusedDate, selectedDay]);

  const timelineDays = useMemo(() => (data?.dailySummaries ?? []).map((day) => ({
    date: new Date(day.date),
    activities: day.activities,
    markers: day.findingsCount + technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= day.date && event.periodEnd.slice(0, 10) >= day.date).length + reconciliation.filter((item) => item.date === day.date && item.status !== 'matched').length,
    markerGroups: [
      { label: 'Findings', count: day.findingsCount, tone: 'danger' as const },
      { label: 'Linked VU', count: technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= day.date && event.periodEnd.slice(0, 10) >= day.date).length, tone: 'warning' as const },
      { label: 'Cross-check', count: reconciliation.filter((item) => item.date === day.date && item.status !== 'matched').length, tone: 'warning' as const },
    ],
  })), [data, reconciliation, technicalEvents]);

  const trainingRecommendations = useMemo(() => buildTrainingRecommendations(findings, reconciliation), [findings, reconciliation]);

  const handleAssignTraining = async (recommendation: TrainingRecommendation) => {
    if (!profile?.company_id || !profile.id || !activeDriverId) return;
    setAssigningTrainingId(recommendation.id);
    try {
      await supabase.from('training_records').insert({
        company_id: profile.company_id,
        driver_id: activeDriverId,
        training_type: 'tacho_refresher',
        module_id: recommendation.moduleId,
        title: recommendation.title,
        hours_credited: 0,
        status: 'assigned',
        assigned_by: profile.id,
        notes: recommendation.reason,
      });
      setJustAssignedTrainingId(recommendation.id);
      setTimeout(() => setJustAssignedTrainingId(null), 2500);
    } finally {
      setAssigningTrainingId(null);
    }
  };

  const picker = <TachoWorkspacePicker title="Driver Workspace Target" searchLabel="Search drivers" selectLabel="Open driver" searchValue={searchValue} onSearchChange={setSearchValue} selectedValue={selectedDriverId} onSelectChange={setSelectedDriverId} options={filteredDrivers} fallbackLabel="Latest imported driver card" />;
  const readerOverlay = <TachoReaderStatusOverlay sourceType="driver_card" onOpenImportCentre={onOpenImportCentre} />;

  if (loading) return <div className="space-y-6">{picker}{readerOverlay}<StateCard title="Loading driver card analysis..." /></div>;
  if (error) return <div className="space-y-6">{picker}{readerOverlay}<StateCard title={error} tone="error" /></div>;
  if (!data) return <div className="space-y-6">{picker}{readerOverlay}<StateCard title={emptyState?.title ?? 'No driver-card analysis available'} text={emptyState?.guidance ?? 'Pick a driver with imported card data or upload a new card file.'} tone="warning" /></div>;

  const statusTone = data.identity.downloadStatus === 'overdue' ? 'bg-rose-100 text-rose-700' : data.identity.downloadStatus === 'due_soon' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

  return (
    <div className="space-y-6">
      {picker}
      {readerOverlay}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-xl"><CreditCard className="w-7 h-7 text-blue-600" /></div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver Card Analysis</p>
                {isMock ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">Mock Fallback</span> : null}
              </div>
              <h2 className="text-3xl font-black text-slate-900">{data.identity.driverName}</h2>
              <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                <span>Card: {data.identity.cardNumber}</span>
                <span>Expiry: {format(new Date(data.identity.cardExpiry), 'dd MMM yyyy')}</span>
                <span>Last Download: {format(new Date(data.identity.lastDownloadAt), 'dd MMM yyyy HH:mm')}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start xl:items-end gap-3">
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest ${statusTone}`}>{data.identity.downloadStatus.replace('_', ' ')}</span>
            <TachoFilters value={range} onChange={setRange} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <ActionButton icon={<UserRound className="w-4 h-4" />} label="Open Personnel File" disabled={!activeDriverId || !onOpenPersonnelFile} onClick={() => activeDriverId && onOpenPersonnelFile?.(activeDriverId)} />
          <ActionButton icon={<ShieldAlert className="w-4 h-4" />} label="Open Compliance Actions" disabled={!activeDriverId || !onOpenComplianceActions} onClick={() => activeDriverId && onOpenComplianceActions?.(activeDriverId)} />
          <ActionButton icon={<GraduationCap className="w-4 h-4" />} label="Open Training" disabled={!activeDriverId || !onOpenTraining} onClick={() => activeDriverId && onOpenTraining?.(activeDriverId)} />
        </div>
      </div>

      {dayReason ? <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-medium text-blue-950">{dayReason}</div> : null}

      <div className="grid grid-cols-1 xl:grid-cols-[2.25fr,1fr] gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Historical Timeline</p>
              <h3 className="text-lg font-black text-slate-900">Driver Card Activity Strip</h3>
              <p className="text-sm text-slate-500">This is the primary review surface: scroll the card history, then open any day for evidence and findings.</p>
            </div>
            <button onClick={() => setSelectedDay(data.dailySummaries[0] ?? null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-black uppercase tracking-widest transition">Open Latest Day</button>
          </div>
          <TachoActivityTimeline days={timelineDays} selectedDate={selectedDay ? new Date(selectedDay.date) : undefined} onSelectDate={(date) => setSelectedDay(data.dailySummaries.find((day) => day.date === date.toISOString().slice(0, 10)) ?? null)} />
        </div>

        <div className="space-y-6">
          <InfoPanel title="Selected Day Overview" icon={<BadgeAlert className="w-5 h-5 text-blue-600" />}>
            {selectedDay ? <StatList items={[`Driving: ${minsToHours(selectedDay.drivingMins)}`, `Work: ${minsToHours(selectedDay.workMins)}`, `POA: ${minsToHours(selectedDay.poaMins)}`, `Rest: ${minsToHours(selectedDay.restMins)}`]} /> : <p className="text-sm text-slate-500">Select a day in the timeline to inspect review context.</p>}
          </InfoPanel>

          <InfoPanel title="Selected Day Cross-check" icon={<BadgeAlert className="w-5 h-5 text-amber-600" />}>
            {selectedDay ? <StatList items={[`Legal findings: ${findings.filter((finding) => finding.periodStart.slice(0, 10) <= selectedDay.date && finding.periodEnd.slice(0, 10) >= selectedDay.date).length}`, `Linked VU events: ${technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= selectedDay.date && event.periodEnd.slice(0, 10) >= selectedDay.date).length}`, `Cross-check issues: ${reconciliation.filter((item) => item.date === selectedDay.date && item.status !== 'matched').length}`]} /> : <p className="text-sm text-slate-500">Select a day in the timeline to inspect review context.</p>}
          </InfoPanel>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {data.metrics.map((metric) => <MetricTile key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,1fr] gap-6">
        <InfoPanel title="Training / Action Follow-up" icon={<GraduationCap className="w-5 h-5 text-blue-600" />}>
            {trainingRecommendations.length === 0 ? <p className="text-sm text-slate-500">No repeated tacho patterns currently map to a refresher recommendation for this selected range.</p> : (
              <div className="space-y-3">
                {trainingRecommendations.map((recommendation) => (
                  <div key={recommendation.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="text-sm font-bold text-slate-900">{recommendation.title}</p><p className="mt-1 text-xs text-slate-500">{recommendation.reason}</p></div>
                      <button onClick={() => handleAssignTraining(recommendation)} disabled={assigningTrainingId === recommendation.id || !activeDriverId} className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-700 disabled:opacity-50">{justAssignedTrainingId === recommendation.id ? 'Assigned' : assigningTrainingId === recommendation.id ? 'Assigning' : 'Assign'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </InfoPanel>

        <InfoPanel title="Evidence Summary" icon={<BadgeAlert className="w-5 h-5 text-rose-600" />}>
          <StatList items={[`Findings in range: ${findings.length}`, `Technical events in range: ${technicalEvents.length}`, `Cross-check items in range: ${reconciliation.filter((item) => item.status !== 'matched').length}`, `Loaded activity segments: ${data.activitySegments.length}`]} />
        </InfoPanel>
      </div>

      <TachoDayDetailDrawer day={selectedDay} findings={findings} technicalEvents={technicalEvents} reconciliation={reconciliation} selectedReason={dayReason} onClose={() => setSelectedDay(null)} />
    </div>
  );
}

function minsToHours(mins: number) {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function buildTrainingRecommendations(findings: TachoFinding[], reconciliation: TachoReconciliationItem[]): TrainingRecommendation[] {
  const items: TrainingRecommendation[] = [];
  const breakFindings = findings.filter((finding) => ['DRV_CONTINUOUS_4H30_EXCEEDED', 'WTD_BREAK_AFTER_6H_MISSING', 'WTD_BREAK_AFTER_9H_MISSING'].includes(finding.ruleCode));
  const restFindings = findings.filter((finding) => finding.ruleCode.startsWith('REST_') || finding.ruleCode.startsWith('DRV_WEEKLY_'));
  const mismatches = reconciliation.filter((item) => item.status !== 'matched');
  if (breakFindings.length >= 2) items.push({ id: 'breaks', moduleId: 'tacho-modes', title: 'Tachograph Mode Switching', reason: `${breakFindings.length} repeated break or mode-linked findings were returned in the selected range.` });
  if (restFindings.length >= 2) items.push({ id: 'hours', moduleId: 'eu-hours', title: "EU Drivers' Hours Rules", reason: `${restFindings.length} hours or rest findings need a refresher on legal limits and recovery rules.` });
  if (mismatches.length >= 2) items.push({ id: 'cross-check', moduleId: 'tacho-modes', title: 'App Vs Tacho Record Discipline', reason: `${mismatches.length} cross-check mismatches indicate repeated app-vs-tacho alignment issues.` });
  return items;
}

function ActionButton({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) { return <button onClick={onClick} disabled={disabled} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">{icon}{label}</button>; }
function StateCard({ title, text, tone = 'loading' }: { title: string; text?: string; tone?: 'loading' | 'error' | 'warning' }) { const isError = tone === 'error'; return <div className={`rounded-2xl border p-8 text-center ${isError ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'}`}>{isError ? <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" /> : <div className="w-10 h-10 border-b-2 border-blue-600 rounded-full animate-spin mx-auto mb-3" />}<p className={`font-bold ${isError ? 'text-rose-700' : 'text-slate-700'}`}>{title}</p>{text ? <p className="mt-2 text-sm text-slate-500">{text}</p> : null}</div>; }
function MetricTile({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'good' | 'warning' | 'danger' }) { const styles = { neutral: 'border-slate-200 bg-white text-slate-700', good: 'border-emerald-100 bg-emerald-50 text-emerald-700', warning: 'border-amber-100 bg-amber-50 text-amber-700', danger: 'border-rose-100 bg-rose-50 text-rose-700' }[tone]; return <div className={`rounded-2xl border p-5 shadow-sm ${styles}`}><p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p><p className="text-3xl font-black mt-2">{value}</p></div>; }
function InfoPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) { return <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"><div className="flex items-center gap-2 mb-4">{icon}<h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3></div>{children}</div>; }
function StatList({ items }: { items: string[] }) { return <div className="space-y-2">{items.map((item) => <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{item}</div>)}</div>; }
