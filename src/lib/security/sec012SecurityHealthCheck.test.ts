import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

const sql = readRepoFile('docs/sec-012-rbac-security-health-check.sql');
const normalizedSql = sql.toLowerCase();

describe('SEC-012 RBAC security health-check SQL pack', () => {
  it('covers catalogue, grants, denied defaults, and assignment consistency', () => {
    for (const checkName of [
      'sec012_catalog_counts',
      'sec012_role_grant_counts',
      'sec012_denied_default_fleet_administrator_grants',
      'sec012_active_assignment_counts',
      'sec012_active_legacy_profiles_without_assignment',
      'sec012_orphaned_legacy_backfill_assignments',
      'sec012_assignment_scope_summary',
      'sec012_compatibility_view_counts',
      'sec012_export_permission_metadata',
    ]) {
      expect(sql).toContain(checkName);
    }

    expect(normalizedSql).toContain('security_role_count');
    expect(normalizedSql).toContain('security_permission_count');
    expect(normalizedSql).toContain("role_key = 'fleet_administrator'");
    expect(sql).toContain('tachograph.raw_file.export');
    expect(sql).toContain('reporting.report.export');
    expect(sql).toContain('support.session.admin');
    expect(sql).toContain('atlas.fleet_summary.read');
  });

  it('keeps SEC-010 shadow observation in the dashboard pack', () => {
    expect(sql).toContain('sec012_sec010_shadow_summary');
    expect(sql).toContain('shadow_permission_mismatch');
    expect(sql).toContain('tachograph.import.update');
    expect(sql).toContain('mismatch_count_24h');
    expect(sql).toContain('legacy_allowed');
    expect(sql).toContain('permission_allowed');
  });

  it('includes deployed function markers and migration-history note', () => {
    expect(sql).toContain('sec012_deployed_function_markers');
    expect(sql).toContain('pair_tacho_card_import_to_driver(uuid,uuid,uuid,text)');
    expect(sql).toContain('patch_tachograph_import_metadata(uuid,jsonb)');
    expect(sql).toContain('timeline_generations');
    expect(sql).toContain('timeline_events');
    expect(sql).toContain('sec012_migration_history_note');
    expect(sql).toContain('20260708120000');
  });

  it('does not perform mutating database operations', () => {
    expect(normalizedSql).not.toMatch(/\binsert\s+into\b/);
    expect(normalizedSql).not.toMatch(/\bupdate\s+public\./);
    expect(normalizedSql).not.toMatch(/\bdelete\s+from\b/);
    expect(normalizedSql).not.toMatch(/\bdrop\s+/);
    expect(normalizedSql).not.toMatch(/\bcreate\s+(table|function|view|policy|trigger)\b/);
    expect(normalizedSql).not.toMatch(/\balter\s+/);
  });
});
