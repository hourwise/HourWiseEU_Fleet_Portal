import type { AtlasAnswerMode } from './atlasQueryRouter';
import type { AtlasInferenceDecision } from './atlasModelGateway';

export type AtlasContainmentOutcome = 'deterministic' | 'faq' | 'clarification' | 'unresolved' | 'reasoning_candidate';
export type AtlasContainmentEvent = {
  outcome: AtlasContainmentOutcome;
  mode: AtlasAnswerMode;
  inferenceDecision: Pick<AtlasInferenceDecision, 'tier' | 'outcome'>;
  entityCount: number;
  intentCount: number;
  questionFingerprint: string;
};
export type AtlasContainmentTotals = Record<AtlasContainmentOutcome, number> & { total: number; contained: number; containmentRate: number };

export function classifyContainmentOutcome(input: { mode: AtlasAnswerMode; faq: boolean; clarification: boolean; inferenceTier: AtlasInferenceDecision['tier'] }): AtlasContainmentOutcome {
  if (input.faq) return 'faq';
  if (input.clarification) return 'clarification';
  if (input.inferenceTier === 'NONE' && input.mode === 'deterministic') return 'deterministic';
  return input.mode === 'reasoning_required' ? 'reasoning_candidate' : 'unresolved';
}

export function summarizeContainment(events: readonly AtlasContainmentEvent[]): AtlasContainmentTotals {
  const totals: AtlasContainmentTotals = { deterministic: 0, faq: 0, clarification: 0, unresolved: 0, reasoning_candidate: 0, total: events.length, contained: 0, containmentRate: 0 };
  for (const event of events) { totals[event.outcome] += 1; if (event.outcome !== 'unresolved' && event.outcome !== 'reasoning_candidate') totals.contained += 1; }
  totals.containmentRate = totals.total === 0 ? 0 : totals.contained / totals.total;
  return totals;
}

/** Fingerprints support aggregate telemetry without retaining the raw question. */
export function fingerprintAtlasQuestion(normalizedQuestion: string): string {
  let hash = 2166136261;
  for (const character of normalizedQuestion) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `q-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function isFreeAndNotAdmitted(event: AtlasContainmentEvent): boolean { return event.inferenceDecision.tier === 'NONE' && event.inferenceDecision.outcome === 'deterministic_answer'; }
