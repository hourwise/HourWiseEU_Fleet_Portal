import { describe, expect, it } from 'vitest';
import { durationSecondsBetween, formatDurationSeconds, inferReportTimeResolution } from './reportTime';

describe('tachograph report time formatting', () => {
  it('retains a sub-minute driving activity', () => {
    const start = new Date('2026-07-16T10:02:26.000Z');
    const end = new Date('2026-07-16T10:03:11.000Z');

    expect(durationSecondsBetween(start, end)).toBe(45);
    expect(formatDurationSeconds(durationSecondsBetween(start, end))).toBe('00:00:45');
  });

  it('formats multi-hour activity durations without dropping seconds', () => {
    expect(formatDurationSeconds(9130)).toBe('02:32:10');
  });

  it('does not return a negative duration for invalid boundaries', () => {
    const start = new Date('2026-07-16T10:03:11.000Z');
    const end = new Date('2026-07-16T10:02:26.000Z');

    expect(durationSecondsBetween(start, end)).toBe(0);
  });

  it('identifies the EF 0504 driver-card activity source as minute resolution', () => {
    expect(inferReportTimeResolution([{
      startTime: '2026-07-16T10:02:00.000Z',
      endTime: '2026-07-16T10:15:00.000Z',
      label: 'EF 0504 read-only capture',
    }])).toBe('minute');
  });

  it('identifies timestamps containing real seconds as second resolution', () => {
    expect(inferReportTimeResolution([{
      startTime: '2026-07-16T10:02:26.000Z',
      endTime: '2026-07-16T10:15:32.000Z',
      label: 'VU detailed speed evidence',
    }])).toBe('second');
  });
});
