import { describe, it, expect } from 'vitest';
import { formatDate, formatMonthYear, toISODate } from './date';

const d = new Date('2026-06-22T10:00:00Z');

describe('formatDate', () => {
  it('formats with default options', () => {
    const result = formatDate(d, 'en-IN');
    expect(result).toMatch(/22/);
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2026/);
  });

  it('accepts a Firestore-like object with toDate()', () => {
    const ts = { toDate: () => d };
    expect(formatDate(ts, 'en-IN')).toMatch(/2026/);
  });
});

describe('formatMonthYear', () => {
  it('returns month and year only', () => {
    const result = formatMonthYear(d, 'en-IN');
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2026/);
    expect(result).not.toMatch(/22/);
  });
});

describe('toISODate', () => {
  it('returns YYYY-MM-DD', () => {
    expect(toISODate(new Date('2026-06-22'))).toBe('2026-06-22');
  });
});
