/**
 * Pure helpers for computing and validating job assignment sequence numbers.
 *
 * A shift's `job_assignments` rows are ordered by `sequence`, and the schema
 * enforces `UNIQUE (shift_id, sequence)` with `CHECK (sequence > 0)`. The
 * manager UI uses these helpers to pick a safe next sequence and to reject
 * obvious duplicates before submitting the RPC.
 */

/** Smallest positive integer not present in the supplied sequences (1 when empty). */
export function nextJobSequence(sequences: readonly number[]): number {
  const used = new Set(sequences);
  let candidate = 1;
  while (used.has(candidate)) {
    candidate += 1;
  }
  return candidate;
}

/** True when the sequence is a positive integer that is not already taken on the shift. */
export function isAvailableJobSequence(sequence: number, taken: readonly number[]): boolean {
  return Number.isInteger(sequence) && sequence > 0 && !taken.includes(sequence);
}
