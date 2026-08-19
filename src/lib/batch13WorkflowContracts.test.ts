import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260819060656_batch13_pod_upload_intents.sql', 'utf8');
const evidence = readFileSync('src/lib/jobEvidence.ts', 'utf8');
const router = readFileSync('src/lib/atlasQueryRouter.ts', 'utf8');
const gateway = readFileSync('src/lib/atlasModelGateway.ts', 'utf8');
const smoke = readFileSync('tools/operational-smoke.mjs', 'utf8');

describe('Batch 13 workflow contracts', () => {
  it('keeps POD registration two-phase and cleanup uploader-scoped', () => {
    expect(migration).toContain('create table if not exists public.job_evidence_upload_intents');
    expect(migration).toContain('POD evidence objects require an upload intent');
    expect(migration).toContain('create or replace function public.begin_job_evidence_upload');
    expect(migration).toContain('create or replace function public.finalize_job_evidence_upload');
    expect(migration).toContain('create or replace function public.cleanup_failed_job_evidence_upload');
    expect(migration).toContain('owner_id = actor_id');
    expect(migration).toContain("Only a pending failed upload can be cleaned up; registered evidence is retained");
    expect(migration).toContain('set search_path = public, pg_temp');
    expect(migration).toContain('revoke all on function public.create_job_evidence');
    expect(migration).not.toContain('grant delete on storage.objects');

    expect(evidence).toContain("rpc('begin_job_evidence_upload'");
    expect(evidence).toContain("rpc('finalize_job_evidence_upload'");
    expect(evidence).toContain("rpc('cleanup_failed_job_evidence_upload'");
    expect(evidence).not.toContain("rpc('create_job_evidence'");
  });

  it('keeps Atlas query routing deterministic and provider-neutral', () => {
    expect(router).toContain('classifyAtlasQuestion');
    expect(router).toContain('buildAtlasReasoningPacket');
    expect(router).toContain('Advanced synthesis is not configured yet');
    expect(router).not.toContain('openai');
    expect(router).not.toContain('anthropic');
    expect(router).not.toContain('fetch(');
    expect(gateway).toContain('export interface AtlasModelGateway');
    expect(gateway).not.toContain('@supabase');
    expect(gateway).not.toContain('createClient');
  });

  it('requires authenticated disposable-environment operational verification', () => {
    expect(smoke).toContain("['local', 'staging'].includes(environment)");
    expect(smoke).toContain('SMOKE_ALLOW_MUTATION');
    expect(smoke).toContain('Service-role credentials are forbidden');
    for (const operation of [
      'create_job_assignment_with_asset_guard',
      'assign_trailer_to_job_assignment',
      'transition_job_assignment_with_event',
      'begin_job_evidence_upload',
      'finalize_job_evidence_upload',
      'review_job_evidence',
      'set_operational_task_handling',
      'sync_atlas_signal_observations',
    ]) expect(smoke).toContain(operation);
    expect(smoke).toContain('prohibitedTrailerId');
    expect(smoke).toContain("['acknowledged', 'started', 'arrived', 'completed']");
    expect(smoke).toContain("['acknowledged', 'started', 'delayed', 'unable_to_complete']");
  });
});
