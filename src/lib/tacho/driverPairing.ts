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
  recoveredFromClientError?: boolean;
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

function normalizeCardNumber(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? '';
}

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

  if (error) {
    const verifiedPairing = await verifyTachoImportDriverPairing(input).catch(() => null);
    if (verifiedPairing) {
      return verifiedPairing;
    }
    throw error;
  }

  const result = (data ?? {}) as Partial<PairTachoImportToDriverResult>;
  return {
    importId: result.importId ?? input.importId,
    driverId: result.driverId ?? input.driverId,
    driverName: result.driverName ?? 'Selected driver',
    cardNumber: result.cardNumber ?? input.cardNumber,
    paired: result.paired ?? true,
  };
}

async function verifyTachoImportDriverPairing(
  input: PairTachoImportToDriverInput
): Promise<PairTachoImportToDriverResult | null> {
  const [{ data: importRow, error: importError }, { data: driverRow, error: driverError }] = await Promise.all([
    supabase
      .from('tachograph_files' as never)
      .select('driver_id, external_card_number, metadata')
      .eq('id', input.importId)
      .eq('company_id', input.companyId)
      .maybeSingle(),
    supabase
      .from('profiles' as never)
      .select('id, full_name, tacho_card_number')
      .eq('id', input.driverId)
      .eq('company_id', input.companyId)
      .maybeSingle(),
  ]);

  if (importError || driverError || !importRow || !driverRow) return null;

  const importData = importRow as {
    driver_id?: string | null;
    external_card_number?: string | null;
    metadata?: Record<string, unknown> | null;
  };
  const driverData = driverRow as {
    id?: string | null;
    full_name?: string | null;
    tacho_card_number?: string | null;
  };
  const metadataCardNumber =
    typeof importData.metadata?.driver_card_number_hint === 'string'
      ? importData.metadata.driver_card_number_hint
      : null;
  const pairedCardNumber = normalizeCardNumber(
    importData.external_card_number ?? metadataCardNumber ?? driverData.tacho_card_number
  );
  const expectedCardNumber = normalizeCardNumber(input.cardNumber);

  if (
    importData.driver_id !== input.driverId ||
    driverData.id !== input.driverId ||
    !pairedCardNumber ||
    (expectedCardNumber && pairedCardNumber !== expectedCardNumber)
  ) {
    return null;
  }

  return {
    importId: input.importId,
    driverId: input.driverId,
    driverName: driverData.full_name ?? 'Selected driver',
    cardNumber: pairedCardNumber,
    paired: true,
    recoveredFromClientError: true,
  };
}

async function patchTachoCandidateInviteMetadata(input: {
  companyId: string;
  importId: string;
  inviteId: string;
  inviteStatus?: string | null;
}) {
  const { data } = await supabase
    .from('tachograph_files' as never)
    .select('metadata')
    .eq('id', input.importId)
    .eq('company_id', input.companyId)
    .maybeSingle();

  const currentMetadata =
    data && typeof (data as { metadata?: unknown }).metadata === 'object' && (data as { metadata?: unknown }).metadata !== null
      ? (data as { metadata: Record<string, unknown> }).metadata
      : {};

  await supabase
    .from('tachograph_files' as never)
    .update({
      metadata: {
        ...currentMetadata,
        candidate_invite_id: input.inviteId,
        candidate_invite_status: input.inviteStatus ?? 'pending',
        candidate_invited_at: new Date().toISOString(),
      },
    } as never)
    .eq('id', input.importId)
    .eq('company_id', input.companyId)
    .is('driver_id', null);
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

  await patchTachoCandidateInviteMetadata({
    companyId: input.companyId,
    importId: input.importId,
    inviteId: input.inviteId,
    inviteStatus: data?.status,
  });

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
