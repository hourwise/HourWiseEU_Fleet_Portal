import { useState, useEffect, useCallback, useMemo, useReducer, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Users, Truck, Clock, X, Save, Send, Ban, ClipboardList, RefreshCw } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { canCancelShift, canPlanJobsForShift, canPublishShift, type ShiftStatus } from '../../lib/shiftActions';
import {
  buildShiftJobSummaries,
  emptyShiftJobSummary,
  firstJobDisplayLabel,
  formatPlannedArrivalTime,
  type ShiftJobSummary,
  type ShiftJobSummaryRow,
} from '../../lib/shiftJobSummary';
import {
  INITIAL_WEEKLY_JOB_SUMMARY_LOAD,
  weeklyJobSummaryLoadReducer,
} from '../../lib/weeklyJobSummaryLoad';
import {
  INITIAL_WEEKLY_ROSTER_LOAD,
  weeklyRosterLoadReducer,
} from '../../lib/weeklyRosterLoad';

interface Shift {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  status: ShiftStatus;
  published_at: string | null;
  published_by: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  notes: string | null;
  profiles?: { full_name: string };
  vehicles?: { reg_number: string };
}

interface Driver {
  id: string;
  full_name: string;
}

interface Vehicle {
  id: string;
  reg_number: string;
}

interface ShiftPlannerProps {
  /** Opens the Job Planner focused on a published/updated shift from the rota. */
  onOpenJobPlanner?: (shiftId: string) => void;
}

export function ShiftPlanner({ onOpenJobPlanner }: ShiftPlannerProps = {}) {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Partial<Shift> | null>(null);
  const [actionMessage, setActionMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<{ shiftId: string; action: 'publish' | 'cancel' } | null>(null);
  const [savingShift, setSavingShift] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [weeklyJobSummaryLoad, dispatchWeeklyJobSummaryLoad] = useReducer(weeklyJobSummaryLoadReducer, INITIAL_WEEKLY_JOB_SUMMARY_LOAD);
  const [weeklyRosterLoad, dispatchWeeklyRosterLoad] = useReducer(weeklyRosterLoadReducer, INITIAL_WEEKLY_ROSTER_LOAD);
  const weeklyLoadTokenRef = useRef(0);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekDays = useMemo(() => [...Array(7)].map((_, i) => addDays(weekStart, i)), [weekStart]);
  const loading = weeklyRosterLoad.loading;
  const jobSummaryLoading = weeklyJobSummaryLoad.loading;
  const jobSummaryError = weeklyJobSummaryLoad.error;
  const jobSummaries = weeklyJobSummaryLoad.summaries;

  // One query for the whole week's job assignments, restricted to this company
  // and selecting only the fields the rota summary needs.
  const loadJobSummaries = useCallback(async (shiftIds: string[], weekStartKey: string, requestToken: number) => {
    const companyId = profile?.company_id;
    if (!companyId) {
      dispatchWeeklyJobSummaryLoad({ type: 'resolve', requestToken, weekStart: weekStartKey, summaries: null, error: 'Company context is unavailable.' });
      return;
    }
    if (shiftIds.length === 0) {
      dispatchWeeklyJobSummaryLoad({ type: 'resolve', requestToken, weekStart: weekStartKey, summaries: {}, error: null });
      return;
    }
    const { data, error } = await supabase
      .from('job_assignments')
      .select('shift_id, sequence, status, planned_arrival_at, jobs:job_id(reference, title, job_type, customer_name, address_text)')
      .eq('company_id', companyId)
      .in('shift_id', shiftIds);
    dispatchWeeklyJobSummaryLoad({
      type: 'resolve',
      requestToken,
      weekStart: weekStartKey,
      summaries: error ? null : buildShiftJobSummaries((data ?? []) as ShiftJobSummaryRow[]),
      error: error ? error.message : null,
    });
  }, [profile?.company_id]);

  const beginWeeklyJobSummaryLoad = useCallback((shiftIds: string[], weekStartKey: string, requestToken: number) => {
    // The summary load inherits the authoritative weekly-request token, so a
    // stale roster response can never manufacture a newer summary token.
    dispatchWeeklyJobSummaryLoad({ type: 'begin', requestToken, weekStart: weekStartKey });
    void loadJobSummaries(shiftIds, weekStartKey, requestToken);
  }, [loadJobSummaries]);

  const retryJobSummaries = useCallback(() => {
    if (!profile?.company_id) return;
    // A summary-only retry establishes its own authoritative token so it can
    // supersede any in-flight summary response for this week.
    const requestToken = weeklyLoadTokenRef.current + 1;
    weeklyLoadTokenRef.current = requestToken;
    beginWeeklyJobSummaryLoad(shifts.map(s => s.id), format(weekStart, 'yyyy-MM-dd'), requestToken);
  }, [beginWeeklyJobSummaryLoad, profile?.company_id, shifts, weekStart]);

  const loadData = useCallback(async () => {
    if (!profile?.company_id) return;
    // Allocate the authoritative weekly-request token the moment the week load
    // starts and associate it with this week. Every asynchronous result is
    // checked against the latest token before it may touch state, so a slower
    // old-week request can never replace the displayed week or start a new
    // authoritative summary request.
    const requestToken = weeklyLoadTokenRef.current + 1;
    weeklyLoadTokenRef.current = requestToken;
    const weekStartKey = format(weekStart, 'yyyy-MM-dd');
    dispatchWeeklyRosterLoad({ type: 'begin', requestToken, weekStart: weekStartKey });
    const isCurrent = () => requestToken === weeklyLoadTokenRef.current;
    try {
      // Load drivers
      const { data: driversData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', profile.company_id)
        .eq('role', 'driver');
      if (!isCurrent()) return;
      setDrivers(driversData || []);

      // Load vehicles
      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('id, reg_number')
        .eq('company_id', profile.company_id);
      if (!isCurrent()) return;
      setVehicles(vehiclesData || []);

      // Load shifts for the current week
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

      const { data: shiftsData, error: shiftsError } = await supabase
        .from('shifts')
        .select(`
          *,
          profiles:driver_id(full_name),
          vehicles:vehicle_id(reg_number)
        `)
        .eq('company_id', profile.company_id)
        .gte('date', startDate)
        .lte('date', endDate);
      if (!isCurrent()) return;
      if (shiftsError) throw shiftsError;
      const loadedShifts = (shiftsData || []).map(normaliseShift);
      setShifts(loadedShifts);
      // Load the week's job summaries in one query, inheriting this week's
      // request token; a summary failure never hides the roster itself.
      beginWeeklyJobSummaryLoad(loadedShifts.map(s => s.id), weekStartKey, requestToken);
    } catch (err) {
      if (!isCurrent()) return;
      console.error('Error loading shift data:', err);
    } finally {
      // The reducer drops a stale week's completion, so only the latest
      // request can clear the roster loading state.
      dispatchWeeklyRosterLoad({ type: 'settle', requestToken });
    }
  }, [profile?.company_id, weekStart, beginWeeklyJobSummaryLoad]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddShift = (driverId: string, date: Date) => {
    setSelectedShift({
      driver_id: driverId,
      date: format(date, 'yyyy-MM-dd'),
      start_time: '08:00',
      end_time: '17:00',
      vehicle_id: vehicles[0]?.id || null,
      status: 'draft',
      published_at: null,
      published_by: null,
      cancelled_at: null,
      cancelled_by: null,
      notes: ''
    });
    setShowModal(true);
  };

  const handleEditShift = (shift: Shift) => {
    setSelectedShift(shift);
    setShowModal(true);
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShift || !profile?.company_id || savingShift) return;
    setSavingShift(true);
    setModalError(null);

    try {
      const shiftData = {
        company_id: profile.company_id,
        driver_id: selectedShift.driver_id!,
        vehicle_id: selectedShift.vehicle_id,
        date: selectedShift.date!,
        start_time: selectedShift.start_time!,
        end_time: selectedShift.end_time!,
        status: getStatusAfterManagerEdit(selectedShift.status),
        notes: selectedShift.notes
      };

      if (selectedShift.id) {
        const { error } = await supabase.rpc('update_shift_with_event' as never, {
          p_shift_id: selectedShift.id,
          p_date: shiftData.date,
          p_start_time: shiftData.start_time,
          p_end_time: shiftData.end_time,
          p_vehicle_id: shiftData.vehicle_id,
          p_notes: shiftData.notes,
          p_requires_ack: true,
        } as never);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shifts')
          .insert(shiftData);
        if (error) throw error;
      }

      setShowModal(false);
      setActionMessage({ kind: 'success', text: selectedShift.id ? 'Shift updated.' : 'Shift draft saved.' });
      void loadData();
    } catch (err) {
      console.error('Error saving shift:', err);
      setModalError(err instanceof Error ? `Failed to save shift: ${err.message}` : 'Failed to save shift.');
    } finally {
      setSavingShift(false);
    }
  };

  const handlePublishShift = async (shift: Shift) => {
    if (!profile?.id || pendingAction || !canPublishShift(shift.status)) return;

    setPendingAction({ shiftId: shift.id, action: 'publish' });
    setActionMessage(null);
    try {
      const { error } = await supabase.rpc('publish_shift_with_event' as never, {
        p_shift_id: shift.id,
        p_requires_ack: true,
      } as never);
      if (error) throw error;
      setActionMessage({ kind: 'success', text: `Shift ${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)} published to the driver's rota.` });
      void loadData();
    } catch (err) {
      console.error('Error publishing shift:', err);
      setActionMessage({ kind: 'error', text: err instanceof Error ? `Failed to publish shift: ${err.message}` : 'Failed to publish shift.' });
    } finally {
      setPendingAction(null);
    }
  };

  const handleCancelShift = async (shift: Shift) => {
    if (!profile?.id || pendingAction || !canCancelShift(shift.status)) return;
    if (!confirm('Cancel this shift? Drivers will no longer see it in their rota.')) return;

    setPendingAction({ shiftId: shift.id, action: 'cancel' });
    setActionMessage(null);
    try {
      const { error } = await supabase.rpc('cancel_shift_with_event' as never, {
        p_shift_id: shift.id,
        p_requires_ack: true,
      } as never);
      if (error) throw error;
      setActionMessage({ kind: 'success', text: 'Shift cancelled.' });
      void loadData();
    } catch (err) {
      console.error('Error cancelling shift:', err);
      setActionMessage({ kind: 'error', text: err instanceof Error ? `Failed to cancel shift: ${err.message}` : 'Failed to cancel shift.' });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-8 h-8 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-white">Shift Roster</h2>
            <p className="text-slate-400">Weekly schedule for drivers and vehicles</p>
          </div>
        </div>

        <div className="flex items-center bg-brand-card rounded-xl p-1 border border-brand-border">
          <button
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
            className="p-2 hover:bg-brand-dark rounded-lg transition text-slate-400 hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 font-bold text-sm text-white min-w-[200px] text-center">
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </div>
          <button
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
            className="p-2 hover:bg-brand-dark rounded-lg transition text-slate-400 hover:text-white"
          >
            <ChevronRight size={20} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="ml-2 px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-brand-dark text-slate-400 hover:text-white rounded-md border border-brand-border transition"
          >
            Today
          </button>
        </div>
      </div>

      {actionMessage ? (
        <div
          role="alert"
          className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-sm ${actionMessage.kind === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}
        >
          <p className="font-medium">{actionMessage.text}</p>
          <button type="button" onClick={() => setActionMessage(null)} className="shrink-0 text-slate-400 hover:text-white transition" aria-label="Dismiss message">
            <X size={16} />
          </button>
        </div>
      ) : null}

      {jobSummaryError ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100"
        >
          <p className="font-medium">
            Job summaries could not be loaded. Shift planning remains available.
            <span className="block text-xs text-amber-200/80">{jobSummaryError}</span>
          </p>
          <button
            type="button"
            onClick={retryJobSummaries}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-brand-accent px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-accent-dark"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      ) : null}

      <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-brand-dark/50 border-b border-brand-border">
                <th className="p-4 text-left min-w-[200px] sticky left-0 bg-brand-card z-10 border-r border-brand-border">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
                    <Users size={14} /> Driver
                  </div>
                </th>
                {weekDays.map((day) => (
                  <th key={day.toString()} className="p-4 min-w-[160px] text-center">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      {format(day, 'EEEE')}
                    </div>
                    <div className={`text-lg font-black ${isSameDay(day, new Date()) ? 'text-brand-accent' : 'text-white'}`}>
                      {format(day, 'd MMM')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    Loading roster...
                  </td>
                </tr>
              ) : drivers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500">
                    No drivers found. Add drivers in the Drivers tab to start planning.
                  </td>
                </tr>
              ) : (
                drivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-white/5 transition-colors group">
                    <td className="p-4 sticky left-0 bg-brand-card z-10 border-r border-brand-border">
                      <div className="font-bold text-white">{driver.full_name}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-tight">HGV Driver</div>
                    </td>
                    {weekDays.map((day) => {
                      const dayShifts = shifts.filter(s => s.driver_id === driver.id && s.date === format(day, 'yyyy-MM-dd'));
                      return (
                        <td key={day.toString()} className="p-2 relative min-h-[100px] align-top">
                          <div className="min-h-[74px] space-y-2">
                            {dayShifts.map((shift) => (
                              <div
                                key={shift.id}
                                onClick={() => handleEditShift(shift)}
                                className={`p-2 rounded-lg border transition cursor-pointer group/shift shadow-sm ${getShiftCardClass(shift.status)}`}
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <div className="text-[10px] font-black text-brand-accent uppercase flex items-center gap-1">
                                    <Clock size={10} /> {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                                  </div>
                                  {canCancelShift(shift.status) ? (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); void handleCancelShift(shift); }}
                                      disabled={pendingAction !== null}
                                      className="opacity-0 group-hover/shift:opacity-100 text-slate-500 hover:text-red-500 transition disabled:cursor-not-allowed disabled:opacity-40"
                                      title="Cancel shift"
                                      aria-label="Cancel shift"
                                    >
                                      <X size={12} />
                                    </button>
                                  ) : null}
                                </div>
                                <div className="mb-2 flex flex-wrap items-center gap-1">
                                  <ShiftStatusBadge status={shift.status} />
                                  {canPublishShift(shift.status) ? (
                                    <button
                                      type="button"
                                      disabled={pendingAction !== null}
                                      onClick={(e) => { e.stopPropagation(); void handlePublishShift(shift); }}
                                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-emerald-300 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      <Send size={9} /> {pendingAction?.shiftId === shift.id && pendingAction.action === 'publish' ? 'Publishing…' : 'Publish'}
                                    </button>
                                  ) : null}
                                  {canPlanJobsForShift(shift.status) ? (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); onOpenJobPlanner?.(shift.id); }}
                                      className="inline-flex items-center gap-1 rounded-full bg-brand-accent/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-brand-accent hover:bg-brand-accent/25"
                                    >
                                      <ClipboardList size={9} /> Plan jobs
                                    </button>
                                  ) : null}
                                  {shift.status === 'cancelled' ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-red-300">
                                      <Ban size={9} /> Hidden from driver
                                    </span>
                                  ) : null}
                                </div>
                                {shift.vehicles?.reg_number && (
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-white uppercase tracking-tight">
                                    <Truck size={10} className="text-slate-400" /> {shift.vehicles.reg_number}
                                  </div>
                                )}
                                {shift.notes && (
                                  <div className="text-[9px] text-slate-400 mt-1 truncate italic">
                                    {shift.notes}
                                  </div>
                                )}
                                {canPlanJobsForShift(shift.status) ? (
                                  <ShiftJobSummaryBlock
                                    summary={jobSummaries[shift.id]}
                                    loading={jobSummaryLoading}
                                    hasError={Boolean(jobSummaryError)}
                                  />
                                ) : null}
                              </div>
                            ))}
                            <button
                              onClick={() => handleAddShift(driver.id, day)}
                              className="w-full rounded-lg border border-dashed border-brand-border/80 py-2 text-slate-500 transition flex items-center justify-center gap-1 hover:text-brand-accent hover:border-brand-accent hover:bg-brand-accent/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                            >
                              <Plus size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">Add Shift</span>
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && selectedShift && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-brand-card rounded-2xl w-full max-w-md border border-brand-border shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-6 border-b border-brand-border bg-brand-dark/50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus className="text-brand-accent" /> {selectedShift.id ? 'Edit Shift' : 'New Shift'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white transition"><X /></button>
            </div>

            <form onSubmit={handleSaveShift} className="p-6 space-y-4">
              <div className="p-3 bg-brand-dark/50 rounded-xl border border-brand-border flex items-center gap-3">
                <Users className="text-slate-400" size={20} />
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Driver</p>
                  <p className="text-sm font-bold text-white">
                    {drivers.find(d => d.id === selectedShift.driver_id)?.full_name}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Shift Date</label>
                <input
                  type="date"
                  required
                  className="w-full bg-brand-dark border border-brand-border rounded-xl p-3 text-white focus:ring-2 focus:ring-brand-accent outline-none"
                  value={selectedShift.date}
                  onChange={e => setSelectedShift({...selectedShift, date: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Start Time</label>
                  <input
                    type="time"
                    required
                    className="w-full bg-brand-dark border border-brand-border rounded-xl p-3 text-white focus:ring-2 focus:ring-brand-accent outline-none"
                    value={selectedShift.start_time}
                    onChange={e => setSelectedShift({...selectedShift, start_time: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">End Time</label>
                  <input
                    type="time"
                    required
                    className="w-full bg-brand-dark border border-brand-border rounded-xl p-3 text-white focus:ring-2 focus:ring-brand-accent outline-none"
                    value={selectedShift.end_time}
                    onChange={e => setSelectedShift({...selectedShift, end_time: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Vehicle</label>
                <select
                  className="w-full bg-brand-dark border border-brand-border rounded-xl p-3 text-white focus:ring-2 focus:ring-brand-accent outline-none appearance-none"
                  value={selectedShift.vehicle_id || ''}
                  onChange={e => setSelectedShift({...selectedShift, vehicle_id: e.target.value || null})}
                >
                  <option value="">No Vehicle</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.reg_number}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1.5 tracking-widest">Notes (Optional)</label>
                <textarea
                  className="w-full bg-brand-dark border border-brand-border rounded-xl p-3 text-white focus:ring-2 focus:ring-brand-accent outline-none h-24 resize-none"
                  placeholder="Additional instructions..."
                  value={selectedShift.notes || ''}
                  onChange={e => setSelectedShift({...selectedShift, notes: e.target.value})}
                />
              </div>

              {modalError ? <p role="alert" className="text-sm text-red-300">{modalError}</p> : null}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={savingShift}
                  className="flex-1 py-3 border border-brand-border rounded-xl font-black text-slate-400 hover:bg-brand-dark transition uppercase tracking-widest text-[10px] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingShift}
                  className="flex-1 py-3 bg-brand-accent text-white rounded-xl font-black hover:bg-brand-accent-dark transition shadow-lg shadow-brand-accent/20 uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Save size={16} /> {savingShift ? 'Saving…' : (selectedShift.id ? 'Save Update' : 'Save Draft')}
                </button>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                New shifts are saved as drafts. Publish them from the roster grid when ready for the driver.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusAfterManagerEdit(status?: ShiftStatus): ShiftStatus {
  if (!status || status === 'draft' || status === 'cancelled') return 'draft';
  return 'updated';
}

function normaliseShift(shift: Shift): Shift {
  return {
    ...shift,
    status: normaliseShiftStatus(shift.status),
  };
}

function normaliseShiftStatus(status?: ShiftStatus): ShiftStatus {
  return status === 'draft' || status === 'published' || status === 'updated' || status === 'cancelled'
    ? status
    : 'published';
}

function getShiftCardClass(status: ShiftStatus) {
  switch (status) {
    case 'draft':
      return 'bg-amber-500/10 border-amber-500/30 hover:border-amber-400';
    case 'updated':
      return 'bg-sky-500/10 border-sky-500/30 hover:border-sky-400';
    case 'cancelled':
      return 'bg-red-500/10 border-red-500/30 opacity-70 hover:border-red-400';
    case 'published':
    default:
      return 'bg-brand-dark border-brand-border hover:border-brand-accent';
  }
}

function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  const styles: Record<ShiftStatus, string> = {
    draft: 'bg-amber-500/15 text-amber-300',
    published: 'bg-emerald-500/15 text-emerald-300',
    updated: 'bg-sky-500/15 text-sky-300',
    cancelled: 'bg-red-500/15 text-red-300',
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${styles[status]}`}>
      {status}
    </span>
  );
}

function ShiftJobSummaryBlock({
  summary,
  loading,
  hasError,
}: {
  summary: ShiftJobSummary | undefined;
  loading: boolean;
  hasError: boolean;
}) {
  if (loading) {
    return <p className="mt-1 text-[9px] text-slate-400">Loading jobs…</p>;
  }
  // A failed summary is surfaced by the roster-level banner; never present an
  // unknown state as "no jobs planned".
  if (hasError) {
    return null;
  }
  const resolved = summary ?? emptyShiftJobSummary();
  if (resolved.activeJobCount === 0) {
    return <p className="mt-1 text-[9px] text-slate-400">No jobs planned</p>;
  }
  const first = resolved.firstJob;
  const label = first ? firstJobDisplayLabel(first) : '';
  return (
    <div className="mt-1 space-y-0.5 text-[9px] font-medium text-slate-400">
      <p className="font-bold text-white">
        {resolved.activeJobCount} planned job{resolved.activeJobCount === 1 ? '' : 's'}
      </p>
      {label ? <p className="truncate">First: {label}</p> : null}
      {first?.plannedArrivalAt ? <p>Arrive {formatPlannedArrivalTime(first.plannedArrivalAt)}</p> : null}
    </div>
  );
}
