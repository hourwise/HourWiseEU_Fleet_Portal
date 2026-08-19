import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const atlasMigration = readFileSync('supabase/migrations/20260819222159_batch15_atlas_apply_concurrency.sql', 'utf8');
const podMigration = readFileSync('supabase/migrations/20260819222203_batch15_pod_reconciliation_health.sql', 'utf8');
const securityMigration = readFileSync('supabase/migrations/20260819222204_batch15_security_legacy_helper_hardening.sql', 'utf8');
const atlasClient = readFileSync('src/lib/atlasProposal.ts', 'utf8');
const workbench = readFileSync('src/components/manager/AtlasProposalWorkbench.tsx', 'utf8');

describe('Batch 15 Atlas reliability contracts', () => {
  it('keeps one explicit apply boundary per supported proposal type', () => {
    for (const functionName of ['atlas_apply_trailer_proposal', 'atlas_apply_shift_vehicle_proposal', 'atlas_apply_task_proposal']) {
      expect(atlasMigration).toContain(`create or replace function public.${functionName}(p_proposal_id uuid)`);
      expect(atlasMigration).toContain(`grant execute on function public.${functionName}(uuid) to authenticated`);
    }
    expect(atlasMigration).toContain("status in ('pending_review', 'approved', 'applying', 'rejected', 'applied', 'failed')");
    expect(atlasMigration).toContain('for update');
    expect(atlasMigration).toContain("outcome_code', 'already_applied'");
    expect(atlasMigration).toContain("'idempotent_replay', true");
    expect(atlasMigration).toContain('apply_attempt_count = apply_attempt_count + 1');
    expect(atlasMigration).toContain("pg_advisory_xact_lock(hashtextextended('atlas-task:'");
    expect(atlasMigration).not.toContain('grant execute on function public.record_atlas_proposal_outcome(uuid, text, jsonb) to authenticated');
  });

  it('retains authoritative operational event linkage without duplicating source truth', () => {
    expect(atlasMigration).toContain('resulting_event_id uuid references public.fleet_events(id)');
    expect(atlasMigration).toContain("'resulting_event_id', event_id");
    expect(atlasMigration).toContain("'operation_type', 'assign_trailer_to_job_assignment'");
    expect(atlasMigration).toContain("'operation_type', 'update_shift_with_asset_guard'");
    expect(atlasMigration).toContain("'operation_type', 'set_operational_task_handling'");
    expect(atlasClient).toContain('atlas_apply_trailer_proposal');
    expect(atlasClient).toContain('atlas_apply_shift_vehicle_proposal');
    expect(atlasClient).toContain('atlas_apply_task_proposal');
    expect(atlasClient).not.toContain("rpc('record_atlas_proposal_outcome'");
  });

  it('uses persisted security audit evidence for the timeline and bounded filters', () => {
    expect(atlasMigration).toContain('create or replace function public.get_atlas_proposal_timeline');
    expect(atlasMigration).toContain('security_permission_audit_events');
    expect(atlasMigration).toContain("audit.metadata ->> 'proposal_id'");
    expect(atlasMigration).toContain('create or replace function public.list_atlas_proposals');
    expect(atlasMigration).toContain('p_created_from');
    expect(atlasMigration).toContain('p_created_to');
    expect(atlasMigration).toContain('p_limit integer default 100');
    expect(atlasMigration).toContain('limit coalesce(p_limit, 100)');
  });

  it('keeps audit export privacy bounded to identifiers, statuses, reasons, and event references', () => {
    expect(workbench).toContain('validation_codes');
    expect(atlasClient).toContain('resulting_event_id');
    expect(atlasClient).not.toContain('proposal.review_notes');
    expect(atlasClient).not.toContain('evidence_facts.map');
  });
});

describe('Batch 15 POD reconciliation health contracts', () => {
  it('persists bounded success, partial, and failure run state', () => {
    expect(podMigration).toContain('create table if not exists public.pod_reconciliation_runs');
    expect(podMigration).toContain("status in ('running', 'success', 'partial', 'failure')");
    expect(podMigration).toContain('intents_scanned');
    expect(podMigration).toContain('storage_objects_removed');
    expect(podMigration).toContain('mismatch_count');
    expect(podMigration).toContain('failure_count');
    expect(podMigration).toContain('consecutive_failures');
    expect(podMigration).toContain('run_record.consecutive_failures >= 3');
  });

  it('continues bounded item processing and never broad-deletes storage', () => {
    expect(podMigration).toContain('for update skip locked');
    expect(podMigration).toContain('begin');
    expect(podMigration).toContain('exception when others then');
    expect(podMigration).toContain('intent.evidence_id is not null');
    expect(podMigration).toContain('bucket_id = intent.storage_bucket');
    expect(podMigration).toContain('name = intent.storage_path');
    expect(podMigration).toContain('owner_id = intent.uploaded_by');
    expect(podMigration).not.toMatch(/delete\s+from\s+storage\.objects\s+where[\s\S]{0,160}like/i);
    expect(podMigration).toContain("status = 'pending'");
  });

  it('exposes health through a bounded manager summary and keeps raw run rows private', () => {
    expect(podMigration).toContain('create or replace function public.get_pod_reconciliation_health()');
    expect(podMigration).toContain('grant execute on function public.get_pod_reconciliation_health() to authenticated');
    expect(podMigration).toContain('revoke all on public.pod_reconciliation_runs from public, anon, authenticated');
    expect(podMigration).toContain('recent_runs');
    expect(podMigration).toContain('limit 20');
  });
});

describe('Batch 15 security and zero-inference contracts', () => {
  it('hardens only authenticated identity helpers and fixes their search paths', () => {
    for (const functionName of ['get_my_company_id', 'get_my_role', 'get_auth_user_company', 'get_auth_user_company_id', 'get_user_company_id', 'is_manager', 'check_is_manager']) {
      expect(securityMigration).toContain(`revoke all on function public.${functionName}() from public, anon`);
      expect(securityMigration).toContain(`grant execute on function public.${functionName}() to authenticated`);
    }
    expect(securityMigration).toContain('alter function public.check_is_manager() set search_path = public, pg_temp');
    expect(securityMigration).toContain('alter function public.get_auth_user_company_id() set search_path = public, pg_temp');
    expect(securityMigration).toContain('alter function public.is_manager() set search_path = public, pg_temp');
    expect(securityMigration).not.toContain('accept_driver_invite');
    expect(securityMigration).not.toContain('validate_auth_code');
  });

  it('keeps Atlas deterministic and provider-free', () => {
    for (const file of [atlasMigration, atlasClient]) {
      expect(file.toLowerCase()).not.toContain('openai');
      expect(file.toLowerCase()).not.toContain('anthropic');
      expect(file.toLowerCase()).not.toContain('modelgateway');
    }
  });
});
