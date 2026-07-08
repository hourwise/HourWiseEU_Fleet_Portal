import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

const migration = readRepoFile('supabase/migrations/20260705170000_add_security_permission_foundation.sql');
const normalizedMigration = migration.toLowerCase();

const securityTables = [
  'security_roles',
  'security_permissions',
  'security_role_permissions',
  'security_role_assignments',
  'security_permission_audit_events',
];

const requiredPermissions = [
  'administration.membership.admin',
  'administration.role.admin',
  'drivers.profile.read',
  'drivers.profile.update',
  'drivers.profile.archive',
  'drivers.own_profile.read',
  'drivers.own_profile.update',
  'vehicles.record.read',
  'vehicles.record.create',
  'vehicles.record.update',
  'vehicles.record.archive',
  'tachograph.import.create',
  'tachograph.import.read',
  'tachograph.import.update',
  'tachograph.import.archive',
  'tachograph.raw_file.read',
  'tachograph.raw_file.export',
  'tachograph.processing.run',
  'compliance.timeline.read',
  'compliance.finding.review',
  'compliance.finding.acknowledge',
  'reporting.report.read',
  'reporting.report.export',
  'documents.record.read',
  'documents.record.create',
  'documents.record.update',
  'documents.record.archive',
  'messaging.thread.read',
  'messaging.message.create',
  'atlas.conversation.create',
  'atlas.fleet_summary.read',
  'support.session.admin',
];

describe('SEC-007 additive permission foundation migration', () => {
  it('creates all additive security foundation tables', () => {
    for (const tableName of securityTables) {
      expect(normalizedMigration).toContain(`create table if not exists public.${tableName}`);
    }

    expect(normalizedMigration).toContain('create or replace view public.organisation_memberships_v');
    expect(normalizedMigration).toContain('with (security_invoker = true)');
  });

  it('enables RLS on every new security table', () => {
    for (const tableName of securityTables) {
      expect(normalizedMigration).toContain(`alter table public.${tableName} enable row level security`);
    }
  });

  it('adds security-definer helper functions with fixed search paths', () => {
    const helperFunctions = [
      'current_actor_company_id',
      'current_actor_legacy_role',
      'actor_has_permission',
      'record_security_event',
      'actor_can_access_driver',
      'actor_can_access_vehicle',
      'actor_can_export',
    ];

    for (const functionName of helperFunctions) {
      expect(normalizedMigration).toContain(`create or replace function public.${functionName}`);
    }

    expect(normalizedMigration.match(/security definer/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
    expect(normalizedMigration.match(/set search_path = public, pg_temp/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
  });

  it('seeds the documented role and permission catalogues', () => {
    for (const roleKey of [
      'organisation_owner',
      'operations_director',
      'regional_manager',
      'site_manager',
      'planner',
      'workshop_manager',
      'fleet_administrator',
      'driver',
      'platform_admin',
      'system_job',
    ]) {
      expect(migration).toContain(`'${roleKey}'`);
    }

    for (const permissionKey of requiredPermissions) {
      expect(migration).toContain(`'${permissionKey}'`);
    }
  });

  it('keeps export, role-admin, support, and Atlas fleet summary denied by default for fleet administrators', () => {
    const deniedFleetAdministratorPermissions = [
      'tachograph.raw_file.export',
      'reporting.report.export',
      'administration.role.admin',
      'support.session.admin',
      'atlas.fleet_summary.read',
    ];

    for (const permissionKey of deniedFleetAdministratorPermissions) {
      expect(migration).not.toContain(`('fleet_administrator', '${permissionKey}'`);
    }

    expect(migration).toContain(`('fleet_administrator', 'reporting.report.read', 'allow', 'organisation')`);
  });

  it('backfills only active legacy manager and driver profiles with company scope', () => {
    expect(normalizedMigration).toContain('from public.profiles p');
    expect(normalizedMigration).toContain("when 'manager' then 'fleet_administrator'");
    expect(normalizedMigration).toContain("when 'driver' then 'driver'");
    expect(normalizedMigration).toContain('p.company_id is not null');
    expect(normalizedMigration).toContain("p.role in ('manager', 'driver')");
    expect(normalizedMigration).toContain('coalesce(p.is_active, true) = true');
    expect(normalizedMigration).toContain("'legacy_profile_backfill'::text as source");
  });

  it('fails closed for site scope until site foundation exists', () => {
    expect(normalizedMigration).toContain('p_site_id is null');
    expect(normalizedMigration).toContain('scope_level = \'organisation\'');
    expect(normalizedMigration).toMatch(/scope_level\s*=\s*'organisation'\s+and\s+site_id\s+is\s+null/i);
    expect(normalizedMigration).toContain('constraint security_role_assignments_org_scope_no_site_check');
    expect(normalizedMigration).not.toMatch(/create policy [\s\S]*site_id\s*=/i);
  });

  it('revokes anonymous/direct write access to sensitive security tables', () => {
    expect(normalizedMigration).toContain('revoke all on table public.security_role_assignments from anon');
    expect(normalizedMigration).toContain('revoke all on table public.security_role_assignments from public');
    expect(normalizedMigration).toContain('revoke all on table public.security_permission_audit_events from anon');
    expect(normalizedMigration).toContain('revoke all on table public.security_permission_audit_events from public');
    expect(normalizedMigration).toContain('revoke all on table public.security_permission_audit_events from authenticated');
    expect(normalizedMigration).toContain('revoke insert, update, delete on table public.security_role_assignments from authenticated');
    expect(normalizedMigration).toContain('revoke all on function public.record_security_event');
    expect(normalizedMigration).not.toMatch(/grant\s+(insert|update|delete|all)[\s\S]*security_permission_audit_events[\s\S]*to\s+authenticated/i);
    expect(normalizedMigration).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.record_security_event[\s\S]*to\s+authenticated/i);
  });

  it('does not make destructive tenant/model changes', () => {
    expect(normalizedMigration).not.toMatch(/drop\s+table\s+(if\s+exists\s+)?public\.profiles/i);
    expect(normalizedMigration).not.toMatch(/alter\s+table\s+public\.profiles\s+drop\s+column\s+role/i);
    expect(normalizedMigration).not.toMatch(/rename\s+column\s+company_id/i);
    expect(normalizedMigration).not.toMatch(/add\s+column\s+(if\s+not\s+exists\s+)?organisation_id/i);
    expect(normalizedMigration).not.toMatch(/drop\s+policy[\s\S]*on\s+public\.(profiles|tachograph_files|timeline_events|driver_documents|vehicle_documents)/i);
  });
});
