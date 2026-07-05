import { format, differenceInMinutes, startOfDay, isSameDay, addDays } from 'date-fns';
import { TachoActivity } from '../../../lib/compliance';
import type { TachoActivitySegment } from '../../../lib/tacho/rules/types';

interface TachoActivityTimelineProps {
  activities?: TachoActivity[];
  date?: Date;
  days?: {
    date: Date;
    activities: TachoActivitySegment[];
    markers?: number;
    markerGroups?: {
      label: string;
      count: number;
      tone: 'danger' | 'warning' | 'neutral';
    }[];
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

  const explicitActivities = days
    .flatMap((day) => day.activities)
    .filter((activity) => new Date(activity.endTime).getTime() > new Date(activity.startTime).getTime())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

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

      <div className="grid grid-cols-[15%,70%,15%] items-center gap-2 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
        <span>Day</span>
        <div className="relative h-4">
          {[0, 4, 8, 12, 16, 20, 24].map((hour) => (
            <span
              key={hour}
              className={`absolute top-0 ${hour === 24 ? '-translate-x-full' : '-translate-x-1/2'}`}
              style={{ left: `${(hour / 24) * 100}%` }}
            >
              {hour.toString().padStart(2, '0')}:00
            </span>
          ))}
        </div>
        <span className="text-right">Review</span>
      </div>

      <div className="max-h-[44rem] space-y-1.5 overflow-y-auto pr-1">
        {days.map((day) => {
          const isSelected = selectedDate ? isSameDay(day.date, selectedDate) : false;
          const dayRangeLabel = formatDayActivityRange(day.date, day.activities);
          const visibleSegments = buildVisibleDaySegments(day.date, explicitActivities);

          return (
            <button
              key={day.date.toISOString()}
              onClick={() => onSelectDate?.(day.date)}
              className={`w-full text-left rounded-2xl border p-2.5 transition ${
                isSelected ? 'border-blue-300 bg-blue-50/60 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="grid gap-2 xl:grid-cols-[15%,70%,15%] xl:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900">{format(day.date, 'EEE d MMM')}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wide">
                    {dayRangeLabel} | {day.activities.length} block{day.activities.length === 1 ? '' : 's'}
                  </p>
                </div>

                <div className="relative h-10 rounded-lg border border-slate-200 bg-slate-100 overflow-visible">
                  {[0, 4, 8, 12, 16, 20].map((hour) => (
                    <div
                      key={`${day.date.toISOString()}-${hour}`}
                      className="absolute top-0 bottom-0 border-l border-slate-300/40"
                      style={{ left: `${(hour / 24) * 100}%` }}
                    />
                  ))}

                  {visibleSegments.map((segment) => {
                    return (
                      <div
                        key={segment.id}
                        className={`absolute inset-y-0 ${getRangeActivityColor(segment.activityType, segment.inferred)} group overflow-visible`}
                        style={{ left: `${segment.leftPercent}%`, width: `${segment.widthPercent}%` }}
                      >
                        <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded whitespace-nowrap z-10">
                          {segment.inferred ? 'inferred rest' : segment.activityType.replace('_', ' ')} | {format(segment.start, 'HH:mm')} - {format(segment.end, 'HH:mm')}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-1 xl:flex-col xl:items-end">
                  {day.markerGroups?.filter((group) => group.count > 0).map((group) => (
                    <span
                      key={`${day.date.toISOString()}-${group.label}`}
                      title={`${group.label}: ${group.count}`}
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide whitespace-nowrap ${getMarkerToneClass(group.tone)}`}
                    >
                      {compactMarkerLabel(group.label)}: {group.count}
                    </span>
                  ))}
                  {(!day.markerGroups || day.markerGroups.every((group) => group.count === 0)) &&
                    typeof day.markers === 'number' &&
                    day.markers > 0 && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-rose-700">
                        {day.markers} marker{day.markers === 1 ? '' : 's'}
                      </span>
                    )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatDayActivityRange(dayDate: Date, activities: TachoActivitySegment[]) {
  if (activities.length === 0) return '--:-- - --:--';

  const starts = activities.map((activity) => new Date(activity.startTime));
  const ends = activities.map((activity) => new Date(activity.endTime));
  const start = starts.reduce((earliest, value) => value.getTime() < earliest.getTime() ? value : earliest);
  const end = ends.reduce((latest, value) => value.getTime() > latest.getTime() ? value : latest);
  const endLabel = isSameDay(end, dayDate) ? format(end, 'HH:mm') : format(end, 'EEE HH:mm');

  return `${format(start, 'HH:mm')} - ${endLabel}`;
}

interface VisibleDaySegment {
  id: string;
  activityType: TachoActivitySegment['activityType'];
  start: Date;
  end: Date;
  leftPercent: number;
  widthPercent: number;
  inferred: boolean;
}

interface SourceDaySegment {
  id: string;
  activityType: TachoActivitySegment['activityType'];
  start: Date;
  end: Date;
  inferred: boolean;
}

function buildVisibleDaySegments(dayDate: Date, explicitActivities: TachoActivitySegment[]): VisibleDaySegment[] {
  const dayStart = startOfDay(dayDate);
  const dayEnd = addDays(dayStart, 1);
  const totalMinutesInDay = 24 * 60;
  const sourceSegments: SourceDaySegment[] = [
    ...explicitActivities.map((activity) => ({
      id: activity.id,
      activityType: activity.activityType,
      start: new Date(activity.startTime),
      end: new Date(activity.endTime),
      inferred: false,
    })),
    ...buildInferredRestSegments(explicitActivities),
  ];

  return sourceSegments
    .reduce<VisibleDaySegment[]>((segments, segment) => {
      const start = new Date(Math.max(segment.start.getTime(), dayStart.getTime()));
      const end = new Date(Math.min(segment.end.getTime(), dayEnd.getTime()));
      const durationMins = differenceInMinutes(end, start);
      if (durationMins <= 0) return segments;

      segments.push({
        id: `${segment.id}-${format(dayStart, 'yyyy-MM-dd')}-${start.getTime()}`,
        activityType: segment.activityType,
        start,
        end,
        leftPercent: (differenceInMinutes(start, dayStart) / totalMinutesInDay) * 100,
        widthPercent: (durationMins / totalMinutesInDay) * 100,
        inferred: segment.inferred,
      });
      return segments;
    }, [])
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function buildInferredRestSegments(explicitActivities: TachoActivitySegment[]) {
  const minimumQualifyingRestMinutes = 9 * 60;
  const maximumDailyRestDisplayMinutes = 24 * 60;
  const inferred: Array<{
    id: string;
    activityType: TachoActivitySegment['activityType'];
    start: Date;
    end: Date;
    inferred: true;
  }> = [];

  for (let index = 0; index < explicitActivities.length - 1; index += 1) {
    const currentEnd = new Date(explicitActivities[index].endTime);
    const nextStart = new Date(explicitActivities[index + 1].startTime);
    const gapMins = differenceInMinutes(nextStart, currentEnd);
    if (gapMins < minimumQualifyingRestMinutes) continue;
    if (gapMins > maximumDailyRestDisplayMinutes) continue;

    inferred.push({
      id: `inferred-rest-${explicitActivities[index].id}-${explicitActivities[index + 1].id}`,
      activityType: 'break_rest',
      start: currentEnd,
      end: nextStart,
      inferred: true,
    });
  }

  return inferred;
}

function getRangeActivityColor(type: TachoActivitySegment['activityType'], inferred = false) {
  switch (type) {
    case 'driving':
      return 'bg-emerald-500';
    case 'work':
      return 'bg-amber-400';
    case 'poa':
      return 'bg-blue-400';
    case 'break_rest':
      return inferred ? 'bg-slate-300/80' : 'bg-slate-300';
    default:
      return 'bg-slate-200';
  }
}

function getMarkerToneClass(tone: 'danger' | 'warning' | 'neutral') {
  switch (tone) {
    case 'danger':
      return 'bg-rose-100 text-rose-700';
    case 'warning':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function compactMarkerLabel(label: string) {
  switch (label.toLowerCase()) {
    case 'findings':
      return 'F';
    case 'cross-check':
      return 'X';
    case 'linked vu':
      return 'VU';
    default:
      return label;
  }
}
