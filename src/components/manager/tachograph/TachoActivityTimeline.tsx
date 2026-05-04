import React from 'react';
import { format, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';
import { TachoActivity } from '../../../lib/compliance';

interface TachoActivityTimelineProps {
  activities: TachoActivity[];
  date: Date;
}

export function TachoActivityTimeline({ activities, date }: TachoActivityTimelineProps) {
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
