import { supabase } from './supabase';

export type OperationalTaskHandlingStatus = 'new' | 'acknowledged' | 'in_progress' | 'resolved';
export type OperationalTaskHandling = { id: string; sourceType: string; sourceId: string; status: OperationalTaskHandlingStatus; ownerId: string | null; action: string | null; note: string | null; updatedAt: string; resolvedAt: string | null };

export async function fetchOperationalTaskHandlings(companyId: string, sourceIds: string[]): Promise<OperationalTaskHandling[]> {
  if (sourceIds.length === 0) return [];
  const { data, error } = await supabase.from('operational_task_handlings').select('id, source_type, source_id, status, owner_id, action, note, updated_at, resolved_at').eq('company_id', companyId).in('source_id', sourceIds);
  if (error) throw new Error(error.message || 'Unable to load task handling state.');
  return (data ?? []).map((row) => ({ id: row.id, sourceType: row.source_type, sourceId: row.source_id, status: row.status as OperationalTaskHandlingStatus, ownerId: row.owner_id, action: row.action, note: row.note, updatedAt: row.updated_at, resolvedAt: row.resolved_at }));
}

export async function setOperationalTaskHandling(input: { sourceType: string; sourceId: string; status: OperationalTaskHandlingStatus; ownerId?: string | null; action?: string | null; note?: string | null; expectedUpdatedAt?: string | null }) {
  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  const { data, error } = await rpc('set_operational_task_handling', { p_source_type: input.sourceType, p_source_id: input.sourceId, p_status: input.status, p_owner_id: input.ownerId ?? null, p_action: input.action ?? null, p_note: input.note ?? null, p_expected_updated_at: input.expectedUpdatedAt ?? null });
  if (error) throw Object.assign(new Error(error.message || 'Unable to update task handling.'), { code: error.code });
  return data;
}
