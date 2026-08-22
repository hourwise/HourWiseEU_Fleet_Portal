import { supabase } from './supabase';

export type OperationalTimelineCategory = 'job' | 'assignment' | 'proposal' | 'task' | 'pod' | 'compliance' | 'security';
export type OperationalTimelineSeverity = 'critical' | 'high' | 'warning' | 'advisory' | 'info';

export type OperationalTimelineActor = {
  id: string;
  label: string;
  role: string | null;
};

export type OperationalTimelineEntity = {
  type: string;
  id: string | null;
  label: string;
};

export type OperationalTimelineNavigationKey = 'messages' | 'jobs' | 'atlas' | 'drivers' | 'vehicles' | 'security';

export type OperationalTimelineRelationships = {
  jobAssignmentId: string | null;
  proposalId: string | null;
  eventId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  trailerId: string | null;
};

export type TimelineSourceDefinition = {
  sourceType: string;
  categories: readonly OperationalTimelineCategory[];
  labelBuilder: (input: { entityType: string; entityLabel: string; summary: string }) => string;
  navigationBuilder: (input: { category: OperationalTimelineCategory; entityType: string }) => string | null;
  privacyRules: readonly string[];
  supportedRelationships: readonly (keyof OperationalTimelineRelationships)[];
};

type TimelineSourceLinkRule = {
  sourceSystem: string;
  category: OperationalTimelineCategory;
  entityType?: string;
  target: OperationalTimelineNavigationKey;
};

const TIMELINE_NAVIGATION_TARGETS: Record<OperationalTimelineNavigationKey, string> = {
  messages: '/dashboard?workspace=people&people=messages',
  jobs: '/dashboard?workspace=people&people=jobs',
  atlas: '/dashboard?workspace=people&people=atlas',
  drivers: '/dashboard?workspace=people&people=drivers',
  vehicles: '/dashboard?workspace=fleet&fleet=vehicles',
  security: '/dashboard?workspace=settings&settings=security',
};

export const TIMELINE_SOURCE_LINK_REGISTRY: readonly TimelineSourceLinkRule[] = [
  { sourceSystem: 'fleet_events', category: 'job', target: 'messages' },
  { sourceSystem: 'fleet_events', category: 'assignment', target: 'messages' },
  { sourceSystem: 'fleet_events', category: 'security', target: 'security' },
  { sourceSystem: 'atlas_proposals', category: 'proposal', target: 'atlas' },
  { sourceSystem: 'security_permission_audit_events', category: 'proposal', target: 'atlas' },
  { sourceSystem: 'security_permission_audit_events', category: 'security', target: 'security' },
  { sourceSystem: 'operational_task_handlings', category: 'task', entityType: 'driver_compliance', target: 'drivers' },
  { sourceSystem: 'operational_task_handlings', category: 'task', entityType: 'job_assignment', target: 'jobs' },
  { sourceSystem: 'operational_task_handlings', category: 'task', target: 'vehicles' },
  { sourceSystem: 'job_evidence', category: 'pod', target: 'jobs' },
  { sourceSystem: 'driver_documents', category: 'compliance', target: 'drivers' },
];

const allRelationships: readonly (keyof OperationalTimelineRelationships)[] = ['jobAssignmentId', 'proposalId', 'eventId', 'driverId', 'vehicleId', 'trailerId'];
const noPrivateFields: readonly string[] = ['storage_bucket', 'storage_path', 'metadata', 'review_notes', 'raw_notes', 'email', 'phone', 'date_of_birth', 'licence_number'];
const registeredNavigation = (input: { category: OperationalTimelineCategory; entityType: string }, sourceType: string) => resolveOperationalTimelineLink({ sourceSystem: sourceType, ...input });

/** Every database projection source has one privacy and navigation contract. */
export const TIMELINE_SOURCE_DEFINITIONS: readonly TimelineSourceDefinition[] = [
  'fleet_events', 'atlas_proposals', 'security_permission_audit_events', 'operational_task_handlings', 'job_evidence', 'driver_documents',
].map((sourceType) => ({
  sourceType,
  categories: [...new Set(TIMELINE_SOURCE_LINK_REGISTRY.filter((rule) => rule.sourceSystem === sourceType).map((rule) => rule.category))],
  labelBuilder: ({ entityLabel, summary }) => entityLabel || summary,
  navigationBuilder: (input) => registeredNavigation(input, sourceType),
  privacyRules: noPrivateFields,
  supportedRelationships: allRelationships,
}));

export function getTimelineSourceDefinition(sourceType: string): TimelineSourceDefinition | null {
  return TIMELINE_SOURCE_DEFINITIONS.find((definition) => definition.sourceType === sourceType) ?? null;
}

export function resolveOperationalTimelineLink(input: { sourceSystem: string; category: OperationalTimelineCategory; entityType?: string }): string | null {
  const rule = TIMELINE_SOURCE_LINK_REGISTRY.find((candidate) => candidate.sourceSystem === input.sourceSystem && candidate.category === input.category && candidate.entityType === input.entityType)
    ?? TIMELINE_SOURCE_LINK_REGISTRY.find((candidate) => candidate.sourceSystem === input.sourceSystem && candidate.category === input.category && !candidate.entityType);
  return rule ? TIMELINE_NAVIGATION_TARGETS[rule.target] : null;
}

export type OperationalTimelineItem = {
  id: string;
  occurredAt: string;
  category: OperationalTimelineCategory;
  eventType: string;
  severity: OperationalTimelineSeverity;
  actor: OperationalTimelineActor | null;
  entity: OperationalTimelineEntity;
  summary: string;
  sourceSystem: string;
  sourceId: string;
  relatedEventId: string | null;
  relatedProposalId: string | null;
  relationships: OperationalTimelineRelationships;
  navigationTarget: string | null;
};

export type OperationalTimelineFilters = {
  from?: string;
  to?: string;
  category?: OperationalTimelineCategory;
  eventType?: string;
  driverId?: string;
  vehicleId?: string;
  trailerId?: string;
  jobAssignmentId?: string;
  proposalId?: string;
  taskId?: string;
  unresolvedOnly?: boolean;
};

export type OperationalTimelineCursor = {
  occurredAt: string;
  sourceId: string;
};

export type OperationalTimelinePage = {
  items: OperationalTimelineItem[];
  nextCursor: OperationalTimelineCursor | null;
  hasMore: boolean;
};

type TimelineRpc = (functionName: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function fetchOperationalTimeline(
  filters: OperationalTimelineFilters = {},
  cursor: OperationalTimelineCursor | null = null,
  limit = 50,
): Promise<OperationalTimelinePage> {
  const rpc = supabase.rpc as unknown as TimelineRpc;
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const { data, error } = await rpc('list_manager_operational_timeline', {
    p_from: filters.from ?? null,
    p_to: filters.to ?? null,
    p_category: filters.category ?? null,
    p_event_type: filters.eventType?.trim() || null,
    p_driver_id: filters.driverId || null,
    p_vehicle_id: filters.vehicleId || null,
    p_trailer_id: filters.trailerId || null,
    p_job_assignment_id: filters.jobAssignmentId || null,
    p_proposal_id: filters.proposalId || null,
    p_task_id: filters.taskId || null,
    p_cursor_at: cursor?.occurredAt ?? null,
    p_cursor_id: cursor?.sourceId ?? null,
    p_unresolved_only: filters.unresolvedOnly ?? false,
    p_limit: boundedLimit,
  });
  if (error) throw new Error(error.message || 'Unable to load the operational timeline.');

  const items = Array.isArray(data) ? data.map(parseTimelineItem).filter((item): item is OperationalTimelineItem => item !== null) : [];
  const hasMore = items.length === boundedLimit;
  const last = items[items.length - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? { occurredAt: last.occurredAt, sourceId: last.sourceId } : null,
  };
}

export function parseTimelineItem(value: unknown): OperationalTimelineItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.occurredAt !== 'string' || typeof value.category !== 'string' || typeof value.eventType !== 'string' || typeof value.severity !== 'string' || typeof value.summary !== 'string' || typeof value.sourceSystem !== 'string' || typeof value.sourceId !== 'string') return null;
  const actor = isRecord(value.actor) && typeof value.actor.id === 'string' && typeof value.actor.label === 'string'
    ? { id: value.actor.id, label: value.actor.label, role: typeof value.actor.role === 'string' ? value.actor.role : null }
    : null;
  const entity = isRecord(value.entity) && typeof value.entity.type === 'string' && typeof value.entity.label === 'string'
    ? { type: value.entity.type, id: typeof value.entity.id === 'string' ? value.entity.id : null, label: value.entity.label }
    : { type: 'unknown', id: null, label: 'Unknown entity' };
  if (!isTimelineCategory(value.category) || !isTimelineSeverity(value.severity)) return null;
  const relationships = parseRelationships(value.relationships, value);
  return {
    id: value.id,
    occurredAt: value.occurredAt,
    category: value.category,
    eventType: value.eventType,
    severity: value.severity,
    actor,
    entity,
    summary: value.summary,
    sourceSystem: value.sourceSystem,
    sourceId: value.sourceId,
    relatedEventId: typeof value.relatedEventId === 'string' ? value.relatedEventId : null,
    relatedProposalId: typeof value.relatedProposalId === 'string' ? value.relatedProposalId : null,
    relationships,
    navigationTarget: resolveOperationalTimelineLink({ sourceSystem: value.sourceSystem, category: value.category, entityType: entity.type }),
  };
}

function parseRelationships(value: unknown, fallback: Record<string, unknown>): OperationalTimelineRelationships {
  const source = isRecord(value) ? value : fallback;
  return {
    jobAssignmentId: asUuid(source.jobAssignmentId ?? fallback.jobAssignmentId),
    proposalId: asUuid(source.proposalId ?? fallback.relatedProposalId),
    eventId: asUuid(source.eventId ?? fallback.relatedEventId),
    driverId: asUuid(source.driverId),
    vehicleId: asUuid(source.vehicleId),
    trailerId: asUuid(source.trailerId),
  };
}

function asUuid(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTimelineCategory(value: string): value is OperationalTimelineCategory {
  return ['job', 'assignment', 'proposal', 'task', 'pod', 'compliance', 'security'].includes(value);
}

function isTimelineSeverity(value: string): value is OperationalTimelineSeverity {
  return ['critical', 'high', 'warning', 'advisory', 'info'].includes(value);
}
