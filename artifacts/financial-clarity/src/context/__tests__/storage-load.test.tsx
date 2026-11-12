import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { FinanceProvider, useFinance } from '../FinanceContext';
import type { FinanceLoad } from '@/lib/storage/startup';

const TX_KEY = 'financial-clarity:transactions';
const CAT_KEY = 'financial-clarity:categories';

const tx = { id: 't1', type: 'expense' as const, amount: 100, categoryId: 'groceries', note: 'synthetic', date: '2026-11-01' };

describe('FinanceContext storage load', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('uses the data read by the startup check', () => {
    const load: FinanceLoad = {
      data: { transactions: [tx], categories: [], budgets: [], recurringExpenses: [], reconciliations: [], savingsGoal: null },
      quarantined: [],
    };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <FinanceProvider initialLoad={load}>{children}</FinanceProvider>
    );

    const { result } = renderHook(() => useFinance(), { wrapper });

    expect(result.current.transactions).toEqual([tx]);
  });

  it('does not overwrite a quarantined key at launch', () => {
    const raw = JSON.stringify([tx, { id: 'broken' }]);
    localStorage.setItem(TX_KEY, raw);
    const wrapper = ({ children }: { children: ReactNode }) => <FinanceProvider>{children}</FinanceProvider>;

    const { result } = renderHook(() => useFinance(), { wrapper });

    expect(result.current.transactions).toHaveLength(1);
    expect(localStorage.getItem(TX_KEY)).toBe(raw);
    expect(localStorage.getItem(CAT_KEY)).not.toBeNull();
  });

  it('keeps current state and reports an error when a reload cannot read storage', () => {
    localStorage.setItem(TX_KEY, JSON.stringify([tx]));
    const wrapper = ({ children }: { children: ReactNode }) => <FinanceProvider>{children}</FinanceProvider>;
    const { result } = renderHook(() => useFinance(), { wrapper });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    act(() => result.current.reloadFromStorage());

    expect(result.current.transactions).toEqual([tx]);
    expect(result.current.storageError).toContain('Couldn\u2019t reload');
  });
});
