import { describe, expect, it } from 'vitest';
import { DisabledAtlasModelGateway, evaluateAtlasInferenceAdmission, estimateAtlasInferenceCost, atlasLogicalTierForComplexity } from './atlasModelGateway';

describe('Batch 18 Atlas inference boundary', () => {
  it('routes deterministic briefing work to the free NONE tier', () => {
    expect(atlasLogicalTierForComplexity(0)).toBe('NONE');
    expect(evaluateAtlasInferenceAdmission({ tier: 'NONE' }).outcome).toBe('deterministic_answer');
    expect(estimateAtlasInferenceCost('NONE')).toMatchObject({ costClass: 'free', estimatedMinorUnits: 0 });
  });

  it('keeps inference disabled by default and never fabricates a price', () => {
    const decision = evaluateAtlasInferenceAdmission({ tier: 'STANDARD' });
    expect(decision.outcome).toBe('inference_disabled');
    expect(estimateAtlasInferenceCost('STANDARD')).toMatchObject({ costClass: 'medium', estimatedMinorUnits: null, providerConfigured: false });
  });

  it('enforces policy, limits, and provider admission in deterministic order', () => {
    const policy = { enabled: true, allowedTiers: ['SYNTHESIS'] as const, monthlyBudgetMinorUnits: 100, perRequestBudgetMinorUnits: 50, dailyRequestLimit: 1, monthlyRequestLimit: 10 };
    expect(evaluateAtlasInferenceAdmission({ tier: 'STANDARD', policy }).outcome).toBe('tier_not_allowed');
    expect(evaluateAtlasInferenceAdmission({ tier: 'SYNTHESIS', policy, usage: { dailyRequests: 1, monthlyRequests: 0, monthlySpendMinorUnits: 0 }, cost: { costClass: 'low', estimatedMinorUnits: 1, providerConfigured: true } }).outcome).toBe('daily_limit_reached');
    expect(evaluateAtlasInferenceAdmission({ tier: 'SYNTHESIS', policy, cost: { costClass: 'low', estimatedMinorUnits: 51, providerConfigured: true } }).outcome).toBe('budget_exceeded');
    expect(evaluateAtlasInferenceAdmission({ tier: 'SYNTHESIS', policy, cost: { costClass: 'low', estimatedMinorUnits: null, providerConfigured: false } }).outcome).toBe('provider_not_configured');
  });

  it('provides a disabled provider-neutral gateway with no network seam', async () => {
    const response = await new DisabledAtlasModelGateway().reason({ question: 'private question', reasoningPacket: { safe: true }, tier: 'STANDARD' });
    expect(response.decision?.outcome).toBe('inference_disabled');
    expect(response.text).toContain('No model');
  });
});
