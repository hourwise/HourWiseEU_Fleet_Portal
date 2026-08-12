import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const vehicleDetails = readFileSync('src/components/manager/VehicleDetailsModal.tsx', 'utf8');
const vehicleChecks = readFileSync('src/components/manager/VehicleChecksModule.tsx', 'utf8');
const vehicleManagement = readFileSync('src/components/manager/VehicleManagement.tsx', 'utf8');
const broadcast = readFileSync('src/components/manager/BroadcastMessage.tsx', 'utf8');
const messagingHub = readFileSync('src/components/manager/MessagingHub.tsx', 'utf8');
const eventHistory = readFileSync('src/lib/operationalEventHistory.ts', 'utf8');
const incidentUi = readFileSync('src/components/manager/IncidentReporting.tsx', 'utf8');
const complianceSnapshot = readFileSync('src/components/manager/ComplianceSnapshot.tsx', 'utf8');
const complianceScoreboard = readFileSync('src/components/manager/ComplianceScoreboard.tsx', 'utf8');
const incidentMigration = readFileSync('supabase/migrations/20260812094906_govern_incident_follow_up.sql', 'utf8');

describe('Batch 8 private evidence contracts', () => {
  it('uses short-lived signed access for both private evidence buckets', () => {
    expect(vehicleDetails).toContain(".from('vehicle-documents')");
    expect(vehicleDetails).toContain('createSignedUrl(document.storage_path, 60');
    expect(vehicleChecks).toContain(".from('defect-photos')");
    expect(vehicleChecks).toContain('createSignedUrl(row.storage_path, 60)');
    expect(vehicleDetails).not.toContain('getPublicUrl');
    expect(vehicleChecks).not.toContain('getPublicUrl');
  });

  it('keeps deletion explicit, scoped, refreshable, and honest about partial failure', () => {
    expect(vehicleDetails).toContain('window.confirm');
    expect(vehicleDetails).toContain(".eq('vehicle_id', vehicle.id)");
    expect(vehicleDetails).toContain(".eq('company_id', document.company_id)");
    expect(vehicleDetails).toContain(".remove([document.storage_path])");
    expect(vehicleDetails).toContain('metadata cleanup failed');
    expect(vehicleDetails).toContain('await fetchData()');
    expect(vehicleManagement).toContain('Evidence stored');
    expect(vehicleManagement).not.toContain('Pending document verification');
  });
});

describe('Batch 8 EVENT-001 manager history contracts', () => {
  it('routes new dashboard broadcasts through the event-backed RPC', () => {
    expect(broadcast).toContain("supabase.rpc('send_manager_message_with_event'");
    expect(broadcast).not.toContain(".from('broadcasts')");
    expect(messagingHub).toContain('OperationalEventHistory');
  });

  it('keeps company scope and separates acknowledgement from message read state', () => {
    expect(eventHistory).toContain(".eq('company_id', companyId)");
    expect(eventHistory).toContain(".in('event_id', eventIds)");
    expect(eventHistory).toContain("'not_required'");
    expect(eventHistory).toContain("'acknowledged'");
    expect(eventHistory).toContain("'read'");
    expect(eventHistory).toContain("'sent'");
    expect(eventHistory).toContain('acknowledgementsByEvent');
  });
});

describe('Batch 8 incident follow-up authority contracts', () => {
  it('adds a narrowly scoped permission, guarded RPC, and direct-update bypass prevention', () => {
    expect(incidentMigration).toContain("'operations.incident.follow_up'");
    expect(incidentMigration).toContain('security definer');
    expect(incidentMigration).toContain('set search_path = public, pg_temp');
    expect(incidentMigration).toContain('revoke update on table public.incidents from public, anon, authenticated');
    expect(incidentMigration).toContain('public.actor_has_permission(permission_key, actor_company_id, null)');
    expect(incidentMigration).toContain('p_expected_updated_at');
    expect(incidentMigration).toContain('public.record_security_event');
    expect(incidentMigration).toContain('grant execute on function public.update_incident_follow_up');
    expect(incidentMigration).toContain("'reported', 'investigating', 'closed'");
    expect(incidentUi).toContain("supabase.rpc('update_incident_follow_up'");
    expect(incidentUi).toContain('IncidentDetailDrawer');
  });
});

describe('Batch 8 no-data truth contracts', () => {
  it('does not use empty compliance input as an authoritative score', () => {
    expect(complianceSnapshot).toContain('avgScore: null');
    expect(complianceSnapshot).toContain('Not assessed');
    expect(complianceScoreboard).toContain('hasEvidence');
    expect(complianceScoreboard).toContain('No evidence');
    expect(complianceScoreboard).toContain('avgScore: null');
  });

  it('does not call a vehicle that is merely not VOR fully ready or compliant', () => {
    expect(vehicleManagement).toContain('Not marked VOR');
    expect(vehicleManagement).toContain('Available status only');
    expect(vehicleManagement).toContain('verify defects and due dates separately');
  });
});
