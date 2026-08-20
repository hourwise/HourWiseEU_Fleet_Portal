export type RouteStopType = 'pickup' | 'delivery' | 'service' | 'other';
export type RoutePlanState = 'calculated' | 'stale' | 'provider_unavailable' | 'provider_failed' | 'missing_address' | 'restriction_incomplete';
export type RouteProviderId = 'unconfigured' | string;

export type RouteProviderCapabilities = {
  hgvRouting: boolean;
  heightRestrictions: boolean;
  widthRestrictions: boolean;
  lengthRestrictions: boolean;
  weightRestrictions: boolean;
  hazmat: boolean;
  avoidTolls: boolean;
  liveTraffic: boolean;
  waypointLimit: number | null;
  geocoding: boolean;
  serverOnlyCredential: boolean;
};

export type RouteOptions = {
  avoidTolls?: boolean;
  hazmat?: boolean;
  requireHgvRouting?: boolean;
};

export type RouteProviderError = { code: string; message: string; retryable: boolean };

export type RouteEstimate = {
  provider: RouteProviderId;
  routeVersion: string;
  distanceMetres: number;
  durationSeconds: number;
  legs: Array<{ fromStopId: string; toStopId: string; distanceMetres: number; durationSeconds: number }>;
};

export interface RouteProviderAdapter {
  readonly id: RouteProviderId;
  readonly capabilities: RouteProviderCapabilities;
  calculate(request: RouteRequest): Promise<{ estimate: RouteEstimate | null; error?: RouteProviderError }>;
}

export const UNCONFIGURED_ROUTE_CAPABILITIES: RouteProviderCapabilities = {
  hgvRouting: false, heightRestrictions: false, widthRestrictions: false, lengthRestrictions: false,
  weightRestrictions: false, hazmat: false, avoidTolls: false, liveTraffic: false,
  waypointLimit: null, geocoding: false, serverOnlyCredential: true,
};

export type VehicleRoutingProfile = {
  vehicleId: string;
  profileVersion: string;
  vehicleType: string | null;
  heightMetres?: number | null;
  widthMetres?: number | null;
  lengthMetres?: number | null;
  weightTonnes?: number | null;
  hazmat?: boolean | null;
};

export type PlannedStop = {
  id: string;
  sequence: number;
  stopType: RouteStopType;
  siteName: string | null;
  addressText: string;
  latitude: number | null;
  longitude: number | null;
  instructions: string | null;
  driverNotes: string | null;
  arrivalWindowStart: string | null;
  arrivalWindowEnd: string | null;
  activity: string | null;
  managerNotes?: string | null;
};

export type RouteRequest = {
  provider: RouteProviderId;
  providerVersion: null;
  stops: PlannedStop[];
  vehicleProfile: VehicleRoutingProfile | null;
  options: RouteOptions;
  providerCapabilities: RouteProviderCapabilities;
  routeVersion: string;
};

export type RoutePlan = {
  state: RoutePlanState;
  orderedStops: PlannedStop[];
  request: RouteRequest | null;
  message: string;
};

export function orderStops(stops: readonly PlannedStop[]): PlannedStop[] {
  return [...stops].sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
}

export function validateStopOrder(stops: readonly PlannedStop[]): string | null {
  const ordered = orderStops(stops);
  const sequences = new Set<number>();
  for (let index = 0; index < ordered.length; index += 1) {
    const stop = ordered[index];
    if (!Number.isInteger(stop.sequence) || stop.sequence !== index + 1) return 'Stops must use an explicit contiguous sequence starting at 1.';
    if (sequences.has(stop.sequence)) return 'Each stop sequence must be unique.';
    sequences.add(stop.sequence);
    if (!stop.addressText.trim()) return `Stop ${index + 1} needs an address or clear location text.`;
  }
  return null;
}

export function buildRoutePlan(stops: readonly PlannedStop[], vehicleProfile: VehicleRoutingProfile | null, options: RouteOptions = {}): RoutePlan {
  const orderedStops = orderStops(stops);
  const validationError = validateStopOrder(orderedStops);
  if (validationError || orderedStops.length === 0) return { state: 'missing_address', orderedStops, request: null, message: validationError ?? 'Add at least one stop before requesting a route.' };
  if (orderedStops.some((stop) => !stop.addressText.trim())) return { state: 'missing_address', orderedStops, request: null, message: 'A route cannot be requested until every stop has a location.' };
  if (!vehicleProfile) return { state: 'restriction_incomplete', orderedStops, request: null, message: 'Vehicle routing restrictions are incomplete because no vehicle profile is attached.' };
  const routeVersion = createRouteVersion(orderedStops, vehicleProfile, options);
  return {
    state: 'provider_unavailable',
    orderedStops,
    request: { provider: 'unconfigured', providerVersion: null, stops: orderedStops, vehicleProfile, options, providerCapabilities: UNCONFIGURED_ROUTE_CAPABILITIES, routeVersion },
    message: 'No road-routing provider is configured. Distance, duration, and ETA are unavailable.'
  };
}

export function isRouteEstimateStale(currentVersion: string, estimateVersion: string | null): boolean {
  return !estimateVersion || currentVersion !== estimateVersion;
}

export function createRouteVersion(stops: readonly PlannedStop[], vehicleProfile: VehicleRoutingProfile | null, options: RouteOptions = {}): string {
  const payload = JSON.stringify({ stops: orderStops(stops).map((stop) => { const copy = { ...stop }; delete copy.managerNotes; return copy; }), vehicleProfile, options });
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `route-${(hash >>> 0).toString(16)}`;
}

export function validateProviderCapabilities(request: Pick<RouteRequest, 'stops' | 'vehicleProfile' | 'options'>, capabilities: RouteProviderCapabilities): string[] {
  const errors: string[] = [];
  if (request.options.requireHgvRouting && !capabilities.hgvRouting) errors.push('The selected provider does not declare HGV routing support.');
  if (request.options.avoidTolls && !capabilities.avoidTolls) errors.push('The selected provider does not declare toll avoidance support.');
  if (request.options.hazmat && !capabilities.hazmat) errors.push('The selected provider does not declare hazardous-goods support.');
  if (capabilities.waypointLimit !== null && request.stops.length > capabilities.waypointLimit) errors.push(`The selected provider accepts at most ${capabilities.waypointLimit} stops.`);
  if (request.vehicleProfile) {
    if (request.vehicleProfile.heightMetres !== null && request.vehicleProfile.heightMetres !== undefined && !capabilities.heightRestrictions) errors.push('Vehicle height is recorded but the selected provider does not declare height restriction support.');
    if (request.vehicleProfile.widthMetres !== null && request.vehicleProfile.widthMetres !== undefined && !capabilities.widthRestrictions) errors.push('Vehicle width is recorded but the selected provider does not declare width restriction support.');
    if (request.vehicleProfile.lengthMetres !== null && request.vehicleProfile.lengthMetres !== undefined && !capabilities.lengthRestrictions) errors.push('Vehicle length is recorded but the selected provider does not declare length restriction support.');
    if (request.vehicleProfile.weightTonnes !== null && request.vehicleProfile.weightTonnes !== undefined && !capabilities.weightRestrictions) errors.push('Vehicle weight is recorded but the selected provider does not declare weight restriction support.');
  }
  return errors;
}
