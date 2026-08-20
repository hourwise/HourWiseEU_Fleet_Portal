import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchPodReconciliationDrilldown,
  fetchPodReconciliationHealth,
  type PodReconciliationDrilldownItem,
  type PodReconciliationHealth as PodHealth,
} from '../../lib/podReconciliationHealth';

export function PodReconciliationHealth() {
  const { profile } = useAuth();
  const [health, setHealth] = useState<PodHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedSignal, setExpandedSignal] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<Record<string, PodReconciliationDrilldownItem[]>>({});
  const [drilldownLoading, setDrilldownLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (profile?.role !== 'manager') return;
    setLoading(true);
    try {
      setHealth(await fetchPodReconciliationHealth());
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load POD reconciliation health.');
    } finally {
      setLoading(false);
    }
  }, [profile?.role]);

  useEffect(() => { void load(); }, [load]);
  if (profile?.role !== 'manager') return null;

  const latest = health?.lastAttemptedRun;
  const toggleDrilldown = async (signalKey: string) => {
    if (expandedSignal === signalKey) {
      setExpandedSignal(null);
      return;
    }
    setExpandedSignal(signalKey);
    if (drilldown[signalKey]) return;
    setDrilldownLoading(signalKey);
    try {
      const items = await fetchPodReconciliationDrilldown(signalKey);
      setDrilldown((current) => ({ ...current, [signalKey]: items }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load POD reconciliation drill-down.');
    } finally {
      setDrilldownLoading(null);
    }
  };

  return <section className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-widest text-hw-cyan-300">POD reconciliation health</p><p className="mt-1 text-xs text-hw-slate-400">Deterministic reconciliation alerts from the scheduled run ledger. Raw storage paths and database internals are intentionally hidden.</p></div>
      {health?.maintenanceWarning ? <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" /> : <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-300" />}
    </div>
    {loading ? <p className="mt-3 text-xs text-hw-slate-400">Loading maintenance health...</p> : message ? <p className="mt-3 text-xs text-amber-200">{message}</p> : <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HealthMetric label="Last attempt" value={latest ? new Date(latest.started_at).toLocaleString() : 'No run recorded'} />
        <HealthMetric label="Last status" value={latest?.status ?? 'Unknown'} />
        <HealthMetric label="Unhealthy streak" value={`${health?.consecutiveUnhealthyRuns ?? 0} / partial ${health?.consecutivePartialRuns ?? 0}`} />
        <HealthMetric label="Mismatch backlog" value={`${health?.mismatchBacklogCount ?? 0} ${health?.oldestMismatchAgeHours === null ? '' : `· oldest ${health?.oldestMismatchAgeHours}h`}`} />
      </div>
      {health?.alerts.map((alert) => <div key={alert.signalKey} className={`mt-3 rounded-lg border p-3 ${alert.severity === 'critical' ? 'border-red-400/30 bg-red-400/10' : 'border-amber-400/20 bg-amber-400/10'}`}>
        <div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-white">{alert.title}</p><span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-hw-slate-200">{alert.isNew ? 'new' : 'known'}</span></div>
        <p className="mt-1 text-xs text-hw-slate-300">{alert.detail}</p>
        <p className="mt-2 text-[10px] text-hw-slate-500">{alert.sourceLabel} · fingerprint {alert.fingerprint}</p>
        <button type="button" onClick={() => void toggleDrilldown(alert.signalKey)} className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-hw-cyan-300">
          {drilldownLoading === alert.signalKey ? 'Loading affected jobs...' : expandedSignal === alert.signalKey ? 'Hide affected jobs' : 'Inspect affected jobs'} <ExternalLink className="h-3 w-3" />
        </button>
        {expandedSignal === alert.signalKey ? <div className="mt-2 space-y-2">
          {drilldown[alert.signalKey]?.length ? drilldown[alert.signalKey].map((item) => <div key={item.id} className="rounded-md border border-white/10 bg-black/10 p-2">
            <p className="text-xs font-bold text-white">{item.entityLabel} · {item.title}</p>
            <p className="mt-1 text-[10px] text-hw-slate-400">{item.recommendedAction}</p>
            <a href="/dashboard?workspace=people&people=jobs" className="mt-1 inline-block text-[10px] font-black uppercase tracking-widest text-hw-cyan-300">Open job workflow</a>
          </div>) : <p className="text-[10px] text-hw-slate-500">No individual job item is available for this aggregate alert. Review the bounded run summary above.</p>}
        </div> : null}
      </div>)}
      {health?.maintenanceWarning ? <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs font-bold text-amber-100">The configured threshold has been crossed. This records operational attention; it does not delete evidence or retry work automatically.</p> : null}
      <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-hw-slate-500"><span>Last successful run: {health?.lastSuccessfulRun ? new Date(health.lastSuccessfulRun.finished_at ?? health.lastSuccessfulRun.started_at).toLocaleString() : 'No successful run recorded'}</span><button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 font-black uppercase tracking-widest text-hw-cyan-300"><RefreshCw className="h-3 w-3" />Refresh</button></div>
    </>}
  </section>;
}

function HealthMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500">{label}</p><p className="mt-1 text-xs font-bold text-white">{value}</p></div>;
}
