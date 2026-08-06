import { describe, expect, it } from 'vitest';
import { normaliseAcknowledgements, normaliseDriverOperationalEvents } from './driverEvents';

describe('driver operational event read model', () => {
  it('keeps only complete driver-visible event rows and joins acknowledgements', () => {
    const acknowledgements = normaliseAcknowledgements([{ event_id: 'event-1', acknowledged_at: '2026-07-16T10:00:00Z' }]);
    expect(normaliseDriverOperationalEvents([
      { id: 'event-1', company_id: 'company-1', event_type: 'rota_shift_published', priority: 'info', title: 'Rota shift published', requires_ack: true, created_at: '2026-07-16T09:00:00Z' },
      { id: 'broken' },
    ], acknowledgements)).toEqual([
      expect.objectContaining({ id: 'event-1', requiresAck: true, acknowledgedAt: '2026-07-16T10:00:00Z' }),
    ]);
  });

  it('rejects unknown event priorities and malformed acknowledgement rows', () => {
    expect(normaliseAcknowledgements([{ event_id: 'event-1' }, null])).toEqual({});
    expect(normaliseDriverOperationalEvents([
      { id: 'event-1', company_id: 'company-1', event_type: 'rota_shift_published', priority: 'unknown', title: 'Rota shift published', requires_ack: true, created_at: '2026-07-16T09:00:00Z' },
    ])).toEqual([]);
  });
});
