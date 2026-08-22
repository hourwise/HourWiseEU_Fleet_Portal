import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Eye, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchManagerPodReviewQueue, openJobEvidenceView, reviewJobEvidence, type JobEvidenceReviewStatus, type PodReviewQueueItem } from '../../lib/jobEvidence';
import { toProductError } from '../../lib/productError';

type QueueFilter = JobEvidenceReviewStatus | 'all';

export function PodReviewQueue() {
  const { profile } = useAuth();
  const [items, setItems] = useState<PodReviewQueueItem[]>([]);
  const [status, setStatus] = useState<QueueFilter>('pending');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    setMessage(null);
    try {
      setItems(await fetchManagerPodReviewQueue({ reviewStatus: status, from: from ? `${from}T00:00:00.000Z` : undefined, to: to ? `${to}T00:00:00.000Z` : undefined }));
    } catch (error) {
      setMessage(toProductError(error, 'The POD review queue is temporarily unavailable. Try again.').message);
    } finally {
      setLoading(false);
    }
  }, [from, profile?.company_id, status, to]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (item: PodReviewQueueItem, reviewStatus: Exclude<JobEvidenceReviewStatus, 'pending'>) => {
    setSavingId(item.id);
    setMessage(null);
    try {
      const result = await reviewJobEvidence({ evidenceId: item.id, reviewStatus, reviewNotes: notes[item.id] || null, expectedUpdatedAt: item.updated_at });
      if (!result || result.outcome === 'permission_denied' || result.outcome === 'invalid_state') throw new Error(result?.reason || 'The review was not accepted.');
      setMessage(result.outcome === 'already_reviewed' ? 'This evidence was already reviewed; the latest decision is shown below.' : result.outcome === 'stale' ? 'This evidence changed while you were reviewing it. The queue has been refreshed.' : 'POD review saved.');
      await load();
    } catch (error) {
      setMessage(toProductError(error, 'The POD review decision could not be saved. Refresh and try again.').message);
    } finally {
      setSavingId(null);
    }
  };

  const viewEvidence = async (id: string) => {
    try { window.open(await openJobEvidenceView(id), '_blank', 'noopener,noreferrer'); } catch (error) { setMessage(toProductError(error, 'The protected evidence view is temporarily unavailable.').message); }
  };

  return <section className="rounded-2xl border border-hw-blue-500/30 bg-hw-navy-900 p-6 shadow-xl">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-hw-cyan-500">Governed POD review</p><h4 className="mt-1 text-lg font-bold text-hw-white">Manager evidence queue</h4><p className="mt-1 max-w-2xl text-xs leading-relaxed text-hw-slate-400">Evidence is tied to a real job assignment. Review decisions are audited and do not complete the job lifecycle.</p></div>
      <ShieldCheck className="h-6 w-6 shrink-0 text-hw-cyan-500" />
    </div>
    <div className="mt-4 flex flex-wrap items-end gap-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500">State<select value={status} onChange={(event) => setStatus(event.target.value as QueueFilter)} className="mt-1 block rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs font-bold text-white"><option value="pending">Awaiting review</option><option value="needs_follow_up">Follow-up</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="all">All</option></select></label>
      <label className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500">Uploaded from<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs font-bold text-white" /></label>
      <label className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500">Uploaded to<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 block rounded-lg border border-white/10 bg-hw-navy-950 px-2 py-2 text-xs font-bold text-white" /></label>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-hw-slate-200 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
    </div>
    {message ? <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-bold text-amber-200">{message}</p> : null}
    {loading ? <div className="mt-5 flex items-center gap-2 text-xs font-bold text-hw-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading manager review queue...</div> : items.length === 0 ? <p className="mt-5 text-xs text-hw-slate-400">No evidence matches this filter.</p> : <div className="mt-5 space-y-3">{items.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-hw-navy-950/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><a href="/dashboard?workspace=people&people=jobs" className="text-sm font-bold text-hw-white hover:text-hw-cyan-300">{item.job_reference} · {item.job_title} <ExternalLink className="inline h-3 w-3" /></a><p className="mt-1 text-xs text-hw-slate-400">Assignment {item.job_assignment_id.slice(0, 8)} · lifecycle: {item.assignment_status} · {item.evidence_type} / {item.outcome}</p><p className="mt-1 text-[10px] text-hw-slate-500">Uploaded {new Date(item.uploaded_at).toLocaleString()} by {item.uploader_label} ({item.uploader_role ?? 'Portal user'})</p></div><span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-hw-slate-300">{item.review_status.replace(/_/g, ' ')}</span></div>
      {item.review_notes ? <p className="mt-3 rounded-lg border border-white/5 bg-white/5 p-2 text-xs text-hw-slate-300">Existing note: {item.review_notes}</p> : null}
      {item.review_status === 'pending' || item.review_status === 'needs_follow_up' ? <><textarea value={notes[item.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value.slice(0, 2000) }))} placeholder="Optional manager note (max 2,000 characters)" className="mt-3 min-h-16 w-full rounded-lg border border-white/10 bg-black/10 p-2 text-xs text-white placeholder:text-hw-slate-500" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void decide(item, 'accepted')} disabled={savingId === item.id} className="rounded-lg bg-emerald-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-200 disabled:opacity-50">Accept</button><button type="button" onClick={() => void decide(item, 'needs_follow_up')} disabled={savingId === item.id} className="rounded-lg bg-amber-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-200 disabled:opacity-50">Needs follow-up</button><button type="button" onClick={() => void decide(item, 'rejected')} disabled={savingId === item.id} className="rounded-lg bg-red-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-200 disabled:opacity-50">Reject</button></div></> : null}
      <button type="button" onClick={() => void viewEvidence(item.id)} className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-hw-cyan-300"><Eye className="h-3.5 w-3.5" />Protected evidence view (60s)</button>
    </article>)}</div>}
  </section>;
}
