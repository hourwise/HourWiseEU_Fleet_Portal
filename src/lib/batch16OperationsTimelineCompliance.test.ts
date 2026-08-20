import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDriverComplianceForecast, type DriverComplianceEvidence } from './driverComplianceForecast';
import { reconcileSourceDrivenHandling, type OperationalTask } from './operationalTaskQueue';
import { buildRoutePlan, validateProviderCapabilities, type RouteRequest } from './routePlanning';

const timelineMigration = readFileSync('supabase/migrations/20260820204758_batch16_operational_timeline.sql', 'utf8');
const podMigration = readFileSync('supabase/migrations/20260820204801_batch16_pod_alerting_retention.sql', 'utf8');
const securityMigration = readFileSync('supabase/migrations/20260820204802_batch16_compliance_security_hardening.sql', 'utf8');
const atlasLoad = readFileSync('src/lib/atlasOperationalLoad.ts', 'utf8');

describe('Batch 16 operations timeline and POD contracts', () => {
  it('projects a bounded manager timeline without a duplicate event table or raw metadata', () => {
    expect(timelineMigration).toContain('create or replace function public.list_manager_operational_timeline');
    expect(timelineMigration).toContain('set search_path = public, pg_temp');
    expect(timelineMigration).toContain('result_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100)');
    expect(timelineMigration).toContain('grant execute on function public.list_manager_operational_timeline');
    expect(timelineMigration).toContain('fleet_events');
    expect(timelineMigration).toContain('atlas_proposals');
    expect(timelineMigration).toContain('operational_task_handlings');
    expect(timelineMigration).toContain('job_evidence');
    expect(timelineMigration).toContain('driver_documents');
    expect(timelineMigration).not.toContain('create table public.operational_timeline');
    expect(timelineMigration).not.toContain("'metadata'");
    expect(timelineMigration).not.toContain("'storagePath'");
  });

  it('keeps POD alert fingerprints stable and retention bounded to run metadata', () => {
    expect(podMigration).toContain("'pod-reconciliation:consecutive-failures'");
    expect(podMigration).toContain("'pod-reconciliation:consecutive-partials'");
    expect(podMigration).toContain("'pod-reconciliation:stale-backlog'");
    expect(podMigration).toContain("'pod-reconciliation:overdue'");
    expect(podMigration).toContain("make_interval(days => coalesce(p_retention_days, 180))");
    expect(podMigration).toContain('p_keep_latest integer default 500');
    expect(podMigration).not.toMatch(/delete\s+from\s+public\.job_evidence/i);
    expect(podMigration).not.toMatch(/delete\s+from\s+public\.job_evidence_upload_intents/i);
    expect(atlasLoad).toContain('fetchPodReconciliationHealth({ syncSignals: false })');
  });
});

describe('Batch 16 driver compliance source contracts', () => {
  const baseEvidence: DriverComplianceEvidence = {
    driverId: 'driver-1', driverLabel: 'Alex Driver', drivingLicenceNumber: 'LIC-1', drivingLicenceExpiry: '2026-09-01',
    cpcDqcNumber: 'CPC-1', cpcDqcExpiry: '2026-12-01', medicalDocuments: [{ id: 'doc-1', documentType: 'D4 medical', expiryDate: null, verifiedAt: '2026-08-01T00:00:00Z' }],
  };

  it('flags a medical document with no expiry separately from no medical document', () => {
    const item = buildDriverComplianceForecast(baseEvidence, new Date('2026-08-20T09:00:00Z')).find((value) => value.evidenceType === 'medical');
    expect(item).toMatchObject({ status: 'unknown', evidenceSource: 'driver_document', missingEvidence: true });
  });

  it('reopens a resolved compliance handling while the authoritative projection remains actionable', () => {
    const task: OperationalTask = { id: 'driver-compliance:driver-1', severity: 'high', category: 'drivers', title: 'Compliance', detail: 'Needs evidence', sourceType: 'driver_compliance', sourceId: 'driver-1', occurredAt: null, dueAt: null, navigationTarget: '/dashboard?workspace=people&people=drivers', actionable: true };
    const handling = reconcileSourceDrivenHandling(task, { id: 'handling-1', sourceType: 'driver_compliance', sourceId: 'driver-1', status: 'resolved', ownerId: 'manager-1', action: 'manager_handling_recorded', note: 'done', updatedAt: '2026-08-20T09:00:00Z', resolvedAt: '2026-08-20T09:00:00Z' });
    expect(handling?.status).toBe('new');
    expect(handling?.resolvedAt).toBeNull();
  });

  it('keeps future compliance conflicts as planning signals', () => {
    const requestDate = new Date('2026-08-20T09:00:00Z');
    const item = buildDriverComplianceForecast({ ...baseEvidence, drivingLicenceExpiry: '2026-08-21' }, requestDate, [{ id: 'assignment-1', plannedDate: '2026-08-22' }]).find((value) => value.evidenceType === 'driving_licence');
    expect(item?.planningRisk).toBe('planned_after_expiry');
  });
});

describe('Batch 16 routing and security boundaries', () => {
  it('keeps routing provider-neutral and refuses unsupported capability claims', () => {
    const plan = buildRoutePlan([{ id: 'stop-1', sequence: 1, stopType: 'delivery', siteName: 'Depot', addressText: '1 Main Street', latitude: null, longitude: null, instructions: null, driverNotes: null, arrivalWindowStart: null, arrivalWindowEnd: null, activity: null }], { vehicleId: 'vehicle-1', profileVersion: 'v1', vehicleType: 'hgv', heightMetres: 4.1 });
    expect(plan.state).toBe('provider_unavailable');
    expect(plan.message).toMatch(/unavailable/i);
    expect(plan.message).not.toMatch(/\b\d+\s*(km|miles|minutes|hours)\b/i);
    expect(plan.request?.provider).toBe('unconfigured');
    const request = plan.request as RouteRequest;
    expect(validateProviderCapabilities({ stops: request.stops, vehicleProfile: request.vehicleProfile, options: { requireHgvRouting: true } }, request.providerCapabilities).some((value) => value.includes('HGV routing'))).toBe(true);
  });

  it('pins reviewed legacy paths and preserves only intentional onboarding exposure', () => {
    expect(securityMigration).toContain('alter function public.accept_driver_invite(text) set search_path = public, pg_temp');
    expect(securityMigration).toContain('revoke all on function public.accept_driver_invite(uuid, uuid) from public, anon, authenticated');
    expect(securityMigration).toContain('prevent_stale_driver_compliance_resolution');
    expect(securityMigration).toContain('grant execute on function public.get_auth_user_role() to authenticated');
    expect(securityMigration).toContain('grant execute on function public.update_user_claims() to postgres');
    expect(securityMigration).not.toContain('grant execute on function public.validate_auth_code');
  });
});
