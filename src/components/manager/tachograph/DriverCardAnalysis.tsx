import { useMemo, useState } from 'react';
import { CreditCard, AlertTriangle, BadgeAlert, CalendarClock, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useDriverCardAnalysis } from '../../../hooks/useDriverCardAnalysis';
import { TachoActivityTimeline } from './TachoActivityTimeline';
import { TachoDayDetailDrawer } from './TachoDayDetailDrawer';
import { TachoFilters } from './TachoFilters';
import type { TachoAnalysisRange, TachoDaySummary } from '../../../lib/tacho/rules/types';

export function DriverCardAnalysis() {
  const [range, setRange] = useState<TachoAnalysisRange>('7d');
  const [selectedDay, setSelectedDay] = useState<TachoDaySummary | null>(null);
  const { data, loading, error } = useDriverCardAnalysis(range);

  const findings = data?.findings ?? [];
  const timelineDays = useMemo(
    () => (data?.dailySummaries ?? []).map((day) => ({ date: new Date(day.date), activities: day.activities, markers: day.findingsCount })),
    [data]
  );

  if (loading) return <PanelState title="Loading driver card analysis..." />;
  if (error || !data) return <PanelState title={error || 'Unable to load driver card analysis'} tone="error" />;

  const overdueStyles = data.identity.downloadStatus === 'overdue'
    ? 'bg-rose-100 text-rose-700'
    : data.identity.downloadStatus === 'due_soon'
    ? 'bg-amber-100 text-amber-700'
    : 'bg-emerald-100 text-emerald-700';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <CreditCard className="w-7 h-7 text-blue-600" />
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Driver Card Analysis</p>
                <h2 className="text-3xl font-black text-slate-900">{data.identity.driverName}</h2>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                <span>Card: {data.identity.cardNumber}</span>
                <span>Expiry: {format(new Date(data.identity.cardExpiry), 'dd MMM yyyy')}</span>
                <span>Last Download: {format(new Date(data.identity.lastDownloadAt), 'dd MMM yyyy HH:mm')}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start xl:items-end gap-3">
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest ${overdueStyles}`}>
              {data.identity.downloadStatus === 'overdue' ? 'Download Overdue' : data.identity.downloadStatus === 'due_soon' ? 'Download Due Soon' : 'Download Current'}
            </span>
            <TachoFilters value={range} onChange={setRange} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {data.metrics.map((metric) => (
          <MetricTile key={metric.label} label={metric.label} value={metric.value} tone={metric.tone} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr,1fr] gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-900">Weekly / Rolling Timeline</h3>
              <p className="text-sm text-slate-500">Defaulting to the most recent working week, with day-level drilldown.</p>
            </div>
            <button
              onClick={() => setSelectedDay(data.dailySummaries[0] ?? null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-black uppercase tracking-widest transition"
            >
              Open Latest Day
            </button>
          </div>
          <TachoActivityTimeline
            days={timelineDays}
            selectedDate={selectedDay ? new Date(selectedDay.date) : undefined}
            onSelectDate={(date) => {
              const match = data.dailySummaries.find((day) => day.date === date.toISOString().slice(0, 10));
              setSelectedDay(match ?? null);
            }}
          />
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <BadgeAlert className="w-5 h-5 text-rose-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Recent Findings</h3>
            </div>
            <div className="space-y-3">
              {findings.slice(0, 4).map((finding) => (
                <div key={finding.id} className="rounded-xl border border-slate-200 p-4 hover:border-blue-200 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{finding.title}</p>
                      <p className="text-xs text-slate-500 mt-1">{finding.summary}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">{finding.severity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">App Vs Tacho</h3>
            </div>
            <div className="space-y-3">
              {data.reconciliation.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900">{format(new Date(item.date), 'EEE d MMM')}</p>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{item.summary}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="w-5 h-5 text-blue-300" />
              <h3 className="text-sm font-black uppercase tracking-widest">Next Phase</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              This screen is now wired to mocked normalized data. Backend findings, evidence references, and live parser output can slot into the same shape without a UI rewrite.
            </p>
          </div>
        </div>
      </div>

      <TachoDayDetailDrawer day={selectedDay} findings={findings} onClose={() => setSelectedDay(null)} />
    </div>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'good' | 'warning' | 'danger' }) {
  const styles = {
    neutral: 'border-slate-200 bg-white text-slate-700',
    good: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-100 bg-amber-50 text-amber-700',
    danger: 'border-rose-100 bg-rose-50 text-rose-700',
  }[tone];

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-3xl font-black mt-2">{value}</p>
    </div>
  );
}

function PanelState({ title, tone = 'loading' }: { title: string; tone?: 'loading' | 'error' }) {
  return (
    <div className={`rounded-2xl border p-8 text-center ${tone === 'error' ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'}`}>
      {tone === 'error' ? <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" /> : <div className="w-10 h-10 border-b-2 border-blue-600 rounded-full animate-spin mx-auto mb-3" />}
      <p className={`font-bold ${tone === 'error' ? 'text-rose-700' : 'text-slate-700'}`}>{title}</p>
    </div>
  );
}
