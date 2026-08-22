import { ATLAS_NEGATIVE_EXAMPLES, ATLAS_REVIEWED_PHRASES } from './atlasKnowledgeCorpus';
import { answerAtlasQuestion, classifyAtlasQuestion, type AtlasQuerySnapshot } from './atlasQueryRouter';
import type { AtlasCanonicalIntent } from './atlasKnowledge';
import { atlasLogicalTierForComplexity } from './atlasModelGateway';
import { resolveAtlasQuestion } from './atlasKnowledge';

export type AtlasBenchmarkExpected = 'DETERMINISTIC_ANSWER' | 'FAQ' | 'CLARIFICATION' | 'REASONING_REQUIRED' | 'UNKNOWN';
export type AtlasBenchmarkTier = 'NONE' | 'SYNTHESIS' | 'STANDARD' | 'DEEP';
export type AtlasBenchmarkCase = { id: string; question: string; expected: AtlasBenchmarkExpected; expectedTier: AtlasBenchmarkTier; canonicalIntent?: AtlasCanonicalIntent; source: 'reviewed_phrase' | 'negative_example' | 'edge_case' };

const reviewedCases: AtlasBenchmarkCase[] = ATLAS_REVIEWED_PHRASES.map((entry, index) => ({
  id: `phrase-${String(index + 1).padStart(3, '0')}`,
  question: entry.phrase,
  expected: entry.canonicalIntent.startsWith('faq_') ? 'FAQ' : 'DETERMINISTIC_ANSWER',
  expectedTier: 'NONE',
  canonicalIntent: entry.canonicalIntent,
  source: 'reviewed_phrase',
}));

const negativeCases: AtlasBenchmarkCase[] = ATLAS_NEGATIVE_EXAMPLES.map((entry, index) => ({
  id: `negative-${String(index + 1).padStart(3, '0')}`,
  question: entry.phrase,
  expected: entry.expected === 'faq' ? 'FAQ' : entry.expected === 'reasoning_required' ? 'REASONING_REQUIRED' : entry.expected === 'clarification' ? 'CLARIFICATION' : 'UNKNOWN',
  expectedTier: entry.expected === 'reasoning_required' ? (entry.phrase.includes('replan') ? 'DEEP' : 'STANDARD') : 'NONE',
  source: 'negative_example',
}));

const edgeCases: AtlasBenchmarkCase[] = [
  ['entity-readiness-001', 'Why is BX21 ABC unavailable?', 'DETERMINISTIC_ANSWER', 'NONE'],
  ['entity-driver-001', "What's Dave got tomorrow?", 'DETERMINISTIC_ANSWER', 'NONE'],
  ['entity-job-001', 'Has Job 1042 been acknowledged?', 'DETERMINISTIC_ANSWER', 'NONE'],
  ['entity-trailer-001', 'Anything wrong with trailer T123?', 'DETERMINISTIC_ANSWER', 'NONE'],
  ['entity-multi-001', 'Are BX21 ABC and BX22 XYZ both available?', 'CLARIFICATION', 'NONE'],
  ['entity-drivers-001', 'Which of Dave and Sarah have compliance warnings?', 'CLARIFICATION', 'NONE'],
  ['compound-001', "What's VOR and what's due an MOT?", 'CLARIFICATION', 'NONE'],
  ['compound-002', "What's late or unacknowledged?", 'CLARIFICATION', 'NONE'],
  ['compound-003', 'Any missing POD or POD awaiting review?', 'CLARIFICATION', 'NONE'],
  ['compound-004', "What's happening today and tomorrow?", 'CLARIFICATION', 'NONE'],
  ['typo-001', 'show vehciles off road', 'DETERMINISTIC_ANSWER', 'NONE'],
  ['typo-002', 'show jobs acknowleged', 'DETERMINISTIC_ANSWER', 'NONE'],
  ['typo-003', 'show delivary proof pending', 'DETERMINISTIC_ANSWER', 'NONE'],
  ['typo-004', 'show proff of delivery', 'DETERMINISTIC_ANSWER', 'NONE'],
  ['typo-005', 'show maintenence warnings', 'DETERMINISTIC_ANSWER', 'NONE'],
  ['unsupported-001', 'What is the weather?', 'UNKNOWN', 'NONE'],
  ['unsupported-002', 'Tell me a joke about lorries', 'UNKNOWN', 'NONE'],
  ['reasoning-001', 'Replan tomorrow after Dave calls in sick.', 'REASONING_REQUIRED', 'DEEP'],
  ['reasoning-002', 'Which driver is best for this job?', 'REASONING_REQUIRED', 'STANDARD'],
  ['reasoning-003', 'Optimise the fleet for next week.', 'REASONING_REQUIRED', 'DEEP'],
  ['reasoning-004', 'Write a customer email about the late delivery.', 'REASONING_REQUIRED', 'STANDARD'],
  ['legal-001', 'Is trailer T123 legally compliant?', 'CLARIFICATION', 'NONE'],
  ['history-001', 'Why was this vehicle previously VOR?', 'CLARIFICATION', 'NONE'],
  ['privacy-001', "Tell me the drivers' personal phone numbers", 'UNKNOWN', 'NONE'],
].map(([id, question, expected, expectedTier]) => ({ id, question, expected: expected as AtlasBenchmarkExpected, expectedTier: expectedTier as AtlasBenchmarkTier, source: 'edge_case' }));

export const ATLAS_BENCHMARK_CASES: AtlasBenchmarkCase[] = [...reviewedCases, ...negativeCases, ...edgeCases];
export const ATLAS_BENCHMARK_SIZE = ATLAS_BENCHMARK_CASES.length;

export type AtlasBenchmarkMetrics = {
  totalCases: number;
  correctlyClassified: number;
  falsePositiveDeterministicAnswers: number;
  falseNegativeDeterministicOpportunities: number;
  clarificationAccuracy: number;
  faqAccuracy: number;
  entityResolutionAccuracy: number;
  negationSafety: number;
  compoundAccuracy: number;
  reasoningRequiredAccuracy: number;
  deterministicContainmentRate: number;
  routineOperationalContainmentRate: number;
  unsafeContainmentRate: number;
};

export function evaluateAtlasBenchmark(cases: readonly AtlasBenchmarkCase[] = ATLAS_BENCHMARK_CASES): AtlasBenchmarkMetrics {
  const snapshot = emptySnapshot();
  let correctlyClassified = 0;
  let falsePositiveDeterministicAnswers = 0;
  let falseNegativeDeterministicOpportunities = 0;
  let clarificationCorrect = 0;
  let clarificationTotal = 0;
  let faqCorrect = 0;
  let faqTotal = 0;
  let entityCorrect = 0;
  let entityTotal = 0;
  let negationCorrect = 0;
  let negationTotal = 0;
  let compoundCorrect = 0;
  let compoundTotal = 0;
  let reasoningCorrect = 0;
  let reasoningTotal = 0;
  let contained = 0;
  let unsafe = 0;
  let routineContained = 0;
  let routineTotal = 0;
  for (const testCase of cases) {
    const resolution = resolveAtlasQuestion(testCase.question, snapshot);
    const classification = classifyAtlasQuestion(testCase.question);
    const answer = answerAtlasQuestion(testCase.question, snapshot);
    const safeDeterministic = answer.mode === 'deterministic' && answer.inferenceDecision.tier === 'NONE' && !resolution.clarification;
    const isFaq = resolution.canonicalIntents[0]?.startsWith('faq_') === true;
    const isClarification = Boolean(resolution.clarification);
    const isReasoning = classification.tier >= 2;
    const matches = testCase.expected === 'DETERMINISTIC_ANSWER' ? safeDeterministic : testCase.expected === 'FAQ' ? isFaq && answer.inferenceDecision.tier === 'NONE' : testCase.expected === 'CLARIFICATION' ? isClarification && answer.inferenceDecision.tier === 'NONE' : testCase.expected === 'REASONING_REQUIRED' ? isReasoning && atlasLogicalTierForComplexity(classification.tier) === testCase.expectedTier : resolution.canonicalIntents[0] === 'unknown' && isClarification && answer.inferenceDecision.tier === 'NONE';
    if (matches) correctlyClassified += 1;
    if (testCase.expected !== 'DETERMINISTIC_ANSWER' && testCase.expected !== 'FAQ' && testCase.expected !== 'CLARIFICATION' && safeDeterministic) falsePositiveDeterministicAnswers += 1;
    if ((testCase.expected === 'DETERMINISTIC_ANSWER' || testCase.expected === 'FAQ') && !safeDeterministic && !isFaq) falseNegativeDeterministicOpportunities += 1;
    if (testCase.expected === 'CLARIFICATION') { clarificationTotal += 1; if (isClarification) clarificationCorrect += 1; }
    if (testCase.expected === 'FAQ') { faqTotal += 1; if (isFaq) faqCorrect += 1; }
    if (testCase.id.startsWith('entity-')) { entityTotal += 1; if (resolution.entities.length > 0 && (isClarification || safeDeterministic || isFaq)) entityCorrect += 1; }
    if ((testCase.source === 'negative_example' || testCase.id === 'legal-001' || testCase.id === 'history-001') && testCase.question.match(/\b(?:not|without|previously|legally|remove|aren't)\b/i)) { negationTotal += 1; if (isClarification || isFaq) negationCorrect += 1; }
    if (testCase.id.startsWith('compound-')) { compoundTotal += 1; if (isClarification) compoundCorrect += 1; }
    if (testCase.expected === 'REASONING_REQUIRED') { reasoningTotal += 1; if (isReasoning && answer.inferenceDecision.tier !== 'NONE' && answer.inferenceDecision.outcome !== 'reasoning_required') reasoningCorrect += 1; }
    if (answer.inferenceDecision.tier === 'NONE' && (safeDeterministic || isFaq || isClarification)) contained += 1;
    if (safeDeterministic && testCase.expected !== 'DETERMINISTIC_ANSWER' && testCase.expected !== 'FAQ') unsafe += 1;
    if (testCase.expected === 'DETERMINISTIC_ANSWER') { routineTotal += 1; if (safeDeterministic) routineContained += 1; }
  }
  return { totalCases: cases.length, correctlyClassified, falsePositiveDeterministicAnswers, falseNegativeDeterministicOpportunities, clarificationAccuracy: ratio(clarificationCorrect, clarificationTotal), faqAccuracy: ratio(faqCorrect, faqTotal), entityResolutionAccuracy: ratio(entityCorrect, entityTotal), negationSafety: ratio(negationCorrect, negationTotal), compoundAccuracy: ratio(compoundCorrect, compoundTotal), reasoningRequiredAccuracy: ratio(reasoningCorrect, reasoningTotal), deterministicContainmentRate: ratio(contained, cases.length), routineOperationalContainmentRate: ratio(routineContained, routineTotal), unsafeContainmentRate: ratio(unsafe, cases.length) };
}

function ratio(numerator: number, denominator: number): number { return denominator === 0 ? 0 : numerator / denominator; }
function emptySnapshot(): AtlasQuerySnapshot { return { morningBriefing: { generatedAt: '2026-08-22T08:00:00.000Z', sections: { yesterday: [], today: [], tomorrow: [], next30: [] }, totalItems: 0 }, tasks: [], assets: [], driverCompliance: [{ id: 'driver-dave:driving_licence', driverId: 'driver-dave', driverLabel: 'Dave', evidenceType: 'driving_licence', label: 'Driving licence', dueDate: '2027-01-01', daysRemaining: 132, status: 'known_valid', horizon: 90, severity: 'info', missingEvidence: false, evidenceSource: 'profile', planningRisk: 'none', planningConflictDates: [] }, { id: 'driver-sarah:driving_licence', driverId: 'driver-sarah', driverLabel: 'Sarah', evidenceType: 'driving_licence', label: 'Driving licence', dueDate: '2027-01-01', daysRemaining: 132, status: 'known_valid', horizon: 90, severity: 'info', missingEvidence: false, evidenceSource: 'profile', planningRisk: 'none', planningConflictDates: [] }], pendingEvidence: [], driverWork: [] }; }
