import { X, AlertTriangle, Clock3, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import type { TachoDaySummary, TachoFinding, TachoReconciliationItem, VehicleMotionDiscrepancy } from '../../../lib/tacho/rules/types';

interface TachoDayDetailDrawerProps {
  day: TachoDaySummary | null;
  findings: TachoFinding[];
  technicalEvents?: TachoFinding[];
  reconciliation?: TachoReconciliationItem[];
  discrepancies?: VehicleMotionDiscrepancy[];
  selectedReason?: string | null;
  onClose: () => void;
}

const minsToHours = (mins: number) => `${Math.floor(mins / 60)}h ${mins % 60}m`;

function overlapsDay(date: string, item: TachoFinding) {
  return item.periodStart.slice(0, 10) <= date && item.periodEnd.slice(0, 10) >= date;
}

export function TachoDayDetailDrawer({
  day,
  findings,
  technicalEvents = [],
  reconciliation = [],
  discrepancies = [],
  selectedReason,
  onClose,
}: TachoDayDetailDrawerProps) {
  if (!day) return null;

  const dayFindings = findings.filter((finding) => overlapsDay(day.date, finding));
  const dayTechnicalEvents = technicalEvents.filter((event) => overlapsDay(day.date, event));
  const dayReconciliation = reconciliation.filter((item) => item.date === day.date);
  const dayDiscrepancies = discrepancies.filter((item) => item.date === day.date);

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
            {selectedReason ? (
              <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900">
                {selectedReason}
              </div>
            ) : null}
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
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{finding.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{finding.summary}</p>
                      </div>
                      <SourceBadge source={finding.source} />
                    </div>
                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mt-2">{finding.ruleCode}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-amber-50 rounded-xl border border-amber-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">Technical Events</h4>
            </div>
            {dayTechnicalEvents.length === 0 ? (
              <p className="text-sm text-slate-500">No technical VU events for this day.</p>
            ) : (
              <div className="space-y-3">
                {dayTechnicalEvents.map((event) => (
                  <div key={event.id} className="bg-white rounded-lg border border-amber-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{event.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{event.summary}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <SourceBadge source={event.source} />
                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{event.ruleCode}</span>
                      </div>
                    </div>
                    {event.evidenceRefs && event.evidenceRefs.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {event.evidenceRefs.map((ref) => (
                          <span
                            key={`${event.id}-${ref.kind}-${ref.refId}`}
                            className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-800"
                          >
                            {ref.label ?? ref.kind}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-blue-50 rounded-xl border border-blue-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-black text-blue-900 uppercase tracking-widest">App Vs Tacho Cross-check</h4>
            </div>
            {dayReconciliation.length === 0 ? (
              <p className="text-sm text-slate-500">No cross-check items for this day.</p>
            ) : (
              <div className="space-y-3">
                {dayReconciliation.map((item) => (
                  <div key={item.id} className="bg-white rounded-lg border border-blue-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.summary}</p>
                        <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                          <p><span className="font-black text-slate-500 uppercase tracking-widest">App:</span> {item.appLabel}</p>
                          <p><span className="font-black text-slate-500 uppercase tracking-widest">Tacho:</span> {item.tachoLabel}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <SourceBadge source="combined" />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${crossCheckTone(item.status)}`}>
                          {item.status.split('_').join(' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-amber-50 rounded-xl border border-amber-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-amber-600" />
              <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">Vehicle Motion Review</h4>
            </div>
            {dayDiscrepancies.length === 0 ? (
              <p className="text-sm text-slate-500">No vehicle motion review items for this day.</p>
            ) : (
              <div className="space-y-3">
                {dayDiscrepancies.map((item) => (
                  <div key={item.id} className="bg-white rounded-lg border border-amber-100 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{item.summary}</p>
                        <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                          <p>
                            <span className="font-black text-slate-500 uppercase tracking-widest">Window:</span>{' '}
                            {format(new Date(item.startTime), 'HH:mm')} - {format(new Date(item.endTime), 'HH:mm')} ({minsToHours(item.durationMins)})
                          </p>
                          {item.linkedDriverName ? (
                            <p>
                              <span className="font-black text-slate-500 uppercase tracking-widest">Linked Driver:</span> {item.linkedDriverName}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <SourceBadge source="vehicle_unit" />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${discrepancyTone(item.status)}`}>
                          {item.status.split('_').join(' ')}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.severity}</span>
                      </div>
                    </div>
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
            {dayFindings.length === 0 && dayTechnicalEvents.length === 0 ? (
              <p className="text-sm text-slate-600">No evidence references were attached to this day.</p>
            ) : (
              <div className="space-y-3">
                <EvidenceGroup title="Findings" items={dayFindings} />
                <EvidenceGroup title="Technical Events" items={dayTechnicalEvents} />
                {dayReconciliation.length > 0 ? (
                  <div className="rounded-lg border border-blue-100 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900">Reconciliation</p>
                      <SourceBadge source="app" />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {dayReconciliation.length} app-vs-tacho cross-check item{dayReconciliation.length === 1 ? '' : 's'} attached to this day.
                    </p>
                  </div>
                ) : null}
                {dayDiscrepancies.length > 0 ? (
                  <div className="rounded-lg border border-blue-100 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900">Vehicle Motion Review</p>
                      <SourceBadge source="vehicle_unit" />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {dayDiscrepancies.length} discrepancy row{dayDiscrepancies.length === 1 ? '' : 's'} linked to this day.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
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

function crossCheckTone(status: TachoReconciliationItem['status']) {
  if (status === 'tacho_only') return 'text-rose-600';
  if (status === 'app_only' || status === 'mismatch_duration') return 'text-amber-600';
  return 'text-slate-500';
}

function discrepancyTone(status: VehicleMotionDiscrepancy['status']) {
  if (status === 'unassigned_motion') return 'text-rose-600';
  if (status === 'card_gap' || status === 'needs_review') return 'text-amber-600';
  return 'text-slate-500';
}

function EvidenceGroup({ title, items }: { title: string; items: TachoFinding[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border border-blue-100 bg-white p-3">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={`evidence-${item.id}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold text-slate-900">{item.title}</p>
              <SourceBadge source={item.source} />
            </div>
            {item.evidenceRefs && item.evidenceRefs.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {item.evidenceRefs.map((ref) => (
                  <span
                    key={`${item.id}-${ref.kind}-${ref.refId}`}
                    className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-blue-800"
                  >
                    {ref.label ?? ref.kind}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No structured evidence labels were stored for this item.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: TachoFinding['source'] | 'combined' | 'app' | 'vehicle_unit' }) {
  const label =
    source === 'driver_card'
      ? 'Driver Card'
      : source === 'vehicle_unit'
      ? 'Vehicle Unit'
      : source === 'app'
      ? 'App'
      : 'Derived Finding';
  const tone =
    source === 'driver_card'
      ? 'bg-blue-100 text-blue-700'
      : source === 'vehicle_unit'
      ? 'bg-amber-100 text-amber-700'
      : source === 'app'
      ? 'bg-slate-100 text-slate-700'
      : 'bg-violet-100 text-violet-700';

  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${tone}`}>{label}</span>;
}
