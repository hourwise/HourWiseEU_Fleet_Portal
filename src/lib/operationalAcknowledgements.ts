import { supabase } from './supabase';

export const MANAGER_SHIFT_EVENT_TYPES = [
  'rota_shift_published',
  'rota_shift_updated',
  'rota_shift_cancelled',
] as const;

export const MANAGER_JOB_EVENT_TYPES = [
  'job_assigned',
  'job_updated',
  'job_cancelled',
] as const;

const SHIFT_EVENT_TYPES = new Set<string>(MANAGER_SHIFT_EVENT_TYPES);
const JOB_EVENT_TYPES = new Set<string>(MANAGER_JOB_EVENT_TYPES);

export type ManagerAcknowledgementStatus = 'awaiting' | 'acknowledged' | 'not_required';

export interface ManagerAcknowledgementSummary {
  eventId: string;
  eventType: string;
  recipientDriverId: string;
  requiresAck: boolean;
  status: ManagerAcknowledgementStatus;
  acknowledgedAt: string | null;
}

export interface ManagerOperationalEvent {
  id: string;
  companyId: string;
  eventType: string;
  relatedShiftId: string;
  recipientDriverId: string;
  payload: Record<string, unknown>;
  requiresAck: boolean;
  createdAt: string;
}

export interface ManagerDriverAcknowledgement {
  companyId: string;
  eventId: string;
  driverId: string;
  acknowledgedAt: string;
}

export interface ManagerAcknowledgementReadModel {
  byShiftId: Record<string, ManagerAcknowledgementSummary>;
  byAssignmentId: Record<string, ManagerAcknowledgementSummary>;
}

export function emptyManagerAcknowledgementReadModel(): ManagerAcknowledgementReadModel {
  return { byShiftId: {}, byAssignmentId: {} };
}

/**
 * Load the company-scoped event and acknowledgement rows in two batch queries.
 * The acknowledgement select intentionally excludes the private note column.
 */
export async function fetchManagerOperationalAcknowledgements(
  companyId: string,
  shiftIds: readonly string[]
): Promise<ManagerAcknowledgementReadModel> {
  const uniqueShiftIds = [...new Set(shiftIds.filter(Boolean))];
  if (!companyId || uniqueShiftIds.length === 0) return emptyManagerAcknowledgementReadModel();

  const { data: eventRows, error: eventError } = await supabase
    .from('fleet_events')
    .select('id, company_id, event_type, related_shift_id, recipient_driver_id, payload, requires_ack, created_at')
    .eq('company_id', companyId)
    .in('related_shift_id', uniqueShiftIds)
    .in('event_type', [...MANAGER_SHIFT_EVENT_TYPES, ...MANAGER_JOB_EVENT_TYPES])
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

  if (eventError) throw new Error(eventError.message || 'Unable to load driver acknowledgement events.');

  const events = normaliseManagerOperationalEvents(eventRows, companyId);
  if (events.length === 0) return emptyManagerAcknowledgementReadModel();

  const { data: acknowledgementRows, error: acknowledgementError } = await supabase
    .from('driver_acknowledgements')
    .select('event_id, driver_id, acknowledged_at, company_id')
    .eq('company_id', companyId)
    .in('event_id', events.map(event => event.id))
    .order('acknowledged_at', { ascending: false })
    .order('event_id', { ascending: false });

  if (acknowledgementError) throw new Error(acknowledgementError.message || 'Unable to load driver acknowledgements.');

  return buildManagerAcknowledgementReadModel(
    events,
    normaliseManagerDriverAcknowledgements(acknowledgementRows, companyId)
  );
}

export function normaliseManagerOperationalEvents(rows: unknown, companyId: string): ManagerOperationalEvent[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row): ManagerOperationalEvent | null => {
      if (!isRecord(row)) return null;
      const id = asString(row.id);
      const rowCompanyId = asString(row.company_id);
      const eventType = asString(row.event_type);
      const relatedShiftId = asString(row.related_shift_id);
      const recipientDriverId = asString(row.recipient_driver_id);
      const createdAt = asString(row.created_at);
      const payload = isRecord(row.payload) ? row.payload : null;
      if (
        !id ||
        rowCompanyId !== companyId ||
        !eventType ||
        !relatedShiftId ||
        !recipientDriverId ||
        !createdAt ||
        Number.isNaN(Date.parse(createdAt)) ||
        !payload ||
        (!SHIFT_EVENT_TYPES.has(eventType) && !JOB_EVENT_TYPES.has(eventType))
      ) return null;

      return {
        id,
        companyId: rowCompanyId,
        eventType,
        relatedShiftId,
        recipientDriverId,
        payload,
        requiresAck: row.requires_ack === true,
        createdAt,
      };
    })
    .filter((event): event is ManagerOperationalEvent => Boolean(event));
}

export function normaliseManagerDriverAcknowledgements(rows: unknown, companyId: string): ManagerDriverAcknowledgement[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row): ManagerDriverAcknowledgement | null => {
      if (!isRecord(row)) return null;
      const rowCompanyId = asString(row.company_id);
      const eventId = asString(row.event_id);
      const driverId = asString(row.driver_id);
      const acknowledgedAt = asString(row.acknowledged_at);
      if (
        rowCompanyId !== companyId ||
        !eventId ||
        !driverId ||
        !acknowledgedAt ||
        Number.isNaN(Date.parse(acknowledgedAt))
      ) return null;
      return { companyId: rowCompanyId, eventId, driverId, acknowledgedAt };
    })
    .filter((acknowledgement): acknowledgement is ManagerDriverAcknowledgement => Boolean(acknowledgement));
}

/**
 * Selects the latest relevant event per shift and job assignment. The event
 * id breaks timestamp ties so out-of-order database responses remain stable.
 */
export function buildManagerAcknowledgementReadModel(
  events: readonly ManagerOperationalEvent[],
  acknowledgements: readonly ManagerDriverAcknowledgement[]
): ManagerAcknowledgementReadModel {
  const latestShiftEvents = latestEventsByKey(
    events.filter(event => SHIFT_EVENT_TYPES.has(event.eventType)),
    event => event.relatedShiftId
  );
  const latestAssignmentEvents = latestEventsByKey(
    events.filter(event => JOB_EVENT_TYPES.has(event.eventType)),
    event => asString(event.payload.job_assignment_id)
  );
  const acknowledgementsByEventAndDriver = new Map<string, string>();

  for (const acknowledgement of acknowledgements) {
    const key = `${acknowledgement.eventId}:${acknowledgement.driverId}`;
    const previous = acknowledgementsByEventAndDriver.get(key);
    if (!previous || compareTimestamps(acknowledgement.acknowledgedAt, previous) > 0) {
      acknowledgementsByEventAndDriver.set(key, acknowledgement.acknowledgedAt);
    }
  }

  const toSummary = (event: ManagerOperationalEvent): ManagerAcknowledgementSummary => {
    const acknowledgedAt = acknowledgementsByEventAndDriver.get(`${event.id}:${event.recipientDriverId}`) ?? null;
    return {
      eventId: event.id,
      eventType: event.eventType,
      recipientDriverId: event.recipientDriverId,
      requiresAck: event.requiresAck,
      status: !event.requiresAck ? 'not_required' : acknowledgedAt ? 'acknowledged' : 'awaiting',
      acknowledgedAt,
    };
  };

  const model = emptyManagerAcknowledgementReadModel();
  for (const [key, event] of latestShiftEvents) model.byShiftId[key] = toSummary(event);
  for (const [key, event] of latestAssignmentEvents) model.byAssignmentId[key] = toSummary(event);
  return model;
}

function latestEventsByKey(
  events: readonly ManagerOperationalEvent[],
  keyFor: (event: ManagerOperationalEvent) => string | null
): Map<string, ManagerOperationalEvent> {
  const latest = new Map<string, ManagerOperationalEvent>();
  for (const event of events) {
    const key = keyFor(event);
    if (!key) continue;
    const previous = latest.get(key);
    if (!previous || compareEvents(event, previous) > 0) latest.set(key, event);
  }
  return latest;
}

function compareEvents(left: ManagerOperationalEvent, right: ManagerOperationalEvent): number {
  const timestampComparison = compareTimestamps(left.createdAt, right.createdAt);
  return timestampComparison !== 0 ? timestampComparison : left.id.localeCompare(right.id);
}

function compareTimestamps(left: string, right: string): number {
  return Date.parse(left) - Date.parse(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
