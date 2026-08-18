import { supabase } from './supabase';

export type DriverJobAssignment = {
  id: string;
  jobId: string;
  shiftId: string;
  sequence: number;
  status: DriverJobStatus;
  updatedAt: string;
  plannedArrivalAt: string | null;
  plannedDepartureAt: string | null;
  expectedDurationMinutes: number | null;
  reference: string;
  title: string;
  jobType: string;
  customerName: string | null;
  addressText: string;
  instructions: string | null;
  stops: DriverJobStop[];
};

export type DriverJobStop = {
  id: string;
  sequence: number;
  stopType: string;
  siteName: string | null;
  addressText: string;
  instructions: string | null;
  driverNotes: string | null;
  arrivalWindowStart: string | null;
  arrivalWindowEnd: string | null;
  activity: string | null;
};

export type DriverJobStatus = 'published' | 'updated' | 'acknowledged' | 'started' | 'arrived' | 'completed' | 'delayed' | 'unable_to_complete' | 'vehicle_issue' | 'site_issue' | 'route_issue';

export type DriverVehicleAction = {
  id: string;
  regNumber: string;
  checkStatus: string;
  defectLifecycleStatus: string | null;
  defectDetails: string | null;
  createdAt: string | null;
};

export async function fetchDriverJobAssignments(driverId: string, shiftIds: string[]): Promise<DriverJobAssignment[]> {
  if (shiftIds.length === 0) return [];
  const { data, error } = await supabase
    .from('job_assignments')
    .select('id, shift_id, sequence, status, updated_at, planned_arrival_at, planned_departure_at, expected_duration_minutes, jobs:job_id(id, reference, title, job_type, customer_name, address_text, instructions)')
    .eq('driver_id', driverId)
    .in('shift_id', shiftIds)
    .order('sequence', { ascending: true });

  if (error) throw new Error(error.message || 'Unable to load assigned jobs.');
  const assignments = normaliseDriverJobRows(data);
  const jobIds = assignments.map((assignment) => assignment.jobId).filter(Boolean);
  if (jobIds.length === 0) return assignments;
  const untyped = supabase as unknown as { from: (table: string) => { select: (fields: string) => { in: (field: string, values: string[]) => Promise<{ data: unknown[] | null; error: { message: string } | null }> } } };
  const { data: stops, error: stopError } = await untyped.from('job_stops').select('id, job_id, sequence, stop_type, site_name, address_text, instructions, driver_notes, arrival_window_start, arrival_window_end, activity').in('job_id', jobIds);
  if (stopError) throw new Error(stopError.message || 'Unable to load assigned stops.');
  const stopsByJobId = new Map<string, DriverJobStop[]>();
  for (const row of stops ?? []) {
    const value = row as Record<string, unknown>;
    if (typeof value.job_id !== 'string' || typeof value.id !== 'string' || typeof value.sequence !== 'number' || typeof value.address_text !== 'string') continue;
    const stop: DriverJobStop = { id: value.id, sequence: value.sequence, stopType: typeof value.stop_type === 'string' ? value.stop_type : 'service', siteName: typeof value.site_name === 'string' ? value.site_name : null, addressText: value.address_text, instructions: typeof value.instructions === 'string' ? value.instructions : null, driverNotes: typeof value.driver_notes === 'string' ? value.driver_notes : null, arrivalWindowStart: typeof value.arrival_window_start === 'string' ? value.arrival_window_start : null, arrivalWindowEnd: typeof value.arrival_window_end === 'string' ? value.arrival_window_end : null, activity: typeof value.activity === 'string' ? value.activity : null };
    stopsByJobId.set(value.job_id, [...(stopsByJobId.get(value.job_id) ?? []), stop]);
  }
  return assignments.map((assignment) => ({ ...assignment, stops: (stopsByJobId.get(assignment.jobId) ?? []).sort((left, right) => left.sequence - right.sequence) }));
}

export async function fetchDriverVehicleActions(driverId: string): Promise<DriverVehicleAction[]> {
  const { data, error } = await supabase
    .from('vehicle_checks')
    .select('id, reg_number, check_status, defect_lifecycle_status, defect_details, created_at')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(8);

  if (error) throw new Error(error.message || 'Unable to load vehicle check actions.');
  return (data ?? [])
    .map((row) => ({
      id: row.id,
      regNumber: row.reg_number,
      checkStatus: row.check_status ?? 'unknown',
      defectLifecycleStatus: row.defect_lifecycle_status,
      defectDetails: row.defect_details,
      createdAt: row.created_at,
    }))
    .filter((row) => row.checkStatus === 'defect' || row.checkStatus === 'warning');
}

export function normaliseDriverJobRows(rows: unknown): DriverJobAssignment[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const job = asRecord(row.jobs);
    const status = isDriverJobStatus(row.status) ? row.status : null;
    if (!status || typeof row.id !== 'string' || typeof row.shift_id !== 'string' || typeof row.sequence !== 'number' || typeof row.updated_at !== 'string' || !job) return [];
    if (typeof job.reference !== 'string' || typeof job.title !== 'string' || typeof job.address_text !== 'string') return [];
    return [{
      id: row.id,
      jobId: typeof job.id === 'string' ? job.id : '',
      shiftId: row.shift_id,
      sequence: row.sequence,
      status,
      updatedAt: row.updated_at,
      plannedArrivalAt: nullableString(row.planned_arrival_at),
      plannedDepartureAt: nullableString(row.planned_departure_at),
      expectedDurationMinutes: typeof row.expected_duration_minutes === 'number' ? row.expected_duration_minutes : null,
      reference: job.reference,
      title: job.title,
      jobType: typeof job.job_type === 'string' ? job.job_type : 'other',
      customerName: nullableString(job.customer_name),
      addressText: job.address_text,
      instructions: nullableString(job.instructions),
      stops: [],
    } satisfies DriverJobAssignment];
  });
}

export async function transitionDriverJobAssignment(input: { assignmentId: string; toStatus: DriverJobStatus; expectedUpdatedAt: string; reason?: string | null }) {
  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  const { data, error } = await rpc('transition_job_assignment_with_event', {
    p_assignment_id: input.assignmentId,
    p_to_status: input.toStatus,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_reason: input.reason ?? null,
    p_requires_ack: false,
  });
  if (error) throw Object.assign(new Error(error.message || 'Unable to transition this job.'), { code: error.code });
  return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isDriverJobStatus(value: unknown): value is DriverJobStatus {
  return value === 'published' || value === 'updated' || value === 'acknowledged' || value === 'started' || value === 'arrived' || value === 'completed' || value === 'delayed' || value === 'unable_to_complete' || value === 'vehicle_issue' || value === 'site_issue' || value === 'route_issue';
}
