import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getTimelineSourceDefinition, resolveOperationalTimelineLink, TIMELINE_SOURCE_DEFINITIONS } from './operationalTimeline';

const projectionSql = readFileSync(new URL('../../supabase/migrations/20260820212800_batch17_timeline_source_registry.sql', import.meta.url), 'utf8');

describe('Batch 18 timeline source contracts', () => {
  it('registers every projected database source with a typed privacy/navigation definition', () => {
    const projectedSources = [...projectionSql.matchAll(/'([a-z_]+)' as source_system/g)].map((match) => match[1]);
    expect(new Set(projectedSources)).toEqual(new Set(TIMELINE_SOURCE_DEFINITIONS.map((definition) => definition.sourceType)));
    expect(TIMELINE_SOURCE_DEFINITIONS.every((definition) => definition.privacyRules.includes('storage_path') && definition.supportedRelationships.includes('jobAssignmentId'))).toBe(true);
  });

  it('uses a safe null fallback and never accepts an arbitrary URL', () => {
    expect(resolveOperationalTimelineLink({ sourceSystem: 'unknown_source', category: 'job', entityType: 'job_assignment' })).toBeNull();
    expect(getTimelineSourceDefinition('unknown_source')).toBeNull();
    expect(resolveOperationalTimelineLink({ sourceSystem: 'job_evidence', category: 'pod', entityType: 'job_assignment' })).toBe('/dashboard?workspace=people&people=jobs');
  });

  it('keeps raw evidence, identity, and private note fields out of the registered privacy contract', () => {
    const definition = getTimelineSourceDefinition('job_evidence');
    expect(definition?.privacyRules).toEqual(expect.arrayContaining(['storage_bucket', 'storage_path', 'metadata', 'review_notes', 'email', 'phone', 'licence_number']));
    expect(projectionSql).not.toContain("'storage_path' as");
    expect(projectionSql).not.toContain("'review_notes' as");
  });
});
