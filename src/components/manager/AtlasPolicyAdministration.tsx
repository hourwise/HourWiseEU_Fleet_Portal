import { useEffect, useState } from 'react';
import { Lock, Save } from 'lucide-react';
import { fetchAtlasContainmentAnalytics, fetchGovernedAtlasPolicy, updateGovernedAtlasPolicy, type AtlasContainmentAnalyticsRow, type GovernedAtlasPolicy } from '../../lib/atlasPolicyAdministration';

function dateDaysAgo(days: number): string {
  const value = new Date();
  value.setDate(value.getDate() - days);
  return value.toISOString().slice(0, 10);
}

export function AtlasPolicyAdministration() {
  const [policy, setPolicy] = useState<GovernedAtlasPolicy | null>(null);
  const [analytics, setAnalytics] = useState<AtlasContainmentAnalyticsRow[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchGovernedAtlasPolicy(), fetchAtlasContainmentAnalytics(dateDaysAgo(30))]).then(([result, rows]) => {
      if (!cancelled) { setPolicy(result); setAnalytics(rows); setEnabled(result?.enabled ?? false); }
    }).catch((error: unknown) => {
      if (!cancelled) setMessage(error instanceof Error ? error.message : 'Policy administration is not available to this manager.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await updateGovernedAtlasPolicy({ enabled, allowedTiers: policy?.allowedTiers ?? ['SYNTHESIS', 'STANDARD', 'DEEP'], monthlyBudgetMinorUnits: policy?.monthlyBudgetMinorUnits ?? null, perRequestBudgetMinorUnits: policy?.perRequestBudgetMinorUnits ?? null, dailyRequestLimit: policy?.dailyRequestLimit ?? null, monthlyRequestLimit: policy?.monthlyRequestLimit ?? null });
      setPolicy(result);
      setMessage('Governed policy saved. Deterministic Atlas remains available even when inference is disabled.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the governed Atlas policy.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-hw-slate-400">Loading governed Atlas policy...</div>;
  if (!policy) return <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-xs font-bold text-hw-slate-300"><Lock className="h-4 w-4 text-hw-cyan-500" /> Atlas inference policy administration is restricted to the governed administrator permission.</div>{message ? <p className="mt-2 text-xs text-hw-slate-400">{message}</p> : null}</div>;

  const totals = analytics.reduce((summary, row) => ({ questions: summary.questions + row.total_questions, deterministic: summary.deterministic + row.deterministic_answers, faq: summary.faq + row.faq_answers, clarifications: summary.clarifications + row.clarifications, reasoning: summary.reasoning + row.reasoning_candidates, unknown: summary.unknown + row.unknown_questions }), { questions: 0, deterministic: 0, faq: 0, clarifications: 0, reasoning: 0, unknown: 0 });
  const contained = totals.deterministic + totals.faq + totals.clarifications;
  const containmentRate = totals.questions === 0 ? 0 : Math.round((contained / totals.questions) * 100);

  return <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Governed Atlas policy</p><p className="mt-1 text-xs text-hw-slate-300">Policy preferences and paid-spending authority are separate controls. This screen never activates a provider.</p></div><Lock className="h-4 w-4 text-amber-300" /></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Deterministic Atlas</p><p className="mt-1 text-sm font-bold text-hw-slate-100">ACTIVE</p><p className="mt-1 text-[10px] text-hw-slate-400">Authoritative Portal state only; no inference required.</p></div><div className="rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-hw-slate-400">Paid reasoning</p><p className="mt-1 text-sm font-bold text-hw-slate-100">NOT AVAILABLE</p><p className="mt-1 text-[10px] text-hw-slate-400">Provider: {policy.providerSlot ?? 'not configured'}; authority: {policy.paidInferenceActivationAuthority}.</p></div></div>
    <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-hw-slate-400">Last 31 days · aggregate only</p><p className="mt-2 text-xs text-hw-slate-300">{totals.questions} questions · {containmentRate}% handled without inference</p><p className="mt-1 text-[10px] text-hw-slate-500">Deterministic {totals.deterministic} · FAQ {totals.faq} · clarification {totals.clarifications} · reasoning candidates {totals.reasoning} · unknown {totals.unknown}. Raw questions and fingerprints are never returned.</p></div>
    <label className="mt-4 flex items-center gap-3 text-xs font-bold text-hw-slate-200"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Allow future approved inference tiers</label><p className="mt-2 text-[10px] text-hw-slate-500">Current approved tiers: {policy.allowedTiers.join(', ')}. This preference is not paid activation authority.</p><button type="button" onClick={() => void save()} disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-300 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-hw-navy-950 disabled:opacity-50"><Save className="h-3.5 w-3.5" />{saving ? 'Saving...' : 'Save policy'}</button>{message ? <p className="mt-3 text-xs text-hw-slate-300">{message}</p> : null}
  </div>;
}
