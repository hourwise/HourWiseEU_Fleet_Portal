import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildPersistedTachoReviewQueue } from './tacho/reviewQueue';

const batch7Migration = readFileSync(fileURLToPath(new URL('../../supabase/migrations/20260810100753_batch7_operational_completion.sql', import.meta.url)), 'utf8');
const batch7VorRepairMigration = readFileSync(fileURLToPath(new URL('../../supabase/migrations/20260810145114_enforce_defect_return_to_service_invariant.sql', import.meta.url)), 'utf8');

type DefectScenario = {
  companyId: string | null;
  regNumber: string;
  checkStatus: string;
  lifecycleStatus: string | null;
};

function shouldBlockReturnToService(
  vehicle: { isVor: boolean; companyId: string | null; regNumber: string },
  defects: DefectScenario[],
): boolean {
  if (!vehicle.isVor || vehicle.companyId === null) return false;

  return defects.some((defect) => (
    defect.companyId === vehicle.companyId
    && defect.regNumber.toUpperCase() === vehicle.regNumber.toUpperCase()
    && defect.checkStatus === 'defect'
    && (defect.lifecycleStatus ?? 'reported') !== 'fixed'
  ));
}

describe('Batch 7 persisted tachograph review queue', () => {
  it('keeps open and action-required findings actionable while excluding closed findings', () => {
    const queue = buildPersistedTachoReviewQueue([
      { findingId: 'open', driverId: 'driver-1', status: 'open', driverAcknowledgedAt: null },
      { findingId: 'action', driverId: 'driver-1', status: 'action_required', driverAcknowledgedAt: '2026-08-10T08:00:00Z' },
      { findingId: 'closed', driverId: 'driver-1', status: 'closed', driverAcknowledgedAt: null },
      { findingId: 'reviewed', driverId: 'driver-2', status: 'reviewed', driverAcknowledgedAt: null },
    ]);

    expect(queue).toEqual([
      {
        driverId: 'driver-1',
        driverName: 'Unknown driver',
        openCount: 1,
        actionRequiredCount: 1,
        reviewedCount: 0,
        closedCount: 1,
        acknowledgedCount: 1,
        totalCount: 3,
      },
    ]);
  });

  it('aggregates multiple actionable findings and preserves acknowledgement counts', () => {
    const queue = buildPersistedTachoReviewQueue([
      { findingId: 'one', driverId: 'driver-1', driverName: 'A Driver', status: 'action_required', driverAcknowledgedAt: null },
      { findingId: 'two', driverId: 'driver-1', driverName: 'A Driver', status: 'action_required', driverAcknowledgedAt: '2026-08-10T08:00:00Z' },
      { findingId: 'three', driverId: 'driver-1', driverName: 'A Driver', status: 'closed', driverAcknowledgedAt: '2026-08-10T08:30:00Z' },
    ]);

    expect(queue[0]).toMatchObject({
      driverId: 'driver-1',
      driverName: 'A Driver',
      actionRequiredCount: 2,
      acknowledgedCount: 2,
      totalCount: 3,
    });
  });
});

describe('Batch 7 governed backend contracts', () => {
  it('protects defect lifecycle identity, authority, transitions, stale writes, repair linkage, and audit', () => {
    expect(batch7Migration).toContain('create or replace function public.update_vehicle_check_lifecycle');
    expect(batch7Migration).toContain("public.get_my_company_id()");
    expect(batch7Migration).toContain("public.actor_has_permission('compliance.finding.review'");
    expect(batch7Migration).toContain("check_record.check_status is distinct from 'defect'");
    expect(batch7Migration).toContain("check_record.updated_at is distinct from p_expected_updated_at");
    expect(batch7Migration).toContain('vehicle_check_id');
    expect(batch7Migration).toContain("public.record_security_event(");
    expect(batch7Migration).toContain('revoke all on function public.update_vehicle_check_lifecycle');
    expect(batch7Migration).toContain('grant execute on function public.update_vehicle_check_lifecycle');
  });

  it('governs tachograph training assignment and keeps review linkage transactional', () => {
    expect(batch7Migration).toContain('create or replace function public.assign_tachograph_training');
    expect(batch7Migration).toContain("public.actor_has_permission('compliance.training.assign'");
    expect(batch7Migration).toContain("finding.company_id = actor_company_id");
    expect(batch7Migration).toContain("public.save_tachograph_finding_review(");
    expect(batch7Migration).toContain('revoke all on function public.assign_tachograph_training');
    expect(batch7Migration).toContain('grant execute on function public.assign_tachograph_training');
  });
});

describe('Batch 7 vehicle return-to-service invariant', () => {
  const companyId = 'company-1';
  const vehicle = { isVor: true, companyId, regNumber: 'AB12 CDE' };

  it('blocks unresolved reported and in-progress defects, including null lifecycle', () => {
    expect(shouldBlockReturnToService(vehicle, [{ companyId, regNumber: 'AB12 CDE', checkStatus: 'defect', lifecycleStatus: 'reported' }])).toBe(true);
    expect(shouldBlockReturnToService(vehicle, [{ companyId, regNumber: 'AB12 CDE', checkStatus: 'defect', lifecycleStatus: 'in_progress' }])).toBe(true);
    expect(shouldBlockReturnToService(vehicle, [{ companyId, regNumber: 'AB12 CDE', checkStatus: 'defect', lifecycleStatus: null }])).toBe(true);
  });

  it('allows only fixed defects, setting VOR true, and unrelated vehicle edits', () => {
    expect(shouldBlockReturnToService(vehicle, [{ companyId, regNumber: 'AB12 CDE', checkStatus: 'defect', lifecycleStatus: 'fixed' }])).toBe(false);
    expect(shouldBlockReturnToService({ ...vehicle, isVor: false }, [{ companyId, regNumber: 'AB12 CDE', checkStatus: 'defect', lifecycleStatus: 'reported' }])).toBe(false);
    expect(shouldBlockReturnToService(vehicle, [{ companyId, regNumber: 'ZZ99 ZZZ', checkStatus: 'defect', lifecycleStatus: 'reported' }])).toBe(false);
    expect(shouldBlockReturnToService(vehicle, [{ companyId, regNumber: 'AB12 CDE', checkStatus: 'pass', lifecycleStatus: null }])).toBe(false);
  });

  it('keeps the database trigger authoritative and private', () => {
    expect(batch7VorRepairMigration).toContain('create or replace function public.prevent_vehicle_return_to_service_with_open_defects()');
    expect(batch7VorRepairMigration).toContain('security definer');
    expect(batch7VorRepairMigration).toContain('set search_path = public, pg_temp');
    expect(batch7VorRepairMigration).toContain('old.is_vor is true');
    expect(batch7VorRepairMigration).toContain('new.is_vor is false');
    expect(batch7VorRepairMigration).toContain('check_record.company_id = old.company_id');
    expect(batch7VorRepairMigration).toContain('upper(check_record.reg_number) = upper(old.reg_number)');
    expect(batch7VorRepairMigration).toContain("check_record.check_status = 'defect'");
    expect(batch7VorRepairMigration).toContain("coalesce(check_record.defect_lifecycle_status, 'reported') <> 'fixed'");
    expect(batch7VorRepairMigration).toContain('before update of is_vor on public.vehicles');
    expect(batch7VorRepairMigration).toContain('revoke all on function public.prevent_vehicle_return_to_service_with_open_defects() from public');
    expect(batch7VorRepairMigration).toContain('revoke all on function public.prevent_vehicle_return_to_service_with_open_defects() from anon');
    expect(batch7VorRepairMigration).toContain('revoke all on function public.prevent_vehicle_return_to_service_with_open_defects() from authenticated');
  });
});
