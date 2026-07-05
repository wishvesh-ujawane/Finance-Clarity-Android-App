import { describe, it, expect } from 'vitest';
import { formatINR, formatShortINR, addMonths, currentMonth } from '../finance-utils';

describe('formatINR', () => {
  it('formats amounts with Indian grouping and ₹ symbol', () => {
    expect(formatINR(10000000)).toBe('₹1,00,00,000');
    expect(formatINR(100000)).toBe('₹1,00,000');
    expect(formatINR(1000)).toBe('₹1,000');
  });

  it('handles zero', () => {
    expect(formatINR(0)).toBe('₹0');
  });

  it('handles negative amounts', () => {
    expect(formatINR(-1000)).toBe('-₹1,000');
    expect(formatINR(-100000)).toBe('-₹1,00,000');
  });
});

describe('formatShortINR', () => {
  it('formats lakhs with 1 decimal', () => {
    expect(formatShortINR(100000)).toBe('₹1.0L');
    expect(formatShortINR(250000)).toBe('₹2.5L');
  });

  it('formats thousands with k suffix', () => {
    expect(formatShortINR(1000)).toBe('₹1.0k');
    expect(formatShortINR(5000)).toBe('₹5.0k');
  });

  it('formats small amounts without suffix', () => {
    expect(formatShortINR(500)).toBe('₹500');
    expect(formatShortINR(999)).toBe('₹999');
  });
});

describe('addMonths', () => {
  it('adds months correctly', () => {
    expect(addMonths('2026-01', 1)).toBe('2026-02');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-06', 6)).toBe('2026-12');
  });

  it('handles negative months (subtraction)', () => {
    expect(addMonths('2026-02', -1)).toBe('2026-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
  });
});

describe('currentMonth', () => {
  it('returns YYYY-MM format', () => {
    const result = currentMonth();
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });
});
