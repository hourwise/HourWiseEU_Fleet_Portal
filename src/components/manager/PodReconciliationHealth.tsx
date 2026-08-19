import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchPodReconciliationHealth, type PodReconciliationHealth as PodHealth } from '../../lib/podReconciliationHealth';

export function PodReconciliationHealth() {
  const { profile } = useAuth();
  const [health, setHealth] = useState<PodHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (profile?.role !== 'manager') return;
    setLoading(true);
    try { setHealth(await fetchPodReconciliationHealth()); setMessage(null); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load POD reconciliation health.'); } finally { setLoading(false); }
  }, [profile?.role]);

  useEffect(() => { void load(); }, [load]);
  if (profile?.role !== 'manager') return null;

  const latest = health?.lastAttemptedRun;
  return <section className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-hw-cyan-300">POD reconciliation health</p><p className="mt-1 text-xs text-hw-slate-400">Bounded maintenance summary. Raw storage paths and database internals are intentionally hidden.</p></div>{health?.maintenanceWarning ? <AlertTriangle className="h-5 w-5 shrink-0 text-amber-300" /> : <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-300" />}</div>{loading ? <p className="mt-3 text-xs text-hw-slate-400">Loading maintenance health...</p> : message ? <p className="mt-3 text-xs text-amber-200">{message}</p> : <><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><HealthMetric label="Last attempt" value={latest ? new Date(latest.started_at).toLocaleString() : 'No run recorded'} /><HealthMetric label="Last status" value={latest?.status ?? 'Unknown'} /><HealthMetric label="Expired / removed" value={latest ? `${latest.intents_expired} / ${latest.storage_objects_removed}` : '0 / 0'} /><HealthMetric label="Mismatches / failures" value={latest ? `${latest.mismatch_count} / ${latest.failure_count}` : '0 / 0'} /></div>{health?.maintenanceWarning ? <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 p-3 text-xs font-bold text-amber-100">Three or more consecutive scheduled failures require operational attention. No automatic retry or broad cleanup is suggested.</p> : null}<div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-hw-slate-500"><span>Last successful run: {health?.lastSuccessfulRun ? new Date(health.lastSuccessfulRun.finished_at ?? health.lastSuccessfulRun.started_at).toLocaleString() : 'No successful run recorded'}</span><button type="button" onClick={() => void load()} className="inline-flex items-center gap-1 font-black uppercase tracking-widest text-hw-cyan-300"><RefreshCw className="h-3 w-3" />Refresh</button></div></>}</section>;
}

function HealthMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-black/10 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500">{label}</p><p className="mt-1 text-xs font-bold text-white">{value}</p></div>;
}
