import type { AtlasInferencePolicy, AtlasModelTier } from './atlasModelGateway';
import { supabase } from './supabase';

export type GovernedAtlasPolicy = AtlasInferencePolicy & { companyId: string; providerSlot: string | null; updatedAt: string; updatedBy: string | null };
type PolicyRow = { company_id: string; enabled: boolean; allowed_tiers: string[]; monthly_budget_minor_units: number | null; per_request_budget_minor_units: number | null; daily_request_limit: number | null; monthly_request_limit: number | null; provider_slot: string | null; paid_inference_activation_authority: 'unavailable' | 'owner' | 'billing'; updated_by: string | null; updated_at: string };
export type AtlasContainmentAnalyticsRow = { day: string; total_questions: number; deterministic_answers: number; faq_answers: number; clarifications: number; reasoning_candidates: number; unknown_questions: number; containment_rate: number; entity_resolution_count: number; compound_query_count: number };

export async function fetchGovernedAtlasPolicy(): Promise<GovernedAtlasPolicy | null> {
  const { data, error } = await (supabase.rpc as unknown as (name: string, args?: Record<string, unknown>) => Promise<{ data: PolicyRow[] | null; error: { message: string } | null }>)('get_atlas_inference_policy');
  if (error) throw new Error(error.message || 'Unable to load the governed Atlas policy.');
  return data?.[0] ? mapPolicy(data[0]) : null;
}

export async function updateGovernedAtlasPolicy(input: Pick<GovernedAtlasPolicy, 'enabled' | 'allowedTiers' | 'monthlyBudgetMinorUnits' | 'perRequestBudgetMinorUnits' | 'dailyRequestLimit' | 'monthlyRequestLimit'>): Promise<GovernedAtlasPolicy | null> {
  const { data, error } = await (supabase.rpc as unknown as (name: string, args?: Record<string, unknown>) => Promise<{ data: PolicyRow[] | null; error: { message: string } | null }>)('update_atlas_inference_policy', {
    p_enabled: input.enabled,
    p_allowed_tiers: input.allowedTiers,
    p_monthly_budget_minor_units: input.monthlyBudgetMinorUnits,
    p_per_request_budget_minor_units: input.perRequestBudgetMinorUnits,
    p_daily_request_limit: input.dailyRequestLimit,
    p_monthly_request_limit: input.monthlyRequestLimit,
  });
  if (error) throw new Error(error.message || 'Unable to update the governed Atlas policy.');
  return data?.[0] ? mapPolicy(data[0]) : null;
}

export async function recordAtlasContainment(outcome: string, questionFingerprint: string, entityCount: number, compoundQuery = false): Promise<void> {
  const { error } = await (supabase.rpc as unknown as (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)('record_atlas_containment_outcome', { p_outcome: outcome, p_question_fingerprint: questionFingerprint, p_entity_count: entityCount, p_compound_query: compoundQuery });
  if (error) throw new Error(error.message || 'Unable to record Atlas containment aggregate.');
}

export async function fetchAtlasContainmentAnalytics(fromDate?: string, toDate?: string): Promise<AtlasContainmentAnalyticsRow[]> {
  const { data, error } = await (supabase.rpc as unknown as (name: string, args?: Record<string, unknown>) => Promise<{ data: AtlasContainmentAnalyticsRow[] | null; error: { message: string } | null }>)('get_atlas_containment_analytics', { p_from_date: fromDate, p_to_date: toDate });
  if (error) throw new Error(error.message || 'Unable to load aggregate Atlas containment analytics.');
  return data ?? [];
}

function mapPolicy(row: PolicyRow): GovernedAtlasPolicy { return { companyId: row.company_id, enabled: row.enabled, allowedTiers: row.allowed_tiers.filter((tier): tier is AtlasModelTier => ['SYNTHESIS', 'STANDARD', 'DEEP'].includes(tier)), monthlyBudgetMinorUnits: row.monthly_budget_minor_units, perRequestBudgetMinorUnits: row.per_request_budget_minor_units, dailyRequestLimit: row.daily_request_limit, monthlyRequestLimit: row.monthly_request_limit, paidInferenceActivationAuthority: row.paid_inference_activation_authority, providerSlot: row.provider_slot, updatedAt: row.updated_at, updatedBy: row.updated_by }; }
