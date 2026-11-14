import { describe, expect, it } from 'vitest';
import {
  balanceThroughEndOf,
  cardActivity,
  cardBillPaymentLimit,
  cardBillPaymentsAfter,
  cardBillPaymentsIn,
  carryForward,
  categorySpent,
  consumptionBetween,
  consumptionByCategory,
  consumptionByCategoryBetween,
  expectedBankBalanceAtEndOf,
  isCardBillPayment,
  isCardPurchase,
  isConsumptionExpense,
  isSavingsContribution,
  lifetimeBalance,
  monthlyNet,
  monthSummary,
  outstandingCardAmount,
  outstandingCardAmountThrough,
  outstandingCardAmountThroughEndOf,
  savingsBalanceThroughEndOf,
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

  it('can be measured on a given date', () => {
    expect(outstandingCardAmountThrough(tx, '2026-10-09')).toBe(0);
    expect(outstandingCardAmountThrough(tx, '2026-10-24')).toBe(2000);
    expect(outstandingCardAmountThrough(tx, '2026-10-25')).toBe(500);
    expect(outstandingCardAmountThrough(tx, '2026-11-15')).toBe(500);
  });

  it('sums bill payments dated after a date', () => {
    expect(cardBillPaymentsAfter(tx, '2026-10-31')).toBe(1000);
    expect(cardBillPaymentsAfter(tx, '2026-11-15')).toBe(0);
  });

  it('limits a bill payment to what was unpaid on its date and what is unpaid now', () => {
    expect(cardBillPaymentLimit(tx, '2026-10-24')).toBe(500);
    expect(cardBillPaymentLimit(tx, '2026-10-09')).toBe(0);
    // A later payment already covers October: the month-end entry cannot repeat it.
    const paidInNovember: MetricTransaction[] = [
      { type: 'expense', amount: 8000, categoryId: 'groceries', date: '2026-10-10', paymentMethod: 'credit-card' },
      { type: 'expense', amount: 8000, categoryId: 'other', date: '2026-11-03', paymentMethod: 'credit-card-payment' },
    ];
    expect(outstandingCardAmountThroughEndOf(paidInNovember, '2026-10')).toBe(8000);
    expect(cardBillPaymentLimit(paidInNovember, '2026-10-31')).toBe(0);
  });

  it('lists card purchases and bill payments newest first', () => {
    const activity = cardActivity(tx);
    expect(activity.map(t => t.id)).toEqual(['nov-card-buy', 'nov-card-bill', 'oct-card-bill', 'oct-card-buy']);
    expect(activity.every(t => isCardPurchase(t) || isCardBillPayment(t))).toBe(true);
    expect(isCardPurchase({ type: 'income', paymentMethod: 'credit-card' })).toBe(false);
  });
});

describe('expected bank balance for month-end reconcile', () => {
  it('excludes savings through the month and adds the still-unpaid card amount', () => {
    expect(expectedBankBalanceAtEndOf(tx, '2026-10')).toBe(33000 - 5000 + 500);
    expect(expectedBankBalanceAtEndOf(tx, NOV)).toBe(73500 - 9000 + 500);
  });

  it('corrects combined savings without double counting or changing ordinary income and spending', () => {
    const base: MetricTransaction[] = [
      { type: 'income', amount: 200000, categoryId: 'salary', date: '2026-10-01' },
      { type: 'expense', amount: 100000, categoryId: 'savings-goal', date: '2026-10-02' },
      { type: 'expense', amount: 30000, categoryId: 'savings-emergency', date: '2026-11-02' },
      { type: 'expense', amount: 9000, categoryId: 'savings-goal', date: '2026-12-01' },
    ];
    const increase: MetricTransaction = { type: 'income', amount: 5000, categoryId: '_adjustment-savings', date: '2026-11-30', savingsCorrection: 'increase' };
    const corrected = [...base, increase];
    expect(savingsBalanceThroughEndOf(corrected, NOV)).toBe(135000);
    expect(balanceThroughEndOf(corrected, NOV)).toBe(205000);
    expect(expectedBankBalanceAtEndOf(corrected, NOV)).toBe(70000);
    expect(totalIncome(corrected, NOV)).toBe(0);
    expect(totalSavingsContributions(corrected, NOV)).toBe(30000);
    expect(totalConsumption(corrected, NOV)).toBe(0);
    expect(savingsBalanceThroughEndOf(corrected, '2026-10')).toBe(100000);
  });

  it('distinguishes savings spent from a transfer back to the bank', () => {
    const base: MetricTransaction[] = [
      { type: 'income', amount: 100000, categoryId: 'salary', date: '2026-11-01' },
      { type: 'expense', amount: 30000, categoryId: 'savings-goal', date: '2026-11-02' },
    ];
    const correction: MetricTransaction = { type: 'expense', amount: 5000, categoryId: '_adjustment-savings', date: '2026-11-30', savingsCorrection: 'spent' };
    const spent = [...base, correction];
    const transferred = [...base, { ...correction, savingsCorrection: 'transfer' as const }];
    expect(savingsBalanceThroughEndOf(spent, NOV)).toBe(25000);
    expect(balanceThroughEndOf(spent, NOV)).toBe(95000);
    expect(expectedBankBalanceAtEndOf(spent, NOV)).toBe(70000);
    expect(savingsBalanceThroughEndOf(transferred, NOV)).toBe(25000);
    expect(balanceThroughEndOf(transferred, NOV)).toBe(100000);
    expect(expectedBankBalanceAtEndOf(transferred, NOV)).toBe(75000);
    expect(totalConsumption(spent, NOV)).toBe(0);
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
