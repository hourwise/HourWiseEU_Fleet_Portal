import type { AssetReadinessResult } from './assetCompliance';

export type AtlasOperationalProposal = {
  companyId: string;
  assignments: readonly AtlasAssignmentProposal[];
};

export type AtlasAssignmentProposal = {
  driverId: string;
  shiftId: string;
  jobAssignmentId?: string | null;
  vehicleId?: string | null;
  trailerId?: string | null;
};

export type AtlasProposalValidationContext = {
  companyId: string;
  driverIds: ReadonlySet<string>;
  shiftIds: ReadonlySet<string>;
  assignmentIds: ReadonlySet<string>;
  assets: readonly Pick<AssetReadinessResult, 'id' | 'status' | 'reasons'>[];
};

export type AtlasProposalViolationCode = 'company_scope' | 'driver_unknown' | 'shift_unknown' | 'assignment_unknown' | 'asset_unknown' | 'asset_prohibited' | 'duplicate_assignment';

export type AtlasProposalViolation = {
  code: AtlasProposalViolationCode;
  message: string;
  assignmentIndex: number;
  sourceId?: string;
};

export type AtlasProposalValidationResult = {
  valid: boolean;
  violations: AtlasProposalViolation[];
};

export type AtlasProposalType = 'change_trailer' | 'change_shift_vehicle' | 'acknowledge_task';
export type AtlasProposalValidationStatus = 'valid' | 'invalid' | 'stale' | 'requires_override' | 'unsupported';
export type AtlasProposalOrigin = 'deterministic' | 'future_model';

export type AtlasProposalReason = {
  code: string;
  message: string;
  sourceId?: string;
};

export type AtlasProposalDraft = {
  proposalType: AtlasProposalType;
  targetEntityType: 'job_assignment' | 'shift' | 'operational_task';
  targetEntityId: string;
  companyId: string;
  proposedChange: Record<string, unknown>;
  evidenceFacts: readonly Record<string, unknown>[];
  sourceSnapshot: Record<string, unknown>;
  sourceSnapshotVersion: string;
  origin: AtlasProposalOrigin;
};

export type AtlasProposalDeterministicContext = {
  companyId: string;
  target: {
    id: string;
    companyId: string;
    updatedAt: string;
    status: string;
  };
  activeDriverIds: ReadonlySet<string>;
  targetDriverId?: string | null;
  assetById: ReadonlyMap<string, Pick<AssetReadinessResult, 'id' | 'status' | 'reasons'>>;
  occupiedAssetIds: ReadonlySet<string>;
};

export type AtlasProposalDeterministicValidation = {
  status: AtlasProposalValidationStatus;
  reasons: AtlasProposalReason[];
};

/**
 * Local proposal construction guard. The database revalidation RPC remains the
 * authoritative final check immediately before review/apply.
 */
export function validateAtlasProposalDraft(
  context: AtlasProposalDeterministicContext,
  proposal: AtlasProposalDraft,
): AtlasProposalDeterministicValidation {
  const reasons: AtlasProposalReason[] = [];
  if (proposal.companyId !== context.companyId || context.target.companyId !== context.companyId) reasons.push({ code: 'company_scope', message: 'Proposal and target must belong to the authenticated company.' });
  if (proposal.targetEntityId !== context.target.id) reasons.push({ code: 'target_mismatch', message: 'Proposal target does not match the current Portal target.' });
  if (proposal.sourceSnapshotVersion !== context.target.updatedAt) reasons.push({ code: 'stale_snapshot', message: 'The authoritative target changed after this proposal was constructed.' });
  if (proposal.proposalType !== 'acknowledge_task' && !context.activeDriverIds.has(context.targetDriverId ?? '')) reasons.push({ code: 'driver_inactive', message: 'The target driver is not currently active in the company context.' });
  if (proposal.proposalType !== 'acknowledge_task' && (context.target.status === 'draft' || context.target.status === 'cancelled' || context.target.status === 'completed')) reasons.push({ code: 'lifecycle_restricted', message: 'The current lifecycle state does not permit this proposal.' });

  if (proposal.proposalType === 'change_trailer') {
    const trailerId = typeof proposal.proposedChange.trailer_id === 'string' ? proposal.proposedChange.trailer_id : null;
    const trailer = trailerId ? context.assetById.get(trailerId) : undefined;
    if (!trailer) reasons.push({ code: 'asset_unknown', message: 'The proposed trailer is not present in the current company readiness context.', sourceId: trailerId ?? undefined });
    else if (trailer.status === 'prohibited' || trailer.reasons.some((reason) => reason.severity === 'prohibited' || reason.code === 'unresolved_safety_defect')) reasons.push({ code: 'asset_prohibited', message: 'A VOR or unresolved-safety-defect trailer cannot be proposed.', sourceId: trailer.id });
    else if (trailer.status === 'unknown' || trailer.status === 'action_required') reasons.push({ code: 'asset_override_required', message: 'This trailer requires a separately governed readiness override.', sourceId: trailer.id });
    if (trailerId && context.occupiedAssetIds.has(trailerId)) reasons.push({ code: 'assignment_collision', message: 'The proposed trailer is already occupied by another active assignment.', sourceId: trailerId });
  } else if (proposal.proposalType === 'change_shift_vehicle') {
    const vehicleId = typeof proposal.proposedChange.vehicle_id === 'string' ? proposal.proposedChange.vehicle_id : null;
    const vehicle = vehicleId ? context.assetById.get(vehicleId) : undefined;
    if (!vehicle) reasons.push({ code: 'asset_unknown', message: 'The proposed vehicle is not present in the current company readiness context.', sourceId: vehicleId ?? undefined });
    else if (vehicle.status === 'prohibited' || vehicle.reasons.some((reason) => reason.severity === 'prohibited' || reason.code === 'unresolved_safety_defect')) reasons.push({ code: 'asset_prohibited', message: 'A VOR or unresolved-safety-defect vehicle cannot be proposed.', sourceId: vehicle.id });
    else if (vehicle.status === 'unknown' || vehicle.status === 'action_required') reasons.push({ code: 'asset_override_required', message: 'This vehicle requires a separately governed readiness override.', sourceId: vehicle.id });
    if (vehicleId && context.occupiedAssetIds.has(vehicleId)) reasons.push({ code: 'rota_collision', message: 'The proposed vehicle is already occupied by another active shift.', sourceId: vehicleId });
  } else if (proposal.proposalType === 'acknowledge_task') {
    if (!proposal.proposedChange.source_type || !proposal.proposedChange.source_id) reasons.push({ code: 'task_source_missing', message: 'A governed task source is required.' });
  } else {
    reasons.push({ code: 'unsupported_proposal', message: 'No governed Portal RPC is mapped to this proposal type.' });
  }

  const hasOverride = reasons.some((reason) => reason.code === 'asset_override_required');
  return { status: hasOverride ? 'requires_override' : reasons.length > 0 ? (reasons.some((reason) => reason.code === 'stale_snapshot') ? 'stale' : 'invalid') : 'valid', reasons };
}

/** Validates proposals before any existing governed RPC is considered. */
export function validateAtlasOperationalProposal(
  context: AtlasProposalValidationContext,
  proposal: AtlasOperationalProposal,
): AtlasProposalValidationResult {
  const violations: AtlasProposalViolation[] = [];
  if (proposal.companyId !== context.companyId) {
    violations.push({ code: 'company_scope', message: 'Proposal company scope does not match the authenticated Portal company.', assignmentIndex: -1 });
  }
  const seenAssignments = new Set<string>();
  const assetsById = new Map(context.assets.map((asset) => [asset.id, asset]));
  proposal.assignments.forEach((assignment, assignmentIndex) => {
    if (!context.driverIds.has(assignment.driverId)) violations.push({ code: 'driver_unknown', message: 'Proposed driver is not present in the authorised company context.', assignmentIndex, sourceId: assignment.driverId });
    if (!context.shiftIds.has(assignment.shiftId)) violations.push({ code: 'shift_unknown', message: 'Proposed shift is not present in the authorised company context.', assignmentIndex, sourceId: assignment.shiftId });
    if (assignment.jobAssignmentId && !context.assignmentIds.has(assignment.jobAssignmentId)) violations.push({ code: 'assignment_unknown', message: 'Proposed job assignment is not present in the authorised company context.', assignmentIndex, sourceId: assignment.jobAssignmentId });
    const proposedAssetIds = [assignment.vehicleId, assignment.trailerId].filter((value): value is string => Boolean(value));
    for (const assetId of proposedAssetIds) {
      const asset = assetsById.get(assetId);
      if (!asset) {
        violations.push({ code: 'asset_unknown', message: 'Proposed asset is not present in the authorised company context.', assignmentIndex, sourceId: assetId });
      } else if (asset.status === 'prohibited' || asset.reasons.some((reason) => reason.severity === 'prohibited' || reason.code === 'unresolved_safety_defect')) {
        violations.push({ code: 'asset_prohibited', message: 'A prohibited or unresolved-safety-defect asset cannot be proposed for assignment.', assignmentIndex, sourceId: assetId });
      }
    }
    if (assignment.jobAssignmentId) {
      if (seenAssignments.has(assignment.jobAssignmentId)) violations.push({ code: 'duplicate_assignment', message: 'The same job assignment appears more than once in the proposal.', assignmentIndex, sourceId: assignment.jobAssignmentId });
      seenAssignments.add(assignment.jobAssignmentId);
    }
  });
  return { valid: violations.length === 0, violations };
}
