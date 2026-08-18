import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, HelpCircle, ExternalLink, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { fetchAssetReadinessSnapshot } from '../../lib/assetReadinessLoad';
import { fetchAtlasOperationsBriefing } from '../../lib/atlasOperationalLoad';
import type { AssetReadinessResult } from '../../lib/assetCompliance';
import type { AtlasBriefingItem } from '../../lib/atlasBriefing';
import { buildComplianceForecast, forecastNeedsAction, type ComplianceForecastItem, type ForecastHorizon } from '../../lib/complianceForecast';

export function AssetReadinessPanel() {
  const { profile } = useAuth();
  const [assets, setAssets] = useState<AssetReadinessResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.company_id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchAssetReadinessSnapshot(profile.company_id).then((result) => {
      if (!cancelled) setAssets(result);
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load asset readiness.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [profile?.company_id]);

  const counts = useMemo(() => ({
    ready: assets.filter((asset) => asset.status === 'ready').length,
    warning: assets.filter((asset) => asset.status === 'warning').length,
    action: assets.filter((asset) => asset.status === 'action_required').length,
    prohibited: assets.filter((asset) => asset.status === 'prohibited').length,
    unknown: assets.filter((asset) => asset.status === 'unknown').length,
  }), [assets]);

  return (
    <section className="rounded-2xl border border-white/5 bg-hw-navy-900 p-6 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-hw-cyan-500">Asset readiness engine</p><h4 className="mt-1 text-lg font-bold text-hw-white">Can these assets be assigned?</h4><p className="mt-1 text-xs leading-relaxed text-hw-slate-400">Rules use current vehicle, defect, document, and expiry evidence. Missing evidence remains unknown.</p></div>
        <ShieldAlert className="h-6 w-6 shrink-0 text-hw-cyan-500" />
      </div>
      {error ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-300">{error}</div> : null}
      {loading ? <div className="mt-5 flex items-center gap-2 text-xs font-bold text-hw-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Evaluating asset evidence...</div> : assets.length === 0 ? <div className="mt-5 rounded-xl border border-white/5 bg-hw-navy-950/50 p-4 text-xs font-bold text-hw-slate-400">No asset records are available for this company.</div> : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5"><ReadinessCount label="Ready" value={counts.ready} tone="ready" /><ReadinessCount label="Warning" value={counts.warning} tone="warning" /><ReadinessCount label="Action" value={counts.action} tone="action" /><ReadinessCount label="Blocked" value={counts.prohibited} tone="blocked" /><ReadinessCount label="Unknown" value={counts.unknown} tone="unknown" /></div>
          <div className="mt-5 space-y-2">{assets.filter((asset) => asset.status !== 'ready').slice(0, 6).map((asset) => <div key={asset.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-hw-navy-950/50 p-3"><div><p className="text-sm font-bold text-hw-white">{asset.label}</p><p className="mt-1 text-xs text-hw-slate-400">{asset.reasons[0]?.label ?? 'No readiness explanation recorded.'}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest ${statusClass(asset.status)}`}>{asset.status.replace('_', ' ')}</span></div>)}</div>
          {assets.every((asset) => asset.status === 'ready') ? <div className="mt-4 flex items-center gap-2 text-xs font-bold text-hw-slate-400"><CheckCircle2 className="h-4 w-4 text-hw-emerald-400" /> All loaded assets have current evidence with no blocking rule result.</div> : null}
        </>
      )}
    </section>
  );
}

export function AtlasOperationsBriefing() {
  const { profile } = useAuth();
  const [items, setItems] = useState<AtlasBriefingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.company_id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchAtlasOperationsBriefing(profile.company_id).then((result) => {
      if (!cancelled) setItems(result);
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load the operations briefing.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [profile?.company_id]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-hw-blue-500/30 bg-gradient-to-br from-hw-blue-950 to-hw-navy-900 p-6 shadow-xl">
      <div className="absolute right-0 top-0 p-5 opacity-10"><Sparkles size={96} /></div>
      <div className="relative"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-hw-cyan-500" /><p className="text-[10px] font-black uppercase tracking-[0.22em] text-hw-cyan-500">Atlas operations briefing</p></div><h4 className="mt-1 text-lg font-bold text-hw-white">Deterministic attention queue</h4><p className="mt-1 max-w-xl text-xs leading-relaxed text-hw-slate-300">Structured Portal signals only. Each item links to its source workspace; no generated operational facts are used.</p>
        {error ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-300">{error}</div> : null}
        {loading ? <div className="mt-5 flex items-center gap-2 text-xs font-bold text-hw-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> Building briefing from Portal data...</div> : items.length === 0 ? <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-xs font-bold text-hw-slate-300"><HelpCircle className="h-4 w-4 text-hw-cyan-500" /> No attention item was returned from the current data set.</div> : <div className="relative mt-5 space-y-2">{items.map((item) => <a key={item.id} href={item.href} className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10"><div className="flex gap-3"><BriefingIcon severity={item.severity} /><div><p className="text-sm font-bold text-hw-white">{item.title}</p><p className="mt-1 text-xs leading-relaxed text-hw-slate-300">{item.detail}</p><p className="mt-2 text-[9px] font-black uppercase tracking-widest text-hw-slate-500">Source: {item.sourceLabel}</p></div></div><ExternalLink className="mt-1 h-4 w-4 shrink-0 text-hw-slate-500" /></a>)}</div>}
      </div>
    </section>
  );
}

export function FleetComplianceForecastPanel() {
  const { profile } = useAuth();
  const [items, setItems] = useState<ComplianceForecastItem[]>([]);
  const [horizon, setHorizon] = useState<ForecastHorizon | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!profile?.company_id) return;
    let cancelled = false;
    setLoading(true); setError(null);
    void Promise.all([
      fetchAssetReadinessSnapshot(profile.company_id),
      supabase.from('shifts').select('id, date, vehicle_id').eq('company_id', profile.company_id).in('status', ['published', 'updated']),
      supabase.from('job_assignments').select('id, shift_id, vehicle_id').eq('company_id', profile.company_id).neq('status', 'cancelled'),
    ]).then(([assets, shiftResult, assignmentResult]) => {
      if (shiftResult.error) throw shiftResult.error;
      if (assignmentResult.error) throw assignmentResult.error;
      const shiftDates = new Map((shiftResult.data ?? []).map((shift) => [shift.id, { date: shift.date, vehicleId: shift.vehicle_id }]));
      const assignments = (assignmentResult.data ?? []).map((assignment) => ({ id: assignment.id, vehicleId: assignment.vehicle_id ?? shiftDates.get(assignment.shift_id)?.vehicleId ?? null, plannedDate: shiftDates.get(assignment.shift_id)?.date ?? null }));
      if (!cancelled) setItems(assets.flatMap((asset) => buildComplianceForecast(asset, new Date(), assignments)));
    }).catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load compliance forecast.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profile?.company_id]);
  const visible = items.filter((item) => horizon === 'all' || item.horizon === horizon).sort((left, right) => severityRank(left.severity) - severityRank(right.severity) || (left.daysRemaining ?? 999) - (right.daysRemaining ?? 999));
  const actionCount = items.filter(forecastNeedsAction).length;
  return <section className="rounded-2xl border border-hw-blue-500/30 bg-hw-navy-900 p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-hw-cyan-500">Compliance forecast</p><h4 className="mt-1 text-lg font-bold text-hw-white">Evidence horizon, not a legal certainty</h4><p className="mt-1 text-xs leading-relaxed text-hw-slate-400">Deterministic dates from current vehicle evidence. Missing and unknown evidence are kept distinct; future planning warnings do not hard-block assignment.</p></div><ShieldAlert className="h-6 w-6 text-hw-cyan-500" /></div><div className="mt-4 flex flex-wrap gap-2">{(['all', 'overdue', 7, 14, 30, 60, 90] as const).map((value) => <button key={String(value)} type="button" onClick={() => setHorizon(value)} className={`rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest ${horizon === value ? 'bg-hw-cyan-500 text-hw-navy-950' : 'bg-white/5 text-hw-slate-300'}`}>{value === 'all' ? 'all' : value === 'overdue' ? 'overdue' : `≤${value}d`} {value === 'all' ? items.length : items.filter((item) => item.horizon === value).length}</button>)}</div>{error ? <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-300">{error}</p> : loading ? <p className="mt-5 text-xs text-hw-slate-400">Building evidence forecast…</p> : <><p className="mt-4 text-xs font-bold text-hw-slate-400">{actionCount} item(s) meet the task/Atlas action threshold (overdue, ≤14 days, or missing required evidence).</p><div className="mt-4 space-y-2">{visible.slice(0, 12).map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-hw-navy-950/50 p-3"><div><p className="text-sm font-bold text-hw-white">{item.assetLabel} · {item.label}</p><p className="mt-1 text-xs text-hw-slate-400">{item.status === 'missing' ? 'Evidence missing' : item.status === 'expired' ? `Expired ${Math.abs(item.daysRemaining ?? 0)} day(s) ago` : item.daysRemaining === null ? 'Date is unknown' : `Due in ${item.daysRemaining} day(s)`}{item.planningRisk === 'planned_after_expiry' ? ' · future planning conflict flagged' : ''}</p></div><span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-hw-slate-300">{item.status.replace('_', ' ')}</span></div>)}{visible.length === 0 ? <p className="text-xs text-hw-slate-400">No forecast item matches this horizon.</p> : null}</div></>}</section>;
}

function ReadinessCount({ label, value, tone }: { label: string; value: number; tone: 'ready' | 'warning' | 'action' | 'blocked' | 'unknown' }) {
  return <div className="rounded-xl border border-white/5 bg-hw-navy-950/50 p-3"><p className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500">{label}</p><p className={`mt-1 text-xl font-black ${statusClass(tone === 'action' ? 'action_required' : tone === 'blocked' ? 'prohibited' : tone)}`}>{value}</p></div>;
}

function BriefingIcon({ severity }: { severity: AtlasBriefingItem['severity'] }) {
  return severity === 'critical' ? <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-red-400" /> : severity === 'warning' ? <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-400" /> : <HelpCircle className="mt-1 h-4 w-4 shrink-0 text-hw-cyan-500" />;
}

function statusClass(status: string) {
  if (status === 'ready') return 'text-emerald-400';
  if (status === 'warning') return 'text-amber-400';
  if (status === 'action_required') return 'text-orange-400';
  if (status === 'prohibited') return 'text-red-400';
  return 'text-slate-400';
}

function severityRank(value: ComplianceForecastItem['severity']) { return value === 'critical' ? 0 : value === 'high' ? 1 : value === 'medium' ? 2 : 3; }
