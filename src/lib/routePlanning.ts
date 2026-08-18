export type RouteStopType = 'pickup' | 'delivery' | 'service' | 'other';
export type RoutePlanState = 'calculated' | 'stale' | 'provider_unavailable' | 'provider_failed' | 'missing_address' | 'restriction_incomplete';

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
  provider: 'unconfigured';
  providerVersion: null;
  stops: PlannedStop[];
  vehicleProfile: VehicleRoutingProfile | null;
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

export function buildRoutePlan(stops: readonly PlannedStop[], vehicleProfile: VehicleRoutingProfile | null): RoutePlan {
  const orderedStops = orderStops(stops);
  const validationError = validateStopOrder(orderedStops);
  if (validationError || orderedStops.length === 0) return { state: 'missing_address', orderedStops, request: null, message: validationError ?? 'Add at least one stop before requesting a route.' };
  if (orderedStops.some((stop) => !stop.addressText.trim())) return { state: 'missing_address', orderedStops, request: null, message: 'A route cannot be requested until every stop has a location.' };
  if (!vehicleProfile) return { state: 'restriction_incomplete', orderedStops, request: null, message: 'Vehicle routing restrictions are incomplete because no vehicle profile is attached.' };
  const routeVersion = createRouteVersion(orderedStops, vehicleProfile);
  return {
    state: 'provider_unavailable',
    orderedStops,
    request: { provider: 'unconfigured', providerVersion: null, stops: orderedStops, vehicleProfile, routeVersion },
    message: 'No road-routing provider is configured. Distance, duration, and ETA are unavailable.'
  };
}

export function isRouteEstimateStale(currentVersion: string, estimateVersion: string | null): boolean {
  return !estimateVersion || currentVersion !== estimateVersion;
}

export function createRouteVersion(stops: readonly PlannedStop[], vehicleProfile: VehicleRoutingProfile | null): string {
  const payload = JSON.stringify({ stops: orderStops(stops).map((stop) => { const copy = { ...stop }; delete copy.managerNotes; return copy; }), vehicleProfile });
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `route-${(hash >>> 0).toString(16)}`;
}
