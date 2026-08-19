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
