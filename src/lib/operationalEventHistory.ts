import { supabase } from './supabase';
import type { Database, Json } from './database.types';

type FleetEvent = Database['public']['Tables']['fleet_events']['Row'];

export type OperationalEventAcknowledgementState = 'acknowledged' | 'pending' | 'not_required';
export type OperationalEventMessageState = 'read' | 'sent' | 'not_message';

export interface OperationalEventHistoryItem {
  id: string;
  eventType: string;
  title: string;
  body: string | null;
  priority: string;
  createdAt: string;
  recipientDriverName: string | null;
  actorName: string | null;
  context: string | null;
  requiresAck: boolean;
  acknowledgementState: OperationalEventAcknowledgementState;
  messageState: OperationalEventMessageState;
}

const getPayloadString = (payload: Json, key: string) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as Record<string, Json | undefined>)[key];
  return typeof value === 'string' ? value : null;
};

const eventContext = (event: Pick<FleetEvent, 'payload' | 'related_shift_id' | 'related_message_id'>) => {
  const jobId = getPayloadString(event.payload, 'job_assignment_id');
  if (event.related_shift_id) return `Shift ${event.related_shift_id.slice(0, 8)}`;
  if (jobId) return `Job assignment ${jobId.slice(0, 8)}`;
  if (event.related_message_id) return 'Related manager message';
  return null;
};

export async function fetchManagerOperationalEventHistory(companyId: string): Promise<OperationalEventHistoryItem[]> {
  const { data: events, error: eventsError } = await supabase
    .from('fleet_events')
    .select('id, company_id, event_type, title, body, priority, recipient_driver_id, actor_id, related_shift_id, related_message_id, thread_id, payload, requires_ack, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (eventsError) throw eventsError;
  const eventRows = events ?? [];
  if (eventRows.length === 0) return [];

  const eventIds = eventRows.map(event => event.id);
  const messageIds = eventRows.flatMap(event => event.related_message_id ? [event.related_message_id] : []);
  const personIds = [...new Set(eventRows.flatMap(event => [event.actor_id, event.recipient_driver_id].filter((id): id is string => Boolean(id))))];

  const [acknowledgementsResult, messagesResult, profilesResult] = await Promise.all([
    supabase
      .from('driver_acknowledgements')
      .select('event_id, acknowledged_at')
      .eq('company_id', companyId)
      .in('event_id', eventIds),
    messageIds.length > 0
      ? supabase.from('messages').select('id, fleet_event_id, read_at').eq('company_id', companyId).in('id', messageIds)
      : Promise.resolve({ data: [], error: null }),
    personIds.length > 0
      ? supabase.from('profiles').select('id, full_name').eq('company_id', companyId).in('id', personIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (acknowledgementsResult.error) throw acknowledgementsResult.error;
  if (messagesResult.error) throw messagesResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const acknowledgementsByEvent = new Map<string, string>();
  for (const acknowledgement of acknowledgementsResult.data ?? []) {
    const existing = acknowledgementsByEvent.get(acknowledgement.event_id);
    if (!existing || acknowledgement.acknowledged_at > existing) {
      acknowledgementsByEvent.set(acknowledgement.event_id, acknowledgement.acknowledged_at);
    }
  }
  const messagesById = new Map((messagesResult.data ?? []).map(message => [message.id, message]));
  const profilesById = new Map((profilesResult.data ?? []).map(person => [person.id, person.full_name]));

  return eventRows.map(event => {
    const acknowledgementState: OperationalEventAcknowledgementState = !event.requires_ack
      ? 'not_required'
      : acknowledgementsByEvent.has(event.id)
        ? 'acknowledged'
        : 'pending';
    const relatedMessage = event.related_message_id ? messagesById.get(event.related_message_id) : null;
    const messageState: OperationalEventMessageState = !relatedMessage
      ? 'not_message'
      : relatedMessage.read_at
        ? 'read'
        : 'sent';

    return {
      id: event.id,
      eventType: event.event_type,
      title: event.title,
      body: event.body,
      priority: event.priority,
      createdAt: event.created_at,
      recipientDriverName: event.recipient_driver_id ? profilesById.get(event.recipient_driver_id) ?? 'Driver' : 'All drivers',
      actorName: event.actor_id ? profilesById.get(event.actor_id) ?? 'Manager' : null,
      context: eventContext(event),
      requiresAck: event.requires_ack,
      acknowledgementState,
      messageState,
    };
  });
}
