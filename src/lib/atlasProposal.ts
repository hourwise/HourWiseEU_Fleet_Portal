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
  apply_attempt_count: number;
  apply_started_at: string | null;
  apply_finished_at: string | null;
  apply_outcome: 'applied' | 'already_applied' | 'stale' | 'validation_failed' | 'permission_denied' | 'conflict' | 'governed_operation_failed' | null;
  apply_error_code: string | null;
  resulting_event_id: string | null;
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

export type AtlasProposalTimeline = {
  proposalId: string;
  proposalType: AtlasProposalType;
  targetEntityType: AtlasProposalRecord['target_entity_type'];
  targetEntityId: string;
  status: AtlasProposalRecord['status'];
  validationStatus: AtlasProposalRecord['validation_status'];
  validationReasons: AtlasProposalRecord['validation_reasons'];
  events: readonly {
    id: string;
    timestamp: string;
    action: string;
    actorId: string | null;
    actorKind: string;
    decision: string;
    operation: string | null;
    resourceType: string | null;
    resourceId: string | null;
    metadata: Record<string, unknown>;
  }[];
};

export type AtlasProposalListFilters = {
  status?: AtlasProposalRecord['status'] | '';
  proposalType?: AtlasProposalType | '';
  createdFrom?: string;
  createdTo?: string;
  targetEntityId?: string;
};

export type AtlasApplyResult = {
  proposalId: string;
  outcomeCode: NonNullable<AtlasProposalRecord['apply_outcome']>;
  idempotentReplay: boolean;
  proposal: AtlasProposalRecord | null;
  operationResult: Record<string, unknown> | null;
  resultingEventId: string | null;
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

export async function fetchAtlasProposals(filters: AtlasProposalListFilters = {}): Promise<AtlasProposalRecord[]> {
  const { data, error } = await supabase.rpc('list_atlas_proposals', {
    p_status: filters.status || undefined,
    p_proposal_type: filters.proposalType || undefined,
    p_created_from: filters.createdFrom ? new Date(`${filters.createdFrom}T00:00:00`).toISOString() : undefined,
    p_created_to: filters.createdTo ? new Date(`${filters.createdTo}T00:00:00`).toISOString() : undefined,
    p_target_entity_id: filters.targetEntityId || undefined,
    p_limit: 100,
  });
  if (error) throw new Error(error.message || 'Unable to load Atlas proposals.');
  return parseAtlasProposalListResponse(data);
}

export function parseAtlasProposalListResponse(data: unknown): AtlasProposalRecord[] {
  if (!Array.isArray(data)) return [];
  const proposals = data.filter(isAtlasProposalRecord);
  if (proposals.length !== data.length) throw new Error('Atlas proposal response was incomplete.');
  return proposals;
}

function isAtlasProposalRecord(value: unknown): value is AtlasProposalRecord {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.company_id === 'string'
    && typeof value.proposal_type === 'string'
    && typeof value.target_entity_type === 'string'
    && typeof value.target_entity_id === 'string'
    && isRecord(value.proposed_change)
    && Array.isArray(value.evidence_facts)
    && isRecord(value.source_snapshot)
    && typeof value.source_snapshot_version === 'string'
    && typeof value.validation_status === 'string'
    && Array.isArray(value.validation_reasons)
    && typeof value.origin === 'string'
    && typeof value.status === 'string'
    && typeof value.created_by === 'string'
    && typeof value.created_at === 'string'
    && (value.validated_at === null || typeof value.validated_at === 'string')
    && (value.reviewed_by === null || typeof value.reviewed_by === 'string')
    && (value.reviewed_at === null || typeof value.reviewed_at === 'string')
    && (value.review_notes === null || typeof value.review_notes === 'string')
    && (value.applied_by === null || typeof value.applied_by === 'string')
    && (value.applied_at === null || typeof value.applied_at === 'string')
    && (value.operation_result === null || isRecord(value.operation_result))
    && typeof value.updated_at === 'string'
    && typeof value.apply_attempt_count === 'number'
    && (value.apply_started_at === null || typeof value.apply_started_at === 'string')
    && (value.apply_finished_at === null || typeof value.apply_finished_at === 'string')
    && (value.apply_outcome === null || typeof value.apply_outcome === 'string')
    && (value.apply_error_code === null || typeof value.apply_error_code === 'string')
    && (value.resulting_event_id === null || typeof value.resulting_event_id === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function fetchAtlasProposalTimeline(proposalId: string): Promise<AtlasProposalTimeline> {
  const { data, error } = await supabase.rpc('get_atlas_proposal_timeline', { p_proposal_id: proposalId });
  if (error || !data) throw new Error(error?.message || 'Unable to load Atlas proposal history.');
  const result = data as unknown as {
    proposal_id: string;
    proposal_type: AtlasProposalType;
    target_entity_type: AtlasProposalRecord['target_entity_type'];
    target_entity_id: string;
    status: AtlasProposalRecord['status'];
    validation_status: AtlasProposalRecord['validation_status'];
    validation_reasons: AtlasProposalRecord['validation_reasons'];
    events?: readonly {
      id: string;
      timestamp: string;
      action: string;
      actor_id: string | null;
      actor_kind: string;
      decision: string;
      operation: string | null;
      resource_type: string | null;
      resource_id: string | null;
      metadata: Record<string, unknown>;
    }[];
  };
  return {
    proposalId: result.proposal_id,
    proposalType: result.proposal_type,
    targetEntityType: result.target_entity_type,
    targetEntityId: result.target_entity_id,
    status: result.status,
    validationStatus: result.validation_status,
    validationReasons: result.validation_reasons,
    events: (result.events ?? []).map((event) => ({
      id: event.id,
      timestamp: event.timestamp,
      action: event.action,
      actorId: event.actor_id,
      actorKind: event.actor_kind,
      decision: event.decision,
      operation: event.operation,
      resourceType: event.resource_type,
      resourceId: event.resource_id,
      metadata: event.metadata,
    })),
  };
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

export async function applyAtlasProposal(proposal: AtlasProposalRecord): Promise<AtlasApplyResult> {
  if (proposal.status !== 'approved') throw new Error('A manager must approve an Atlas proposal before apply.');
  const response = proposal.proposal_type === 'change_trailer'
    ? await supabase.rpc('atlas_apply_trailer_proposal', { p_proposal_id: proposal.id })
    : proposal.proposal_type === 'change_shift_vehicle'
      ? await supabase.rpc('atlas_apply_shift_vehicle_proposal', { p_proposal_id: proposal.id })
      : await supabase.rpc('atlas_apply_task_proposal', { p_proposal_id: proposal.id });
  const { data, error } = response;
  if (error || !data) throw new Error(error?.message || 'Unable to apply Atlas proposal.');
  const result = data as unknown as {
    proposal_id: string;
    outcome_code: NonNullable<AtlasProposalRecord['apply_outcome']>;
    idempotent_replay?: boolean;
    proposal?: AtlasProposalRecord;
    operation_result?: Record<string, unknown> | null;
    resulting_event_id?: string | null;
  };
  return {
    proposalId: result.proposal_id,
    outcomeCode: result.outcome_code,
    idempotentReplay: result.idempotent_replay ?? false,
    proposal: result.proposal ?? null,
    operationResult: result.operation_result ?? null,
    resultingEventId: result.resulting_event_id ?? null,
  };
}

export function proposalTypeLabel(value: AtlasProposalType): string {
  return value === 'change_trailer' ? 'Change trailer' : value === 'change_shift_vehicle' ? 'Change shift vehicle' : 'Acknowledge task';
}
