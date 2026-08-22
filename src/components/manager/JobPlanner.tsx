import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Ban, Briefcase, Building2, ClipboardList, Clock, FileText, Loader2, MapPin, Pencil, Phone, RefreshCw, Save, Send, User, X, ChevronDown, ChevronUp } from 'lucide-react';
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
import {
  fetchManagerOperationalAcknowledgements,
  type ManagerAcknowledgementSummary,
} from '../../lib/operationalAcknowledgements';
import {
  INITIAL_OPERATIONAL_ACKNOWLEDGEMENT_LOAD,
  operationalAcknowledgementLoadReducer,
} from '../../lib/operationalAcknowledgementLoad';
import { OperationalAcknowledgementBadge } from './OperationalAcknowledgementBadge';
import { createAssetAssignmentOverride, fetchAssetReadinessSnapshot } from '../../lib/assetReadinessLoad';
import type { AssetReadinessResult } from '../../lib/assetCompliance';
import { buildRoutePlan, type PlannedStop, type VehicleRoutingProfile } from '../../lib/routePlanning';
import { fetchJobEvidence, reviewJobEvidence, type JobEvidenceRecord, type JobEvidenceReviewStatus } from '../../lib/jobEvidence';

const planningRpc = supabase.rpc as unknown as (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

interface ShiftOption {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  vehicle_id: string | null;
  updated_at: string;
  status: 'draft' | 'published' | 'updated' | 'cancelled';
  profiles?: { full_name: string | null } | null;
}

// NOTE: manager-only notes are deliberately not collected here. `jobs.manager_notes`
// lives on the job row the driver read policy can expose, so capturing private notes
// through it would leak them to the driver-facing read model. Collection stays deferred
// until the backend provides a manager-only storage/read boundary.
const ASSIGNMENT_SELECT = 'id, vehicle_id, trailer_id, sequence, status, updated_at, planned_arrival_at, planned_departure_at, expected_duration_minutes, jobs:job_id(id, updated_at, reference, title, job_type, customer_name, address_text, contact_name, contact_phone, instructions)';

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
  const [assetReadiness, setAssetReadiness] = useState<AssetReadinessResult[]>([]);
  const [overrideReason, setOverrideReason] = useState('');
  const [overridePending, setOverridePending] = useState(false);
  const [overrideRecordedFor, setOverrideRecordedFor] = useState<string | null>(null);

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
  const [acknowledgementLoad, dispatchAcknowledgementLoad] = useReducer(
    operationalAcknowledgementLoadReducer,
    INITIAL_OPERATIONAL_ACKNOWLEDGEMENT_LOAD
  );
  const requestTokenRef = useRef(0);
  const acknowledgementRequestTokenRef = useRef(0);

  // Load the manager's future planned and published shifts once per company. This
  // effect does not depend on the focused shift, so manual dropdown changes do
  // not trigger a redundant reload; focus application lives in the next effect.
  useEffect(() => {
    if (!profile?.company_id) return;
    let cancelled = false;
    setShiftsLoading(true);
    setShiftsError(null);
    supabase.from('shifts').select('id, date, start_time, end_time, driver_id, vehicle_id, updated_at, status')
      .eq('company_id', profile.company_id).in('status', ['draft', 'published', 'updated'])
      .gte('date', format(new Date(), 'yyyy-MM-dd'))
      .order('date').order('start_time').then(async ({ data, error }) => {
        if (cancelled) return;
        setShiftsLoading(false);
        if (error) { setShiftsError(error.message); return; }
        const driverIds = [...new Set((data ?? []).map(shift => shift.driver_id))];
        const { data: driverProfiles, error: driverError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', driverIds);
        if (driverError) { setShiftsError(driverError.message); return; }
        const driverMap = new Map((driverProfiles ?? []).map(driver => [driver.id, { full_name: driver.full_name }]));
        setShifts((data ?? []).map(shift => ({
          id: shift.id,
          date: shift.date,
          start_time: shift.start_time,
          end_time: shift.end_time,
          vehicle_id: shift.vehicle_id,
          updated_at: shift.updated_at,
          status: shift.status,
          profiles: driverMap.get(shift.driver_id) ?? null,
        })));
      });
    void fetchAssetReadinessSnapshot(profile.company_id).then(setAssetReadiness).catch(() => setAssetReadiness([]));
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
    if (!profile?.company_id) {
      dispatchAssignmentLoad({ type: 'resolve', requestToken, shiftId: shiftToLoad, assignments: null, error: 'Company context is unavailable.' });
      return;
    }
    const { data, error } = await supabase.from('job_assignments')
      .select(ASSIGNMENT_SELECT)
      .eq('company_id', profile.company_id)
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
  }, [profile?.company_id]);

  const loadAcknowledgements = useCallback(async (shiftToLoad: string, requestToken: number) => {
    if (!profile?.company_id) {
      dispatchAcknowledgementLoad({ type: 'resolve', requestToken, scope: shiftToLoad, model: null, error: 'Company context is unavailable.' });
      return;
    }
    try {
      const model = await fetchManagerOperationalAcknowledgements(profile.company_id, shiftToLoad ? [shiftToLoad] : []);
      dispatchAcknowledgementLoad({ type: 'resolve', requestToken, scope: shiftToLoad, model, error: null });
    } catch (error) {
      dispatchAcknowledgementLoad({
        type: 'resolve',
        requestToken,
        scope: shiftToLoad,
        model: null,
        error: error instanceof Error ? error.message : 'Unable to load driver acknowledgement status.',
      });
    }
  }, [profile?.company_id]);

  const beginAcknowledgementLoad = useCallback((shiftToLoad: string) => {
    const requestToken = acknowledgementRequestTokenRef.current + 1;
    acknowledgementRequestTokenRef.current = requestToken;
    dispatchAcknowledgementLoad({ type: 'begin', requestToken, scope: shiftToLoad });
    void loadAcknowledgements(shiftToLoad, requestToken);
  }, [loadAcknowledgements]);

  const beginAssignmentLoad = useCallback((shiftToLoad: string) => {
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;
    dispatchAssignmentLoad({ type: 'begin', shiftId: shiftToLoad, requestToken });
    beginAcknowledgementLoad(shiftToLoad);
    void loadAssignments(shiftToLoad, requestToken);
  }, [beginAcknowledgementLoad, loadAssignments]);

  useEffect(() => {
    if (!shiftId) {
      dispatchAssignmentLoad({ type: 'begin', shiftId: '', requestToken: requestTokenRef.current });
      beginAcknowledgementLoad('');
      return;
    }
    beginAssignmentLoad(shiftId);
  }, [beginAcknowledgementLoad, beginAssignmentLoad, shiftId]);

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
  const selectedShift = shifts.find((shift) => shift.id === shiftId) ?? null;
  const selectedAsset = selectedShift?.vehicle_id ? assetReadiness.find((asset) => asset.id === selectedShift.vehicle_id) ?? null : null;
  const overrideKey = selectedAsset && selectedShift ? `${selectedShift.id}:${selectedAsset.id}` : null;
  const assetNeedsOverride = Boolean(selectedAsset && (selectedAsset.status === 'unknown' || selectedAsset.status === 'action_required') && overrideRecordedFor !== overrideKey);
  const assetHardBlocked = selectedAsset?.status === 'prohibited';

  const recordOverride = async () => {
    if (!selectedShift?.vehicle_id || !selectedShift.updated_at || !selectedAsset || !assetNeedsOverride) return;
    if (overrideReason.trim().length < 20) {
      setMessage({ kind: 'error', text: 'Enter a meaningful override reason of at least 20 characters.' });
      return;
    }
    setOverridePending(true);
    setMessage(null);
    try {
      await createAssetAssignmentOverride({
        shiftId: selectedShift.id,
        vehicleId: selectedShift.vehicle_id,
        expectedShiftUpdatedAt: selectedShift.updated_at,
        reason: overrideReason,
      });
      setOverrideRecordedFor(`${selectedShift.id}:${selectedAsset.id}`);
      setMessage({ kind: 'success', text: 'Readiness override recorded and audited for this shift/vehicle. Review the reason before publishing.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to record the readiness override.' });
    } finally {
      setOverridePending(false);
    }
  };

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
    if (!editingAssignment && selectedShift?.status !== 'draft' && (assetHardBlocked || assetNeedsOverride)) {
      setMessage({ kind: 'error', text: assetHardBlocked ? 'This vehicle is prohibited and cannot be assigned.' : 'This vehicle has incomplete or action-required readiness evidence. Record a governed override before publishing.' });
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
        ...(customerName ? { p_customer_name: customerName } : {}),
        ...(contactName ? { p_contact_name: contactName } : {}),
        ...(contactPhone ? { p_contact_phone: contactPhone } : {}),
        ...(instructions ? { p_instructions: instructions } : {}),
        // Manager-only notes are not collected here (see ASSIGNMENT_SELECT note).
        p_sequence: Number(sequence),
        ...(duration ? { p_expected_duration_minutes: Number(duration) } : {}),
        p_requires_ack: true,
      };
      const plannedArrivalAt = plannedArrival ? localDateTimeToIso(plannedArrival) : null;
      const plannedDepartureAt = plannedDeparture ? localDateTimeToIso(plannedDeparture) : null;
      const typedRpcArgs = {
        ...rpcArgs,
        ...(plannedArrivalAt ? { p_planned_arrival_at: plannedArrivalAt } : {}),
        ...(plannedDepartureAt ? { p_planned_departure_at: plannedDepartureAt } : {}),
      };
      const guardedRpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string; code?: string } | null }>;
      let error: { message: string; code?: string } | null = null;
      if (editingAssignment) {
        ({ error } = await supabase.rpc('update_job_assignment_with_event', {
            ...typedRpcArgs,
            p_assignment_id: editingAssignment.id,
            p_expected_updated_at: editingAssignment.updated_at ?? undefined,
          }));
      } else if (selectedShift?.status === 'draft') {
        const plannedJob = await planningRpc('create_planned_job', {
          p_reference: reference,
          p_title: title,
          p_job_type: jobType,
          p_address_text: address,
          p_customer_name: customerName || null,
          p_instructions: instructions || null,
          p_manager_notes: null,
        });
        if (plannedJob.error) throw plannedJob.error;
        const jobId = (plannedJob.data as { id?: string } | null)?.id;
        if (!jobId) throw new Error('The planned job could not be created.');
        ({ error } = await planningRpc('assign_job_to_draft_shift', {
          p_job_id: jobId,
          p_shift_id: shiftId,
          p_sequence: Number(sequence),
        }));
      } else {
        ({ error } = await guardedRpc('create_job_assignment_with_asset_guard', {
            ...typedRpcArgs,
            p_shift_id: shiftId,
          }));
      }
      if (error) throw error;
      const wasEditing = Boolean(editingAssignment);
      resetJobForm();
      setMessage({ kind: 'success', text: wasEditing ? 'Job assignment updated for the driver.' : selectedShift?.status === 'draft' ? 'Job added to the planned duty. It will stay private until the duty is published.' : 'Job published to the assigned driver.' });
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
      const { error } = await supabase.rpc('cancel_job_assignment_with_event', {
        p_assignment_id: assignment.id,
        p_expected_updated_at: assignment.updated_at,
        p_requires_ack: true,
      });
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
          {!selectedShift?.vehicle_id ? (
            <div className="rounded-xl border border-slate-600/40 bg-slate-900/40 p-3 text-xs text-slate-300">No vehicle is attached to this shift. Asset readiness is not applicable to this assignment.</div>
          ) : !selectedAsset ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">Vehicle readiness evidence is still loading or unavailable. The server will independently enforce the assignment policy.</div>
          ) : (
            <div className={`rounded-xl border p-4 ${assetHardBlocked ? 'border-red-500/40 bg-red-500/10' : assetNeedsOverride ? 'border-amber-400/40 bg-amber-400/10' : 'border-emerald-400/30 bg-emerald-400/10'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned vehicle</p><p className="mt-1 text-base font-black text-white">{selectedAsset.label}</p></div><span className="rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white">{selectedAsset.status.replace('_', ' ')}</span></div>
              {selectedAsset.reasons.length > 0 ? <ul className="mt-2 space-y-1 text-xs text-slate-200">{selectedAsset.reasons.slice(0, 3).map((reason) => <li key={reason.code}>• {reason.label}</li>)}</ul> : <p className="mt-2 text-xs text-emerald-100">No readiness warning was returned by the current evidence model.</p>}
              {assetHardBlocked ? <p className="mt-3 text-xs font-black text-red-200">Prohibited assets cannot be overridden or published.</p> : assetNeedsOverride ? <div className="mt-3 space-y-2"><p className="text-xs font-bold text-amber-100">A governed manager override is required before this vehicle can be used.</p><textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} rows={2} className="input min-h-16" placeholder="Explain the controlled operational reason and mitigation (20–1000 characters)." /><button type="button" onClick={() => void recordOverride()} disabled={overridePending || overrideReason.trim().length < 20} className="rounded-lg border border-amber-300/50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-100 disabled:opacity-50">{overridePending ? 'Recording override…' : 'Record governed override'}</button></div> : null}
            </div>
          )}
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
          <button disabled={submitting || !assignmentsReady || formBlocked || shifts.length === 0 || (!editingAssignment && (assetHardBlocked || assetNeedsOverride))} className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{editingAssignment ? <Save size={16} /> : <Send size={16} />}{submitting ? editingAssignment ? 'Saving…' : 'Publishing…' : editingAssignment ? 'Save job changes' : 'Publish job to driver'}</button>
        </form>

        <section className="rounded-2xl border border-brand-border bg-brand-card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">Jobs on this shift</h3>
              <p className="text-sm text-slate-400">Active planned work for the selected shift, in route order. Cancelled jobs remain visible for history.</p>
            </div>
            {assignmentsReady && assignmentLoad.assignments.length > 0 ? <span className="rounded-full bg-brand-accent/10 px-3 py-1 text-xs font-black text-brand-accent">{assignmentLoad.assignments.filter(a => a.status !== 'cancelled').length} active · {assignmentLoad.assignments.filter(a => a.status === 'cancelled').length} cancelled</span> : null}
          </div>
          {acknowledgementLoad.error ? <p role="status" className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">Driver acknowledgement status is unavailable right now. Job planning remains available.</p> : null}
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
              <ul className="space-y-3">{assignmentLoad.assignments.map(a => <AssignmentCard key={a.id} assignment={a} onEdit={startEditing} onCancel={cancelAssignment} onRefresh={() => beginAssignmentLoad(shiftId)} actionPending={submitting} acknowledgement={acknowledgementLoad.model.byAssignmentId[a.id]} acknowledgementLoading={acknowledgementLoad.loading} />)}</ul>
            )
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Choose a shift to review its assigned jobs.</p>
          )}
        </section>
      </>
    )}
  </div>;
}

function AssignmentCard({ assignment, onEdit, onCancel, onRefresh, actionPending, acknowledgement, acknowledgementLoading }: { assignment: JobAssignmentRow; onEdit: (assignment: JobAssignmentRow) => void; onCancel: (assignment: JobAssignmentRow) => void; onRefresh: () => void; actionPending: boolean; acknowledgement?: ManagerAcknowledgementSummary; acknowledgementLoading: boolean }) {
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
          <OperationalAcknowledgementBadge summary={acknowledgement} loading={acknowledgementLoading} />
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
      {!isCancelled ? <TrailerAssignmentControl assignmentId={assignment.id} trailerId={assignment.trailer_id ?? null} expectedUpdatedAt={assignment.updated_at} onSaved={onRefresh} /> : null}
      {!isCancelled ? <JobEvidenceReviewPanel assignmentId={assignment.id} /> : null}
      {job && !isCancelled ? <AssignmentRouteEditor jobId={job.id} jobUpdatedAt={job.updated_at} fallbackAddress={job.address_text} vehicleProfile={assignment.vehicle_id ? { vehicleId: assignment.vehicle_id, profileVersion: assignment.updated_at, vehicleType: null } : null} /> : null}
    </li>
  );
}

function TrailerAssignmentControl({ assignmentId, trailerId, expectedUpdatedAt, onSaved }: { assignmentId: string; trailerId: string | null; expectedUpdatedAt: string; onSaved: () => void }) {
  const { profile } = useAuth();
  const [trailers, setTrailers] = useState<Array<{ id: string; reg_number: string }>>([]);
  const [value, setValue] = useState(trailerId ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!profile?.company_id) return;
    let cancelled = false;
    void supabase.from('vehicles').select('id, reg_number, vehicle_class, vehicle_type').eq('company_id', profile.company_id).then(({ data, error }) => {
      if (cancelled) return;
      if (error) { setMessage(error.message); return; }
      setTrailers((data ?? []).filter((vehicle) => String(vehicle.vehicle_class ?? '').toLowerCase() === 'trailer' || String(vehicle.vehicle_type ?? '').toLowerCase() === 'trailer').map((vehicle) => ({ id: vehicle.id, reg_number: vehicle.reg_number })));
    });
    return () => { cancelled = true; };
  }, [profile?.company_id]);
  useEffect(() => { setValue(trailerId ?? ''); }, [trailerId]);
  const save = async (nextValue: string) => {
    setSaving(true); setMessage(null);
    try {
      const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      const { error } = await rpc('assign_trailer_to_job_assignment', { p_assignment_id: assignmentId, p_trailer_id: nextValue || null, p_expected_updated_at: expectedUpdatedAt });
      if (error) throw new Error(error.message);
      setValue(nextValue); setMessage('Trailer assignment saved.'); onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save trailer assignment.'); } finally { setSaving(false); }
  };
  return <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3"><label className="text-[10px] font-black uppercase tracking-widest text-slate-500" htmlFor={`trailer-${assignmentId}`}>Trailer</label><select id={`trailer-${assignmentId}`} value={value} disabled={saving} onChange={(event) => void save(event.target.value)} className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs font-bold text-white"><option value="">No trailer assigned</option>{trailers.map((trailer) => <option key={trailer.id} value={trailer.id}>{trailer.reg_number}</option>)}</select>{message ? <span className="text-[10px] font-bold text-amber-200">{message}</span> : null}</div>;
}

function JobEvidenceReviewPanel({ assignmentId }: { assignmentId: string }) {
  const [evidence, setEvidence] = useState<JobEvidenceRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setEvidence(await fetchJobEvidence(assignmentId)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load job evidence.'); }
  }, [assignmentId]);
  useEffect(() => { void load(); }, [load]);
  const review = async (item: JobEvidenceRecord, status: Exclude<JobEvidenceReviewStatus, 'pending'>) => {
    setSavingId(item.id); setMessage(null);
    try { await reviewJobEvidence({ evidenceId: item.id, reviewStatus: status, expectedUpdatedAt: item.updated_at }); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to review evidence.'); } finally { setSavingId(null); }
  };
  return <div className="mt-4 border-t border-white/5 pt-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">POD / evidence review</p>{evidence.length === 0 ? <p className="mt-2 text-xs text-slate-500">No evidence has been recorded for this assignment.</p> : <div className="mt-2 space-y-2">{evidence.map((item) => <div key={item.id} className="rounded-lg border border-white/5 bg-black/10 p-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-slate-200">{item.evidence_type.replace('_', ' ')} · {item.outcome.replace('_', ' ')}</p><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.review_status.replace('_', ' ')}</span></div><p className="mt-1 text-[10px] text-slate-500">Uploaded {new Date(item.uploaded_at).toLocaleString()} · {item.source.replace('_', ' ')}</p>{item.review_status === 'pending' ? <div className="mt-2 flex flex-wrap gap-2">{(['accepted', 'needs_follow_up', 'rejected'] as const).map((status) => <button key={status} type="button" disabled={savingId === item.id} onClick={() => void review(item, status)} className="rounded-lg border border-slate-600 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/5 disabled:opacity-50">{status.replace('_', ' ')}</button>)}</div> : null}</div>)}</div>}{message ? <p className="mt-2 text-xs font-bold text-amber-200">{message}</p> : null}</div>;
}

function AssignmentRouteEditor({ jobId, jobUpdatedAt, fallbackAddress, vehicleProfile }: { jobId: string; jobUpdatedAt: string; fallbackAddress: string; vehicleProfile: VehicleRoutingProfile | null }) {
  const [open, setOpen] = useState(false);
  const [stops, setStops] = useState<PlannedStop[]>([]);
  const [draft, setDraft] = useState<PlannedStop>({ id: 'draft', sequence: 1, stopType: 'service', siteName: null, addressText: fallbackAddress, latitude: null, longitude: null, instructions: null, driverNotes: null, arrivalWindowStart: null, arrivalWindowEnd: null, activity: null, managerNotes: null });
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState(jobUpdatedAt);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setMessage(null);
    try {
      const { data, error } = await supabase.from('job_stops').select('id, sequence, stop_type, site_name, address_text, latitude, longitude, instructions, driver_notes, arrival_window_start, arrival_window_end, activity').eq('job_id', jobId).order('sequence');
      if (error) throw error;
      setStops(((data ?? []) as Array<Record<string, unknown>>).map((row) => ({ id: String(row.id), sequence: Number(row.sequence), stopType: (row.stop_type as PlannedStop['stopType']) ?? 'service', siteName: typeof row.site_name === 'string' ? row.site_name : null, addressText: String(row.address_text ?? ''), latitude: typeof row.latitude === 'number' ? row.latitude : null, longitude: typeof row.longitude === 'number' ? row.longitude : null, instructions: typeof row.instructions === 'string' ? row.instructions : null, driverNotes: typeof row.driver_notes === 'string' ? row.driver_notes : null, arrivalWindowStart: typeof row.arrival_window_start === 'string' ? row.arrival_window_start : null, arrivalWindowEnd: typeof row.arrival_window_end === 'string' ? row.arrival_window_end : null, activity: typeof row.activity === 'string' ? row.activity : null })));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load stops.'); } finally { setLoading(false); }
  };

  // The loader is local to this editor instance and intentionally runs only when the panel opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) void load(); }, [open, jobId]);
  const routePlan = buildRoutePlan(stops.length > 0 ? stops : [{ ...draft, id: 'legacy-location', sequence: 1 }], vehicleProfile);
  const updateStop = (id: string, field: keyof PlannedStop, value: string) => setStops((current) => current.map((stop) => stop.id === id ? { ...stop, [field]: field === 'sequence' ? Number(value) : value || null } : stop));
  const addStop = () => { const next = { ...draft, id: `draft-${Date.now()}`, sequence: stops.length + 1 }; setStops((current) => [...current, next]); setDraft({ ...draft, sequence: stops.length + 2, addressText: '' }); };
  const moveStop = (index: number, direction: -1 | 1) => { const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= stops.length) return; const next = [...stops]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]]; setStops(next.map((stop, position) => ({ ...stop, sequence: position + 1 }))); };
  const removeStop = (id: string) => setStops((current) => current.filter((stop) => stop.id !== id).map((stop, index) => ({ ...stop, sequence: index + 1 })));
  const save = async () => {
    setSaving(true); setMessage(null);
    try {
      const { data, error } = await supabase.rpc('save_job_stops', { p_job_id: jobId, p_expected_job_updated_at: loadedUpdatedAt, p_stops: stops.map((stop) => ({ sequence: stop.sequence, stop_type: stop.stopType, site_name: stop.siteName, address_text: stop.addressText, latitude: stop.latitude, longitude: stop.longitude, instructions: stop.instructions, driver_notes: stop.driverNotes, arrival_window_start: stop.arrivalWindowStart, arrival_window_end: stop.arrivalWindowEnd, activity: stop.activity, manager_notes: stop.managerNotes })) });
      if (error) throw error;
      const result = data as { updated_at?: string } | null;
      if (result?.updated_at) setLoadedUpdatedAt(result.updated_at);
      setMessage('Ordered stops saved. Any route estimate is now stale until a configured provider recalculates it.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save stops. Refresh and try again.'); } finally { setSaving(false); }
  };
  return <div className="mt-4 border-t border-white/5 pt-3"><button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-accent">{open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}Route stops · {stops.length || 'not loaded'}<span className="ml-2 text-slate-500">{routePlan.state.replace('_', ' ')}</span></button>{open ? <div className="mt-3 space-y-3 rounded-xl bg-black/10 p-3"><p className="text-xs text-slate-400">Stops are ordered operational records. {routePlan.message}</p>{loading ? <p className="text-xs text-slate-400">Loading stops…</p> : stops.map((stop, index) => <div key={stop.id} className="rounded-lg border border-white/5 p-3"><div className="flex items-center gap-2"><span className="w-6 text-xs font-black text-brand-accent">{stop.sequence}</span><input value={stop.siteName ?? ''} onChange={(event) => updateStop(stop.id, 'siteName', event.target.value)} placeholder="Site name" className="min-w-0 flex-1 rounded bg-white/5 px-2 py-1 text-xs text-white" /><button type="button" onClick={() => moveStop(index, -1)} aria-label="Move stop up" className="text-slate-400 disabled:opacity-30" disabled={index === 0}><ChevronUp size={14} /></button><button type="button" onClick={() => moveStop(index, 1)} aria-label="Move stop down" className="text-slate-400 disabled:opacity-30" disabled={index === stops.length - 1}><ChevronDown size={14} /></button><button type="button" onClick={() => removeStop(stop.id)} aria-label="Remove stop" className="text-red-300"><X size={14} /></button></div><input value={stop.addressText} onChange={(event) => updateStop(stop.id, 'addressText', event.target.value)} placeholder="Address or clear location" className="mt-2 w-full rounded bg-white/5 px-2 py-1 text-xs text-white" /><input value={stop.instructions ?? ''} onChange={(event) => updateStop(stop.id, 'instructions', event.target.value)} placeholder="Driver instructions" className="mt-2 w-full rounded bg-white/5 px-2 py-1 text-xs text-white" /></div>)}<div className="flex flex-wrap gap-2"><input value={draft.siteName ?? ''} onChange={(event) => setDraft({ ...draft, siteName: event.target.value })} placeholder="New site" className="rounded bg-white/5 px-2 py-1 text-xs text-white" /><input value={draft.addressText} onChange={(event) => setDraft({ ...draft, addressText: event.target.value })} placeholder="New stop address" className="min-w-[220px] rounded bg-white/5 px-2 py-1 text-xs text-white" /><button type="button" onClick={addStop} disabled={!draft.addressText.trim()} className="rounded bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50">Add stop</button><button type="button" onClick={() => void save()} disabled={saving || loading || stops.length === 0} className="inline-flex items-center gap-2 rounded bg-brand-accent px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"><Save size={12} />{saving ? 'Saving' : 'Save route'}</button></div>{message ? <p className="text-xs font-bold text-amber-200">{message}</p> : null}</div> : null}</div>;
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
