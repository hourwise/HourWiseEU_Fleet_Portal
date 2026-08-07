import { supabase } from './supabase';

export interface DriverOperationalEvent {
  id: string;
  companyId: string;
  eventType: string;
  priority: 'info' | 'advisory' | 'warning' | 'critical' | 'emergency';
  title: string;
  body: string | null;
  requiresAck: boolean;
  createdAt: string;
  acknowledgedAt: string | null;
}

type QueryError = { message: string };
type QueryResult<T> = { data: T | null; error: QueryError | null };

interface Query<T> extends PromiseLike<QueryResult<T>> {
  eq(column: string, value: string): Query<T>;
  order(column: string, options?: { ascending?: boolean }): Query<T>;
}

interface EventReadClient {
  from(table: 'driver_visible_fleet_events'): { select<T = unknown>(columns: string): Query<T> };
}

interface AckClient {
  from(table: 'driver_acknowledgements'): {
    select<T = unknown>(columns: string): Query<T>;
    upsert(values: unknown, options: { onConflict: string }): PromiseLike<QueryResult<unknown>>;
  };
}

export async function fetchDriverOperationalEvents(driverId: string): Promise<DriverOperationalEvent[]> {
  const eventClient = supabase as unknown as EventReadClient;
  const ackClient = supabase as unknown as AckClient;
  const [{ data: events, error: eventsError }, { data: acknowledgements, error: acknowledgementsError }] = await Promise.all([
    eventClient
      .from('driver_visible_fleet_events')
      .select<unknown>('id, company_id, event_type, priority, title, body, requires_ack, created_at')
      .order('created_at', { ascending: false }),
    ackClient
      .from('driver_acknowledgements')
      .select<unknown>('event_id, acknowledged_at')
      .eq('driver_id', driverId)
      .order('acknowledged_at', { ascending: false }),
  ]);

  if (eventsError) throw new Error(eventsError.message || 'Unable to load operational events.');
  if (acknowledgementsError) throw new Error(acknowledgementsError.message || 'Unable to load event acknowledgements.');

  const acknowledgementsByEventId = normaliseAcknowledgements(acknowledgements);
  return normaliseDriverOperationalEvents(events, acknowledgementsByEventId);
}

export async function acknowledgeDriverOperationalEvent(event: DriverOperationalEvent, driverId: string, note?: string | null) {
  const ackClient = supabase as unknown as AckClient;
  const { error } = await ackClient.from('driver_acknowledgements').upsert(
    {
      company_id: event.companyId,
      event_id: event.id,
      driver_id: driverId,
      acknowledged_at: new Date().toISOString(),
      note: note?.trim() || null,
    },
    { onConflict: 'event_id,driver_id' }
  );

  if (error) throw new Error(error.message || 'Unable to acknowledge operational event.');
}

export function normaliseDriverOperationalEvents(rows: unknown, acknowledgementsByEventId: Record<string, string> = {}) {
  if (!Array.isArray(rows)) return [] as DriverOperationalEvent[];

  return rows
    .map((row): DriverOperationalEvent | null => {
      if (!isRecord(row)) return null;
      const id = asString(row.id);
      const companyId = asString(row.company_id);
      const eventType = asString(row.event_type);
      const title = asString(row.title);
      const createdAt = asString(row.created_at);
      const priority = normalisePriority(row.priority);
      if (!id || !companyId || !eventType || !title || !createdAt || !priority) return null;
      return {
        id,
        companyId,
        eventType,
        priority,
        title,
        body: asNullableString(row.body),
        requiresAck: row.requires_ack === true,
        createdAt,
        acknowledgedAt: acknowledgementsByEventId[id] ?? null,
      } satisfies DriverOperationalEvent;
    })
    .filter((event): event is DriverOperationalEvent => Boolean(event));
}

export function normaliseAcknowledgements(rows: unknown) {
  if (!Array.isArray(rows)) return {} as Record<string, string>;
  return rows.reduce<Record<string, string>>((result, row) => {
    if (!isRecord(row)) return result;
    const eventId = asString(row.event_id);
    const acknowledgedAt = asString(row.acknowledged_at);
    if (eventId && acknowledgedAt) result[eventId] = acknowledgedAt;
    return result;
  }, {});
}

function normalisePriority(value: unknown): DriverOperationalEvent['priority'] | null {
  return value === 'info' || value === 'advisory' || value === 'warning' || value === 'critical' || value === 'emergency'
    ? value
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}
