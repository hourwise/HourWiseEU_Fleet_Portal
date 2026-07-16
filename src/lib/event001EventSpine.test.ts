import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260709110000_add_event_spine_foundation.sql', 'utf8');
const normalized = migration.toLowerCase();

describe('EVENT-001 event spine foundation migration', () => {
  it('adds the additive event, thread, and acknowledgement tables', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.message_threads');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.fleet_events');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.driver_acknowledgements');
    expect(migration).toContain("thread_type IN ('broadcast', 'direct', 'system', 'rota')");
    expect(migration).toContain("priority IN ('info', 'advisory', 'warning', 'critical', 'emergency')");
  });

  it('links existing messages without replacing the current messaging UI', () => {
    expect(migration).toContain('ALTER TABLE public.messages');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS thread_id uuid');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS fleet_event_id uuid');
    expect(migration).not.toContain('DROP TABLE public.messages');
    expect(normalized).not.toContain('delete from public.messages');
  });

  it('includes driver and manager visibility policies', () => {
    expect(migration).toContain('Managers can manage company message threads');
    expect(migration).toContain('Drivers can view assigned or broadcast message threads');
    expect(migration).toContain('Managers can manage company fleet events');
    expect(migration).toContain('Drivers can view assigned or broadcast fleet events');
    expect(migration).toContain('Drivers can manage own acknowledgements');
    expect(migration).toContain("role = 'manager'");
    expect(migration).toContain("role = 'driver'");
  });

  it('creates a driver read model for app-side event consumption', () => {
    expect(migration).toContain('CREATE OR REPLACE VIEW public.driver_visible_fleet_events');
    expect(migration).toContain('WITH (security_invoker = true)');
    expect(migration).toContain('recipient_driver_id = (SELECT auth.uid())');
    expect(migration).toContain('recipient_driver_id IS NULL');
  });

  it('restricts driver acknowledgements to visible events', () => {
    expect(migration).toContain('EXISTS (');
    expect(migration).toContain('FROM public.fleet_events fe');
    expect(migration).toContain('fe.id = driver_acknowledgements.event_id');
    expect(migration).toContain('fe.company_id = driver_acknowledgements.company_id');
  });
});
