import { supabase } from './supabase';
import { buildAtlasBriefing, type AtlasBriefingItem } from './atlasBriefing';
import { fetchAssetReadinessSnapshot } from './assetReadinessLoad';
import { buildComplianceForecast, forecastNeedsAction } from './complianceForecast';

export async function fetchAtlasOperationsBriefing(companyId: string, now = new Date()): Promise<AtlasBriefingItem[]> {
  const today = formatDateOnly(now);
  const [{ data: shifts, error: shiftError }, { data: events, error: eventError }, { data: acknowledgements, error: acknowledgementError }, { data: assignments, error: assignmentError }, assets] = await Promise.all([
    supabase.from('shifts').select('id, status').eq('company_id', companyId).eq('date', today),
    supabase.from('fleet_events').select('id, requires_ack').eq('company_id', companyId).eq('requires_ack', true),
    supabase.from('driver_acknowledgements').select('event_id').eq('company_id', companyId),
    supabase.from('job_assignments').select('id, shift_id, status, planned_arrival_at, updated_at').eq('company_id', companyId),
    fetchAssetReadinessSnapshot(companyId, now),
  ]);

  if (shiftError) throw new Error(shiftError.message || 'Unable to load today\'s rota for Atlas.');
  if (eventError) throw new Error(eventError.message || 'Unable to load operational events for Atlas.');
  if (acknowledgementError) throw new Error(acknowledgementError.message || 'Unable to load acknowledgements for Atlas.');
  if (assignmentError) throw new Error(assignmentError.message || 'Unable to load job assignments for Atlas.');

  const activeShiftsToday = (shifts ?? []).filter((shift) => shift.status === 'published' || shift.status === 'updated');
  const shiftIds = new Set(activeShiftsToday.map((shift) => shift.id));
  const activeAssignmentsToday = (assignments ?? []).filter((assignment) => shiftIds.has(assignment.shift_id) && assignment.status !== 'cancelled' && assignment.status !== 'draft');
  const acknowledgedEventIds = new Set((acknowledgements ?? []).map((row) => row.event_id));
  const outstandingAcknowledgements = (events ?? []).filter((event) => !acknowledgedEventIds.has(event.id)).length;
  const prohibitedAssets = assets.filter((asset) => asset.status === 'prohibited').length;
  const actionRequiredAssets = assets.filter((asset) => asset.status === 'action_required').length;
  const unknownAssets = assets.filter((asset) => asset.status === 'unknown').length;
  const openSafetyDefects = assets.reduce((count, asset) => count + asset.reasons.filter((reason) => reason.code === 'unresolved_safety_defect').length, 0);
  const expiringComplianceItems = assets.reduce((count, asset) => count + asset.reasons.filter((reason) => reason.severity === 'warning' || reason.severity === 'action_required').length, 0);
  const forecastActionItems = assets.flatMap((asset) => buildComplianceForecast(asset)).filter(forecastNeedsAction).length;
  const shiftsWithoutJobs = activeShiftsToday.filter((shift) => !activeAssignmentsToday.some((assignment) => assignment.shift_id === shift.id)).length;
  const updatedJobs = activeAssignmentsToday.filter((assignment) => assignment.status === 'updated').length;
  const delayedJobs = activeAssignmentsToday.filter((assignment) => String(assignment.status) === 'delayed').length;
  const unableToCompleteJobs = activeAssignmentsToday.filter((assignment) => String(assignment.status) === 'unable_to_complete').length;
  const vehicleIssueJobs = activeAssignmentsToday.filter((assignment) => String(assignment.status) === 'vehicle_issue').length;
  const siteIssueJobs = activeAssignmentsToday.filter((assignment) => String(assignment.status) === 'site_issue').length;
  const routeIssueJobs = activeAssignmentsToday.filter((assignment) => String(assignment.status) === 'route_issue').length;
  const unacknowledgedJobs = activeAssignmentsToday.filter((assignment) => String(assignment.status) === 'published' || String(assignment.status) === 'updated').length;
  const plannedStartPassedWithoutStart = activeAssignmentsToday.filter((assignment) => (String(assignment.status) === 'published' || String(assignment.status) === 'updated' || String(assignment.status) === 'acknowledged') && assignment.planned_arrival_at && new Date(assignment.planned_arrival_at).getTime() < now.getTime()).length;

  return buildAtlasBriefing({
    today,
    shiftsToday: activeShiftsToday.length,
    unallocatedJobsToday: shiftsWithoutJobs,
    prohibitedAssets,
    actionRequiredAssets,
    unknownAssets,
    outstandingAcknowledgements,
    openSafetyDefects,
    expiringComplianceItems,
    delayedOrIncompleteJobs: updatedJobs,
    delayedJobs,
    unableToCompleteJobs,
    vehicleIssueJobs,
    siteIssueJobs,
    routeIssueJobs,
    unacknowledgedJobs,
    plannedStartPassedWithoutStart,
    forecastActionItems,
  });
}

function formatDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
