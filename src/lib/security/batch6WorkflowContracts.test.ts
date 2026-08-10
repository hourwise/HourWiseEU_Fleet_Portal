import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const driverMigration = read('supabase/migrations/20260810084404_20260810083612_govern_driver_profile_updates.sql');
const tachoMigration = read('supabase/migrations/20260810084712_20260810083613_restrict_tachograph_review_rpc_execution.sql');
const tachoScopeMigration = read('supabase/migrations/20260810084903_20260810084741_harden_tachograph_read_rpc_scopes.sql');
const driverDetails = read('src/components/manager/DriverDetailsModal.tsx');
const driverOnboarding = read('src/components/manager/DriverOnboardingModal.tsx');
const dashboardRoute = read('src/lib/dashboardRoute.ts');
const managerDashboard = read('src/components/manager/ManagerDashboard.tsx');
const reports = read('src/components/manager/ReportsAndExports.tsx');
const expenseApproval = read('src/components/manager/ExpenseApproval.tsx');

describe('Batch 6 driver profile workflow contracts', () => {
  it('uses an authenticated, same-company, permission-gated allowlist RPC', () => {
    expect(driverMigration).toContain('create or replace function public.update_driver_profile');
    expect(driverMigration).toContain('actor_id uuid := auth.uid()');
    expect(driverMigration).toContain('where p.id = actor_id');
    expect(driverMigration).toContain('and p.company_id = actor_company_id');
    expect(driverMigration).toContain("public.actor_has_permission('drivers.profile.update'");
    expect(driverMigration).toContain('jsonb_object_keys(p_patch)');
    expect(driverMigration).toContain('set search_path = public, pg_temp');
    expect(driverMigration).toContain('p_expected_updated_at');
    expect(driverMigration).toContain('record_security_event');
    expect(driverMigration).toContain('revoke all on function public.update_driver_profile(uuid, jsonb, timestamptz) from public');
    expect(driverMigration).toContain('revoke all on function public.update_driver_profile(uuid, jsonb, timestamptz) from anon');
    expect(driverMigration).toContain('grant execute on function public.update_driver_profile(uuid, jsonb, timestamptz) to authenticated');
    expect(driverMigration).toContain('role');
    expect(driverMigration).toContain('company_id');
    expect(driverMigration).toContain('user_id');
    expect(driverMigration).toContain('is_active');
  });

  it('routes both existing manager edit paths through the governed contract', () => {
    expect(driverDetails).toContain("rpc('update_driver_profile'");
    expect(driverOnboarding).toContain("rpc('update_driver_profile'");
    expect(driverDetails).not.toMatch(/from\('profiles'\)\s*\.update/);
    expect(driverOnboarding).not.toMatch(/from\('profiles'\)\s*\.update/);
    expect(driverDetails).toContain('Account status is protected');
  });
});

describe('Batch 6 tachograph execution contracts', () => {
  it('keeps review writes authenticated, scoped, audited, and fixed-search-path', () => {
    for (const functionName of ['save_tachograph_finding_review', 'acknowledge_tachograph_finding_review']) {
      expect(tachoMigration).toContain(`create or replace function public.${functionName}`);
    }
    expect(tachoMigration).toContain("public.get_my_role() is distinct from 'manager'");
    expect(tachoMigration).toContain("public.actor_has_permission('compliance.finding.review'");
    expect(tachoMigration).toContain("public.get_my_role() is distinct from 'driver'");
    expect(tachoMigration).toContain('review_record.driver_id is distinct from auth.uid()');
    expect(tachoMigration).toContain("public.actor_has_permission('compliance.finding.acknowledge'");
    expect(tachoMigration).toContain('tachograph_finding_review_events');
    expect(tachoMigration).toContain('set search_path = public, pg_temp');
  });

  it('revokes public and anonymous execution from review and related authority-parameterized reads', () => {
    const signatures = [
      'save_tachograph_finding_review(uuid, uuid, text, text, text, uuid)',
      'acknowledge_tachograph_finding_review(uuid, text)',
      'get_company_tacho_signals(uuid, integer)',
      'get_driver_tacho_analysis_bundle(uuid, uuid, text)',
      'get_driver_timeline_bundle(uuid, uuid, text)',
      'get_import_timeline_bundle(uuid, uuid)',
      'get_tacho_import_bundle(uuid, uuid)',
      'get_vehicle_timeline_bundle(uuid, uuid, text)',
      'get_vehicle_unit_analysis_bundle(uuid, uuid, text)',
    ];
    for (const signature of signatures) {
      expect(tachoMigration).toContain(`revoke all on function public.${signature} from public`);
      expect(tachoMigration).toContain(`revoke all on function public.${signature} from anon`);
      expect(tachoMigration).toContain(`grant execute on function public.${signature} to authenticated`);
    }
  });

  it('puts related SECURITY DEFINER readers behind authenticated same-company wrappers', () => {
    for (const functionName of [
      'get_company_tacho_signals',
      'get_driver_tacho_analysis_bundle',
      'get_driver_timeline_bundle',
      'get_import_timeline_bundle',
      'get_tacho_import_bundle',
      'get_vehicle_timeline_bundle',
      'get_vehicle_unit_analysis_bundle',
    ]) {
      expect(tachoScopeMigration).toContain(`create or replace function public.${functionName}`);
      expect(tachoScopeMigration).toContain("public.get_my_company_id()");
      expect(tachoScopeMigration).toContain("public.actor_has_permission('compliance.timeline.read'");
    }
    expect(tachoScopeMigration).toContain('set search_path = public, pg_temp');
    expect(tachoScopeMigration).toContain('set schema private');
  });
});

describe('Batch 6 FIN-002 product contracts', () => {
  it('exposes Finance navigation and the authoritative review component', () => {
    expect(dashboardRoute).toContain("'finance'");
    expect(managerDashboard).toContain("import('./ExpenseApproval')");
    expect(managerDashboard).toContain("id: 'finance'");
    expect(managerDashboard).toContain("activeWorkspace === 'finance'");
    expect(expenseApproval).toContain("rpc('review_expense'");
    expect(expenseApproval).toContain('return filter === \'pending\' ? !review');
  });

  it('makes report history consume review decisions and removes the placeholder mount', () => {
    expect(reports).toContain("from('expense_reviews')");
    expect(reports).toContain('r.review?.decision ?? \'Pending\'');
    expect(reports).toContain("r.review?.decision ?? 'pending'");
    expect(reports).not.toContain('<ExpenseApprovalsCard />');
    expect(reports).not.toContain('Generate CSV exports, approve expenses');
  });
});
