import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Download, History, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchAssetReadinessSnapshot } from '../../lib/assetReadinessLoad';
import { fetchOperationalTasks, type OperationalTask } from '../../lib/operationalTaskQueue';
import {
  applyAtlasProposal,
  buildAcknowledgeTaskProposal,
  buildEligibleShiftVehicleProposals,
  buildEligibleTrailerProposals,
  createAtlasProposal,
  fetchAtlasProposals,
  fetchAtlasProposalTimeline,
  proposalTypeLabel,
  revalidateAtlasProposal,
  reviewAtlasProposal,
  validateAtlasProposalCandidate,
  type AtlasProposalCandidate,
  type AtlasProposalRecord,
} from '../../lib/atlasProposal';
import { supabase } from '../../lib/supabase';
import type { AssetReadinessResult } from '../../lib/assetCompliance';

type AssignmentOption = { id: string; shift_id: string; driver_id: string; trailer_id: string | null; status: string; updated_at: string };
type ShiftOption = { id: string; driver_id: string; date: string; start_time: string; end_time: string; notes: string | null; vehicle_id: string | null; status: string; updated_at: string };

export function AtlasProposalWorkbench() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentOption[]>([]);
  const [shifts, setShifts] = useState<ShiftOption[]>([]);
  const [assets, setAssets] = useState<AssetReadinessResult[]>([]);
  const [tasks, setTasks] = useState<OperationalTask[]>([]);
  const [activeDriverIds, setActiveDriverIds] = useState<Set<string>>(new Set());
  const [proposals, setProposals] = useState<AtlasProposalRecord[]>([]);
  const [filters, setFilters] = useState<{ status: AtlasProposalRecord['status'] | ''; proposalType: AtlasProposalRecord['proposal_type'] | ''; createdFrom: string; createdTo: string }>({ status: '', proposalType: '', createdFrom: '', createdTo: '' });
  const [timeline, setTimeline] = useState<Awaited<ReturnType<typeof fetchAtlasProposalTimeline>> | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [candidates, setCandidates] = useState<AtlasProposalCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.company_id || profile.role !== 'manager') return;
    setLoading(true); setMessage(null);
    try {
      const [{ data: assignmentRows, error: assignmentError }, { data: shiftRows, error: shiftError }, { data: driverRows, error: driverError }, readiness, taskRows, proposalRows] = await Promise.all([
        supabase.from('job_assignments').select('id, shift_id, driver_id, trailer_id, status, updated_at').eq('company_id', profile.company_id).in('status', ['published', 'updated', 'acknowledged']).order('updated_at', { ascending: false }),
        supabase.from('shifts').select('id, driver_id, date, start_time, end_time, notes, vehicle_id, status, updated_at').eq('company_id', profile.company_id).in('status', ['published', 'updated']).order('date'),
        supabase.from('profiles').select('id').eq('company_id', profile.company_id).eq('role', 'driver').eq('is_active', true),
        fetchAssetReadinessSnapshot(profile.company_id),
        fetchOperationalTasks(profile.company_id),
        fetchAtlasProposals(filters),
      ]);
      if (assignmentError) throw new Error(assignmentError.message);
      if (shiftError) throw new Error(shiftError.message);
      if (driverError) throw new Error(driverError.message);
      setAssignments((assignmentRows ?? []) as AssignmentOption[]);
      setShifts((shiftRows ?? []) as ShiftOption[]);
      setActiveDriverIds(new Set((driverRows ?? []).map((row) => row.id)));
      setAssets(readiness); setTasks(taskRows); setProposals(proposalRows);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load Atlas proposal context.');
    } finally { setLoading(false); }
  }, [filters, profile?.company_id, profile?.role]);

  useEffect(() => { void load(); }, [load]);

  const selectedAssignment = assignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null;
  const selectedShift = shifts.find((shift) => shift.id === selectedShiftId) ?? null;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const activeAssignments = useMemo(() => assignments.filter((assignment) => assignment.status !== 'draft' && assignment.status !== 'cancelled'), [assignments]);
  const activeShifts = useMemo(() => shifts.filter((shift) => shift.status !== 'draft' && shift.status !== 'cancelled'), [shifts]);

  if (profile?.role !== 'manager') return null;

  const findTrailers = () => {
    if (!selectedAssignment || !profile.company_id) return;
    const occupied = new Set(activeAssignments.filter((assignment) => assignment.shift_id === selectedAssignment.shift_id && assignment.id !== selectedAssignment.id && assignment.trailer_id).map((assignment) => assignment.trailer_id as string));
    setCandidates(buildEligibleTrailerProposals({ companyId: profile.company_id, assignment: { id: selectedAssignment.id, companyId: profile.company_id, shiftId: selectedAssignment.shift_id, driverId: selectedAssignment.driver_id, status: selectedAssignment.status, updatedAt: selectedAssignment.updated_at, trailerId: selectedAssignment.trailer_id }, assets, occupiedTrailerIds: occupied }));
    setMessage('Eligible trailer alternatives prepared. No operation has been changed.');
  };

  const findVehicles = () => {
    if (!selectedShift || !profile.company_id) return;
    const occupied = new Set(activeShifts.filter((shift) => shift.date === selectedShift.date && shift.id !== selectedShift.id && shift.vehicle_id).map((shift) => shift.vehicle_id as string));
    setCandidates(buildEligibleShiftVehicleProposals({ companyId: profile.company_id, shift: { id: selectedShift.id, companyId: profile.company_id, driverId: selectedShift.driver_id, status: selectedShift.status, date: selectedShift.date, startTime: selectedShift.start_time, endTime: selectedShift.end_time, notes: selectedShift.notes, updatedAt: selectedShift.updated_at, vehicleId: selectedShift.vehicle_id }, assets, occupiedVehicleIds: occupied }));
    setMessage('Eligible vehicle alternatives prepared. No operation has been changed.');
  };

  const prepareTask = () => {
    if (!selectedTask || !profile.company_id) return;
    setCandidates([buildAcknowledgeTaskProposal(profile.company_id, selectedTask)]);
    setMessage('A task-handling proposal was prepared. The source task remains unchanged.');
  };

  const submitCandidate = async (candidate: AtlasProposalCandidate) => {
    const assignmentTarget = candidate.targetEntityType === 'job_assignment' ? assignments.find((assignment) => assignment.id === candidate.targetEntityId) : null;
    const shiftTarget = candidate.targetEntityType === 'shift' ? shifts.find((shift) => shift.id === candidate.targetEntityId) : null;
    const target = assignmentTarget ? { id: assignmentTarget.id, companyId: profile?.company_id ?? '', updatedAt: assignmentTarget.updated_at, status: assignmentTarget.status } : shiftTarget ? { id: shiftTarget.id, companyId: profile?.company_id ?? '', updatedAt: shiftTarget.updated_at, status: shiftTarget.status } : { id: candidate.targetEntityId, companyId: profile?.company_id ?? '', updatedAt: candidate.sourceSnapshotVersion, status: 'new' };
    const validation = validateAtlasProposalCandidate({ candidate, target, activeDriverIds, targetDriverId: assignmentTarget?.driver_id ?? shiftTarget?.driver_id, assets });
    if (validation.status !== 'valid') { setMessage(`Proposal was not submitted: ${validation.status} · ${validation.reasons.map((reason) => reason.message).join(' ')}`); return; }
    setWorking(true); setMessage(null);
    try {
      const proposal = await createAtlasProposal(candidate);
      const validation = await revalidateAtlasProposal(proposal.id);
      setMessage(validation.status === 'valid' ? 'Proposal submitted for manager review.' : `Proposal saved but requires attention: ${validation.reasons.map((reason) => reason.message).join(' ')}`);
      setCandidates((current) => current.filter((item) => item !== candidate));
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to submit Atlas proposal.'); } finally { setWorking(false); }
  };

  const revalidate = async (proposal: AtlasProposalRecord) => {
    setWorking(true); setMessage(null);
    try { const result = await revalidateAtlasProposal(proposal.id); setMessage(`Revalidation: ${result.status}${result.reasons.length ? ` · ${result.reasons.map((reason) => reason.message).join(' ')}` : ''}`); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to revalidate proposal.'); } finally { setWorking(false); }
  };

  const decide = async (proposal: AtlasProposalRecord, decision: 'approved' | 'rejected') => {
    setWorking(true); setMessage(null);
    try {
      const validation = await revalidateAtlasProposal(proposal.id);
      if (decision === 'approved' && validation.status !== 'valid') throw new Error(`Proposal is ${validation.status}; refresh before approval.`);
      await reviewAtlasProposal(proposal.id, decision, decision === 'approved' ? 'Manager approved after deterministic revalidation.' : 'Manager dismissed proposal.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to record manager decision.'); } finally { setWorking(false); }
  };

  const apply = async (proposal: AtlasProposalRecord) => {
    setWorking(true); setMessage(null);
    try {
      const result = await applyAtlasProposal(proposal);
      const suffix = result.idempotentReplay ? ' Existing authoritative outcome returned; no duplicate operation was run.' : '';
      setMessage(result.outcomeCode === 'applied' || result.outcomeCode === 'already_applied' ? `Governed operation ${result.outcomeCode}.${suffix}` : `Proposal was not applied: ${result.outcomeCode}. Refresh and review the recorded reason before retrying.`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to apply governed proposal.'); await load(); } finally { setWorking(false); }
  };

  const showTimeline = async (proposal: AtlasProposalRecord) => {
    setTimelineLoading(true); setMessage(null);
    try { setTimeline(await fetchAtlasProposalTimeline(proposal.id)); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load proposal history.'); } finally { setTimelineLoading(false); }
  };

  const downloadAuditExport = () => {
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ['proposal_id', 'proposal_type', 'target_entity_type', 'target_entity_id', 'status', 'validation_status', 'validation_codes', 'created_at', 'reviewed_at', 'applied_at', 'resulting_event_id', 'apply_outcome'],
      ...proposals.map((proposal) => [
        proposal.id,
        proposal.proposal_type,
        proposal.target_entity_type,
        proposal.target_entity_id,
        proposal.status,
        proposal.validation_status,
        proposal.validation_reasons.map((reason) => reason.code).join('|'),
        proposal.created_at,
        proposal.reviewed_at ?? '',
        proposal.applied_at ?? '',
        proposal.resulting_event_id ?? '',
        proposal.apply_outcome ?? '',
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map((value) => escapeCsv(String(value))).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `atlas-proposal-audit-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

 return <section className="mt-5 rounded-xl border border-amber-500/20 bg-hw-navy-950/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-amber-300">Atlas governed proposals</p><p className="mt-1 text-xs leading-relaxed text-hw-slate-400">Deterministic eligible alternatives only. Every proposal is revalidated, manager-reviewed, and applied through an existing governed RPC.</p></div><ShieldCheck className="h-5 w-5 shrink-0 text-amber-300" /></div>{loading ? <p className="mt-4 text-xs text-hw-slate-400">Loading proposal context...</p> : <><div className="mt-4 grid gap-3 lg:grid-cols-3"><div><label className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500" htmlFor="atlas-assignment-target">Job trailer alternatives</label><select id="atlas-assignment-target" value={selectedAssignmentId} onChange={(event) => setSelectedAssignmentId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"><option value="">Choose active job</option>{assignments.map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.id.slice(0, 8)} · {assignment.status}</option>)}</select><button type="button" onClick={findTrailers} disabled={!selectedAssignment} className="mt-2 w-full rounded-lg border border-white/10 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-hw-slate-200 disabled:opacity-40">Find eligible trailers</button></div><div><label className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500" htmlFor="atlas-shift-target">Shift vehicle alternatives</label><select id="atlas-shift-target" value={selectedShiftId} onChange={(event) => setSelectedShiftId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"><option value="">Choose published shift</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.date} · {shift.id.slice(0, 8)}</option>)}</select><button type="button" onClick={findVehicles} disabled={!selectedShift} className="mt-2 w-full rounded-lg border border-white/10 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-hw-slate-200 disabled:opacity-40">Find eligible vehicles</button></div><div><label className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500" htmlFor="atlas-task-target">Task acknowledgement</label><select id="atlas-task-target" value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"><option value="">Choose actionable task</option>{tasks.filter((task) => task.actionable && !task.handling?.resolvedAt).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select><button type="button" onClick={prepareTask} disabled={!selectedTask} className="mt-2 w-full rounded-lg border border-white/10 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-hw-slate-200 disabled:opacity-40">Prepare acknowledgement proposal</button></div></div>{candidates.length > 0 ? <div className="mt-4 space-y-2"><p className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500">Eligible alternatives · submit for review</p>{candidates.map((candidate) => <div key={`${candidate.proposalType}:${candidate.targetEntityId}:${JSON.stringify(candidate.proposedChange)}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3"><div><p className="text-xs font-bold text-white">{candidate.label}</p><p className="mt-1 text-[10px] text-hw-slate-400">{candidate.explanation}</p></div><button type="button" onClick={() => void submitCandidate(candidate)} disabled={working} className="rounded-lg bg-amber-400 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-hw-navy-950 disabled:opacity-40">Submit proposal</button></div>)}</div> : null}<div className="mt-5 border-t border-white/10 pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500">Manager review queue</p><div className="flex items-center gap-3"><button type="button" onClick={downloadAuditExport} disabled={proposals.length === 0} className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-hw-cyan-300 disabled:opacity-40"><Download className="h-3 w-3" />Export filtered audit</button><button type="button" onClick={() => void load()} disabled={working} className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-hw-cyan-300"><RefreshCw className="h-3 w-3" />Refresh</button></div></div><div className="mt-3 grid gap-2 md:grid-cols-4"><select aria-label="Proposal status filter" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as AtlasProposalRecord['status'] | '' }))} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] text-white"><option value="">All statuses</option>{['pending_review', 'approved', 'applying', 'applied', 'rejected', 'failed'].map((status) => <option key={status} value={status}>{status}</option>)}</select><select aria-label="Proposal type filter" value={filters.proposalType} onChange={(event) => setFilters((current) => ({ ...current, proposalType: event.target.value as AtlasProposalRecord['proposal_type'] | '' }))} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] text-white"><option value="">All proposal types</option><option value="change_trailer">Change trailer</option><option value="change_shift_vehicle">Change shift vehicle</option><option value="acknowledge_task">Acknowledge task</option></select><input aria-label="Proposal created from" type="date" value={filters.createdFrom} onChange={(event) => setFilters((current) => ({ ...current, createdFrom: event.target.value }))} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] text-white" /><input aria-label="Proposal created to" type="date" value={filters.createdTo} onChange={(event) => setFilters((current) => ({ ...current, createdTo: event.target.value }))} className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] text-white" /></div>{proposals.length === 0 ? <p className="mt-3 text-xs text-hw-slate-500">No Atlas proposals match the selected filters.</p> : <div className="mt-3 space-y-2">{proposals.slice(0, 8).map((proposal) => <ProposalReviewCard key={proposal.id} proposal={proposal} working={working} onRevalidate={() => void revalidate(proposal)} onApprove={() => void decide(proposal, 'approved')} onReject={() => void decide(proposal, 'rejected')} onApply={() => void apply(proposal)} onTimeline={() => void showTimeline(proposal)} />)}</div>}</div>{timeline ? <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3"><div className="flex items-center justify-between gap-3"><p className="text-[9px] font-black uppercase tracking-widest text-hw-slate-500">Proposal history · {timeline.proposalId.slice(0, 8)}</p><button type="button" onClick={() => setTimeline(null)} className="text-[9px] font-black uppercase tracking-widest text-hw-slate-400">Close</button></div>{timelineLoading ? <p className="mt-2 text-xs text-hw-slate-400">Loading history...</p> : timeline.events.length === 0 ? <p className="mt-2 text-xs text-hw-slate-400">No persisted proposal events found.</p> : <div className="mt-2 space-y-2">{timeline.events.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2 text-[10px]"><span className="font-bold text-white">{event.action}</span><span className="text-hw-slate-400">{new Date(event.timestamp).toLocaleString()} · {event.actorKind}</span></div>)}</div>}</div> : null}</>}{message ? <p className="mt-3 text-xs font-bold text-amber-200">{message}</p> : null}<p className="mt-3 text-[10px] text-hw-slate-500">Atlas has no generic write authority. The question surface never applies proposals automatically; only this explicit manager review flow can approve and apply a supported change.</p></section>;
}

function ProposalReviewCard({ proposal, working, onRevalidate, onApprove, onReject, onApply, onTimeline }: { proposal: AtlasProposalRecord; working: boolean; onRevalidate: () => void; onApprove: () => void; onReject: () => void; onApply: () => void; onTimeline: () => void }) {
  const change = Object.entries(proposal.proposed_change).filter(([key]) => !['source_snapshot'].includes(key)).map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`).join(' · ');
  const reasons = proposal.validation_reasons.map((reason) => reason.message).join(' ');
  return <div className="rounded-lg border border-white/10 bg-black/10 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold text-white">{proposalTypeLabel(proposal.proposal_type)}</p><p className="mt-1 text-[10px] text-hw-slate-400">Target {proposal.target_entity_id.slice(0, 8)} · Changes: {change || 'none'}</p></div><span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-hw-slate-300">{proposal.status} · {proposal.validation_status}</span></div>{reasons ? <p className="mt-2 text-[10px] text-amber-200">{reasons}</p> : null}{proposal.apply_outcome ? <p className="mt-2 text-[10px] font-bold text-hw-cyan-200">Apply outcome: {proposal.apply_outcome}{proposal.resulting_event_id ? ` · event ${proposal.resulting_event_id.slice(0, 8)}` : ''}</p> : null}<p className="mt-2 text-[10px] text-hw-slate-500">What will not change: authoritative job/shift state is changed only by the mapped governed RPC; Atlas does not become the actor.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={onTimeline} disabled={working} className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-hw-slate-300 disabled:opacity-40"><History className="h-3 w-3" />History</button><button type="button" onClick={onRevalidate} disabled={working || proposal.status === 'applied' || proposal.status === 'failed'} className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-hw-slate-300 disabled:opacity-40"><RefreshCw className="h-3 w-3" />Revalidate</button>{proposal.status === 'pending_review' ? <><button type="button" onClick={onApprove} disabled={working || proposal.validation_status !== 'valid'} className="inline-flex items-center gap-1 rounded border border-emerald-500/30 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-300 disabled:opacity-40"><CheckCircle2 className="h-3 w-3" />Approve</button><button type="button" onClick={onReject} disabled={working} className="inline-flex items-center gap-1 rounded border border-red-500/30 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-red-300 disabled:opacity-40"><XCircle className="h-3 w-3" />Dismiss</button></> : null}{proposal.status === 'approved' ? <button type="button" onClick={onApply} disabled={working} className="rounded bg-emerald-400 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-hw-navy-950 disabled:opacity-40">Apply governed change</button> : null}</div></div>;
}
