import { describe, it, expect } from 'vitest';
import { formatINR, formatShortINR, addMonths, currentMonth, formatIndianDigits, formatAmountExpression } from '../finance-utils';

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

describe('formatIndianDigits', () => {
  it('returns empty string unchanged', () => {
    expect(formatIndianDigits('')).toBe('');
  });

  it('returns short numbers unchanged', () => {
    expect(formatIndianDigits('1')).toBe('1');
    expect(formatIndianDigits('12')).toBe('12');
    expect(formatIndianDigits('123')).toBe('123');
  });

  it('groups with Indian style (last 3, then twos)', () => {
    expect(formatIndianDigits('1234')).toBe('1,234');
    expect(formatIndianDigits('12345')).toBe('12,345');
    expect(formatIndianDigits('123456')).toBe('1,23,456');
    expect(formatIndianDigits('1234567')).toBe('12,34,567');
    expect(formatIndianDigits('10000000')).toBe('1,00,00,000');
  });

  it('preserves decimal portion', () => {
    expect(formatIndianDigits('1234.56')).toBe('1,234.56');
    expect(formatIndianDigits('123456.7')).toBe('1,23,456.7');
    expect(formatIndianDigits('1234.')).toBe('1,234.');
  });

  it('re-groups when input already contains commas', () => {
    expect(formatIndianDigits('1,00,000')).toBe('1,00,000');
    expect(formatIndianDigits('12,34,567')).toBe('12,34,567');
  });

  it('preserves leading zeros', () => {
    expect(formatIndianDigits('01234')).toBe('01,234');
  });
});

describe('formatAmountExpression', () => {
  it('returns empty string unchanged', () => {
    expect(formatAmountExpression('')).toBe('');
  });

  it('formats a single number', () => {
    expect(formatAmountExpression('250')).toBe('250');
    expect(formatAmountExpression('1234567')).toBe('12,34,567');
  });

  it('formats each number segment in a calculator expression', () => {
    expect(formatAmountExpression('10000+2500')).toBe('10,000+2,500');
    expect(formatAmountExpression('1234.56+500')).toBe('1,234.56+500');
    expect(formatAmountExpression('100000-25000+1500')).toBe('1,00,000-25,000+1,500');
  });

  it('preserves operators and trailing operators', () => {
    expect(formatAmountExpression('250+')).toBe('250+');
    expect(formatAmountExpression('10000x')).toBe('10,000x');
    expect(formatAmountExpression('50000/2')).toBe('50,000/2');
  });
});
