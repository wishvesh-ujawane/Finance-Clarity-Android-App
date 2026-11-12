import { describe, expect, it } from 'vitest';
import { computeReviewSnapshot, suggestBudgetForCategory } from '../month-end-review';
import { FIXTURE_CATEGORIES, FIXTURE_TRANSACTIONS, NOV } from '../domain/__tests__/fixtures';

const OCT = '2026-10';

describe('month-end review snapshot (owner decision D8)', () => {
  it('does not count card bill payments as spending', () => {
    const snap = computeReviewSnapshot(OCT, FIXTURE_TRANSACTIONS, FIXTURE_CATEGORIES);
    // Rent 15000 + card purchase 2000; the 1500 bill payment is a transfer.
    expect(snap.expenses).toBe(17000);
    expect(snap.topCategories.find(c => c.categoryId === 'groceries')?.amount).toBe(2000);
    expect(snap.savingsGoal).toBe(5000);
    expect(snap.netSaved).toBe(50000 - 17000 - 5000);
  });

  it('leaves bill payments out of impulse rows and last month\u2019s comparison', () => {
    const oct = computeReviewSnapshot(OCT, FIXTURE_TRANSACTIONS, FIXTURE_CATEGORIES);
    expect(oct.impulseExpenses.map(r => r.id)).toEqual(['oct-card-buy']);

    const nov = computeReviewSnapshot(NOV, FIXTURE_TRANSACTIONS, FIXTURE_CATEGORIES);
    expect(nov.expenses).toBe(3000 + 15000 + 1000 + 500);
    expect(nov.spendMoMChangePct).toBeCloseTo(((19500 - 17000) / 17000) * 100);
  });

  it('suggests budgets from what the budget counts', () => {
    // October groceries: 2000 card purchase; the 1500 bill payment is ignored.
    expect(suggestBudgetForCategory('groceries', OCT, FIXTURE_TRANSACTIONS)).toBe(2000);
    expect(suggestBudgetForCategory('savings-goal', OCT, FIXTURE_TRANSACTIONS)).toBe(5000);
  });
});
