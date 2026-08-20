import { describe, expect, it } from 'vitest';
import { buildRoutePlan, buildRouteRequestFingerprint, createRouteVersion, isRouteEstimateFingerprintStale, isRouteEstimateStale, orderStops, UNCONFIGURED_ROUTE_CAPABILITIES, validateStopOrder, type PlannedStop } from './routePlanning';

const stop = (id: string, sequence: number, addressText = `${id} address`): PlannedStop => ({ id, sequence, stopType: 'service', siteName: null, addressText, latitude: null, longitude: null, instructions: null, driverNotes: null, arrivalWindowStart: null, arrivalWindowEnd: null, activity: null });

describe('Batch 11 route planning contract', () => {
  it('keeps explicit sequence deterministic and rejects duplicates/gaps', () => {
    expect(orderStops([stop('b', 2), stop('a', 1)]).map((value) => value.id)).toEqual(['a', 'b']);
    expect(validateStopOrder([stop('a', 1), stop('b', 3)])).toContain('contiguous');
    expect(validateStopOrder([stop('a', 1), stop('b', 1)])).toContain('contiguous');
  });
  it('does not claim distance or ETA without a configured provider', () => {
    const plan = buildRoutePlan([stop('a', 1), stop('b', 2)], { vehicleId: 'vehicle-1', profileVersion: 'v1', vehicleType: 'rigid' });
    expect(plan.state).toBe('provider_unavailable');
    expect(plan.message).toContain('unavailable');
  });
  it('distinguishes missing vehicle profile and stale route identity', () => {
    expect(buildRoutePlan([stop('a', 1)], null).state).toBe('restriction_incomplete');
    const version = createRouteVersion([stop('a', 1)], { vehicleId: 'vehicle-1', profileVersion: 'v1', vehicleType: 'rigid' });
    expect(isRouteEstimateStale(version, null)).toBe(true);
    expect(isRouteEstimateStale(version, version)).toBe(false);
  });
  it('reports missing address instead of creating a straight-line fallback', () => {
    expect(buildRoutePlan([stop('a', 1, '')], { vehicleId: 'vehicle-1', profileVersion: 'v1', vehicleType: 'rigid' }).state).toBe('missing_address');
  });
  it('invalidates the provider cache when stop order, trailer, options, or provider capability changes', () => {
    const base = buildRoutePlan([stop('a', 1), stop('b', 2)], { vehicleId: 'vehicle-1', profileVersion: 'v1', vehicleType: 'rigid' });
    const request = base.request!;
    const fingerprint = buildRouteRequestFingerprint(request);
    expect(buildRouteRequestFingerprint({ ...request, stops: [stop('a', 1), stop('c', 2)] })).not.toBe(fingerprint);
    expect(buildRouteRequestFingerprint({ ...request, trailerProfile: { trailerId: 'trailer-1', profileVersion: 'v1', trailerType: 'curtain' } })).not.toBe(fingerprint);
    expect(buildRouteRequestFingerprint({ ...request, options: { requireHgvRouting: true } })).not.toBe(fingerprint);
    expect(buildRouteRequestFingerprint({ ...request, providerCapabilities: { ...UNCONFIGURED_ROUTE_CAPABILITIES, hgvRouting: true } })).not.toBe(fingerprint);
    expect(isRouteEstimateFingerprintStale(fingerprint, fingerprint)).toBe(false);
    expect(isRouteEstimateFingerprintStale(fingerprint, null)).toBe(true);
  });
});
