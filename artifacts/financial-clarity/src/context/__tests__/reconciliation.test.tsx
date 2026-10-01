/**
 * Reconciliation data-model tests: addReconciliation / getReconciliationFor,
 * adjustment-txn creation, and carry-forward integrity after a reconcile.
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

describe('Reconciliation', () => {
  it('getReconciliationFor returns null when no record exists', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    expect(result.current.getReconciliationFor('2026-07')).toBeNull();
  });

  it('addReconciliation with no adjustment stores the record and leaves txns untouched', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addReconciliation({
        month: '2026-07',
        actualBalance: 50000,
        expectedBalance: 50000,
      });
    });

    const record = result.current.getReconciliationFor('2026-07');
    expect(record).not.toBeNull();
    expect(record?.actualBalance).toBe(50000);
    expect(record?.expectedBalance).toBe(50000);
    expect(record?.adjustmentTxnId).toBeUndefined();
    expect(result.current.transactions.length).toBe(0);
  });

  it('positive adjustment creates a Missed Spend expense on the last day of the month', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addReconciliation({
        month: '2026-07',
        actualBalance: 48000,
        expectedBalance: 50000,
        adjustmentAmount: 2000,
      });
    });

    const record = result.current.getReconciliationFor('2026-07');
    expect(record?.adjustmentTxnId).toBeDefined();
    const tx = result.current.transactions.find(t => t.id === record!.adjustmentTxnId);
    expect(tx).toBeDefined();
    expect(tx!.type).toBe('expense');
    expect(tx!.amount).toBe(2000);
    expect(tx!.categoryId).toBe('_adjustment-missed-spend');
    expect(tx!.date).toBe('2026-07-31');
  });

  it('negative adjustment creates an Over-logged Reversal income', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addReconciliation({
        month: '2026-02',
        actualBalance: 11000,
        expectedBalance: 10000,
        adjustmentAmount: -1000,
      });
    });

    const record = result.current.getReconciliationFor('2026-02');
    const tx = result.current.transactions.find(t => t.id === record!.adjustmentTxnId);
    expect(tx!.type).toBe('income');
    expect(tx!.amount).toBe(1000);
    expect(tx!.categoryId).toBe('_adjustment-overlogged');
    expect(tx!.date).toBe('2026-02-28'); // 2026 is not a leap year
  });

  it('reconciled adjustment closes the carry-forward gap to zero', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addTransaction({ type: 'income', amount: 50000, date: '2026-07-01', categoryId: 'salary', note: 'Salary' });
      result.current.addTransaction({ type: 'expense', amount: 30000, date: '2026-07-10', categoryId: 'leisure', note: 'Shopping' });
      result.current.addTransaction({ type: 'expense', amount: 5000, date: '2026-07-11', categoryId: 'groceries', note: 'Groceries' });
      result.current.addTransaction({ type: 'expense', amount: 10000, date: '2026-07-15', categoryId: 'rent', note: 'EMI' });
      result.current.addTransaction({ type: 'expense', amount: 3000, date: '2026-07-20', categoryId: 'dining', note: 'Food' });
    });

    // Expected end-of-July balance per the app: 50000 - 48000 = 2000.
    expect(result.current.getCumulativeNetBalanceThroughEndOf('2026-07')).toBe(2000);

    act(() => {
      // User's actual bank balance is 0. Gap = 2000 (missed spend).
      result.current.addReconciliation({
        month: '2026-07',
        actualBalance: 0,
        expectedBalance: 2000,
        adjustmentAmount: 2000,
      });
    });

    // After adjustment, carry-forward into August should be zero.
    expect(result.current.getCarryForward('2026-08')).toBe(0);
    // And the cumulative balance through end of July too.
    expect(result.current.getCumulativeNetBalanceThroughEndOf('2026-07')).toBe(0);
  });

  it('re-reconciling the same month replaces the previous record', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });

    act(() => {
      result.current.addReconciliation({
        month: '2026-07',
        actualBalance: 48000,
        expectedBalance: 50000,
        adjustmentAmount: 2000,
      });
      result.current.addReconciliation({
        month: '2026-07',
        actualBalance: 47000,
        expectedBalance: 50000,
      });
    });

    const record = result.current.getReconciliationFor('2026-07');
    expect(record?.actualBalance).toBe(47000);
    const monthRecords = result.current.reconciliations.filter(r => r.month === '2026-07');
    expect(monthRecords.length).toBe(1);
  });
});
