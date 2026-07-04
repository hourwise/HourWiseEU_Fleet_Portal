import { describe, expect, it } from 'vitest';

import {
  evaluateParserRegressionFixtures,
  HOURWISE_CAPTURE_FIXTURE_PARSER_VERSION,
  READESM_FIXTURE_PARSER_VERSION,
  summarizeParserRegressionFixtures,
  TACHO_PARSER_REGRESSION_FIXTURES,
} from './parserRegressionFixtures';

describe('TACHO_PARSER_REGRESSION_FIXTURES', () => {
  it('keeps a stable parser fixture inventory', () => {
    expect(TACHO_PARSER_REGRESSION_FIXTURES.map((fixture) => fixture.id)).toEqual([
      'parser-driver-card-compliant-split-break',
      'parser-driver-card-continuous-driving-breach',
      'parser-vehicle-unit-cardless-driving',
      'parser-vehicle-unit-overspeed-events',
      'parser-helper-read-only-capture',
      'parser-malformed-discrepancy-timing',
    ]);
  });

  it('locks parser source and version identity for each fixture family', () => {
    const evaluations = evaluateParserRegressionFixtures();

    expect(evaluations.filter((fixture) => fixture.processingSource === 'normalized_findings')).toHaveLength(5);
    expect(evaluations.filter((fixture) => fixture.processingSource === 'hourwise_read_only_capture')).toHaveLength(1);
    expect(new Set(evaluations.filter((fixture) => fixture.processingSource === 'normalized_findings').map((fixture) => fixture.parserVersion))).toEqual(
      new Set([READESM_FIXTURE_PARSER_VERSION])
    );
    expect(new Set(evaluations.filter((fixture) => fixture.processingSource === 'hourwise_read_only_capture').map((fixture) => fixture.parserVersion))).toEqual(
      new Set([HOURWISE_CAPTURE_FIXTURE_PARSER_VERSION])
    );
  });

  it('matches expected parser outcomes, counts, warnings, and errors', () => {
    const evaluations = evaluateParserRegressionFixtures();

    expect(evaluations).toEqual(
      TACHO_PARSER_REGRESSION_FIXTURES.map((fixture) => ({
        id: fixture.id,
        parserVersion: fixture.parserVersion,
        processingSource: fixture.processingSource,
        sourceType: fixture.sourceType,
        ...fixture.expected,
      }))
    );
  });

  it('produces a stable parser regression summary', () => {
    expect(summarizeParserRegressionFixtures()).toEqual({
      total: 6,
      processed: 4,
      partial: 1,
      error: 1,
      activityCount: 16,
      findingCount: 1,
      technicalEventCount: 3,
      discrepancyCount: 1,
    });
  });
});

