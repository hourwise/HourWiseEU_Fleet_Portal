import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function readRepoFile(relativePath: string) {
  return readFileSync(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

function extractPolicy(sql: string, policyName: string) {
  const escapedPolicyName = policyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sql.match(new RegExp(`create policy "${escapedPolicyName}"[\\s\\S]*?;`, 'i'));
  return match?.[0] ?? '';
}

describe('tachograph cross-tenant storage policy regressions', () => {
  const hardeningMigration = readRepoFile('supabase/migrations/20260703090000_harden_tachograph_storage_rls.sql');

  it('keeps tachograph uploads scoped to an authenticated manager company folder', () => {
    const policy = extractPolicy(hardeningMigration, 'Managers can insert own company tachograph objects');

    expect(policy).toContain("bucket_id = 'tachograph-files'");
    expect(policy).toContain('on storage.objects for insert');
    expect(policy).toContain('to authenticated');
    expect(policy).toContain('(storage.foldername(name))[1]');
    expect(policy).toContain("public.get_my_role() = 'manager'");
    expect(policy).toContain('public.get_my_company_id()::text');
    expect(policy).not.toMatch(/\bto\s+(anon|public)\b/i);
  });

  it('keeps tachograph reads scoped to an authenticated manager company folder', () => {
    const policy = extractPolicy(hardeningMigration, 'Managers can read own company tachograph objects');

    expect(policy).toContain("bucket_id = 'tachograph-files'");
    expect(policy).toContain('on storage.objects for select');
    expect(policy).toContain('to authenticated');
    expect(policy).toContain('(storage.foldername(name))[1]');
    expect(policy).toContain("public.get_my_role() = 'manager'");
    expect(policy).toContain('public.get_my_company_id()::text');
    expect(policy).not.toMatch(/\bto\s+(anon|public)\b/i);
  });

  it('revokes normal authenticated update and delete access to raw tachograph storage objects', () => {
    expect(hardeningMigration).toContain('drop policy if exists "Managers can update tachograph files" on storage.objects');
    expect(hardeningMigration).toContain('drop policy if exists "Managers can delete tachograph files" on storage.objects');
    expect(hardeningMigration).not.toMatch(/create policy "[^"]*tachograph[^"]*"\s+on storage\.objects for update/i);
    expect(hardeningMigration).not.toMatch(/create policy "[^"]*tachograph[^"]*"\s+on storage\.objects for delete/i);
  });

  it('narrows tachograph import metadata policies away from broad ALL access', () => {
    expect(hardeningMigration).toContain('drop policy if exists "Managers can view company tacho files" on public.tachograph_files');
    expect(hardeningMigration).toContain('on public.tachograph_files for insert');
    expect(hardeningMigration).toContain('on public.tachograph_files for select');
    expect(hardeningMigration).not.toMatch(/on public\.tachograph_files for (all|update|delete)/i);
    expect(hardeningMigration).toContain('split_part(file_path, \'/\', 1) = company_id::text');
  });

  it('routes browser metadata patches through a scoped RPC instead of direct table update policy', () => {
    expect(hardeningMigration).toContain('create or replace function public.patch_tachograph_import_metadata');
    expect(hardeningMigration).toContain('where id = p_import_id');
    expect(hardeningMigration).toContain('and company_id = public.get_my_company_id()');
    expect(hardeningMigration).toContain('grant execute on function public.patch_tachograph_import_metadata(uuid, jsonb) to authenticated');
  });

  it('keeps raw tachograph evidence identity fields immutable for normal authenticated updates', () => {
    expect(hardeningMigration).toContain('enforce_tachograph_files_raw_identity_immutability');
    expect(hardeningMigration).toContain("old.company_id is distinct from new.company_id");
    expect(hardeningMigration).toContain("old.file_path is distinct from new.file_path");
    expect(hardeningMigration).toContain("old.filename is distinct from new.filename");
    expect(hardeningMigration).toContain("old.file_type is distinct from new.file_type");
    expect(hardeningMigration).toContain("old.uploaded_at is distinct from new.uploaded_at");
    expect(hardeningMigration).toContain("old.source_type is distinct from new.source_type");
    expect(hardeningMigration).toContain("auth.role(), '') in ('service_role', 'supabase_admin')");
  });
});

describe('tachograph raw storage immutability client regressions', () => {
  const api = readRepoFile('src/lib/tacho/api.ts');
  const helperImport = readRepoFile('src/lib/tacho/helperImport.ts');
  const importCentre = readRepoFile('src/components/manager/tachograph/TachoImportCentre.tsx');

  it('does not attempt browser-side deletion from the tachograph-files bucket', () => {
    expect(api).not.toMatch(/from\('tachograph-files'\)[\s\S]*?\.remove\(/);
    expect(importCentre).not.toContain('Archive + Delete File');
    expect(importCentre).toContain('Raw storage, import rows, derived rows, parser runs, and driver signals were retained for audit.');
  });

  it('does not patch tachograph import metadata with direct browser table updates', () => {
    expect(helperImport).toContain("supabase.rpc('patch_tachograph_import_metadata'");
    expect(helperImport).not.toMatch(/from\('tachograph_files' as never\)[\s\S]*?\.update\(/);
  });
});

describe('driver-card reset retention regressions', () => {
  const archiveResetMigration = readRepoFile('supabase/migrations/20260703103000_archive_driver_card_reset_flows.sql');
  const api = readRepoFile('src/lib/tacho/api.ts');
  const adapters = readRepoFile('src/lib/tacho/adapters.ts');
  const importCentre = readRepoFile('src/components/manager/tachograph/TachoImportCentre.tsx');

  it('converts company driver-card reset to archive-only without deleting import or derived rows', () => {
    expect(archiveResetMigration).toContain('create or replace function public.purge_company_driver_card_reads');
    expect(archiveResetMigration).toContain("'driver_card_retention_state', 'archived'");
    expect(archiveResetMigration).toContain("'driver_card_purge_existing_rows_retained', true");
    expect(archiveResetMigration).toContain("'driver_card_purge_storage_objects_retained', true");
    expect(archiveResetMigration).toContain("'archived', true");
    expect(archiveResetMigration).toContain("'deleted', false");
    expect(archiveResetMigration).not.toMatch(/\bdelete\s+from\s+public\./i);
  });

  it('keeps reprocess preparation from clearing parser or derived history', () => {
    expect(archiveResetMigration).toContain('create or replace function public.prepare_tacho_import_reprocess');
    expect(archiveResetMigration).toContain("'manager_reprocess_strategy', 'archive_only_preserve_existing_rows'");
    expect(archiveResetMigration).toContain("'manager_reprocess_existing_rows_retained', true");
    expect(archiveResetMigration).toContain("'existingRowsRetained', true");
    expect(archiveResetMigration).not.toMatch(/delete\s+from\s+public\.tachograph_processing_runs/i);
  });

  it('hides archive-only reset rows through the existing archived import adapter field', () => {
    expect(adapters).toContain('metadata.driver_card_purge_archived_at');
    expect(adapters).toContain('metadata.driver_card_purge_archive_reason');
  });

  it('does not expose destructive driver-card reset language or storage delete options in the Import Centre', () => {
    expect(api).not.toContain('deleteStorageFiles');
    expect(importCentre).toContain('Archive Card Reads');
    expect(importCentre).toContain('ARCHIVE CARD READS');
    expect(importCentre).toContain('Raw storage, import rows, derived rows, parser runs, and driver signals were retained for audit.');
    expect(importCentre).not.toContain('Delete Card Reads');
    expect(importCentre).not.toContain('DELETE CARD READS');
    expect(importCentre).not.toContain('Also delete storage files');
  });
});

describe('parser-run lifecycle regressions', () => {
  const parserRunLifecycleMigration = readRepoFile('supabase/migrations/20260703113000_extend_parser_run_lifecycle.sql');
  const processTachoFunction = readRepoFile('supabase/functions/process-tacho/index.ts');

  it('extends parser runs with versioned lifecycle and supersession fields', () => {
    expect(parserRunLifecycleMigration).toContain('alter table public.tachograph_processing_runs');
    expect(parserRunLifecycleMigration).toContain('add column if not exists parser_name text');
    expect(parserRunLifecycleMigration).toContain('add column if not exists parser_config_json jsonb');
    expect(parserRunLifecycleMigration).toContain('add column if not exists status text');
    expect(parserRunLifecycleMigration).toContain('add column if not exists started_at timestamptz');
    expect(parserRunLifecycleMigration).toContain('add column if not exists completed_at timestamptz');
    expect(parserRunLifecycleMigration).toContain('add column if not exists duration_ms integer');
    expect(parserRunLifecycleMigration).toContain('add column if not exists error_summary text');
    expect(parserRunLifecycleMigration).toContain('add column if not exists triggered_by text');
    expect(parserRunLifecycleMigration).toContain('add column if not exists supersedes_parser_run_id uuid');
    expect(parserRunLifecycleMigration).toContain('add column if not exists is_current boolean');
    expect(parserRunLifecycleMigration).toContain('add column if not exists run_sequence integer');
    expect(parserRunLifecycleMigration).toContain("'running'::text");
    expect(parserRunLifecycleMigration).toContain("'completed_with_warnings'::text");
    expect(parserRunLifecycleMigration).toContain("'failed'::text");
  });

  it('stores parser outputs and parser errors separately from the raw import row', () => {
    expect(parserRunLifecycleMigration).toContain('create table if not exists public.tachograph_parser_outputs');
    expect(parserRunLifecycleMigration).toContain('parser_run_id uuid not null references public.tachograph_processing_runs(id) on delete cascade');
    expect(parserRunLifecycleMigration).toContain('output_type text not null');
    expect(parserRunLifecycleMigration).toContain('payload jsonb not null');
    expect(parserRunLifecycleMigration).toContain('create table if not exists public.tachograph_parser_errors');
    expect(parserRunLifecycleMigration).toContain('severity text not null');
    expect(parserRunLifecycleMigration).toContain('error_code text not null');
    expect(parserRunLifecycleMigration).toContain('message text not null');
  });

  it('links newly derived tachograph records back to the parser run where practical', () => {
    const parserRunLinkedTables = [
      'public.driver_card_downloads',
      'public.vehicle_unit_downloads',
      'public.tachograph_activity_segments',
      'public.tachograph_day_summaries',
      'public.tachograph_findings',
      'public.tachograph_technical_events',
      'public.tachograph_vehicle_motion_discrepancies',
      'public.tachograph_reconciliation_items',
    ];

    for (const tableName of parserRunLinkedTables) {
      expect(parserRunLifecycleMigration).toContain(`alter table if exists ${tableName}`);
      expect(parserRunLifecycleMigration).toContain('add column if not exists parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null');
    }
  });

  it('creates a parser run before parsing and completes the same run instead of inserting late-only audit rows', () => {
    expect(processTachoFunction).toContain('async function createParserRun');
    expect(processTachoFunction).toContain('async function completeParserRun');
    expect(processTachoFunction).toContain('status: "running"');
    expect(processTachoFunction).toContain('supersedes_parser_run_id: supersedesParserRunId');
    expect(processTachoFunction).toContain('parserRun = await createParserRun(supabaseAdmin, record, authorizedActor)');
    expect(processTachoFunction).toContain('await completeParserRun(supabaseAdmin, parserRun');
    expect(processTachoFunction).toContain('withParserRunId(normalizedActivities, parserRun.id)');
    expect(processTachoFunction).toContain('tachograph_parser_outputs');
    expect(processTachoFunction).toContain('tachograph_parser_errors');
  });

  it('does not delete parser-run history during import cleanup or reprocessing', () => {
    expect(processTachoFunction).not.toMatch(/from\("tachograph_processing_runs"\)[\s\S]{0,160}\.delete\(/);
    expect(processTachoFunction).not.toMatch(/delete\s+from\s+public\.tachograph_processing_runs/i);
    expect(parserRunLifecycleMigration).not.toMatch(/delete\s+from\s+public\.tachograph_processing_runs/i);
  });
});

describe('timeline generation schema regressions', () => {
  const timelineMigration = readRepoFile('supabase/migrations/20260703123000_add_timeline_generation_event_schema.sql');

  it('creates versioned timeline generation and derived event tables', () => {
    expect(timelineMigration).toContain('create table if not exists public.timeline_generations');
    expect(timelineMigration).toContain('create table if not exists public.timeline_events');
    expect(timelineMigration).toContain('create table if not exists public.timeline_event_sources');
    expect(timelineMigration).toContain('create table if not exists public.timeline_gaps');
    expect(timelineMigration).toContain('create table if not exists public.daily_timeline_summaries');
  });

  it('keeps timeline generations versioned, current-aware, and parser-run traceable', () => {
    expect(timelineMigration).toContain('generation_version text not null default \'timeline-mvp@1\'');
    expect(timelineMigration).toContain('status text not null default \'running\'');
    expect(timelineMigration).toContain('is_current boolean not null default true');
    expect(timelineMigration).toContain('generated_reason text not null default \'initial_import\'');
    expect(timelineMigration).toContain('source_import_id uuid null references public.tachograph_files(id) on delete set null');
    expect(timelineMigration).toContain('parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null');
    expect(timelineMigration).toContain('supersedes_generation_id uuid null references public.timeline_generations(id) on delete set null');
    expect(timelineMigration).toContain('superseded_by_generation_id uuid null references public.timeline_generations(id) on delete set null');
    expect(timelineMigration).toContain('constraint timeline_generations_range_check');
  });

  it('stores timeline event provenance through event sources and parser outputs', () => {
    expect(timelineMigration).toContain('timeline_generation_id uuid not null references public.timeline_generations(id) on delete cascade');
    expect(timelineMigration).toContain('parser_run_id uuid null references public.tachograph_processing_runs(id) on delete set null');
    expect(timelineMigration).toContain('import_file_id uuid null references public.tachograph_files(id) on delete set null');
    expect(timelineMigration).toContain('parser_output_id uuid null references public.tachograph_parser_outputs(id) on delete set null');
    expect(timelineMigration).toContain('source_reference_json jsonb not null default');
    expect(timelineMigration).toContain('tachograph_activity_segment');
    expect(timelineMigration).toContain('tachograph_technical_event');
    expect(timelineMigration).toContain('vehicle_motion_discrepancy');
    expect(timelineMigration).toContain('tachograph_reconciliation_item');
  });

  it('models gaps as reviewable evidence-quality records rather than findings', () => {
    expect(timelineMigration).toContain('create table if not exists public.timeline_gaps');
    expect(timelineMigration).toContain('gap_type text not null');
    expect(timelineMigration).toContain('severity text not null default \'medium\'');
    expect(timelineMigration).toContain('status text not null default \'open\'');
    expect(timelineMigration).toContain('missing_driver_card_data');
    expect(timelineMigration).toContain('missing_vehicle_unit_data');
    expect(timelineMigration).toContain('unknown_driver');
    expect(timelineMigration).toContain('app_tacho_mismatch');
    expect(timelineMigration).toContain('constraint timeline_gaps_time_order_check');
  });

  it('enables explicit tenant-scoped read RLS for timeline tables', () => {
    const timelineTables = [
      'public.timeline_generations',
      'public.timeline_events',
      'public.timeline_event_sources',
      'public.timeline_gaps',
      'public.daily_timeline_summaries',
    ];

    for (const tableName of timelineTables) {
      expect(timelineMigration).toContain(`alter table ${tableName} enable row level security`);
    }

    expect(timelineMigration).toContain('Managers can read own company timeline generations');
    expect(timelineMigration).toContain('Managers can read own company timeline events');
    expect(timelineMigration).toContain('Managers can read own company timeline event sources');
    expect(timelineMigration).toContain('Managers can read own company timeline gaps');
    expect(timelineMigration).toContain('Managers can read own company daily timeline summaries');
    expect(timelineMigration).toContain('company_id = public.get_my_company_id()');
    expect(timelineMigration).toContain('public.get_my_role() = \'manager\'');
    expect(timelineMigration).toContain('Drivers can read own timeline events');
    expect(timelineMigration).toContain('driver_id = auth.uid()');
  });

  it('adds indexes for current generation, range reads, source lookup, gaps, and summaries', () => {
    expect(timelineMigration).toContain('idx_timeline_generations_driver_current');
    expect(timelineMigration).toContain('idx_timeline_generations_vehicle_current');
    expect(timelineMigration).toContain('idx_timeline_generations_import_current');
    expect(timelineMigration).toContain('idx_timeline_events_driver_range');
    expect(timelineMigration).toContain('idx_timeline_events_vehicle_range');
    expect(timelineMigration).toContain('idx_timeline_event_sources_reverse_lookup');
    expect(timelineMigration).toContain('idx_timeline_gaps_driver_queue');
    expect(timelineMigration).toContain('idx_daily_timeline_summaries_driver');
  });
});

describe('timeline generation implementation regressions', () => {
  const processTachoFunction = readRepoFile('supabase/functions/process-tacho/index.ts');
  const timelineReadModelMigration = readRepoFile('supabase/migrations/20260703133000_add_timeline_generation_read_models.sql');
  const pairingTimelineMigration = readRepoFile('supabase/migrations/20260705103000_update_tacho_pairing_timeline_rows.sql');
  const api = readRepoFile('src/lib/tacho/api.ts');

  it('generates import-scoped timeline rows from parser-derived tachograph rows', () => {
    expect(processTachoFunction).toContain('const TIMELINE_GENERATION_VERSION = "timeline-mvp@1"');
    expect(processTachoFunction).toContain('async function generateImportTimeline');
    expect(processTachoFunction).toContain('.from("tachograph_activity_segments")');
    expect(processTachoFunction).toContain('.from("tachograph_technical_events")');
    expect(processTachoFunction).toContain('.from("tachograph_vehicle_motion_discrepancies")');
    expect(processTachoFunction).toContain('.from("tachograph_reconciliation_items")');
    expect(processTachoFunction).toContain('.from("timeline_generations")');
    expect(processTachoFunction).toContain('.from("timeline_events")');
    expect(processTachoFunction).toContain('.from("timeline_event_sources")');
    expect(processTachoFunction).toContain('.from("timeline_gaps")');
    expect(processTachoFunction).toContain('.from("daily_timeline_summaries")');
  });

  it('marks timeline generations current only after successful row generation', () => {
    expect(processTachoFunction).toContain('status: "running"');
    expect(processTachoFunction).toContain('is_current: false');
    expect(processTachoFunction).toContain('status: "superseded"');
    expect(processTachoFunction).toContain('superseded_by_generation_id: generation.id');
    expect(processTachoFunction).toContain('status: gapRows.length > 0 ? "completed_with_warnings" : "completed"');
    expect(processTachoFunction).toContain('is_current: true');
    expect(processTachoFunction).toContain('status: "failed"');
  });

  it('wires timeline generation into both standard and HourWise parser paths', () => {
    expect(processTachoFunction.match(/generateImportTimeline\(supabaseAdmin, record, parserRun/g)?.length).toBe(2);
    expect(processTachoFunction).toContain('timeline_generation_id: timelineGeneration.generationId');
    expect(processTachoFunction).toContain('timeline_event_count: timelineGeneration.eventCount');
    expect(processTachoFunction).toContain('timeline_gap_count: timelineGeneration.gapCount');
    expect(processTachoFunction).toContain('timeline_daily_summary_count: timelineGeneration.dailySummaryCount');
  });

  it('keeps manual card pairing aligned with timeline read models', () => {
    expect(pairingTimelineMigration).toContain('create or replace function public.pair_tacho_card_import_to_driver');
    expect(pairingTimelineMigration).toContain('public.timeline_generations');
    expect(pairingTimelineMigration).toContain('public.timeline_events');
    expect(pairingTimelineMigration).toContain('public.timeline_gaps');
    expect(pairingTimelineMigration).toContain('public.daily_timeline_summaries');
    expect(pairingTimelineMigration).toContain('source_import_id = p_import_id');
    expect(pairingTimelineMigration).toContain('import_file_id = p_import_id');
  });

  it('adds read-only timeline bundle RPCs scoped by manager company', () => {
    expect(timelineReadModelMigration).toContain('create or replace function public.get_import_timeline_bundle');
    expect(timelineReadModelMigration).toContain('create or replace function public.get_driver_timeline_bundle');
    expect(timelineReadModelMigration).toContain('create or replace function public.get_vehicle_timeline_bundle');
    expect(timelineReadModelMigration).toContain('security definer');
    expect(timelineReadModelMigration).toContain('public.get_my_role() = \'manager\'');
    expect(timelineReadModelMigration).toContain('public.get_my_company_id() = p_company_id');
    expect(timelineReadModelMigration).toContain('grant execute on function public.get_import_timeline_bundle(uuid, uuid) to authenticated');
    expect(timelineReadModelMigration).toContain('grant execute on function public.get_driver_timeline_bundle(uuid, uuid, text) to authenticated');
    expect(timelineReadModelMigration).toContain('grant execute on function public.get_vehicle_timeline_bundle(uuid, uuid, text) to authenticated');
  });

  it('wires timeline bundle reads behind existing tachograph API fetchers without replacing them', () => {
    expect(api).toContain("driverTimelineBundle: 'get_driver_timeline_bundle'");
    expect(api).toContain("vehicleTimelineBundle: 'get_vehicle_timeline_bundle'");
    expect(api).toContain("importTimelineBundle: 'get_import_timeline_bundle'");
    expect(api).toContain('export async function fetchImportTimelineBundle');
    expect(api).toContain('export async function fetchDriverTimelineBundle');
    expect(api).toContain('export async function fetchVehicleTimelineBundle');
    expect(api).toContain('attachTimelineComparison');
    expect(api).toContain('Timeline bundle unavailable; existing tachograph bundle used for display.');
    expect(api).toMatch(/fetchTachoImportBundle[\s\S]*?supabase\.rpc\(TACHO_RPC\.importBundle[\s\S]*?fetchImportTimelineBundle/i);
  });
});

describe('tachograph cross-tenant read contract regressions', () => {
  const normalizedTachoMigration = readRepoFile('supabase/migrations/20260509193000_add_normalized_tacho_contract.sql');
  const api = readRepoFile('src/lib/tacho/api.ts');

  it('keeps driver analysis reads scoped by both company and driver', () => {
    expect(normalizedTachoMigration).toMatch(
      /create or replace function public\.get_driver_tacho_analysis_bundle[\s\S]*?where tf\.company_id = p_company_id[\s\S]*?and tf\.driver_id = p_driver_id/i
    );
    expect(normalizedTachoMigration).toMatch(
      /from public\.tachograph_activity_segments s[\s\S]*?where s\.company_id = p_company_id[\s\S]*?and s\.driver_id = p_driver_id/i
    );
    expect(api).toMatch(
      /fetchDriverTachoAnalysisBundle[\s\S]*?supabase\.rpc\(TACHO_RPC\.driverAnalysisBundle[\s\S]*?p_company_id: companyId[\s\S]*?p_driver_id: driverId/i
    );
  });

  it('keeps vehicle analysis reads scoped by both company and vehicle', () => {
    expect(normalizedTachoMigration).toMatch(
      /create or replace function public\.get_vehicle_unit_analysis_bundle[\s\S]*?where tf\.company_id = p_company_id[\s\S]*?and tf\.vehicle_id = p_vehicle_id/i
    );
    expect(normalizedTachoMigration).toMatch(
      /from public\.tachograph_activity_segments s[\s\S]*?where s\.company_id = p_company_id[\s\S]*?and s\.vehicle_id = p_vehicle_id/i
    );
    expect(api).toMatch(
      /fetchVehicleUnitAnalysisBundle[\s\S]*?supabase\.rpc\(TACHO_RPC\.vehicleAnalysisBundle[\s\S]*?p_company_id: companyId[\s\S]*?p_vehicle_id: vehicleId/i
    );
  });

  it('keeps import bundle reads scoped by company and import id', () => {
    expect(normalizedTachoMigration).toMatch(
      /create or replace function public\.get_tacho_import_bundle[\s\S]*?where tf\.company_id = p_company_id[\s\S]*?and tf\.id = p_import_id/i
    );
    expect(api).toMatch(
      /fetchTachoImportBundle[\s\S]*?supabase\.rpc\(TACHO_RPC\.importBundle[\s\S]*?p_company_id: companyId[\s\S]*?p_import_id: importId/i
    );
  });
});
