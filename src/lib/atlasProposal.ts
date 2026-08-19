import { supabase } from './supabase';
import type { AssetReadinessResult } from './assetCompliance';
import type { OperationalTask } from './operationalTaskQueue';
import type { Json } from './database.types';
import { type AtlasProposalDraft, type AtlasProposalOrigin, type AtlasProposalType, validateAtlasProposalDraft } from './atlasProposalValidation';

export type AtlasProposalRecord = {
  id: string;
  company_id: string;
  proposal_type: AtlasProposalType;
  target_entity_type: 'job_assignment' | 'shift' | 'operational_task';
  target_entity_id: string;
  proposed_change: Record<string, unknown>;
  evidence_facts: readonly Record<string, unknown>[];
  source_snapshot: Record<string, unknown>;
  source_snapshot_version: string;
  validation_status: 'valid' | 'invalid' | 'stale' | 'requires_override' | 'unsupported';
  validation_reasons: readonly { code: string; message: string; sourceId?: string }[];
  origin: AtlasProposalOrigin;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied' | 'failed';
  created_by: string;
  created_at: string;
  validated_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  applied_by: string | null;
  applied_at: string | null;
  operation_result: Record<string, unknown> | null;
  updated_at: string;
};

export type AtlasProposalCandidate = AtlasProposalDraft & {
  label: string;
  explanation: string;
};

export type AtlasProposalRevalidation = {
  proposalId: string;
  status: AtlasProposalRecord['validation_status'];
  reasons: readonly { code: string; message: string; sourceId?: string }[];
  currentVersion: string | null;
};

export function buildEligibleTrailerProposals(input: {
  companyId: string;
  assignment: { id: string; companyId: string; shiftId: string; driverId: string; status: string; updatedAt: string; trailerId: string | null };
  assets: readonly AssetReadinessResult[];
  occupiedTrailerIds?: ReadonlySet<string>;
}): AtlasProposalCandidate[] {
  const occupied = input.occupiedTrailerIds ?? new Set<string>();
  return input.assets
    .filter((asset) => asset.kind === 'trailer' && asset.status === 'ready' && asset.id !== input.assignment.trailerId && !occupied.has(asset.id))
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((asset) => {
      const draft: AtlasProposalDraft = {
        proposalType: 'change_trailer',
        targetEntityType: 'job_assignment',
        targetEntityId: input.assignment.id,
        companyId: input.companyId,
        proposedChange: { trailer_id: asset.id },
        evidenceFacts: [{ sourceType: 'asset_readiness', sourceId: asset.id, label: asset.label, value: 'ready', reasons: asset.reasons.map((reason) => reason.code) }],
        sourceSnapshot: { assignment_id: input.assignment.id, shift_id: input.assignment.shiftId, driver_id: input.assignment.driverId, status: input.assignment.status, trailer_id: input.assignment.trailerId },
        sourceSnapshotVersion: input.assignment.updatedAt,
        origin: 'deterministic',
      };
      return { ...draft, label: `Eligible trailer ${asset.label}`, explanation: 'Current readiness returned ready with no hard-block reason. This is an eligible alternative, not a globally optimal choice.' };
    });
}

export function buildEligibleShiftVehicleProposals(input: {
  companyId: string;
  shift: { id: string; companyId: string; driverId: string; status: string; date: string; startTime: string; endTime: string; notes: string | null; updatedAt: string; vehicleId: string | null };
  assets: readonly AssetReadinessResult[];
  occupiedVehicleIds?: ReadonlySet<string>;
}): AtlasProposalCandidate[] {
  const occupied = input.occupiedVehicleIds ?? new Set<string>();
  return input.assets
    .filter((asset) => asset.kind === 'vehicle' && asset.status === 'ready' && asset.id !== input.shift.vehicleId && !occupied.has(asset.id))
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((asset) => {
      const draft: AtlasProposalDraft = {
        proposalType: 'change_shift_vehicle',
        targetEntityType: 'shift',
        targetEntityId: input.shift.id,
        companyId: input.companyId,
        proposedChange: { vehicle_id: asset.id, date: input.shift.date, start_time: input.shift.startTime, end_time: input.shift.endTime, notes: input.shift.notes, requires_ack: true },
        evidenceFacts: [{ sourceType: 'asset_readiness', sourceId: asset.id, label: asset.label, value: 'ready', reasons: asset.reasons.map((reason) => reason.code) }],
        sourceSnapshot: { shift_id: input.shift.id, driver_id: input.shift.driverId, status: input.shift.status, date: input.shift.date, vehicle_id: input.shift.vehicleId },
        sourceSnapshotVersion: input.shift.updatedAt,
        origin: 'deterministic',
      };
      return { ...draft, label: `Eligible vehicle ${asset.label}`, explanation: 'Current readiness returned ready with no hard-block reason. This is an eligible alternative, not a globally optimal choice.' };
    });
}

export function buildAcknowledgeTaskProposal(companyId: string, task: OperationalTask): AtlasProposalCandidate {
  const sourceSnapshotVersion = task.handling?.updatedAt ?? task.occurredAt ?? new Date(0).toISOString();
  const draft: AtlasProposalDraft = {
    proposalType: 'acknowledge_task',
    targetEntityType: 'operational_task',
    targetEntityId: task.sourceId,
    companyId,
    proposedChange: { source_type: task.sourceType, source_id: task.sourceId, status: 'acknowledged', owner_id: null, action: 'atlas_manager_review', note: 'Acknowledged after deterministic Atlas proposal review.' },
    evidenceFacts: [{ sourceType: task.sourceType, sourceId: task.sourceId, label: task.title, value: task.detail }],
    sourceSnapshot: { task_id: task.id, source_type: task.sourceType, source_id: task.sourceId, title: task.title, status: task.handling?.status ?? 'new' },
    sourceSnapshotVersion,
    origin: 'deterministic',
  };
  return { ...draft, label: `Acknowledge ${task.title}`, explanation: 'This proposal only records manager task handling. It does not alter the source job, shift, asset, or compliance record.' };
}

export function validateAtlasProposalCandidate(input: { candidate: AtlasProposalCandidate; target: { id: string; companyId: string; updatedAt: string; status: string }; activeDriverIds: ReadonlySet<string>; targetDriverId?: string | null; assets: readonly AssetReadinessResult[]; occupiedAssetIds?: ReadonlySet<string> }) {
  return validateAtlasProposalDraft({
    companyId: input.candidate.companyId,
    target: input.target,
    activeDriverIds: input.activeDriverIds,
    targetDriverId: input.targetDriverId,
    assetById: new Map(input.assets.map((asset) => [asset.id, asset])),
    occupiedAssetIds: input.occupiedAssetIds ?? new Set<string>(),
  }, input.candidate);
}

export async function fetchAtlasProposals(companyId: string): Promise<AtlasProposalRecord[]> {
  const { data, error } = await supabase.from('atlas_proposals').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message || 'Unable to load Atlas proposals.');
  return (data ?? []) as unknown as AtlasProposalRecord[];
}

export async function createAtlasProposal(candidate: AtlasProposalCandidate): Promise<AtlasProposalRecord> {
  const { data, error } = await supabase.rpc('create_atlas_proposal', {
    p_proposal_type: candidate.proposalType,
    p_target_entity_type: candidate.targetEntityType,
    p_target_entity_id: candidate.targetEntityId,
    p_proposed_change: candidate.proposedChange as unknown as Json,
    p_evidence_facts: candidate.evidenceFacts as unknown as Json,
    p_source_snapshot: candidate.sourceSnapshot as unknown as Json,
    p_source_snapshot_version: candidate.sourceSnapshotVersion,
    p_origin: candidate.origin,
  });
  if (error || !data) throw new Error(error?.message || 'Unable to create Atlas proposal.');
  return data as unknown as AtlasProposalRecord;
}

export async function revalidateAtlasProposal(proposalId: string): Promise<AtlasProposalRevalidation> {
  const { data, error } = await supabase.rpc('revalidate_atlas_proposal', { p_proposal_id: proposalId });
  if (error || !data) throw new Error(error?.message || 'Unable to revalidate Atlas proposal.');
  const result = data as unknown as { proposal_id: string; status: AtlasProposalRevalidation['status']; reasons?: AtlasProposalRevalidation['reasons']; current_version?: string | null };
  return { proposalId: result.proposal_id, status: result.status, reasons: result.reasons ?? [], currentVersion: result.current_version ?? null };
}

export async function reviewAtlasProposal(proposalId: string, decision: 'approved' | 'rejected', notes?: string | null): Promise<AtlasProposalRecord> {
  const { data, error } = await supabase.rpc('review_atlas_proposal', { p_proposal_id: proposalId, p_decision: decision, p_notes: notes ?? undefined });
  if (error || !data) throw new Error(error?.message || 'Unable to review Atlas proposal.');
  return data as unknown as AtlasProposalRecord;
}

export async function applyAtlasProposal(proposal: AtlasProposalRecord, expectedVersion: string): Promise<AtlasProposalRecord> {
  if (proposal.status !== 'approved') throw new Error('A manager must approve an Atlas proposal before apply.');
  let result: unknown;
  try {
    if (proposal.proposal_type === 'change_trailer') {
      const { data, error } = await supabase.rpc('assign_trailer_to_job_assignment', { p_assignment_id: proposal.target_entity_id, p_trailer_id: String(proposal.proposed_change.trailer_id), p_expected_updated_at: expectedVersion });
      if (error) throw new Error(error.message);
      result = data;
    } else if (proposal.proposal_type === 'change_shift_vehicle') {
      const { data, error } = await supabase.rpc('update_shift_with_asset_guard', {
        p_shift_id: proposal.target_entity_id,
        p_date: String(proposal.proposed_change.date),
        p_start_time: String(proposal.proposed_change.start_time),
        p_end_time: String(proposal.proposed_change.end_time),
        p_vehicle_id: String(proposal.proposed_change.vehicle_id),
        p_notes: typeof proposal.proposed_change.notes === 'string' ? proposal.proposed_change.notes : undefined,
        p_requires_ack: true,
      });
      if (error) throw new Error(error.message);
      result = data;
    } else {
      const { data, error } = await supabase.rpc('set_operational_task_handling', {
        p_source_type: String(proposal.proposed_change.source_type),
        p_source_id: String(proposal.proposed_change.source_id),
        p_status: 'acknowledged',
        p_owner_id: undefined,
        p_action: String(proposal.proposed_change.action ?? 'atlas_manager_review'),
        p_note: typeof proposal.proposed_change.note === 'string' ? proposal.proposed_change.note : undefined,
        p_expected_updated_at: expectedVersion,
      });
      if (error) throw new Error(error.message);
      result = data;
    }
  } catch (error) {
    await supabase.rpc('record_atlas_proposal_outcome', { p_proposal_id: proposal.id, p_outcome: 'failed', p_operation_result: { error: error instanceof Error ? error.message : 'Governed operation failed.' } as unknown as Json });
    throw error;
  }
  const { data, error } = await supabase.rpc('record_atlas_proposal_outcome', { p_proposal_id: proposal.id, p_outcome: 'applied', p_operation_result: (result ?? {}) as Json });
  if (error || !data) throw new Error(error?.message || 'Governed operation succeeded but proposal outcome was not recorded.');
  return data as unknown as AtlasProposalRecord;
}

export function proposalTypeLabel(value: AtlasProposalType): string {
  return value === 'change_trailer' ? 'Change trailer' : value === 'change_shift_vehicle' ? 'Change shift vehicle' : 'Acknowledge task';
}
