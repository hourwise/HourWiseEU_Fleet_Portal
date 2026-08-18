import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BellRing, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, Loader2, LogOut, MapPin, RefreshCw, Truck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  acknowledgeTachoFindingReview,
  fetchMyTachoFindingReviews,
  type TachoFindingReviewEvent,
  fetchTachoFindingReviewEvents,
} from '../../lib/tacho/api';
import { fetchDriverUpcomingShifts, type DriverUpcomingShift } from '../../lib/rota';
import { acknowledgeDriverOperationalEvent, fetchDriverOperationalEvents, type DriverOperationalEvent } from '../../lib/driverEvents';
import { fetchDriverJobAssignments, fetchDriverVehicleActions, transitionDriverJobAssignment, type DriverJobAssignment, type DriverJobStatus, type DriverVehicleAction } from '../../lib/driverJobs';
import { fetchJobEvidence, uploadJobEvidence, type JobEvidenceOutcome, type JobEvidenceRecord } from '../../lib/jobEvidence';
import type { TachoFindingReview } from '../../lib/tacho/rules/types';

type PendingNoteByReviewId = Record<string, string>;

export function DriverDashboard() {
  const { profile, signOut } = useAuth();
  const [reviews, setReviews] = useState<TachoFindingReview[]>([]);
  const [events, setEvents] = useState<Record<string, TachoFindingReviewEvent[]>>({});
  const [upcomingShifts, setUpcomingShifts] = useState<DriverUpcomingShift[]>([]);
  const [jobs, setJobs] = useState<DriverJobAssignment[]>([]);
  const [vehicleActions, setVehicleActions] = useState<DriverVehicleAction[]>([]);
  const [operationalEvents, setOperationalEvents] = useState<DriverOperationalEvent[]>([]);
  const [notes, setNotes] = useState<PendingNoteByReviewId>({});
  const [loading, setLoading] = useState(true);
  const [rotaLoading, setRotaLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rotaError, setRotaError] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [vehicleActionsError, setVehicleActionsError] = useState<string | null>(null);
  const [operationalEventsError, setOperationalEventsError] = useState<string | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [acknowledgingEventId, setAcknowledgingEventId] = useState<string | null>(null);
  const [transitioningJobId, setTransitioningJobId] = useState<string | null>(null);

  const loadReviews = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);

    try {
      const loadedReviews = await fetchMyTachoFindingReviews();
      setReviews(loadedReviews);

      const companyId = profile?.company_id;
      if (companyId && loadedReviews.length > 0) {
        const loadedEvents = await fetchTachoFindingReviewEvents(companyId, loadedReviews.map((review) => review.id));
        setEvents(groupEventsByReviewId(loadedEvents));
      } else {
        setEvents({});
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load tachograph reviews.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadRota = async () => {
    if (!profile?.id) {
      setUpcomingShifts([]);
      setRotaLoading(false);
      return;
    }

    setRotaLoading(true);
    setRotaError(null);

    try {
      const shifts = await fetchDriverUpcomingShifts(profile.id);
      setUpcomingShifts(shifts);
      try {
        setJobs(await fetchDriverJobAssignments(profile.id, shifts.map((shift) => shift.id)));
        setJobsError(null);
      } catch (jobError) {
        setJobsError(jobError instanceof Error ? jobError.message : 'Unable to load assigned jobs.');
      }
    } catch (loadError) {
      setRotaError(loadError instanceof Error ? loadError.message : 'Unable to load upcoming shifts.');
    } finally {
      setRotaLoading(false);
    }
  };

  const loadVehicleActions = async () => {
    if (!profile?.id) {
      setVehicleActions([]);
      setVehicleActionsError(null);
      return;
    }
    setVehicleActionsError(null);
    try {
      setVehicleActions(await fetchDriverVehicleActions(profile.id));
    } catch (loadError) {
      setVehicleActionsError(loadError instanceof Error ? loadError.message : 'Unable to load vehicle check actions.');
    }
  };

  const loadOperationalEvents = async () => {
    if (!profile?.id) {
      setOperationalEvents([]);
      setEventsLoading(false);
      return;
    }
    setEventsLoading(true);
    setOperationalEventsError(null);
    try {
      setOperationalEvents(await fetchDriverOperationalEvents(profile.id));
    } catch (loadError) {
      setOperationalEventsError(loadError instanceof Error ? loadError.message : 'Unable to load operational events.');
    } finally {
      setEventsLoading(false);
    }
  };

  const refreshDashboard = async () => {
    setRefreshing(true);
    await Promise.all([loadReviews('refresh'), loadRota(), loadOperationalEvents(), loadVehicleActions()]);
    setRefreshing(false);
  };

  useEffect(() => {
    void loadReviews();
    void loadRota();
    void loadOperationalEvents();
    void loadVehicleActions();
    // Driver dashboard is profile-scoped; reload when the signed-in driver changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const outstandingReviews = useMemo(
    () => reviews.filter((review) => !review.driverAcknowledgedAt && review.status !== 'open'),
    [reviews]
  );
  const openReviews = useMemo(
    () => reviews.filter((review) => !review.driverAcknowledgedAt && review.status === 'open'),
    [reviews]
  );
  const acknowledgedReviews = useMemo(
    () => reviews.filter((review) => Boolean(review.driverAcknowledgedAt)),
    [reviews]
  );
  const todayShifts = useMemo(
    () => upcomingShifts.filter((shift) => shift.date === formatDateOnly(new Date())),
    [upcomingShifts]
  );
  const outstandingOperationalEvents = useMemo(
    () => operationalEvents.filter((event) => event.requiresAck && !event.acknowledgedAt),
    [operationalEvents]
  );
  const todayJobs = useMemo(() => jobs.filter((job) => todayShifts.some((shift) => shift.id === job.shiftId)), [jobs, todayShifts]);

  const handleAcknowledge = async (review: TachoFindingReview) => {
    setAcknowledgingId(review.id);
    setError(null);
    try {
      const updated = await acknowledgeTachoFindingReview({
        reviewId: review.id,
        note: notes[review.id] ?? null,
      });
      setReviews((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setNotes((current) => ({ ...current, [review.id]: '' }));
      await loadReviews('refresh');
    } catch (ackError) {
      setError(ackError instanceof Error ? ackError.message : 'Unable to acknowledge this review.');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleAcknowledgeOperationalEvent = async (event: DriverOperationalEvent) => {
    if (!profile?.id) return;
    setAcknowledgingEventId(event.id);
    setOperationalEventsError(null);
    try {
      await acknowledgeDriverOperationalEvent(event, profile.id);
      await loadOperationalEvents();
    } catch (ackError) {
      setOperationalEventsError(ackError instanceof Error ? ackError.message : 'Unable to acknowledge operational event.');
    } finally {
      setAcknowledgingEventId(null);
    }
  };

  const handleJobTransition = async (job: DriverJobAssignment, toStatus: DriverJobStatus, reason?: string) => {
    setTransitioningJobId(job.id);
    setJobsError(null);
    try {
      await transitionDriverJobAssignment({
        assignmentId: job.id,
        toStatus,
        expectedUpdatedAt: job.updatedAt,
        reason: reason ?? null,
      });
      await loadRota();
    } catch (transitionError) {
      setJobsError(transitionError instanceof Error ? transitionError.message : 'Unable to update this job status.');
    } finally {
      setTransitioningJobId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe,transparent_30%),linear-gradient(135deg,#f8fafc,#eef2ff)]">
      <header className="border-b border-white/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-600">HourWise Driver Portal</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">Driver Operational Home</h1>
            <p className="mt-1 text-sm font-medium text-slate-600">
              {profile?.full_name ?? profile?.email ?? 'Driver'} can see upcoming shifts and acknowledge manager-reviewed tachograph actions here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshDashboard()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-sm transition hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <MetricCard label="Today's Shifts" value={String(todayShifts.length)} tone={todayShifts.length > 0 ? 'neutral' : 'good'} />
          <MetricCard label="Today's Jobs" value={String(todayJobs.length)} tone={todayJobs.length > 0 ? 'neutral' : 'good'} />
          <MetricCard label="Rota Events To Read" value={String(outstandingOperationalEvents.length)} tone={outstandingOperationalEvents.length > 0 ? 'warning' : 'good'} />
          <MetricCard label="Open With Manager" value={String(openReviews.length)} tone={openReviews.length > 0 ? 'neutral' : 'good'} />
          <MetricCard label="Vehicle Actions" value={String(vehicleActions.length)} tone={vehicleActions.length > 0 ? 'warning' : 'good'} />
        </div>

        <DriverRotaPanel shifts={upcomingShifts} loading={rotaLoading} error={rotaError} />

        <DriverJobsPanel
          jobs={jobs}
          shifts={upcomingShifts}
          loading={rotaLoading}
          error={jobsError}
          transitioningJobId={transitioningJobId}
          onTransition={(job, status, reason) => void handleJobTransition(job, status, reason)}
        />

        <DriverVehicleActionsPanel actions={vehicleActions} loading={loading && vehicleActions.length === 0} error={vehicleActionsError} />

        <DriverOperationalEventsPanel
          events={operationalEvents}
          loading={eventsLoading}
          error={operationalEventsError}
          acknowledgingEventId={acknowledgingEventId}
          onAcknowledge={(event) => void handleAcknowledgeOperationalEvent(event)}
        />

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <StateCard title="Loading tachograph reviews..." />
        ) : outstandingReviews.length > 0 ? (
          <section className="space-y-4">
            <SectionHeader
              title="Action Required"
              text="Read each manager review and acknowledge once you understand the action or debrief note."
            />
            {outstandingReviews.map((review) => (
              <DriverTachoReviewCard
                key={review.id}
                review={review}
                events={events[review.id] ?? []}
                note={notes[review.id] ?? ''}
                onNoteChange={(value) => setNotes((current) => ({ ...current, [review.id]: value }))}
                pending={acknowledgingId === review.id}
                onAcknowledge={() => void handleAcknowledge(review)}
              />
            ))}
          </section>
        ) : (
          <StateCard
            icon={<CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />}
            title="No tachograph actions awaiting acknowledgement"
            text="Any new manager-reviewed tachograph findings will appear here."
            tone="success"
          />
        )}

        {acknowledgedReviews.length > 0 ? (
          <details className="rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm">
            <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              Acknowledged History
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {acknowledgedReviews.slice(0, 12).map((review) => (
                <CompactReview key={review.id} review={review} />
              ))}
            </div>
          </details>
        ) : null}
      </main>
    </div>
  );
}

function DriverJobsPanel({
  jobs,
  shifts,
  loading,
  error,
  transitioningJobId,
  onTransition,
}: {
  jobs: DriverJobAssignment[];
  shifts: DriverUpcomingShift[];
  loading: boolean;
  error: string | null;
  transitioningJobId: string | null;
  onTransition: (job: DriverJobAssignment, status: DriverJobStatus, reason?: string) => void;
}) {
  const shiftById = new Map(shifts.map((shift) => [shift.id, shift]));
  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white/90 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-emerald-100 bg-emerald-50/80 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700">Assigned Work</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Jobs attached to your rota</h2>
          <p className="mt-1 text-sm font-medium text-slate-600">Assignments are shown in sequence. Use the governed actions to acknowledge, start, report an issue, or complete a job.</p>
        </div>
        <MapPin className="h-9 w-9 text-emerald-600" />
      </div>
      {error ? <div className="m-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
      {loading ? <div className="p-5"><StateCard title="Loading assigned jobs..." /></div> : jobs.length === 0 ? (
        <div className="p-5"><StateCard icon={<ClipboardCheck className="mx-auto h-10 w-10 text-emerald-600" />} title={shifts.length === 0 ? 'No rota assignment is available' : 'No jobs are attached to these shifts'} text={shifts.length === 0 ? 'A published shift will appear here when your manager assigns one.' : 'Your published shifts currently have no job assignments. This is not a completion or zero-work claim.'} tone="neutral" /></div>
      ) : (
        <div className="space-y-3 p-5">
          {jobs.slice(0, 20).map((job) => {
            const shift = shiftById.get(job.shiftId);
            const actions = driverJobActions(job.status);
            return (
              <article key={job.id} className="rounded-2xl border border-emerald-100 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><Badge tone="neutral">Stop {job.sequence}</Badge><Badge tone={jobStatusTone(job.status)}>{jobStatusLabel(job.status)}</Badge><Badge tone="neutral">{job.jobType}</Badge></div>
                    <h3 className="mt-2 text-base font-black text-slate-950">{job.reference} · {job.title}</h3>
                    <p className="mt-1 text-sm font-medium text-slate-700">{job.customerName ? `${job.customerName} · ` : ''}{job.addressText}</p>
                    {job.instructions ? <p className="mt-2 text-sm text-slate-600">{job.instructions}</p> : null}
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ordered stops</p>
                      {job.stops.length === 0 ? <p className="text-xs font-bold text-slate-500">No separate stop records are attached; the job address is the only confirmed location. No live next-stop or ETA claim is made.</p> : job.stops.map((stop) => <div key={stop.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5"><div className="flex flex-wrap items-center gap-2"><Badge tone="neutral">Stop {stop.sequence}</Badge><Badge tone="neutral">{stop.stopType}</Badge>{stop.siteName ? <span className="text-xs font-black text-slate-700">{stop.siteName}</span> : null}</div><p className="mt-1 text-xs font-bold text-slate-700">{stop.addressText}</p>{stop.activity ? <p className="mt-1 text-xs text-slate-500">{stop.activity}</p> : null}{stop.instructions || stop.driverNotes ? <p className="mt-1 text-xs text-slate-600">{stop.instructions ?? stop.driverNotes}</p> : null}{stop.arrivalWindowStart || stop.arrivalWindowEnd ? <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Window: {formatPlannedWindow(stop.arrivalWindowStart, stop.arrivalWindowEnd)}</p> : null}</div>)}
                    </div>
                  </div>
                  <div className="shrink-0 text-left md:text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Planned window</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{formatPlannedWindow(job.plannedArrivalAt, job.plannedDepartureAt)}</p>
                    {shift ? <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{shift.date} · {shift.startTime}–{shift.endTime}</p> : null}
                  </div>
                </div>
                {actions.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {actions.map((action) => {
                      const pending = transitioningJobId === job.id;
                      return (
                        <button
                          key={action.status}
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            const reason = action.requiresReason ? window.prompt(`Reason for ${action.label.toLowerCase()} (minimum 5 characters):`) ?? undefined : undefined;
                            if (action.requiresReason && (!reason || reason.trim().length < 5)) return;
                            onTransition(job, action.status, reason?.trim());
                          }}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-50 ${action.emphasis ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                          {pending ? 'Saving' : action.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {['completed', 'unable_to_complete', 'vehicle_issue', 'site_issue', 'route_issue', 'delayed'].includes(job.status) ? <DriverJobEvidence assignmentId={job.id} /> : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DriverJobEvidence({ assignmentId }: { assignmentId: string }) {
  const [outcome, setOutcome] = useState<JobEvidenceOutcome>('delivered');
  const [evidence, setEvidence] = useState<JobEvidenceRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchJobEvidence(assignmentId).then((rows) => { if (!cancelled) setEvidence(rows); }).catch((error: unknown) => { if (!cancelled) setMessage(error instanceof Error ? error.message : 'Unable to load evidence.'); });
    return () => { cancelled = true; };
  }, [assignmentId]);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setSaving(true); setMessage(null);
    try {
      await uploadJobEvidence({ assignmentId, file, evidenceType: outcome === 'delivered' ? 'pod' : outcome === 'failed_delivery' ? 'failed_delivery' : 'unable_to_complete', outcome });
      setEvidence(await fetchJobEvidence(assignmentId));
      setMessage('Evidence recorded for manager review. Job lifecycle status was not changed.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to record evidence.'); } finally { setSaving(false); }
  };
  return <div className="mt-4 border-t border-slate-100 pt-4"><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Job evidence</p><select value={outcome} onChange={(event) => setOutcome(event.target.value as JobEvidenceOutcome)} disabled={saving} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700"><option value="delivered">Delivered / POD</option><option value="failed_delivery">Failed delivery</option><option value="unable_to_complete">Unable to complete</option></select><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:opacity-50"><input type="file" accept="image/*,application/pdf" className="sr-only" disabled={saving} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }} />{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}{saving ? 'Uploading' : 'Upload proof'}</label><span className="text-xs font-bold text-slate-500">{evidence.length} recorded</span></div>{message ? <p className="mt-2 text-xs font-bold text-emerald-700">{message}</p> : null}{evidence.slice(0, 3).map((item) => <p key={item.id} className="mt-2 text-xs text-slate-500">{item.evidence_type.replace('_', ' ')} · {item.review_status.replace('_', ' ')} · {new Date(item.uploaded_at).toLocaleString()}</p>)}</div>;
}

type DriverJobAction = { status: DriverJobStatus; label: string; requiresReason?: boolean; emphasis?: boolean };

function driverJobActions(status: DriverJobStatus): DriverJobAction[] {
  if (status === 'published' || status === 'updated') return [{ status: 'acknowledged', label: 'Acknowledge', emphasis: true }];
  if (status === 'acknowledged' || status === 'delayed') return [{ status: 'started', label: 'Start / resume', emphasis: true }];
  if (status === 'started') return [
    { status: 'arrived', label: 'Mark arrived', emphasis: true },
    { status: 'delayed', label: 'Report delay', requiresReason: true },
    { status: 'vehicle_issue', label: 'Vehicle issue', requiresReason: true },
    { status: 'site_issue', label: 'Site issue', requiresReason: true },
    { status: 'route_issue', label: 'Route issue', requiresReason: true },
  ];
  if (status === 'arrived') return [
    { status: 'completed', label: 'Complete job', emphasis: true },
    { status: 'delayed', label: 'Report delay', requiresReason: true },
    { status: 'vehicle_issue', label: 'Vehicle issue', requiresReason: true },
    { status: 'site_issue', label: 'Site issue', requiresReason: true },
    { status: 'route_issue', label: 'Route issue', requiresReason: true },
  ];
  return [];
}

function jobStatusTone(status: DriverJobStatus): 'neutral' | 'success' | 'warning' {
  if (status === 'completed' || status === 'arrived') return 'success';
  if (status === 'delayed' || status === 'unable_to_complete' || status === 'vehicle_issue' || status === 'site_issue' || status === 'route_issue') return 'warning';
  return 'neutral';
}

function jobStatusLabel(status: DriverJobStatus) {
  return status.replace(/_/g, ' ');
}

function DriverVehicleActionsPanel({
  actions,
  loading,
  error,
}: {
  actions: DriverVehicleAction[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-amber-200 bg-white/90 shadow-sm">
      <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/80 p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-700">Vehicle Actions</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Recent check findings</h2>
        </div>
        <Truck className="h-9 w-9 text-amber-600" />
      </div>
      {error ? <div className="m-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
      {loading ? <div className="p-5"><StateCard title="Loading vehicle check actions..." /></div> : actions.length === 0 ? (
        <div className="p-5"><StateCard icon={<CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />} title="No vehicle check action is recorded" text="This means no action row was returned for your recent checks; it does not certify vehicle readiness." tone="neutral" /></div>
      ) : (
        <div className="space-y-3 p-5">
          {actions.map((action) => <article key={action.id} className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap gap-2"><Badge tone="warning">{action.checkStatus}</Badge>{action.defectLifecycleStatus ? <Badge tone="neutral">{action.defectLifecycleStatus.replace('_', ' ')}</Badge> : null}</div><h3 className="mt-2 text-base font-black text-slate-950">{action.regNumber}</h3>{action.defectDetails ? <p className="mt-1 text-sm font-medium text-slate-700">{action.defectDetails}</p> : null}</div>{action.createdAt ? <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{formatDateTime(action.createdAt)}</p> : null}</div></article>)}
        </div>
      )}
    </section>
  );
}

function DriverOperationalEventsPanel({
  events,
  loading,
  error,
  acknowledgingEventId,
  onAcknowledge,
}: {
  events: DriverOperationalEvent[];
  loading: boolean;
  error: string | null;
  acknowledgingEventId: string | null;
  onAcknowledge: (event: DriverOperationalEvent) => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-violet-200 bg-white/90 shadow-sm">
      <div className="flex items-center justify-between border-b border-violet-100 bg-violet-50/80 p-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-700">Operational Events</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Rota and manager updates</h2>
        </div>
        <BellRing className="h-9 w-9 text-violet-600" />
      </div>
      {error ? <div className="m-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
      {loading ? <div className="p-5"><StateCard title="Loading operational events..." /></div> : events.length === 0 ? (
        <div className="p-5"><StateCard icon={<BellRing className="mx-auto h-10 w-10 text-violet-600" />} title="No operational events yet" text="Published rota updates from your manager will appear here." tone="success" /></div>
      ) : (
        <div className="space-y-3 p-5">
          {events.slice(0, 12).map((event) => {
            const pending = event.requiresAck && !event.acknowledgedAt;
            return (
              <article key={event.id} className={`rounded-2xl border p-4 ${pending ? 'border-amber-200 bg-amber-50/60' : 'border-slate-200 bg-white'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2"><Badge tone={pending ? 'warning' : 'neutral'}>{pending ? 'acknowledgement required' : 'read'}</Badge><Badge tone="neutral">{event.eventType.replace(/_/g, ' ')}</Badge></div>
                    <h3 className="mt-2 text-base font-black text-slate-950">{event.title}</h3>
                    {event.body ? <p className="mt-1 text-sm font-medium text-slate-600">{event.body}</p> : null}
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{event.acknowledgedAt ? `Acknowledged ${formatDateTime(event.acknowledgedAt)}` : `Received ${formatDateTime(event.createdAt)}`}</p>
                  </div>
                  {pending ? <button type="button" onClick={() => onAcknowledge(event)} disabled={acknowledgingEventId === event.id} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-violet-700 disabled:opacity-50">{acknowledgingEventId === event.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{acknowledgingEventId === event.id ? 'Acknowledging' : 'Acknowledge'}</button> : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DriverRotaPanel({
  shifts,
  loading,
  error,
}: {
  shifts: DriverUpcomingShift[];
  loading: boolean;
  error: string | null;
}) {
  const today = formatDateOnly(new Date());

  return (
    <section className="overflow-hidden rounded-3xl border border-sky-200 bg-white/90 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-sky-100 bg-sky-50/80 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700">Upcoming Rota</p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">Today and the next 7 days</h2>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Read-only view of shifts assigned by your fleet manager.
          </p>
        </div>
        <CalendarDays className="h-9 w-9 text-sky-600" />
      </div>

      {error ? (
        <div className="p-5">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        </div>
      ) : loading ? (
        <div className="p-5">
          <StateCard title="Loading upcoming shifts..." />
        </div>
      ) : shifts.length === 0 ? (
        <div className="p-5">
          <StateCard
            icon={<CalendarDays className="mx-auto h-10 w-10 text-sky-600" />}
            title="No shifts assigned for the next 7 days"
            text="Published rota entries from your manager will appear here."
            tone="success"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-5 lg:grid-cols-2">
          {shifts.map((shift) => (
            <article
              key={shift.id}
              className={`rounded-2xl border p-4 ${
                shift.date === today ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {shift.date === today ? <Badge tone="neutral">today</Badge> : null}
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                      {formatShiftDate(shift.date)}
                    </p>
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-lg font-black text-slate-950">
                    <Clock3 className="h-4 w-4 text-sky-600" />
                    {formatShiftTime(shift.startTime)} - {formatShiftTime(shift.endTime)}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-950 px-3 py-2 text-white">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                    <Truck className="h-3.5 w-3.5 text-sky-300" />
                    {shift.vehicleRegistration ?? 'Vehicle TBC'}
                  </p>
                  {shift.vehicleDescription ? (
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                      {shift.vehicleDescription}
                    </p>
                  ) : null}
                </div>
              </div>
              {shift.notes ? (
                <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-sm font-medium text-slate-600">
                  {shift.notes}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DriverTachoReviewCard({
  review,
  events,
  note,
  pending,
  onNoteChange,
  onAcknowledge,
}: {
  review: TachoFindingReview;
  events: TachoFindingReviewEvent[];
  note: string;
  pending: boolean;
  onNoteChange: (value: string) => void;
  onAcknowledge: () => void;
}) {
  return (
    <article className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="warning">{review.status.replace('_', ' ')}</Badge>
            <Badge tone="neutral">{review.correctiveActionType?.replace('_', ' ') ?? 'manager review'}</Badge>
          </div>
          <h2 className="text-lg font-black text-slate-950">Tachograph review requires acknowledgement</h2>
          <p className="max-w-3xl text-sm font-medium text-slate-600">
            {review.managerNote || 'Your manager has reviewed this tachograph finding. Acknowledge once you have read it.'}
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Saved {formatDateTime(review.updatedAt)}
          </p>
        </div>
        <ClipboardCheck className="h-8 w-8 text-amber-500" />
      </div>

      <label className="mt-4 block text-xs font-bold text-slate-600">
        Optional acknowledgement note
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          rows={2}
          placeholder="Example: Discussed at debrief and understood."
          className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-blue-400"
        />
      </label>

      {events.length > 0 ? (
        <details className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-slate-500">
            Review history
          </summary>
          <div className="mt-2 space-y-2">
            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-xl bg-white px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                  {event.eventType.replace('_', ' ')} - {event.newStatus.replace('_', ' ')}
                </p>
                {event.note ? <p className="mt-1 text-xs font-medium text-slate-600">{event.note}</p> : null}
                <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-400">{formatDateTime(event.createdAt)}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onAcknowledge}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {pending ? 'Acknowledging' : 'Acknowledge Review'}
        </button>
      </div>
    </article>
  );
}

function CompactReview({ review }: { review: TachoFindingReview }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-wrap gap-2">
        <Badge tone="success">acknowledged</Badge>
        <Badge tone="neutral">{review.status.replace('_', ' ')}</Badge>
      </div>
      <p className="mt-2 text-sm font-bold text-slate-800">{review.correctiveActionType?.replace('_', ' ') ?? 'Review'}</p>
      {review.managerNote ? <p className="mt-1 text-xs font-medium text-slate-600">{review.managerNote}</p> : null}
      <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
        Acknowledged {review.driverAcknowledgedAt ? formatDateTime(review.driverAcknowledgedAt) : 'previously'}
      </p>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'good' | 'warning' }) {
  const styles = {
    neutral: 'border-slate-200 bg-white text-slate-800',
    good: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
  }[tone];

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function StateCard({
  title,
  text,
  icon,
  tone = 'loading',
}: {
  title: string;
  text?: string;
  icon?: ReactNode;
  tone?: 'loading' | 'success' | 'neutral';
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/85 p-8 text-center shadow-sm">
      {icon ?? <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />}
      <p className={`mt-3 font-black ${tone === 'success' ? 'text-emerald-700' : 'text-slate-700'}`}>{title}</p>
      {text ? <p className="mt-2 text-sm font-medium text-slate-500">{text}</p> : null}
    </div>
  );
}

function SectionHeader({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-600">{title}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{text}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: 'neutral' | 'success' | 'warning' }) {
  const styles = {
    neutral: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-800',
  }[tone];

  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${styles}`}>{children}</span>;
}

function groupEventsByReviewId(events: TachoFindingReviewEvent[]) {
  return events.reduce<Record<string, TachoFindingReviewEvent[]>>((acc, event) => {
    acc[event.reviewId] = [...(acc[event.reviewId] ?? []), event];
    return acc;
  }, {});
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Not recorded';
  return new Date(value).toLocaleString();
}

function formatPlannedWindow(arrival: string | null, departure: string | null) {
  const format = (value: string | null) => value ? new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null;
  const start = format(arrival);
  const end = format(departure);
  if (start && end) return `${start}–${end}`;
  return start ?? end ?? 'Not scheduled';
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShiftDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatShiftTime(value: string) {
  return value.slice(0, 5);
}
