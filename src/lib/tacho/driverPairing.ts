import { supabase } from '../supabase';

interface SupabaseQueryError {
  message: string;
}

interface TachoPairingDriverRow {
  id: string;
  full_name: string | null;
  email: string | null;
  tacho_card_number: string | null;
  is_active: boolean | null;
}

export interface TachoPairingDriver {
  id: string;
  fullName: string;
  email?: string | null;
  tachoCardNumber?: string | null;
  isActive?: boolean | null;
}

export interface PairTachoImportToDriverInput {
  companyId: string;
  importId: string;
  driverId: string;
  cardNumber: string;
}

export interface PairTachoImportToDriverResult {
  importId: string;
  driverId: string;
  driverName: string;
  cardNumber: string;
  paired: boolean;
}

type QueryResult<T> = Promise<{ data: T | null; error: SupabaseQueryError | null }>;

interface DriverProfileQuery {
  eq(column: string, value: unknown): DriverProfileQuery;
  order(column: string, options?: { ascending?: boolean }): QueryResult<TachoPairingDriverRow[]>;
}

interface TachoPairingSupabaseClient {
  from(table: 'profiles'): {
    select(columns: string): DriverProfileQuery;
  };
  rpc(
    functionName: 'pair_tacho_card_import_to_driver',
    params: Record<string, unknown>
  ): QueryResult<Partial<PairTachoImportToDriverResult>>;
}

const tachoPairingClient = supabase as unknown as TachoPairingSupabaseClient;

export async function fetchTachoPairingDrivers(companyId: string): Promise<TachoPairingDriver[]> {
  const { data, error } = await tachoPairingClient
    .from('profiles')
    .select('id, full_name, email, is_active, tacho_card_number')
    .eq('company_id', companyId)
    .eq('role', 'driver')
    .order('full_name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name ?? 'Unnamed driver',
    email: row.email ?? null,
    tachoCardNumber: row.tacho_card_number ?? null,
    isActive: row.is_active ?? null,
  }));
}

export async function pairTachoImportToDriver(
  input: PairTachoImportToDriverInput
): Promise<PairTachoImportToDriverResult> {
  const { data, error } = await tachoPairingClient.rpc('pair_tacho_card_import_to_driver', {
    p_company_id: input.companyId,
    p_import_id: input.importId,
    p_driver_id: input.driverId,
    p_card_number: input.cardNumber,
  });

  if (error) throw error;

  const result = (data ?? {}) as Partial<PairTachoImportToDriverResult>;
  return {
    importId: result.importId ?? input.importId,
    driverId: result.driverId ?? input.driverId,
    driverName: result.driverName ?? 'Selected driver',
    cardNumber: result.cardNumber ?? input.cardNumber,
    paired: result.paired ?? true,
  };
}
