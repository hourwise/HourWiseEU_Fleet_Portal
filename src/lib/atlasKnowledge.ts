import type { AtlasIntent, AtlasQuerySnapshot } from './atlasQueryRouter';
import { ATLAS_FAQ_ENTRIES, ATLAS_REVIEWED_PHRASES } from './atlasKnowledgeCorpus';
export { ATLAS_FAQ_ENTRIES, ATLAS_KNOWLEDGE_VERSION } from './atlasKnowledgeCorpus';

/** Stable, reviewable language contracts. These are deliberately data, not a model prompt. */
export const ATLAS_CANONICAL_INTENTS = [
  'morning_briefing', 'yesterday_carry_over', 'today_attention', 'tomorrow_conflicts', 'next30_warnings',
  'jobs_acknowledgement', 'jobs_exceptions', 'jobs_incomplete', 'jobs_for_driver', 'jobs_for_date', 'job_status',
  'assets_prohibited', 'assets_ready', 'asset_readiness_reason', 'asset_defects', 'asset_compliance', 'trailer_compliance',
  'driver_compliance', 'driver_missing_evidence', 'driver_upcoming_expiry', 'driver_assignment_conflict',
  'task_queue', 'unresolved_tasks', 'task_reason', 'pod_review', 'pod_follow_up', 'pod_status',
  'proposal_status', 'operational_health', 'faq_vor', 'faq_pod', 'faq_compliance', 'faq_atlas', 'unknown',
] as const;

export type AtlasCanonicalIntent = typeof ATLAS_CANONICAL_INTENTS[number];
export type AtlasConfidenceBand = 'high' | 'medium' | 'low';
export type AtlasEntityType = 'vehicle_registration' | 'trailer_reference' | 'job_reference' | 'driver_label' | 'date' | 'proposal_id' | 'task_id';
export type AtlasEntity = { type: AtlasEntityType; value: string; normalizedValue: string; start: number; end: number };
export type AtlasTemporalPhrase = 'yesterday' | 'today' | 'tomorrow' | 'next7' | 'next14' | 'next30' | 'this_week' | 'next_week';

export type AtlasKnowledgeResolution = {
  canonicalIntents: AtlasCanonicalIntent[];
  legacyIntent: AtlasIntent;
  normalizedQuestion: string;
  entities: AtlasEntity[];
  temporalPhrases: AtlasTemporalPhrase[];
  confidence: number;
  confidenceBand: AtlasConfidenceBand;
  clarification: string | null;
  faqAnswer: string | null;
  navigationTarget: string | null;
  negatedTerms: string[];
  matchedFaqId: string | null;
  compoundOverflow: boolean;
};

const GLOSSARY: ReadonlyArray<readonly [string, string]> = [
  ['proof of delivery', 'pod'], ['delivery proof', 'pod'], ['delivery evidence', 'pod'], ['delivery note', 'pod'], ['delivery notes', 'pod'], ['signed note', 'pod'], ['lorry', 'vehicle'], ['lorries', 'vehicle'], ['truck', 'vehicle'], ['tractor unit', 'vehicle'], ['tractor', 'vehicle'], ['unit', 'vehicle'], ['off road', 'vor'],
  ['off-road', 'vor'], ['vehicle off road', 'vor'], ['driver qualification card', 'cpc'], ['dcq', 'cpc'],
  ['medical certificate', 'medical'], ['roadworthiness', 'compliance'], ['acknowledgment', 'acknowledgement'],
  ['rota', 'shift'], ['job sheet', 'job'], ['unable to complete', 'unable_to_complete'], ['out of service', 'vor'],
];

const FAQS: Record<string, { answer: string; href: string }> = {
  faq_vor: { answer: 'VOR means vehicle off road. The Portal treats VOR or an unresolved safety defect as a deterministic assignment prohibition until the authoritative readiness state changes.', href: '/dashboard?workspace=fleet&fleet=vehicles' },
  faq_pod: { answer: 'POD evidence is attached to a real job assignment and remains subject to manager review. Uploading evidence does not complete the job; the authoritative lifecycle transition does that.', href: '/dashboard?workspace=people&people=jobs&panel=pod-review' },
  faq_compliance: { answer: 'Licence, CPC/DQC, and medical forecasts use current Portal evidence. Missing evidence and future planning conflicts are shown separately and are not automatic legal conclusions.', href: '/dashboard?workspace=people&people=drivers' },
  faq_atlas: { answer: 'Atlas deterministic answers are built from company-scoped Portal state and events. No model or external inference provider is called for this answer.', href: '/dashboard?workspace=people&people=atlas' },
};

const REVIEWED_PHRASE_INDEX = new Map<string, AtlasCanonicalIntent[]>();
for (const entry of ATLAS_REVIEWED_PHRASES) {
  const current = REVIEWED_PHRASE_INDEX.get(normalizeAtlasQuestion(entry.phrase)) ?? [];
  if (!current.includes(entry.canonicalIntent)) current.push(entry.canonicalIntent);
  REVIEWED_PHRASE_INDEX.set(normalizeAtlasQuestion(entry.phrase), current);
}

export function normalizeAtlasQuestion(question: string): string {
  // Keep apostrophe handling compatible with the existing normalizer, then apply only reviewed vocabulary corrections.
  let value = question.normalize('NFKC').toLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}\s:/_.-]/gu, ' ');
  value = expandNegationContractions(value);
  value = correctCommonOperationalTypos(value);
  for (const [phrase, replacement] of GLOSSARY) value = value.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'g'), replacement);
  return value.replace(/\s+/g, ' ').trim();
}

export function resolveAtlasQuestion(question: string, snapshot?: AtlasQuerySnapshot): AtlasKnowledgeResolution {
  const normalizedQuestion = normalizeAtlasQuestion(question);
  const entities = extractAtlasEntities(question, snapshot);
  const temporalPhrases = extractTemporalPhrases(normalizedQuestion);
  const negatedTerms = extractNegatedTerms(normalizedQuestion);
  const canonicalIntents = classifyCanonicalIntents(normalizedQuestion, temporalPhrases, negatedTerms);
  const matchedFaq = ATLAS_FAQ_ENTRIES.find((entry) => normalizeAtlasQuestion(entry.phrase) === normalizedQuestion);
  const canonicalWithFaq = matchedFaq ? [matchedFaq.canonicalIntent] : canonicalIntents;
  const legacyIntent = /what needs attention/.test(normalizedQuestion) && !/and tomorrow|and yesterday/.test(normalizedQuestion) ? 'morning_briefing' : toLegacyIntent(canonicalWithFaq[0] ?? 'unknown');
  const faq = matchedFaq ? { answer: matchedFaq.answer, href: matchedFaq.navigationTarget } : canonicalWithFaq.length === 1 ? FAQS[canonicalWithFaq[0]] : undefined;
  const confidence = scoreConfidence(normalizedQuestion, canonicalWithFaq, entities, Boolean(faq));
  const compoundOverflow = canonicalIntents[0] === 'unknown' && (normalizedQuestion.match(/\b(?:and|or)\b/g)?.length ?? 0) >= 3;
  const clarification = compoundOverflow
    ? 'This question contains more operational components than the deterministic query layer can safely combine. Please split it into up to three focused questions.'
    : canonicalWithFaq.length > 1 && hasAmbiguousCompound(normalizedQuestion)
    ? 'I found more than one possible operational request. Please ask about one Portal area at a time.'
    : confidence < 0.55 ? 'I could not safely map that question to a governed Portal intent. Try naming the job, driver, vehicle, trailer, or compliance area.' : null;
  return { canonicalIntents: canonicalWithFaq, legacyIntent, normalizedQuestion, entities, temporalPhrases, confidence, confidenceBand: confidence >= 0.8 ? 'high' : confidence >= 0.55 ? 'medium' : 'low', clarification, faqAnswer: faq?.answer ?? null, navigationTarget: faq?.href ?? null, negatedTerms, matchedFaqId: matchedFaq?.id ?? null, compoundOverflow };
}

export function isReviewedAtlasPhrase(question: string): boolean { return REVIEWED_PHRASE_INDEX.has(normalizeAtlasQuestion(question)); }

export function extractAtlasEntities(question: string, snapshot?: AtlasQuerySnapshot): AtlasEntity[] {
  const entities: AtlasEntity[] = [];
  const add = (type: AtlasEntityType, value: string, start: number) => entities.push({ type, value, normalizedValue: value.toLowerCase(), start, end: start + value.length });
  for (const match of question.matchAll(/\b[A-Z]{1,3}\d{1,4}\s?[A-Z]{1,3}\b/g)) add('vehicle_registration', match[0], match.index ?? 0);
  for (const match of question.matchAll(/\b(?:trailer|trl|tr)[:\s-]*[A-Z0-9-]{2,}\b/gi)) add('trailer_reference', match[0], match.index ?? 0);
  for (const match of question.matchAll(/\b(?:job|assignment|load|proposal|task)[:\s#-]*[A-Z0-9-]{2,}\b/gi)) {
    const lower = match[0].toLowerCase();
    add(lower.startsWith('proposal') ? 'proposal_id' : lower.startsWith('task') ? 'task_id' : 'job_reference', match[0], match.index ?? 0);
  }
  for (const phrase of snapshot?.driverCompliance.map((item) => item.driverLabel) ?? []) addIfPresent('driver_label', phrase, question, add);
  for (const phrase of snapshot?.assets.map((asset) => asset.label) ?? []) addIfPresent(assetKind(snapshot, phrase), phrase, question, add);
  return dedupeEntities(entities);
}

function classifyCanonicalIntents(question: string, temporal: AtlasTemporalPhrase[], negated: string[]): AtlasCanonicalIntent[] {
  const intents: AtlasCanonicalIntent[] = [];
  const add = (intent: AtlasCanonicalIntent, pattern: RegExp) => { if (pattern.test(question) && !intents.includes(intent)) intents.push(intent); };
  const reviewed = REVIEWED_PHRASE_INDEX.get(question) ?? [];
  if (reviewed.length > 0) return reviewed.slice(0, 3);
  if (/brief me|morning brief|morning briefing/.test(question) || (/what needs attention/.test(question) && !/\band\b/.test(question))) add('morning_briefing', /./);
  if (temporal.includes('yesterday') || /carry over|outstanding from/.test(question)) add('yesterday_carry_over', /./);
  if (temporal.includes('today') || /happening today|work today/.test(question)) add('today_attention', /./);
  if (temporal.includes('tomorrow')) add('tomorrow_conflicts', /./);
  if (temporal.some((phrase) => ['next7', 'next14', 'next30', 'next_week'].includes(phrase))) add('next30_warnings', /./);
  add('asset_readiness_reason', /why .* (blocked|vor|unavailable)|readiness reason|what is wrong with|anything wrong/);
  add('assets_prohibited', /\bvor\b|prohibited|off road/);
  add('asset_defects', /unresolved defect|safety defect|open defect/);
  add('trailer_compliance', /trailer.*compliance|compliance.*trailer/);
  add('asset_compliance', /(vehicle|asset).*compliance|compliance.*(vehicle|asset)|missing (?:pod|evidence)|\b(?:mot|pmi|annual test|maintenance)\b/);
  add('driver_compliance', /driver.*(licen|cpc|medical|compliance)|licen.*driver|cpc.*driver/);
  add('driver_missing_evidence', /driver.*missing|missing.*(licen|cpc|medical)/);
  add('driver_assignment_conflict', /driver.*(assignment|job).*conflict|planned.*expiry/);
  add('jobs_acknowledgement', /unacknowledged|awaiting acknowledgement|not acknowledged|job.*acknowledge|acknowledge.*job/);
  add('jobs_exceptions', /delayed|late|exception job|vehicle issue|site issue|route issue|unable_to_complete/);
  add('jobs_incomplete', /incomplete|unable to complete/);
  add('task_queue', /task queue|operational tasks|open tasks/);
  add('unresolved_tasks', /unresolved task|outstanding task/);
  add('pod_follow_up', /pod.*follow|follow.*pod/);
  add('pod_review', /pod|proof|evidence.*review|review.*evidence/);
  add('proposal_status', /proposal/);
  add('operational_health', /operational health|fleet health/);
  if (/what is v(or)?\b|meaning of v(or)?\b/.test(question)) intents.splice(0, intents.length, 'faq_vor');
  else if (/what is pod\b|what does pod mean/.test(question)) intents.splice(0, intents.length, 'faq_pod');
  else if (/what does atlas do|is atlas using ai|how does atlas work/.test(question)) intents.splice(0, intents.length, 'faq_atlas');
  else if (/what evidence.*(licen|cpc|medical)|what is cpc|medical evidence mean/.test(question)) intents.splice(0, intents.length, 'faq_compliance');
  if (/previous|historic|last year|used to|remove .*\bvor\b|clear .*\bvor\b|change .*\bvor\b|\blegal(?:ly)?\b/.test(question) && intents.some((intent) => ['assets_prohibited', 'asset_defects', 'trailer_compliance'].includes(intent))) return ['unknown'];
  if (negated.length > 0 && intents.some((intent) => ['assets_prohibited', 'asset_defects', 'driver_compliance', 'driver_missing_evidence', 'jobs_exceptions'].includes(intent))) return ['unknown'];
  if (/which of .*\band\b.*(?:compliance|warning|available)/.test(question)) return ['unknown'];
  if (intents.length > 3) return ['unknown'];
  return intents.length > 0 ? intents.slice(0, 3) : ['unknown'];
}

function extractTemporalPhrases(question: string): AtlasTemporalPhrase[] {
  const result: AtlasTemporalPhrase[] = [];
  const add = (value: AtlasTemporalPhrase, pattern: RegExp) => { if (pattern.test(question) && !result.includes(value)) result.push(value); };
  add('yesterday', /yesterday|last night/); add('today', /\btoday\b/); add('tomorrow', /\btomorrow\b/);
  add('next7', /next 7|next seven|coming week/); add('next14', /next 14|next fourteen/); add('next30', /next 30|next thirty|next month/); add('this_week', /this week/); add('next_week', /next week/);
  return result;
}

function extractNegatedTerms(question: string): string[] { return [...question.matchAll(/\b(?:not|no|without|never)\s+([a-z]+)/g)].map((match) => match[1]); }
function scoreConfidence(question: string, intents: AtlasCanonicalIntent[], entities: AtlasEntity[], faq: boolean): number {
  if (faq) return 0.99;
  if (intents[0] === 'unknown') return 0.2;
  const compatibleEntityCount = entities.filter((entity) => intents.some((intent) => entityCompatibleWithIntent(entity.type, intent))).length;
  const incompatibleEntityPenalty = entities.length > 0 && compatibleEntityCount === 0 ? 0.28 : 0;
  return Math.max(0.2, Math.min(0.98, 0.62 + (intents.length === 1 ? 0.16 : 0) + (compatibleEntityCount > 0 ? 0.1 : 0) + (question.length > 12 ? 0.05 : 0) - incompatibleEntityPenalty));
}
function entityCompatibleWithIntent(entityType: AtlasEntityType, intent: AtlasCanonicalIntent): boolean { if (entityType === 'vehicle_registration') return ['asset_readiness_reason', 'assets_prohibited', 'assets_ready', 'asset_defects', 'asset_compliance', 'operational_health'].includes(intent); if (entityType === 'trailer_reference') return ['asset_readiness_reason', 'assets_prohibited', 'assets_ready', 'trailer_compliance', 'asset_defects'].includes(intent); if (entityType === 'driver_label') return ['driver_compliance', 'driver_missing_evidence', 'driver_upcoming_expiry', 'driver_assignment_conflict', 'jobs_for_driver', 'tomorrow_conflicts'].includes(intent); if (entityType === 'job_reference') return ['job_status', 'jobs_acknowledgement', 'jobs_exceptions', 'jobs_incomplete', 'jobs_for_date', 'pod_review', 'pod_status'].includes(intent); return true; }
function hasAmbiguousCompound(question: string): boolean { return /\b(and|or)\b/.test(question); }
function toLegacyIntent(intent: AtlasCanonicalIntent): AtlasIntent { const map: Partial<Record<AtlasCanonicalIntent, AtlasIntent>> = { morning_briefing: 'morning_briefing', yesterday_carry_over: 'yesterday_carry_over', today_attention: 'today', tomorrow_conflicts: 'tomorrow', next30_warnings: 'next30', asset_readiness_reason: 'asset_readiness_reason', assets_prohibited: 'vor_assets', assets_ready: 'asset_compliance', faq_vor: 'vor_assets', asset_defects: 'unresolved_defects', asset_compliance: 'asset_compliance', trailer_compliance: 'asset_compliance', jobs_acknowledgement: 'jobs_awaiting_acknowledgement', jobs_exceptions: 'delayed_or_exception_jobs', jobs_incomplete: 'incomplete_jobs', jobs_for_driver: 'operational_task_queue', jobs_for_date: 'operational_task_queue', job_status: 'operational_task_queue', driver_compliance: 'driver_compliance', driver_missing_evidence: 'driver_compliance', driver_upcoming_expiry: 'driver_compliance', driver_assignment_conflict: 'driver_compliance', faq_compliance: 'driver_compliance', pod_review: 'pod_evidence_review', pod_follow_up: 'pod_evidence_review', pod_status: 'pod_evidence_review', faq_pod: 'pod_evidence_review', faq_atlas: 'morning_briefing', task_queue: 'operational_task_queue', unresolved_tasks: 'operational_task_queue', task_reason: 'operational_task_queue', proposal_status: 'operational_task_queue', operational_health: 'morning_briefing' }; return map[intent] ?? 'unknown'; }
function addIfPresent(type: AtlasEntityType, value: string, question: string, add: (type: AtlasEntityType, value: string, start: number) => void): void { const start = question.toLowerCase().indexOf(value.toLowerCase()); if (start >= 0) add(type, value, start); }
function assetKind(snapshot: AtlasQuerySnapshot | undefined, value: string): AtlasEntityType { return snapshot?.assets.find((asset) => asset.label === value)?.kind === 'trailer' ? 'trailer_reference' : 'vehicle_registration'; }
function dedupeEntities(entities: AtlasEntity[]): AtlasEntity[] { return [...new Map(entities.map((entity) => [`${entity.type}:${entity.normalizedValue}`, entity])).values()]; }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function correctCommonOperationalTypos(value: string): string { return value.replace(/\bproff\s+of\s+delivery\b/g, 'proof of delivery').replace(/\bvehciles?\b/g, (match) => match.endsWith('s') ? 'vehicles' : 'vehicle').replace(/\backnowleged\b/g, 'acknowledged').replace(/\bdelivary\b/g, 'delivery').replace(/\bmaintenence\b/g, 'maintenance'); }
function expandNegationContractions(value: string): string { return value.replace(/\baren(?:'|\s+)t\b/g, 'are not').replace(/\bis(?:'|\s+)nt\b/g, 'is not').replace(/\bwas(?:'|\s+)nt\b/g, 'was not').replace(/\bwere(?:'|\s+)nt\b/g, 'were not').replace(/\bcan(?:'|\s+)t\b/g, 'can not').replace(/\bwon(?:'|\s+)t\b/g, 'will not'); }
