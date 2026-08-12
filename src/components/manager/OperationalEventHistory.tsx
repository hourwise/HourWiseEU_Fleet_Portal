import { useCallback, useEffect, useState } from 'react';
import { CheckCheck, Clock3, History, RefreshCw, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchManagerOperationalEventHistory,
  type OperationalEventAcknowledgementState,
  type OperationalEventHistoryItem,
  type OperationalEventMessageState,
} from '../../lib/operationalEventHistory';

const formatTimestamp = (timestamp: string) => new Date(timestamp).toLocaleString('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const acknowledgementLabel = (state: OperationalEventAcknowledgementState) => {
  if (state === 'acknowledged') return 'Acknowledged';
  if (state === 'pending') return 'Awaiting acknowledgement';
  return 'Not required';
};

const messageLabel = (state: OperationalEventMessageState) => {
  if (state === 'read') return 'Message read';
  if (state === 'sent') return 'Message sent';
  return null;
};

export function OperationalEventHistory() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<OperationalEventHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      setEvents(await fetchManagerOperationalEventHistory(profile.company_id));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load operational events.');
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return (
    <section className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-5 border-b border-brand-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-brand-accent/10 rounded-xl flex items-center justify-center">
            <History className="w-4 h-4 text-brand-accent" />
          </div>
          <div>
            <h3 className="font-black text-white">Operational Events</h3>
            <p className="text-xs text-slate-500">Rota, job and event-backed message history</p>
          </div>
        </div>
        <button onClick={loadEvents} disabled={loading} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-brand-dark transition disabled:opacity-50" title="Refresh operational events">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <p role="alert" className="m-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-300">{error}</p>}
      {!error && loading && events.length === 0 && <p className="p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-500">Loading operational history...</p>}
      {!error && !loading && events.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No operational events recorded yet.</p>}

      {events.length > 0 && (
        <div className="divide-y divide-brand-border/60">
          {events.map(event => {
            const ackClass = event.acknowledgementState === 'acknowledged'
              ? 'text-emerald-400'
              : event.acknowledgementState === 'pending'
                ? 'text-amber-400'
                : 'text-slate-500';
            const messageState = messageLabel(event.messageState);
            return (
              <article key={event.id} className="p-5 hover:bg-brand-dark/30 transition">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent">{event.eventType.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-slate-500">{formatTimestamp(event.createdAt)}</span>
                    </div>
                    <h4 className="mt-1 font-bold text-white">{event.title}</h4>
                    {event.body && <p className="mt-1 text-sm leading-relaxed text-slate-400">{event.body}</p>}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1.5"><UserRound size={13} />{event.recipientDriverName}</span>
                      {event.actorName && <span>Actor: {event.actorName}</span>}
                      {event.context && <span>{event.context}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
                    <span className={`flex items-center gap-1.5 ${ackClass}`}>
                      {event.acknowledgementState === 'acknowledged' ? <CheckCheck size={13} /> : <Clock3 size={13} />}
                      {acknowledgementLabel(event.acknowledgementState)}
                    </span>
                    {messageState && <span className="text-slate-400">{messageState}</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
