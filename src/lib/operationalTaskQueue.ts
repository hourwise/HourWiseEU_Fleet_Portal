import { fetchAssetReadinessSnapshot } from './assetReadinessLoad';
import type { AssetReadinessResult } from './assetCompliance';
import { supabase } from './supabase';
import { fetchOperationalTaskHandlings, type OperationalTaskHandling } from './operationalTaskHandling';
import { driverForecastNeedsAction, type DriverComplianceForecastItem, fetchDriverComplianceForecast } from './driverComplianceForecast';
import { canonicalSignalKey } from './atlasSignalTaskContract';

export type OperationalTaskSeverity = 'critical' | 'high' | 'medium' | 'info';
export type OperationalTaskCategory = 'jobs' | 'drivers' | 'fleet' | 'compliance';

export type OperationalTask = {
  id: string;
  severity: OperationalTaskSeverity;
  category: OperationalTaskCategory;
  title: string;
  detail: string;
  sourceType: string;
  sourceId: string;
  sourceSignalKey?: string;
  occurredAt: string | null;
  dueAt: string | null;
  navigationTarget: string;
  actionable: boolean;
  handling?: OperationalTaskHandling;
};

export type OperationalTaskInput = {
  now?: Date;
  assets?: AssetReadinessResult[];
  events?: Array<{ id: string; priority: string | null; title: string; body: string | null; created_at: string; requires_ack: boolean }>;
  acknowledgedEventIds?: string[];
  defects?: Array<{ id: string; reg_number: string; check_status: string | null; defect_lifecycle_status: string | null; defect_details: string | null; created_at: string | null }>;
  assignments?: Array<{ id: string; shift_id: string; status: string; driver_id: string; vehicle_id: string | null; planned_arrival_at: string | null; updated_at: string }>;
  shifts?: Array<{ id: string; date: string; status: string; vehicle_id: string | null; updated_at: string }>;
  driverCompliance?: DriverComplianceForecastItem[];
  podEvidence?: Array<{ id: string; evidence_type: string; outcome: string; review_status: 'pending' | 'needs_follow_up'; uploaded_at: string; job_id: string; job_assignment_id: string }>;
};
type PodEvidenceTaskInput = NonNullable<OperationalTaskInput['podEvidence']>[number];

export async function fetchOperationalTasks(companyId: string, now = new Date()): Promise<OperationalTask[]> {
  const [{ data: events, error: eventError }, { data: acknowledgements, error: acknowledgementError }, { data: defects, error: defectError }, { data: assignments, error: assignmentError }, { data: shifts, error: shiftError }, { data: podEvidence, error: podEvidenceError }, assets, driverCompliance] = await Promise.all([
    supabase.from('fleet_events').select('id, priority, title, body, created_at, requires_ack').eq('company_id', companyId).eq('requires_ack', true),
    supabase.from('driver_acknowledgements').select('event_id').eq('company_id', companyId),
    supabase.from('vehicle_checks').select('id, reg_number, check_status, defect_lifecycle_status, defect_details, created_at').eq('company_id', companyId),
    supabase.from('job_assignments').select('id, shift_id, status, driver_id, vehicle_id, planned_arrival_at, updated_at').eq('company_id', companyId),
    supabase.from('shifts').select('id, date, status, vehicle_id, updated_at').eq('company_id', companyId),
    supabase.from('job_evidence').select('id, evidence_type, outcome, review_status, uploaded_at, job_id, job_assignment_id').eq('company_id', companyId).in('review_status', ['pending', 'needs_follow_up']),
    fetchAssetReadinessSnapshot(companyId, now),
    fetchDriverComplianceForecast(companyId, now),
  ]);

  if (eventError) throw new Error(eventError.message || 'Unable to load acknowledgement tasks.');
  if (acknowledgementError) throw new Error(acknowledgementError.message || 'Unable to load acknowledgement state.');
  if (defectError) throw new Error(defectError.message || 'Unable to load vehicle check tasks.');
  if (assignmentError) throw new Error(assignmentError.message || 'Unable to load job execution tasks.');
  if (shiftError) throw new Error(shiftError.message || 'Unable to load rota tasks.');
  if (podEvidenceError) throw new Error(podEvidenceError.message || 'Unable to load POD review tasks.');

  const projectedTasks = buildOperationalTasks({
    now,
    assets,
    events: events ?? [],
    acknowledgedEventIds: (acknowledgements ?? []).map((row) => row.event_id),
    defects: defects ?? [],
    assignments: assignments ?? [],
    shifts: shifts ?? [],
    driverCompliance,
    podEvidence: (podEvidence ?? []).filter((row): row is PodEvidenceTaskInput => row.review_status === 'pending' || row.review_status === 'needs_follow_up'),
  });
  const handlings = await fetchOperationalTaskHandlings(companyId, projectedTasks.map((task) => task.sourceId));
  const handlingBySource = new Map(handlings.map((handling) => [`${handling.sourceType}:${handling.sourceId}`, handling]));
  return projectedTasks.map((task) => ({ ...task, sourceSignalKey: canonicalSignalKey(task.sourceType as Parameters<typeof canonicalSignalKey>[0], task.sourceId), handling: reconcileSourceDrivenHandling(task, handlingBySource.get(`${task.sourceType}:${task.sourceId}`)) }));
}

export function reconcileSourceDrivenHandling(task: OperationalTask, handling?: OperationalTaskHandling): OperationalTaskHandling | undefined {
  if (!handling || !['driver_compliance', 'job_evidence'].includes(task.sourceType) || handling.status !== 'resolved') return handling;
  return {
    ...handling,
    status: 'new',
    action: null,
    resolvedAt: null,
    note: task.sourceType === 'job_evidence' ? 'Evidence still has a pending manager review outcome; handling remains open until the authoritative review state changes.' : 'Source evidence still projects an active compliance task; handling remains open until the authoritative record changes.',
  };
}

export function buildOperationalTasks(input: OperationalTaskInput): OperationalTask[] {
  const now = input.now ?? new Date();
  const tasks: OperationalTask[] = [];
  const acknowledgedEventIds = new Set(input.acknowledgedEventIds ?? []);
  const shifts = input.shifts ?? [];
  const assignments = input.assignments ?? [];
  const assets = input.assets ?? [];

  for (const evidence of input.podEvidence ?? []) {
    const followUp = evidence.review_status === 'needs_follow_up';
    tasks.push({
      id: `pod-review:${evidence.id}`,
      severity: followUp ? 'high' : 'medium',
      category: 'jobs',
      title: followUp ? 'POD evidence needs follow-up' : 'POD evidence awaits manager review',
      detail: followUp ? 'The manager requested follow-up on job evidence. Resolve the evidence review before closing the operational exception.' : `A ${evidence.evidence_type.replace(/_/g, ' ')} record for ${evidence.outcome.replace(/_/g, ' ')} is awaiting a manager decision.`,
      sourceType: 'job_evidence',
      sourceId: evidence.id,
      occurredAt: evidence.uploaded_at,
      dueAt: null,
      navigationTarget: '/dashboard?workspace=people&people=jobs&panel=pod-review',
      actionable: true,
    });
  }

  for (const event of input.events ?? []) {
    if (!event.requires_ack || acknowledgedEventIds.has(event.id)) continue;
    tasks.push({
      id: `event:${event.id}`,
      severity: event.priority === 'critical' ? 'critical' : event.priority === 'warning' ? 'high' : 'medium',
      category: 'drivers',
      title: event.title || 'Driver acknowledgement required',
      detail: event.body || 'A published operational event has not been acknowledged by its recipient driver.',
      sourceType: 'fleet_event',
      sourceId: event.id,
      occurredAt: event.created_at,
      dueAt: null,
      navigationTarget: '/dashboard?workspace=people&people=messages',
      actionable: true,
    });
  }

  for (const defect of input.defects ?? []) {
    if (defect.check_status !== 'defect' || (defect.defect_lifecycle_status ?? 'reported') === 'fixed') continue;
    tasks.push({
      id: `defect:${defect.id}`,
      severity: 'high',
      category: 'fleet',
      title: `Open safety defect on ${defect.reg_number}`,
      detail: defect.defect_details || 'The defect has no recorded repair or closure detail.',
      sourceType: 'vehicle_check',
      sourceId: defect.id,
      occurredAt: defect.created_at,
      dueAt: null,
      navigationTarget: '/dashboard?workspace=fleet&fleet=vehicle_checks',
      actionable: true,
    });
  }

  for (const assignment of assignments) {
    const status = assignment.status;
    if (status === 'unable_to_complete' || status === 'vehicle_issue' || status === 'site_issue' || status === 'route_issue') {
      tasks.push({
        id: `job-exception:${assignment.id}`,
        severity: 'critical',
        category: 'jobs',
        title: `Job requires follow-up: ${status.replace(/_/g, ' ')}`,
        detail: 'The driver recorded an execution exception. Review the event and coordinate the next controlled action.',
        sourceType: 'job_assignment',
        sourceId: assignment.id,
        occurredAt: assignment.updated_at,
        dueAt: null,
        navigationTarget: '/dashboard?workspace=people&people=jobs',
        actionable: true,
      });
    } else if (status === 'delayed') {
      tasks.push({
        id: `job-delayed:${assignment.id}`,
        severity: 'high',
        category: 'jobs',
        title: 'Delayed job needs review',
        detail: 'The driver has recorded a delay; review the event before making a customer or rota commitment.',
        sourceType: 'job_assignment',
        sourceId: assignment.id,
        occurredAt: assignment.updated_at,
        dueAt: null,
        navigationTarget: '/dashboard?workspace=people&people=jobs',
        actionable: true,
      });
    } else if (status === 'published' || status === 'updated') {
      tasks.push({
        id: `job-unacknowledged:${assignment.id}`,
        severity: 'medium',
        category: 'drivers',
        title: 'Published job awaits driver acknowledgement',
        detail: 'The assignment has not entered the acknowledged execution state.',
        sourceType: 'job_assignment',
        sourceId: assignment.id,
        occurredAt: assignment.updated_at,
        dueAt: assignment.planned_arrival_at,
        navigationTarget: '/dashboard?workspace=people&people=jobs',
        actionable: true,
      });
    }

    if ((status === 'published' || status === 'updated' || status === 'acknowledged') && assignment.planned_arrival_at && new Date(assignment.planned_arrival_at).getTime() < now.getTime()) {
      tasks.push({
        id: `job-no-start:${assignment.id}`,
        severity: 'high',
        category: 'jobs',
        title: 'Planned job window passed without a start state',
        detail: 'The planned window has passed and no start event is recorded. This is an operational follow-up signal, not a driver-location assertion.',
        sourceType: 'job_assignment',
        sourceId: assignment.id,
        occurredAt: assignment.updated_at,
        dueAt: assignment.planned_arrival_at,
        navigationTarget: '/dashboard?workspace=people&people=jobs',
        actionable: true,
      });
    }
  }

  const activeAssignmentsByShift = new Set(assignments.filter((assignment) => assignment.status !== 'cancelled' && assignment.status !== 'draft').map((assignment) => assignment.shift_id));
  for (const shift of shifts) {
    if ((shift.status === 'published' || shift.status === 'updated') && !activeAssignmentsByShift.has(shift.id)) {
      tasks.push({
        id: `shift-unallocated:${shift.id}`,
        severity: 'high',
        category: 'jobs',
        title: `Published shift on ${shift.date} has no job assignments`,
        detail: 'The rota is published but no active job assignment is attached to this shift.',
        sourceType: 'shift',
        sourceId: shift.id,
        occurredAt: shift.updated_at,
        dueAt: shift.date,
        navigationTarget: '/dashboard?workspace=people&people=jobs',
        actionable: true,
      });
    }
  }

  const assignedVehicleIds = new Set(shifts.filter((shift) => shift.status !== 'cancelled' && shift.vehicle_id).map((shift) => shift.vehicle_id as string));
  for (const asset of assets) {
    if (asset.status === 'prohibited' && assignedVehicleIds.has(asset.id)) {
      tasks.push({
        id: `asset-blocked:${asset.id}`,
        severity: 'critical',
        category: 'compliance',
        title: `${asset.label} is prohibited for assignment`,
        detail: asset.reasons.map((reason) => reason.label).join('; ') || 'The canonical readiness policy returned a hard block.',
        sourceType: 'asset_readiness',
        sourceId: asset.id,
        occurredAt: null,
        dueAt: null,
        navigationTarget: '/dashboard?workspace=fleet&fleet=vehicles',
        actionable: true,
      });
    } else if (asset.status === 'action_required' || asset.status === 'unknown') {
      tasks.push({
        id: `asset-readiness:${asset.id}`,
        severity: asset.status === 'action_required' ? 'high' : 'medium',
        category: 'compliance',
        title: `${asset.label} readiness requires evidence review`,
        detail: asset.reasons.map((reason) => reason.label).join('; ') || 'Readiness evidence is incomplete.',
        sourceType: 'asset_readiness',
        sourceId: asset.id,
        occurredAt: null,
        dueAt: null,
        navigationTarget: '/dashboard?workspace=fleet&fleet=vehicles',
        actionable: true,
      });
    }
  }

  const driverItemsByDriver = new Map<string, DriverComplianceForecastItem[]>();
  for (const item of input.driverCompliance ?? []) {
    if (!driverForecastNeedsAction(item) && !(item.status === 'expiring' && item.daysRemaining !== null && item.daysRemaining <= 30)) continue;
    const current = driverItemsByDriver.get(item.driverId) ?? [];
    current.push(item);
    driverItemsByDriver.set(item.driverId, current);
  }
  for (const [driverId, items] of driverItemsByDriver) {
    const severity = items.some((item) => item.status === 'expired') ? 'critical' : items.some((item) => driverForecastNeedsAction(item)) ? 'high' : 'medium';
    const labels = items.map((item) => item.label).join(', ');
    const dueDates = items.map((item) => item.dueDate).filter((value): value is string => Boolean(value)).sort();
    tasks.push({
      id: `driver-compliance:${driverId}`,
      severity,
      category: 'drivers',
      title: `Driver compliance evidence needs review (${labels})`,
      detail: items.some((item) => item.planningRisk !== 'none') ? 'Current personnel evidence conflicts with a future assignment date. Review the plan and evidence; this is not an automatic legal conclusion.' : 'Licence, CPC/DQC, or medical evidence is expired, near expiry, or missing in the current Portal records.',
      sourceType: 'driver_compliance',
      sourceId: driverId,
      occurredAt: null,
      dueAt: dueDates[0] ?? null,
      navigationTarget: '/dashboard?workspace=people&people=drivers',
      actionable: true,
    });
  }

  return tasks.sort(compareTasks);
}

function compareTasks(left: OperationalTask, right: OperationalTask) {
  const severity = { critical: 0, high: 1, medium: 2, info: 3 };
  const leftTime = new Date(left.dueAt ?? left.occurredAt ?? 0).getTime();
  const rightTime = new Date(right.dueAt ?? right.occurredAt ?? 0).getTime();
  return severity[left.severity] - severity[right.severity] || leftTime - rightTime || left.id.localeCompare(right.id);
}
