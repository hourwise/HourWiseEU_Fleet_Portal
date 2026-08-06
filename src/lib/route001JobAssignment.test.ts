import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260717110000_add_job_assignment_foundation.sql', 'utf8');

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
});
