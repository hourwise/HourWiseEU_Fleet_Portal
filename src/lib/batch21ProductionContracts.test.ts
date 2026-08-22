import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseAtlasProposalListResponse } from './atlasProposal';
import { parsePodReviewQueueResponse } from './jobEvidence';
import { parseTimelineItem } from './operationalTimeline';
import { toProductError } from './productError';
import { buildDashboardUrl, readDashboardRouteState } from './dashboardRoute';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260822191726_batch21_operations_rpc_repairs.sql');

describe('Batch 21 production runtime contracts', () => {
  it('qualifies the POD health projection and separates the failure streak variable', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('failure_streak integer := 0');
    expect(sql).toContain("'consecutive_failures', runs.consecutive_failures");
    expect(sql).not.toContain("'consecutive_failures', consecutive_failures) order by");
    expect(sql).toContain('set search_path = public, pg_temp');
  });

  it('uses an expanded row for the Atlas proposal set-returning RPC', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('select proposal.*');
    expect(sql).not.toContain('select proposal\n  from public.atlas_proposals');
    expect(sql).toContain('returns setof public.atlas_proposals');
  });

  it('treats empty POD and timeline responses as valid empty states', () => {
    expect(parsePodReviewQueueResponse([])).toEqual([]);
    expect(parseTimelineItem(null)).toBeNull();
    expect(parseTimelineItem({})).toBeNull();
  });

  it('rejects incomplete proposal rows instead of presenting a malformed response as success', () => {
    expect(parseAtlasProposalListResponse([])).toEqual([]);
    expect(() => parseAtlasProposalListResponse([{ id: 'incomplete' }])).toThrow('incomplete');
  });

  it('bounds technical failures to product copy while retaining a diagnostic log', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(toProductError(new Error('PostgREST structure of query does not match function result type'), 'This queue is unavailable.')).toEqual({ message: 'This queue is unavailable.' });
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it('keeps Atlas as a first-class dashboard route', () => {
    expect(readDashboardRouteState('?workspace=atlas').workspace).toBe('atlas');
    expect(buildDashboardUrl({ workspace: 'atlas', people: 'drivers', fleet: 'vehicles', settings: 'account', tacho: 'overview' })).toBe('/dashboard?workspace=atlas');
  });
});
