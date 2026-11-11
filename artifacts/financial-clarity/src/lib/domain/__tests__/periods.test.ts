import { describe, expect, it } from 'vitest';
import {
  addMonths,
  currentMonth,
  getMonthStatus,
  isBeforeMonth,
  isInMonth,
  isValidDateStr,
  lastDateOfMonth,
  localDateStr,
  monthOf,
  monthsBetween,
} from '../periods';
import { carryForward } from '../finance-metrics';

describe('period boundaries', () => {
  it('places a date in its own month only', () => {
    expect(monthOf('2026-11-30')).toBe('2026-11');
    expect(isInMonth('2026-11-01', '2026-11')).toBe(true);
    expect(isInMonth('2026-10-31', '2026-11')).toBe(false);
    expect(isInMonth('2026-12-01', '2026-11')).toBe(false);
  });

  it('treats the last day of the previous month as before the month and the first day as inside it', () => {
    expect(isBeforeMonth('2026-10-31', '2026-11')).toBe(true);
    expect(isBeforeMonth('2026-11-01', '2026-11')).toBe(false);
    expect(isBeforeMonth('2025-12-31', '2026-01')).toBe(true);
  });

  it('carry-forward stops at the month boundary', () => {
    const entries = [
      { type: 'income' as const, amount: 100, categoryId: 'salary', date: '2026-10-31' },
      { type: 'income' as const, amount: 900, categoryId: 'salary', date: '2026-11-01' },
    ];
    expect(carryForward(entries, '2026-11')).toBe(100);
  });

  it('moves across year ends', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(addMonths('2026-03', -14)).toBe('2025-01');
  });

  it('finds the last day of short months and leap Februaries', () => {
    expect(lastDateOfMonth('2024-02')).toBe('2024-02-29');
    expect(lastDateOfMonth('2026-02')).toBe('2026-02-28');
    expect(lastDateOfMonth('2026-11')).toBe('2026-11-30');
    expect(lastDateOfMonth('2026-12')).toBe('2026-12-31');
  });

  it('uses the local calendar for "now"', () => {
    const now = new Date(2026, 10, 15, 23, 59);
    expect(localDateStr(now)).toBe('2026-11-15');
    expect(currentMonth(now)).toBe('2026-11');
    expect(getMonthStatus('2026-10', now)).toBe('past');
    expect(getMonthStatus('2026-11', now)).toBe('current');
    expect(getMonthStatus('2026-12', now)).toBe('future');
  });

  it('validates real calendar dates', () => {
    expect(isValidDateStr('2024-02-29')).toBe(true);
    expect(isValidDateStr('2026-02-29')).toBe(false);
    expect(isValidDateStr('2026-13-01')).toBe(false);
  });

  it('counts whole months between dates and never goes negative', () => {
    expect(monthsBetween('2026-01-31', '2026-03-01')).toBe(2);
    expect(monthsBetween('2026-05-01', '2026-03-01')).toBe(0);
  });
});
