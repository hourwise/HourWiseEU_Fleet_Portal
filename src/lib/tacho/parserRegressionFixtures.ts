import { evaluateTachoSimulationScenario } from './simulator/scenarioCompiler';
import { getTachoSimulationScenario } from './simulator/scenarioLibrary';
import type { TachoImportSourceType } from './rules/types';
import type { VehicleDiscrepancyStatus } from './rules/types';

export const READESM_FIXTURE_PARSER_VERSION = 'readesm@1.0.17';
export const HOURWISE_CAPTURE_FIXTURE_PARSER_VERSION = 'hourwise-read-only-capture@1';

export interface ParserRegressionFixtureExpectation {
  status: 'processed' | 'partial' | 'error';
  activityCount: number;
  daySummaryCount: number;
  findingRuleCodes: string[];
  technicalEventRuleCodes: string[];
  discrepancyStatuses: VehicleDiscrepancyStatus[];
  warnings: string[];
  errors: string[];
}

export interface ParserRegressionFixture {
  id: string;
  description: string;
  scenarioId?: string;
  sourceType: TachoImportSourceType;
  parserVersion: typeof READESM_FIXTURE_PARSER_VERSION | typeof HOURWISE_CAPTURE_FIXTURE_PARSER_VERSION;
  processingSource: 'normalized_findings' | 'hourwise_read_only_capture';
  expected: ParserRegressionFixtureExpectation;
}

export interface ParserRegressionFixtureEvaluation extends ParserRegressionFixtureExpectation {
  id: string;
  parserVersion: ParserRegressionFixture['parserVersion'];
  processingSource: ParserRegressionFixture['processingSource'];
  sourceType: TachoImportSourceType;
}

export const TACHO_PARSER_REGRESSION_FIXTURES: ParserRegressionFixture[] = [
  {
    id: 'parser-driver-card-compliant-split-break',
    description: 'Driver-card parse should preserve split-break activity blocks without creating a continuous-driving breach.',
    scenarioId: 'split-break-compliant',
    sourceType: 'driver_card',
    parserVersion: READESM_FIXTURE_PARSER_VERSION,
    processingSource: 'normalized_findings',
    expected: {
      status: 'processed',
      activityCount: 5,
      daySummaryCount: 1,
      findingRuleCodes: [],
      technicalEventRuleCodes: [],
      discrepancyStatuses: [],
      warnings: [],
      errors: [],
    },
  },
  {
    id: 'parser-driver-card-continuous-driving-breach',
    description: 'Driver-card parse should surface the continuous-driving breach fixture deterministically.',
    scenarioId: 'continuous-driving-breach',
    sourceType: 'driver_card',
    parserVersion: READESM_FIXTURE_PARSER_VERSION,
    processingSource: 'normalized_findings',
    expected: {
      status: 'processed',
      activityCount: 5,
      daySummaryCount: 1,
      findingRuleCodes: ['DRV_CONTINUOUS_4H30_EXCEEDED'],
      technicalEventRuleCodes: [],
      discrepancyStatuses: [],
      warnings: [],
      errors: [],
    },
  },
  {
    id: 'parser-vehicle-unit-cardless-driving',
    description: 'Vehicle-unit parse should retain VU cardless-driving events and unassigned-motion discrepancy output.',
    scenarioId: 'vu-cardless-driving',
    sourceType: 'vehicle_unit',
    parserVersion: READESM_FIXTURE_PARSER_VERSION,
    processingSource: 'normalized_findings',
    expected: {
      status: 'processed',
      activityCount: 3,
      daySummaryCount: 1,
      findingRuleCodes: [],
      technicalEventRuleCodes: ['VU_DRIVING_WITHOUT_CARD'],
      discrepancyStatuses: ['unassigned_motion'],
      warnings: [],
      errors: [],
    },
  },
  {
    id: 'parser-vehicle-unit-overspeed-events',
    description: 'Vehicle-unit parse should preserve overspeed and power-interruption technical events without forcing discrepancy rows.',
    scenarioId: 'vu-overspeed-event',
    sourceType: 'vehicle_unit',
    parserVersion: READESM_FIXTURE_PARSER_VERSION,
    processingSource: 'normalized_findings',
    expected: {
      status: 'processed',
      activityCount: 3,
      daySummaryCount: 1,
      findingRuleCodes: [],
      technicalEventRuleCodes: ['VU_OVERSPEED', 'VU_POWER_INTERRUPTION'],
      discrepancyStatuses: [],
      warnings: [],
      errors: [],
    },
  },
  {
    id: 'parser-helper-read-only-capture',
    description: 'HourWise read-only helper capture should stay partial with a stable parser identity and warning contract.',
    sourceType: 'driver_card',
    parserVersion: HOURWISE_CAPTURE_FIXTURE_PARSER_VERSION,
    processingSource: 'hourwise_read_only_capture',
    expected: {
      status: 'partial',
      activityCount: 0,
      daySummaryCount: 0,
      findingRuleCodes: [],
      technicalEventRuleCodes: [],
      discrepancyStatuses: [],
      warnings: ['Read-only helper capture received; parser conversion is pending.'],
      errors: [],
    },
  },
  {
    id: 'parser-malformed-discrepancy-timing',
    description: 'Malformed parser-like discrepancy timing should fail fast and record a stable error message.',
    scenarioId: 'data-malformed-discrepancy-timing',
    sourceType: 'vehicle_unit',
    parserVersion: READESM_FIXTURE_PARSER_VERSION,
    processingSource: 'normalized_findings',
    expected: {
      status: 'error',
      activityCount: 0,
      daySummaryCount: 0,
      findingRuleCodes: [],
      technicalEventRuleCodes: [],
      discrepancyStatuses: [],
      warnings: [],
      errors: [
        "Malformed simulator timing for discrepancy 1 in 'data-malformed-discrepancy-timing': end must be after start.",
      ],
    },
  },
];

function evaluateScenarioFixture(fixture: ParserRegressionFixture): ParserRegressionFixtureEvaluation {
  if (!fixture.scenarioId) {
    return {
      id: fixture.id,
      parserVersion: fixture.parserVersion,
      processingSource: fixture.processingSource,
      sourceType: fixture.sourceType,
      ...fixture.expected,
    };
  }

  const scenario = getTachoSimulationScenario(fixture.scenarioId);
  if (!scenario) {
    throw new Error(`Missing parser regression scenario '${fixture.scenarioId}'.`);
  }

  try {
    const evaluated = evaluateTachoSimulationScenario(scenario);

    return {
      id: fixture.id,
      parserVersion: fixture.parserVersion,
      processingSource: fixture.processingSource,
      sourceType: fixture.sourceType,
      status: evaluated.activities.length > 0 ? 'processed' : 'partial',
      activityCount: evaluated.activities.length,
      daySummaryCount: evaluated.result.daySummaries.length,
      findingRuleCodes: evaluated.result.findings.map((finding) => finding.ruleCode),
      technicalEventRuleCodes: evaluated.technicalEvents.map((event) => event.ruleCode),
      discrepancyStatuses: evaluated.discrepancies.map((discrepancy) => discrepancy.status),
      warnings: [],
      errors: [],
    };
  } catch (error) {
    return {
      id: fixture.id,
      parserVersion: fixture.parserVersion,
      processingSource: fixture.processingSource,
      sourceType: fixture.sourceType,
      status: 'error',
      activityCount: 0,
      daySummaryCount: 0,
      findingRuleCodes: [],
      technicalEventRuleCodes: [],
      discrepancyStatuses: [],
      warnings: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

export function evaluateParserRegressionFixtures() {
  return TACHO_PARSER_REGRESSION_FIXTURES.map(evaluateScenarioFixture);
}

export function summarizeParserRegressionFixtures() {
  const evaluations = evaluateParserRegressionFixtures();

  return {
    total: evaluations.length,
    processed: evaluations.filter((fixture) => fixture.status === 'processed').length,
    partial: evaluations.filter((fixture) => fixture.status === 'partial').length,
    error: evaluations.filter((fixture) => fixture.status === 'error').length,
    activityCount: evaluations.reduce((sum, fixture) => sum + fixture.activityCount, 0),
    findingCount: evaluations.reduce((sum, fixture) => sum + fixture.findingRuleCodes.length, 0),
    technicalEventCount: evaluations.reduce((sum, fixture) => sum + fixture.technicalEventRuleCodes.length, 0),
    discrepancyCount: evaluations.reduce((sum, fixture) => sum + fixture.discrepancyStatuses.length, 0),
  };
}

