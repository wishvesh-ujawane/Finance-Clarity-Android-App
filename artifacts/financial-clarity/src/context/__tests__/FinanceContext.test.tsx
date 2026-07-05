import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FinanceProvider, useFinance } from '../FinanceContext';
import type { ReactNode } from 'react';

// Wrapper component for hooks
function wrapper({ children }: { children: ReactNode }) {
  return <FinanceProvider>{children}</FinanceProvider>;
}

// Clear localStorage before each test
beforeEach(() => {
  localStorage.clear();
});

describe('FinanceContext', () => {
  it('provides initial state', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    
    expect(result.current.transactions).toEqual([]);
    expect(result.current.categories.length).toBeGreaterThan(0); // Has default categories + savings
    expect(result.current.budgets).toEqual([]);
    expect(result.current.selectedMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  it('adds a transaction', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    
    act(() => {
      result.current.addTransaction({
        type: 'expense',
        amount: 100,
        date: '2026-07-05',
        categoryId: 'groceries',
        note: 'Test expense',
      });
    });

    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].note).toBe('Test expense');
    expect(result.current.transactions[0].amount).toBe(100);
  });

  it('adds a budget', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    
    act(() => {
      result.current.addBudget({
        categoryId: 'groceries',
        limit: 5000,
        month: '2026-07',
      });
    });

    expect(result.current.budgets).toHaveLength(1);
    expect(result.current.budgets[0].limit).toBe(5000);
  });

  it('updates selectedMonth', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    
    act(() => {
      result.current.setSelectedMonth('2026-05');
    });

    expect(result.current.selectedMonth).toBe('2026-05');
  });

  it('calculates month summary correctly', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    
    // Add income transaction
    act(() => {
      result.current.addTransaction({
        type: 'income',
        amount: 50000,
        date: '2026-07-01',
        categoryId: 'salary',
        note: 'Salary',
      });
    });

    // Add expense transaction
    act(() => {
      result.current.addTransaction({
        type: 'expense',
        amount: 5000,
        date: '2026-07-05',
        categoryId: 'groceries',
        note: 'Groceries',
      });
    });

    const summary = result.current.getMonthSummary('2026-07');
    
    expect(summary.totalIncome).toBe(50000);
    expect(summary.totalExpenses).toBe(5000);
    expect(summary.netFlow).toBe(45000);
    expect(summary.hasData).toBe(true);
  });
});
