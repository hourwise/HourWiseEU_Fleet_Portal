import { format } from 'date-fns';
import type {
  TachoActivitySegment,
  TachoAnalysisRange,
  TachoDaySummary,
  TachoFinding,
  VehicleMotionDiscrepancy,
} from '../../../lib/tacho/rules/types';

interface VehicleHistoryLedgerProps {
  range: TachoAnalysisRange;
  days: TachoDaySummary[];
  activitySegments: TachoActivitySegment[];
  technicalEvents: TachoFinding[];
  discrepancies: VehicleMotionDiscrepancy[];
  driverNameById: Record<string, string>;
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
}

interface DriverOccupancySummary {
  driverId: string | null;
  driverName: string;
  drivingMins: number;
  otherWorkMins: number;
  poaMins: number;
  activityBlocks: number;
}

const RANGE_LABELS: Record<TachoAnalysisRange, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '3m': '3 months',
  '6m': '6 months',
  '12m': '12 months',
};

function minsToHours(mins: number) {
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function buildDriverLabel(driverId: string | null, driverNameById: Record<string, string>) {
  if (!driverId) {
    return 'Unassigned / no card';
  }

  return driverNameById[driverId] ?? `Driver ${driverId.slice(0, 8)}`;
}

function summarizeDriversForDay(
  day: TachoDaySummary,
  activitySegments: TachoActivitySegment[],
  driverNameById: Record<string, string>
) {
  const daySegments = activitySegments.filter((segment) => segment.startTime.slice(0, 10) === day.date);
  const totals = new Map<string | null, DriverOccupancySummary>();

  for (const segment of daySegments) {
    const key = segment.driverId ?? null;
    const current = totals.get(key) ?? {
      driverId: key,
      driverName: buildDriverLabel(key, driverNameById),
      drivingMins: 0,
      otherWorkMins: 0,
      poaMins: 0,
      activityBlocks: 0,
    };

    if (segment.activityType === 'driving') {
      current.drivingMins += segment.durationMins;
    } else if (segment.activityType === 'work') {
      current.otherWorkMins += segment.durationMins;
    } else if (segment.activityType === 'poa') {
      current.poaMins += segment.durationMins;
    }

    current.activityBlocks += 1;
    totals.set(key, current);
  }

  return [...totals.values()].sort((left, right) => {
    if (right.drivingMins !== left.drivingMins) {
      return right.drivingMins - left.drivingMins;
    }
    return right.activityBlocks - left.activityBlocks;
  });
}

export function VehicleHistoryLedger({
  range,
  days,
  activitySegments,
  technicalEvents,
  discrepancies,
  driverNameById,
  selectedDate,
  onSelectDate,
}: VehicleHistoryLedgerProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vehicle History</p>
          <h3 className="mt-1 text-xl font-black text-slate-900">Who Drove This Vehicle, Day By Day</h3>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            This history ledger stays tied to the selected vehicle and shows which driver activity was paired to it across the last {RANGE_LABELS[range]}.
            Use it to answer who was driving on a given day, where VU motion went unassigned, and which dates need deeper review.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
          {days.length} recorded day{days.length === 1 ? '' : 's'} in range
        </div>
      </div>

      <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
        {days.map((day) => {
          const drivers = summarizeDriversForDay(day, activitySegments, driverNameById);
          const dayDiscrepancies = discrepancies.filter((item) => item.date === day.date);
          const dayTechnicalEvents = technicalEvents.filter(
            (event) => event.periodStart.slice(0, 10) <= day.date && event.periodEnd.slice(0, 10) >= day.date
          );
          const isSelected = selectedDate === day.date;

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate?.(day.date)}
              className={`w-full rounded-2xl border p-4 text-left transition ${
                isSelected
                  ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[160px,1fr,220px] xl:items-start">
                <div>
                  <p className="text-sm font-black text-slate-900">{format(new Date(`${day.date}T12:00:00Z`), 'EEE d MMM yyyy')}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {minsToHours(day.drivingMins)} driving
                  </p>
                </div>

                <div className="space-y-3">
                  {drivers.length > 0 ? (
                    drivers.map((driver) => (
                      <div
                        key={`${day.date}-${driver.driverId ?? 'unassigned'}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{driver.driverName}</p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              {driver.activityBlocks} activity block{driver.activityBlocks === 1 ? '' : 's'}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                              Driving {minsToHours(driver.drivingMins)}
                            </span>
                            {driver.otherWorkMins > 0 ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                                Work {minsToHours(driver.otherWorkMins)}
                              </span>
                            ) : null}
                            {driver.poaMins > 0 ? (
                              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">
                                POA {minsToHours(driver.poaMins)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                      No driver-linked segments were stored for this day.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                    VU events: {dayTechnicalEvents.length}
                  </span>
                  <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-rose-700">
                    Motion issues: {dayDiscrepancies.length}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
                    Findings: {day.findingsCount}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
