import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchOperationalTasks, type OperationalTask, type OperationalTaskCategory } from '../../lib/operationalTaskQueue';
import { setOperationalTaskHandling, type OperationalTaskHandlingStatus } from '../../lib/operationalTaskHandling';

type QueueFilter = 'all' | 'critical' | 'mine' | 'needs_attention' | 'in_progress' | 'resolved' | OperationalTaskCategory;

export function ManagerOperationalTaskQueue() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    setError(null);
    try {
      setTasks(await fetchOperationalTasks(profile.company_id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the operational task queue.');
    } finally {
      setLoading(false);
    }
  };

  const updateHandling = async (task: OperationalTask, status: OperationalTaskHandlingStatus) => {
    if (!profile?.id) return;
    const note = status === 'resolved' ? window.prompt('Record the bounded action taken (this does not change the source record):') : null;
    if (status === 'resolved' && (!note || note.trim().length < 5)) return;
    try {
      await setOperationalTaskHandling({ sourceType: task.sourceType, sourceId: task.sourceId, status, ownerId: profile.id, action: status === 'resolved' ? 'manager_handling_recorded' : null, note });
      await load();
    } catch (handlingError) {
      setError(handlingError instanceof Error ? handlingError.message : 'Unable to update task handling.');
    }
  };

  useEffect(() => {
    void load();
    // The queue is scoped to the signed-in manager company.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.company_id]);

  const visibleTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    if (filter === 'critical') return tasks.filter((task) => task.severity === 'critical');
    if (filter === 'mine') return tasks.filter((task) => task.handling?.ownerId === profile?.id);
    if (filter === 'needs_attention' || filter === 'in_progress' || filter === 'resolved') return tasks.filter((task) => (task.handling?.status ?? 'new') === (filter === 'needs_attention' ? 'new' : filter));
    return tasks.filter((task) => task.category === filter);
  }, [filter, profile?.id, tasks]);

  return (
    <section className="rounded-2xl border border-hw-blue-500/30 bg-hw-navy-900 p-6 shadow-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-hw-cyan-500">Governed operations</p>
          <h4 className="mt-1 flex items-center gap-2 text-lg font-bold text-hw-white"><ClipboardList className="h-5 w-5 text-hw-cyan-500" /> Manager task queue</h4>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-hw-slate-300">Deterministic follow-up tasks projected from Portal records. The queue is not a second source of truth.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-hw-slate-200 transition hover:bg-white/10 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(['all', 'critical', 'mine', 'needs_attention', 'in_progress', 'resolved', 'jobs', 'drivers', 'fleet', 'compliance'] as const).map((value) => {
          const count = value === 'all' ? tasks.length : value === 'critical' ? tasks.filter((task) => task.severity === value).length : value === 'mine' ? tasks.filter((task) => task.handling?.ownerId === profile?.id).length : ['needs_attention', 'in_progress', 'resolved'].includes(value) ? tasks.filter((task) => (task.handling?.status ?? 'new') === (value === 'needs_attention' ? 'new' : value)).length : tasks.filter((task) => task.category === value).length;
          const label = value === 'needs_attention' ? 'Needs attention' : value.replace('_', ' ');
          return <button key={value} type="button" onClick={() => setFilter(value as QueueFilter)} className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition ${filter === value ? 'bg-hw-cyan-500 text-hw-navy-950' : 'bg-white/5 text-hw-slate-300 hover:bg-white/10'}`}>{label} {count}</button>;
        })}
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-300">{error}</div> : null}
      {loading ? <div className="mt-5 flex items-center gap-2 text-xs font-bold text-hw-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> Building deterministic task projection...</div> : visibleTasks.length === 0 ? <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-xs font-bold text-hw-slate-300"><CheckCircle2 className="h-4 w-4 text-hw-emerald-400" /> No task matches the current filter.</div> : (
        <div className="mt-5 space-y-2">
          {visibleTasks.slice(0, 30).map((task) => <div key={task.id} className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-3"><a key={`link-${task.id}`} href={task.navigationTarget} className="flex min-w-0 gap-3"><TaskIcon severity={task.severity} /><div className="min-w-0"><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest ${task.severity === 'critical' ? 'bg-red-500/20 text-red-300' : task.severity === 'high' ? 'bg-orange-500/20 text-orange-300' : task.severity === 'medium' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-hw-slate-300'}`}>{task.severity}</span><span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-hw-slate-400">{task.category}</span><span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-hw-slate-400">{task.handling?.status ?? 'new'}</span></div><p className="mt-2 text-sm font-bold text-hw-white">{task.title}</p><p className="mt-1 text-xs leading-relaxed text-hw-slate-300">{task.detail}</p><p className="mt-2 text-[9px] font-black uppercase tracking-widest text-hw-slate-500">Source: {task.sourceType} · {task.actionable ? 'actionable' : 'information'} · handling never replaces source truth</p></div></a><div className="flex shrink-0 flex-col items-end gap-2"><ExternalLink className="h-4 w-4 text-hw-slate-500" /><div className="flex flex-wrap justify-end gap-1"><button type="button" onClick={() => void updateHandling(task, 'acknowledged')} className="rounded bg-white/10 px-2 py-1 text-[9px] font-black uppercase text-slate-300">Ack</button><button type="button" onClick={() => void updateHandling(task, 'in_progress')} className="rounded bg-amber-500/15 px-2 py-1 text-[9px] font-black uppercase text-amber-200">Mine / work</button><button type="button" onClick={() => void updateHandling(task, 'resolved')} className="rounded bg-emerald-500/15 px-2 py-1 text-[9px] font-black uppercase text-emerald-200">Resolve handling</button></div></div></div>)}
        </div>
      )}
    </section>
  );
}

function TaskIcon({ severity }: { severity: OperationalTask['severity'] }) {
  return severity === 'critical' || severity === 'high' ? <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-orange-400" /> : <ClipboardList className="mt-1 h-4 w-4 shrink-0 text-hw-cyan-500" />;
}
