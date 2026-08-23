import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildBulkAssignmentPreview, loadPlanningDomains } from './planningBoard';
import { availabilityForDate, type PlanningAssignment, type PlanningAvailability, type PlanningSlot } from './planningWorkspace';

const workspace = readFileSync('src/components/manager/RotaPlanningWorkspace.tsx', 'utf8');
const migration = readFileSync('supabase/migrations/20260823155636_batch25_unified_planning_workspace.sql', 'utf8');
const batch23 = readFileSync('supabase/migrations/20260822211636_batch23_planning_workspace.sql', 'utf8');

const slots: PlanningSlot[] = Array.from({ length: 5 }, (_, index) => ({
  id: `day-${index + 1}`, slot_date: `2026-08-${24 + index}`, role_label: 'Day Driver', start_time: '08:00:00', end_time: '18:00:00', required_headcount: 3, status: 'open', updated_at: '2026-08-23T12:00:00Z',
}));

describe('Batch 25 domain-aware planning load', () => {
  it('keeps templates visible when recorded hours fail', async () => {
    const result = await loadPlanningDomains({
      core: async () => ({ data: { templates: [{ id: 'regular', name: 'Regular Week' }, { id: 'busy', name: 'Busy Week' }] }, error: null }),
      drivers: async () => ({ data: [{ id: 'driver-1' }], error: null }), vehicles: async () => ({ data: [], error: null }), jobs: async () => ({ data: [{ id: 'job-1' }], error: null }),
      recordedHours: async () => { throw new Error('supporting source unavailable'); },
    });
    expect(result.core.error).toBeNull();
    expect(result.core.data.templates.map((template) => template.name)).toEqual(['Regular Week', 'Busy Week']);
    expect(result.recordedHours.error?.message).toBe('supporting source unavailable');
    expect(result.jobs.data).toHaveLength(1);
  });

  it('clears a subsidiary error after a successful retry result', async () => {
    let fails = true;
    const load = () => loadPlanningDomains({
      core: async () => ({ data: { templates: ['Regular Week'] }, error: null }), drivers: async () => ({ data: [], error: null }), vehicles: async () => ({ data: [], error: null }), jobs: async () => ({ data: [], error: null }),
      recordedHours: async () => fails ? { data: [], error: new Error('temporary') } : { data: [{ user_id: 'driver-1' }], error: null },
    });
    expect((await load()).recordedHours.error).not.toBeNull(); fails = false; expect((await load()).recordedHours.error).toBeNull();
  });

  it('never queries a nonexistent work_sessions.company_id from the planner', () => {
    expect(workspace).not.toMatch(/from\('work_sessions'\)[\s\S]{0,300}eq\('company_id'/);
    expect(migration).toContain('join public.profiles driver on driver.id = ws.user_id');
    expect(migration).toContain('driver.company_id = actor_company_id');
    expect(migration).toContain('get_planning_recorded_work_summary');
  });
});

describe('Batch 25 bulk staffing', () => {
  it('assigns one driver across Monday to Friday in one preview', () => {
    const preview = buildBulkAssignmentPreview({ driverIds: ['bob'], slotIds: slots.map((slot) => slot.id), slots, assignments: [], availability: [], regimes: { bob: 'assimilated_aetr' } });
    expect(preview).toHaveLength(5); expect(preview.every((item) => item.status === 'READY')).toBe(true);
  });

  it('evaluates many drivers across many vacancies without overfilling', () => {
    const drivers = ['bob', 'sarah', 'marcus', 'jane'];
    const preview = buildBulkAssignmentPreview({ driverIds: drivers, slotIds: slots.map((slot) => slot.id), slots, assignments: [], availability: [], regimes: Object.fromEntries(drivers.map((id) => [id, 'assimilated_aetr'])) });
    expect(preview.filter((item) => item.status === 'READY')).toHaveLength(15);
    expect(preview.filter((item) => item.reason === 'No vacancy remains')).toHaveLength(5);
  });

  it('reports holidays, overlaps and existing assignments per item', () => {
    const occupied: PlanningSlot = { ...slots[0], id: 'occupied', start_time: '09:00:00', end_time: '12:00:00' };
    const assignments: PlanningAssignment[] = [
      { id: 'existing', slot_id: slots[0].id, driver_id: 'bob', shift_id: 'shift-1', vehicle_id: null, trailer_id: null, status: 'planned' },
      { id: 'overlap', slot_id: occupied.id, driver_id: 'jane', shift_id: 'shift-2', vehicle_id: null, trailer_id: null, status: 'planned' },
    ];
    const availability: PlanningAvailability[] = [{ id: 'holiday', driver_id: 'marcus', availability_type: 'annual_leave', starts_on: '2026-08-24', ends_on: '2026-08-28', note: null }];
    const preview = buildBulkAssignmentPreview({ driverIds: ['bob', 'jane', 'marcus'], slotIds: [slots[0].id], slots: [...slots, occupied], assignments, availability, regimes: {} });
    expect(preview.find((item) => item.driverId === 'bob')).toMatchObject({ status: 'CONFLICT', reason: 'Already assigned' });
    expect(preview.find((item) => item.driverId === 'jane')).toMatchObject({ status: 'CONFLICT', reason: 'Overlaps another duty' });
    expect(preview.find((item) => item.driverId === 'marcus')).toMatchObject({ status: 'UNAVAILABLE', reason: 'Holiday or other absence' });
  });

  it('uses a bounded transaction and request replay to prevent duplicate shifts', () => {
    expect(migration).toContain('jsonb_array_length(p_items) > 500'); expect(migration).toContain('pg_advisory_xact_lock'); expect(migration).toContain('planning_bulk_assignment_requests');
    expect(migration).toContain("return cached || jsonb_build_object('replayed', true)");
    expect(migration).toContain('public.assign_rota_position(slot_id, driver_id, null, null, slot_record.updated_at)');
  });
});

describe('Batch 25 unified board workflows', () => {
  it('keeps leave visible across week boundaries and excludes the candidate', () => {
    const leave: PlanningAvailability[] = [{ id: 'leave', driver_id: 'bob', availability_type: 'annual_leave', starts_on: '2026-08-28', ends_on: '2026-09-04', note: null }];
    expect(availabilityForDate(leave, 'bob', '2026-08-30')?.id).toBe('leave'); expect(availabilityForDate(leave, 'bob', '2026-09-01')?.id).toBe('leave');
  });

  it('has one weekly page with three representations and persistent stateful tools', () => {
    expect(workspace).toMatch(/type PlannerView = ["']coverage["'] \| ["']drivers["'] \| ["']runs["']/); expect(workspace).toContain('Weekly planning board'); expect(workspace).toMatch(/<JobTray\s+open=\{showJobTray\}/);
    expect(workspace).toContain('Manage patterns'); expect(workspace).toContain('Fill vacancies across week');
    expect(workspace).not.toContain("{ id: 'leave', label: 'Leave' }"); expect(workspace).not.toContain("{ id: 'templates', label: 'Templates' }"); expect(workspace).not.toContain("{ id: 'duties', label: 'Assigned duties' }");
  });

  it('preserves job-first driverless runs and one-time projection', () => {
    expect(batch23).toContain("case when target_assignment_id is null then 'planning' else 'staffed' end"); expect(batch23).toContain('projected_job_assignment_id'); expect(batch23).toContain('if projected_assignment_id is null then');
    expect(workspace).toContain('Order work before choosing a driver.'); expect(workspace).toContain('Move to run…');
  });

  it('does not alter or recreate saved templates during the redesign', () => {
    expect(migration).not.toMatch(/delete\s+from\s+public\.rota_templates/i); expect(migration).not.toMatch(/insert\s+into\s+public\.rota_templates/i); expect(migration).not.toMatch(/update\s+public\.rota_templates/i);
  });

  it('scopes errors to core, jobs, vehicles, drivers and recorded hours', () => {
    expect(workspace).toContain("We couldn't load this week's plan."); expect(workspace).toContain("Jobs couldn't be loaded."); expect(workspace).toContain("Vehicle availability couldn't be loaded.");
    expect(workspace).toContain('Recorded hours are temporarily unavailable. Rest and working-time checks may be incomplete.'); expect(workspace).not.toContain("We couldn't refresh planning. Try again.");
  });
});
