import { describe, expect, it } from 'vitest';
import { isAvailableJobSequence, nextJobSequence } from './jobSequence';

describe('job assignment sequence helpers', () => {
  describe('nextJobSequence', () => {
    it('returns 1 for a shift with no assignments', () => {
      expect(nextJobSequence([])).toBe(1);
    });

    it('returns the next number after a contiguous run', () => {
      expect(nextJobSequence([1, 2, 3])).toBe(4);
    });

    it('fills the lowest gap when sequences are non-contiguous', () => {
      expect(nextJobSequence([1, 3])).toBe(2);
      expect(nextJobSequence([2, 4])).toBe(1);
    });

    it('ignores duplicates and unsorted input', () => {
      expect(nextJobSequence([3, 1, 1, 2, 4])).toBe(5);
    });

    it('returns 1 when only higher sequences exist', () => {
      expect(nextJobSequence([2, 5, 9])).toBe(1);
    });
  });

  describe('isAvailableJobSequence', () => {
    it('accepts a fresh positive integer', () => {
      expect(isAvailableJobSequence(1, [])).toBe(true);
      expect(isAvailableJobSequence(4, [1, 2, 3])).toBe(true);
    });

    it('rejects sequences already taken on the shift', () => {
      expect(isAvailableJobSequence(2, [1, 2, 3])).toBe(false);
      expect(isAvailableJobSequence(1, [1])).toBe(false);
    });

    it('rejects zero, negatives and non-integers', () => {
      expect(isAvailableJobSequence(0, [])).toBe(false);
      expect(isAvailableJobSequence(-1, [])).toBe(false);
      expect(isAvailableJobSequence(1.5, [])).toBe(false);
    });

    it('allows the assignment being edited to retain its current sequence', () => {
      expect(isAvailableJobSequence(2, [1, 2, 3], 2)).toBe(true);
      expect(isAvailableJobSequence(3, [1, 2, 3], 2)).toBe(false);
    });
  });
});
