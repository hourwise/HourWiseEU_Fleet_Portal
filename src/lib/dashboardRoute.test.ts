import { describe, expect, it } from 'vitest';
import { buildDashboardUrl, DEFAULT_DASHBOARD_ROUTE, readDashboardRouteState } from './dashboardRoute';

describe('dashboard route state', () => {
  it('defaults to the dashboard when no query params are present', () => {
    expect(readDashboardRouteState('')).toEqual(DEFAULT_DASHBOARD_ROUTE);
    expect(readDashboardRouteState('?workspace=dashboard')).toEqual(DEFAULT_DASHBOARD_ROUTE);
  });

  it('restores workspace, people section and existing focus params', () => {
    const state = readDashboardRouteState('?workspace=people&people=jobs&driver=driver-1&vehicle=vehicle-2&date=2026-08-06');
    expect(state.workspace).toBe('people');
    expect(state.people).toBe('jobs');
    expect(state.focusedDriverId).toBe('driver-1');
    expect(state.focusedVehicleId).toBe('vehicle-2');
    expect(state.focusedDate).toBe('2026-08-06');
  });

  it('restores the focused shift from the shift query parameter', () => {
    expect(readDashboardRouteState('?workspace=people&people=jobs&shift=shift-abc').focusedShiftId).toBe('shift-abc');
  });

  it('falls back to safe defaults for invalid values but keeps the shift param', () => {
    const state = readDashboardRouteState('?workspace=bogus&people=whatever&shift=shift-abc');
    expect(state.workspace).toBe('dashboard');
    expect(state.people).toBe('drivers');
    expect(state.focusedShiftId).toBe('shift-abc');
  });

  it('includes the shift param in the URL only for People -> Jobs', () => {
    expect(buildDashboardUrl({ ...DEFAULT_DASHBOARD_ROUTE, workspace: 'people', people: 'jobs', focusedShiftId: 'shift-abc' }))
      .toBe('/dashboard?workspace=people&people=jobs&shift=shift-abc');
    expect(buildDashboardUrl({ ...DEFAULT_DASHBOARD_ROUTE, workspace: 'people', people: 'shifts', focusedShiftId: 'shift-abc' }))
      .toBe('/dashboard?workspace=people&people=shifts');
    expect(buildDashboardUrl({ ...DEFAULT_DASHBOARD_ROUTE, workspace: 'fleet', fleet: 'fuel', focusedShiftId: 'shift-abc' }))
      .toBe('/dashboard?workspace=fleet&fleet=fuel');
  });

  it('drops the shift param when the focused shift is cleared', () => {
    expect(buildDashboardUrl({ ...DEFAULT_DASHBOARD_ROUTE, workspace: 'people', people: 'jobs', focusedShiftId: undefined }))
      .toBe('/dashboard?workspace=people&people=jobs');
  });
});
