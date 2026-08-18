import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260814120000_batch10_governed_operations.sql', 'utf8');
const lifecycleMigration = readFileSync('supabase/migrations/20260814123000_batch10_job_execution_lifecycle.sql', 'utf8');
const driverJobs = readFileSync('src/lib/driverJobs.ts', 'utf8');
const jobPlanner = readFileSync('src/components/manager/JobPlanner.tsx', 'utf8');
const shiftPlanner = readFileSync('src/components/manager/ShiftPlanner.tsx', 'utf8');
const assetReadinessLoad = readFileSync('src/lib/assetReadinessLoad.ts', 'utf8');

describe('Batch 10 governed operations contracts', () => {
  it('enforces canonical asset policy, override governance, and assignment triggers', () => {
    expect(migration).toContain('get_asset_assignment_policy');
    expect(migration).toContain('vehicle_record.is_vor');
    expect(migration).toContain('unresolved_safety_defect');
    expect(migration).toContain('operations.asset.override_assignment');
    expect(migration).toContain('length(btrim(reason)) between 20 and 1000');
    expect(migration).toContain('record_security_event');
    expect((migration.match(/Authentication required/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain('enforce_shift_asset_assignment_readiness');
    expect(migration).toContain('enforce_job_asset_assignment_readiness');
    expect(migration).toContain('create_job_assignment_with_asset_guard');
    expect(migration).toContain('update_shift_with_asset_guard');
    expect(migration).toContain('revoke insert, update, delete on public.asset_assignment_overrides');
    expect(migration).toContain('grant select on public.asset_assignment_overrides to authenticated');
    expect(jobPlanner).toContain('createAssetAssignmentOverride');
    expect(assetReadinessLoad).toContain("rpc('create_asset_assignment_override'");
    expect(jobPlanner).toContain('Record governed override');
    expect(jobPlanner).toContain('updated_at');
    expect(shiftPlanner).toContain('update_shift_with_asset_guard');
    expect(shiftPlanner).not.toContain("supabase.rpc('update_shift_with_event'");
  });

  it('enforces the governed job state machine and event spine', () => {
    for (const status of ['acknowledged', 'started', 'arrived', 'completed', 'delayed', 'unable_to_complete', 'vehicle_issue', 'site_issue', 'route_issue']) expect(lifecycleMigration).toContain(status);
    expect(lifecycleMigration).toContain('transition_job_assignment_with_event');
    expect(lifecycleMigration).toContain('p_expected_updated_at');
    expect(lifecycleMigration).toContain('target_assignment.driver_id = actor_id');
    expect(lifecycleMigration).toContain('operations.job.transition');
    for (const eventType of ['job_acknowledged', 'job_started', 'job_arrived', 'job_completed', 'job_delayed', 'job_vehicle_issue', 'job_site_issue', 'job_route_issue']) expect(lifecycleMigration).toContain(eventType);
    expect(driverJobs).toContain('updated_at');
    expect(driverJobs).toContain('transition_job_assignment_with_event');
  });
});
