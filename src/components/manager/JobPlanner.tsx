import { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, Building2, ClipboardList, Clock, FileText, Loader2, MapPin, Phone, RefreshCw, Send, User } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { isAvailableJobSequence, nextJobSequence } from '../../lib/jobSequence';

interface ShiftOption {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  profiles?: { full_name: string } | null;
}

interface JobAssignmentRow {
  id: string;
  sequence: number;
  status: string;
  planned_arrival_at: string | null;
  planned_departure_at: string | null;
  expected_duration_minutes: number | null;
  jobs: {
    reference: string;
    title: string;
    job_type: string;
    customer_name: string | null;
    address_text: string;
    contact_name: string | null;
    contact_phone: string | null;
    instructions: string | null;
    manager_notes: string | null;
  } | null;
}

const ASSIGNMENT_SELECT = 'id, sequence, status, planned_arrival_at, planned_departure_at, expected_duration_minutes, jobs:job_id(reference, title, job_type, customer_name, address_text, contact_name, contact_phone, instructions, manager_notes)';

export function JobPlanner() {
  const { profile } = useAuth();
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [shiftsError, setShiftsError] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState('');

  const [assignments, setAssignments] = useState<JobAssignmentRow[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  const [reference, setReference] = useState('');
  const [title, setTitle] = useState('');
  const [jobType, setJobType] = useState('delivery');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [instructions, setInstructions] = useState('');
  const [managerNotes, setManagerNotes] = useState('');
  const [plannedArrival, setPlannedArrival] = useState('');
  const [plannedDeparture, setPlannedDeparture] = useState('');
  const [duration, setDuration] = useState('');
  const [sequence, setSequence] = useState('1');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Load the manager's future published/updated shifts once per company.
  useEffect(() => {
    if (!profile?.company_id) return;
    let cancelled = false;
    setShiftsLoading(true);
    setShiftsError(null);
    supabase.from('shifts').select('id, date, start_time, end_time, profiles:driver_id(full_name)')
      .eq('company_id', profile.company_id).in('status', ['published', 'updated'])
      .gte('date', format(new Date(), 'yyyy-MM-dd'))
      .order('date').order('start_time').then(({ data, error }) => {
        if (cancelled) return;
        setShiftsLoading(false);
        if (error) { setShiftsError(error.message); return; }
        const loaded = (data ?? []) as ShiftOption[];
        setShifts(loaded);
        // Keep the currently selected shift when it is still present.
        setShiftId(current => (current && loaded.some(s => s.id === current) ? current : (loaded[0]?.id ?? '')));
      });
    return () => { cancelled = true; };
  }, [profile?.company_id]);

  const loadAssignments = useCallback(async (shiftToLoad: string) => {
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    const { data, error } = await supabase.from('job_assignments')
      .select(ASSIGNMENT_SELECT)
      .eq('shift_id', shiftToLoad)
      .order('sequence');
    setAssignmentsLoading(false);
    if (error) { setAssignmentsError(error.message); return; }
    const rows = (data ?? []) as JobAssignmentRow[];
    setAssignments(rows);
    // Default the form to the next safe sequence for this shift.
    setSequence(String(nextJobSequence(rows.map(r => r.sequence))));
  }, []);

  useEffect(() => {
    if (!shiftId) {
      setAssignments([]);
      setAssignmentsLoading(false);
      setAssignmentsError(null);
      return;
    }
    void loadAssignments(shiftId);
  }, [shiftId, loadAssignments]);

  const takenSequences = useMemo(() => assignments.map(a => a.sequence), [assignments]);
  const nextAvailable = useMemo(() => nextJobSequence(takenSequences), [takenSequences]);

  const sequenceError = useMemo(() => {
    if (sequence === '') return 'Sequence is required.';
    const n = Number(sequence);
    if (!Number.isInteger(n) || n < 1) return 'Sequence must be a whole number of at least 1.';
    if (!isAvailableJobSequence(n, takenSequences)) return `Sequence ${n} is already used by another job on this shift.`;
    return null;
  }, [sequence, takenSequences]);

  const plannedWindowError = useMemo(() => {
    if (!plannedArrival || !plannedDeparture) return null;
    const arrival = new Date(plannedArrival).getTime();
    const departure = new Date(plannedDeparture).getTime();
    if (Number.isNaN(arrival) || Number.isNaN(departure)) return null;
    return departure < arrival ? 'Planned departure must be at or after planned arrival.' : null;
  }, [plannedArrival, plannedDeparture]);

  const durationError = useMemo(() => {
    if (!duration) return null;
    const minutes = Number(duration);
    if (!Number.isInteger(minutes) || minutes < 1) return 'Expected duration must be a positive whole number of minutes.';
    return null;
  }, [duration]);

  const formBlocked = Boolean(sequenceError || plannedWindowError || durationError);

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!shiftId) return;
    if (formBlocked) {
      setMessage({ kind: 'error', text: sequenceError ?? plannedWindowError ?? durationError ?? 'Please fix the highlighted fields before publishing.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('create_job_assignment_with_event' as never, {
        p_shift_id: shiftId,
        p_reference: reference,
        p_title: title,
        p_job_type: jobType,
        p_address_text: address,
        p_customer_name: customerName || null,
        p_contact_name: contactName || null,
        p_contact_phone: contactPhone || null,
        p_instructions: instructions || null,
        p_manager_notes: managerNotes || null,
        p_sequence: Number(sequence),
        p_planned_arrival_at: localDateTimeToIso(plannedArrival),
        p_planned_departure_at: localDateTimeToIso(plannedDeparture),
        p_expected_duration_minutes: duration ? Number(duration) : null,
        p_requires_ack: true,
      } as never);
      if (error) throw error;
      // Clear only the completed form fields; keep the selected shift.
      setReference(''); setTitle(''); setCustomerName(''); setAddress('');
      setContactName(''); setContactPhone(''); setInstructions(''); setManagerNotes('');
      setPlannedArrival(''); setPlannedDeparture(''); setDuration('');
      setJobType('delivery');
      setMessage({ kind: 'success', text: 'Job published to the assigned driver.' });
      void loadAssignments(shiftId);
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to publish job.' });
    } finally { setSubmitting(false); }
  };

  return <div className="mx-auto max-w-3xl space-y-6">
    <div className="flex items-center gap-3"><ClipboardList className="text-brand-accent" /><div><h2 className="text-2xl font-bold text-white">Job Planner</h2><p className="text-sm text-slate-400">Publish planned jobs to a driver’s existing shift and review what is already assigned.</p></div></div>
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">Route estimates are advisory only. Drivers must use approved HGV navigation, road signs, site rules, traffic conditions, and professional judgement.</div>
    {shiftsLoading ? (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-brand-border bg-brand-card p-10 text-sm text-slate-400"><Loader2 className="animate-spin" size={16} />Loading published shifts…</div>
    ) : shiftsError ? (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        <p>Unable to load published shifts: {shiftsError}</p>
      </div>
    ) : shifts.length === 0 ? (
      <div className="rounded-2xl border border-brand-border bg-brand-card p-8 text-center">
        <ClipboardList className="mx-auto mb-3 text-slate-500" size={32} />
        <h3 className="text-lg font-bold text-white">No future published shifts</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Jobs are published to a driver’s existing published or updated shift. Create and publish a shift in the Shift Roster first, then return here to plan jobs.</p>
      </div>
    ) : (
      <>
        <form onSubmit={publish} className="space-y-4 rounded-2xl border border-brand-border bg-brand-card p-6">
          <Field label="Published shift" required>
            <select required value={shiftId} onChange={e => setShiftId(e.target.value)} className="input">
              <option value="">Choose a shift</option>
              {shifts.map(s => <option key={s.id} value={s.id}>{s.date} {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.profiles?.full_name ?? 'Driver'}</option>)}
            </select>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Job reference" required><input required value={reference} onChange={e => setReference(e.target.value)} className="input" placeholder="JOB-123" /></Field>
            <Field label="Sequence" required hint={`Route order on the shift. Next available: ${nextAvailable}.`}>
              <input type="number" min="1" step="1" required value={sequence} onChange={e => setSequence(e.target.value)} className="input" placeholder="1" />
            </Field>
          </div>
          {sequenceError ? <p className="text-sm text-red-300">{sequenceError}</p> : null}
          <Field label="Job title" required><input required value={title} onChange={e => setTitle(e.target.value)} className="input" placeholder="Deliver palletised goods" /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Job type"><select value={jobType} onChange={e => setJobType(e.target.value)} className="input"><option value="delivery">Delivery</option><option value="collection">Collection</option><option value="service">Service</option><option value="other">Other</option></select></Field>
            <Field label="Customer / site"><input value={customerName} onChange={e => setCustomerName(e.target.value)} className="input" placeholder="Customer name" /></Field>
          </div>
          <Field label="Address" required><textarea required value={address} onChange={e => setAddress(e.target.value)} className="input min-h-20" placeholder="Full delivery or collection address" /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Planned arrival" hint="Optional, in your local time."><input type="datetime-local" value={plannedArrival} onChange={e => setPlannedArrival(e.target.value)} className="input" /></Field>
            <Field label="Planned departure" hint="Optional, in your local time."><input type="datetime-local" value={plannedDeparture} onChange={e => setPlannedDeparture(e.target.value)} className="input" /></Field>
          </div>
          {plannedWindowError ? <p className="text-sm text-red-300">{plannedWindowError}</p> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Expected duration (minutes)" hint="Optional."><input type="number" min="1" value={duration} onChange={e => setDuration(e.target.value)} className="input" placeholder="30" /></Field>
            <Field label="Contact phone" hint="Optional."><input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className="input" placeholder="Site contact number" /></Field>
          </div>
          {durationError ? <p className="text-sm text-red-300">{durationError}</p> : null}
          <Field label="Contact name" hint="Optional."><input value={contactName} onChange={e => setContactName(e.target.value)} className="input" placeholder="Site contact name" /></Field>
          <Field label="Driver / site instructions" hint="Optional."><textarea value={instructions} onChange={e => setInstructions(e.target.value)} className="input min-h-20" placeholder="Site access / load notes" /></Field>
          <Field label="Internal manager notes" hint="Optional. Not shown to the driver."><textarea value={managerNotes} onChange={e => setManagerNotes(e.target.value)} className="input min-h-20" placeholder="Internal notes only" /></Field>
          {message ? <p className={message.kind === 'success' ? 'text-emerald-300 text-sm' : 'text-red-300 text-sm'}>{message.text}</p> : null}
          <button disabled={submitting || formBlocked || shifts.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><Send size={16} />{submitting ? 'Publishing…' : 'Publish job to driver'}</button>
        </form>

        <section className="rounded-2xl border border-brand-border bg-brand-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Jobs on this shift</h3>
              <p className="text-sm text-slate-400">Published job assignments for the selected shift, in route order.</p>
            </div>
            {assignments.length > 0 ? <span className="rounded-full bg-brand-accent/10 px-3 py-1 text-xs font-black text-brand-accent">{assignments.length} job{assignments.length === 1 ? '' : 's'}</span> : null}
          </div>
          {assignmentsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="animate-spin" size={16} />Loading assignments…</div>
          ) : assignmentsError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <p>Unable to load assignments: {assignmentsError}</p>
              <button type="button" onClick={() => void loadAssignments(shiftId)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-accent px-3 py-1.5 text-xs font-bold text-white"><RefreshCw size={12} />Retry</button>
            </div>
          ) : assignments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No jobs assigned to this shift yet.</p>
          ) : (
            <ul className="space-y-3">{assignments.map(a => <AssignmentCard key={a.id} assignment={a} />)}</ul>
          )}
        </section>
      </>
    )}
  </div>;
}

function AssignmentCard({ assignment }: { assignment: JobAssignmentRow }) {
  const job = assignment.jobs;
  const windowText = buildPlannedWindow(assignment.planned_arrival_at, assignment.planned_departure_at);
  return (
    <li className="rounded-xl border border-brand-border bg-brand-dark/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-black text-brand-accent">{assignment.sequence}</span>
          <span className="font-bold text-white">{job?.reference ?? 'Unknown job'}</span>
          {job ? <span className="text-sm text-slate-300">· {job.title}</span> : null}
        </div>
        <AssignmentStatusBadge status={assignment.status} />
      </div>
      <div className="mt-3 space-y-1.5 text-sm text-slate-400">
        {job ? <p className="flex items-center gap-2"><Briefcase size={14} className="shrink-0 text-slate-500" />{capitalise(job.job_type)}</p> : null}
        {job?.customer_name ? <p className="flex items-center gap-2"><Building2 size={14} className="shrink-0 text-slate-500" />{job.customer_name}</p> : null}
        {job ? <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0 text-slate-500" />{job.address_text}</p> : null}
        {windowText ? <p className="flex items-center gap-2"><Clock size={14} className="shrink-0 text-slate-500" />{windowText}</p> : null}
        {assignment.expected_duration_minutes ? <p className="flex items-center gap-2"><Clock size={14} className="shrink-0 text-slate-500" />{assignment.expected_duration_minutes} min expected</p> : null}
        {job?.contact_name || job?.contact_phone ? <p className="flex items-center gap-2"><User size={14} className="shrink-0 text-slate-500" />{job.contact_name ?? 'Contact'}{job.contact_phone ? <span className="flex items-center gap-1"><Phone size={12} className="text-slate-500" />{job.contact_phone}</span> : null}</p> : null}
        {job?.instructions ? <p className="flex items-start gap-2"><FileText size={14} className="mt-0.5 shrink-0 text-slate-500" />{job.instructions}</p> : null}
      </div>
    </li>
  );
}

function AssignmentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-amber-500/15 text-amber-300',
    published: 'bg-emerald-500/15 text-emerald-300',
    updated: 'bg-sky-500/15 text-sky-300',
    cancelled: 'bg-red-500/15 text-red-300',
  };
  return <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${styles[status] ?? 'bg-slate-500/15 text-slate-300'}`}>{status}</span>;
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return <label className="block text-sm font-bold text-slate-300"><span className="mb-1.5 block">{label}{required ? <span className="ml-1 text-red-400" title="Required">*</span> : null}</span>{children}{hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}</label>;
}

/** Interpret a `datetime-local` value as the manager's local wall-clock time and emit the matching ISO instant. */
function localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatIsoDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function buildPlannedWindow(arrival: string | null, departure: string | null): string | null {
  const arrivalText = formatIsoDateTime(arrival);
  const departureText = formatIsoDateTime(departure);
  if (arrivalText && departureText) return `Arrive ${arrivalText} → depart ${departureText}`;
  if (arrivalText) return `Arrive ${arrivalText}`;
  if (departureText) return `Depart ${departureText}`;
  return null;
}

function capitalise(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
