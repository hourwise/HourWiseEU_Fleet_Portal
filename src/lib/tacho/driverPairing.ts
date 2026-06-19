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

interface TachoPairingInviteRow {
  id: string;
  full_name: string | null;
  email: string | null;
  tacho_card_number: string | null;
  tacho_card_holder_name: string | null;
  tacho_card_expiry: string | null;
  tacho_card_issuing_authority: string | null;
  status: string | null;
}

export interface TachoPairingDriver {
  id: string;
  fullName: string;
  email?: string | null;
  tachoCardNumber?: string | null;
  isActive?: boolean | null;
}

export interface TachoPairingInvite {
  id: string;
  fullName: string;
  email?: string | null;
  tachoCardNumber?: string | null;
  tachoCardHolderName?: string | null;
  tachoCardExpiry?: string | null;
  tachoCardIssuingAuthority?: string | null;
  status?: string | null;
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

export interface PairTachoImportToInviteInput {
  companyId: string;
  inviteId: string;
  importId: string;
  cardNumber: string;
  holderName?: string | null;
  cardExpiry?: string | null;
  issuingAuthority?: string | null;
}

type QueryResult<T> = Promise<{ data: T | null; error: SupabaseQueryError | null }>;

interface DriverProfileQuery {
  eq(column: string, value: unknown): DriverProfileQuery;
  order(column: string, options?: { ascending?: boolean }): QueryResult<TachoPairingDriverRow[]>;
}

interface DriverInviteQuery {
  eq(column: string, value: unknown): DriverInviteQuery;
  order(column: string, options?: { ascending?: boolean }): QueryResult<TachoPairingInviteRow[]>;
}

interface DriverInviteUpdateQuery {
  update(values: Record<string, unknown>): {
    eq(column: string, value: unknown): {
      eq(column: string, value: unknown): {
        select(columns: string): {
          single(): QueryResult<TachoPairingInviteRow>;
        };
      };
    };
  };
}

interface TachoPairingSupabaseClient {
  from(table: 'profiles'): {
    select(columns: string): DriverProfileQuery;
  };
  from(table: 'driver_invites'): {
    select(columns: string): DriverInviteQuery;
  } & DriverInviteUpdateQuery;
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

export async function fetchTachoPairingInvites(companyId: string): Promise<TachoPairingInvite[]> {
  const { data, error } = await tachoPairingClient
    .from('driver_invites')
    .select('id, full_name, email, status, tacho_card_number, tacho_card_holder_name, tacho_card_expiry, tacho_card_issuing_authority')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('full_name', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name ?? 'Pending driver',
    email: row.email ?? null,
    tachoCardNumber: row.tacho_card_number ?? null,
    tachoCardHolderName: row.tacho_card_holder_name ?? null,
    tachoCardExpiry: row.tacho_card_expiry ?? null,
    tachoCardIssuingAuthority: row.tacho_card_issuing_authority ?? null,
    status: row.status ?? null,
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

export async function pairTachoImportToInvite(input: PairTachoImportToInviteInput): Promise<TachoPairingInvite> {
  const { data, error } = await tachoPairingClient
    .from('driver_invites')
    .update({
      tacho_card_number: input.cardNumber.trim().toUpperCase(),
      tacho_card_holder_name: input.holderName ?? null,
      tacho_card_expiry: input.cardExpiry ?? null,
      tacho_card_issuing_authority: input.issuingAuthority ?? null,
      tacho_source_import_id: input.importId,
    })
    .eq('id', input.inviteId)
    .eq('company_id', input.companyId)
    .select('id, full_name, email, status, tacho_card_number, tacho_card_holder_name, tacho_card_expiry, tacho_card_issuing_authority')
    .single();

  if (error) throw error;

  return {
    id: data?.id ?? input.inviteId,
    fullName: data?.full_name ?? 'Pending driver',
    email: data?.email ?? null,
    tachoCardNumber: data?.tacho_card_number ?? input.cardNumber,
    tachoCardHolderName: data?.tacho_card_holder_name ?? input.holderName ?? null,
    tachoCardExpiry: data?.tacho_card_expiry ?? input.cardExpiry ?? null,
    tachoCardIssuingAuthority: data?.tacho_card_issuing_authority ?? input.issuingAuthority ?? null,
    status: data?.status ?? 'pending',
  };
}
