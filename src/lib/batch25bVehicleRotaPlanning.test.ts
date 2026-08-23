import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildBulkAssignmentPreview } from './planningBoard';
import { buildCoverageRows, type PlanningSlot } from './planningWorkspace';
import { entitlementCoversVehicleClass } from './planningVehicleClasses';
import { buildRotaTemplateCreateArgs } from './rotaTemplateSave';

const migration = readFileSync('supabase/migrations/20260823212229_batch25b_pattern_deletion_vehicle_class_planning.sql', 'utf8');
const workspace = readFileSync('src/components/manager/RotaPlanningWorkspace.tsx', 'utf8');
const classOne: PlanningSlot = { id: 'class-1', slot_date: '2026-08-24', role_label: 'Driver', start_time: '06:00:00', end_time: '15:00:00', required_headcount: 1, required_vehicle_class: 'class_1', status: 'open', updated_at: '2026-08-23T12:00:00Z' };

describe('Batch 25B vehicle-class rota planning', () => {
  it('maps UK licence entitlements to the requested rota categories', () => {
    expect(entitlementCoversVehicleClass(['B'], '3_5t')).toBe(true);
    expect(entitlementCoversVehicleClass(['C1E'], '7_5t')).toBe(true);
    expect(entitlementCoversVehicleClass(['C'], 'class_2')).toBe(true);
    expect(entitlementCoversVehicleClass(['C'], 'class_1')).toBe(false);
    expect(entitlementCoversVehicleClass(['CE'], 'class_1')).toBe(true);
  });

  it('serialises vehicle demand into a staffing pattern', () => {
    const args = buildRotaTemplateCreateArgs({ name: 'Regular Week', cycleLength: 7, requestKey: '11111111-1111-4111-8111-111111111111', requirements: [{ id: 'r1', cycleDay: 1, roleLabel: 'Day Driver', startTime: '06:00', endTime: '15:00', headcount: 2, vehicleClass: 'class_2' }] });
    expect(args.p_slots).toEqual([expect.objectContaining({ required_vehicle_class: 'class_2' })]);
  });

  it('keeps the same duty split by vehicle class', () => {
    expect(buildCoverageRows([classOne, { ...classOne, id: 'class-2', required_vehicle_class: 'class_2' }], [], ['2026-08-24'])).toHaveLength(2);
  });

  it('excludes an unentitled driver before bulk commit', () => {
    const preview = buildBulkAssignmentPreview({ driverIds: ['driver'], slotIds: [classOne.id], slots: [classOne], assignments: [], availability: [], regimes: { driver: 'assimilated_aetr' }, entitlements: { driver: ['C'] } });
    expect(preview[0]).toMatchObject({ status: 'UNAVAILABLE', reason: 'Licence entitlement does not cover this vehicle type' });
  });

  it('enforces scope, entitlements and asset type in the database', () => {
    expect(migration).toContain("public.get_my_role() is distinct from 'manager'");
    expect(migration).toContain('q.company_id = new.company_id');
    expect(migration).toContain("required_class = 'class_1' and q.vehicle_class = 'CE'");
    expect(migration).toContain('Assigned vehicle does not match the required vehicle class');
    expect(migration).toContain("vehicle_class = 'rigid' and planning_vehicle_class in ('7_5t', 'class_2')");
  });

  it('deletes only the reusable pattern and preserves applied weeks', () => {
    expect(migration).toContain('delete from public.rota_templates where id = target.id');
    expect(migration).toContain("'dated_requirements_preserved', dated_slots");
    expect(workspace).toContain('Weeks already created from it, including their staffing and assignments, will stay in place.');
    expect(workspace).toContain('Delete pattern');
  });
});
