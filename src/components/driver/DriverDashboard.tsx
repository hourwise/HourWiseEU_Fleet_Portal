import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, CheckCircle2, ClipboardCheck, Clock3, Loader2, LogOut, RefreshCw, Truck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  acknowledgeTachoFindingReview,
  fetchMyTachoFindingReviews,
  type TachoFindingReviewEvent,
  fetchTachoFindingReviewEvents,
} from '../../lib/tacho/api';
import { fetchDriverUpcomingShifts, type DriverUpcomingShift } from '../../lib/rota';
import type { TachoFindingReview } from '../../lib/tacho/rules/types';

type PendingNoteByReviewId = Record<string, string>;

export function DriverDashboard() {
  const { profile, signOut } = useAuth();
  const [reviews, setReviews] = useState<TachoFindingReview[]>([]);
  const [events, setEvents] = useState<Record<string, TachoFindingReviewEvent[]>>({});
  const [upcomingShifts, setUpcomingShifts] = useState<DriverUpcomingShift[]>([]);
  const [notes, setNotes] = useState<PendingNoteByReviewId>({});
  const [loading, setLoading] = useState(true);
  const [rotaLoading, setRotaLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rotaError, setRotaError] = useState<string | null>(null);

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
      setUpcomingShifts(await fetchDriverUpcomingShifts(profile.id));
    } catch (loadError) {
      setRotaError(loadError instanceof Error ? loadError.message : 'Unable to load upcoming shifts.');
    } finally {
      setRotaLoading(false);
    }
  };

  const refreshDashboard = async () => {
    setRefreshing(true);
    await Promise.all([loadReviews('refresh'), loadRota()]);
    setRefreshing(false);
  };

  useEffect(() => {
    void loadReviews();
    void loadRota();
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <MetricCard label="Today's Shifts" value={String(todayShifts.length)} tone={todayShifts.length > 0 ? 'neutral' : 'good'} />
          <MetricCard label="Awaiting Acknowledgement" value={String(outstandingReviews.length)} tone={outstandingReviews.length > 0 ? 'warning' : 'good'} />
          <MetricCard label="Open With Manager" value={String(openReviews.length)} tone={openReviews.length > 0 ? 'neutral' : 'good'} />
          <MetricCard label="Acknowledged" value={String(acknowledgedReviews.length)} tone="good" />
        </div>

        <DriverRotaPanel shifts={upcomingShifts} loading={rotaLoading} error={rotaError} />

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
  tone?: 'loading' | 'success';
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
