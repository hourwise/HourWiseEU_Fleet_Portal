import { describe, expect, it } from 'vitest';
import { evaluateAssetReadiness } from './assetCompliance';
import { answerAtlasQuestion, buildAtlasReasoningPacket, classifyAtlasQuestion, type AtlasQuerySnapshot } from './atlasQueryRouter';
import { validateAtlasOperationalProposal } from './atlasProposalValidation';
import { normalizeAtlasQuestion, resolveAtlasQuestion } from './atlasKnowledge';

const asset = evaluateAssetReadiness({
  id: 'vehicle-1', label: 'AB12 CDE', kind: 'vehicle', isVor: true,
  motDueDate: '2026-09-01', pmiDueDate: '2026-09-01', tachoCalibrationDue: '2026-09-01', lolerDueDate: null,
  insuranceExpiry: '2026-09-01', unresolvedSafetyDefects: 0, vehicleDocumentCount: 2,
}, new Date('2026-08-19'));

const snapshot: AtlasQuerySnapshot = {
  morningBriefing: {
    generatedAt: '2026-08-19T08:00:00.000Z',
    sections: { yesterday: [], today: [], tomorrow: [], next30: [] },
    totalItems: 0,
  },
  tasks: [{ id: 'job-unacknowledged:assignment-1', severity: 'medium', category: 'drivers', title: 'Published job awaits driver acknowledgement', detail: 'The assignment is not acknowledged.', sourceType: 'job_assignment', sourceId: 'assignment-1', occurredAt: null, dueAt: null, navigationTarget: '/dashboard?workspace=people&people=jobs', actionable: true }],
  assets: [asset],
  driverCompliance: [],
  pendingEvidence: [],
};

describe('Atlas deterministic query router', () => {
  it('routes natural aliases to tier 0 deterministic intents', () => {
    expect(classifyAtlasQuestion('What needs attention today?')).toMatchObject({ intent: 'morning_briefing', tier: 0, mode: 'deterministic' });
    expect(classifyAtlasQuestion('show me VOR vehicles')).toMatchObject({ intent: 'vor_assets', tier: 0, mode: 'deterministic' });
    expect(classifyAtlasQuestion('what is outstanding from yesterday')).toMatchObject({ intent: 'yesterday_carry_over', tier: 0, mode: 'deterministic' });
  });

  it('returns source identity and navigation for deterministic answers', () => {
    const answer = answerAtlasQuestion('Why is vehicle AB12 CDE blocked?', snapshot);
    expect(answer.mode).toBe('deterministic');
    expect(answer.facts.some((fact) => fact.sourceId === 'vehicle-1')).toBe(true);
    expect(answer.sources.some((source) => source.navigationTarget.includes('vehicles'))).toBe(true);
  });

  it('distinguishes unknown, synthesis, reasoning, and deep planning requests', () => {
    expect(classifyAtlasQuestion('Tell me something interesting')).toMatchObject({ intent: 'unknown', tier: 1, mode: 'synthesis_required' });
    expect(classifyAtlasQuestion('Summarise today for the morning meeting')).toMatchObject({ intent: 'today', tier: 1, mode: 'synthesis_required' });
    expect(classifyAtlasQuestion('Which vehicle combination looks most suitable?')).toMatchObject({ tier: 2, mode: 'reasoning_required' });
    expect(classifyAtlasQuestion('Fred is sick, reorganise the day')).toMatchObject({ tier: 3, mode: 'reasoning_required' });
  });

  it('creates a minimal packet without personal contact or licence data', () => {
    const packet = buildAtlasReasoningPacket('Which driver and vehicle fit this job?', 2, snapshot);
    const serialised = JSON.stringify(packet);
    expect(serialised).not.toContain('email');
    expect(serialised).not.toContain('phone');
    expect(serialised).not.toContain('licence');
    expect(packet.constraints.join(' ')).toContain('existing governed RPCs');
  });

  it('rejects a prohibited asset before any governed write path', () => {
    const result = validateAtlasOperationalProposal({ companyId: 'company-1', driverIds: new Set(['driver-1']), shiftIds: new Set(['shift-1']), assignmentIds: new Set(['assignment-1']), assets: [asset] }, { companyId: 'company-1', assignments: [{ driverId: 'driver-1', shiftId: 'shift-1', jobAssignmentId: 'assignment-1', vehicleId: 'vehicle-1' }] });
    expect(result.valid).toBe(false);
    expect(result.violations.map((violation) => violation.code)).toContain('asset_prohibited');
  });

  it('uses the Batch19 glossary and canonical compound contract', () => {
    expect(normalizeAtlasQuestion('show lorries off-road')).toBe('show vehicle vor');
    expect(resolveAtlasQuestion('What needs attention today and tomorrow?').canonicalIntents).toEqual(['today_attention', 'tomorrow_conflicts']);
  });
});
