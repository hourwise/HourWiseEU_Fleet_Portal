import { describe, expect, it } from 'vitest';
import { getUpcomingShiftWindow, normaliseDriverShiftRows } from './rota';

describe('driver rota helpers', () => {
  it('builds an inclusive today plus seven day window', () => {
    expect(getUpcomingShiftWindow(new Date('2026-07-09T12:30:00Z'))).toEqual({
      startDate: '2026-07-09',
      endDate: '2026-07-16',
    });
  });

  it('normalises Supabase shift rows and vehicle joins', () => {
    const shifts = normaliseDriverShiftRows([
      {
        id: 'shift-1',
        date: '2026-07-10',
        start_time: '08:00:00',
        end_time: '17:00:00',
        status: 'published',
        notes: 'Start at main yard',
        vehicle_id: 'vehicle-1',
        vehicles: {
          reg_number: 'AB12 CDE',
          make: 'Volvo',
          model: 'FH',
        },
      },
      {
        id: 'invalid-row',
        date: '2026-07-10',
        status: 'draft',
        start_time: '08:00:00',
        end_time: '17:00:00',
      },
    ]);

    expect(shifts).toEqual([
      {
        id: 'shift-1',
        date: '2026-07-10',
        startTime: '08:00:00',
        endTime: '17:00:00',
        status: 'published',
        notes: 'Start at main yard',
        vehicleId: 'vehicle-1',
        vehicleRegistration: 'AB12 CDE',
        vehicleDescription: 'Volvo FH',
      },
    ]);
  });
});
