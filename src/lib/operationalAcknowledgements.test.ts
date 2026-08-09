import { describe, expect, it } from 'vitest';
import {
  buildManagerAcknowledgementReadModel,
  normaliseManagerDriverAcknowledgements,
  normaliseManagerOperationalEvents,
} from './operationalAcknowledgements';
import {
  INITIAL_OPERATIONAL_ACKNOWLEDGEMENT_LOAD,
  operationalAcknowledgementLoadReducer,
} from './operationalAcknowledgementLoad';

const companyId = 'company-1';
const driverId = 'driver-1';

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    company_id: companyId,
    event_type: 'job_updated',
    related_shift_id: 'shift-1',
    recipient_driver_id: driverId,
    payload: { job_assignment_id: 'assignment-1' },
    requires_ack: true,
    created_at: '2026-08-09T10:00:00Z',
    ...overrides,
  };
}

describe('manager operational acknowledgement read model', () => {
  it('normalises only company-scoped, driver-specific relevant events and acks', () => {
    expect(normaliseManagerOperationalEvents([
      event(),
      event({ id: 'other-company', company_id: 'company-2' }),
      event({ id: 'broadcast', recipient_driver_id: null }),
      event({ id: 'unrelated', event_type: 'manager_message' }),
    ], companyId)).toHaveLength(1);

    expect(normaliseManagerDriverAcknowledgements([
      { company_id: companyId, event_id: 'event-1', driver_id: driverId, acknowledged_at: '2026-08-09T10:05:00Z' },
      { company_id: 'company-2', event_id: 'event-1', driver_id: driverId, acknowledged_at: '2026-08-09T10:06:00Z' },
      { company_id: companyId, event_id: 'event-1', driver_id: 'driver-2', acknowledged_at: '2026-08-09T10:07:00Z' },
    ], companyId)).toEqual(expect.arrayContaining([
      { companyId, eventId: 'event-1', driverId, acknowledgedAt: '2026-08-09T10:05:00Z' },
      { companyId, eventId: 'event-1', driverId: 'driver-2', acknowledgedAt: '2026-08-09T10:07:00Z' },
    ]));
  });

  it('selects the latest shift/job event deterministically and reports awaiting acknowledgement', () => {
    const events = normaliseManagerOperationalEvents([
      event({ id: 'job-old', created_at: '2026-08-09T09:00:00Z' }),
      event({ id: 'job-new', created_at: '2026-08-09T10:00:00Z' }),
      event({ id: 'shift-old', event_type: 'rota_shift_published', payload: {}, created_at: '2026-08-09T09:00:00Z' }),
      event({ id: 'shift-new', event_type: 'rota_shift_updated', payload: {}, created_at: '2026-08-09T10:00:00Z' }),
    ], companyId);
    const model = buildManagerAcknowledgementReadModel(events, []);

    expect(model.byAssignmentId['assignment-1']).toEqual(expect.objectContaining({
      eventId: 'job-new',
      eventType: 'job_updated',
      status: 'awaiting',
      acknowledgedAt: null,
    }));
    expect(model.byShiftId['shift-1']).toEqual(expect.objectContaining({
      eventId: 'shift-new',
      eventType: 'rota_shift_updated',
      status: 'awaiting',
    }));
  });

  it('reports acknowledged required events only for the matching event and driver', () => {
    const events = normaliseManagerOperationalEvents([event()], companyId);
    const acknowledgements = normaliseManagerDriverAcknowledgements([
      { company_id: companyId, event_id: 'event-1', driver_id: 'driver-2', acknowledged_at: '2026-08-09T10:05:00Z' },
      { company_id: companyId, event_id: 'event-1', driver_id: driverId, acknowledged_at: '2026-08-09T10:06:00Z' },
    ], companyId);
    expect(buildManagerAcknowledgementReadModel(events, acknowledgements).byAssignmentId['assignment-1']).toEqual(expect.objectContaining({
      status: 'acknowledged',
      acknowledgedAt: '2026-08-09T10:06:00Z',
    }));
  });

  it('does not show outstanding status when the latest relevant event does not require acknowledgement', () => {
    const events = normaliseManagerOperationalEvents([
      event({ requires_ack: true, created_at: '2026-08-09T09:00:00Z' }),
      event({ id: 'job-not-required', requires_ack: false, created_at: '2026-08-09T10:00:00Z' }),
    ], companyId);
    expect(buildManagerAcknowledgementReadModel(events, []).byAssignmentId['assignment-1']).toEqual(expect.objectContaining({
      eventId: 'job-not-required',
      status: 'not_required',
      acknowledgedAt: null,
    }));
  });

  it('supports cancelled historical events and keeps stale acknowledgement loads from winning', () => {
    const cancelled = normaliseManagerOperationalEvents([event({ id: 'cancelled', event_type: 'job_cancelled' })], companyId);
    const ack = normaliseManagerDriverAcknowledgements([
      { company_id: companyId, event_id: 'cancelled', driver_id: driverId, acknowledged_at: '2026-08-09T10:20:00Z' },
    ], companyId);
    const model = buildManagerAcknowledgementReadModel(cancelled, ack);
    expect(model.byAssignmentId['assignment-1']).toEqual(expect.objectContaining({
      eventType: 'job_cancelled',
      status: 'acknowledged',
    }));

    let state = operationalAcknowledgementLoadReducer(INITIAL_OPERATIONAL_ACKNOWLEDGEMENT_LOAD, {
      type: 'begin', requestToken: 1, scope: 'week-a',
    });
    state = operationalAcknowledgementLoadReducer(state, { type: 'begin', requestToken: 2, scope: 'week-b' });
    const stale = operationalAcknowledgementLoadReducer(state, {
      type: 'resolve', requestToken: 1, scope: 'week-a', model, error: null,
    });
    expect(stale).toEqual(state);
    const current = operationalAcknowledgementLoadReducer(state, {
      type: 'resolve', requestToken: 2, scope: 'week-b', model, error: null,
    });
    expect(current.loadedScope).toBe('week-b');
    expect(current.model.byAssignmentId['assignment-1']?.eventId).toBe('cancelled');
  });
});
