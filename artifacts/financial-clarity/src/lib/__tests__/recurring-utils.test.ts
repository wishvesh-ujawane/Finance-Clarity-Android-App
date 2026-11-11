import { describe, expect, it } from 'vitest';
import { getLastDueMonthBeforeDate, getRecurringOccurrenceDate } from '../recurring-utils';
import type { RecurringExpense } from '../types';

const pausedRule: RecurringExpense = {
  id: 'rule-1',
  description: 'Synthetic rent',
  amount: 1000,
  categoryId: 'rent',
  dayOfMonth: 1,
  active: false,
  startMonth: '2026-09',
};

describe('recurring date helpers', () => {
  it('clamps a scheduled day to the last day of short and leap-year months', () => {
    expect(getRecurringOccurrenceDate('2026-02', 31)).toBe('2026-02-28');
    expect(getRecurringOccurrenceDate('2024-02', 31)).toBe('2024-02-29');
    expect(getRecurringOccurrenceDate('2026-11', 31)).toBe('2026-11-30');
  });

  it('advances the cursor past due months while paused but keeps an occurrence due today', () => {
    expect(getLastDueMonthBeforeDate(pausedRule, '2026-11-11')).toBe('2026-11');
    expect(getLastDueMonthBeforeDate({ ...pausedRule, dayOfMonth: 31 }, '2026-11-30')).toBe('2026-10');
    expect(getLastDueMonthBeforeDate({ ...pausedRule, startMonth: '2026-11' }, '2026-11-01')).toBeUndefined();
  });

  it('never moves an existing generation cursor backwards', () => {
    expect(getLastDueMonthBeforeDate({ ...pausedRule, lastGeneratedMonth: '2026-10' }, '2026-11-01')).toBe('2026-10');
  });
});