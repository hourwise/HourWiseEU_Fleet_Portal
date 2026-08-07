/**
 * Pure helpers for building compact per-shift job summaries for the rota.
 *
 * The Portal does not yet reliably know which jobs a driver has completed
 * during a live shift, so these are described as "planned" jobs (or the
 * "first planned job"), never as a driver's "next stop".
 */

export interface ShiftJobSummary {
  activeJobCount: number;
  firstJob: {
    sequence: number;
    reference: string;
    title: string;
    customerName: string | null;
    addressText: string;
    plannedArrivalAt: string | null;
  } | null;
}

/** Raw assignment row shape returned by the weekly job-summary query. */
export interface ShiftJobSummaryRow {
  shift_id: string;
  sequence: number;
  status: string;
  planned_arrival_at: string | null;
  jobs: {
    reference: string;
    title: string;
    job_type: string;
    customer_name: string | null;
    address_text: string;
  } | null;
}

const ACTIVE_ASSIGNMENT_STATUSES = new Set(['published', 'updated']);

export function emptyShiftJobSummary(): ShiftJobSummary {
  return { activeJobCount: 0, firstJob: null };
}

/** Only published and updated assignments are active planned jobs for the rota. */
export function isActiveJobAssignment(status: string): boolean {
  return ACTIVE_ASSIGNMENT_STATUSES.has(status);
}

/**
 * Group assignment rows into per-shift summaries. Only published/updated
 * assignments are counted; the first planned job is the lowest active
 * sequence. Deterministic regardless of input row order.
 */
export function buildShiftJobSummaries(rows: readonly ShiftJobSummaryRow[]): Record<string, ShiftJobSummary> {
  const summaries: Record<string, ShiftJobSummary> = {};
  for (const row of rows) {
    if (!isActiveJobAssignment(row.status)) continue;
    const current = summaries[row.shift_id] ?? emptyShiftJobSummary();
    const candidate = {
      sequence: row.sequence,
      reference: row.jobs?.reference ?? '',
      title: row.jobs?.title ?? '',
      customerName: row.jobs?.customer_name ?? null,
      addressText: row.jobs?.address_text ?? '',
      plannedArrivalAt: row.planned_arrival_at ?? null,
    };
    if (!current.firstJob || row.sequence < current.firstJob.sequence) {
      current.firstJob = candidate;
    }
    current.activeJobCount += 1;
    summaries[row.shift_id] = current;
  }
  return summaries;
}

/**
 * Destination label for the first planned job, in priority order:
 * customer/site name, job title, shortened address, then job reference.
 */
export function firstJobDestinationLabel(firstJob: ShiftJobSummary['firstJob']): string {
  if (!firstJob) return '';
  const customer = firstJob.customerName?.trim();
  if (customer) return customer;
  const title = firstJob.title.trim();
  if (title) return title;
  const address = firstJob.addressText.trim();
  if (address) return shortenAddress(address);
  return firstJob.reference.trim();
}

function shortenAddress(address: string): string {
  const singleLine = address.replace(/\s+/g, ' ').trim();
  return singleLine.length > 40 ? `${singleLine.slice(0, 39).trimEnd()}…` : singleLine;
}

/** Format an ISO planned-arrival timestamp as a local HH:mm clock time. */
export function formatPlannedArrivalTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
