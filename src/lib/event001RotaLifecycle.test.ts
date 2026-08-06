import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260717100000_add_rota_update_cancel_event_rpcs.sql', 'utf8');
const planner = readFileSync('src/components/manager/ShiftPlanner.tsx', 'utf8');

describe('EVENT-001 rota update and cancellation producers', () => {
  it('adds audited update and cancellation permissions with shadow checks', () => {
    expect(migration).toContain("'rota.shift.update'");
    expect(migration).toContain("'rota.shift.cancel'");
    expect(migration).toContain("'shadow_permission_mismatch'");
    expect(migration).toContain("public.actor_has_permission('rota.shift.update'");
    expect(migration).toContain("public.actor_has_permission('rota.shift.cancel'");
  });
  it('creates events only for changes visible to the driver', () => {
    expect(migration).toContain("'rota_shift_updated'");
    expect(migration).toContain("'rota_shift_cancelled'");
    expect(migration).toContain("target_shift.status IN ('published', 'updated')");
    expect(migration).toContain("resulting_status = 'updated'");
    expect(migration).toContain('FOR UPDATE');
  });
  it('routes Portal edits and cancellations through atomic RPCs', () => {
    expect(planner).toContain("supabase.rpc('update_shift_with_event'");
    expect(planner).toContain("supabase.rpc('cancel_shift_with_event'");
  });
});
