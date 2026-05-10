import { useMemo, useState } from 'react';
import { AlertTriangle, Gauge, ShieldAlert, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { useVehicleUnitAnalysis } from '../../../hooks/useVehicleUnitAnalysis';
import { TachoActivityTimeline } from './TachoActivityTimeline';
import { TachoDayDetailDrawer } from './TachoDayDetailDrawer';
import { TachoFilters } from './TachoFilters';
import type { TachoAnalysisRange, TachoDaySummary } from '../../../lib/tacho/rules/types';

export function VehicleUnitAnalysis() {
  const [range, setRange] = useState<TachoAnalysisRange>('7d');
  const [selectedDay, setSelectedDay] = useState<TachoDaySummary | null>(null);
  const { data, loading, error } = useVehicleUnitAnalysis(range);

  const timelineDays = useMemo(
    () => (data?.dailySummaries ?? []).map((day) => ({ date: new Date(day.date), activities: day.activities, markers: day.vuEventCount ?? 0 })),
    [data]
  );

  if (loading) return <PanelState title="Loading vehicle unit analysis..." />;
  if (error || !data) return <PanelState title={error || 'Unable to load vehicle unit analysis'} tone="error" />;

  const statusStyles = data.identity.downloadStatus === 'overdue'
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
              <Truck className="w-7 h-7 text-blue-600" />
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vehicle Unit Analysis</p>
                <h2 className="text-3xl font-black text-slate-900">{data.identity.regNumber}</h2>
              </div>
              <div className="flex flex-wrap gap-3 text-xs font-bold text-slate-500">
                <span>VU: {data.identity.vuSerial}</span>
                <span>{data.identity.makeModel}</span>
                <span>Calibration Due: {format(new Date(data.identity.calibrationDue), 'dd MMM yyyy')}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start xl:items-end gap-3">
            <span className={`px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest ${statusStyles}`}>
              {data.identity.downloadStatus === 'overdue' ? 'VU Download Overdue' : data.identity.downloadStatus === 'due_soon' ? 'VU Download Due Soon' : 'VU Download Current'}
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
              <h3 className="text-lg font-black text-slate-900">Vehicle Motion Timeline</h3>
              <p className="text-sm text-slate-500">Daily VU activity, event markers, and selectable day review.</p>
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
              <Gauge className="w-5 h-5 text-rose-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">VU Events</h3>
            </div>
            <div className="space-y-3">
              {data.findings.map((finding) => (
                <div key={finding.id} className="rounded-xl border border-slate-200 p-4">
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
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Operational Notes</h3>
            </div>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="rounded-xl bg-slate-50 border border-slate-200 p-4">Overspeed is treated as a native VU event in this workspace.</li>
              <li className="rounded-xl bg-slate-50 border border-slate-200 p-4">Harsh braking remains a later derived-safety metric unless speed-profile or telematics support is confirmed.</li>
              <li className="rounded-xl bg-slate-50 border border-slate-200 p-4">This screen is ready for technical faults, download compliance, and unassigned motion views.</li>
            </ul>
          </div>
        </div>
      </div>

      <TachoDayDetailDrawer day={selectedDay} findings={data.findings} onClose={() => setSelectedDay(null)} />
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
