import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Users, Truck, Clock, X, Save, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format, startOfWeek, addDays, isSameDay, parseISO, addWeeks, subWeeks } from 'date-fns';

interface Shift {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
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

export function ShiftPlanner() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Partial<Shift> | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = [...Array(7)].map((_, i) => addDays(weekStart, i));

  const loadData = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      // Load drivers
      const { data: driversData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', profile.company_id)
        .eq('role', 'driver');

      setDrivers(driversData || []);

      // Load vehicles
      const { data: vehiclesData } = await supabase
        .from('vehicles')
        .select('id, reg_number')
        .eq('company_id', profile.company_id);

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

      if (shiftsError) throw shiftsError;
      setShifts(shiftsData || []);
    } catch (err) {
      console.error('Error loading shift data:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id, weekStart]);

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
    if (!selectedShift || !profile?.company_id) return;

    try {
      const shiftData = {
        company_id: profile.company_id,
        driver_id: selectedShift.driver_id!,
        vehicle_id: selectedShift.vehicle_id,
        date: selectedShift.date!,
        start_time: selectedShift.start_time!,
        end_time: selectedShift.end_time!,
        notes: selectedShift.notes
      };

      if (selectedShift.id) {
        const { error } = await supabase
          .from('shifts')
          .update(shiftData)
          .eq('id', selectedShift.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('shifts')
          .insert(shiftData);
        if (error) throw error;
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      console.error('Error saving shift:', err);
      alert('Failed to save shift');
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    try {
      const { error } = await supabase
        .from('shifts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      loadData();
    } catch (err) {
      console.error('Error deleting shift:', err);
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
              {drivers.length === 0 ? (
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
                          <div className="space-y-2">
                            {dayShifts.map((shift) => (
                              <div
                                key={shift.id}
                                onClick={() => handleEditShift(shift)}
                                className="p-2 bg-brand-dark rounded-lg border border-brand-border hover:border-brand-accent transition cursor-pointer group/shift shadow-sm"
                              >
                                <div className="flex justify-between items-start mb-1">
                                  <div className="text-[10px] font-black text-brand-accent uppercase flex items-center gap-1">
                                    <Clock size={10} /> {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteShift(shift.id); }}
                                    className="opacity-0 group-hover/shift:opacity-100 text-slate-500 hover:text-red-500 transition"
                                  >
                                    <X size={12} />
                                  </button>
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
                              </div>
                            ))}
                            <button
                              onClick={() => handleAddShift(driver.id, day)}
                              className="w-full py-2 border border-dashed border-brand-border rounded-lg text-slate-500 hover:text-brand-accent hover:border-brand-accent hover:bg-brand-accent/5 transition flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100"
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

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-brand-border rounded-xl font-black text-slate-400 hover:bg-brand-dark transition uppercase tracking-widest text-[10px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand-accent text-white rounded-xl font-black hover:bg-brand-accent-dark transition shadow-lg shadow-brand-accent/20 uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                >
                  <Save size={16} /> Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
