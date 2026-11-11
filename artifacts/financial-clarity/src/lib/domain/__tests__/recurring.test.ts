import { describe, expect, it } from 'vitest';
import type { RecurringExpense, Transaction } from '@/lib/types';
import { getLastDueMonthBeforeDate, getRecurringOccurrenceDate, planRecurringGeneration } from '../recurring';

function rule(overrides: Partial<RecurringExpense> = {}): RecurringExpense {
  return {
    id: 'r1',
    description: 'Synthetic rent',
    amount: 1000,
    categoryId: 'rent',
    dayOfMonth: 31,
    active: true,
    startMonth: '2026-01',
    ...overrides,
  };
}

/** Saves a plan the way FinanceContext does, so repeated runs can be checked. */
function apply(rules: RecurringExpense[], transactions: Transaction[], today: string) {
  const plan = planRecurringGeneration(rules, transactions, today);
  const nextTransactions = [
    ...plan.occurrences.map((t, i) => ({ ...t, id: `gen-${t.recurringRuleId}-${t.recurringMonth}-${i}` })),
    ...transactions,
  ];
  const nextRules = rules.map(r => (plan.cursors[r.id] ? { ...r, lastGeneratedMonth: plan.cursors[r.id] } : r));
  return { plan, transactions: nextTransactions, rules: nextRules };
}

describe('occurrence dates', () => {
  it('clamps day 31 to the last day of short months, leap and non-leap Februaries', () => {
    expect(getRecurringOccurrenceDate('2026-04', 31)).toBe('2026-04-30');
    expect(getRecurringOccurrenceDate('2026-02', 31)).toBe('2026-02-28');
    expect(getRecurringOccurrenceDate('2028-02', 30)).toBe('2028-02-29');
    expect(getRecurringOccurrenceDate('2026-01', 31)).toBe('2026-01-31');
    expect(getRecurringOccurrenceDate('2026-03', 5)).toBe('2026-03-05');
  });
});

describe('planRecurringGeneration', () => {
  it('catches up every missed month once after time away, with clamped dates', () => {
    const { plan } = apply([rule()], [], '2026-04-30');
    expect(plan.occurrences.map(o => o.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(plan.occurrences.every(o => o.recurringRuleId === 'r1')).toBe(true);
    expect(plan.cursors).toEqual({ r1: '2026-04' });
  });

  it('adds nothing when run again after saving', () => {
    const first = apply([rule()], [], '2026-04-30');
    const second = apply(first.rules, first.transactions, '2026-04-30');
    expect(second.plan.occurrences).toEqual([]);
    expect(second.plan.cursors).toEqual({});
    expect(second.transactions).toHaveLength(4);
  });

  it('does not generate before the due date, and generates on the due date', () => {
    expect(planRecurringGeneration([rule({ startMonth: '2026-11', dayOfMonth: 15 })], [], '2026-11-14').occurrences).toEqual([]);
    expect(planRecurringGeneration([rule({ startMonth: '2026-11', dayOfMonth: 15 })], [], '2026-11-15').occurrences).toHaveLength(1);
  });

  it('never generates before the start month or for paused rules', () => {
    expect(planRecurringGeneration([rule({ startMonth: '2026-12' })], [], '2026-11-30').occurrences).toEqual([]);
    expect(planRecurringGeneration([rule({ active: false })], [], '2026-11-30').occurrences).toEqual([]);
  });

  it('continues from the cursor and never goes back', () => {
    const plan = planRecurringGeneration([rule({ lastGeneratedMonth: '2026-09', dayOfMonth: 1 })], [], '2026-11-01');
    expect(plan.occurrences.map(o => o.recurringMonth)).toEqual(['2026-10', '2026-11']);
  });

  it('ignores a cursor older than the start month', () => {
    const plan = planRecurringGeneration([rule({ startMonth: '2026-10', lastGeneratedMonth: '2026-01', dayOfMonth: 1 })], [], '2026-11-01');
    expect(plan.occurrences.map(o => o.recurringMonth)).toEqual(['2026-10', '2026-11']);
  });

  it('recovers from an interrupted save: an existing occurrence key is skipped but the cursor advances', () => {
    const existing: Transaction = {
      id: 'saved-before-crash', type: 'expense', amount: 1000, categoryId: 'rent', note: 'Synthetic rent',
      date: '2026-01-31', recurringRuleId: 'r1', recurringMonth: '2026-01',
    };
    const plan = planRecurringGeneration([rule()], [existing], '2026-02-28');
    expect(plan.occurrences.map(o => o.recurringMonth)).toEqual(['2026-02']);
    expect(plan.cursors).toEqual({ r1: '2026-02' });
  });

  it('matches a pre-v4 generated entry by its exact scheduled date', () => {
    const legacy: Transaction = {
      id: 'legacy', type: 'expense', amount: 1000, categoryId: 'rent', note: ' synthetic RENT ', date: '2026-01-31',
    };
    const plan = planRecurringGeneration([rule()], [legacy], '2026-01-31');
    expect(plan.occurrences).toEqual([]);
    expect(plan.cursors).toEqual({ r1: '2026-01' });
  });

  it('does not treat a manual entry on another date as the occurrence', () => {
    const manual: Transaction = {
      id: 'manual', type: 'expense', amount: 1000, categoryId: 'rent', note: 'Synthetic rent', date: '2026-01-30',
    };
    expect(planRecurringGeneration([rule()], [manual], '2026-01-31').occurrences).toHaveLength(1);
  });
});

describe('resuming a paused rule', () => {
  it('skips months that fell due while paused but keeps one due today', () => {
    const paused = rule({ dayOfMonth: 10, startMonth: '2026-06', lastGeneratedMonth: '2026-07', active: false });
    expect(getLastDueMonthBeforeDate(paused, '2026-11-10')).toBe('2026-10');
    expect(getLastDueMonthBeforeDate(paused, '2026-11-11')).toBe('2026-11');
    const resumed = { ...paused, active: true, lastGeneratedMonth: getLastDueMonthBeforeDate(paused, '2026-11-10') };
    expect(planRecurringGeneration([resumed], [], '2026-11-10').occurrences.map(o => o.recurringMonth)).toEqual(['2026-11']);
  });
});
