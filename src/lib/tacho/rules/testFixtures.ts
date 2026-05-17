import type { RuleActivitySegment } from './types';

type FixtureActivityInput = {
  startTime: string;
  endTime: string;
  activityType: RuleActivitySegment['activityType'];
  driverId?: string | null;
  vehicleId?: string | null;
  distanceKm?: number | null;
  isManualEntry?: boolean;
};

export function makeRuleActivity(input: FixtureActivityInput): RuleActivitySegment {
  return {
    id: `${input.activityType}-${input.startTime}`,
    driverId: input.driverId ?? 'driver-1',
    vehicleId: input.vehicleId ?? 'vehicle-1',
    startTime: input.startTime,
    endTime: input.endTime,
    activityType: input.activityType,
    distanceKm: input.distanceKm ?? null,
    isManualEntry: input.isManualEntry ?? false,
    source: 'raw_activity',
  };
}

export function buildDayActivities(
  date: string,
  blocks: Array<{
    start: string;
    end: string;
    activityType: RuleActivitySegment['activityType'];
  }>
) {
  return blocks.map((block) =>
    makeRuleActivity({
      startTime: `${date}T${block.start}:00.000Z`,
      endTime: `${date}T${block.end}:00.000Z`,
      activityType: block.activityType,
    })
  );
}
