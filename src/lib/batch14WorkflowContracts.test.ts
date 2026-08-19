import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const atlasMigration = readFileSync('supabase/migrations/20260819211839_batch14_atlas_proposals.sql', 'utf8');
const podMigration = readFileSync('supabase/migrations/20260819211850_batch14_pod_reconciliation.sql', 'utf8');
const securityMigration = readFileSync('supabase/migrations/20260819211858_batch14_security_hardening.sql', 'utf8');
const proposal = readFileSync('src/lib/atlasProposal.ts', 'utf8');
const modelGateway = readFileSync('src/lib/atlasModelGateway.ts', 'utf8');
const smoke = readFileSync('tools/operational-smoke.mjs', 'utf8');
const fixture = readFileSync('tools/operational-smoke-fixtures.mjs', 'utf8');

describe('Batch 14 workflow and security contracts', () => {
  it('persists proposals as decision evidence with manager review and no direct writes', () => {
    expect(atlasMigration).toContain('create table if not exists public.atlas_proposals');
    expect(atlasMigration).toContain("proposal_type text not null check (proposal_type in ('change_trailer', 'change_shift_vehicle', 'acknowledge_task'))");
    expect(atlasMigration).toContain('validation_status text not null');
    expect(atlasMigration).toContain('source_snapshot_version text not null');
    expect(atlasMigration).toContain('revoke insert, update, delete on public.atlas_proposals');
    for (const functionName of ['create_atlas_proposal', 'revalidate_atlas_proposal', 'review_atlas_proposal', 'record_atlas_proposal_outcome']) expect(atlasMigration).toContain(`create or replace function public.${functionName}`);
    expect(atlasMigration).toContain('set search_path = public, pg_temp');
    expect(atlasMigration).toContain("p_decision not in ('approved', 'rejected')");
    expect(atlasMigration).toContain("proposal.validation_status <> 'valid'");
    expect(atlasMigration).toContain('record_security_event');
    expect(proposal).toContain("assign_trailer_to_job_assignment");
    expect(proposal).toContain("update_shift_with_asset_guard");
    expect(proposal).toContain("set_operational_task_handling");
    expect(proposal).not.toContain('AtlasModelGateway');
    expect(proposal).not.toContain('openai');
    expect(proposal).not.toContain('anthropic');
    expect(modelGateway).not.toContain('createClient');
  });

  it('reconciles only bounded expired pending intents with exact uploader-owned paths', () => {
    expect(podMigration).toContain('create or replace function public.reconcile_expired_job_evidence_uploads');
    expect(podMigration).toContain("where status = 'pending'");
    expect(podMigration).toContain("created_at < cutoff");
    expect(podMigration).toContain('for update skip locked');
    expect(podMigration).toContain('limit coalesce(p_max_rows, 100)');
    expect(podMigration).toContain('bucket_id = intent.storage_bucket');
    expect(podMigration).toContain('name = intent.storage_path');
    expect(podMigration).toContain('owner_id = intent.uploaded_by');
    expect(podMigration).toContain("status = 'expired'");
    expect(podMigration).toContain('record_security_event');
    expect(podMigration).not.toContain('storage_path like');
    expect(podMigration).toContain("cron.schedule(");
    expect(podMigration).toContain("'hourwise-pod-upload-intent-reconciliation'");
  });

  it('hardens trigger execution and keeps browser smoke free of service-role use', () => {
    expect(securityMigration).toContain('alter function public.update_updated_at_column()');
    expect(securityMigration).toContain('set search_path = public, pg_temp');
    expect(securityMigration).toContain('revoke all on function public.prevent_role_escalation() from public, anon, authenticated');
    expect(securityMigration).toContain('revoke all on function public.enforce_trailer_assignment_readiness() from public, anon, authenticated');
    expect(smoke).toContain('SMOKE_WRONG_DRIVER_EMAIL');
    expect(smoke).toContain('SMOKE_CROSS_COMPANY_ASSIGNMENT_ID');
    expect(smoke).toContain('SMOKE_FORBIDDEN_POD_PATH');
    expect(smoke).toContain('Service-role credentials are forbidden');
    expect(smoke).not.toContain('SMOKE_FIXTURE_SERVICE_ROLE_KEY');
    expect(fixture).toContain('SMOKE_FIXTURE_SERVICE_ROLE_KEY');
    expect(fixture).toContain('browserSmokeVariables');
    expect(fixture).toContain('reset');
  });
});
