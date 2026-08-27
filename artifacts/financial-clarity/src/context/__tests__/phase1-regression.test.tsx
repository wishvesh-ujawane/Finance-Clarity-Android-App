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

  it('getCarryForward includes all expenses (savings + consumption)', () => {
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
    });

    // Carry forward to July = 10000 - 3000 - 1000 = 6000
    expect(result.current.getCarryForward('2026-07')).toBe(6000);
  });

  it('getNetBalanceToDate includes all expense types', () => {
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
    });

    // 20000 - 5000 - 2000 = 13000
    expect(result.current.getNetBalanceToDate()).toBe(13000);
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
});
