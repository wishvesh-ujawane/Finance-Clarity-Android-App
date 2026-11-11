import { describe, expect, it } from 'vitest';
import type { Budget } from '@/lib/types';
import { applyBudgetCopy, budgetCopyCount, planBudgetCopy } from '../budgets';
import { sumConsumption, sumIncome } from '../finance-metrics';
import { FIXTURE_TRANSACTIONS } from './fixtures';

const budgets: Budget[] = [
  { id: 'oct-groceries', categoryId: 'groceries', limit: 5000, month: '2026-10' },
  { id: 'oct-rent', categoryId: 'rent', limit: 15000, month: '2026-10' },
  { id: 'oct-dining', categoryId: 'dining', limit: 2000, month: '2026-10' },
  { id: 'oct-old', categoryId: 'old', limit: 300, month: '2026-10' },
  { id: 'nov-groceries', categoryId: 'groceries', limit: 4000, month: '2026-11' },
  { id: 'nov-dining', categoryId: 'dining', limit: 2000, month: '2026-11' },
  { id: 'nov-health', categoryId: 'health', limit: 1000, month: '2026-11' },
];
const categories = [{ id: 'groceries' }, { id: 'rent' }, { id: 'dining' }, { id: 'health' }, { id: 'old', active: false }];

describe('budget limit copying (PRD FR-05)', () => {
  it('lists what is created, replaced, unchanged, kept, and skipped', () => {
    expect(planBudgetCopy(budgets, categories, '2026-10', '2026-11')).toEqual({
      created: [{ categoryId: 'rent', limit: 15000 }],
      overwritten: [{ budgetId: 'nov-groceries', categoryId: 'groceries', previousLimit: 4000, limit: 5000 }],
      unchanged: 1,
      keptInTarget: 1,
      skippedInactive: ['old'],
    });
  });

  it('changes only limits in the target month and keeps unrelated target budgets', () => {
    const plan = planBudgetCopy(budgets, categories, '2026-10', '2026-11');
    const next = applyBudgetCopy(budgets, plan, '2026-11', () => 'new-id');
    expect(next.filter(b => b.month === '2026-10')).toEqual(budgets.filter(b => b.month === '2026-10'));
    expect(next.filter(b => b.month === '2026-11')).toEqual([
      { id: 'nov-groceries', categoryId: 'groceries', limit: 5000, month: '2026-11' },
      { id: 'nov-dining', categoryId: 'dining', limit: 2000, month: '2026-11' },
      { id: 'nov-health', categoryId: 'health', limit: 1000, month: '2026-11' },
      { id: 'new-id', categoryId: 'rent', limit: 15000, month: '2026-11' },
    ]);
    expect(budgetCopyCount(plan)).toBe(3);
  });

  it('does nothing when copying a month onto itself', () => {
    expect(budgetCopyCount(planBudgetCopy(budgets, categories, '2026-10', '2026-10'))).toBe(0);
  });
});

describe('list totals', () => {
  it('count income and consumption only, leaving out savings and card bill payments', () => {
    const october = FIXTURE_TRANSACTIONS.filter(t => t.date.startsWith('2026-10'));
    expect(sumIncome(october)).toBe(50000);
    expect(sumConsumption(october)).toBe(15000 + 2000);
  });
});
