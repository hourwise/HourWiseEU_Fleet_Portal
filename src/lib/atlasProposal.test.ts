import { describe, expect, it } from 'vitest';
import { evaluateAssetReadiness } from './assetCompliance';
import { buildEligibleShiftVehicleProposals, buildEligibleTrailerProposals } from './atlasProposal';
import { validateAtlasProposalDraft } from './atlasProposalValidation';

const readyTrailer = evaluateAssetReadiness({ id: 'trailer-ready', label: 'TR-READY', kind: 'trailer', isVor: false, motDueDate: '2099-01-01', pmiDueDate: '2099-01-01', tachoCalibrationDue: null, lolerDueDate: '2099-01-01', insuranceExpiry: '2099-01-01', unresolvedSafetyDefects: 0, vehicleDocumentCount: 1 }, new Date('2026-08-19'));
const blockedTrailer = evaluateAssetReadiness({ id: 'trailer-vor', label: 'TR-VOR', kind: 'trailer', isVor: true, motDueDate: '2099-01-01', pmiDueDate: '2099-01-01', tachoCalibrationDue: null, lolerDueDate: '2099-01-01', insuranceExpiry: '2099-01-01', unresolvedSafetyDefects: 0, vehicleDocumentCount: 1 }, new Date('2026-08-19'));
const readyVehicle = evaluateAssetReadiness({ id: 'vehicle-ready', label: 'VH-READY', kind: 'vehicle', isVor: false, motDueDate: '2099-01-01', pmiDueDate: '2099-01-01', tachoCalibrationDue: '2099-01-01', lolerDueDate: null, insuranceExpiry: '2099-01-01', unresolvedSafetyDefects: 0, vehicleDocumentCount: 1 }, new Date('2026-08-19'));

describe('Atlas deterministic proposal boundary', () => {
  it('constructs eligible trailer alternatives without claiming an optimum', () => {
    const proposals = buildEligibleTrailerProposals({ companyId: 'company-1', assignment: { id: 'assignment-1', companyId: 'company-1', shiftId: 'shift-1', driverId: 'driver-1', status: 'published', updatedAt: 'version-1', trailerId: null }, assets: [readyTrailer, blockedTrailer] });
    expect(proposals).toHaveLength(1);
    expect(proposals[0].proposedChange).toEqual({ trailer_id: 'trailer-ready' });
    expect(proposals[0].explanation).toContain('eligible alternative');
    expect(proposals[0].explanation).not.toContain('best');
  });

  it('constructs eligible shift vehicle alternatives and respects collision inputs', () => {
    const proposals = buildEligibleShiftVehicleProposals({ companyId: 'company-1', shift: { id: 'shift-1', companyId: 'company-1', driverId: 'driver-1', status: 'published', date: '2026-08-20', startTime: '08:00', endTime: '17:00', notes: null, updatedAt: 'version-1', vehicleId: null }, assets: [readyVehicle], occupiedVehicleIds: new Set(['vehicle-ready']) });
    expect(proposals).toHaveLength(0);
  });

  it('returns structured stale, prohibited, and company-scope outcomes', () => {
    const result = validateAtlasProposalDraft({ companyId: 'company-1', target: { id: 'assignment-1', companyId: 'company-1', updatedAt: 'version-2', status: 'published' }, activeDriverIds: new Set(['driver-1']), targetDriverId: 'driver-1', assetById: new Map([['trailer-vor', blockedTrailer]]), occupiedAssetIds: new Set() }, { proposalType: 'change_trailer', targetEntityType: 'job_assignment', targetEntityId: 'assignment-1', companyId: 'company-2', proposedChange: { trailer_id: 'trailer-vor' }, evidenceFacts: [], sourceSnapshot: {}, sourceSnapshotVersion: 'version-1', origin: 'deterministic' });
    expect(result.status).toBe('stale');
    expect(result.reasons.map((reason) => reason.code)).toEqual(expect.arrayContaining(['company_scope', 'stale_snapshot', 'asset_prohibited']));
  });

  it('does not apply anything while constructing a candidate', () => {
    const proposals = buildEligibleTrailerProposals({ companyId: 'company-1', assignment: { id: 'assignment-1', companyId: 'company-1', shiftId: 'shift-1', driverId: 'driver-1', status: 'published', updatedAt: 'version-1', trailerId: null }, assets: [readyTrailer] });
    expect(proposals[0].origin).toBe('deterministic');
    expect(proposals[0]).not.toHaveProperty('status');
  });
});
