import { supabase } from './supabase';
import {
  buildAtlasMorningBriefing,
  type AtlasMorningBriefing,
  type AtlasMorningObservation,
  type AtlasMorningSectionKey,
  type AtlasMorningSignal,
} from './atlasBriefing';
import { fetchAssetReadinessSnapshot } from './assetReadinessLoad';
import { buildComplianceForecast, forecastNeedsAction } from './complianceForecast';
import { driverForecastNeedsAction, fetchDriverComplianceForecast } from './driverComplianceForecast';
import { fetchPodReconciliationHealth } from './podReconciliationHealth';

export async function fetchAtlasOperationsBriefing(companyId: string, now = new Date()): Promise<AtlasMorningBriefing> {
  const today = formatDateOnly(now);
  const yesterday = formatDateOnly(addDays(now, -1));
  const tomorrow = formatDateOnly(addDays(now, 1));
  const [{ data: shifts, error: shiftError }, { data: events, error: eventError }, { data: acknowledgements, error: acknowledgementError }, { data: assignments, error: assignmentError }, { data: podEvidence, error: podEvidenceError }, assets, driverForecast, podHealth] = await Promise.all([
    supabase.from('shifts').select('id, status, date, driver_id, vehicle_id, updated_at').eq('company_id', companyId).in('date', [yesterday, today, tomorrow]),
    supabase.from('fleet_events').select('id, requires_ack, created_at, title, body, priority, related_shift_id, payload').eq('company_id', companyId).eq('requires_ack', true),
    supabase.from('driver_acknowledgements').select('event_id').eq('company_id', companyId),
    supabase.from('job_assignments').select('id, job_id, shift_id, status, driver_id, vehicle_id, trailer_id, planned_arrival_at, updated_at').eq('company_id', companyId),
    supabase.from('job_evidence').select('id, evidence_type, outcome, review_status, uploaded_at, updated_at').eq('company_id', companyId).in('review_status', ['pending', 'needs_follow_up']),
    fetchAssetReadinessSnapshot(companyId, now),
    fetchDriverComplianceForecast(companyId, now),
    fetchPodReconciliationHealth({ syncSignals: false }),
  ]);

  if (shiftError) throw new Error(shiftError.message || 'Unable to load rota dates for Atlas.');
  if (eventError) throw new Error(eventError.message || 'Unable to load operational events for Atlas.');
  if (acknowledgementError) throw new Error(acknowledgementError.message || 'Unable to load acknowledgement state for Atlas.');
  if (assignmentError) throw new Error(assignmentError.message || 'Unable to load job assignments for Atlas.');
  if (podEvidenceError) throw new Error(podEvidenceError.message || 'Unable to load POD review signals for Atlas.');

  const activeShifts = (shifts ?? []).filter((shift) => shift.status === 'published' || shift.status === 'updated');
  const activeAssignments = (assignments ?? []).filter((assignment) => assignment.status !== 'cancelled' && assignment.status !== 'draft');
  const shiftById = new Map(activeShifts.map((shift) => [shift.id, shift]));
  const acknowledgedEventIds = new Set((acknowledgements ?? []).map((row) => row.event_id));
  const assignmentById = new Map(activeAssignments.map((assignment) => [assignment.id, assignment]));
  const assetForecastAssignments = activeAssignments.map((assignment) => ({ id: assignment.id, vehicleId: assignment.vehicle_id ?? assignment.trailer_id ?? shiftById.get(assignment.shift_id)?.vehicle_id ?? null, plannedDate: shiftById.get(assignment.shift_id)?.date ?? null }));
  const signals: AtlasMorningSignal[] = [];

  for (const event of events ?? []) {
    if (acknowledgedEventIds.has(event.id)) continue;
    const linkedAssignmentId = typeof event.payload === 'object' && event.payload && 'job_assignment_id' in event.payload ? String(event.payload.job_assignment_id) : null;
    if (linkedAssignmentId && assignmentById.has(linkedAssignmentId)) continue;
    signals.push(signal(`lifecycle:event:${event.id}`, `unack:${event.id}`, eventSection(event.created_at, today, yesterday, tomorrow), event.priority === 'critical' ? 'critical' : event.priority === 'warning' ? 'warning' : 'advisory', event.title || 'Driver acknowledgement required', event.body || 'A published operational event still requires acknowledgement.', 'Messaging and events', '/dashboard?workspace=people&people=messages', event.created_at));
  }

  for (const shift of activeShifts) {
    const shiftAssignments = activeAssignments.filter((assignment) => assignment.shift_id === shift.id);
    if (shiftAssignments.length === 0) {
      signals.push(signal(`lifecycle:shift:${shift.id}:unallocated`, `unallocated:${shift.updated_at}`, shift.date === yesterday ? 'yesterday' : shift.date === tomorrow ? 'tomorrow' : 'today', 'warning', `Published shift on ${shift.date} has no job assignments`, 'The published rota has no active job assignment attached to this shift.', 'Job planning', '/dashboard?workspace=people&people=jobs', shift.updated_at));
    }
  }

  for (const assignment of activeAssignments) {
    const shift = shiftById.get(assignment.shift_id);
    if (!shift) continue;
    const section = shift.date === yesterday ? 'yesterday' : shift.date === tomorrow ? 'tomorrow' : 'today';
    const status = String(assignment.status);
    if (['unable_to_complete', 'vehicle_issue', 'site_issue', 'route_issue'].includes(status)) {
      signals.push(signal(`lifecycle:assignment:${assignment.id}:exception`, `${status}:${assignment.updated_at}`, section, status === 'unable_to_complete' || status === 'vehicle_issue' ? 'critical' : 'warning', `Job requires follow-up: ${status.replace(/_/g, ' ')}`, 'The driver recorded an execution exception. Review the event and coordinate the next controlled action.', 'Job execution', '/dashboard?workspace=people&people=jobs', assignment.updated_at));
    } else if (status === 'delayed') {
      signals.push(signal(`lifecycle:assignment:${assignment.id}:delayed`, `delayed:${assignment.updated_at}`, section, 'warning', 'Delayed job needs review', 'The driver recorded a delay; review the event before making a customer or rota commitment.', 'Job execution', '/dashboard?workspace=people&people=jobs', assignment.updated_at));
    } else if ((status === 'published' || status === 'updated') && shift.date !== yesterday) {
      signals.push(signal(`lifecycle:assignment:${assignment.id}:ack`, `ack:${assignment.updated_at}`, section, 'warning', 'Published job awaits driver acknowledgement', 'The assignment has not entered the acknowledged execution state.', 'Job execution', '/dashboard?workspace=people&people=jobs', assignment.updated_at));
    }
    if (shift.date === today && (status === 'published' || status === 'updated' || status === 'acknowledged') && assignment.planned_arrival_at && new Date(assignment.planned_arrival_at).getTime() < now.getTime()) {
      signals.push(signal(`lifecycle:assignment:${assignment.id}:no-start`, `no-start:${assignment.updated_at}:${assignment.planned_arrival_at}`, 'today', 'warning', 'Planned job window passed without a start state', 'This is an operational follow-up signal, not a driver-location assertion.', 'Job execution', '/dashboard?workspace=people&people=jobs', assignment.updated_at));
    }
  }

  for (const asset of assets) {
    if (asset.status === 'prohibited' || asset.status === 'action_required' || asset.status === 'unknown') {
      const severity = asset.status === 'prohibited' ? 'critical' : asset.status === 'action_required' ? 'warning' : 'advisory';
      signals.push(signal(`asset:readiness:${asset.id}`, `${asset.status}:${asset.reasons.map((reason) => `${reason.code}:${reason.dueDate ?? ''}`).join('|')}`, 'today', severity, `${asset.label} readiness requires review`, asset.reasons.map((reason) => reason.label).join('; ') || 'The canonical asset policy returned incomplete readiness evidence.', 'Asset readiness', '/dashboard?workspace=fleet&fleet=vehicles', null));
    }
    for (const item of buildComplianceForecast(asset, now, assetForecastAssignments)) {
      const days = item.daysRemaining ?? 31;
      const isWithinThirtyDays = item.status === 'expiring' && days <= 30;
      if ((!forecastNeedsAction(item) && !isWithinThirtyDays) || item.dueDate === null || asset.status === 'prohibited' || asset.status === 'action_required' || asset.status === 'unknown') continue;
      if (days > 30) continue;
      signals.push(signal(`compliance:asset:${item.id}`, `${item.status}:${item.dueDate}:${item.planningRisk}:${item.planningConflictDates.join(',')}`, item.planningConflictDates.includes(tomorrow) ? 'tomorrow' : days <= 0 ? 'today' : days <= 1 ? 'tomorrow' : 'next30', item.severity === 'critical' ? 'critical' : item.severity === 'high' ? 'warning' : 'advisory', `${item.assetLabel}: ${item.label} due ${item.dueDate}`, item.planningRisk === 'planned_after_expiry' ? 'A planned assignment falls after the recorded evidence date. Review the plan; this is not an automatic legal conclusion.' : 'The deterministic forecast found a near-term or overdue evidence date.', 'Compliance forecast', '/dashboard?workspace=fleet&fleet=vehicles', item.dueDate));
    }
  }

  for (const item of driverForecast) {
    if (!driverForecastNeedsAction(item) && !(item.status === 'expiring' && item.daysRemaining !== null && item.daysRemaining <= 30)) continue;
    const days = item.daysRemaining ?? 31;
    if (days > 30 && item.planningRisk === 'none') continue;
    const section: AtlasMorningSectionKey = item.planningConflictDates.includes(tomorrow) ? 'tomorrow' : days <= 0 ? 'today' : 'next30';
    signals.push(signal(`compliance:driver:${item.id}`, `${item.status}:${item.dueDate ?? 'missing'}:${item.planningRisk}`, section, item.status === 'expired' ? 'critical' : item.status === 'missing' ? 'warning' : item.severity === 'high' ? 'warning' : 'advisory', `${item.driverLabel}: ${item.label} ${item.status === 'missing' ? 'is missing' : item.dueDate ? `due ${item.dueDate}` : 'needs review'}`, item.planningRisk === 'planned_after_expiry' || item.planningRisk === 'planned_with_missing_evidence' ? 'A future assignment needs a compliance evidence review. This flags planning risk without claiming future illegality.' : 'The deterministic forecast uses the current profile and personnel-document evidence.', 'Driver compliance', '/dashboard?workspace=people&people=drivers', item.dueDate));
  }

  for (const alert of podHealth.alerts) {
    signals.push(signal(alert.signalKey, alert.fingerprint, 'today', alert.severity, alert.title, alert.detail, alert.sourceLabel, '/dashboard?workspace=people&people=atlas', alert.sourceUpdatedAt));
  }

  for (const evidence of podEvidence ?? []) {
    const followUp = evidence.review_status === 'needs_follow_up';
    signals.push(signal(
      `pod-review:${evidence.id}`,
      `${evidence.review_status}:${evidence.updated_at}`,
      'today',
      followUp ? 'warning' : 'advisory',
      followUp ? 'POD evidence needs follow-up' : 'POD evidence awaits manager review',
      followUp ? 'A manager requested follow-up on the evidence attached to a real job assignment.' : 'Evidence attached to a real job assignment is awaiting a manager decision.',
      'POD review',
      '/dashboard?workspace=people&people=jobs&panel=pod-review',
      evidence.updated_at ?? evidence.uploaded_at,
    ));
  }

  const { data: observationRows, error: observationError } = await supabase.rpc('sync_atlas_signal_observations', {
    p_signals: signals.map((item) => ({ signal_key: item.signalKey, fingerprint: item.fingerprint, section: item.section, severity: item.severity, source_updated_at: item.sourceUpdatedAt })),
  });
  if (observationError) throw new Error(observationError.message || 'Unable to persist Atlas signal observations.');
  const observations = new Map<string, AtlasMorningObservation>((observationRows ?? []).map((row) => [row.signal_key, { isNew: row.is_new, firstSeenAt: row.first_seen_at, lastSeenAt: row.last_seen_at }]));
  return buildAtlasMorningBriefing(signals, observations, now);
}

function signal(signalKey: string, fingerprint: string, section: AtlasMorningSectionKey, severity: AtlasMorningSignal['severity'], title: string, detail: string, sourceLabel: string, href: string, sourceUpdatedAt: string | null): AtlasMorningSignal {
  return { signalKey, fingerprint, section, severity, title, detail, sourceLabel, href, sourceUpdatedAt };
}

function eventSection(createdAt: string, today: string, yesterday: string, tomorrow: string): AtlasMorningSectionKey {
  const date = formatDateOnly(new Date(createdAt));
  return date === yesterday ? 'yesterday' : date === tomorrow ? 'tomorrow' : date === today ? 'today' : date < today ? 'yesterday' : 'next30';
}

function addDays(value: Date, amount: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
