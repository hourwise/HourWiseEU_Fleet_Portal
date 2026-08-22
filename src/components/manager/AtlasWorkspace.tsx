import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, FileClock, ListTodo, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAtlasOperationsBriefing } from '../../lib/atlasOperationalLoad';
import type { AtlasMorningBriefing } from '../../lib/atlasBriefing';
import { toProductError } from '../../lib/productError';
import { AtlasOperationsBriefing, AssetReadinessPanel, DriverComplianceForecastPanel, FleetComplianceForecastPanel } from './OperationalBriefing';
import { AtlasPolicyAdministration } from './AtlasPolicyAdministration';
import { AtlasProposalWorkbench } from './AtlasProposalWorkbench';
import { ManagerOperationalTaskQueue } from './ManagerOperationalTaskQueue';
import { OperationalTimeline } from './OperationalTimeline';
import { PodReconciliationHealth } from './PodReconciliationHealth';
import { PodReviewQueue } from './PodReviewQueue';

type AtlasTab = 'overview' | 'tasks' | 'compliance' | 'operations' | 'proposals' | 'history' | 'administration';
const tabs: Array<{ id: AtlasTab; label: string; icon: typeof Sparkles }> = [
  { id: 'overview', label: 'Overview', icon: Sparkles }, { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'compliance', label: 'Compliance', icon: ShieldAlert }, { id: 'operations', label: 'Operations', icon: ClipboardCheck },
  { id: 'proposals', label: 'Proposals', icon: ClipboardCheck }, { id: 'history', label: 'History', icon: FileClock },
  { id: 'administration', label: 'Administration', icon: ShieldAlert },
];

export function AtlasWorkspace() {
  const [tab, setTab] = useState<AtlasTab>('overview');
  return <div className="w-full space-y-6 pb-12">
    <div className="rounded-2xl border border-hw-blue-500/30 bg-gradient-to-r from-hw-blue-950 to-hw-navy-900 p-6 shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-hw-cyan-300"><Sparkles className="h-5 w-5" /><span className="text-[10px] font-black uppercase tracking-[0.22em]">Atlas operations workspace</span></div><h3 className="mt-2 text-2xl font-black text-white">One governed view of operational attention</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed text-hw-slate-300">Ask Atlas about current Portal facts, inspect the source record, and take an explicit manager action where a governed workflow allows it. Atlas remains deterministic and does not call a model or provider.</p></div><div className="rounded-xl border border-hw-cyan-500/20 bg-hw-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-hw-cyan-200">Portal state only</div></div>
      <div role="tablist" aria-label="Atlas workspace sections" className="mt-6 flex gap-2 overflow-x-auto pb-1">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition ${tab === id ? 'bg-hw-cyan-500 text-hw-navy-950' : 'bg-white/5 text-hw-slate-300 hover:bg-white/10'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>
    </div>
    {tab === 'overview' ? <AtlasOperationsBriefing /> : null}
    {tab === 'tasks' ? <ManagerOperationalTaskQueue /> : null}
    {tab === 'compliance' ? <div className="grid gap-6 xl:grid-cols-2"><AssetReadinessPanel /><FleetComplianceForecastPanel /><DriverComplianceForecastPanel /></div> : null}
    {tab === 'operations' ? <div className="space-y-6"><PodReconciliationHealth /><PodReviewQueue /></div> : null}
    {tab === 'proposals' ? <AtlasProposalWorkbench /> : null}
    {tab === 'history' ? <OperationalTimeline /> : null}
    {tab === 'administration' ? <AtlasPolicyAdministration /> : null}
  </div>;
}

export function AtlasDashboardSummary({ onOpenAtlas }: { onOpenAtlas: () => void }) {
  const { profile } = useAuth();
  const [briefing, setBriefing] = useState<AtlasMorningBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!profile?.company_id) return;
    let cancelled = false;
    setLoading(true); setError(null);
    void fetchAtlasOperationsBriefing(profile.company_id).then((result) => { if (!cancelled) setBriefing(result); }).catch((loadError: unknown) => { if (!cancelled) setError(toProductError(loadError, 'Atlas summary is temporarily unavailable.').message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profile?.company_id]);
  const items = useMemo(() => briefing ? Object.values(briefing.sections).flat() : [], [briefing]);
  const counts = useMemo(() => ({ critical: items.filter((item) => item.severity === 'critical').length, high: items.filter((item) => item.severity === 'warning').length, upcoming: briefing?.sections.next30.length ?? 0 }), [briefing?.sections.next30.length, items]);
  return <section className="rounded-2xl border border-hw-blue-500/30 bg-gradient-to-br from-hw-blue-950 to-hw-navy-900 p-5 shadow-xl">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-hw-cyan-300"><Sparkles className="h-4 w-4" /><p className="text-[10px] font-black uppercase tracking-[0.2em]">Atlas attention summary</p></div><h4 className="mt-1 text-lg font-black text-white">What needs a manager&apos;s attention?</h4><p className="mt-1 text-xs text-hw-slate-300">A compact view of the canonical deterministic briefing. Open Atlas for source-linked detail.</p></div><button type="button" onClick={onOpenAtlas} className="rounded-lg bg-hw-cyan-500 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-hw-navy-950">Open Atlas</button></div>
    {loading ? <p className="mt-5 text-xs text-hw-slate-300">Loading current Portal signals...</p> : null}
    {!loading && error ? <p className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-200">{error}</p> : null}
    {!loading && !error ? <><div className="mt-5 grid grid-cols-3 gap-2"><SummaryCount label="Critical" value={counts.critical} tone="critical" /><SummaryCount label="High attention" value={counts.high} tone="high" /><SummaryCount label="Upcoming" value={counts.upcoming} tone="upcoming" /></div>{items.length === 0 ? <p className="mt-4 text-xs text-hw-slate-400">No current attention signal was returned.</p> : <div className="mt-4 space-y-2">{items.slice(0, 3).map((item) => <a key={item.id} href={item.href} className="block rounded-lg border border-white/10 bg-white/5 p-3 hover:bg-white/10"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-white">{item.title}</p><span className="text-[9px] font-black uppercase tracking-widest text-hw-slate-400">{item.isNew ? 'New' : 'Known'}</span></div><p className="mt-1 text-[10px] text-hw-slate-400">{item.sourceLabel}</p></a>)}</div>}</> : null}
  </section>;
}

function SummaryCount({ label, value, tone }: { label: string; value: number; tone: 'critical' | 'high' | 'upcoming' }) {
  const text = tone === 'critical' ? 'text-red-300' : tone === 'high' ? 'text-amber-300' : 'text-hw-cyan-300';
  return <div className="rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500">{label}</p><p className={`mt-1 text-2xl font-black ${text}`}>{value}</p></div>;
}
