/**
 * Regression test suite for Phase 1 SMS Auto-Import foundation.
 * Ensures that adding paymentMethod field and refactoring to isConsumptionExpense
 * preserves all existing aggregation logic — no numeric changes in totals.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FinanceProvider, useFinance } from '../FinanceContext';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return <FinanceProvider>{children}</FinanceProvider>;
}

beforeEach(() => {
  localStorage.clear();
});

describe('Phase 1 regression suite — aggregation invariants', () => {
  it('getTotalExpenses excludes savings-category expenses', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addTransaction({
        type: 'expense',
        amount: 1000,
        date: '2026-07-10',
        categoryId: 'groceries',
        note: 'Normal expense',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 2000,
        date: '2026-07-11',
        categoryId: 'savings-goal',
        note: 'Savings transfer',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 500,
        date: '2026-07-12',
        categoryId: 'savings-emergency',
        note: 'Emergency fund',
      });
    });

    // Only groceries should count in totalExpenses
    expect(result.current.getTotalExpenses('2026-07')).toBe(1000);
  });

  it('getTotalSavings includes only savings-category expenses', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addTransaction({
        type: 'expense',
        amount: 1000,
        date: '2026-07-10',
        categoryId: 'groceries',
        note: 'Normal',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 2000,
        date: '2026-07-11',
        categoryId: 'savings-goal',
        note: 'Goal',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 500,
        date: '2026-07-12',
        categoryId: 'savings-emergency',
        note: 'Emergency',
      });
    });

    expect(result.current.getTotalSavings('2026-07')).toBe(2500);
  });

  it('getMonthSummary splits expenses correctly', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addTransaction({
        type: 'income',
        amount: 50000,
        date: '2026-07-01',
        categoryId: 'salary',
        note: 'Salary',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 5000,
        date: '2026-07-05',
        categoryId: 'groceries',
        note: 'Groceries',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 3000,
        date: '2026-07-06',
        categoryId: 'rent',
        note: 'Rent',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 2000,
        date: '2026-07-07',
        categoryId: 'savings-goal',
        note: 'Savings',
      });
    });

    const summary = result.current.getMonthSummary('2026-07');
    expect(summary.totalIncome).toBe(50000);
    expect(summary.totalExpenses).toBe(8000); // groceries + rent
    expect(summary.totalSavings).toBe(2000);
    expect(summary.netFlow).toBe(40000); // 50000 - 8000 - 2000
  });

  it('getCarryForward excludes savings transfers and card-payment transfers', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addTransaction({
        type: 'income',
        amount: 10000,
        date: '2026-06-01',
        categoryId: 'salary',
        note: 'June income',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 3000,
        date: '2026-06-05',
        categoryId: 'groceries',
        note: 'June expense',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 1000,
        date: '2026-06-06',
        categoryId: 'savings-goal',
        note: 'June savings',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 2000,
        date: '2026-06-10',
        categoryId: 'other',
        note: 'June credit-card bill',
        paymentMethod: 'credit-card-payment',
      });
    });

    // Carry forward to July = 10000 - 3000 (only the consumption grocery expense)
    // Savings transfer stays in user's pocket (just moved buckets).
    // Credit-card-payment is a bank -> card transfer; the underlying card
    // purchase is already (or will be) recorded separately.
    expect(result.current.getCarryForward('2026-07')).toBe(7000);
  });

  it('getCarryForward counts credit-card purchases as consumption', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addTransaction({
        type: 'income',
        amount: 10000,
        date: '2026-06-01',
        categoryId: 'salary',
        note: 'Income',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 2000,
        date: '2026-06-05',
        categoryId: 'leisure',
        note: 'Vacation on card',
        paymentMethod: 'credit-card',
      });
    });

    // Credit-card purchase IS consumption — reduces carry-forward.
    expect(result.current.getCarryForward('2026-07')).toBe(8000);
  });

  it('getNetBalanceToDate excludes savings transfers and card-payment transfers', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    act(() => {
      result.current.addTransaction({
        type: 'income',
        amount: 20000,
        date: yesterdayStr,
        categoryId: 'salary',
        note: 'Income',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 5000,
        date: yesterdayStr,
        categoryId: 'groceries',
        note: 'Expense',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 2000,
        date: yesterdayStr,
        categoryId: 'savings-goal',
        note: 'Savings',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 1500,
        date: todayStr,
        categoryId: 'other',
        note: 'Card bill',
        paymentMethod: 'credit-card-payment',
      });
    });

    // 20000 - 5000 = 15000. Savings and card-payment don't drain pocket.
    expect(result.current.getNetBalanceToDate()).toBe(15000);
  });

  it('getCumulativeNetBalanceThroughEndOf covers only txns dated on or before month end', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addTransaction({
        type: 'income',
        amount: 50000,
        date: '2026-07-01',
        categoryId: 'salary',
        note: 'July salary',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 30000,
        date: '2026-07-10',
        categoryId: 'leisure',
        note: 'Shopping',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 10000,
        date: '2026-07-15',
        categoryId: 'rent',
        note: 'EMI',
      });
      // August entry — must be ignored for an end-of-July cutoff.
      result.current.addTransaction({
        type: 'expense',
        amount: 5000,
        date: '2026-08-02',
        categoryId: 'groceries',
        note: 'August groceries',
      });
    });

    // 50000 - 30000 - 10000 = 10000. August entry excluded.
    expect(result.current.getCumulativeNetBalanceThroughEndOf('2026-07')).toBe(10000);
  });

  it('paymentMethod field does not affect any aggregations', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addTransaction({
        type: 'expense',
        amount: 1500,
        date: '2026-07-10',
        categoryId: 'groceries',
        note: 'With paymentMethod',
        // @ts-expect-error - paymentMethod is optional but we're testing its presence
        paymentMethod: 'hdfc-debit-4532',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 2500,
        date: '2026-07-11',
        categoryId: 'dining',
        note: 'Without paymentMethod',
      });
    });

    expect(result.current.getTotalExpenses('2026-07')).toBe(4000);
    const summary = result.current.getMonthSummary('2026-07');
    expect(summary.totalExpenses).toBe(4000);
  });

  it('getOutstandingCardBalance = CC purchases minus CC payments, floored at zero', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    // No tagged activity → zero.
    expect(result.current.getOutstandingCardBalance()).toBe(0);

    act(() => {
      result.current.addTransaction({
        type: 'expense',
        amount: 2000,
        date: '2026-07-10',
        categoryId: 'leisure',
        note: 'Vacation on card',
        paymentMethod: 'credit-card',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 500,
        date: '2026-07-12',
        categoryId: 'dining',
        note: 'Lunch on card',
        paymentMethod: 'credit-card',
      });
    });

    // 2000 + 500 purchases, nothing paid yet.
    expect(result.current.getOutstandingCardBalance()).toBe(2500);

    act(() => {
      result.current.addTransaction({
        type: 'expense',
        amount: 1000,
        date: '2026-08-05',
        categoryId: 'other',
        note: 'Card bill July',
        paymentMethod: 'credit-card-payment',
      });
    });

    // 2500 - 1000 = 1500 outstanding.
    expect(result.current.getOutstandingCardBalance()).toBe(1500);

    act(() => {
      // Overpayment: cumulative payments now 1000 + 2000 = 3000 > 2500 purchases.
      result.current.addTransaction({
        type: 'expense',
        amount: 2000,
        date: '2026-09-05',
        categoryId: 'other',
        note: 'Overpayment',
        paymentMethod: 'credit-card-payment',
      });
    });

    // Floored at zero — never surface negative.
    expect(result.current.getOutstandingCardBalance()).toBe(0);
  });

  it('cash and bank expenses are ignored by getOutstandingCardBalance', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addTransaction({
        type: 'expense',
        amount: 5000,
        date: '2026-07-10',
        categoryId: 'groceries',
        note: 'Cash spend',
        paymentMethod: 'cash',
      });
      result.current.addTransaction({
        type: 'expense',
        amount: 3000,
        date: '2026-07-11',
        categoryId: 'rent',
        note: 'Bank spend',
        paymentMethod: 'bank',
      });
      result.current.addTransaction({
        type: 'income',
        amount: 10000,
        date: '2026-07-01',
        categoryId: 'salary',
        note: 'Salary',
      });
    });

    expect(result.current.getOutstandingCardBalance()).toBe(0);
  });
});
