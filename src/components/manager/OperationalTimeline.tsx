import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Filter, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchOperationalTimeline, type OperationalTimelineCategory, type OperationalTimelineFilters, type OperationalTimelineItem, type OperationalTimelinePage } from '../../lib/operationalTimeline';
import { toProductError } from '../../lib/productError';

const categories: Array<OperationalTimelineCategory | ''> = ['', 'job', 'assignment', 'proposal', 'task', 'pod', 'compliance', 'security'];

export function OperationalTimeline() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<OperationalTimelineFilters>({});
  const [draft, setDraft] = useState<OperationalTimelineFilters>({});
  const [page, setPage] = useState<OperationalTimelinePage>({ items: [], nextCursor: null, hasMore: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextFilters: OperationalTimelineFilters, cursor = null as OperationalTimelinePage['nextCursor']) => {
    setLoading(true);
    setError(null);
    try {
      const nextPage = await fetchOperationalTimeline(nextFilters, cursor);
      setPage((current) => cursor ? { ...nextPage, items: [...current.items, ...nextPage.items] } : nextPage);
    } catch (loadError) {
      setError(toProductError(loadError, 'The operational history is temporarily unavailable. Try again.').message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.role === 'manager') void load(filters);
  }, [filters, load, profile?.role]);

  if (profile?.role !== 'manager') return null;

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters(draft);
  };

  return <section className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-widest text-hw-cyan-300">Unified operations timeline</p><p className="mt-1 text-xs text-hw-slate-400">A bounded manager view over authoritative event, proposal, task, POD, compliance, and security sources. It does not create a second event history.</p></div>
      <Filter className="h-5 w-5 shrink-0 text-hw-cyan-300" />
    </div>
    <form onSubmit={applyFilters} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <input type="date" aria-label="Timeline from" value={draft.from?.slice(0, 10) ?? ''} onChange={(event) => setDraft({ ...draft, from: event.target.value ? `${event.target.value}T00:00:00.000Z` : undefined })} className="rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs text-white" />
      <input type="date" aria-label="Timeline to" value={draft.to?.slice(0, 10) ?? ''} onChange={(event) => setDraft({ ...draft, to: event.target.value ? `${event.target.value}T23:59:59.999Z` : undefined })} className="rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs text-white" />
      <select aria-label="Timeline category" value={draft.category ?? ''} onChange={(event) => setDraft({ ...draft, category: (event.target.value || undefined) as OperationalTimelineCategory | undefined })} className="rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs text-white">{categories.map((category) => <option key={category || 'all'} value={category}>{category ? category : 'All categories'}</option>)}</select>
      <input aria-label="Event type" placeholder="Event type" value={draft.eventType ?? ''} onChange={(event) => setDraft({ ...draft, eventType: event.target.value })} className="rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs text-white placeholder:text-hw-slate-600" />
      <input aria-label="Driver ID" placeholder="Driver ID" value={draft.driverId ?? ''} onChange={(event) => setDraft({ ...draft, driverId: event.target.value })} className="rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs text-white placeholder:text-hw-slate-600" />
      <input aria-label="Vehicle ID" placeholder="Vehicle ID" value={draft.vehicleId ?? ''} onChange={(event) => setDraft({ ...draft, vehicleId: event.target.value })} className="rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs text-white placeholder:text-hw-slate-600" />
      <input aria-label="Trailer ID" placeholder="Trailer ID" value={draft.trailerId ?? ''} onChange={(event) => setDraft({ ...draft, trailerId: event.target.value })} className="rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs text-white placeholder:text-hw-slate-600" />
      <input aria-label="Job assignment ID" placeholder="Job assignment ID" value={draft.jobAssignmentId ?? ''} onChange={(event) => setDraft({ ...draft, jobAssignmentId: event.target.value })} className="rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs text-white placeholder:text-hw-slate-600" />
      <input aria-label="Proposal ID" placeholder="Proposal ID" value={draft.proposalId ?? ''} onChange={(event) => setDraft({ ...draft, proposalId: event.target.value })} className="rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs text-white placeholder:text-hw-slate-600" />
      <input aria-label="Task ID" placeholder="Task ID" value={draft.taskId ?? ''} onChange={(event) => setDraft({ ...draft, taskId: event.target.value })} className="rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs text-white placeholder:text-hw-slate-600" />
      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs text-hw-slate-300"><input type="checkbox" checked={draft.unresolvedOnly ?? false} onChange={(event) => setDraft({ ...draft, unresolvedOnly: event.target.checked })} /> Unresolved only</label>
      <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-hw-cyan-500 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-hw-navy-950"><Filter className="h-3.5 w-3.5" />Apply filters</button>
    </form>
    {error ? <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-300">{error}</p> : null}
    {loading && page.items.length === 0 ? <p className="mt-4 flex items-center gap-2 text-xs text-hw-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Loading operational history...</p> : <div className="mt-4 space-y-2">{page.items.map((item) => <TimelineRow key={item.id} item={item} />)}</div>}
    {!loading && page.items.length === 0 && !error ? <p className="mt-4 text-xs text-hw-slate-500">No timeline records match the selected filters.</p> : null}
    <div className="mt-4 flex items-center justify-between gap-3"><span className="text-[10px] text-hw-slate-500">Showing up to 100 records per request</span><div className="flex gap-3">{page.hasMore && page.nextCursor ? <button type="button" disabled={loading} onClick={() => void load(filters, page.nextCursor)} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-hw-cyan-300 disabled:opacity-50"><RefreshCw className="h-3 w-3" />Load more</button> : null}<button type="button" disabled={loading} onClick={() => void load(filters)} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-hw-cyan-300 disabled:opacity-50"><RefreshCw className="h-3 w-3" />Refresh</button></div></div>
  </section>;
}

function TimelineRow({ item }: { item: OperationalTimelineItem }) {
  return <article className="rounded-lg border border-white/10 bg-hw-navy-950/40 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-hw-cyan-300">{item.category}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${severityClass(item.severity)}`}>{item.severity}</span><span className="text-[10px] text-hw-slate-500">{new Date(item.occurredAt).toLocaleString()}</span></div><p className="mt-2 text-sm font-bold text-white">{item.summary}</p><p className="mt-1 text-xs text-hw-slate-400">{item.entity.label} · {item.eventType}{item.actor ? ` · by ${item.actor.label}` : ''}</p><p className="mt-1 text-[10px] text-hw-slate-600">Source: {item.sourceSystem} · {item.sourceId}</p></div>{item.navigationTarget ? <a href={item.navigationTarget} className="shrink-0 text-hw-cyan-300" aria-label={`Open ${item.category} source`}><ExternalLink className="h-4 w-4" /></a> : null}</div>{item.relatedProposalId || item.relatedEventId ? <p className="mt-2 text-[10px] text-hw-slate-500">Related {item.relatedProposalId ? `proposal ${item.relatedProposalId}` : `event ${item.relatedEventId}`}</p> : null}</article>;
}

function severityClass(value: string) {
  if (value === 'critical' || value === 'high') return 'bg-red-500/20 text-red-200';
  if (value === 'warning') return 'bg-amber-500/20 text-amber-200';
  return 'bg-white/10 text-hw-slate-300';
}
