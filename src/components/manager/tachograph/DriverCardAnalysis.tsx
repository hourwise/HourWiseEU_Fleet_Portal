import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { AlertTriangle, BadgeAlert, CheckCircle2, CreditCard, Download, FileText, GraduationCap, Laptop, Link2, Loader2, RefreshCw, ShieldAlert, UserPlus, UserRound } from 'lucide-react';
import { addDays, differenceInMinutes, format } from 'date-fns';
import { useAuth } from '../../../contexts/AuthContext';
import { useDriverCardAnalysis } from '../../../hooks/useDriverCardAnalysis';
import { useDrivers } from '../../../hooks/useDrivers';
import { useTachoReaderWorkflow, type TachoReaderAnalysisTarget } from '../../../hooks/useTachoReaderWorkflow';
import { supabase } from '../../../lib/supabase';
import { InviteDriverModal } from '../InviteDriverModal';
import { fetchTachoFindingReviews, saveTachoFindingReview } from '../../../lib/tacho/api';
import { pairTachoImportToDriver } from '../../../lib/tacho/driverPairing';
import { durationSecondsBetween, formatDurationSeconds, inferReportTimeResolution, type ReportTimeResolution } from '../../../lib/tacho/reportTime';
import { evaluateDriverRules } from '../../../lib/tacho/rules/engine';
import { TachoActivityTimeline } from './TachoActivityTimeline';
import { TachoDayDetailDrawer } from './TachoDayDetailDrawer';
import { TachoFilters } from './TachoFilters';
import { TachoFindingReviewPanel } from './TachoFindingReviewPanel';
import { TimelineComparisonStatus } from './TimelineComparisonStatus';
import type { DriverCardAnalysisData, RuleActivitySegment, TachoActivitySegment, TachoAnalysisRange, TachoCorrectiveActionType, TachoDaySummary, TachoFinding, TachoFindingReview, TachoFindingReviewStatus, TachoReconciliationItem } from '../../../lib/tacho/rules/types';

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
  findingIds: string[];
}

interface DriverCardReportSnapshot {
  title: string;
  kindLabel: string;
  driverName: string;
  cardNumber: string;
  cardExpiry: string;
  issuingCountry: string;
  lastDownloadAt: string;
  downloadStatus: string;
  periodLabel: string;
  generatedAt: string;
  caveat: string;
  activityTimeResolution: ReportTimeResolution;
  activityTimeResolutionLabel: string;
  activityTimeResolutionNote: string;
  totals: {
    drivingMins: number;
    workMins: number;
    poaMins: number;
    restMins: number;
    activityBlocks: number;
    loadedDays: number;
  };
  issueCounts: {
    findings: number;
    highSeverity: number;
    warnings: number;
    technicalEvents: number;
    reconciliationIssues: number;
  };
  days: TachoDaySummary[];
  findings: TachoFinding[];
  technicalEvents: TachoFinding[];
  reconciliationIssues: TachoReconciliationItem[];
}

const EMPTY_FINDINGS: TachoFinding[] = [];
const EMPTY_RECONCILIATION: TachoReconciliationItem[] = [];
const READER_ANALYSIS_TARGET_STORAGE_KEY = 'hourwise:tacho-reader:last-analysis-target';

function readPersistedReaderAnalysisTarget(): TachoReaderAnalysisTarget | null {
  try {
    const rawValue = window.sessionStorage.getItem(READER_ANALYSIS_TARGET_STORAGE_KEY);
    if (!rawValue) return null;
    const parsed = JSON.parse(rawValue) as Partial<TachoReaderAnalysisTarget>;
    if (!parsed.importId || typeof parsed.importId !== 'string') return null;
    return {
      importId: parsed.importId,
      driverId: typeof parsed.driverId === 'string' ? parsed.driverId : null,
      focusedDate: typeof parsed.focusedDate === 'string' ? parsed.focusedDate : null,
      sourceType: typeof parsed.sourceType === 'string' ? parsed.sourceType : null,
    };
  } catch {
    return null;
  }
}

function persistReaderAnalysisTarget(target: TachoReaderAnalysisTarget) {
  try {
    window.sessionStorage.setItem(
      READER_ANALYSIS_TARGET_STORAGE_KEY,
      JSON.stringify({
        importId: target.importId,
        driverId: target.driverId ?? null,
        focusedDate: target.focusedDate ?? null,
        sourceType: target.sourceType ?? null,
        storedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Non-critical: Supabase remains the source of truth for the actual import.
  }
}

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
  const [trainingAssignError, setTrainingAssignError] = useState<string | null>(null);
  const [candidatePairDriverId, setCandidatePairDriverId] = useState('');
  const [candidateActionPending, setCandidateActionPending] = useState<string | null>(null);
  const [candidateActionError, setCandidateActionError] = useState<string | null>(null);
  const [candidateActionMessage, setCandidateActionMessage] = useState<string | null>(null);
  const [inviteFromCandidateOpen, setInviteFromCandidateOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [findingReviews, setFindingReviews] = useState<Record<string, TachoFindingReview>>({});
  const [reviewPendingId, setReviewPendingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const autoReadStartedRef = useRef(false);
  const persistedReaderTargetLoadedRef = useRef(false);
  const handleReaderAnalysisReady = useCallback((target: TachoReaderAnalysisTarget) => {
    if (target.sourceType && target.sourceType !== 'driver_card') return;
    persistReaderAnalysisTarget(target);
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
    targetDriverId: selectedDriverId || null,
    onAnalysisReady: handleReaderAnalysisReady,
  });
  const {
    status: readerStatus,
    commandPending: readerCommandPending,
    importPending: readerImportPending,
    sendCommand: sendReaderCommand,
  } = readerWorkflow;
  const handleManualReaderRefresh = useCallback(async () => {
    const shouldClearReaderResult =
      !readerStatus.cardPresent && (readerStatus.stage === 'complete' || readerStatus.stage === 'error');
    await readerWorkflow.refreshStatus({ clearCompletedResult: true });
    if (shouldClearReaderResult) {
      readerWorkflow.clearCompletedReaderResult();
      if (liveReaderTargetActive) {
        setReaderFocusedDate(null);
        setLiveReaderTargetActive(false);
      }
    } else if (!readerStatus.cardPresent && liveReaderTargetActive) {
      setReaderFocusedDate(null);
      setLiveReaderTargetActive(false);
    }
  }, [liveReaderTargetActive, readerStatus.cardPresent, readerStatus.stage, readerWorkflow]);
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
    if (persistedReaderTargetLoadedRef.current) return;
    persistedReaderTargetLoadedRef.current = true;
    if (driverId || importId) return;
    const persistedTarget = readPersistedReaderAnalysisTarget();
    if (!persistedTarget) return;
    handleReaderAnalysisReady(persistedTarget);
  }, [driverId, handleReaderAnalysisReady, importId]);

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
    if (readerStatus.stage !== 'complete' || !readerStatus.importId) return;
    if (readerStatus.sourceType && readerStatus.sourceType !== 'driver_card') return;
    const alreadyFocused = readerStatus.driverId
      ? selectedDriverId === readerStatus.driverId
      : selectedImportId === readerStatus.importId;
    if (alreadyFocused) return;
    handleReaderAnalysisReady({
      importId: readerStatus.importId,
      driverId: readerStatus.driverId ?? null,
      focusedDate: readerStatus.focusedDate ?? null,
      sourceType: readerStatus.sourceType ?? 'driver_card',
    });
  }, [
    handleReaderAnalysisReady,
    readerStatus.driverId,
    readerStatus.focusedDate,
    readerStatus.importId,
    readerStatus.sourceType,
    readerStatus.stage,
    selectedDriverId,
    selectedImportId,
  ]);

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

  const hasLinkedDriverTarget = Boolean(selectedDriverId || data?.identity.driverId);
  const isCandidateCard = Boolean(data?.isCandidateCard && !hasLinkedDriverTarget);
  const activeDriverId = isCandidateCard ? '' : selectedDriverId || data?.identity.driverId;
  const filteredDrivers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return drivers
      .filter((entry) => entry.role === 'driver')
      .filter((entry) => !query || entry.full_name.toLowerCase().includes(query) || entry.email.toLowerCase().includes(query))
      .map((entry) => ({ id: entry.id, label: entry.full_name || entry.email, meta: entry.email }));
  }, [drivers, searchValue]);

  const persistedFindings = data?.findings ?? EMPTY_FINDINGS;
  const restFindingRefresh = useMemo(
    () => data
      ? refreshRestFindingsFromActivityEvidence({
        persistedFindings,
        days: calendarSummaries,
        driverId: activeDriverId || data.identity.driverId || 'driver-card',
      })
      : { findings: persistedFindings, suppressedCount: 0, addedCount: 0 },
    [activeDriverId, calendarSummaries, data, persistedFindings]
  );
  const findings = restFindingRefresh.findings;
  const technicalEvents = data?.technicalEvents ?? EMPTY_FINDINGS;
  const reconciliation = data?.reconciliation ?? EMPTY_RECONCILIATION;
  const findingIds = useMemo(() => findings.map((finding) => finding.id), [findings]);
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
        setReviewError(error instanceof Error ? error.message : 'Unable to load finding reviews.');
      });

    return () => {
      cancelled = true;
    };
  }, [findingIds, profile?.company_id]);
  const dayReason = useMemo(() => {
    if (!selectedDay || !activeFocusedDate) return null;
    const sourceLabel = readerFocusedDate ? 'live card read' : 'review queue or alert';
    if (selectedDay.date !== activeFocusedDate) return `Opened from a ${sourceLabel} focused on ${format(new Date(`${activeFocusedDate}T12:00:00`), 'dd MMM yyyy')}. That day was not present in the current range, so the workspace fell back to the nearest loaded day.`;
    return `Opened from a ${sourceLabel} focused on ${format(new Date(`${activeFocusedDate}T12:00:00`), 'dd MMM yyyy')}.`;
  }, [activeFocusedDate, readerFocusedDate, selectedDay]);

  const timelineDays = useMemo(() => calendarSummaries.map((day) => {
    const legalFindingCount = findings.filter((finding) => finding.periodStart.slice(0, 10) <= day.date && finding.periodEnd.slice(0, 10) >= day.date).length;
    const linkedVuEventCount = technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= day.date && event.periodEnd.slice(0, 10) >= day.date).length;
    const crossCheckCount = reconciliation.filter((item) => item.date === day.date && item.status !== 'matched').length;

    return {
      date: new Date(day.date),
      activities: day.activities,
      markers: legalFindingCount + linkedVuEventCount + crossCheckCount,
      markerGroups: [
        { label: 'Findings', count: legalFindingCount, tone: 'danger' as const },
        { label: 'Linked VU', count: linkedVuEventCount, tone: 'warning' as const },
        { label: 'Cross-check', count: crossCheckCount, tone: 'warning' as const },
      ],
    };
  }), [calendarSummaries, findings, reconciliation, technicalEvents]);

  const trainingRecommendations = useMemo(() => buildTrainingRecommendations(findings, reconciliation), [findings, reconciliation]);
  const analysisSummary = useMemo(() => data ? buildAnalysisSummary(data.dailySummaries, findings, reconciliation) : null, [data, findings, reconciliation]);
  const displayMetrics = useMemo(() => data?.metrics.map((metric) => {
    if (metric.label.toLowerCase() !== 'findings') return metric;
    return {
      ...metric,
      value: String(findings.length),
      tone: findings.length > 0 ? 'danger' as const : 'good' as const,
    };
  }) ?? [], [data?.metrics, findings]);
  const selectedDayFindings = selectedDay
    ? findings.filter((finding) => finding.periodStart.slice(0, 10) <= selectedDay.date && finding.periodEnd.slice(0, 10) >= selectedDay.date)
    : [];
  const selectedDayEvents = selectedDay
    ? technicalEvents.filter((event) => event.periodStart.slice(0, 10) <= selectedDay.date && event.periodEnd.slice(0, 10) >= selectedDay.date)
    : [];
  const selectedDayReconciliation = selectedDay
    ? reconciliation.filter((item) => item.date === selectedDay.date && item.status !== 'matched')
    : [];
  const reviewPanelFindings = selectedDayFindings.length > 0 ? selectedDayFindings : findings.slice(0, 6);

  const handleAssignTraining = async (recommendation: TrainingRecommendation) => {
    if (!profile?.company_id || !profile.id || !activeDriverId) return;
    const companyId = profile.company_id;
    setAssigningTrainingId(recommendation.id);
    setTrainingAssignError(null);
    try {
      const trainingRecordId = crypto.randomUUID();
      const { error } = await supabase.from('training_records').insert({
        id: trainingRecordId,
        company_id: companyId,
        driver_id: activeDriverId,
        training_type: 'tacho_refresher',
        module_id: recommendation.moduleId,
        title: recommendation.title,
        hours_credited: 0,
        status: 'assigned',
        assigned_by: profile.id,
        notes: recommendation.reason,
      });

      if (error) throw error;

      const linkedReviews = await Promise.all(
        recommendation.findingIds.map(async (findingId) => {
          const finding = findings.find((entry) => entry.id === findingId);
          if (!finding) return null;
          const currentReview = findingReviews[findingId];
          return saveTachoFindingReview({
            companyId,
            findingId,
            status: 'action_required',
            managerNote: currentReview?.managerNote || recommendation.reason,
            correctiveActionType: 'training',
            correctiveActionRefId: trainingRecordId,
          });
        })
      );

      const savedReviews = linkedReviews.filter((review): review is TachoFindingReview => Boolean(review));
      if (savedReviews.length > 0) {
        setFindingReviews((current) => ({
          ...current,
          ...Object.fromEntries(savedReviews.map((review) => [review.findingId, review])),
        }));
      }

      setJustAssignedTrainingId(recommendation.id);
      setTimeout(() => setJustAssignedTrainingId(null), 2500);
    } catch (error) {
      setTrainingAssignError(error instanceof Error ? error.message : 'Unable to assign training.');
    } finally {
      setAssigningTrainingId(null);
    }
  };

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
      setReviewError(error instanceof Error ? error.message : 'Unable to save finding review.');
    } finally {
      setReviewPendingId(null);
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
      setReaderFocusedDate(null);
      setLiveReaderTargetActive(false);
      setCandidatePairDriverId('');
      setCandidateActionMessage(
        result.recoveredFromClientError
          ? `Paired card ${result.cardNumber} to ${result.driverName}. The backend update was confirmed after a transient response error.`
          : `Paired card ${result.cardNumber} to ${result.driverName}.`
      );
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
      const reviewPayload = {
        p_company_id: profile.company_id,
        p_import_id: candidateImportId,
        p_decision: decision,
        p_note: decision === 'no_hire'
          ? 'Candidate card check reviewed without creating an invite or driver profile.'
          : 'Candidate card check reviewed.',
      };
      const { error: reviewError } = await supabase.rpc('mark_tacho_candidate_card_review' as never, reviewPayload as never);
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

  const picker = (
    <CompactDriverWorkspaceTarget
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      selectedValue={selectedDriverId}
      onSelectChange={handleSelectDriver}
      options={filteredDrivers}
      fallbackLabel={selectedImportId ? 'Candidate / unlinked card check' : 'Latest imported driver card'}
    />
  );
  const readerPanel = <DriverCardReaderPanel workflow={readerWorkflow} onManualRefresh={handleManualReaderRefresh} onOpenImportCentre={onOpenImportCentre} />;

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
  const reportSnapshot = buildDriverCardReportSnapshot({
    data,
    days: calendarSummaries,
    findings,
    technicalEvents,
    reconciliation,
    periodLabel: analysisSummary?.periodLabel ?? 'No dated rows',
    isCandidateCard,
  });
  const handleExportCsv = () => exportDriverCardCsv(reportSnapshot);

  return (
    <div className="space-y-4">
      {picker}
      {readerPanel}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-blue-50 p-2.5"><CreditCard className="h-5 w-5 text-blue-600" /></div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isCandidateCard ? 'Candidate Card Check' : 'Driver Card Analysis'}</p>
                {isMock ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">Mock Fallback</span> : null}
                {isCandidateCard ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">Unlinked</span> : null}
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${statusTone}`}>{data.identity.downloadStatus.replace('_', ' ')}</span>
              </div>
              <h2 className="mt-1 text-xl font-black text-slate-900">{data.identity.driverName}</h2>
              <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                <span>Card: {data.identity.cardNumber}</span>
                <span>Expiry: {format(new Date(data.identity.cardExpiry), 'dd MMM yyyy')}</span>
                <span>Last Download: {format(new Date(data.identity.lastDownloadAt), 'dd MMM yyyy HH:mm')}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isCandidateCard ? (
              <>
                <ActionButton icon={<UserRound className="w-4 h-4" />} label="Personnel" disabled={!activeDriverId || !onOpenPersonnelFile} onClick={() => activeDriverId && onOpenPersonnelFile?.(activeDriverId)} />
                <ActionButton icon={<ShieldAlert className="w-4 h-4" />} label="Actions" disabled={!activeDriverId || !onOpenComplianceActions} onClick={() => activeDriverId && onOpenComplianceActions?.(activeDriverId)} />
                <ActionButton icon={<GraduationCap className="w-4 h-4" />} label="Training" disabled={!activeDriverId || !onOpenTraining} onClick={() => activeDriverId && onOpenTraining?.(activeDriverId)} />
              </>
            ) : null}
          <ActionButton icon={<Download className="w-4 h-4" />} label="Export CSV" onClick={handleExportCsv} />
          <ActionButton icon={<FileText className="w-4 h-4" />} label={reportOpen ? 'Hide Report' : 'Report View'} onClick={() => setReportOpen((current) => !current)} />
          </div>
        </div>
      </div>

      {reportOpen ? (
        <DriverCardReportPanel
          snapshot={reportSnapshot}
          onPrint={() => window.print()}
          onExportCsv={() => exportDriverCardCsv(reportSnapshot)}
        />
      ) : null}

      {restFindingRefresh.suppressedCount > 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950">
          Rest findings refreshed from the loaded activity evidence. {restFindingRefresh.suppressedCount} stale persisted rest finding{restFindingRefresh.suppressedCount === 1 ? '' : 's'} suppressed from this view and report; reprocess the import after deploying the parser to update stored database findings.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr),18rem]">
        <div className="min-w-0 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          {dayReason ? <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-950">{dayReason}</div> : null}
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{rangeLabel(range)} Calendar</p>
              <h3 className="text-xl font-black text-slate-900">Driver Card Activity By Day</h3>
              <p className="text-xs font-medium text-slate-500">The timeline is the primary review surface. Select a day for detail.</p>
            </div>
            <TachoFilters value={range} onChange={setRange} />
          </div>
          <TachoActivityTimeline days={timelineDays} selectedDate={selectedDay ? new Date(selectedDay.date) : undefined} onSelectDate={(date) => setSelectedDay(calendarSummaries.find((day) => day.date === date.toISOString().slice(0, 10)) ?? null)} />
        </div>

        <div className="space-y-3 2xl:sticky 2xl:top-4 2xl:self-start">
          <CompactInfoPanel title="Selected Day" icon={<BadgeAlert className="w-4 h-4 text-blue-600" />}>
            {selectedDay ? <StatList items={[`Driving: ${minsToHours(selectedDay.drivingMins)}`, `Work: ${minsToHours(selectedDay.workMins)}`, `POA: ${minsToHours(selectedDay.poaMins)}`, `Rest: ${minsToHours(selectedDay.restMins)}`]} /> : <p className="text-sm text-slate-500">Select a day in the timeline to inspect review context.</p>}
          </CompactInfoPanel>

          <CompactInfoPanel title="Cross-check" icon={<BadgeAlert className="w-4 h-4 text-amber-600" />}>
            {selectedDay ? <StatList items={[`Legal findings: ${selectedDayFindings.length}`, `Linked VU events: ${selectedDayEvents.length}`, `Cross-check issues: ${selectedDayReconciliation.length}`]} /> : <p className="text-sm text-slate-500">Select a day in the timeline to inspect review context.</p>}
          </CompactInfoPanel>

          <CompactProvisionalSummary
            periodLabel={analysisSummary?.periodLabel ?? 'No dated rows'}
            activityBlocks={data.activitySegments.length}
            issueCount={analysisSummary?.issueCount ?? 0}
            lastRead={format(new Date(data.identity.lastDownloadAt), 'dd MMM HH:mm')}
          />
        </div>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="cursor-pointer px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600">
          Timeline comparison and provisional parser details
        </summary>
        <div className="space-y-4 border-t border-slate-100 p-4">
          <TimelineComparisonStatus
            comparison={data.timelineComparison}
            contextLabel={isCandidateCard ? 'Candidate card timeline comparison' : 'Driver timeline comparison'}
          />
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
            HourWise read-only capture, not certified C1B/DDD output. These rows are for operational review and parser validation only.
          </p>
        </div>
      </details>

      {isCandidateCard ? (
        <CandidateCardActions
          candidateActionError={candidateActionError}
          candidateActionMessage={candidateActionMessage}
          candidateActionPending={candidateActionPending}
          candidatePairDriverId={candidatePairDriverId}
          filteredDrivers={filteredDrivers}
          onCandidatePairDriverChange={setCandidatePairDriverId}
          onCreateInvite={() => setInviteFromCandidateOpen(true)}
          onPair={() => void handlePairCandidateToDriver()}
          onMarkReviewed={() => void handleMarkCandidateReviewed('reviewed')}
          onMarkNoHire={() => void handleMarkCandidateReviewed('no_hire')}
          onOpenImportCentre={onOpenImportCentre}
          reportOpen={reportOpen}
          onToggleReport={() => setReportOpen((current) => !current)}
        />
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {displayMetrics.map((metric) => <MetricTile key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />)}
      </div>

      {!isCandidateCard ? (
        <TachoFindingReviewPanel
          findings={reviewPanelFindings}
          reviewsByFindingId={findingReviews}
          pendingFindingId={reviewPendingId}
          error={reviewError}
          selectedDay={selectedDay?.date ?? null}
          onSave={handleSaveFindingReview}
        />
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,1fr] gap-6">
        <InfoPanel title="Training / Action Follow-up" icon={<GraduationCap className="w-5 h-5 text-blue-600" />}>
            {trainingAssignError ? <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{trainingAssignError}</p> : null}
            {trainingRecommendations.length === 0 ? <p className="text-sm text-slate-500">No repeated tacho patterns currently map to a refresher recommendation for this selected range.</p> : (
              <div className="space-y-3">
                {trainingRecommendations.map((recommendation) => (
                  <div key={recommendation.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{recommendation.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{recommendation.reason}</p>
                        <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {recommendation.findingIds.length > 0 ? `Links ${recommendation.findingIds.length} finding review${recommendation.findingIds.length === 1 ? '' : 's'} to this training record` : 'Creates a driver training assignment'}
                        </p>
                      </div>
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

function refreshRestFindingsFromActivityEvidence(input: {
  persistedFindings: TachoFinding[];
  days: TachoDaySummary[];
  driverId: string;
}) {
  const explicitActivities = getUniqueDayActivities(input.days);
  const ruleActivities = buildRuleActivitiesFromReportEvidence(explicitActivities, input.driverId);
  if (ruleActivities.length === 0) {
    return { findings: input.persistedFindings, suppressedCount: 0, addedCount: 0 };
  }

  const refreshedRestFindings = evaluateDriverRules({
    driverId: input.driverId,
    activities: ruleActivities,
    vehicleId: ruleActivities[0]?.vehicleId ?? null,
    source: 'driver_card',
  }).findings.filter(isRestFinding);

  const filteredFindings = input.persistedFindings.filter((finding) => {
    if (!isRestFinding(finding)) return true;
    return refreshedRestFindings.some((refreshed) => sameRestFinding(finding, refreshed));
  });
  const existingRestFindings = filteredFindings.filter(isRestFinding);
  const addedRestFindings = refreshedRestFindings.filter(
    (finding) => !existingRestFindings.some((existing) => sameRestFinding(existing, finding))
  );
  const persistedRestCount = input.persistedFindings.filter(isRestFinding).length;

  return {
    findings: [...filteredFindings, ...addedRestFindings],
    suppressedCount: Math.max(0, persistedRestCount - existingRestFindings.length),
    addedCount: addedRestFindings.length,
  };
}

function buildRuleActivitiesFromReportEvidence(
  explicitActivities: TachoActivitySegment[],
  fallbackDriverId: string
): RuleActivitySegment[] {
  const inferredRestActivities: TachoActivitySegment[] = buildReportInferredRestSegments(explicitActivities).map((segment) => ({
    id: segment.id,
    source: 'driver_card',
    activityType: 'break_rest',
    driverId: fallbackDriverId,
    vehicleId: null,
    startTime: segment.start.toISOString(),
    endTime: segment.end.toISOString(),
    durationMins: differenceInMinutes(segment.end, segment.start),
    confidence: 'medium',
    label: segment.sourceLabel,
  }));

  return [...explicitActivities, ...inferredRestActivities]
    .filter((activity) => activity.activityType !== 'unknown')
    .filter((activity) => new Date(activity.endTime).getTime() > new Date(activity.startTime).getTime())
    .sort((left, right) => left.startTime.localeCompare(right.startTime))
    .map((activity): RuleActivitySegment => ({
      id: activity.id,
      driverId: activity.driverId ?? fallbackDriverId,
      vehicleId: activity.vehicleId ?? null,
      startTime: activity.startTime,
      endTime: activity.endTime,
      activityType:
        activity.activityType === 'break_rest'
          ? 'rest'
          : activity.activityType === 'unknown'
          ? 'work'
          : activity.activityType,
      distanceKm: activity.distanceKm ?? null,
      isManualEntry: activity.label === 'Manual entry',
      source: 'normalized_findings',
    }));
}

function isRestFinding(finding: TachoFinding) {
  return finding.ruleCode.startsWith('REST_');
}

function sameRestFinding(left: TachoFinding, right: TachoFinding) {
  if (left.id === right.id) return true;
  if (left.ruleCode !== right.ruleCode) return false;
  if (!sameTimestamp(left.occurredAt, right.occurredAt)) return false;
  if (!sameTimestamp(left.periodStart, right.periodStart)) return false;
  if (!sameTimestamp(left.periodEnd, right.periodEnd)) return false;

  const leftMeasured = left.metadata?.measuredMins;
  const rightMeasured = right.metadata?.measuredMins;
  if (typeof leftMeasured === 'number' && typeof rightMeasured === 'number') {
    return Math.abs(leftMeasured - rightMeasured) <= 1;
  }

  return true;
}

function sameTimestamp(left: string, right: string) {
  const leftMs = new Date(left).getTime();
  const rightMs = new Date(right).getTime();
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return left === right;
  return Math.abs(leftMs - rightMs) <= 60_000;
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

function buildDriverCardReportSnapshot(input: {
  data: DriverCardAnalysisData;
  days: TachoDaySummary[];
  findings: TachoFinding[];
  technicalEvents: TachoFinding[];
  reconciliation: TachoReconciliationItem[];
  periodLabel: string;
  isCandidateCard: boolean;
}): DriverCardReportSnapshot {
  const reconciliationIssues = input.reconciliation.filter((item) => item.status !== 'matched');
  const activities = getUniqueDayActivities(input.days);
  const activityTimeResolution = inferReportTimeResolution(activities);
  const isEf0504MinuteSource = activities.some((activity) => activity.label?.includes('EF 0504'));
  const totals = input.days.reduce(
    (acc, day) => ({
      drivingMins: acc.drivingMins + day.drivingMins,
      workMins: acc.workMins + day.workMins,
      poaMins: acc.poaMins + day.poaMins,
      restMins: acc.restMins + day.restMins,
      activityBlocks: acc.activityBlocks + day.activities.length,
      loadedDays: acc.loadedDays + (day.activities.length > 0 ? 1 : 0),
    }),
    { drivingMins: 0, workMins: 0, poaMins: 0, restMins: 0, activityBlocks: 0, loadedDays: 0 }
  );
  const highSeverity = input.findings.filter((finding) => finding.severity === 'critical' || finding.severity === 'high').length;
  const warnings = input.findings.filter((finding) => finding.status === 'warning').length;

  return {
    title: input.isCandidateCard ? 'Candidate Driver Card Screening Report' : 'Driver Card Analysis Report',
    kindLabel: input.isCandidateCard ? 'Candidate / unlinked card' : 'Linked driver card',
    driverName: input.data.identity.driverName,
    cardNumber: input.data.identity.cardNumber,
    cardExpiry: input.data.identity.cardExpiry,
    issuingCountry: input.data.identity.issuingCountry,
    lastDownloadAt: input.data.identity.lastDownloadAt,
    downloadStatus: input.data.identity.downloadStatus.replace('_', ' '),
    periodLabel: input.periodLabel,
    generatedAt: new Date().toISOString(),
    caveat: 'HourWise read-only capture and provisional parser output. Use for operational review and validation; do not present as certified C1B/DDD output until the certified export/parser path is complete.',
    activityTimeResolution,
    activityTimeResolutionLabel: activityTimeResolution === 'second'
      ? '1 second'
      : isEf0504MinuteSource
      ? '1 minute (driver-card EF 0504)'
      : '1 minute (observed source data)',
    activityTimeResolutionNote: isEf0504MinuteSource
      ? 'Driver-card ActivityChangeInfo records one activity state per calendar minute. Seconds are not present in EF 0504 and cannot be reconstructed; displayed :00 values are minute boundaries, not second-level evidence.'
      : activityTimeResolution === 'second'
      ? 'At least one supplied activity boundary contains second-level source data.'
      : 'All supplied activity boundaries are minute-aligned; no sub-minute source timestamps were available.',
    totals,
    issueCounts: {
      findings: input.findings.length,
      highSeverity,
      warnings,
      technicalEvents: input.technicalEvents.length,
      reconciliationIssues: reconciliationIssues.length,
    },
    days: input.days,
    findings: input.findings,
    technicalEvents: input.technicalEvents,
    reconciliationIssues,
  };
}

function exportDriverCardCsv(snapshot: DriverCardReportSnapshot) {
  const explicitActivities = getSnapshotActivities(snapshot);
  const blockRows = snapshot.days.flatMap((day) =>
    buildReportVisibleDaySegments(day.date, explicitActivities).map((segment, index) => [
      day.date,
      String(index + 1),
      segment.inferred ? 'inferred_rest_off_card_gap' : segment.activityType,
      format(segment.start, 'HH:mm:ss'),
      format(segment.end, 'HH:mm:ss'),
      formatDurationSeconds(segment.durationSeconds),
      String(segment.durationSeconds),
      segment.inferred ? 'Inferred from off-card gap between parsed card activities' : 'Parsed tachograph activity segment',
      segment.sourceLabel,
      overlappingFindingCodes(snapshot.findings, segment.start, segment.end),
    ])
  );
  const rows = [
    ['HourWise Driver Card Report'],
    ['Generated', format(new Date(snapshot.generatedAt), 'dd MMM yyyy HH:mm')],
    ['Report type', snapshot.kindLabel],
    ['Driver/card holder', snapshot.driverName],
    ['Card number', snapshot.cardNumber],
    ['Card expiry', snapshot.cardExpiry],
    ['Last download', snapshot.lastDownloadAt],
    ['Period', snapshot.periodLabel],
    ['Activity time resolution', snapshot.activityTimeResolutionLabel],
    ['Activity time resolution note', snapshot.activityTimeResolutionNote],
    ['Caveat', snapshot.caveat],
    [],
    ['Daily totals'],
    ['Date', 'Driving', 'Work', 'POA', 'Rest', 'Findings', 'Activity blocks'],
    ...snapshot.days.map((day) => [
      day.date,
      minsToHours(day.drivingMins),
      minsToHours(day.workMins),
      minsToHours(day.poaMins),
      minsToHours(day.restMins),
      String(day.findingsCount),
      String(day.activities.length),
    ]),
    [],
    [`Daily activity blocks (source resolution: ${snapshot.activityTimeResolutionLabel})`],
    ['Date', 'Block', 'Activity', 'Start (recorded HH:mm:ss)', 'End (recorded HH:mm:ss)', 'Recorded duration (HH:mm:ss)', 'Calculated duration seconds', 'Evidence', 'Source / label', 'Overlapping finding rules'],
    ...blockRows,
    [],
    ['Findings'],
    ['Severity', 'Status', 'Rule', 'Title', 'Period start', 'Period end', 'Summary'],
    ...snapshot.findings.map((finding) => [
      finding.severity,
      finding.status,
      finding.ruleCode,
      finding.title,
      finding.periodStart,
      finding.periodEnd,
      finding.summary,
    ]),
    [],
    ['App vs tacho cross-check'],
    ['Date', 'Status', 'App', 'Tacho', 'Summary'],
    ...snapshot.reconciliationIssues.map((item) => [
      item.date,
      item.status,
      item.appLabel,
      item.tachoLabel,
      item.summary,
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${snapshot.driverName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'driver-card'}-tachograph-report.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function DriverCardReportPanel({
  snapshot,
  onPrint,
  onExportCsv,
}: {
  snapshot: DriverCardReportSnapshot;
  onPrint: () => void;
  onExportCsv: () => void;
}) {
  const topFindings = snapshot.findings.slice(0, 6);
  const topReconciliation = snapshot.reconciliationIssues.slice(0, 6);
  const reportDays = snapshot.days.filter((day) => day.activities.length > 0 || buildReportVisibleDaySegments(day.date, getSnapshotActivities(snapshot)).length > 0 || day.findingsCount > 0);

  return (
    <section className="rounded-3xl border border-slate-300 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Manager Report</p>
          <h3 className="mt-1 text-2xl font-black text-slate-950">{snapshot.title}</h3>
          <p className="mt-2 max-w-4xl text-sm font-medium text-slate-600">
            {snapshot.kindLabel} covering {snapshot.periodLabel}. Generated {format(new Date(snapshot.generatedAt), 'dd MMM yyyy HH:mm')}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100"
          >
            <Download className="h-4 w-4" />
            Export Evidence CSV
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-800"
          >
            <FileText className="h-4 w-4" />
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
        {snapshot.caveat}
      </div>

      <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-950">
        Activity time resolution: {snapshot.activityTimeResolutionLabel}. {snapshot.activityTimeResolutionNote}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-4">
        <ReportFact label="Driver / holder" value={snapshot.driverName} />
        <ReportFact label="Card number" value={snapshot.cardNumber} />
        <ReportFact label="Card expiry" value={format(new Date(snapshot.cardExpiry), 'dd MMM yyyy')} />
        <ReportFact label="Download status" value={snapshot.downloadStatus} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <ReportMetric label="Driving" value={minsToHours(snapshot.totals.drivingMins)} />
        <ReportMetric label="Work" value={minsToHours(snapshot.totals.workMins)} />
        <ReportMetric label="POA" value={minsToHours(snapshot.totals.poaMins)} />
        <ReportMetric label="Rest" value={minsToHours(snapshot.totals.restMins)} />
        <ReportMetric label="Findings" value={String(snapshot.issueCounts.findings)} tone={snapshot.issueCounts.highSeverity > 0 ? 'danger' : 'neutral'} />
        <ReportMetric label="Cross-check" value={String(snapshot.issueCounts.reconciliationIssues)} tone={snapshot.issueCounts.reconciliationIssues > 0 ? 'warning' : 'neutral'} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ReportList
          title="Priority Findings"
          empty="No findings were returned in this range."
          items={topFindings.map((finding) => ({
            id: finding.id,
            heading: `${finding.severity.toUpperCase()} - ${finding.title}`,
            detail: `${format(new Date(finding.periodStart), 'dd MMM HH:mm')} - ${finding.summary}`,
          }))}
        />
        <ReportList
          title="App Vs Tacho Cross-check"
          empty="No app-vs-tacho issues were returned in this range."
          items={topReconciliation.map((item) => ({
            id: item.id,
            heading: `${formatReconciliationStatus(item.status)} - ${item.date}`,
            detail: item.summary,
          }))}
        />
      </div>

      <ReportActivityEvidence days={reportDays} snapshot={snapshot} />

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Driving</th>
              <th className="px-4 py-3 text-right">Work</th>
              <th className="px-4 py-3 text-right">POA</th>
              <th className="px-4 py-3 text-right">Rest</th>
              <th className="px-4 py-3 text-right">Blocks</th>
              <th className="px-4 py-3 text-right">Findings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {snapshot.days.filter((day) => day.activities.length > 0 || day.findingsCount > 0).slice(0, 14).map((day) => (
              <tr key={day.date}>
                <td className="px-4 py-3 font-bold text-slate-800">{format(new Date(`${day.date}T12:00:00`), 'dd MMM yyyy')}</td>
                <td className="px-4 py-3 text-right text-slate-600">{minsToHours(day.drivingMins)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{minsToHours(day.workMins)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{minsToHours(day.poaMins)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{minsToHours(day.restMins)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{day.activities.length}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{day.findingsCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type ReportVisibleSegment = {
  id: string;
  activityType: TachoActivitySegment['activityType'];
  start: Date;
  end: Date;
  leftPercent: number;
  widthPercent: number;
  durationSeconds: number;
  inferred: boolean;
  sourceLabel: string;
};

function getUniqueDayActivities(days: TachoDaySummary[]) {
  const bySignature = new Map<string, TachoActivitySegment>();

  days.flatMap((day) => day.activities).forEach((activity) => {
    bySignature.set(activitySignature(activity), activity);
  });

  return Array.from(bySignature.values())
    .filter((activity) => new Date(activity.endTime).getTime() > new Date(activity.startTime).getTime())
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
}

function getSnapshotActivities(snapshot: DriverCardReportSnapshot) {
  return getUniqueDayActivities(snapshot.days);
}

function buildReportVisibleDaySegments(dayDate: string, explicitActivities: TachoActivitySegment[]): ReportVisibleSegment[] {
  const dayStart = new Date(`${dayDate}T00:00:00.000Z`);
  const dayEnd = addDays(dayStart, 1);
  const totalMillisecondsInDay = dayEnd.getTime() - dayStart.getTime();
  const sourceSegments = [
    ...explicitActivities.map((activity) => ({
      id: activity.id,
      activityType: activity.activityType,
      start: new Date(activity.startTime),
      end: new Date(activity.endTime),
      inferred: false,
      sourceLabel: activity.label ?? activity.source,
    })),
    ...buildReportInferredRestSegments(explicitActivities),
  ];

  return sourceSegments
    .map((segment) => {
      const start = new Date(Math.max(segment.start.getTime(), dayStart.getTime()));
      const end = new Date(Math.min(segment.end.getTime(), dayEnd.getTime()));
      const durationSeconds = durationSecondsBetween(start, end);
      if (durationSeconds <= 0) return null;

      return {
        id: `${segment.id}-${dayDate}-${start.getTime()}`,
        activityType: segment.activityType,
        start,
        end,
        leftPercent: ((start.getTime() - dayStart.getTime()) / totalMillisecondsInDay) * 100,
        widthPercent: ((end.getTime() - start.getTime()) / totalMillisecondsInDay) * 100,
        durationSeconds,
        inferred: segment.inferred,
        sourceLabel: segment.sourceLabel,
      };
    })
    .filter((segment): segment is ReportVisibleSegment => Boolean(segment))
    .sort((left, right) => left.start.getTime() - right.start.getTime());
}

function buildReportInferredRestSegments(explicitActivities: TachoActivitySegment[]) {
  const minimumRestGapMins = 15;
  const inferred: Array<{
    id: string;
    activityType: TachoActivitySegment['activityType'];
    start: Date;
    end: Date;
    inferred: true;
    sourceLabel: string;
  }> = [];

  for (let index = 0; index < explicitActivities.length - 1; index += 1) {
    const current = explicitActivities[index];
    const next = explicitActivities[index + 1];
    const currentEnd = new Date(current.endTime);
    const nextStart = new Date(next.startTime);
    const gapMins = differenceInMinutes(nextStart, currentEnd);
    if (gapMins < minimumRestGapMins) continue;

    inferred.push({
      id: `inferred-rest-${current.id}-${next.id}`,
      activityType: 'break_rest',
      start: currentEnd,
      end: nextStart,
      inferred: true,
      sourceLabel: 'Inferred off-card rest gap',
    });
  }

  return inferred;
}

function ReportActivityEvidence({ days, snapshot }: { days: TachoDaySummary[]; snapshot: DriverCardReportSnapshot }) {
  const explicitActivities = getSnapshotActivities(snapshot);

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 print:break-inside-avoid">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-slate-600">Daily Activity Evidence</h4>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Visual 24-hour activity strips. Grey hashed blocks are inferred off-card rest gaps between parsed card activities.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Driving', bg: 'bg-emerald-500' },
            { label: 'Other work', bg: 'bg-amber-400' },
            { label: 'Availability', bg: 'bg-blue-400' },
            { label: 'Rest / break', bg: 'bg-slate-300' },
            { label: 'Inferred rest', bg: 'bg-slate-300/80', inferred: true },
          ].map(({ label, bg, inferred }) => (
            <span key={label} className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <span className={`h-3 w-3 rounded-sm ${bg}`} style={inferred ? inferredRestPatternStyle : undefined} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[8rem,1fr,7rem] items-center gap-2 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span>Day</span>
        <div className="relative h-4">
          {[0, 4, 8, 12, 16, 20, 24].map((hour) => (
            <span
              key={hour}
              className={`absolute top-0 ${hour === 24 ? '-translate-x-full' : '-translate-x-1/2'}`}
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              {hour.toString().padStart(2, '0')}:00
            </span>
          ))}
        </div>
        <span className="text-right">Evidence</span>
      </div>

      <div className="mt-2 space-y-2">
        {days.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-500">No activity blocks were available for this report period.</p>
        ) : (
          days.map((day) => (
            <ReportActivityDayRow
              key={day.date}
              day={day}
              segments={buildReportVisibleDaySegments(day.date, explicitActivities)}
              findings={snapshot.findings}
              reconciliation={snapshot.reconciliationIssues}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ReportActivityDayRow({
  day,
  segments,
  findings,
  reconciliation,
}: {
  day: TachoDaySummary;
  segments: ReportVisibleSegment[];
  findings: TachoFinding[];
  reconciliation: TachoReconciliationItem[];
}) {
  const dayFindings = findings.filter((finding) => finding.periodStart.slice(0, 10) <= day.date && finding.periodEnd.slice(0, 10) >= day.date);
  const dayReconciliation = reconciliation.filter((item) => item.date === day.date);

  return (
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 lg:grid-cols-[8rem,1fr,7rem] lg:items-center print:break-inside-avoid">
      <div>
        <p className="text-sm font-black text-slate-900">{format(new Date(`${day.date}T12:00:00`), 'EEE d MMM')}</p>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
          {day.activities.length} parsed block{day.activities.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="relative h-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        {[0, 4, 8, 12, 16, 20].map((hour) => (
          <div
            key={`${day.date}-${hour}`}
            className="absolute bottom-0 top-0 border-l border-slate-300/40"
            style={{ left: `${(hour / 24) * 100}%` }}
          />
        ))}
        {segments.map((segment) => (
          <div
            key={segment.id}
            title={`${segment.inferred ? 'Inferred rest' : reportActivityLabel(segment.activityType)} ${format(segment.start, 'HH:mm:ss')} - ${format(segment.end, 'HH:mm:ss')} (${formatDurationSeconds(segment.durationSeconds)})`}
            className={`absolute inset-y-0 ${reportActivityClass(segment.activityType, segment.inferred)}`}
            style={{
              left: `${segment.leftPercent}%`,
              width: `${segment.widthPercent}%`,
              ...(segment.inferred ? inferredRestPatternStyle : {}),
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1 lg:justify-end">
        {dayFindings.length > 0 ? (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-rose-700">
            F: {dayFindings.length}
          </span>
        ) : null}
        {dayReconciliation.length > 0 ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700">
            X: {dayReconciliation.length}
          </span>
        ) : null}
        {dayFindings.length === 0 && dayReconciliation.length === 0 ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500">Clear</span>
        ) : null}
      </div>
    </div>
  );
}

const inferredRestPatternStyle: CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(45deg, rgba(148,163,184,0.9) 0, rgba(148,163,184,0.9) 6px, rgba(203,213,225,0.9) 6px, rgba(203,213,225,0.9) 12px)',
};

function reportActivityLabel(type: TachoActivitySegment['activityType']) {
  switch (type) {
    case 'driving':
      return 'Driving';
    case 'work':
      return 'Other work';
    case 'poa':
      return 'Availability';
    case 'break_rest':
      return 'Rest / break';
    default:
      return 'Unknown';
  }
}

function reportActivityClass(type: TachoActivitySegment['activityType'], inferred: boolean) {
  if (inferred) return 'bg-slate-300/80 report-inferred-rest';
  switch (type) {
    case 'driving':
      return 'bg-emerald-500';
    case 'work':
      return 'bg-amber-400';
    case 'poa':
      return 'bg-blue-400';
    case 'break_rest':
      return 'bg-slate-300';
    default:
      return 'bg-slate-200';
  }
}

function overlappingFindingCodes(findings: TachoFinding[], start: Date, end: Date) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const codes = findings
    .filter((finding) => {
      const findingStartMs = new Date(finding.periodStart).getTime();
      const findingEndMs = new Date(finding.periodEnd).getTime();
      return findingStartMs < endMs && findingEndMs > startMs;
    })
    .map((finding) => finding.ruleCode);

  return [...new Set(codes)].join('; ');
}

function ReportFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function ReportMetric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'warning' | 'danger' }) {
  const styles = {
    neutral: 'border-slate-200 bg-white text-slate-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-rose-200 bg-rose-50 text-rose-800',
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function ReportList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ id: string; heading: string; detail: string }>;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-600">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-3 text-sm font-medium text-slate-500">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-black text-slate-900">{item.heading}</p>
              <p className="mt-1 text-xs font-medium text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatReconciliationStatus(status: TachoReconciliationItem['status']) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildTrainingRecommendations(findings: TachoFinding[], reconciliation: TachoReconciliationItem[]): TrainingRecommendation[] {
  const items: TrainingRecommendation[] = [];
  const breakFindings = findings.filter((finding) => ['DRV_CONTINUOUS_4H30_EXCEEDED', 'WTD_BREAK_AFTER_6H_MISSING', 'WTD_BREAK_AFTER_9H_MISSING'].includes(finding.ruleCode));
  const restFindings = findings.filter((finding) => finding.ruleCode.startsWith('REST_') || finding.ruleCode.startsWith('DRV_WEEKLY_'));
  const mismatches = reconciliation.filter((item) => item.status !== 'matched');
  if (breakFindings.length >= 2) items.push({ id: 'breaks', moduleId: 'tacho-modes', title: 'Tachograph Mode Switching', reason: `${breakFindings.length} repeated break or mode-linked findings were returned in the selected range.`, findingIds: breakFindings.map((finding) => finding.id) });
  if (restFindings.length >= 2) items.push({ id: 'hours', moduleId: 'eu-hours', title: "EU Drivers' Hours Rules", reason: `${restFindings.length} hours or rest findings need a refresher on legal limits and recovery rules.`, findingIds: restFindings.map((finding) => finding.id) });
  if (mismatches.length >= 2) items.push({ id: 'cross-check', moduleId: 'tacho-modes', title: 'App Vs Tacho Record Discipline', reason: `${mismatches.length} cross-check mismatches indicate repeated app-vs-tacho alignment issues.`, findingIds: [] });
  return items;
}

function CompactDriverWorkspaceTarget({
  searchValue,
  onSearchChange,
  selectedValue,
  onSelectChange,
  options,
  fallbackLabel,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedValue: string;
  onSelectChange: (value: string) => void;
  options: Array<{ id: string; label: string; meta?: string }>;
  fallbackLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(16rem,0.8fr),minmax(22rem,1.2fr),auto] xl:items-end">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Driver workspace target</p>
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search drivers"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white"
          />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Open driver</p>
          <select
            value={selectedValue}
            onChange={(event) => onSelectChange(event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-300"
          >
            <option value="">{fallbackLabel}</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}{option.meta ? ` - ${option.meta}` : ''}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs font-bold text-slate-500 xl:pb-2">{options.length} matching options</p>
      </div>
    </div>
  );
}

function CompactInfoPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function CompactProvisionalSummary({
  periodLabel,
  activityBlocks,
  issueCount,
  lastRead,
}: {
  periodLabel: string;
  activityBlocks: number;
  issueCount: number;
  lastRead: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-950 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Provisional Reader Result</p>
      <p className="mt-1 text-xs font-bold">Read-only capture, not certified C1B/DDD.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <MiniFact label="Period" value={periodLabel} />
        <MiniFact label="Blocks" value={String(activityBlocks)} />
        <MiniFact label="Issues" value={String(issueCount)} />
        <MiniFact label="Last read" value={lastRead} />
      </div>
    </div>
  );
}

function CandidateCardActions({
  candidateActionError,
  candidateActionMessage,
  candidateActionPending,
  candidatePairDriverId,
  filteredDrivers,
  onCandidatePairDriverChange,
  onCreateInvite,
  onPair,
  onMarkReviewed,
  onMarkNoHire,
  onOpenImportCentre,
  reportOpen,
  onToggleReport,
}: {
  candidateActionError: string | null;
  candidateActionMessage: string | null;
  candidateActionPending: string | null;
  candidatePairDriverId: string;
  filteredDrivers: Array<{ id: string; label: string; meta?: string }>;
  onCandidatePairDriverChange: (value: string) => void;
  onCreateInvite: () => void;
  onPair: () => void;
  onMarkReviewed: () => void;
  onMarkNoHire: () => void;
  onOpenImportCentre?: () => void;
  reportOpen: boolean;
  onToggleReport: () => void;
}) {
  return (
    <details className="rounded-2xl border border-blue-200 bg-blue-50 shadow-sm">
      <summary className="cursor-pointer px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-800">
        Candidate / pre-employment actions
      </summary>
      <div className="space-y-3 border-t border-blue-100 p-4">
        <p className="text-sm font-semibold text-blue-950">
          This card is not linked to a profile or invite. Pair it to an existing driver or create an invite only after review.
        </p>
        {candidateActionError ? <div className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700">{candidateActionError}</div> : null}
        {candidateActionMessage ? <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700">{candidateActionMessage}</div> : null}
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr),auto]">
          <select
            value={candidatePairDriverId}
            onChange={(event) => onCandidatePairDriverChange(event.target.value)}
            className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
          >
            <option value="">Select existing driver profile</option>
            {filteredDrivers.map((driver) => (
              <option key={driver.id} value={driver.id}>{driver.label} - {driver.meta}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!candidatePairDriverId || candidateActionPending === 'pair'}
            onClick={onPair}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {candidateActionPending === 'pair' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Pair Card
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={<UserPlus className="w-4 h-4" />} label="Create Invite" onClick={onCreateInvite} />
          <ActionButton icon={<CheckCircle2 className="w-4 h-4" />} label={candidateActionPending === 'reviewed' ? 'Marking Reviewed' : 'Mark Reviewed'} disabled={candidateActionPending !== null} onClick={onMarkReviewed} />
          <ActionButton icon={<ShieldAlert className="w-4 h-4" />} label={candidateActionPending === 'no_hire' ? 'Marking No Hire' : 'Checked / No Hire'} disabled={candidateActionPending !== null} onClick={onMarkNoHire} />
          <ActionButton icon={<CreditCard className="w-4 h-4" />} label="Import Review" disabled={!onOpenImportCentre} onClick={() => onOpenImportCentre?.()} />
          <ActionButton icon={<FileText className="w-4 h-4" />} label={reportOpen ? 'Hide Report' : 'Screening Report'} onClick={onToggleReport} />
        </div>
      </div>
    </details>
  );
}

function DriverCardReaderPanel({
  workflow,
  onManualRefresh,
  onOpenImportCentre,
}: {
  workflow: ReturnType<typeof useTachoReaderWorkflow>;
  onManualRefresh: () => void;
  onOpenImportCentre?: () => void;
}) {
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
  const canReadAgainFromComplete = status.stage === 'complete' && Boolean(status.cardPresent) && Boolean(status.readerConnected);
  const canManualStart = (status.canStartRead || canReadAgainFromComplete) && !workflow.commandPending && !workflow.importPending;

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${tone}`}>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr),auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl bg-white/80 p-2 shadow-sm">
              <Laptop className="h-4 w-4 text-blue-700" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live driver card reader</p>
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
              {status.stage.replace(/_/g, ' ')}
            </span>
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
              {status.progressPercent}%
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr),22rem] xl:items-center">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-slate-950">{status.headline}</h3>
              <p className="truncate text-xs font-medium text-slate-700">{status.detail}</p>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
                <span>Read / import progress</span>
                <span>{status.progressPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/80">
                <div
                  className={`h-2 rounded-full transition-all ${status.stage === 'error' ? 'bg-rose-500' : status.stage === 'complete' ? 'bg-emerald-500' : 'bg-blue-700'}`}
                  style={{ width: `${status.progressPercent}%` }}
                />
              </div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
            <span className="rounded-full bg-white/80 px-2.5 py-1">Reader: {status.readerConnected ? status.readerDeviceName ?? 'Connected' : 'Not detected'}</span>
            <span className="rounded-full bg-white/80 px-2.5 py-1">Card: {status.cardPresent ? 'Inserted' : 'Not inserted'}</span>
            <span className="rounded-full bg-white/80 px-2.5 py-1">Import: {status.importId ? 'Ready' : 'Waiting'}</span>
            {status.lastHeartbeatAt ? <span className="rounded-full bg-white/80 px-2.5 py-1">Seen {new Date(status.lastHeartbeatAt).toLocaleTimeString('en-GB')}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button
            type="button"
            onClick={onManualRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${workflow.refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void workflow.sendCommand('start-read')}
            disabled={!canManualStart}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {workflow.commandPending === 'start-read' || workflow.importPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {status.stage === 'card_inserted' ? 'Auto Reading' : status.stage === 'complete' ? 'Read Again' : 'Read Card'}
          </button>
          <button
            type="button"
            onClick={() => void workflow.sendCommand('cancel')}
            disabled={!canCancel}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onOpenImportCentre}
            disabled={!onOpenImportCentre}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Manual Import
          </button>
        </div>
      </div>

      {status.exportParserReady === false ? (
        <div className="mt-3 rounded-xl border border-amber-300 bg-white/70 px-3 py-2 text-xs font-medium text-amber-950">
          This is a provisional HourWise read-only capture. It can be displayed for review, but it is not certified C1B/DDD output yet.
        </div>
      ) : null}

      {workflow.lastError || workflow.commandMessage || workflow.importMessage ? (
        <div className="mt-3 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-xs font-medium text-slate-700">
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
function MiniFact({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-amber-200 bg-white/70 px-2 py-2"><p className="text-[9px] font-black uppercase tracking-widest text-amber-700">{label}</p><p className="mt-0.5 text-xs font-black text-amber-950">{value}</p></div>; }
function InfoPanel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) { return <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"><div className="flex items-center gap-2 mb-4">{icon}<h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{title}</h3></div>{children}</div>; }
function StatList({ items }: { items: string[] }) { return <div className="space-y-2">{items.map((item) => <div key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{item}</div>)}</div>; }
function BlankDriverCardWorkspace({ range, onRangeChange, timelineDays, title, guidance }: { range: TachoAnalysisRange; onRangeChange: (range: TachoAnalysisRange) => void; timelineDays: TimelineDay[]; title: string; guidance: string }) { return <div className="space-y-4"><div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{rangeLabel(range)} Calendar</p><h3 className="text-xl font-black text-slate-900">Blank Driver Card Workspace</h3><p className="text-xs font-medium text-slate-500">The calendar remains ready for the next inserted card. Parsed days will replace this blank state after a successful read/import.</p></div><TachoFilters value={range} onChange={onRangeChange} /></div><TachoActivityTimeline days={timelineDays} /></div><div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"><p className="font-black">{title}</p><p className="mt-1 font-medium">{guidance}</p></div></div>; }
