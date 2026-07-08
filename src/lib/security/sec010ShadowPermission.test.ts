import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

const migration = readRepoFile(
  'supabase/migrations/20260708120000_shadow_permission_patch_tachograph_import_metadata.sql',
);
const normalizedMigration = migration.toLowerCase();

describe('SEC-010 patch_tachograph_import_metadata shadow permission comparison', () => {
  it('replaces the RPC without removing security-definer hardening', () => {
    expect(normalizedMigration).toContain('create or replace function public.patch_tachograph_import_metadata');
    expect(normalizedMigration).toContain('security definer');
    expect(normalizedMigration).toContain('set search_path = public, pg_temp');
    expect(normalizedMigration).toContain(
      'grant execute on function public.patch_tachograph_import_metadata(uuid, jsonb) to authenticated',
    );
  });

  it('keeps the legacy manager/company enforcement path authoritative', () => {
    expect(normalizedMigration).toContain("actor_role <> 'manager'");
    expect(normalizedMigration).toContain('raise exception \'only managers can patch tachograph import metadata\'');
    expect(normalizedMigration).toContain('and company_id = actor_company_id');
    expect(normalizedMigration).toContain("raise exception 'tachograph import not found for current company'");
    expect(normalizedMigration).not.toMatch(/if\s+not\s+permission_allowed\s+then\s+raise\s+exception/i);
    expect(normalizedMigration).not.toMatch(/and\s+permission_allowed/);
  });

  it('compares the legacy decision to the additive permission resolver in shadow mode', () => {
    expect(normalizedMigration).toContain("actor_role = 'manager'");
    expect(normalizedMigration).toContain('target_company_id = actor_company_id');
    expect(normalizedMigration).toContain(
      "public.actor_has_permission('tachograph.import.update', target_company_id, null)",
    );
    expect(normalizedMigration).toContain('legacy_allowed is distinct from permission_allowed');
  });

  it('audits only shadow mismatches without failing the runtime RPC', () => {
    expect(normalizedMigration).toContain('public.record_security_event');
    expect(normalizedMigration).toContain("'shadow_permission_mismatch'");
    expect(normalizedMigration).toContain("'shadow_comparison', 'patch_tachograph_import_metadata'");
    expect(normalizedMigration).toContain("'legacy_allowed', legacy_allowed");
    expect(normalizedMigration).toContain("'permission_allowed', permission_allowed");
    expect(normalizedMigration).toContain('exception');
    expect(normalizedMigration).toContain('raise warning');
  });
});
