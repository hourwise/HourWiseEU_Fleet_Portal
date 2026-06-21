import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, BadgeAlert, CheckCircle2, CreditCard, Download, FileText, GraduationCap, Laptop, Link2, Loader2, RefreshCw, ShieldAlert, UserPlus, UserRound } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { useDriverCardAnalysis } from '../../../hooks/useDriverCardAnalysis';
import { useDrivers } from '../../../hooks/useDrivers';
import { useTachoReaderWorkflow, type TachoReaderAnalysisTarget } from '../../../hooks/useTachoReaderWorkflow';
import { supabase } from '../../../lib/supabase';
import { InviteDriverModal } from '../InviteDriverModal';
import { pairTachoImportToDriver } from '../../../lib/tacho/driverPairing';
import { TachoActivityTimeline } from './TachoActivityTimeline';
import { TachoDayDetailDrawer } from './TachoDayDetailDrawer';
import { TachoFilters } from './TachoFilters';
import { TachoWorkspacePicker } from './TachoWorkspacePicker';
import type { TachoAnalysisRange, TachoDaySummary, TachoFinding, TachoReconciliationItem } from '../../../lib/tacho/rules/types';

interface DriverCardAnalysisProps {
  driverId?: string;
  importId?: string;
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

type TimelineDay = {
  date: Date;
  activities: TachoDaySummary['activities'];
  markers?: number;
  markerGroups?: {
    label: string;
    count: number;
    tone: 'danger' | 'warning' | 'neutral';
  }[];
};

export function DriverCardAnalysis({ driverId, importId, focusedDate, onOpenImportCentre, onOpenPersonnelFile, onOpenComplianceActions, onOpenTraining }: DriverCardAnalysisProps) {
  const { profile } = useAuth();
  const [range, setRange] = useState<TachoAnalysisRange>('7d');
  const [selectedDay, setSelectedDay] = useState<TachoDaySummary | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState(driverId ?? '');
  const [selectedImportId, setSelectedImportId] = useState(importId ?? '');
  const [readerFocusedDate, setReaderFocusedDate] = useState<string | null>(null);
  const [liveReaderTargetActive, setLiveReaderTargetActive] = useState(false);
  const [assigningTrainingId, setAssigningTrainingId] = useState<string | null>(null);
  const [justAssignedTrainingId, setJustAssignedTrainingId] = useState<string | null>(null);
  const [candidatePairDriverId, setCandidatePairDriverId] = useState('');
  const [candidateActionPending, setCandidateActionPending] = useState<string | null>(null);
  const [candidateActionError, setCandidateActionError] = useState<string | null>(null);
  const [candidateActionMessage, setCandidateActionMessage] = useState<string | null>(null);
  const [inviteFromCandidateOpen, setInviteFromCandidateOpen] = useState(false);
  const autoReadStartedRef = useRef(false);
  const handleReaderAnalysisReady = useCallback((target: TachoReaderAnalysisTarget) => {
    if (target.sourceType && target.sourceType !== 'driver_card') return;
    if (target.driverId) {
      setSelectedDriverId(target.driverId);
      setSelectedImportId('');
    } else {
      setSelectedDriverId('');
      setSelectedImportId(target.importId);
    }
    setReaderFocusedDate(target.focusedDate ?? null);
    setLiveReaderTargetActive(true);
  }, []);
  const readerWorkflow = useTachoReaderWorkflow({
    sourceType: 'driver_card',
    onAnalysisReady: handleReaderAnalysisReady,
  });
  const {
    status: readerStatus,
    commandPending: readerCommandPending,
    importPending: readerImportPending,
    sendCommand: sendReaderCommand,
  } = readerWorkflow;
  const { data: drivers = [] } = useDrivers(profile?.company_id ?? undefined);
  const { data, loading, error, emptyState, isMock } = useDriverCardAnalysis(range, {
    driverId: selectedDriverId || undefined,
    importId: selectedDriverId ? undefined : selectedImportId || undefined,
  });
  const blankTimelineDays = useMemo(() => buildBlankTimelineDays(range), [range]);
  const calendarSummaries = useMemo(
    () => buildCalendarSummaries(range, data?.dailySummaries ?? []),
    [data?.dailySummaries, range]
  );

  useEffect(() => {
    setSelectedDriverId(driverId ?? '');
    if (driverId) {
      setReaderFocusedDate(null);
      setLiveReaderTargetActive(false);
    }
  }, [driverId]);
  useEffect(() => {
    setSelectedImportId(importId ?? '');
    if (importId) {
      setSelectedDriverId('');
      setReaderFocusedDate(null);
      setLiveReaderTargetActive(false);
    }
  }, [importId]);

  useEffect(() => {
    if (!readerStatus.cardPresent || readerStatus.stage === 'helper_unavailable') {
      autoReadStartedRef.current = false;
    }
    if (
      !readerStatus.cardPresent ||
      !readerStatus.canStartRead ||
      readerCommandPending ||
      readerImportPending ||
      autoReadStartedRef.current
    ) {
      return;
    }
    autoReadStartedRef.current = true;
    sendReaderCommand('start-read');
  }, [
    readerCommandPending,
    readerImportPending,
    readerStatus.canStartRead,
    readerStatus.cardPresent,
    readerStatus.stage,
    sendReaderCommand,
  ]);

  useEffect(() => {
    if (!liveReaderTargetActive || readerStatus.cardPresent) return;
    if (readerStatus.stage !== 'ready' && readerStatus.stage !== 'helper_unavailable') return;
    setSelectedDriverId('');
    setSelectedImportId('');
    setReaderFocusedDate(null);
    setLiveReaderTargetActive(false);
  }, [liveReaderTargetActive, readerStatus.cardPresent, readerStatus.stage]);

  const activeFocusedDate = readerFocusedDate ?? focusedDate;

  useEffect(() => {
    if (!data) {
      setSelectedDay(null);
      return;
    }
    if (activeFocusedDate) {
      const match = calendarSummaries.find((day) => day.date === activeFocusedDate);
      if (match) {
        setSelectedDay(match);
        return;
      }
    }
    setSelectedDay((current) => current ? calendarSummaries.find((day) => day.date === current.date) ?? null : null);
  }, [activeFocusedDate, calendarSummaries, data]);

  const isCandidateCard = Boolean(data?.isCandidateCard);
  const activeDriverId = isCandidateCard ? '' : selectedDriverId || data?.identity.driverId;
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
    if (!selectedDay || !activeFocusedDate) return null;
    const sourceLabel = readerFocusedDate ? 'live card read' : 'review queue or alert';
    if (selectedDay.date !== activeFocusedDate) return `Opened from a ${sourceLabel} focused on ${format(new Date(`${activeFocusedDate}T12:00:00`), 'dd MMM yyyy')}. That day was not present in the current range, so the workspace fell back to the nearest loaded day.`;
    return `Opened from a ${sourceLabel} focused on ${format(new Date(`${activeFocusedDate}T12:00:00`), 'dd MMM yyyy')}.`;
  }, [activeFocusedDate, readerFocusedDate, selectedDay]);

  const timelineDays = useMemo(() => calendarSummaries.map((day) => ({
    date: new Date(day.date),
    activities: day.activities,
    markers: day.findingsCount + technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= day.date && event.periodEnd.slice(0, 10) >= day.date).length + reconciliation.filter((item) => item.date === day.date && item.status !== 'matched').length,
    markerGroups: [
      { label: 'Findings', count: day.findingsCount, tone: 'danger' as const },
      { label: 'Linked VU', count: technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= day.date && event.periodEnd.slice(0, 10) >= day.date).length, tone: 'warning' as const },
      { label: 'Cross-check', count: reconciliation.filter((item) => item.date === day.date && item.status !== 'matched').length, tone: 'warning' as const },
    ],
  })), [calendarSummaries, reconciliation, technicalEvents]);

  const trainingRecommendations = useMemo(() => buildTrainingRecommendations(findings, reconciliation), [findings, reconciliation]);
  const analysisSummary = useMemo(() => data ? buildAnalysisSummary(data.dailySummaries, findings, reconciliation) : null, [data, findings, reconciliation]);
  const selectedDayFindings = selectedDay
    ? findings.filter((finding) => finding.periodStart.slice(0, 10) <= selectedDay.date && finding.periodEnd.slice(0, 10) >= selectedDay.date)
    : [];
  const selectedDayEvents = selectedDay
    ? technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= selectedDay.date && event.periodEnd.slice(0, 10) >= selectedDay.date)
    : [];
  const selectedDayReconciliation = selectedDay
    ? reconciliation.filter((item) => item.date === selectedDay.date && item.status !== 'matched')
    : [];

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

  const handleSelectDriver = (value: string) => {
    setSelectedDriverId(value);
    setSelectedImportId('');
    setReaderFocusedDate(null);
    setLiveReaderTargetActive(false);
    setCandidateActionError(null);
    setCandidateActionMessage(null);
  };

  const candidateImportId = data?.importId ?? selectedImportId;
  const candidateCardSnapshot = data ? {
    cardNumber: data.identity.cardNumber,
    holderName: data.identity.driverName,
    cardExpiry: data.identity.cardExpiry,
    issuingAuthority: data.identity.issuingCountry,
    sourceImportId: candidateImportId || null,
  } : undefined;

  const handlePairCandidateToDriver = async () => {
    if (!profile?.company_id || !candidateImportId || !candidatePairDriverId || !data) return;
    setCandidateActionPending('pair');
    setCandidateActionError(null);
    setCandidateActionMessage(null);
    try {
      const result = await pairTachoImportToDriver({
        companyId: profile.company_id,
        importId: candidateImportId,
        driverId: candidatePairDriverId,
        cardNumber: data.identity.cardNumber,
      });
      setSelectedDriverId(result.driverId);
      setSelectedImportId('');
      setLiveReaderTargetActive(false);
      setCandidatePairDriverId('');
      setCandidateActionMessage(`Paired card ${result.cardNumber} to ${result.driverName}.`);
    } catch (err) {
      setCandidateActionError(err instanceof Error ? err.message : 'Failed to pair this card to the selected driver.');
    } finally {
      setCandidateActionPending(null);
    }
  };

  const handleMarkCandidateReviewed = async (decision: 'reviewed' | 'no_hire') => {
    if (!profile?.company_id || !candidateImportId) return;
    setCandidateActionPending(decision);
    setCandidateActionError(null);
    setCandidateActionMessage(null);
    try {
      const { error: reviewError } = await supabase.rpc('mark_tacho_candidate_card_review', {
        p_company_id: profile.company_id,
        p_import_id: candidateImportId,
        p_decision: decision,
        p_note: decision === 'no_hire'
          ? 'Candidate card check reviewed without creating an invite or driver profile.'
          : 'Candidate card check reviewed.',
      });
      if (reviewError) throw reviewError;
      setCandidateActionMessage(decision === 'no_hire'
        ? 'Marked as checked / no hire. No profile or invite was created.'
        : 'Marked as reviewed. No profile or invite was created.');
    } catch (err) {
      setCandidateActionError(err instanceof Error ? err.message : 'Failed to mark this candidate card as reviewed.');
    } finally {
      setCandidateActionPending(null);
    }
  };

  const picker = <TachoWorkspacePicker title="Driver Workspace Target" searchLabel="Search drivers" selectLabel="Open driver" searchValue={searchValue} onSearchChange={setSearchValue} selectedValue={selectedDriverId} onSelectChange={handleSelectDriver} options={filteredDrivers} fallbackLabel={selectedImportId ? 'Candidate / unlinked card check' : 'Latest imported driver card'} />;
  const readerPanel = <DriverCardReaderPanel workflow={readerWorkflow} onOpenImportCentre={onOpenImportCentre} />;

  if (loading) return <div className="space-y-6">{picker}{readerPanel}<StateCard title="Loading driver card analysis..." /></div>;
  if (error) return <div className="space-y-6">{picker}{readerPanel}<StateCard title={error} tone="error" /></div>;
  if (!data) {
    return (
      <div className="space-y-6">
        {picker}
        {readerPanel}
        <BlankDriverCardWorkspace
          range={range}
          onRangeChange={setRange}
          timelineDays={blankTimelineDays}
          title={emptyState?.title ?? 'Ready for driver card'}
          guidance={emptyState?.guidance ?? 'Insert a card to read and display the latest activity, or use Import Centre for a manual file upload.'}
        />
      </div>
    );
  }

  const statusTone = data.identity.downloadStatus === 'overdue' ? 'bg-rose-100 text-rose-700' : data.identity.downloadStatus === 'due_soon' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  const handleExportCsv = () => exportDriverCardCsv(data.identity.driverName, data.dailySummaries);

  return (
    <div className="space-y-6">
      {picker}
      {readerPanel}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-xl"><CreditCard className="w-7 h-7 text-blue-600" /></div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isCandidateCard ? 'Candidate Card Check' : 'Driver Card Analysis'}</p>
                {isMock ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">Mock Fallback</span> : null}
                {isCandidateCard ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">Unlinked</span> : null}
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
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {!isCandidateCard ? (
            <>
              <ActionButton icon={<UserRound className="w-4 h-4" />} label="Open Personnel File" disabled={!activeDriverId || !onOpenPersonnelFile} onClick={() => activeDriverId && onOpenPersonnelFile?.(activeDriverId)} />
              <ActionButton icon={<ShieldAlert className="w-4 h-4" />} label="Open Compliance Actions" disabled={!activeDriverId || !onOpenComplianceActions} onClick={() => activeDriverId && onOpenComplianceActions?.(activeDriverId)} />
              <ActionButton icon={<GraduationCap className="w-4 h-4" />} label="Open Training" disabled={!activeDriverId || !onOpenTraining} onClick={() => activeDriverId && onOpenTraining?.(activeDriverId)} />
            </>
          ) : null}
          <ActionButton icon={<Download className="w-4 h-4" />} label="Export CSV" onClick={handleExportCsv} />
          <ActionButton icon={<FileText className="w-4 h-4" />} label="Report View" onClick={() => window.print()} />
        </div>
      </div>

      {dayReason ? <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-medium text-blue-950">{dayReason}</div> : null}

      {isCandidateCard ? (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Pre-employment screening mode</p>
          <h3 className="mt-1 text-xl font-black text-blue-950">This card is not linked to a profile or invite</h3>
          <p className="mt-2 max-w-4xl text-sm font-medium text-blue-900">
            Review the decoded card identity and activity here before creating an invite or personnel file. This view does not update a driver file, assign training, or write compliance actions until the card is deliberately paired.
          </p>

          {candidateActionError ? <div className="mt-4 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700">{candidateActionError}</div> : null}
          {candidateActionMessage ? <div className="mt-4 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700">{candidateActionMessage}</div> : null}

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr,1fr]">
            <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Create Driver Invite</p>
              <h4 className="mt-1 text-base font-black text-slate-950">Invite this candidate using the decoded card identity</h4>
              <p className="mt-2 text-sm font-medium text-slate-600">
                Opens the normal invite form with name, card number, expiry and issuing authority prefilled. The driver profile is only created when the app invite is accepted.
              </p>
              <button
                type="button"
                onClick={() => setInviteFromCandidateOpen(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-blue-700"
              >
                <UserPlus className="h-4 w-4" />
                Create Invite From Card
              </button>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pair Existing Driver</p>
              <h4 className="mt-1 text-base font-black text-slate-950">Use this if the employee already exists</h4>
              <div className="mt-3 flex flex-col gap-3 md:flex-row">
                <select
                  value={candidatePairDriverId}
                  onChange={(event) => setCandidatePairDriverId(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                >
                  <option value="">Select existing driver profile</option>
                  {filteredDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.label} - {driver.meta}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!candidatePairDriverId || candidateActionPending === 'pair'}
                  onClick={() => void handlePairCandidateToDriver()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {candidateActionPending === 'pair' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Pair Card
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton icon={<CheckCircle2 className="w-4 h-4" />} label={candidateActionPending === 'reviewed' ? 'Marking Reviewed' : 'Mark Reviewed Only'} disabled={candidateActionPending !== null} onClick={() => void handleMarkCandidateReviewed('reviewed')} />
            <ActionButton icon={<ShieldAlert className="w-4 h-4" />} label={candidateActionPending === 'no_hire' ? 'Marking No Hire' : 'Checked / No Hire'} disabled={candidateActionPending !== null} onClick={() => void handleMarkCandidateReviewed('no_hire')} />
            <ActionButton icon={<CreditCard className="w-4 h-4" />} label="Open Import Review" disabled={!onOpenImportCentre} onClick={() => onOpenImportCentre?.()} />
            <ActionButton icon={<FileText className="w-4 h-4" />} label="Screening Report" onClick={() => window.print()} />
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Provisional Reader Result</p>
            <h3 className="mt-1 text-xl font-black text-amber-950">HourWise read-only capture, not certified C1B/DDD output</h3>
            <p className="mt-2 max-w-4xl text-sm font-medium text-amber-900">
              These rows come from the current read-only driver-card capture and provisional EF parsing. Use them for operational review and validation, but do not treat them as a certified tachograph download until the final C1B/DDD writer/parser path is complete.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:min-w-[34rem]">
            <SummaryTile label="Parsed Period" value={analysisSummary?.periodLabel ?? 'No dated rows'} />
            <SummaryTile label="Activity Blocks" value={String(data.activitySegments.length)} />
            <SummaryTile label="Issues" value={String(analysisSummary?.issueCount ?? 0)} />
            <SummaryTile label="Last Read" value={format(new Date(data.identity.lastDownloadAt), 'dd MMM HH:mm')} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2.25fr,1fr] gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{rangeLabel(range)} Calendar</p>
              <h3 className="text-lg font-black text-slate-900">Driver Card Activity By Day</h3>
              <p className="text-sm text-slate-500">Select a day to open the detailed evidence drawer. No day is opened automatically.</p>
            </div>
            <TachoFilters value={range} onChange={setRange} />
          </div>
          <TachoActivityTimeline days={timelineDays} selectedDate={selectedDay ? new Date(selectedDay.date) : undefined} onSelectDate={(date) => setSelectedDay(calendarSummaries.find((day) => day.date === date.toISOString().slice(0, 10)) ?? null)} />
        </div>

        <div className="space-y-6">
          <InfoPanel title="Selected Day Overview" icon={<BadgeAlert className="w-5 h-5 text-blue-600" />}>
            {selectedDay ? <StatList items={[`Driving: ${minsToHours(selectedDay.drivingMins)}`, `Work: ${minsToHours(selectedDay.workMins)}`, `POA: ${minsToHours(selectedDay.poaMins)}`, `Rest: ${minsToHours(selectedDay.restMins)}`]} /> : <p className="text-sm text-slate-500">Select a day in the timeline to inspect review context.</p>}
          </InfoPanel>

          <InfoPanel title="Selected Day Cross-check" icon={<BadgeAlert className="w-5 h-5 text-amber-600" />}>
            {selectedDay ? <StatList items={[`Legal findings: ${selectedDayFindings.length}`, `Linked VU events: ${selectedDayEvents.length}`, `Cross-check issues: ${selectedDayReconciliation.length}`]} /> : <p className="text-sm text-slate-500">Select a day in the timeline to inspect review context.</p>}
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
      {inviteFromCandidateOpen && candidateCardSnapshot ? (
        <InviteDriverModal
          initialFullName={data.identity.driverName === 'Candidate card' ? '' : data.identity.driverName}
          tachographCardSnapshot={candidateCardSnapshot}
          onClose={() => setInviteFromCandidateOpen(false)}
          onInviteSent={() => {
            setCandidateActionMessage('Invite sent with this tachograph card attached. The profile will be paired when the driver accepts.');
            setCandidateActionError(null);
          }}
        />
      ) : null}
    </div>
  );
}

function minsToHours(mins: number) {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function rangeLabel(range: TachoAnalysisRange) {
  switch (range) {
    case '30d':
      return '30 day';
    case '3m':
      return '3 month';
    case '6m':
      return '6 month';
    case '12m':
      return '12 month';
    default:
      return '7 day';
  }
}

function rangeDayCount(range: TachoAnalysisRange) {
  switch (range) {
    case '30d':
      return 30;
    case '3m':
      return 90;
    case '6m':
      return 180;
    case '12m':
      return 365;
    default:
      return 7;
  }
}

function buildBlankTimelineDays(range: TachoAnalysisRange): TimelineDay[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: rangeDayCount(range) }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    return {
      date,
      activities: [],
      markers: 0,
      markerGroups: [
        { label: 'Findings', count: 0, tone: 'danger' as const },
        { label: 'Linked VU', count: 0, tone: 'warning' as const },
        { label: 'Cross-check', count: 0, tone: 'warning' as const },
      ],
    };
  });
}

function buildCalendarSummaries(range: TachoAnalysisRange, summaries: TachoDaySummary[]): TachoDaySummary[] {
  const activitiesByDate = new Map<string, TachoDaySummary['activities']>();

  summaries.forEach((summary) => {
    const existing = activitiesByDate.get(summary.date) ?? [];
    const bySignature = new Map(existing.map((activity) => [activitySignature(activity), activity]));

    summary.activities.forEach((activity) => {
      bySignature.set(activitySignature(activity), activity);
    });

    activitiesByDate.set(
      summary.date,
      Array.from(bySignature.values()).sort((left, right) => left.startTime.localeCompare(right.startTime))
    );
  });

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Array.from({ length: rangeDayCount(range) }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    const dateKey = format(date, 'yyyy-MM-dd');
    const activities = activitiesByDate.get(dateKey) ?? [];
    if (activities.length > 0) {
      return {
        date: dateKey,
        drivingMins: sumActivityMins(activities, 'driving'),
        workMins: sumActivityMins(activities, 'work'),
        poaMins: sumActivityMins(activities, 'poa'),
        restMins: sumActivityMins(activities, 'break_rest'),
        findingsCount: summaries
          .filter((summary) => summary.date === dateKey)
          .reduce((total, summary) => Math.max(total, summary.findingsCount), 0),
        vuEventCount: summaries
          .filter((summary) => summary.date === dateKey)
          .reduce((total, summary) => Math.max(total, summary.vuEventCount ?? 0), 0),
        activities,
      };
    }

    return {
      date: dateKey,
      drivingMins: 0,
      workMins: 0,
      poaMins: 0,
      restMins: 0,
      findingsCount: 0,
      vuEventCount: 0,
      activities: [],
    };
  });
}

function activitySignature(activity: TachoDaySummary['activities'][number]) {
  return [
    activity.driverId ?? '',
    activity.vehicleId ?? '',
    activity.source,
    activity.activityType,
    activity.startTime,
    activity.endTime,
    activity.durationMins,
    activity.label ?? '',
  ].join('|');
}

function sumActivityMins(activities: TachoDaySummary['activities'], activityType: TachoDaySummary['activities'][number]['activityType']) {
  return activities
    .filter((activity) => activity.activityType === activityType)
    .reduce((total, activity) => total + activity.durationMins, 0);
}

function buildAnalysisSummary(
  days: TachoDaySummary[],
  findings: TachoFinding[],
  reconciliation: TachoReconciliationItem[]
) {
  const sortedDates = days.map((day) => day.date).sort();
  const start = sortedDates[0];
  const end = sortedDates[sortedDates.length - 1];
  const issueCount = findings.length + reconciliation.filter((item) => item.status !== 'matched').length;

  return {
    periodLabel: start && end
      ? `${format(new Date(`${start}T12:00:00`), 'dd MMM')} - ${format(new Date(`${end}T12:00:00`), 'dd MMM yyyy')}`
      : 'No dated rows',
    issueCount,
  };
}

function exportDriverCardCsv(driverName: string, days: TachoDaySummary[]) {
  const rows = [
    ['Date', 'Driving', 'Work', 'POA', 'Rest', 'Findings', 'Activity blocks'],
    ...days.map((day) => [
      day.date,
      minsToHours(day.drivingMins),
      minsToHours(day.workMins),
      minsToHours(day.poaMins),
      minsToHours(day.restMins),
      String(day.findingsCount),
      String(day.activities.length),
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${driverName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'driver-card'}-tachograph-summary.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
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

function DriverCardReaderPanel({ workflow, onOpenImportCentre }: { workflow: ReturnType<typeof useTachoReaderWorkflow>; onOpenImportCentre?: () => void }) {
  const { status } = workflow;
  const tone =
    status.stage === 'complete'
      ? 'border-emerald-200 bg-emerald-50'
      : status.stage === 'error'
      ? 'border-rose-200 bg-rose-50'
      : status.stage === 'helper_unavailable'
      ? 'border-amber-200 bg-amber-50'
      : 'border-blue-200 bg-blue-50';
  const canCancel = status.canCancel && !workflow.commandPending;
  const canManualStart = status.canStartRead && !workflow.commandPending && !workflow.importPending;

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tone}`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
            <Laptop className="h-6 w-6 text-blue-700" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Driver Card Reader</p>
            <h3 className="mt-1 text-xl font-black text-slate-950">{status.headline}</h3>
            <p className="mt-2 max-w-4xl text-sm font-medium text-slate-700">{status.detail}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-widest text-slate-600">
              <span className="rounded-full bg-white/80 px-3 py-1">Reader: {status.readerConnected ? status.readerDeviceName ?? 'Connected' : 'Not detected'}</span>
              <span className="rounded-full bg-white/80 px-3 py-1">Card: {status.cardPresent ? 'Inserted' : 'Not inserted'}</span>
              <span className="rounded-full bg-white/80 px-3 py-1">Import: {status.importId ? 'Ready' : 'Waiting'}</span>
              {status.lastHeartbeatAt ? <span className="rounded-full bg-white/80 px-3 py-1">Seen {new Date(status.lastHeartbeatAt).toLocaleTimeString('en-GB')}</span> : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button
            type="button"
            onClick={() => void workflow.refreshStatus()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${workflow.refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void workflow.sendCommand('start-read')}
            disabled={!canManualStart}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {workflow.commandPending === 'start-read' || workflow.importPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {status.stage === 'card_inserted' ? 'Auto Reading' : 'Read Card'}
          </button>
          <button
            type="button"
            onClick={() => void workflow.sendCommand('cancel')}
            disabled={!canCancel}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onOpenImportCentre}
            disabled={!onOpenImportCentre}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Manual Import
          </button>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
          <span>Read / Import Progress</span>
          <span>{status.progressPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/80">
          <div
            className={`h-2 rounded-full transition-all ${status.stage === 'error' ? 'bg-rose-500' : status.stage === 'complete' ? 'bg-emerald-500' : 'bg-blue-700'}`}
            style={{ width: `${status.progressPercent}%` }}
          />
        </div>
      </div>

      {status.exportParserReady === false ? (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-white/70 p-3 text-xs font-medium text-amber-950">
          This is a provisional HourWise read-only capture. It can be displayed for review, but it is not certified C1B/DDD output yet.
        </div>
      ) : null}

      {workflow.lastError || workflow.commandMessage || workflow.importMessage ? (
        <div className="mt-4 rounded-2xl border border-white/80 bg-white/70 p-3 text-xs font-medium text-slate-700">
          {workflow.lastError ? <p className="text-amber-800">{workflow.lastError}</p> : null}
          {workflow.commandMessage ? <p>{workflow.commandMessage}</p> : null}
          {workflow.importMessage ? <p>{workflow.importMessage}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({ icon, label, onClick, disabled }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean }) { return <button onClick={onClick} disabled={disabled} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">{icon}{label}</button>; }
function StateCard({ title, text, tone = 'loading' }: { title: string; text?: string; tone?: 'loading' | 'error' | 'warning' }) { const isError = tone === 'error'; const isWarning = tone === 'warning'; return <div className={`rounded-2xl border p-8 text-center ${isError ? 'bg-rose-50 border-rose-100' : isWarning ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-200'}`}>{isError || isWarning ? <AlertTriangle className={`w-10 h-10 mx-auto mb-3 ${isError ? 'text-rose-500' : 'text-amber-500'}`} /> : <div className="w-10 h-10 border-b-2 border-blue-600 rounded-full animate-spin mx-auto mb-3" />}<p className={`font-bold ${isError ? 'text-rose-700' : isWarning ? 'text-amber-900' : 'text-slate-700'}`}>{title}</p>{text ? <p className="mt-2 text-sm text-slate-500">{text}</p> : null}</div>; }
function MetricTile({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'good' | 'warning' | 'danger' }) { const styles = { neutral: 'border-slate-200 bg-white text-slate-700', good: 'border-emerald-100 bg-emerald-50 text-emerald-700', warning: 'border-amber-100 bg-amber-50 text-amber-700', danger: 'border-rose-100 bg-rose-50 text-rose-700' }[tone]; return <div className={`rounded-2xl border p-5 shadow-sm ${styles}`}><p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p><p className="text-3xl font-black mt-2">{value}</p></div>; }
function SummaryTile({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-amber-200 bg-white/70 px-3 py-3"><p className="text-[10px] font-black uppercase tracking-widest text-amber-700">{label}</p><p className="mt-1 text-sm font-black text-amber-950">{value}</p></div>; }
function InfoPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) { return <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"><div className="flex items-center gap-2 mb-4">{icon}<h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3></div>{children}</div>; }
function StatList({ items }: { items: string[] }) { return <div className="space-y-2">{items.map((item) => <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{item}</div>)}</div>; }
function BlankDriverCardWorkspace({ range, onRangeChange, timelineDays, title, guidance }: { range: TachoAnalysisRange; onRangeChange: (range: TachoAnalysisRange) => void; timelineDays: TimelineDay[]; title: string; guidance: string }) { return <div className="space-y-6"><StateCard title={title} text={guidance} tone="warning" /><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{rangeLabel(range)} Calendar</p><h3 className="text-lg font-black text-slate-900">Blank Driver Card Workspace</h3><p className="text-sm text-slate-500">The calendar remains ready for the next inserted card. Parsed days will replace this blank state after a successful read/import.</p></div><TachoFilters value={range} onChange={onRangeChange} /></div><TachoActivityTimeline days={timelineDays} /></div></div>; }
