import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, Plus, RefreshCw, UserPlus } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ShiftPlanner } from './ShiftPlanner';
import { DriverHoursPlanningPanel } from './DriverHoursPlanningPanel';

type RotaTemplate = { id: string; name: string; description: string | null };
type RotaSlot = { id: string; slot_date: string; role_label: string; start_time: string; end_time: string; required_headcount: number; status: string; required_skill: string | null };
type Driver = { id: string; full_name: string | null };
type Vehicle = { id: string; reg_number: string; vehicle_class: string | null; vehicle_type: string | null };
type Job = { id: string; reference: string; title: string; job_type: string; address_text: string; customer_name: string | null };

const planningRpc = supabase.rpc as unknown as (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export function RotaPlanningWorkspace({ onOpenJobPlanner }: { onOpenJobPlanner?: (shiftId: string) => void }) {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<RotaTemplate[]>([]);
  const [slots, setSlots] = useState<RotaSlot[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [fromDate, setFromDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(addDays(new Date(), 6), 'yyyy-MM-dd'));
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateName, setTemplateName] = useState('Standard weekday cover');
  const [slotRole, setSlotRole] = useState('Driver cover');
  const [slotStart, setSlotStart] = useState('08:00');
  const [slotEnd, setSlotEnd] = useState('17:00');
  const [slotCount, setSlotCount] = useState('1');
  const [leaveDriver, setLeaveDriver] = useState('');
  const [leaveStart, setLeaveStart] = useState(fromDate);
  const [leaveEnd, setLeaveEnd] = useState(fromDate);
  const [assigningSlot, setAssigningSlot] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Record<string, string>>({});
  const [selectedVehicle, setSelectedVehicle] = useState<Record<string, string>>({});
  const [selectedTrailer, setSelectedTrailer] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobForm, setJobForm] = useState({ reference: '', title: '', address: '', customer: '', type: 'delivery' });

  const loadPlanning = useCallback(async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    setMessage(null);
    const [templateResult, slotResult, driverResult, vehicleResult, jobResult, jobAssignmentResult] = await Promise.all([
      supabase.from('rota_templates').select('id, name, description').eq('company_id', profile.company_id).eq('active', true).order('name'),
      supabase.from('rota_slots').select('id, slot_date, role_label, start_time, end_time, required_headcount, status, required_skill').eq('company_id', profile.company_id).gte('slot_date', fromDate).lte('slot_date', toDate).neq('status', 'cancelled').order('slot_date').order('start_time'),
      supabase.from('profiles').select('id, full_name').eq('company_id', profile.company_id).eq('role', 'driver').order('full_name'),
      supabase.from('vehicles').select('id, reg_number, vehicle_class, vehicle_type').eq('company_id', profile.company_id).order('reg_number'),
      supabase.from('jobs').select('id, reference, title, job_type, address_text, customer_name').eq('company_id', profile.company_id).order('created_at', { ascending: false }).limit(100),
      supabase.from('job_assignments').select('job_id').eq('company_id', profile.company_id).neq('status', 'cancelled'),
    ]);
    const firstError = [templateResult, slotResult, driverResult, vehicleResult, jobResult, jobAssignmentResult].find(result => result.error)?.error;
    if (firstError) setMessage({ kind: 'error', text: firstError.message });
    setTemplates((templateResult.data ?? []) as RotaTemplate[]);
    setSlots((slotResult.data ?? []) as RotaSlot[]);
    setDrivers((driverResult.data ?? []) as Driver[]);
    setVehicles((vehicleResult.data ?? []) as Vehicle[]);
    const assignedJobIds = new Set((jobAssignmentResult.data ?? []).map(row => row.job_id));
    setJobs(((jobResult.data ?? []) as Job[]).filter(job => !assignedJobIds.has(job.id)));
    setLoading(false);
  }, [fromDate, profile?.company_id, toDate]);

  useEffect(() => { void loadPlanning(); }, [loadPlanning]);

  const createPattern = async (event: React.FormEvent) => {
    event.preventDefault();
    const { error } = await planningRpc('create_rota_template_with_slots', {
      p_name: templateName, p_description: 'Reusable planning pattern',
      p_slots: [{ role_label: slotRole, start_time: slotStart, end_time: slotEnd, required_headcount: Number(slotCount) || 1, sort_order: 0 }],
    });
    if (error) setMessage({ kind: 'error', text: error.message });
    else { setMessage({ kind: 'success', text: 'Pattern saved. You can now create dated cover.' }); void loadPlanning(); }
  };

  const applyPattern = async () => {
    if (!selectedTemplate) return;
    const { error } = await planningRpc('apply_rota_template', { p_template_id: selectedTemplate, p_name: '', p_from: fromDate, p_to: toDate });
    if (error) setMessage({ kind: 'error', text: error.message });
    else { setMessage({ kind: 'success', text: 'Dated cover created. Empty places can now be filled.' }); void loadPlanning(); }
  };

  const assignSlot = async (slotId: string) => {
    const driverId = selectedDriver[slotId];
    if (!driverId) return;
    setAssigningSlot(slotId);
    const { data, error } = await planningRpc('assign_rota_slot_driver', { p_slot_id: slotId, p_driver_id: driverId, p_vehicle_id: selectedVehicle[slotId] || null, p_trailer_id: selectedTrailer[slotId] || null });
    setAssigningSlot(null);
    if (error) setMessage({ kind: 'error', text: error.message });
    else { const warning = (data as { warning?: string } | null)?.warning; setMessage({ kind: 'success', text: warning ? `Driver added. ${warning}` : 'Driver added to the planned duty. It remains a draft until published.' }); void loadPlanning(); }
  };

  const saveLeave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.company_id || !leaveDriver) return;
    const { error } = await supabase.from('staff_availability').insert({ company_id: profile.company_id, driver_id: leaveDriver, availability_type: 'annual_leave', starts_on: leaveStart, ends_on: leaveEnd, note: 'Added from planning calendar', created_by: profile.id });
    if (error) setMessage({ kind: 'error', text: error.message });
    else { setMessage({ kind: 'success', text: 'Leave recorded in the planning calendar.' }); void loadPlanning(); }
  };

  const createJob = async (event: React.FormEvent) => {
    event.preventDefault();
    const { error } = await planningRpc('create_planned_job', { p_reference: jobForm.reference, p_title: jobForm.title, p_job_type: jobForm.type, p_address_text: jobForm.address, p_customer_name: jobForm.customer, p_instructions: null, p_manager_notes: null });
    if (error) setMessage({ kind: 'error', text: error.message });
    else { setJobForm({ reference: '', title: '', address: '', customer: '', type: 'delivery' }); setMessage({ kind: 'success', text: 'Job added to the unassigned job list.' }); void loadPlanning(); }
  };

  const trailers = useMemo(() => vehicles.filter(vehicle => vehicle.vehicle_class === 'trailer' || vehicle.vehicle_type === 'trailer'), [vehicles]);
  const unassignedJobs = useMemo(() => jobs, [jobs]);
  return <div className="space-y-8">
    <section className="rounded-2xl border border-brand-border bg-brand-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-widest text-brand-accent">Planning calendar</p><h2 className="mt-1 text-2xl font-black text-white">Plan cover before you publish duties</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">Create repeatable cover, see open places, record leave, and fill a planned duty. Draft planning can be incomplete; publishing checks the latest driver, vehicle, trailer and job information again.</p></div><button type="button" onClick={() => void loadPlanning()} className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-slate-300"><RefreshCw size={14} />Refresh</button></div>
      {message ? <div role={message.kind === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-xl border p-3 text-sm font-bold ${message.kind === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{message.text}</div> : null}
      <div className="mt-6 grid gap-4 md:grid-cols-2"><label className="text-xs font-bold text-slate-300">From<input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input mt-1" /></label><label className="text-xs font-bold text-slate-300">To<input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input mt-1" /></label></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <form onSubmit={createPattern} className="rounded-xl border border-brand-border bg-brand-dark/30 p-4"><h3 className="font-black text-white">Save a cover pattern</h3><p className="mt-1 text-xs text-slate-400">A pattern is a starting point. It does not publish duties.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><input required value={templateName} onChange={e => setTemplateName(e.target.value)} className="input" placeholder="Pattern name" /><input required value={slotRole} onChange={e => setSlotRole(e.target.value)} className="input" placeholder="Duty name" /><input type="time" required value={slotStart} onChange={e => setSlotStart(e.target.value)} className="input" /><input type="time" required value={slotEnd} onChange={e => setSlotEnd(e.target.value)} className="input" /><input type="number" min="1" max="50" required value={slotCount} onChange={e => setSlotCount(e.target.value)} className="input" placeholder="People needed" /></div><button className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-xs font-black text-white"><Plus size={14} />Save pattern</button></form>
        <div className="rounded-xl border border-brand-border bg-brand-dark/30 p-4"><h3 className="font-black text-white">Create dated cover</h3><p className="mt-1 text-xs text-slate-400">This creates empty places for the selected dates.</p><div className="mt-3 flex flex-wrap gap-3"><select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} className="input min-w-56"><option value="">Choose a pattern</option>{templates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select><button type="button" disabled={!selectedTemplate} onClick={() => void applyPattern()} className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-xs font-black text-white disabled:opacity-50"><CalendarDays size={14} />Create cover</button></div></div>
      </div>
    </section>

    <section className="rounded-2xl border border-brand-border bg-brand-card p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white">Open places</h2><p className="mt-1 text-sm text-slate-400">Assigning a driver creates a linked draft duty. The driver will not see it until you publish it.</p></div><ClipboardList className="text-brand-accent" /></div>{loading ? <p className="mt-5 text-sm text-slate-400">Loading planned cover…</p> : slots.length === 0 ? <p className="mt-5 rounded-xl border border-brand-border p-4 text-sm text-slate-400">No dated cover in this period yet.</p> : <div className="mt-5 grid gap-3 md:grid-cols-2">{slots.map(slot => <div key={slot.id} className="rounded-xl border border-brand-border bg-brand-dark/30 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-white">{slot.role_label}</p><p className="mt-1 text-xs text-slate-400">{slot.slot_date} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {slot.required_headcount} needed</p></div><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-300">{slot.status === 'filled' ? 'Filled' : slot.status === 'partially_filled' ? 'Part filled' : 'Open'}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><select value={selectedDriver[slot.id] ?? ''} onChange={e => setSelectedDriver(current => ({ ...current, [slot.id]: e.target.value }))} className="input sm:col-span-2"><option value="">Choose a driver</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.full_name ?? 'Unnamed driver'}</option>)}</select><select value={selectedVehicle[slot.id] ?? ''} onChange={e => setSelectedVehicle(current => ({ ...current, [slot.id]: e.target.value }))} className="input"><option value="">Vehicle later</option>{vehicles.filter(vehicle => !trailers.includes(vehicle)).map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.reg_number}</option>)}</select><select value={selectedTrailer[slot.id] ?? ''} onChange={e => setSelectedTrailer(current => ({ ...current, [slot.id]: e.target.value }))} className="input"><option value="">Trailer later</option>{trailers.map(trailer => <option key={trailer.id} value={trailer.id}>{trailer.reg_number}</option>)}</select><button type="button" onClick={() => void assignSlot(slot.id)} disabled={!selectedDriver[slot.id] || assigningSlot === slot.id} className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand-accent px-3 py-2 text-xs font-black text-brand-accent disabled:opacity-50 sm:col-span-2"><UserPlus size={14} />{assigningSlot === slot.id ? 'Adding…' : 'Add driver to duty'}</button></div></div>)}</div>}</section>

    <section className="grid gap-6 xl:grid-cols-2"><form onSubmit={saveLeave} className="rounded-2xl border border-brand-border bg-brand-card p-6"><h2 className="text-xl font-black text-white">Leave and availability</h2><p className="mt-1 text-sm text-slate-400">Record planned leave so cover checks do not offer that driver for the date.</p><div className="mt-4 grid gap-3"><select required value={leaveDriver} onChange={e => setLeaveDriver(e.target.value)} className="input"><option value="">Choose a driver</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.full_name ?? 'Unnamed driver'}</option>)}</select><div className="grid gap-3 sm:grid-cols-2"><input type="date" required value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="input" /><input type="date" required value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className="input" /></div><button className="inline-flex w-fit items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-xs font-black text-white"><CalendarDays size={14} />Record leave</button></div></form>
      <form onSubmit={createJob} className="rounded-2xl border border-brand-border bg-brand-card p-6"><h2 className="text-xl font-black text-white">Add a job to the pool</h2><p className="mt-1 text-sm text-slate-400">Keep work unassigned until a suitable planned duty is ready. Route order can be arranged later; no arrival time is invented here.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><input required value={jobForm.reference} onChange={e => setJobForm({ ...jobForm, reference: e.target.value })} className="input" placeholder="Job reference" /><input required value={jobForm.title} onChange={e => setJobForm({ ...jobForm, title: e.target.value })} className="input" placeholder="Job title" /><input required value={jobForm.address} onChange={e => setJobForm({ ...jobForm, address: e.target.value })} className="input sm:col-span-2" placeholder="Customer or delivery address" /><input value={jobForm.customer} onChange={e => setJobForm({ ...jobForm, customer: e.target.value })} className="input" placeholder="Customer name" /><select value={jobForm.type} onChange={e => setJobForm({ ...jobForm, type: e.target.value })} className="input"><option value="delivery">Delivery</option><option value="collection">Collection</option><option value="service">Service</option><option value="other">Other</option></select></div><button className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-accent px-4 py-2 text-xs font-black text-white"><Plus size={14} />Add job</button></form></section>

    <section className="rounded-2xl border border-brand-border bg-brand-card p-6"><h2 className="text-xl font-black text-white">Unassigned job pool</h2><p className="mt-1 text-sm text-slate-400">These jobs have no shift assignment yet. Use the job planner to place them on a draft duty.</p>{unassignedJobs.length === 0 ? <p className="mt-4 text-sm text-slate-400">No unassigned jobs are recorded.</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{unassignedJobs.map(job => <div key={job.id} className="rounded-xl border border-brand-border bg-brand-dark/30 p-4"><p className="font-bold text-white">{job.reference} · {job.title}</p><p className="mt-1 text-xs text-slate-400">{job.customer_name ?? 'Customer not named'} · {job.address_text}</p><button type="button" onClick={() => onOpenJobPlanner?.('')} className="mt-3 text-xs font-black text-brand-accent">Open job planner</button></div>)}</div>}</section>

    <ShiftPlanner onOpenJobPlanner={onOpenJobPlanner} />
    <DriverHoursPlanningPanel fromDate={fromDate} toDate={toDate} />
  </div>;
}
