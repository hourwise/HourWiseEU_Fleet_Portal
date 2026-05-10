import { format, differenceInMinutes, startOfDay, isSameDay } from 'date-fns';
import { TachoActivity } from '../../../lib/compliance';
import type { TachoActivitySegment } from '../../../lib/tacho/rules/types';

interface TachoActivityTimelineProps {
  activities?: TachoActivity[];
  date?: Date;
  days?: {
    date: Date;
    activities: TachoActivitySegment[];
    markers?: number;
  }[];
  selectedDate?: Date;
  onSelectDate?: (date: Date) => void;
}

export function TachoActivityTimeline({ activities, date, days, selectedDate, onSelectDate }: TachoActivityTimelineProps) {
  if (date && activities) {
    return <SingleDayTimeline activities={activities} date={date} />;
  }

  return <MultiDayTimeline days={days} selectedDate={selectedDate} onSelectDate={onSelectDate} />;
}

function SingleDayTimeline({ activities, date }: { activities: TachoActivity[]; date: Date }) {
  const dayStart = startOfDay(date);
  const totalMinutesInDay = 24 * 60;

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'driving': return 'bg-emerald-500'; // Green
      case 'work': return 'bg-amber-400';    // Yellow/Hammer
      case 'poa': return 'bg-blue-400';     // Blue/POA
      case 'rest': return 'bg-slate-300';    // Grey/Rest
      default: return 'bg-slate-200';
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case 'driving': return 'Driving';
      case 'work': return 'Other Work';
      case 'poa': return 'Availability';
      case 'rest': return 'Rest/Break';
      default: return type;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900">Activity Timeline: {format(date, 'EEEE, do MMMM')}</h4>
        <div className="flex gap-3">
          {['driving', 'work', 'poa', 'rest'].map(type => (
            <div key={type} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-sm ${getActivityColor(type)}`} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{getActivityLabel(type)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative w-full h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex">
        {activities.map((activity, index) => {
          const start = new Date(activity.start_time);
          const end = new Date(activity.end_time);

          // Calculate percentage position and width
          const offsetMins = differenceInMinutes(start, dayStart);
          const durationMins = differenceInMinutes(end, start);

          const leftPercent = (Math.max(0, offsetMins) / totalMinutesInDay) * 100;
          const widthPercent = (durationMins / totalMinutesInDay) * 100;

          if (widthPercent <= 0) return null;

          return (
            <div
              key={index}
              className={`absolute h-full transition-all group cursor-help ${getActivityColor(activity.activity_type)}`}
              style={{
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
              }}
            >
              {/* Tooltip */}
              <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded whitespace-nowrap z-10">
                <span className="font-bold">{getActivityLabel(activity.activity_type)}</span>
                <br />
                {format(start, 'HH:mm')} - {format(end, 'HH:mm')} ({durationMins} mins)
              </div>
            </div>
          );
        })}

        {/* Hour Markers */}
        {[0, 3, 6, 9, 12, 15, 18, 21].map(hour => (
          <div
            key={hour}
            className="absolute top-0 bottom-0 border-l border-slate-300/30 text-[9px] text-slate-400 pl-1 pt-1 pointer-events-none"
            style={{ left: `${(hour / 24) * 100}%` }}
          >
            {hour}:00
          </div>
        ))}
      </div>
    </div>
  );
}

function MultiDayTimeline({
  days = [],
  selectedDate,
  onSelectDate,
}: Pick<TachoActivityTimelineProps, 'days' | 'selectedDate' | 'onSelectDate'>) {
  if (!days.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
        No timeline data is available for this period.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {[
          ['driving', 'Driving', 'bg-emerald-500'],
          ['work', 'Other Work', 'bg-amber-400'],
          ['poa', 'Availability', 'bg-blue-400'],
          ['break_rest', 'Rest/Break', 'bg-slate-300'],
        ].map(([key, label, bg]) => (
          <div key={key} className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-sm ${bg}`}></span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {days.map((day) => {
          const dayStart = startOfDay(day.date);
          const totalMinutesInDay = 24 * 60;
          const isSelected = selectedDate ? isSameDay(day.date, selectedDate) : false;

          return (
            <button
              key={day.date.toISOString()}
              onClick={() => onSelectDate?.(day.date)}
              className={`w-full text-left rounded-2xl border p-4 transition ${
                isSelected ? 'border-blue-300 bg-blue-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{format(day.date, 'EEEE d MMMM')}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {day.activities.length} activity blocks
                  </p>
                </div>
                {typeof day.markers === 'number' && day.markers > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-widest">
                    {day.markers} marker{day.markers === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              <div className="relative w-full h-10 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                {day.activities.map((activity) => {
                  const start = new Date(activity.startTime);
                  const end = new Date(activity.endTime);
                  const offsetMins = differenceInMinutes(start, dayStart);
                  const durationMins = differenceInMinutes(end, start);
                  const leftPercent = (Math.max(0, offsetMins) / totalMinutesInDay) * 100;
                  const widthPercent = (durationMins / totalMinutesInDay) * 100;

                  if (widthPercent <= 0) return null;

                  return (
                    <div
                      key={activity.id}
                      className={`absolute h-full ${getRangeActivityColor(activity.activityType)} group`}
                      style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                    >
                      <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded whitespace-nowrap z-10">
                        {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getRangeActivityColor(type: TachoActivitySegment['activityType']) {
  switch (type) {
    case 'driving':
      return 'bg-emerald-500';
    case 'work':
      return 'bg-amber-400';
    case 'poa':
      return 'bg-blue-400';
    case 'break_rest':
      return 'bg-slate-300';
    default:
      return 'bg-slate-200';
  }
}
