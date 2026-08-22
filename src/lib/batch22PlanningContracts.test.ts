import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260822202340_batch22_rota_planning_job_pool.sql', 'utf8');
const planner = readFileSync('src/components/manager/RotaPlanningWorkspace.tsx', 'utf8');
const shiftPlanner = readFileSync('src/components/manager/ShiftPlanner.tsx', 'utf8');
const atlas = readFileSync('src/components/manager/OperationalBriefing.tsx', 'utf8');

describe('Batch 22 planning contracts', () => {
  it('keeps assigned shifts authoritative and models empty demand separately', () => {
    expect(migration).toContain('driver_id uuid not null references public.profiles');
    expect(migration).toContain('create table if not exists public.rota_slots');
    expect(migration).toContain('create table if not exists public.rota_slot_assignments');
    expect(migration).toContain("status text not null default 'planning'");
    expect(migration).toContain('create or replace function public.assign_rota_slot_driver');
  });

  it('keeps draft planning separate from publication readiness', () => {
    expect(migration).toContain("if target_shift_status = 'draft' then return new;");
    expect(migration).toContain('create or replace function public.get_shift_publication_assessment');
    expect(migration).toContain("raise exception 'Asset assignment prohibited");
    expect(shiftPlanner).toContain("supabase.rpc('create_shift_draft'");
    expect(shiftPlanner).toContain('vehicle_id: null');
  });

  it('supports jobs before shifts without invented route estimates', () => {
    expect(migration).toContain('create or replace function public.create_planned_job');
    expect(migration).toContain('create or replace function public.assign_job_to_draft_shift');
    expect(planner).toContain('Unassigned job pool');
    expect(planner).toContain('no arrival time is invented here');
  });

  it('uses real buttons for deterministic Atlas suggestions', () => {
    expect(atlas).toContain('AtlasSuggestionButtons');
    expect(atlas).toContain("window.dispatchEvent(new CustomEvent('atlas-suggestion'");
    expect(atlas).toContain('setQuestion(suggestion)');
  });
});
