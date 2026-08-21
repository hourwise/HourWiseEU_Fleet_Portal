import { supabase } from './supabase';
import type { AssetReadinessResult } from './assetCompliance';
import { buildComplianceForecast, forecastNeedsAction } from './complianceForecast';
import type { DriverComplianceForecastItem } from './driverComplianceForecast';
import { driverForecastNeedsAction } from './driverComplianceForecast';
import { fetchAtlasOperationsBriefing } from './atlasOperationalLoad';
import type { AtlasMorningBriefing, AtlasMorningSectionKey } from './atlasBriefing';
import { fetchOperationalTasks, type OperationalTask } from './operationalTaskQueue';
import { fetchAssetReadinessSnapshot } from './assetReadinessLoad';
import { atlasLogicalTierForComplexity, evaluateAtlasInferenceAdmission, type AtlasInferenceDecision } from './atlasModelGateway';
import { normalizeAtlasQuestion, resolveAtlasQuestion, type AtlasCanonicalIntent, type AtlasEntity } from './atlasKnowledge';

export type AtlasIntent =
  | 'morning_briefing'
  | 'yesterday_carry_over'
  | 'today'
  | 'tomorrow'
  | 'next30'
  | 'asset_readiness_reason'
  | 'vor_assets'
  | 'unresolved_defects'
  | 'jobs_awaiting_acknowledgement'
  | 'delayed_or_exception_jobs'
  | 'driver_compliance'
  | 'asset_compliance'
  | 'upcoming_expiry'
  | 'missing_evidence'
  | 'operational_task_queue'
  | 'pod_evidence_review'
  | 'incomplete_jobs'
  | 'unknown';

export type AtlasComplexityTier = 0 | 1 | 2 | 3;
export type AtlasAnswerMode = 'deterministic' | 'synthesis_required' | 'reasoning_required';

export type AtlasRouteClassification = {
  intent: AtlasIntent;
  canonicalIntent: AtlasCanonicalIntent;
  tier: AtlasComplexityTier;
  mode: AtlasAnswerMode;
  normalizedQuestion: string;
  confidence: number;
  confidenceBand: 'high' | 'medium' | 'low';
  entities: AtlasEntity[];
  clarification: string | null;
};

export type AtlasSource = {
  id: string;
  type: string;
  label: string;
  navigationTarget: string;
};

export type AtlasFact = {
  id: string;
  label: string;
  value: string;
  sourceType: string;
  sourceId: string;
  sourceLabel: string;
  navigationTarget: string;
};

export type AtlasReasoningPacket = {
  tier: 2 | 3;
  intent: AtlasIntent;
  objective: string;
  constraints: readonly string[];
  drivers: readonly {
    driverRef: string;
    availability: 'not_asserted';
    complianceSignals: readonly string[];
    assignedWorkCount: number;
  }[];
  assets: readonly {
    assetRef: string;
    kind: 'vehicle' | 'trailer';
    readinessStatus: string;
    reasons: readonly string[];
  }[];
  jobs: readonly {
    assignmentRef: string;
    status: string;
    issue: string;
  }[];
};

export type AtlasAnswer = {
  mode: AtlasAnswerMode;
  intent: AtlasIntent;
  canonicalIntent?: AtlasCanonicalIntent;
  answer?: string;
  facts: AtlasFact[];
  sources: AtlasSource[];
  navigationTargets: string[];
  inferenceDecision: AtlasInferenceDecision;
  reasoningPacket?: AtlasReasoningPacket;
};

export type AtlasPendingEvidence = {
  id: string;
  jobId: string;
  assignmentId: string;
  evidenceType: string;
  outcome: string;
  uploadedAt: string;
};

export type AtlasQuerySnapshot = {
  morningBriefing: AtlasMorningBriefing;
  tasks: OperationalTask[];
  assets: AssetReadinessResult[];
  driverCompliance: DriverComplianceForecastItem[];
  pendingEvidence: AtlasPendingEvidence[];
};

export async function fetchAtlasQuerySnapshot(companyId: string, now = new Date()): Promise<AtlasQuerySnapshot> {
  const [{ data: evidence, error: evidenceError }, morningBriefing, tasks, assets, driverCompliance] = await Promise.all([
    supabase.from('job_evidence').select('id, job_id, job_assignment_id, evidence_type, outcome, uploaded_at').eq('company_id', companyId).in('review_status', ['pending', 'needs_follow_up']).order('uploaded_at', { ascending: false }),
    fetchAtlasOperationsBriefing(companyId, now),
    fetchOperationalTasks(companyId, now),
    fetchAssetReadinessSnapshot(companyId, now),
    import('./driverComplianceForecast').then(({ fetchDriverComplianceForecast }) => fetchDriverComplianceForecast(companyId, now)),
  ]);
  if (evidenceError) throw new Error(evidenceError.message || 'Unable to load POD review signals for Atlas.');
  return {
    morningBriefing,
    tasks,
    assets,
    driverCompliance,
    pendingEvidence: (evidence ?? []).map((row) => ({ id: row.id, jobId: row.job_id, assignmentId: row.job_assignment_id, evidenceType: row.evidence_type, outcome: row.outcome, uploadedAt: row.uploaded_at })),
  };
}

export function classifyAtlasQuestion(question: string): AtlasRouteClassification {
  const resolution = resolveAtlasQuestion(question);
  const normalizedQuestion = resolution.normalizedQuestion;
  const intent = resolution.legacyIntent;
  if (isDeepPlanning(normalizedQuestion)) return { ...resolution, intent, canonicalIntent: resolution.canonicalIntents[0], tier: 3, mode: 'reasoning_required', normalizedQuestion };
  if (isReasoningCandidate(normalizedQuestion)) return { ...resolution, intent, canonicalIntent: resolution.canonicalIntents[0], tier: 2, mode: 'reasoning_required', normalizedQuestion };
  if (isSynthesisCandidate(normalizedQuestion)) return { ...resolution, intent, canonicalIntent: resolution.canonicalIntents[0], tier: 1, mode: 'synthesis_required', normalizedQuestion };
  if (intent !== 'unknown' && resolution.confidenceBand !== 'low') return { ...resolution, intent, canonicalIntent: resolution.canonicalIntents[0], tier: 0, mode: 'deterministic', normalizedQuestion };
  return { ...resolution, intent: 'unknown', canonicalIntent: 'unknown', tier: 1, mode: 'synthesis_required', normalizedQuestion };
}

export function answerAtlasQuestion(question: string, snapshot: AtlasQuerySnapshot): AtlasAnswer {
  const resolution = resolveAtlasQuestion(question, snapshot);
  const classification = { ...classifyAtlasQuestion(question), ...resolution, canonicalIntent: resolution.canonicalIntents[0] };
  const facts = factsForIntent(classification.intent, classification.normalizedQuestion, snapshot);
  const sources = sourcesForFacts(facts);
  const navigationTargets = [...new Set(facts.map((fact) => fact.navigationTarget))];
  const inferenceDecision = evaluateAtlasInferenceAdmission({ tier: atlasLogicalTierForComplexity(classification.tier) });
  if (classification.tier === 0) {
    return { mode: 'deterministic', intent: classification.intent, canonicalIntent: classification.canonicalIntent, answer: resolution.faqAnswer ?? (resolution.clarification ?? deterministicAnswer(classification.intent, facts, snapshot)), facts, sources, navigationTargets: resolution.navigationTarget ? [...new Set([...navigationTargets, resolution.navigationTarget])] : navigationTargets, inferenceDecision };
  }
  const packet = classification.tier === 2 || classification.tier === 3 ? buildAtlasReasoningPacket(question, classification.tier, snapshot) : undefined;
  return {
    mode: classification.mode,
    intent: classification.intent,
    canonicalIntent: classification.canonicalIntent,
    answer: classification.tier === 1 ? 'Advanced synthesis is not configured yet. I can show the structured Portal facts and source links available for this question.' : 'Advanced planning is not configured yet. No model was called and no operational action was proposed.',
    facts,
    sources,
    navigationTargets,
    inferenceDecision,
    reasoningPacket: packet,
  };
}

export function buildAtlasReasoningPacket(question: string, tier: 2 | 3, snapshot: AtlasQuerySnapshot): AtlasReasoningPacket {
  const driverIds = new Set(snapshot.driverCompliance.map((item) => item.driverId));
  const assignedWorkCounts = new Map<string, number>();
  for (const task of snapshot.tasks) if (task.category === 'jobs') for (const driverId of driverIds) assignedWorkCounts.set(driverId, (assignedWorkCounts.get(driverId) ?? 0) + Number(task.sourceType === 'job_assignment'));
  return {
    tier,
    intent: classifyIntent(normalizeQuestion(question)),
    objective: tier === 3 ? 'Produce a bounded operational planning candidate for manager review.' : 'Compare deterministic candidates against the stated operational question.',
    constraints: ['Use only the supplied company-scoped Portal facts.', 'Do not infer live location, ETA, legality, or unavailable driver capacity.', 'Any accepted action must pass deterministic validation and existing governed RPCs.', 'This bounded packet contains pseudonymous references and status codes only; it is not sent to an external provider in Batch 18.'],
    drivers: [...driverIds].map((driverId) => ({
      driverRef: pseudonymousRef('driver', driverId),
      availability: 'not_asserted' as const,
      complianceSignals: snapshot.driverCompliance.filter((item) => item.driverId === driverId && (driverForecastNeedsAction(item) || item.planningRisk !== 'none')).map((item) => `${item.evidenceType}:${item.status}`),
      assignedWorkCount: assignedWorkCounts.get(driverId) ?? 0,
    })),
    assets: snapshot.assets.map((asset) => ({ assetRef: pseudonymousRef(asset.kind, asset.id), kind: asset.kind, readinessStatus: asset.status, reasons: asset.reasons.map((reason) => reason.code) })),
    jobs: snapshot.tasks.filter((task) => task.sourceType === 'job_assignment').map((task) => ({ assignmentRef: pseudonymousRef('assignment', task.sourceId), status: task.id, issue: task.title })),
  };
}

function factsForIntent(intent: AtlasIntent, question: string, snapshot: AtlasQuerySnapshot): AtlasFact[] {
  if (intent === 'morning_briefing') return morningFacts(snapshot.morningBriefing);
  if (intent === 'yesterday_carry_over' || intent === 'today' || intent === 'tomorrow' || intent === 'next30') return morningFacts(snapshot.morningBriefing, intent === 'yesterday_carry_over' ? 'yesterday' : intent);
  if (intent === 'asset_readiness_reason') {
    const matches = findAssets(question, snapshot.assets);
    return matches.flatMap((asset) => [fact(`${asset.id}:status`, asset.label, asset.status, 'asset_readiness', asset.id, 'Asset readiness', '/dashboard?workspace=fleet&fleet=vehicles'), ...asset.reasons.map((reason) => fact(`${asset.id}:${reason.code}`, `${asset.label}: ${reason.code}`, reason.label, 'asset_readiness', asset.id, 'Asset readiness', '/dashboard?workspace=fleet&fleet=vehicles'))]);
  }
  if (intent === 'vor_assets') return snapshot.assets.filter((asset) => asset.isVor).map((asset) => fact(asset.id, asset.label, 'VOR', 'asset_readiness', asset.id, 'Asset readiness', '/dashboard?workspace=fleet&fleet=vehicles'));
  if (intent === 'unresolved_defects') return snapshot.assets.flatMap((asset) => asset.reasons.filter((reason) => reason.code === 'unresolved_safety_defect').map((reason) => fact(`${asset.id}:${reason.code}`, asset.label, reason.label, 'asset_readiness', asset.id, 'Vehicle checks', '/dashboard?workspace=fleet&fleet=vehicle_checks')));
  if (intent === 'jobs_awaiting_acknowledgement') return snapshot.tasks.filter((task) => /acknowledge/i.test(task.title) || task.id.includes(':ack')).map(taskFact);
  if (intent === 'delayed_or_exception_jobs' || intent === 'incomplete_jobs') return snapshot.tasks.filter((task) => task.category === 'jobs' && (intent === 'delayed_or_exception_jobs' ? /delayed|exception|unable|issue/i.test(`${task.title} ${task.detail}`) : /incomplete|unable|delayed|exception/i.test(`${task.title} ${task.detail}`))).map(taskFact);
  if (intent === 'operational_task_queue') return snapshot.tasks.map(taskFact);
  if (intent === 'pod_evidence_review') return snapshot.pendingEvidence.map((item) => fact(item.id, `${item.evidenceType} / ${item.outcome}`, `Pending manager review or follow-up; uploaded ${item.uploadedAt}`, 'job_evidence', item.id, 'POD review', '/dashboard?workspace=people&people=jobs&panel=pod-review'));
  if (intent === 'driver_compliance') return snapshot.driverCompliance.filter((item) => driverForecastNeedsAction(item) || (item.status === 'expiring' && item.daysRemaining !== null && item.daysRemaining <= 30)).map((item) => fact(item.id, `${item.driverLabel}: ${item.label}`, complianceValue(item.status, item.dueDate, item.planningRisk), 'driver_compliance', item.driverId, 'Driver compliance', '/dashboard?workspace=people&people=drivers'));
  if (intent === 'asset_compliance' || intent === 'upcoming_expiry' || intent === 'missing_evidence') return snapshot.assets.flatMap((asset) => buildComplianceForecast(asset).filter((item) => intent === 'missing_evidence' ? item.missingEvidence || item.status === 'unknown' : intent === 'upcoming_expiry' ? item.dueDate !== null && item.daysRemaining !== null && item.daysRemaining >= 0 && item.daysRemaining <= 30 : forecastNeedsAction(item) || (item.status === 'expiring' && item.daysRemaining !== null && item.daysRemaining <= 30)).map((item) => fact(item.id, `${item.assetLabel}: ${item.label}`, complianceValue(item.status, item.dueDate, item.planningRisk), 'asset_compliance', item.assetId, 'Asset compliance', '/dashboard?workspace=fleet&fleet=vehicles')));
  return [];
}

function morningFacts(briefing: AtlasMorningBriefing, section?: AtlasMorningSectionKey): AtlasFact[] {
  const items = section ? briefing.sections[section] : Object.values(briefing.sections).flat();
  return items.map((item) => fact(item.id, item.title, `${item.isNew ? 'New' : 'Known'}: ${item.detail}`, 'atlas_signal', item.signalKey, item.sourceLabel, item.href));
}

function findAssets(question: string, assets: readonly AssetReadinessResult[]): AssetReadinessResult[] {
  const tokens = question.split(/\s+/).filter((token) => token.length >= 3 && !['why', 'what', 'which', 'vehicle', 'trailer', 'blocked', 'readiness'].includes(token));
  const matches = assets.filter((asset) => tokens.some((token) => asset.label.toLowerCase().includes(token)));
  return matches.length > 0 ? matches : assets.filter((asset) => asset.status === 'prohibited' || asset.status === 'action_required');
}

function classifyIntent(question: string): AtlasIntent {
  if (/morning brief|morning briefing|what needs attention|brief me/.test(question)) return 'morning_briefing';
  if (/yesterday|carry.?over|outstanding from/.test(question)) return 'yesterday_carry_over';
  if (/tomorrow/.test(question)) return 'tomorrow';
  if (/next (30|thirty) days|next month|expire/.test(question)) return 'next30';
  if (/today|happening today|work today/.test(question)) return 'today';
  if (/why .*blocked|readiness|why .*vor|asset reason/.test(question)) return 'asset_readiness_reason';
  if (/vor|off road|off-road/.test(question)) return 'vor_assets';
  if (/unresolved defect|safety defect|open defect/.test(question)) return 'unresolved_defects';
  if (/unacknowledged|awaiting acknowledgement|awaiting acknowledgment|not acknowledged/.test(question)) return 'jobs_awaiting_acknowledgement';
  if (/delayed|exception job|vehicle issue|site issue|route issue/.test(question)) return 'delayed_or_exception_jobs';
  if (/driver.*(licen|licence|license|cpc|medical|compliance)|licen.*driver|cpc.*driver/.test(question)) return 'driver_compliance';
  if (/(trailer|vehicle|asset).*(compliance|expiry|expire)|compliance.*(trailer|vehicle|asset)/.test(question)) return 'asset_compliance';
  if (/missing evidence|what evidence is missing|missing document/.test(question)) return 'missing_evidence';
  if (/task queue|operational tasks|open tasks/.test(question)) return 'operational_task_queue';
  if (/pod|proof|evidence.*review|review.*evidence/.test(question)) return 'pod_evidence_review';
  if (/incomplete|unable to complete/.test(question)) return 'incomplete_jobs';
  return 'unknown';
}

function isSynthesisCandidate(question: string): boolean { return /summari[sz]e|morning meeting|explain these|briefly explain/.test(question); }
function isReasoningCandidate(question: string): boolean { return /compare|most suitable|best (driver|vehicle|combination)|which .* combination/.test(question); }
function isDeepPlanning(question: string): boolean { return /reorgani[sz]e|cover the day|cover .* sick|driver .* sick|plan the day|reorganise/.test(question); }

function deterministicAnswer(intent: AtlasIntent, facts: readonly AtlasFact[], snapshot: AtlasQuerySnapshot): string {
  if (intent === 'morning_briefing') return `The deterministic briefing has ${snapshot.morningBriefing.sections.yesterday.length} unresolved item(s) from yesterday, ${snapshot.morningBriefing.sections.today.length} today item(s), ${snapshot.morningBriefing.sections.tomorrow.length} tomorrow conflict(s), and ${snapshot.morningBriefing.sections.next30.length} next-30-day warning(s).`;
  if (facts.length === 0) return 'No matching Portal records were returned for this question.';
  return `${facts.length} Portal fact(s) matched this question. Review the linked source records before taking action.`;
}

function taskFact(task: OperationalTask): AtlasFact { return fact(task.id, task.title, task.detail, task.sourceType, task.sourceId, 'Operational task queue', task.navigationTarget); }
function fact(id: string, label: string, value: string, sourceType: string, sourceId: string, sourceLabel: string, navigationTarget: string): AtlasFact { return { id, label, value, sourceType, sourceId, sourceLabel, navigationTarget }; }
function sourcesForFacts(facts: readonly AtlasFact[]): AtlasSource[] { return [...new Map(facts.map((item) => [`${item.sourceType}:${item.sourceId}`, { id: item.sourceId, type: item.sourceType, label: item.sourceLabel, navigationTarget: item.navigationTarget }])).values()]; }
function complianceValue(status: string, dueDate: string | null, planningRisk: string): string { return `${status}${dueDate ? `; due ${dueDate}` : ''}${planningRisk !== 'none' ? '; future planning risk flagged' : ''}`; }
function normalizeQuestion(question: string): string { return normalizeAtlasQuestion(question); }
function pseudonymousRef(prefix: string, id: string): string { return `${prefix}-${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`; }
