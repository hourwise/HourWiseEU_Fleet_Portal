import type { WorkSession } from '../../compliance';
import { evaluateRawActivityCompliance } from '../rules/engine';
import type {
  RuleActivitySegment,
  TachoFinding,
  VehicleMotionDiscrepancy,
} from '../rules/types';
import type {
  CompiledTachoSimulationScenario,
  SimulatedDiscrepancy,
  SimulatedActivityType,
  TachoSimulationScenario,
} from './types';

function toIsoString(value: string | null | undefined, label: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing simulator timestamp for ${label}.`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid simulator timestamp '${value}' for ${label}.`);
  }
  return parsed.toISOString();
}

function addMinutes(timestamp: string, mins: number) {
  return new Date(new Date(timestamp).getTime() + mins * 60_000).toISOString();
}

function assertChronologicalRange(startTime: string, endTime: string, label: string, allowEqual = false) {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const isInvalid = allowEqual ? endMs < startMs : endMs <= startMs;

  if (isInvalid) {
    throw new Error(`Malformed simulator timing for ${label}: end must be after start.`);
  }
}

function toRuleActivityType(type: SimulatedActivityType): RuleActivitySegment['activityType'] {
  if (type === 'break') {
    return 'rest';
  }

  return type;
}

function compileActivities(scenario: TachoSimulationScenario): RuleActivitySegment[] {
  let cursor = toIsoString(scenario.anchorStart, `scenario '${scenario.id}' anchorStart`);

  return scenario.activities.map((activity, index) => {
    if (!Number.isFinite(activity.durationMins) || activity.durationMins <= 0) {
      throw new Error(`Simulator activity ${index + 1} in '${scenario.id}' must have a positive duration.`);
    }

    const startTime =
      activity.startAt === undefined
        ? cursor
        : toIsoString(activity.startAt, `activity ${index + 1} startAt in '${scenario.id}'`);
    const endTime = addMinutes(startTime, activity.durationMins);
    cursor = endTime;

    return {
      id: `${scenario.id}-${index + 1}-${activity.type}`,
      driverId: activity.driverId === undefined ? scenario.driverId : activity.driverId,
      vehicleId: activity.vehicleId === undefined ? scenario.vehicleId ?? null : activity.vehicleId,
      startTime,
      endTime,
      activityType: toRuleActivityType(activity.type),
      distanceKm: activity.distanceKm ?? null,
      isManualEntry: false,
      source: 'raw_activity',
    };
  });
}

function compileWorkSessions(scenario: TachoSimulationScenario): WorkSession[] {
  return (scenario.workSessions ?? []).map((session, index) => {
    const startTime = toIsoString(session.startAt, `work session ${index + 1} startAt in '${scenario.id}'`);
    const endTime = toIsoString(session.endAt, `work session ${index + 1} endAt in '${scenario.id}'`);
    assertChronologicalRange(startTime, endTime, `work session ${index + 1} in '${scenario.id}'`);

    return {
      start_time: startTime,
      end_time: endTime,
      total_work_minutes: session.total_work_minutes ?? null,
      total_break_minutes: session.total_break_minutes ?? null,
      other_data: session.other_data ?? null,
      id: `${scenario.id}-work-session-${index + 1}`,
    };
  });
}

function compileTechnicalEvents(
  scenario: TachoSimulationScenario
): TachoFinding[] {
  return (scenario.technicalEvents ?? []).map((event, index) => {
    const occurredAt = toIsoString(event.occurredAt, `technical event ${index + 1} occurredAt in '${scenario.id}'`);
    const periodStart = toIsoString(
      event.periodStart ?? event.occurredAt,
      `technical event ${index + 1} periodStart in '${scenario.id}'`
    );
    const periodEnd = toIsoString(
      event.periodEnd ?? event.occurredAt,
      `technical event ${index + 1} periodEnd in '${scenario.id}'`
    );
    assertChronologicalRange(periodStart, periodEnd, `technical event ${index + 1} in '${scenario.id}'`, true);

    return {
      id: `${scenario.id}-technical-event-${index + 1}`,
      driverId: scenario.driverId,
      vehicleId: scenario.vehicleId ?? null,
      source: 'vehicle_unit',
      severity: event.severity,
      status: 'warning',
      ruleCode: event.ruleCode,
      title: event.title,
      summary: event.summary,
      occurredAt,
      periodStart,
      periodEnd,
      legalBasis: event.legalBasis ?? 'Vehicle Unit Event',
      evidenceRefs: [{ kind: 'event', refId: `${scenario.id}-technical-event-${index + 1}`, label: event.title }],
      metadata: event.metadata,
    };
  });
}

function discrepancyDurationMins(discrepancy: SimulatedDiscrepancy) {
  return Math.max(
    0,
    Math.round(
      (new Date(toIsoString(discrepancy.endAt, 'discrepancy endAt')).getTime() -
        new Date(toIsoString(discrepancy.startAt, 'discrepancy startAt')).getTime()) /
        60000
    )
  );
}

function compileDiscrepancies(
  scenario: TachoSimulationScenario
): VehicleMotionDiscrepancy[] {
  return (scenario.discrepancies ?? []).map((discrepancy, index) => {
    const startTime = toIsoString(discrepancy.startAt, `discrepancy ${index + 1} startAt in '${scenario.id}'`);
    const endTime = toIsoString(discrepancy.endAt, `discrepancy ${index + 1} endAt in '${scenario.id}'`);
    assertChronologicalRange(startTime, endTime, `discrepancy ${index + 1} in '${scenario.id}'`);

    return {
      id: `${scenario.id}-discrepancy-${index + 1}`,
      date: startTime.slice(0, 10),
      startTime,
      endTime,
      durationMins: discrepancyDurationMins({ ...discrepancy, startAt: startTime, endAt: endTime }),
      severity: discrepancy.severity,
      status: discrepancy.status,
      summary: discrepancy.summary,
      linkedDriverName: discrepancy.linkedDriverName,
      evidenceRefs: [{ kind: 'summary', refId: `${scenario.id}-discrepancy-${index + 1}`, label: discrepancy.status }],
    };
  });
}

export function compileTachoSimulationScenario(
  scenario: TachoSimulationScenario
): CompiledTachoSimulationScenario {
  return {
    scenario,
    activities: compileActivities(scenario),
    workSessions: compileWorkSessions(scenario),
    technicalEvents: compileTechnicalEvents(scenario),
    discrepancies: compileDiscrepancies(scenario),
  };
}

export function evaluateTachoSimulationScenario(scenario: TachoSimulationScenario) {
  const compiled = compileTachoSimulationScenario(scenario);
  const result = evaluateRawActivityCompliance({
    driverId: scenario.driverId,
    activities: compiled.activities.map((activity) => ({
      driver_id: activity.driverId,
      vehicle_id: activity.vehicleId,
      start_time: activity.startTime,
      end_time: activity.endTime,
      activity_type: activity.activityType,
      distance_km: activity.distanceKm ?? undefined,
    })),
    workSessions: compiled.workSessions,
  });

  return {
    ...compiled,
    result,
  };
}
