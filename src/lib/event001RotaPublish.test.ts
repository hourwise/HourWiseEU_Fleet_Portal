import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260716210000_add_rota_publish_event_rpc.sql', 'utf8');
const planner = readFileSync('src/components/manager/ShiftPlanner.tsx', 'utf8');

describe('EVENT-001 rota publication producer', () => {
  it('adds an audited, organisation-scoped rota publication permission', () => {
    expect(migration).toContain("'rota.shift.publish'");
    expect(migration).toContain("'fleet_administrator', 'rota.shift.publish', 'allow', 'organisation'");
    expect(migration).toContain("'shadow_permission_mismatch'");
    expect(migration).toContain("public.actor_has_permission('rota.shift.publish'");
  });

  it('preserves legacy manager/company enforcement during the RBAC shadow period', () => {
    expect(migration).toContain("actor_role = 'manager'");
    expect(migration).toContain('target_shift.company_id = actor_company_id');
    expect(migration).toContain("'legacy_authorisation_denied'");
    expect(migration).toContain('Only managers in the shift company can publish rota shifts');
  });

  it('publishes the shift and event atomically under a locked shift row', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.publish_shift_with_event');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('FOR UPDATE');
    expect(migration).toContain("status = 'published'");
    expect(migration).toContain("target_shift.status NOT IN ('draft', 'updated')");
    expect(migration).toContain("'rota_shift_published'");
    expect(migration).toContain('recipient_driver_id');
    expect(migration).toContain('related_shift_id');
    expect(migration).toContain('requires_ack');
  });

  it('creates or reuses a rota thread and limits execution to authenticated users', () => {
    expect(migration).toContain('FROM public.fleet_events fe');
    expect(migration).toContain("'rota'");
    expect(migration).toContain('INSERT INTO public.message_threads');
    expect(migration).toContain('UPDATE public.message_threads');
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.publish_shift_with_event(uuid, boolean) FROM PUBLIC');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.publish_shift_with_event(uuid, boolean) TO authenticated');
  });

  it('uses the atomic producer instead of a browser-side publish table update', () => {
    const publishHandler = planner.slice(
      planner.indexOf('const handlePublishShift'),
      planner.indexOf('const handleCancelShift')
    );

    expect(publishHandler).toContain("supabase.rpc('publish_shift_with_event'");
    expect(publishHandler).not.toContain(".from('shifts')");
  });
});
