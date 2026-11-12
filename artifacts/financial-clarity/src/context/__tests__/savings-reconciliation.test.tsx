import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { FinanceProvider, useFinance } from '../FinanceContext';
import { buildBackup, validateBackup, applyBackup } from '@/lib/backup';

function wrapper({ children }: { children: ReactNode }) {
  return <FinanceProvider>{children}</FinanceProvider>;
}

function setup() {
  const hook = renderHook(() => useFinance(), { wrapper });
  act(() => {
    hook.result.current.addTransaction({ type: 'income', amount: 200000, categoryId: 'salary', note: '', date: '2026-10-01' });
    hook.result.current.addTransaction({ type: 'expense', amount: 100000, categoryId: 'savings-goal', note: '', date: '2026-10-02' });
    hook.result.current.addTransaction({ type: 'expense', amount: 30000, categoryId: 'savings-emergency', note: '', date: '2026-11-02' });
  });
  return hook;
}

describe('savings reconciliation', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('records only the savings difference, leaves bank cash unchanged, and does not duplicate it on repeat', () => {
    const { result } = setup();
    expect(result.current.getExpectedBankBalanceAtEndOf('2026-11')).toBe(70000);
    const input = {
      month: '2026-11', actualBalance: 70000, expectedBalance: 70000,
      savings: { actualBalance: 135000 },
    };
    act(() => { expect(result.current.addReconciliation(input).ok).toBe(true); });
    expect(result.current.getSavingsBalanceAtEndOf('2026-11')).toBe(135000);
    expect(result.current.getCumulativeNetBalanceThroughEndOf('2026-11')).toBe(205000);
    expect(result.current.getExpectedBankBalanceAtEndOf('2026-11')).toBe(70000);
    expect(result.current.getTotalIncome('2026-11')).toBe(0);
    expect(result.current.transactions.filter(t => t.savingsCorrection)).toMatchObject([
      { amount: 5000, savingsCorrection: 'increase', date: '2026-11-30' },
    ]);
    act(() => { expect(result.current.addReconciliation(input).ok).toBe(true); });
    expect(result.current.transactions.filter(t => t.savingsCorrection)).toHaveLength(1);
    expect(result.current.getCarryForward('2026-12')).toBe(205000);
  });

  it.each([
    ['spent', 70000, 195000],
    ['transfer', 75000, 200000],
  ] as const)('handles a lower savings balance as %s', (reason, bank, lifetime) => {
    const { result } = setup();
    act(() => {
      expect(result.current.addReconciliation({
        month: '2026-11', actualBalance: bank, expectedBalance: bank,
        savings: { actualBalance: 125000, decreaseReason: reason },
      }).ok).toBe(true);
    });
    expect(result.current.getSavingsBalanceAtEndOf('2026-11')).toBe(125000);
    expect(result.current.getExpectedBankBalanceAtEndOf('2026-11')).toBe(bank);
    expect(result.current.getCumulativeNetBalanceThroughEndOf('2026-11')).toBe(lifetime);
    expect(result.current.getTotalExpenses('2026-11')).toBe(0);
  });

  it('requires a reason and refuses stale bank figures without saving', () => {
    const { result } = setup();
    const before = localStorage.getItem('financial-clarity:transactions');
    act(() => {
      expect(result.current.addReconciliation({
        month: '2026-11', actualBalance: 70000, expectedBalance: 70000,
        savings: { actualBalance: 125000 },
      })).toMatchObject({ ok: false });
      expect(result.current.addReconciliation({
        month: '2026-11', actualBalance: 70000, expectedBalance: 70000,
        savings: { actualBalance: 125000, decreaseReason: 'transfer' },
      })).toMatchObject({ ok: false });
    });

    expect(localStorage.getItem('financial-clarity:transactions')).toBe(before);
  });

  it('only closes a bank gap when confirmed, while retaining unpaid card debt', () => {
      const { result } = setup();
      act(() => {
        result.current.addTransaction({ type: 'expense', amount: 10000, categoryId: 'groceries', note: '', date: '2026-11-10', paymentMethod: 'credit-card' });
      });
      const base = {
        month: '2026-11', actualBalance: 68000, expectedBalance: 70000,
        savings: { actualBalance: 135000 },
      };
      act(() => { expect(result.current.addReconciliation(base).ok).toBe(true); });
      expect(result.current.getExpectedBankBalanceAtEndOf('2026-11')).toBe(70000);
      expect(result.current.getCumulativeNetBalanceThroughEndOf('2026-11')).toBe(195000);
      expect(result.current.transactions.some(t => t.categoryId === '_adjustment-missed-spend')).toBe(false);
      act(() => {
        expect(result.current.addReconciliation({ ...base, adjustmentAmount: 2000 }).ok).toBe(true);
      });
      expect(result.current.getExpectedBankBalanceAtEndOf('2026-11')).toBe(68000);
      expect(result.current.getCumulativeNetBalanceThroughEndOf('2026-11')).toBe(193000);
      expect(result.current.getOutstandingCardBalanceAtEndOf('2026-11')).toBe(10000);
      expect(result.current.transactions.filter(t => t.savingsCorrection)).toHaveLength(1);
    });
  it('rolls back both correction and bank adjustment if the record cannot be saved', () => {
    const { result } = setup();
    const before = localStorage.getItem('financial-clarity:transactions');
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'financial-clarity:reconciliations') throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, key, value);
    });
    act(() => {
      expect(result.current.addReconciliation({
        month: '2026-11', actualBalance: 68000, expectedBalance: 70000, adjustmentAmount: 2000,
        savings: { actualBalance: 135000 },
      })).toMatchObject({ ok: false });
    });
    expect(localStorage.getItem('financial-clarity:transactions')).toBe(before);
    expect(result.current.transactions.filter(t => t.savingsCorrection)).toHaveLength(0);
    expect(result.current.reconciliations).toHaveLength(0);
  });

  it('removes a confirmed correction without changing its reconciliation snapshot', () => {
    const { result } = setup();
    act(() => {
      result.current.addReconciliation({
        month: '2026-11', actualBalance: 70000, expectedBalance: 70000,
        savings: { actualBalance: 135000 },
      });
    });
    const correction = result.current.transactions.find(t => t.savingsCorrection);
    expect(correction).toBeDefined();
    if (!correction) return;
    act(() => { expect(result.current.deleteTransaction(correction.id).ok).toBe(true); });
    expect(result.current.getSavingsBalanceAtEndOf('2026-11')).toBe(130000);
    expect(result.current.getCumulativeNetBalanceThroughEndOf('2026-11')).toBe(200000);
    expect(result.current.getReconciliationFor('2026-11')).toMatchObject({ actualBalance: 70000, expectedBalance: 70000 });
  });

  it('preserves correction metadata through backup and restore', () => {
    const { result } = setup();
    act(() => {
      result.current.addReconciliation({
        month: '2026-11', actualBalance: 70000, expectedBalance: 70000,
        savings: { actualBalance: 135000 },
      });
    });
    const validation = validateBackup(JSON.parse(JSON.stringify(buildBackup())));
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    localStorage.clear();
    expect(applyBackup(validation.backup)).toMatchObject({ ok: true });
    const restored = renderHook(() => useFinance(), { wrapper });
    expect(restored.result.current.getSavingsBalanceAtEndOf('2026-11')).toBe(135000);
    expect(restored.result.current.getExpectedBankBalanceAtEndOf('2026-11')).toBe(70000);
    expect(restored.result.current.getCumulativeNetBalanceThroughEndOf('2026-11')).toBe(205000);
  });
});
