import { describe, expect, it } from 'vitest';
import {
  formatAmount,
  formatAmountFull,
  formatAmountShort,
  formatDateLabel,
  formatMonthLabel,
  formatMonthShort,
} from '../format';
import { formatINR, formatMonthYear, formatShortINR } from '../finance-utils';

describe('formatAmount (display, DESIGN §4.6)', () => {
  it('uses en-IN grouping below one lakh', () => {
    expect(formatAmount(0)).toBe('₹0');
    expect(formatAmount(1234)).toBe('₹1,234');
    expect(formatAmount(99999)).toBe('₹99,999');
  });

  it('compacts from one lakh and one crore', () => {
    expect(formatAmount(100000)).toBe('₹1.00 L');
    expect(formatAmount(1234567)).toBe('₹12.35 L');
    expect(formatAmount(10000000)).toBe('₹1.00 Cr');
  });

  it('never shows paise', () => {
    expect(formatAmount(1234.5)).toBe('₹1,235');
    expect(formatAmount(0.4)).toBe('₹0');
  });

  it('puts a minus before negative amounts but not before zero', () => {
    expect(formatAmount(-1500)).toBe('-₹1,500');
    expect(formatAmount(-250000)).toBe('-₹2.50 L');
    expect(formatAmount(-0.4)).toBe('₹0');
  });
});

describe('formatAmountFull (inputs, sheets, confirmations)', () => {
  it('keeps every digit with en-IN grouping and no paise', () => {
    expect(formatAmountFull(150000)).toBe('₹1,50,000');
    expect(formatAmountFull(1234.6)).toBe('₹1,235');
  });

  it('is what the deprecated formatINR alias returns', () => {
    expect(formatINR).toBe(formatAmountFull);
  });
});

describe('formatAmountShort (charts only)', () => {
  it('uses k and L suffixes', () => {
    expect(formatAmountShort(950)).toBe('₹950');
    expect(formatAmountShort(12500)).toBe('₹12.5k');
    expect(formatAmountShort(120000)).toBe('₹1.2L');
    expect(formatShortINR).toBe(formatAmountShort);
  });
});

describe('date labels', () => {
  const now = new Date(2026, 10, 15, 9, 0);

  it('names today and yesterday', () => {
    expect(formatDateLabel('2026-11-15', undefined, now)).toBe('Today');
    expect(formatDateLabel('2026-11-14', undefined, now)).toBe('Yesterday');
    expect(formatDateLabel('2026-11-01', { day: 'numeric', month: 'short' }, now)).toBe('1 Nov');
  });

  it('formats months', () => {
    expect(formatMonthLabel('2026-11')).toBe('November 2026');
    expect(formatMonthYear('2026-11')).toBe('November 2026');
    expect(formatMonthShort('2026-11')).toBe('Nov');
  });
});
