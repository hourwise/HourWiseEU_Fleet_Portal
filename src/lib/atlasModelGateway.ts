/** Provider-neutral seam for a future Atlas inference integration.
 *
 * Batch 18 adds admission and cost contracts, but deliberately keeps the
 * gateway disabled: no provider is configured and no external call is made.
 */
export type AtlasModelTier = 'SYNTHESIS' | 'STANDARD' | 'DEEP' | 'FALLBACK';
export type AtlasLogicalTier = 'NONE' | AtlasModelTier;
export type AtlasCostClass = 'free' | 'low' | 'medium' | 'high';

export type AtlasInferencePolicy = {
  enabled: boolean;
  allowedTiers: readonly AtlasModelTier[];
  monthlyBudgetMinorUnits: number | null;
  perRequestBudgetMinorUnits: number | null;
  dailyRequestLimit: number | null;
  monthlyRequestLimit: number | null;
};

export type AtlasUsageSummary = {
  dailyRequests: number;
  monthlyRequests: number;
  monthlySpendMinorUnits: number;
};

export type AtlasCostEstimate = {
  costClass: AtlasCostClass;
  estimatedMinorUnits: number | null;
  providerConfigured: boolean;
};

export type AtlasInferenceOutcome =
  | 'deterministic_answer'
  | 'inference_disabled'
  | 'tier_not_allowed'
  | 'budget_exceeded'
  | 'daily_limit_reached'
  | 'monthly_limit_reached'
  | 'provider_not_configured'
  | 'reasoning_required';

export type AtlasInferenceDecision = {
  outcome: AtlasInferenceOutcome;
  tier: AtlasLogicalTier;
  cost: AtlasCostEstimate;
  reason: string;
};

export const DEFAULT_ATLAS_INFERENCE_POLICY: AtlasInferencePolicy = {
  enabled: false,
  allowedTiers: ['SYNTHESIS', 'STANDARD', 'DEEP'],
  monthlyBudgetMinorUnits: null,
  perRequestBudgetMinorUnits: null,
  dailyRequestLimit: null,
  monthlyRequestLimit: null,
};

export function atlasLogicalTierForComplexity(tier: 0 | 1 | 2 | 3): AtlasLogicalTier {
  return tier === 0 ? 'NONE' : tier === 1 ? 'SYNTHESIS' : tier === 2 ? 'STANDARD' : 'DEEP';
}

export function estimateAtlasInferenceCost(tier: AtlasLogicalTier, providerConfigured = false): AtlasCostEstimate {
  if (tier === 'NONE') return { costClass: 'free', estimatedMinorUnits: 0, providerConfigured: false };
  // A provider-neutral gateway cannot invent currency prices. The estimate is
  // therefore a cost band until an approved provider supplies a price table.
  const costClass: AtlasCostClass = tier === 'SYNTHESIS' ? 'low' : tier === 'STANDARD' ? 'medium' : 'high';
  return { costClass, estimatedMinorUnits: null, providerConfigured };
}

export function evaluateAtlasInferenceAdmission(input: {
  tier: AtlasLogicalTier;
  policy?: AtlasInferencePolicy;
  usage?: AtlasUsageSummary;
  cost?: AtlasCostEstimate;
}): AtlasInferenceDecision {
  const policy = input.policy ?? DEFAULT_ATLAS_INFERENCE_POLICY;
  const usage = input.usage ?? { dailyRequests: 0, monthlyRequests: 0, monthlySpendMinorUnits: 0 };
  const cost = input.cost ?? estimateAtlasInferenceCost(input.tier);
  if (input.tier === 'NONE') return { outcome: 'deterministic_answer', tier: input.tier, cost, reason: 'This request is answered from authoritative Portal state.' };
  if (!policy.enabled) return { outcome: 'inference_disabled', tier: input.tier, cost, reason: 'Company inference policy is disabled.' };
  if (!policy.allowedTiers.includes(input.tier)) return { outcome: 'tier_not_allowed', tier: input.tier, cost, reason: 'The requested logical tier is not allowed by company policy.' };
  if (policy.dailyRequestLimit !== null && usage.dailyRequests >= policy.dailyRequestLimit) return { outcome: 'daily_limit_reached', tier: input.tier, cost, reason: 'The company daily inference request limit has been reached.' };
  if (policy.monthlyRequestLimit !== null && usage.monthlyRequests >= policy.monthlyRequestLimit) return { outcome: 'monthly_limit_reached', tier: input.tier, cost, reason: 'The company monthly inference request limit has been reached.' };
  if (cost.estimatedMinorUnits === null || !cost.providerConfigured) return { outcome: 'provider_not_configured', tier: input.tier, cost, reason: 'No approved provider or price table is configured.' };
  if (policy.perRequestBudgetMinorUnits !== null && cost.estimatedMinorUnits > policy.perRequestBudgetMinorUnits) return { outcome: 'budget_exceeded', tier: input.tier, cost, reason: 'The estimated request cost exceeds the per-request budget.' };
  if (policy.monthlyBudgetMinorUnits !== null && usage.monthlySpendMinorUnits + cost.estimatedMinorUnits > policy.monthlyBudgetMinorUnits) return { outcome: 'budget_exceeded', tier: input.tier, cost, reason: 'The estimated request cost exceeds the monthly budget.' };
  return { outcome: 'reasoning_required', tier: input.tier, cost, reason: 'Admission is possible under policy; a future server gateway must still perform the approved provider call.' };
}

export type AtlasModelRequest = {
  question: string;
  reasoningPacket: unknown;
  tier: AtlasModelTier;
};

export type AtlasModelResponse = {
  text: string;
  proposedActions?: readonly unknown[];
  decision?: AtlasInferenceDecision;
};

export interface AtlasModelGateway {
  synthesize(request: AtlasModelRequest): Promise<AtlasModelResponse>;
  reason(request: AtlasModelRequest): Promise<AtlasModelResponse>;
  deepReason(request: AtlasModelRequest): Promise<AtlasModelResponse>;
}

export const ATLAS_MODEL_TIER_ORDER: readonly AtlasModelTier[] = ['SYNTHESIS', 'STANDARD', 'DEEP', 'FALLBACK'];

/** A truthful disabled implementation used by tests and future wiring. */
export class DisabledAtlasModelGateway implements AtlasModelGateway {
  private response(tier: AtlasModelTier): AtlasModelResponse {
    return {
      text: 'Atlas inference is disabled. No model or external provider was called.',
      decision: evaluateAtlasInferenceAdmission({ tier }),
    };
  }

  async synthesize(request: AtlasModelRequest): Promise<AtlasModelResponse> { void request; return this.response('SYNTHESIS'); }
  async reason(request: AtlasModelRequest): Promise<AtlasModelResponse> { void request; return this.response('STANDARD'); }
  async deepReason(request: AtlasModelRequest): Promise<AtlasModelResponse> { void request; return this.response('DEEP'); }
}
