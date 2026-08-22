import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260822211636_batch23_planning_workspace.sql', 'utf8');
const workspace = readFileSync('src/components/manager/RotaPlanningWorkspace.tsx', 'utf8');

describe('Batch 23 rota, workforce and dispatch contracts', () => {
  it('models true bounded cyclic staffing demand and previews before apply', () => {
    expect(migration).toContain('cycle_length_days integer not null default 7');
    expect(migration).toContain('cycle_day integer not null default 1');
    expect(migration).toContain("rts.cycle_day = ((day_value::date - p_from) % template_record.cycle_length_days) + 1");
    expect(migration).toContain('create or replace function public.preview_rota_template');
    expect(migration).toContain('create or replace function public.apply_cyclic_rota_template');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(workspace).toContain('ApplyPreviewDialog');
  });

  it('keeps individual fleet allocation on the filled position', () => {
    expect(migration).toContain('alter table public.rota_slot_assignments');
    expect(migration).toContain('vehicle_id uuid references public.vehicles');
    expect(migration).toContain('trailer_id uuid references public.vehicles');
    expect(migration).toContain('The individual rota_slot_assignments.vehicle_id is authoritative');
    expect(migration).toContain('p_expected_slot_updated_at');
    expect(workspace).toContain('Driver and individual fleet allocation added as a draft duty.');
  });

  it('supports ordered jobs on an unstaffed run and idempotent projection', () => {
    expect(migration).toContain('create table if not exists public.planned_runs');
    expect(migration).toContain('create table if not exists public.planned_run_jobs');
    expect(migration).toContain('planned_run_jobs_active_job_idx');
    expect(migration).toContain('projected_job_assignment_id');
    expect(migration).toContain("status = 'projected'");
    expect(workspace).toContain('Order work before choosing a driver.');
    expect(workspace).toContain('Driving-time check pending');
  });

  it('keeps manager security and company isolation on new authority', () => {
    expect(migration).toContain('auth.uid()');
    expect(migration).toContain("public.get_my_role() is distinct from 'manager'");
    expect(migration).toContain('company_id = public.get_my_company_id()');
    expect(migration).toContain('security definer set search_path = public, pg_temp');
    expect(migration).toContain('revoke all on function public.assign_rota_position');
    expect(migration).toContain('alter table public.planned_runs enable row level security');
  });

  it('moves legacy cell-by-cell shift entry behind a secondary view', () => {
    expect(workspace).toContain("{ id: 'duties', label: 'Assigned duties' }");
    expect(workspace).toContain("activeView === 'duties'");
    expect(workspace).not.toContain('<ShiftPlanner onOpenJobPlanner={onOpenJobPlanner} />\n    <DriverHoursPlanningPanel');
    expect(workspace).toContain('Rules need confirming');
  });
});
