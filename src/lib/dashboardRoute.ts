/**
 * Dashboard query-string route state.
 *
 * The portal keeps its navigation context (workspace, people/fleet/settings
 * section, tacho tab and optional focus records) in the URL so that refresh,
 * Back and Forward all restore the same screen. Helpers are pure so they can
 * be unit tested without a browser.
 */

export type Workspace = 'dashboard' | 'atlas' | 'people' | 'fleet' | 'compliance' | 'reports' | 'finance' | 'settings';
export type PeopleSection = 'drivers' | 'training' | 'shifts' | 'jobs' | 'supervisors' | 'messages';
export type FleetSection = 'vehicles' | 'vehicle_checks' | 'fuel' | 'olicence' | 'incidents';
export type SettingsSection = 'account' | 'company';
export type TachoTab = 'overview' | 'imports' | 'driver_cards' | 'vehicle_units' | 'simulator';

export interface DashboardRouteState {
  workspace: Workspace;
  people: PeopleSection;
  fleet: FleetSection;
  settings: SettingsSection;
  tacho: TachoTab;
  focusedDriverId?: string;
  focusedVehicleId?: string;
  focusedDate?: string;
  focusedShiftId?: string;
  reportDriverId?: string;
  reportDate?: string;
}

export const WORKSPACES: Workspace[] = ['dashboard', 'atlas', 'people', 'fleet', 'compliance', 'reports', 'finance', 'settings'];
export const PEOPLE_SECTIONS: PeopleSection[] = ['drivers', 'training', 'shifts', 'jobs', 'supervisors', 'messages'];
export const FLEET_SECTIONS: FleetSection[] = ['vehicles', 'vehicle_checks', 'fuel', 'olicence', 'incidents'];
export const SETTINGS_SECTIONS: SettingsSection[] = ['account', 'company'];
export const TACHO_TABS: TachoTab[] = ['overview', 'imports', 'driver_cards', 'vehicle_units', 'simulator'];

export const DEFAULT_DASHBOARD_ROUTE: DashboardRouteState = {
  workspace: 'dashboard',
  people: 'drivers',
  fleet: 'vehicles',
  settings: 'account',
  tacho: 'overview',
};

export function asOneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && allowed.includes(value as T) ? value as T : fallback;
}

/** Parse a dashboard URL search string (e.g. `window.location.search`) into route state. */
export function readDashboardRouteState(search: string): DashboardRouteState {
  const params = new URLSearchParams(search);
  const workspace = asOneOf(params.get('workspace'), WORKSPACES, DEFAULT_DASHBOARD_ROUTE.workspace);

  return {
    workspace,
    people: asOneOf(params.get('people'), PEOPLE_SECTIONS, DEFAULT_DASHBOARD_ROUTE.people),
    fleet: asOneOf(params.get('fleet'), FLEET_SECTIONS, DEFAULT_DASHBOARD_ROUTE.fleet),
    settings: asOneOf(params.get('settings'), SETTINGS_SECTIONS, DEFAULT_DASHBOARD_ROUTE.settings),
    tacho: asOneOf(params.get('tacho'), TACHO_TABS, DEFAULT_DASHBOARD_ROUTE.tacho),
    focusedDriverId: params.get('driver') ?? undefined,
    focusedVehicleId: params.get('vehicle') ?? undefined,
    focusedDate: params.get('date') ?? undefined,
    focusedShiftId: params.get('shift') ?? undefined,
    reportDriverId: params.get('reportDriver') ?? undefined,
    reportDate: params.get('reportDate') ?? undefined,
  };
}

/** Build the dashboard URL for the given route state, omitting defaults and irrelevant params. */
export function buildDashboardUrl(state: DashboardRouteState): string {
  const params = new URLSearchParams();

  if (state.workspace !== DEFAULT_DASHBOARD_ROUTE.workspace) params.set('workspace', state.workspace);
  if (state.workspace === 'people' && state.people !== DEFAULT_DASHBOARD_ROUTE.people) params.set('people', state.people);
  if (state.workspace === 'fleet' && state.fleet !== DEFAULT_DASHBOARD_ROUTE.fleet) params.set('fleet', state.fleet);
  if (state.workspace === 'settings' && state.settings !== DEFAULT_DASHBOARD_ROUTE.settings) params.set('settings', state.settings);
  if (state.workspace === 'compliance' && state.tacho !== DEFAULT_DASHBOARD_ROUTE.tacho) params.set('tacho', state.tacho);
  if ((state.workspace === 'compliance' || state.workspace === 'people') && state.focusedDriverId) params.set('driver', state.focusedDriverId);
  if ((state.workspace === 'compliance' || state.workspace === 'fleet') && state.focusedVehicleId) params.set('vehicle', state.focusedVehicleId);
  if (state.workspace === 'compliance' && state.focusedDate) params.set('date', state.focusedDate);
  // The focused shift is only meaningful when planning jobs for a shift from the rota.
  if (state.workspace === 'people' && state.people === 'jobs' && state.focusedShiftId) params.set('shift', state.focusedShiftId);
  if (state.workspace === 'reports' && state.reportDriverId) params.set('reportDriver', state.reportDriverId);
  if (state.workspace === 'reports' && state.reportDate) params.set('reportDate', state.reportDate);

  const query = params.toString();
  return query ? `/dashboard?${query}` : '/dashboard';
}
