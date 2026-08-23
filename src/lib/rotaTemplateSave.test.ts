import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Database } from './database.types';
import {
  buildRotaTemplateCreateArgs,
  submitRotaTemplate,
  type CreateRotaTemplateArgs,
  type RotaTemplateRequirementDraft,
} from './rotaTemplateSave';

const migration = readFileSync('supabase/migrations/20260823072604_batch24a_rota_template_save_reliability.sql', 'utf8');
const generatedTypes = readFileSync('src/lib/database.types.ts', 'utf8');
const workspace = readFileSync('src/components/manager/RotaPlanningWorkspace.tsx', 'utf8');
const requestKey = '11111111-1111-4111-8111-111111111111';
const templateId = '22222222-2222-4222-8222-222222222222';
const oneRequirement: RotaTemplateRequirementDraft[] = [{
  id: 'row-1', cycleDay: 1, roleLabel: 'Day Driver', startTime: '08:00', endTime: '18:00', headcount: 5,
}];

afterEach(() => {
  vi.useRealTimers();
});

function args(requirements = oneRequirement): CreateRotaTemplateArgs {
  return buildRotaTemplateCreateArgs({ name: ' Regular Week ', cycleLength: 7, requirements, requestKey });
}

function harness(overrides: Partial<Parameters<typeof submitRotaTemplate>[1]> = {}) {
  const busy: boolean[] = [];
  const onConfirmed = vi.fn();
  const refreshAndSelect = vi.fn(async () => true);
  return {
    busy,
    onConfirmed,
    refreshAndSelect,
    dependencies: {
      rpc: async () => ({ data: { template_id: templateId, replayed: false }, error: null }),
      refreshAndSelect,
      setBusy: (value: boolean) => busy.push(value),
      onConfirmed,
      reportTechnicalError: vi.fn(),
      timeoutMs: 100,
      ...overrides,
    },
  };
}

describe('Batch 24A rota template save reliability', () => {
  it('serializes the reported one-requirement payload exactly', () => {
    expect(args()).toEqual({
      p_name: 'Regular Week',
      p_description: 'Staffing demand pattern',
      p_cycle_length_days: 7,
      p_request_key: requestKey,
      p_slots: [{
        cycle_day: 1,
        role_label: 'Day Driver',
        start_time: '08:00',
        end_time: '18:00',
        required_headcount: 5,
        sort_order: 0,
      }],
    });
  });

  it('sends the typed payload through the actual Supabase RPC transport contract', async () => {
    const requests: Array<{ url: string; method: string; body: string }> = [];
    const client = createClient<Database>('https://example.supabase.co', 'public-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (input, init) => {
          requests.push({ url: String(input), method: init?.method ?? 'GET', body: String(init?.body ?? '') });
          return new Response(JSON.stringify({ template_id: templateId, replayed: false }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        },
      },
    });
    const payload = args();
    const response = await client.rpc('create_cyclic_rota_template', payload);
    expect(response.error).toBeNull();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      url: 'https://example.supabase.co/rest/v1/rpc/create_cyclic_rota_template',
      method: 'POST',
    });
    expect(JSON.parse(requests[0].body)).toEqual(payload);
  });

  it('reproduces the original detached Supabase method failure before transport', () => {
    const client = createClient<Database>('https://example.supabase.co', 'public-test-key');
    const detachedRpc = client.rpc;
    expect(() => detachedRpc('create_cyclic_rota_template', args())).toThrow("Cannot read properties of undefined (reading 'rest')");
  });

  it('serializes multiple requirements deterministically', () => {
    const payload = args([...oneRequirement, {
      id: 'row-2', cycleDay: 2, roleLabel: ' Night Driver ', startTime: '18:00', endTime: '04:00', headcount: 3,
    }]);
    expect(payload.p_slots).toEqual([
      expect.objectContaining({ cycle_day: 1, sort_order: 0 }),
      expect.objectContaining({ cycle_day: 2, role_label: 'Night Driver', start_time: '18:00', end_time: '04:00', required_headcount: 3, sort_order: 1 }),
    ]);
  });

  it('clears busy, refreshes/selects the returned template and closes only on confirmed success', async () => {
    const test = harness();
    test.onConfirmed.mockImplementation(() => expect(test.busy[test.busy.length - 1]).toBe(false));
    const result = await submitRotaTemplate(args(), test.dependencies);
    expect(result).toEqual({ status: 'confirmed', templateId, name: 'Regular Week', replayed: false });
    expect(test.busy).toEqual([true, false]);
    expect(test.refreshAndSelect).toHaveBeenCalledWith(templateId);
    expect(test.onConfirmed).toHaveBeenCalledOnce();
  });

  it('clears busy and preserves the submitted form payload on a server error', async () => {
    const payload = args();
    const before = structuredClone(payload);
    const test = harness({ rpc: async () => ({ data: null, error: { message: 'internal database detail' } }) });
    const result = await submitRotaTemplate(payload, test.dependencies);
    expect(result.status).toBe('server_error');
    expect(result).not.toEqual(expect.objectContaining({ message: expect.stringContaining('internal database detail') }));
    expect(test.busy).toEqual([true, false]);
    expect(test.onConfirmed).not.toHaveBeenCalled();
    expect(payload).toEqual(before);
  });

  it('clears busy and keeps the drawer open on a thrown network failure', async () => {
    const test = harness({ rpc: async () => { throw new TypeError('fetch failed'); } });
    const result = await submitRotaTemplate(args(), test.dependencies);
    expect(result.status).toBe('uncertain');
    expect(test.busy).toEqual([true, false]);
    expect(test.onConfirmed).not.toHaveBeenCalled();
  });

  it('aborts a stalled request at the timeout and always clears busy', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const test = harness({
      rpc: (_payload, requestSignal) => {
        signal = requestSignal;
        return new Promise(() => undefined);
      },
      timeoutMs: 25,
    });
    const pending = submitRotaTemplate(args(), test.dependencies);
    await vi.advanceTimersByTimeAsync(25);
    const result = await pending;
    expect(result.status).toBe('uncertain');
    expect(signal?.aborted).toBe(true);
    expect(test.busy).toEqual([true, false]);
    expect(test.onConfirmed).not.toHaveBeenCalled();
  });

  it('keeps the form open and surfaces a bounded warning when refresh cannot find the returned template', async () => {
    const test = harness({ refreshAndSelect: async () => false });
    const result = await submitRotaTemplate(args(), test.dependencies);
    expect(result.status).toBe('inconsistent');
    expect(test.busy).toEqual([true, false]);
    expect(test.onConfirmed).not.toHaveBeenCalled();
  });

  it('makes duplicate retries company-scoped and returns the existing template', () => {
    expect(migration).toContain('rota_templates_company_request_key_uidx');
    expect(migration).toContain('on public.rota_templates(company_id, request_key)');
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain("rt.company_id = actor_company_id and rt.request_key = p_request_key");
    expect(migration).toContain("'replayed', true");
  });

  it('keeps generated RPC arguments aligned and removes the unsafe detached generic cast', () => {
    expect(generatedTypes).toContain('create_cyclic_rota_template: {');
    expect(generatedTypes).toContain('p_request_key: string');
    expect(workspace).toContain("supabase.rpc('create_cyclic_rota_template', payload).abortSignal(signal)");
    expect(workspace).not.toContain('supabase.rpc as unknown as');
    expect(workspace).toContain('const planningRpc: typeof supabase.rpc = supabase.rpc.bind(supabase);');
  });

  it('bounds related planner writes and clears their busy state in finally blocks', () => {
    expect(workspace).toContain('AbortSignal.timeout(PLANNING_REQUEST_TIMEOUT_MS)');
    expect(workspace.match(/finally/g)?.length ?? 0).toBeGreaterThanOrEqual(9);
    expect(workspace).not.toContain("text: error.message");
  });
});
