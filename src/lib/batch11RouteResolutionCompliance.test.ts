import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260818211043_batch11_route_stops_and_task_handling.sql', 'utf8');

describe('Batch 11 governed boundaries', () => {
  it('keeps route stops and private notes company scoped with RLS', () => {
    expect(migration).toContain('create table if not exists public.job_stops');
    expect(migration).toContain('create table if not exists public.job_stop_manager_notes');
    expect(migration).toContain('alter table public.job_stops enable row level security');
    expect(migration).toContain('create policy "Drivers can view own published job stops"');
    expect(migration).toContain('revoke insert, update, delete on public.job_stops');
    expect(migration).toContain("p_expected_job_updated_at timestamptz");
    expect(migration).toContain("using errcode = '40001'");
  });
  it('keeps operational handling separate from source truth and validates ownership', () => {
    expect(migration).toContain('create table if not exists public.operational_task_handlings');
    expect(migration).toContain("check (status in ('new', 'acknowledged', 'in_progress', 'resolved'))");
    expect(migration).toContain('Task source is outside the actor company');
    expect(migration).toContain('Task owner is outside the actor company');
    expect(migration).toContain('record_security_event');
  });
  it('hardens new functions and never exposes a fake route estimate', () => {
    expect(migration).toContain('set search_path = public, pg_temp');
    expect(migration).toContain('grant execute on function public.save_job_stops');
    expect(migration).toContain('grant execute on function public.set_operational_task_handling');
    expect(migration).toContain('Route estimates are deliberately not persisted');
  });
});
