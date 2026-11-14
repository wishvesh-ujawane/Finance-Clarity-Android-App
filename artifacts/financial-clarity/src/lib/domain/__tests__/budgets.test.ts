import { describe, expect, it } from 'vitest';
import type { Budget } from '@/lib/types';
import { applyBudgetCopy, budgetCopyCount, budgetSummary, planBudgetCopy } from '../budgets';
import {
  sumConsumption,
  sumIncome,
  totalCommitments,
  totalConsumption,
  totalDayToDay,
  totalSavingsContributions,
  type MetricTransaction,
} from '../finance-metrics';
import { FIXTURE_BUDGETS, FIXTURE_CATEGORIES, FIXTURE_TRANSACTIONS, NOV } from './fixtures';

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

describe('monthly budget summary (Budgets screen and Analysis)', () => {
  it('groups limits and spending by day-to-day, commitments, and savings', () => {
    expect(budgetSummary(FIXTURE_TRANSACTIONS, FIXTURE_CATEGORIES, FIXTURE_BUDGETS, NOV)).toEqual({
      dayToDay: { limit: 6000, spent: 4500, unbudgeted: 0, count: 1 },
      commitments: { limit: 15000, spent: 15000, unbudgeted: 0, count: 1 },
      savings: { limit: 5000, spent: 4000, unbudgeted: 0, count: 1 },
    });
  });

  it('reports spending in categories without a budget so each type adds up to its month total', () => {
    const categories = [...FIXTURE_CATEGORIES, { id: 'emi', type: 'commitment' as const }];
    const extra: MetricTransaction[] = [
      ...FIXTURE_TRANSACTIONS,
      { type: 'expense', amount: 800, categoryId: 'dining', date: '2026-11-04' },
      { type: 'expense', amount: 2000, categoryId: 'emi', date: '2026-11-05' },
      { type: 'expense', amount: 1200, categoryId: 'savings-goal', date: '2026-11-06' },
      { type: 'expense', amount: 999, categoryId: 'dining', date: '2026-10-04' },
    ];
    const summary = budgetSummary(extra, categories, FIXTURE_BUDGETS, NOV);
    expect(summary.dayToDay).toMatchObject({ spent: 4500, unbudgeted: 800 });
    expect(summary.commitments).toMatchObject({ spent: 15000, unbudgeted: 2000 });
    expect(summary.savings).toMatchObject({ spent: 4000, unbudgeted: 1200 });

    expect(summary.dayToDay.spent + summary.dayToDay.unbudgeted).toBe(totalDayToDay(extra, categories, NOV));
    expect(summary.commitments.spent + summary.commitments.unbudgeted).toBe(totalCommitments(extra, categories, NOV));
    expect(summary.savings.spent + summary.savings.unbudgeted).toBe(totalSavingsContributions(extra, NOV));
    expect(
      summary.dayToDay.spent + summary.dayToDay.unbudgeted + summary.commitments.spent + summary.commitments.unbudgeted,
    ).toBe(totalConsumption(extra, NOV));
  });

  it('is empty for a month without budgets or entries', () => {
    const empty = { limit: 0, spent: 0, unbudgeted: 0, count: 0 };
    expect(budgetSummary(FIXTURE_TRANSACTIONS, FIXTURE_CATEGORIES, FIXTURE_BUDGETS, '2026-01')).toEqual({
      dayToDay: empty, commitments: empty, savings: empty,
    });
  });
});
