import { supabase } from './supabase';

export interface DriverUpcomingShift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'published' | 'updated';
  notes: string | null;
  vehicleId: string | null;
  vehicleRegistration: string | null;
  vehicleDescription: string | null;
}

type QueryError = {
  message: string;
};

type QueryResult<T> = {
  data: T | null;
  error: QueryError | null;
};

interface PostgrestQueryLike<T> extends PromiseLike<QueryResult<T>> {
  eq(column: string, value: string): PostgrestQueryLike<T>;
  in(column: string, values: string[]): PostgrestQueryLike<T>;
  gte(column: string, value: string): PostgrestQueryLike<T>;
  lte(column: string, value: string): PostgrestQueryLike<T>;
  order(column: string, options?: { ascending?: boolean }): PostgrestQueryLike<T>;
}

interface RotaSupabaseLike {
  from(table: 'shifts'): {
    select<T = unknown>(columns: string): PostgrestQueryLike<T>;
  };
}

interface ShiftRow {
  id?: unknown;
  date?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  status?: unknown;
  notes?: unknown;
  vehicle_id?: unknown;
  vehicles?: unknown;
}

interface VehicleRow {
  reg_number?: unknown;
  make?: unknown;
  model?: unknown;
}

export function getUpcomingShiftWindow(baseDate = new Date(), daysAhead = 7) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + daysAhead);

  return {
    startDate: formatDateOnly(start),
    endDate: formatDateOnly(end),
  };
}

export async function fetchDriverUpcomingShifts(driverId: string, baseDate = new Date()): Promise<DriverUpcomingShift[]> {
  const { startDate, endDate } = getUpcomingShiftWindow(baseDate);
  const rotaSupabase = supabase as unknown as RotaSupabaseLike;

  const { data, error } = await rotaSupabase
    .from('shifts')
    .select<unknown>(`
      id,
      date,
      start_time,
      end_time,
      status,
      notes,
      vehicle_id,
      vehicles:vehicle_id(reg_number, make, model)
    `)
    .eq('driver_id', driverId)
    .in('status', ['published', 'updated'])
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    throw new Error(error.message || 'Unable to load upcoming shifts.');
  }

  return normaliseDriverShiftRows(data);
}

export function normaliseDriverShiftRows(rows: unknown): DriverUpcomingShift[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => normaliseDriverShiftRow(row))
    .filter((shift): shift is DriverUpcomingShift => Boolean(shift));
}

function normaliseDriverShiftRow(row: unknown): DriverUpcomingShift | null {
  if (!isRecord(row)) return null;

  const shift = row as ShiftRow;
  const id = asString(shift.id);
  const date = asString(shift.date);
  const startTime = asString(shift.start_time);
  const endTime = asString(shift.end_time);
  const status = normaliseDriverVisibleStatus(shift.status);

  if (!id || !date || !startTime || !endTime || !status) return null;

  const vehicle = normaliseVehicle(shift.vehicles);
  const vehicleId = asString(shift.vehicle_id);

  return {
    id,
    date,
    startTime,
    endTime,
    status,
    notes: asNullableString(shift.notes),
    vehicleId,
    vehicleRegistration: vehicle.regNumber,
    vehicleDescription: vehicle.description,
  };
}

function normaliseDriverVisibleStatus(value: unknown) {
  return value === 'published' || value === 'updated' ? value : null;
}

function normaliseVehicle(value: unknown) {
  const record = Array.isArray(value) ? value[0] : value;
  if (!isRecord(record)) {
    return { regNumber: null, description: null };
  }

  const vehicle = record as VehicleRow;
  const regNumber = asString(vehicle.reg_number);
  const make = asString(vehicle.make);
  const model = asString(vehicle.model);
  const description = [make, model].filter(Boolean).join(' ').trim() || null;

  return { regNumber, description };
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}
