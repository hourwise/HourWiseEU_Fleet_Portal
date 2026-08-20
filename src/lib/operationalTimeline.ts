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
  navigationTarget: string;
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

function parseTimelineItem(value: unknown): OperationalTimelineItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.occurredAt !== 'string' || typeof value.category !== 'string' || typeof value.eventType !== 'string' || typeof value.severity !== 'string' || typeof value.summary !== 'string' || typeof value.sourceSystem !== 'string' || typeof value.sourceId !== 'string' || typeof value.navigationTarget !== 'string') return null;
  const actor = isRecord(value.actor) && typeof value.actor.id === 'string' && typeof value.actor.label === 'string'
    ? { id: value.actor.id, label: value.actor.label, role: typeof value.actor.role === 'string' ? value.actor.role : null }
    : null;
  const entity = isRecord(value.entity) && typeof value.entity.type === 'string' && typeof value.entity.label === 'string'
    ? { type: value.entity.type, id: typeof value.entity.id === 'string' ? value.entity.id : null, label: value.entity.label }
    : { type: 'unknown', id: null, label: 'Unknown entity' };
  if (!isTimelineCategory(value.category) || !isTimelineSeverity(value.severity)) return null;
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
    navigationTarget: value.navigationTarget,
  };
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
