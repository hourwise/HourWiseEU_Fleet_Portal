import { describe, expect, it } from 'vitest';
import { fingerprintAtlasQuestion, isFreeAndNotAdmitted, summarizeContainment, type AtlasContainmentEvent } from './atlasContainment';

const free = { tier: 'NONE' as const, outcome: 'deterministic_answer' as const };
describe('Batch19 Atlas containment accounting', () => {
  it('stores only stable fingerprints, never raw question text', () => {
    expect(fingerprintAtlasQuestion('show me vor vehicles')).toMatch(/^q-[0-9a-f]{8}$/);
    expect(fingerprintAtlasQuestion('show me vor vehicles')).toBe(fingerprintAtlasQuestion('show me vor vehicles'));
  });
  it('counts deterministic, FAQ, clarification, and unresolved outcomes', () => {
    const events: AtlasContainmentEvent[] = [
      { outcome: 'deterministic', mode: 'deterministic', inferenceDecision: free, entityCount: 0, intentCount: 1, questionFingerprint: 'q-00000001' },
      { outcome: 'faq', mode: 'deterministic', inferenceDecision: free, entityCount: 0, intentCount: 1, questionFingerprint: 'q-00000002' },
      { outcome: 'clarification', mode: 'deterministic', inferenceDecision: free, entityCount: 0, intentCount: 2, questionFingerprint: 'q-00000003' },
      { outcome: 'unresolved', mode: 'synthesis_required', inferenceDecision: { tier: 'SYNTHESIS', outcome: 'inference_disabled' }, entityCount: 0, intentCount: 0, questionFingerprint: 'q-00000004' },
    ];
    expect(summarizeContainment(events)).toMatchObject({ total: 4, contained: 3, containmentRate: 0.75 });
    expect(isFreeAndNotAdmitted(events[0])).toBe(true);
    expect(isFreeAndNotAdmitted(events[3])).toBe(false);
  });
});
