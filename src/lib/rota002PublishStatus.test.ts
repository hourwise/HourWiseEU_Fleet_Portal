import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260709100000_add_shift_publish_status_audit.sql', 'utf8');

describe('ROTA-002 publish/status/audit migration', () => {
  it('adds shift status, publish fields, and cancellation fields', () => {
    expect(migration).toContain("CREATE TYPE shift_status AS ENUM ('draft', 'published', 'updated', 'cancelled')");
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS status shift_status NOT NULL DEFAULT');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS published_at timestamptz');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS published_by uuid');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS cancelled_at timestamptz');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS cancelled_by uuid');
  });

  it('keeps drivers restricted to published or updated own shifts', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Drivers can view their own shifts"');
    expect(migration).toContain('CREATE POLICY "Drivers can view own published shifts"');
    expect(migration).toContain("status IN ('published', 'updated')");
    expect(migration).toContain('driver_id = (SELECT auth.uid())');
  });

  it('creates trigger-backed audit events for shift lifecycle changes', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.shift_audit_events');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.record_shift_audit_event()');
    expect(migration).toContain('AFTER INSERT OR UPDATE OR DELETE ON public.shifts');
    expect(migration).toContain("'created'");
    expect(migration).toContain("'status_changed'");
    expect(migration).toContain("'updated'");
    expect(migration).toContain("'deleted'");
  });
});

