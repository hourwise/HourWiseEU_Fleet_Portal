import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { buildDriverHoursPlanningForecast, type DriverHoursPlanningForecast } from '../../lib/driverHoursPlanning';

export function DriverHoursPlanningPanel({ fromDate, toDate }: { fromDate: string; toDate: string }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<DriverHoursPlanningForecast[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.company_id) return;
    let cancelled = false;
    void Promise.all([
      supabase.from('shifts').select('driver_id, date, start_time, end_time, status').eq('company_id', profile.company_id).gte('date', fromDate).lte('date', toDate),
      supabase.from('work_sessions').select('user_id, date, start_time, end_time, total_work_minutes').eq('company_id', profile.company_id).gte('date', fromDate).lte('date', toDate),
      supabase.from('profiles').select('id, full_name').eq('company_id', profile.company_id).eq('role', 'driver'),
    ]).then(([shiftResult, sessionResult, driverResult]) => {
      if (cancelled) return;
      const error = shiftResult.error ?? sessionResult.error ?? driverResult.error;
      if (error) { setMessage(error.message); return; }
      setRows(buildDriverHoursPlanningForecast(
        (shiftResult.data ?? []).map(shift => ({ driverId: shift.driver_id, date: shift.date, startTime: shift.start_time, endTime: shift.end_time, status: shift.status })),
        (sessionResult.data ?? []).map(session => ({ driverId: session.user_id, date: session.date, startTime: session.start_time, endTime: session.end_time, totalWorkMinutes: session.total_work_minutes })),
      ));
      setNames(Object.fromEntries((driverResult.data ?? []).map(driver => [driver.id, driver.full_name ?? 'Unnamed driver'])));
    }).catch(() => { if (!cancelled) setMessage('Hours information is not available right now.'); });
    return () => { cancelled = true; };
  }, [fromDate, profile?.company_id, toDate]);

  return <section className="rounded-2xl border border-brand-border bg-brand-card p-6"><div className="flex items-start gap-3"><Clock3 className="mt-1 text-brand-accent" /><div><h2 className="text-xl font-black text-white">Hours and rest planning</h2><p className="mt-1 text-sm text-slate-400">Actual recorded work and planned duties are shown separately. Rest is only flagged for overlapping planned duties; the operating regime is not known here.</p></div></div>{message ? <p role="alert" className="mt-4 text-sm text-red-200">{message}</p> : rows.length === 0 ? <p className="mt-4 text-sm text-slate-400">No hours or planned duties are recorded for this period.</p> : <div className="mt-5 grid gap-3 md:grid-cols-2">{rows.map(row => <div key={row.driverId} className="rounded-xl border border-brand-border bg-brand-dark/30 p-4"><p className="font-bold text-white">{names[row.driverId] ?? 'Unnamed driver'}</p><div className="mt-2 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-500">Recorded</p><p className="mt-1 font-black text-white">{formatMinutes(row.actualMinutes)}</p></div><div><p className="text-slate-500">Planned</p><p className="mt-1 font-black text-white">{formatMinutes(row.plannedMinutes)}</p></div><div><p className="text-slate-500">Review</p><p className="mt-1 font-black text-amber-200">{row.restReview === 'needs_review' ? 'Needed' : row.restReview === 'no_conflict_seen' ? 'No overlap' : 'Not assessed'}</p></div></div><p className="mt-3 text-[10px] text-slate-500">Planning aid only · operating regime unknown</p></div>)}</div>}</section>;
}

function formatMinutes(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
