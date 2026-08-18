export type AtlasBriefingItem = {
  id: string;
  severity: 'critical' | 'warning' | 'advisory';
  title: string;
  detail: string;
  sourceLabel: string;
  href: string;
};

export type AtlasBriefingInput = {
  today: string;
  shiftsToday: number;
  unallocatedJobsToday: number;
  prohibitedAssets: number;
  actionRequiredAssets: number;
  unknownAssets: number;
  outstandingAcknowledgements: number;
  openSafetyDefects: number;
  expiringComplianceItems: number;
  delayedOrIncompleteJobs: number;
  delayedJobs?: number;
  unableToCompleteJobs?: number;
  vehicleIssueJobs?: number;
  siteIssueJobs?: number;
  routeIssueJobs?: number;
  unacknowledgedJobs?: number;
  plannedStartPassedWithoutStart?: number;
  forecastActionItems?: number;
};

export function buildAtlasBriefing(input: AtlasBriefingInput): AtlasBriefingItem[] {
  const items: AtlasBriefingItem[] = [];
  if (input.prohibitedAssets > 0) items.push(item('assets-prohibited', 'critical', `${input.prohibitedAssets} asset${plural(input.prohibitedAssets)} cannot be assigned`, 'Vehicle readiness has a prohibited result from VOR or an unresolved safety defect.', 'Asset readiness', '/dashboard?workspace=fleet&fleet=vehicles'));
  if (input.openSafetyDefects > 0) items.push(item('defects-open', 'critical', `${input.openSafetyDefects} open safety defect${plural(input.openSafetyDefects)}`, 'Open defects require repair lifecycle action before return to service.', 'Vehicle checks', '/dashboard?workspace=fleet&fleet=vehicle_checks'));
  if (input.unallocatedJobsToday > 0) items.push(item('jobs-unallocated', 'warning', `${input.unallocatedJobsToday} job${plural(input.unallocatedJobsToday)} have no driver allocation`, `Unallocated work is present in today's operational window (${input.today}).`, 'Job planning', '/dashboard?workspace=people&people=jobs'));
  if (input.outstandingAcknowledgements > 0) items.push(item('acknowledgements', 'warning', `${input.outstandingAcknowledgements} driver acknowledgement${plural(input.outstandingAcknowledgements)} outstanding`, 'Published operational changes or messages still require driver acknowledgement.', 'Messaging and events', '/dashboard?workspace=people&people=messages'));
  if (input.expiringComplianceItems > 0) items.push(item('compliance-expiring', 'warning', `${input.expiringComplianceItems} compliance item${plural(input.expiringComplianceItems)} expire within 14 days`, 'Expiry dates are drawn from the current asset and driver evidence records.', 'Compliance', '/dashboard?workspace=fleet&fleet=vehicles'));
  if ((input.forecastActionItems ?? 0) > 0) items.push(item('compliance-forecast-action', 'warning', `${input.forecastActionItems} compliance forecast item${plural(input.forecastActionItems ?? 0)} need action`, 'The deterministic forecast found overdue, near-term, or missing required asset evidence. This is an evidence and planning signal, not an automatic legal conclusion.', 'Compliance forecast', '/dashboard?workspace=fleet&fleet=vehicles'));
  if (input.delayedOrIncompleteJobs > 0) items.push(item('jobs-incomplete', 'warning', `${input.delayedOrIncompleteJobs} job${plural(input.delayedOrIncompleteJobs)} need operational follow-up`, 'The current assignment data contains delayed, updated, or incomplete operational work.', 'Job planning', '/dashboard?workspace=people&people=jobs'));
  if ((input.delayedJobs ?? 0) > 0) items.push(item('jobs-delayed', 'warning', `${input.delayedJobs} delayed job${plural(input.delayedJobs ?? 0)}`, 'A driver-recorded delay requires an operational decision or customer communication review.', 'Job execution', '/dashboard?workspace=people&people=jobs'));
  if ((input.unableToCompleteJobs ?? 0) > 0) items.push(item('jobs-unable', 'critical', `${input.unableToCompleteJobs} job${plural(input.unableToCompleteJobs ?? 0)} unable to complete`, 'The driver recorded that the job could not be completed. Review the event and controlled next action.', 'Job execution', '/dashboard?workspace=people&people=jobs'));
  if ((input.vehicleIssueJobs ?? 0) > 0) items.push(item('jobs-vehicle-issue', 'critical', `${input.vehicleIssueJobs} vehicle issue${plural(input.vehicleIssueJobs ?? 0)} reported`, 'A vehicle issue was recorded against active work and needs fleet follow-up.', 'Job execution', '/dashboard?workspace=people&people=jobs'));
  if ((input.siteIssueJobs ?? 0) > 0) items.push(item('jobs-site-issue', 'warning', `${input.siteIssueJobs} site issue${plural(input.siteIssueJobs ?? 0)} reported`, 'A site issue was recorded against active work and needs an operational response.', 'Job execution', '/dashboard?workspace=people&people=jobs'));
  if ((input.routeIssueJobs ?? 0) > 0) items.push(item('jobs-route-issue', 'warning', `${input.routeIssueJobs} route issue${plural(input.routeIssueJobs ?? 0)} reported`, 'A route issue was recorded. Review the plan without inferring live location or ETA.', 'Job execution', '/dashboard?workspace=people&people=jobs'));
  if ((input.unacknowledgedJobs ?? 0) > 0) items.push(item('jobs-unacknowledged', 'warning', `${input.unacknowledgedJobs} published job${plural(input.unacknowledgedJobs ?? 0)} not acknowledged`, 'The assignment remains published or updated and has not entered the acknowledged execution state.', 'Job execution', '/dashboard?workspace=people&people=jobs'));
  if ((input.plannedStartPassedWithoutStart ?? 0) > 0) items.push(item('jobs-no-start', 'warning', `${input.plannedStartPassedWithoutStart} planned job window${plural(input.plannedStartPassedWithoutStart ?? 0)} passed without start`, 'A planned window passed without a start state. This is a follow-up signal, not a driver-location assertion.', 'Job execution', '/dashboard?workspace=people&people=jobs'));
  if (input.unknownAssets > 0) items.push(item('assets-unknown', 'advisory', `${input.unknownAssets} asset${plural(input.unknownAssets)} have incomplete readiness evidence`, 'Missing evidence is shown as unknown and should be checked before assignment.', 'Asset readiness', '/dashboard?workspace=fleet&fleet=vehicles'));
  if (items.length === 0 && input.shiftsToday === 0) items.push(item('no-rota', 'advisory', 'No rota data is available for today', 'The briefing cannot infer operational health from an empty rota.', 'Rota', '/dashboard?workspace=people&people=shifts'));
  return items;
}

function item(id: string, severity: AtlasBriefingItem['severity'], title: string, detail: string, sourceLabel: string, href: string): AtlasBriefingItem {
  return { id, severity, title, detail, sourceLabel, href };
}

function plural(value: number): string {
  return value === 1 ? '' : 's';
}
