import { describe, expect, it } from 'vitest';
import { classifyAtlasQuestion } from './atlasQueryRouter';
import { extractAtlasEntities, normalizeAtlasQuestion, resolveAtlasQuestion } from './atlasKnowledge';

describe('Batch19 deterministic Atlas knowledge layer', () => {
  it('normalises UK fleet glossary terms without inference', () => {
    expect(normalizeAtlasQuestion('Show me lorries off-road and delivery notes')).toBe('show me vehicle vor and pod');
  });
  it('returns stable canonical intents and FAQ answers', () => {
    const resolution = resolveAtlasQuestion('What does POD mean?');
    expect(resolution.canonicalIntents).toEqual(['faq_pod']);
    expect(resolution.faqAnswer).toContain('real job assignment');
    expect(classifyAtlasQuestion('What does POD mean?')).toMatchObject({ tier: 0, mode: 'deterministic', canonicalIntent: 'faq_pod' });
  });
  it('extracts operational references and refuses unsafe negated routing', () => {
    const entities = extractAtlasEntities('Why is AB12 CDE and trailer TR-7 blocked for job JOB-42?');
    expect(entities.map((entity) => entity.type)).toEqual(expect.arrayContaining(['vehicle_registration', 'trailer_reference', 'job_reference']));
    expect(resolveAtlasQuestion('Show vehicles not VOR').canonicalIntents).toEqual(['unknown']);
  });
  it('keeps compounds explicit and confidence deterministic', () => {
    const result = resolveAtlasQuestion('What needs attention today and tomorrow?');
    expect(result.canonicalIntents).toEqual(['today_attention', 'tomorrow_conflicts']);
    expect(result.confidenceBand).toBe('medium');
    expect(result.clarification).toContain('more than one');
  });
});
