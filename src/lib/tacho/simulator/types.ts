import type { WorkSession } from '../../compliance';
import type {
  RuleActivitySegment,
  TachoFinding,
  VehicleMotionDiscrepancy,
} from '../rules/types';

export type SimulatedActivityType =
  | 'driving'
  | 'work'
  | 'poa'
  | 'rest'
  | 'break';

export interface SimulatedActivityBlock {
  type: SimulatedActivityType;
  durationMins: number;
  startAt?: string;
  driverId?: string | null;
  vehicleId?: string | null;
  distanceKm?: number | null;
  label?: string;
}

export interface SimulatedWorkSession extends Omit<WorkSession, 'start_time' | 'end_time'> {
  startAt: string;
  endAt: string;
}

export interface SimulatedTechnicalEvent {
  ruleCode: string;
  title: string;
  summary: string;
  severity: TachoFinding['severity'];
  occurredAt: string;
  periodStart?: string;
  periodEnd?: string;
  legalBasis?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface SimulatedDiscrepancy {
  startAt: string;
  endAt: string;
  severity: VehicleMotionDiscrepancy['severity'];
  status: VehicleMotionDiscrepancy['status'];
  summary: string;
  linkedDriverName?: string;
}

export interface TachoSimulationScenario {
  id: string;
  title: string;
  description: string;
  driverId: string;
  driverLabels?: Record<string, string>;
  vehicleId?: string | null;
  source?: 'driver_card' | 'vehicle_unit';
  anchorStart: string;
  activities: SimulatedActivityBlock[];
  workSessions?: SimulatedWorkSession[];
  technicalEvents?: SimulatedTechnicalEvent[];
  discrepancies?: SimulatedDiscrepancy[];
}

export interface CompiledTachoSimulationScenario {
  scenario: TachoSimulationScenario;
  activities: RuleActivitySegment[];
  workSessions: WorkSession[];
  technicalEvents: TachoFinding[];
  discrepancies: VehicleMotionDiscrepancy[];
}
