import { describe, expect, it } from 'vitest';
import { ATLAS_BENCHMARK_CASES, ATLAS_BENCHMARK_SIZE, evaluateAtlasBenchmark } from './atlasBenchmark';
import { ATLAS_CANONICAL_INTENTS, ATLAS_KNOWLEDGE_VERSION, normalizeAtlasQuestion, resolveAtlasQuestion } from './atlasKnowledge';
import { evaluateAtlasInferenceAdmission } from './atlasModelGateway';

describe('Batch20 Atlas deterministic coverage benchmark', () => {
  it('is a substantial declarative corpus with every canonical intent represented where meaningful', () => {
    expect(ATLAS_BENCHMARK_SIZE).toBeGreaterThanOrEqual(300);
    const represented = new Set(ATLAS_BENCHMARK_CASES.map((testCase) => testCase.canonicalIntent).filter(Boolean));
    for (const intent of ATLAS_CANONICAL_INTENTS.filter((value) => value !== 'unknown')) expect(represented.has(intent)).toBe(true);
    expect(ATLAS_KNOWLEDGE_VERSION).toMatch(/^2026-08-22\./);
  });

  it('measures the corpus without permitting unsafe deterministic containment', () => {
    const metrics = evaluateAtlasBenchmark();
    expect(metrics.falsePositiveDeterministicAnswers).toBe(0);
    expect(metrics.unsafeContainmentRate).toBe(0);
    expect(metrics.routineOperationalContainmentRate).toBeGreaterThanOrEqual(0.95);
    expect(metrics.clarificationAccuracy).toBeGreaterThanOrEqual(0.8);
    expect(metrics.faqAccuracy).toBeGreaterThanOrEqual(0.95);
    expect(metrics.reasoningRequiredAccuracy).toBeGreaterThanOrEqual(0.75);
  }, 60_000);

  it('handles reviewed typos, conservative negation, and bounded compounds', () => {
    expect(resolveAtlasQuestion('show vehciles off road').canonicalIntents).toContain('assets_prohibited');
    expect(resolveAtlasQuestion('which vehicles are not VOR').clarification).toBeTruthy();
    expect(resolveAtlasQuestion("What's VOR and what's due an MOT?").clarification).toBeTruthy();
    expect(resolveAtlasQuestion('tell me a joke').clarification).toBeTruthy();
    expect(normalizeAtlasQuestion('proff of delivery')).toBe('pod');
  });

  it('keeps every contained route at NONE and blocks future inference without activation authority', () => {
    const decision = evaluateAtlasInferenceAdmission({ tier: 'STANDARD', policy: { enabled: true, allowedTiers: ['STANDARD'], monthlyBudgetMinorUnits: 100, perRequestBudgetMinorUnits: 100, dailyRequestLimit: 10, monthlyRequestLimit: 100, paidInferenceActivationAuthority: 'owner' }, paidInferenceActivationAuthorized: true, privacyRedactionPassed: true, usage: { dailyRequests: 0, monthlyRequests: 0, monthlySpendMinorUnits: 0 }, cost: { costClass: 'low', estimatedMinorUnits: 10, providerConfigured: true } });
    expect(decision.outcome).toBe('reasoning_required');
    expect(evaluateAtlasInferenceAdmission({ tier: 'NONE' }).outcome).toBe('deterministic_answer');
  });
});
