import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveOperationalTimelineLink, TIMELINE_SOURCE_LINK_REGISTRY } from './operationalTimeline';

const podMigration = readFileSync('supabase/migrations/20260820212642_batch17_pod_drilldown_timeline_links.sql', 'utf8');
const timelineMigration = readFileSync('supabase/migrations/20260820212800_batch17_timeline_source_registry.sql', 'utf8');

describe('Batch 17 security, POD, and timeline contracts', () => {
  it('keeps the POD drill-down manager-scoped, bounded, and free of storage internals', () => {
    expect(podMigration).toContain('create or replace function public.list_pod_reconciliation_drilldown');
    expect(podMigration).toContain('set search_path = public, pg_temp');
    expect(podMigration).toContain('result_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100)');
    expect(podMigration).toContain("grant execute on function public.list_pod_reconciliation_drilldown(text, integer) to authenticated");
    expect(podMigration).toContain("intent.company_id = actor_company_id");
    expect(podMigration).not.toContain("'storagePath'");
    expect(podMigration).not.toContain("'storage_bucket'");
    expect(podMigration).not.toContain("'original_file_name'");
    expect(podMigration).not.toContain("'uploaded_by'");
  });

  it('uses typed source-link rules with a safe null fallback', () => {
    expect(TIMELINE_SOURCE_LINK_REGISTRY.length).toBeGreaterThan(0);
    expect(resolveOperationalTimelineLink({ sourceSystem: 'job_evidence', category: 'pod' })).toBe('/dashboard?workspace=people&people=jobs');
    expect(resolveOperationalTimelineLink({ sourceSystem: 'operational_task_handlings', category: 'task', entityType: 'driver_compliance' })).toBe('/dashboard?workspace=people&people=drivers');
    expect(resolveOperationalTimelineLink({ sourceSystem: 'unrecognised_source', category: 'pod' })).toBeNull();
  });

  it('returns relationship metadata and navigation keys, never database-generated URLs', () => {
    expect(timelineMigration).toContain("'relationships'");
    expect(timelineMigration).toContain("'navigationKey'");
    expect(timelineMigration).toContain('jsonb_strip_nulls');
    expect(timelineMigration).not.toContain("'navigationTarget'");
    expect(timelineMigration).toContain('Job ');
    expect(timelineMigration).toContain('Driver compliance evidence');
  });
});
