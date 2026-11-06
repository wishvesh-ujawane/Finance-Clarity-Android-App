import { describe, expect, it } from 'vitest';
import {
  canDeleteCategory,
  describeCategoryDeleteBlock,
  getCategoryUsage,
  isReservedCategory,
  type CategoryReferences,
} from '@/lib/category-rules';

const empty: CategoryReferences = { transactions: [], budgets: [], recurringExpenses: [] };

const refs: CategoryReferences = {
  transactions: [
    { id: 't1', type: 'expense', amount: 10, categoryId: 'groceries', note: '', date: '2026-11-01' },
    { id: 't2', type: 'expense', amount: 20, categoryId: 'groceries', note: '', date: '2026-11-02' },
  ],
  budgets: [{ id: 'b1', categoryId: 'dining', limit: 2000, month: '2026-11' }],
  recurringExpenses: [
    { id: 'r1', description: 'Gym', amount: 999, categoryId: 'health', dayOfMonth: 5, active: true, startMonth: '2026-01' },
  ],
};

describe('category rules', () => {
  it('treats savings and month-end adjustment categories as reserved', () => {
    for (const id of ['savings-goal', 'savings-emergency', '_adjustment-missed-spend', '_adjustment-overlogged']) {
      expect(isReservedCategory(id)).toBe(true);
      expect(canDeleteCategory(id, empty)).toEqual({ ok: false, reason: 'reserved' });
    }
    expect(isReservedCategory('groceries')).toBe(false);
  });

  it('counts transactions, budgets, and recurring rules as usage', () => {
    expect(getCategoryUsage('groceries', refs)).toEqual({ transactions: 2, budgets: 0, recurring: 0 });
    expect(canDeleteCategory('groceries', refs)).toMatchObject({ ok: false, reason: 'in-use' });
    expect(canDeleteCategory('dining', refs)).toMatchObject({ ok: false, reason: 'in-use' });
    expect(canDeleteCategory('health', refs)).toMatchObject({ ok: false, reason: 'in-use' });
  });

  it('allows deleting an unused, non-reserved category', () => {
    expect(canDeleteCategory('transport', refs)).toEqual({ ok: true });
  });

  it('explains why deletion is blocked', () => {
    expect(describeCategoryDeleteBlock({ ok: false, reason: 'reserved' })).toMatch(/built-in/);
    expect(describeCategoryDeleteBlock({
      ok: false, reason: 'in-use', usage: { transactions: 2, budgets: 1, recurring: 1 },
    })).toBe('Used by 2 transactions, 1 budget and 1 recurring expense, so it can\u2019t be deleted.');
    expect(describeCategoryDeleteBlock({
      ok: false, reason: 'in-use', usage: { transactions: 1, budgets: 0, recurring: 0 },
    })).toBe('Used by 1 transaction, so it can\u2019t be deleted.');
  });
});
