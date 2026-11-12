import { describe, expect, it } from 'vitest';
import {
  balanceThroughEndOf,
  cardBillPaymentsIn,
  carryForward,
  categorySpent,
  consumptionBetween,
  consumptionByCategory,
  consumptionByCategoryBetween,
  expectedBankBalanceAtEndOf,
  isConsumptionExpense,
  isSavingsContribution,
  lifetimeBalance,
  monthlyNet,
  monthSummary,
  outstandingCardAmount,
  outstandingCardAmountThroughEndOf,
  totalCommitments,
  totalConsumption,
  totalDayToDay,
  totalIncome,
  totalSavingsContributions,
  type MetricTransaction,
} from '../finance-metrics';
import { FIXTURE_CATEGORIES, FIXTURE_TODAY, FIXTURE_TRANSACTIONS, NOV } from './fixtures';

const tx = FIXTURE_TRANSACTIONS;

describe('transaction classification (PRD §6)', () => {
  it('excludes savings contributions and card bill payments from consumption', () => {
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'groceries' })).toBe(true);
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'groceries', paymentMethod: 'credit-card' })).toBe(true);
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'groceries', paymentMethod: 'credit-card-payment' })).toBe(false);
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'savings-goal' })).toBe(false);
    expect(isConsumptionExpense({ type: 'income', categoryId: 'salary' })).toBe(false);
  });

  it('treats expense entries in reserved savings categories as savings contributions', () => {
    expect(isSavingsContribution({ type: 'expense', categoryId: 'savings-emergency' })).toBe(true);
    expect(isSavingsContribution({ type: 'expense', categoryId: 'groceries' })).toBe(false);
    expect(isSavingsContribution({ type: 'income', categoryId: 'savings-goal' })).toBe(false);
  });
});

describe('monthly metrics', () => {
  it('income', () => {
    expect(totalIncome(tx, NOV)).toBe(60000);
  });

  it('consumption spending counts card purchases once and ignores the bill payment', () => {
    expect(totalConsumption(tx, NOV)).toBe(19500);
  });

  it('savings contributions', () => {
    expect(totalSavingsContributions(tx, NOV)).toBe(4000);
  });

  it('commitments and day-to-day split consumption', () => {
    expect(totalCommitments(tx, FIXTURE_CATEGORIES, NOV)).toBe(15000);
    expect(totalDayToDay(tx, FIXTURE_CATEGORIES, NOV)).toBe(4500);
  });

  it('monthly net is income minus consumption minus savings', () => {
    expect(monthlyNet(tx, NOV)).toBe(60000 - 19500 - 4000);
  });

  it('a "through" cutoff leaves out later entries in the month', () => {
    expect(totalConsumption(tx, NOV, { through: FIXTURE_TODAY })).toBe(19000);
    expect(totalIncome(tx, NOV, { through: '2026-10-31' })).toBe(0);
  });
});

describe('cumulative balances', () => {
  it('carry-forward is income minus consumption before the month and keeps savings', () => {
    expect(carryForward(tx, NOV)).toBe(50000 - 2000 - 15000);
  });

  it('lifetime balance runs through today and ignores future-dated entries', () => {
    expect(lifetimeBalance(tx, FIXTURE_TODAY)).toBe(33000 + 60000 - 3000 - 15000 - 1000);
  });

  it('balance through the end of a month includes every entry dated in it', () => {
    expect(balanceThroughEndOf(tx, NOV)).toBe(33000 + 60000 - 19500);
  });
});

describe('outstanding card amount', () => {
  it('is purchases minus bill payments', () => {
    expect(outstandingCardAmount(tx)).toBe(2000 + 1000 - 1500 - 1000);
  });

  it('is floored at zero', () => {
    const overpaid: MetricTransaction[] = [
      { type: 'expense', amount: 100, categoryId: 'groceries', date: '2026-11-01', paymentMethod: 'credit-card' },
      { type: 'expense', amount: 300, categoryId: 'groceries', date: '2026-11-02', paymentMethod: 'credit-card-payment' },
    ];
    expect(outstandingCardAmount(overpaid)).toBe(0);
  });

  it('can be measured at the end of a month, ignoring later entries', () => {
    expect(outstandingCardAmountThroughEndOf(tx, '2026-09')).toBe(0);
    expect(outstandingCardAmountThroughEndOf(tx, '2026-10')).toBe(2000 - 1500);
    expect(outstandingCardAmountThroughEndOf(tx, NOV)).toBe(2000 + 1000 - 1500 - 1000);
  });

  it('sums card bill payments dated in a month', () => {
    expect(cardBillPaymentsIn(tx, '2026-10')).toBe(1500);
    expect(cardBillPaymentsIn(tx, NOV)).toBe(1000);
    expect(cardBillPaymentsIn(tx, '2026-12')).toBe(0);
  });
});

describe('expected bank balance for month-end reconcile', () => {
  it('adds the still-unpaid card amount to the balance through the month', () => {
    // October: 50000 - 15000 - 2000 = 33000, plus 500 not yet paid from the bank.
    expect(expectedBankBalanceAtEndOf(tx, '2026-10')).toBe(33000 + 500);
    expect(expectedBankBalanceAtEndOf(tx, NOV)).toBe(73500 + 500);
  });

  it('drops by exactly the bill payment, which is not spending', () => {
    const before = [...tx];
    const payment: MetricTransaction = { type: 'expense', amount: 500, categoryId: 'other', date: '2026-11-30', paymentMethod: 'credit-card-payment' };
    const after = [...before, payment];
    expect(balanceThroughEndOf(after, NOV)).toBe(balanceThroughEndOf(before, NOV));
    expect(totalConsumption(after, NOV)).toBe(totalConsumption(before, NOV));
    expect(expectedBankBalanceAtEndOf(after, NOV)).toBe(expectedBankBalanceAtEndOf(before, NOV) - 500);
    expect(outstandingCardAmountThroughEndOf(after, NOV)).toBe(0);
  });
});

describe('category breakdowns', () => {
  it('budget spent is consumption for a spending category and contributions for a savings category', () => {
    expect(categorySpent(tx, 'groceries', NOV)).toBe(3000 + 1000 + 500);
    expect(categorySpent(tx, 'savings-emergency', NOV)).toBe(4000);
  });

  it('groups consumption by category for a month or a date range', () => {
    expect(consumptionByCategory(tx, NOV)).toEqual({ groceries: 4500, rent: 15000 });
    expect(consumptionByCategoryBetween(tx, '2026-11-01', FIXTURE_TODAY)).toEqual({ groceries: 4000, rent: 15000 });
    expect(consumptionBetween(tx, FIXTURE_TODAY, FIXTURE_TODAY)).toBe(1000);
  });
});

describe('monthSummary', () => {
  it('agrees with the individual metrics', () => {
    expect(monthSummary(tx, NOV)).toEqual({
      totalIncome: 60000,
      totalExpenses: 19500,
      totalSavings: 4000,
      netFlow: 36500,
      savingsRate: (4000 / 60000) * 100,
      transactionCount: 7,
      hasData: true,
    });
  });

  it('never divides by zero income', () => {
    expect(monthSummary(tx, '2025-01')).toMatchObject({ savingsRate: 0, hasData: false, netFlow: 0 });
  });
});
