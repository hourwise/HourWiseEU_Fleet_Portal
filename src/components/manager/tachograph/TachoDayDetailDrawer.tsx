import { X, AlertTriangle, Clock3, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import type { TachoDaySummary, TachoFinding } from '../../../lib/tacho/rules/types';

interface TachoDayDetailDrawerProps {
  day: TachoDaySummary | null;
  findings: TachoFinding[];
  onClose: () => void;
}

const minsToHours = (mins: number) => `${Math.floor(mins / 60)}h ${mins % 60}m`;

export function TachoDayDetailDrawer({ day, findings, onClose }: TachoDayDetailDrawerProps) {
  if (!day) return null;

  const dayFindings = findings.filter((finding) => finding.periodStart.startsWith(day.date));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full bg-white shadow-2xl overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Day Detail</p>
            <h3 className="text-2xl font-black text-slate-900">{format(new Date(day.date), 'EEEE d MMMM')}</h3>
            <p className="text-sm text-slate-500">App and tachograph evidence for the selected day.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard label="Driving" value={minsToHours(day.drivingMins)} tone="emerald" />
            <MetricCard label="Work" value={minsToHours(day.workMins)} tone="amber" />
            <MetricCard label="POA" value={minsToHours(day.poaMins)} tone="blue" />
            <MetricCard label="Rest" value={minsToHours(day.restMins)} tone="slate" />
          </div>

          <section className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock3 className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Activity Blocks</h4>
            </div>
            <div className="space-y-2">
              {day.activities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">{activity.label || activity.activityType.replace('_', ' ')}</p>
                    <p className="text-[11px] text-slate-500 uppercase font-black tracking-widest">
                      {format(new Date(activity.startTime), 'HH:mm')} - {format(new Date(activity.endTime), 'HH:mm')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-800">{minsToHours(activity.durationMins)}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{activity.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-rose-50 rounded-xl border border-rose-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h4 className="text-sm font-black text-rose-900 uppercase tracking-widest">Findings</h4>
            </div>
            {dayFindings.length === 0 ? (
              <p className="text-sm text-slate-500">No findings for this day.</p>
            ) : (
              <div className="space-y-3">
                {dayFindings.map((finding) => (
                  <div key={finding.id} className="bg-white rounded-lg border border-rose-100 p-3">
                    <p className="text-sm font-bold text-slate-900">{finding.title}</p>
                    <p className="text-xs text-slate-600 mt-1">{finding.summary}</p>
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mt-2">{finding.ruleCode}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-blue-50 rounded-xl border border-blue-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-black text-blue-900 uppercase tracking-widest">Evidence</h4>
            </div>
            <p className="text-sm text-slate-600">
              This drawer is wired for mocked normalized data now. Backend evidence references and parser traces will slot into this panel later.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'amber' | 'blue' | 'slate' }) {
  const styles = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    slate: 'bg-slate-100 border-slate-200 text-slate-700',
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
      <p className="text-lg font-black mt-1">{value}</p>
    </div>
  );
}
