import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260717110000_add_job_assignment_foundation.sql', 'utf8');
const lifecycleMigration = readFileSync('supabase/migrations/20260809100000_complete_route_001_job_assignment_lifecycle.sql', 'utf8');
const hardeningMigration = readFileSync('supabase/migrations/20260809151559_enforce_route_001_job_schedule_invariants.sql', 'utf8');

describe('ROUTE-001 job assignment foundation', () => {
  it('adds company-scoped jobs and driver-scoped published assignments', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.jobs');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.job_assignments');
    expect(migration).toContain("CREATE POLICY \"Drivers can view own published job assignments\"");
    expect(migration).toContain("status IN ('published', 'updated')");
  });
  it('publishes the job assignment and driver event atomically', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.create_job_assignment_with_event');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain("'job_assigned'");
    expect(migration).toContain('job_assignment_id');
    expect(migration).toContain('related_shift_id');
  });
  it('uses shadow permission observation and restricts execution', () => {
    expect(migration).toContain("'operations.job.publish'");
    expect(migration).toContain("'shadow_permission_mismatch'");
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.create_job_assignment_with_event');
  });

  it('updates the safe driver-visible fields behind a locked stale-version RPC', () => {
    expect(lifecycleMigration).toContain('CREATE OR REPLACE FUNCTION public.update_job_assignment_with_event');
    expect(lifecycleMigration).toContain('p_expected_updated_at timestamptz');
    expect(lifecycleMigration).toContain("RAISE EXCEPTION 'Job assignment changed since it was loaded; refresh before editing' USING ERRCODE = '40001'");
    expect(lifecycleMigration).toContain('target_assignment.status = \'cancelled\'');
    expect(lifecycleMigration).toContain('SELECT * INTO target_assignment FROM public.job_assignments WHERE id = p_assignment_id FOR UPDATE');
    expect(lifecycleMigration).toContain('p_sequence');
    expect(lifecycleMigration).toContain("'job_updated'");
    expect(lifecycleMigration).toContain("'operations.job.update'");
    expect(lifecycleMigration).toContain("'previous', previous_payload, 'updated', next_payload");
    expect(lifecycleMigration).not.toContain('p_manager_notes');
  });

  it('cancels only a current published assignment and atomically records event plus audit', () => {
    expect(lifecycleMigration).toContain('CREATE OR REPLACE FUNCTION public.cancel_job_assignment_with_event');
    expect(lifecycleMigration).toContain("Only published job assignments can be cancelled");
    expect(lifecycleMigration).toContain("SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = auth.uid()");
    expect(lifecycleMigration).toContain("'job_cancelled'");
    expect(lifecycleMigration).toContain("'operations.job.cancel'");
    expect(lifecycleMigration).toContain("'shadow_permission_mismatch'");
    expect(lifecycleMigration).toContain('GRANT EXECUTE ON FUNCTION public.cancel_job_assignment_with_event');
  });

  it('enforces schedule and input invariants at both create and update RPC boundaries', () => {
    expect(hardeningMigration).toContain('CREATE OR REPLACE FUNCTION public.create_job_assignment_with_event');
    expect(hardeningMigration).toContain('CREATE OR REPLACE FUNCTION public.update_job_assignment_with_event');
    expect(hardeningMigration.match(/Planned departure must be at or after planned arrival/g)?.length).toBe(2);
    expect(hardeningMigration.match(/Expected duration must be positive/g)?.length).toBe(2);
    expect(hardeningMigration.match(/p_job_type IS NULL OR p_job_type NOT IN/g)?.length).toBe(2);
    expect(hardeningMigration.match(/p_sequence IS NULL OR p_sequence < 1/g)?.length).toBe(2);
    expect(hardeningMigration).toContain("IF target_assignment.status = 'cancelled'");
    expect(hardeningMigration).toContain("IF target_assignment.status NOT IN ('draft', 'published', 'updated')");
    expect(hardeningMigration).toContain('GRANT EXECUTE ON FUNCTION public.create_job_assignment_with_event');
    expect(hardeningMigration).toContain('GRANT EXECUTE ON FUNCTION public.update_job_assignment_with_event');
  });

  it('documents additive verification and rollback without deleting historical rows', () => {
    expect(lifecycleMigration).toContain('-- Verification:');
    expect(lifecycleMigration).toContain('-- Rollback:');
    expect(lifecycleMigration).toContain('Existing jobs, assignments, events, and audit');
    expect(lifecycleMigration).not.toMatch(/delete\s+from\s+public\.(jobs|job_assignments|fleet_events)/i);
  });
});
