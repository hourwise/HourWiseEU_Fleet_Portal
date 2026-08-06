import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260716220000_add_manager_message_event_rpc.sql', 'utf8');
const messagingHub = readFileSync('src/components/manager/MessagingHub.tsx', 'utf8');

describe('EVENT-001 manager message producer', () => {
  it('creates compatible message, thread, and event records atomically', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.send_manager_message_with_event');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('INSERT INTO public.message_threads');
    expect(migration).toContain("'message_sent'");
    expect(migration).toContain('INSERT INTO public.messages');
    expect(migration).toContain('related_message_id = message_id');
  });

  it('keeps legacy manager access authoritative while observing the RBAC permission', () => {
    expect(migration).toContain("actor_role = 'manager'");
    expect(migration).toContain("public.actor_has_permission('messaging.message.create'");
    expect(migration).toContain("'shadow_permission_mismatch'");
    expect(migration).toContain('Only managers can send company messages');
  });

  it('limits execution to authenticated callers and routes Portal sends through the producer', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.send_manager_message_with_event(text, uuid) FROM PUBLIC');
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.send_manager_message_with_event(text, uuid) TO authenticated');
    expect(messagingHub).toContain("supabase.rpc('send_manager_message_with_event'");
  });
});
