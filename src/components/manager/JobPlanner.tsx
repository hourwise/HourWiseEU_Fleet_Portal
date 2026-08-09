import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Ban, Briefcase, Building2, ClipboardList, Clock, FileText, Loader2, MapPin, Pencil, Phone, RefreshCw, Save, Send, User, X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { isAvailableJobSequence, nextJobSequence } from '../../lib/jobSequence';
import {
  INITIAL_JOB_ASSIGNMENT_LOAD,
  isJobAssignmentLoadReady,
  isJobAssignmentStale,
  isJobSequenceCollision,
  jobAssignmentLoadReducer,
  type JobAssignmentRow,
} from '../../lib/jobAssignmentLoad';

interface ShiftOption {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  profiles?: { full_name: string } | null;
}

// NOTE: manager-only notes are deliberately not collected here. `jobs.manager_notes`
// lives on the job row the driver read policy can expose, so capturing private notes
// through it would leak them to the driver-facing read model. Collection stays deferred
// until the backend provides a manager-only storage/read boundary.
const ASSIGNMENT_SELECT = 'id, sequence, status, updated_at, planned_arrival_at, planned_departure_at, expected_duration_minutes, jobs:job_id(reference, title, job_type, customer_name, address_text, contact_name, contact_phone, instructions)';

interface JobPlannerProps {
  /** Shift preselected from the rota via the `shift` query parameter, if any. */
  focusedShiftId?: string;
  /** Reports manual shift selection or fallback so the dashboard can sync `shift=<uuid>`. */
  onFocusedShiftChange?: (shiftId?: string) => void;
}

export function JobPlanner({ focusedShiftId, onFocusedShiftChange }: JobPlannerProps = {}) {
  const { profile } = useAuth();
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [shiftsError, setShiftsError] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState('');
  const [focusMessage, setFocusMessage] = useState<string | null>(null);

  const [reference, setReference] = useState('');
  const [title, setTitle] = useState('');
  const [jobType, setJobType] = useState('delivery');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [instructions, setInstructions] = useState('');
  const [plannedArrival, setPlannedArrival] = useState('');
  const [plannedDeparture, setPlannedDeparture] = useState('');
  const [duration, setDuration] = useState('');
  const [sequence, setSequence] = useState('1');

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<JobAssignmentRow | null>(null);

  const [assignmentLoad, dispatchAssignmentLoad] = useReducer(jobAssignmentLoadReducer, INITIAL_JOB_ASSIGNMENT_LOAD);
  const requestTokenRef = useRef(0);

  // Load the manager's future published/updated shifts once per company. This
  // effect does not depend on the focused shift, so manual dropdown changes do
  // not trigger a redundant reload; focus application lives in the next effect.
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
        setShifts((data ?? []) as ShiftOption[]);
      });
    return () => { cancelled = true; };
  }, [profile?.company_id]);

  // Apply the focused shift (from the rota URL, Back/Forward, or a manual
  // selection sync). Falls back safely when the requested shift no longer
  // exists and reports the resolved shift so the dashboard URL stays correct.
  useEffect(() => {
    if (shiftsLoading) return;
    if (focusedShiftId) {
      if (shifts.some(s => s.id === focusedShiftId)) {
        setShiftId(focusedShiftId);
        setFocusMessage(null);
      } else {
        const fallbackId = shifts[0]?.id ?? '';
        setShiftId(fallbackId);
        setFocusMessage('That shift is no longer available for job planning, so the first available shift is selected instead.');
        onFocusedShiftChange?.(fallbackId || undefined);
      }
    } else {
      setShiftId(current => (current && shifts.some(s => s.id === current) ? current : (shifts[0]?.id ?? '')));
      setFocusMessage(null);
    }
  }, [focusedShiftId, onFocusedShiftChange, shifts, shiftsLoading]);

  const loadAssignments = useCallback(async (shiftToLoad: string, requestToken: number) => {
    const { data, error } = await supabase.from('job_assignments')
      .select(ASSIGNMENT_SELECT)
      .eq('shift_id', shiftToLoad)
      .order('sequence');
    // Only the latest request for the current shift can resolve; the reducer
    // drops stale or out-of-order responses via the request token.
    dispatchAssignmentLoad({
      type: 'resolve',
      requestToken,
      shiftId: shiftToLoad,
      assignments: error ? null : ((data ?? []) as JobAssignmentRow[]),
      error: error ? error.message : null,
    });
  }, []);

  const beginAssignmentLoad = useCallback((shiftToLoad: string) => {
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;
    dispatchAssignmentLoad({ type: 'begin', shiftId: shiftToLoad, requestToken });
    void loadAssignments(shiftToLoad, requestToken);
  }, [loadAssignments]);

  useEffect(() => {
    if (!shiftId) {
      dispatchAssignmentLoad({ type: 'begin', shiftId: '', requestToken: requestTokenRef.current });
      return;
    }
    beginAssignmentLoad(shiftId);
  }, [shiftId, beginAssignmentLoad]);

  const assignmentsReady = isJobAssignmentLoadReady(assignmentLoad, shiftId);
  const assignmentsLoading = assignmentLoad.loading;
  const assignmentsError = assignmentLoad.error;
  const takenSequences = useMemo(
    () => (assignmentsReady ? assignmentLoad.assignments.map(a => a.sequence) : []),
    [assignmentLoad.assignments, assignmentsReady]
  );
  const nextAvailable = useMemo(() => nextJobSequence(takenSequences), [takenSequences]);

  // Once a confirmed load lands, default a new-job form to the next safe
  // sequence for exactly that shift. Editing keeps its loaded sequence so a
  // reload cannot silently change the submitted form.
  useEffect(() => {
    if (assignmentsReady && !editingAssignment) {
      setSequence(String(nextJobSequence(assignmentLoad.assignments.map(a => a.sequence))));
    }
  }, [assignmentLoad, assignmentsReady, editingAssignment]);

  const sequenceError = useMemo(() => {
    if (sequence === '') return 'Sequence is required.';
    const n = Number(sequence);
    if (!Number.isInteger(n) || n < 1) return 'Sequence must be a whole number of at least 1.';
    if (!isAvailableJobSequence(n, takenSequences, editingAssignment?.sequence)) return `Sequence ${n} is already used by another job on this shift.`;
    return null;
  }, [editingAssignment?.sequence, sequence, takenSequences]);

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

  const handleShiftChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    if (editingAssignment) {
      setEditingAssignment(null);
      resetJobForm();
    }
    setShiftId(next);
    onFocusedShiftChange?.(next || undefined);
  };

  const resetJobForm = () => {
    setReference(''); setTitle(''); setCustomerName(''); setAddress('');
    setContactName(''); setContactPhone(''); setInstructions('');
    setPlannedArrival(''); setPlannedDeparture(''); setDuration('');
    setJobType('delivery');
    setEditingAssignment(null);
  };

  const startEditing = (assignment: JobAssignmentRow) => {
    if (assignment.status === 'cancelled' || !assignment.jobs) return;
    setEditingAssignment(assignment);
    setReference(assignment.jobs.reference);
    setTitle(assignment.jobs.title);
    setJobType(assignment.jobs.job_type);
    setCustomerName(assignment.jobs.customer_name ?? '');
    setAddress(assignment.jobs.address_text);
    setContactName(assignment.jobs.contact_name ?? '');
    setContactPhone(assignment.jobs.contact_phone ?? '');
    setInstructions(assignment.jobs.instructions ?? '');
    setPlannedArrival(isoToLocalDateTimeInput(assignment.planned_arrival_at));
    setPlannedDeparture(isoToLocalDateTimeInput(assignment.planned_departure_at));
    setDuration(assignment.expected_duration_minutes ? String(assignment.expected_duration_minutes) : '');
    setSequence(String(assignment.sequence));
    setMessage(null);
  };

  const cancelEditing = () => {
    resetJobForm();
    setMessage(null);
  };

  const publish = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!shiftId || !assignmentsReady) {
      setMessage({ kind: 'error', text: 'Assignments for this shift are still loading or could not be confirmed. Wait for the job list, then try again.' });
      return;
    }
    if (formBlocked) {
      setMessage({ kind: 'error', text: sequenceError ?? plannedWindowError ?? durationError ?? 'Please fix the highlighted fields before publishing.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const rpcArgs = {
        p_reference: reference,
        p_title: title,
        p_job_type: jobType,
        p_address_text: address,
        p_customer_name: customerName || null,
        p_contact_name: contactName || null,
        p_contact_phone: contactPhone || null,
        p_instructions: instructions || null,
        // Manager-only notes are not collected here (see ASSIGNMENT_SELECT note).
        p_sequence: Number(sequence),
        p_planned_arrival_at: localDateTimeToIso(plannedArrival),
        p_planned_departure_at: localDateTimeToIso(plannedDeparture),
        p_expected_duration_minutes: duration ? Number(duration) : null,
        p_requires_ack: true,
      };
      const { error } = editingAssignment
        ? await supabase.rpc('update_job_assignment_with_event' as never, {
            ...rpcArgs,
            p_assignment_id: editingAssignment.id,
            p_expected_updated_at: editingAssignment.updated_at,
          } as never)
        : await supabase.rpc('create_job_assignment_with_event' as never, {
            ...rpcArgs,
            p_shift_id: shiftId,
            p_manager_notes: null,
          } as never);
      if (error) throw error;
      const wasEditing = Boolean(editingAssignment);
      resetJobForm();
      setMessage({ kind: 'success', text: wasEditing ? 'Job assignment updated for the driver.' : 'Job published to the assigned driver.' });
      // Reload assignments before the sequence state is treated as ready again.
      beginAssignmentLoad(shiftId);
    } catch (error) {
      if (isJobSequenceCollision(error)) {
        // Refresh immediately: begin invalidates readiness (publication stays
        // disabled while loading) and the confirmed reload re-calculates the
        // next safe sequence. If the reload fails, the normal error/retry
        // state remains. The job is never resubmitted automatically.
        beginAssignmentLoad(shiftId);
        setMessage({
          kind: 'error',
          text: 'Another manager used that sequence on this shift at the same time. The assignments are being refreshed; review the updated sequence and try again.',
        });
      } else if (isJobAssignmentStale(error)) {
        beginAssignmentLoad(shiftId);
        setMessage({ kind: 'error', text: 'This assignment changed after it was loaded. The assignments are being refreshed; reopen the job before trying again.' });
      } else {
        setMessage({ kind: 'error', text: error instanceof Error ? error.message : editingAssignment ? 'Unable to update job assignment.' : 'Unable to publish job.' });
      }
    } finally { setSubmitting(false); }
  };

  const cancelAssignment = async (assignment: JobAssignmentRow) => {
    if (submitting || assignment.status === 'cancelled') return;
    const referenceLabel = assignment.jobs?.reference ?? 'this job';
    if (!window.confirm(`Cancel ${referenceLabel}? The job will be removed from active planned work and the driver will be notified.`)) return;

    setSubmitting(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('cancel_job_assignment_with_event' as never, {
        p_assignment_id: assignment.id,
        p_expected_updated_at: assignment.updated_at,
        p_requires_ack: true,
      } as never);
      if (error) throw error;
      if (editingAssignment?.id === assignment.id) resetJobForm();
      setMessage({ kind: 'success', text: `${referenceLabel} was cancelled and the driver was notified.` });
      beginAssignmentLoad(shiftId);
    } catch (error) {
      if (isJobAssignmentStale(error)) {
        beginAssignmentLoad(shiftId);
        setMessage({ kind: 'error', text: 'This assignment changed after it was loaded. The assignments are being refreshed; review the current job before trying again.' });
      } else {
        setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to cancel job assignment.' });
      }
    } finally { setSubmitting(false); }
  };

  return <div className="mx-auto max-w-3xl space-y-6">
    <div className="flex items-center gap-3"><ClipboardList className="text-brand-accent" /><div><h2 className="text-2xl font-bold text-white">Job Planner</h2><p className="text-sm text-slate-400">Publish planned jobs to a driver’s existing shift and review what is already assigned.</p></div></div>
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">Route estimates are advisory only. Drivers must use approved HGV navigation, road signs, site rules, traffic conditions, and professional judgement.</div>
    {focusMessage ? (
      <div role="status" className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">{focusMessage}</div>
    ) : null}
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{editingAssignment ? 'Edit assignment' : 'New assignment'}</p>
              <p className="mt-1 text-sm text-slate-400">{editingAssignment ? 'Update the driver-visible job contract. The shift and driver stay fixed.' : 'Publish a planned job to the selected driver shift.'}</p>
            </div>
            {editingAssignment ? <button type="button" onClick={cancelEditing} className="inline-flex items-center gap-2 rounded-lg border border-brand-border px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5"><X size={14} />Cancel edit</button> : null}
          </div>
          <Field label="Published shift" required>
            <select required value={shiftId} onChange={handleShiftChange} disabled={Boolean(editingAssignment)} className="input disabled:cursor-not-allowed disabled:opacity-60">
              <option value="">Choose a shift</option>
              {shifts.map(s => <option key={s.id} value={s.id}>{s.date} {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.profiles?.full_name ?? 'Driver'}</option>)}
            </select>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Job reference" required><input required value={reference} onChange={e => setReference(e.target.value)} className="input" placeholder="JOB-123" /></Field>
            <Field label="Sequence" required hint={assignmentsReady ? `Route order on the shift. Next available: ${nextAvailable}.` : 'Existing jobs for this shift are still loading; the next safe sequence is calculated once they are confirmed.'}>
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
          {message ? <p className={message.kind === 'success' ? 'text-emerald-300 text-sm' : 'text-red-300 text-sm'}>{message.text}</p> : null}
          <button disabled={submitting || !assignmentsReady || formBlocked || shifts.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{editingAssignment ? <Save size={16} /> : <Send size={16} />}{submitting ? editingAssignment ? 'Saving…' : 'Publishing…' : editingAssignment ? 'Save job changes' : 'Publish job to driver'}</button>
        </form>

        <section className="rounded-2xl border border-brand-border bg-brand-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Jobs on this shift</h3>
              <p className="text-sm text-slate-400">Active planned work for the selected shift, in route order. Cancelled jobs remain visible for history.</p>
            </div>
            {assignmentsReady && assignmentLoad.assignments.length > 0 ? <span className="rounded-full bg-brand-accent/10 px-3 py-1 text-xs font-black text-brand-accent">{assignmentLoad.assignments.filter(a => a.status !== 'cancelled').length} active · {assignmentLoad.assignments.filter(a => a.status === 'cancelled').length} cancelled</span> : null}
          </div>
          {assignmentsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Loader2 className="animate-spin" size={16} />Loading assignments…</div>
          ) : assignmentsError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <p>Unable to load assignments: {assignmentsError}</p>
              <button type="button" onClick={() => beginAssignmentLoad(shiftId)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-accent px-3 py-1.5 text-xs font-bold text-white"><RefreshCw size={12} />Retry</button>
            </div>
          ) : assignmentsReady ? (
            assignmentLoad.assignments.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No jobs assigned to this shift yet.</p>
            ) : (
              <ul className="space-y-3">{assignmentLoad.assignments.map(a => <AssignmentCard key={a.id} assignment={a} onEdit={startEditing} onCancel={cancelAssignment} actionPending={submitting} />)}</ul>
            )
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Choose a shift to review its assigned jobs.</p>
          )}
        </section>
      </>
    )}
  </div>;
}

function AssignmentCard({ assignment, onEdit, onCancel, actionPending }: { assignment: JobAssignmentRow; onEdit: (assignment: JobAssignmentRow) => void; onCancel: (assignment: JobAssignmentRow) => void; actionPending: boolean }) {
  const job = assignment.jobs;
  const windowText = buildPlannedWindow(assignment.planned_arrival_at, assignment.planned_departure_at);
  const isCancelled = assignment.status === 'cancelled';
  return (
    <li className={`rounded-xl border p-4 ${isCancelled ? 'border-red-500/30 bg-red-950/20 opacity-75' : 'border-brand-border bg-brand-dark/40'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${isCancelled ? 'bg-red-500/20 text-red-300' : 'bg-brand-accent/15 text-brand-accent'}`}>{assignment.sequence}</span>
          <span className={`font-bold ${isCancelled ? 'text-red-200 line-through' : 'text-white'}`}>{job?.reference ?? 'Unknown job'}</span>
          {job ? <span className="text-sm text-slate-300">· {job.title}</span> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <AssignmentStatusBadge status={assignment.status} />
          {!isCancelled ? <>
            <button type="button" onClick={() => onEdit(assignment)} disabled={actionPending || !job} className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"><Pencil size={12} />Edit</button>
            <button type="button" onClick={() => onCancel(assignment)} disabled={actionPending} className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"><Ban size={12} />Cancel</button>
          </> : null}
        </div>
      </div>
      <div className={`mt-3 space-y-1.5 text-sm ${isCancelled ? 'text-red-200/70' : 'text-slate-400'}`}>
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

function isoToLocalDateTimeInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
