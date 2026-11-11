import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { FinanceProvider, useFinance } from '../FinanceContext';
import { addMonths, currentMonth } from '@/lib/finance-utils';

function wrapper({ children }: { children: ReactNode }) {
  return <FinanceProvider>{children}</FinanceProvider>;
}

const TX_KEY = 'financial-clarity:transactions';
const CAT_KEY = 'financial-clarity:categories';
const BUDGET_KEY = 'financial-clarity:budgets';
const REC_KEY = 'financial-clarity:reconciliations';
const RECURRING_KEY = 'financial-clarity:recurring';
const SAVINGS_KEY = 'financial-clarity:savings-goal';

/** Makes writes to the given keys fail with a quota error until restored. */
function failWritesTo(...keys: string[]) {
  const original = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (keys.includes(key)) throw new DOMException('Storage full', 'QuotaExceededError');
    return original.call(this, key, value);
  });
}

const expense = { type: 'expense' as const, amount: 250, categoryId: 'groceries', note: 'synthetic', date: '2026-11-01' };

describe('FinanceContext persist-first writes', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('saves a transaction to storage before reporting success', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    let outcome: ReturnType<typeof result.current.addTransaction> | undefined;
    act(() => { outcome = result.current.addTransaction(expense); });
    expect(outcome).toEqual({ ok: true });
    expect(JSON.parse(localStorage.getItem(TX_KEY) ?? '[]')).toHaveLength(1);
    expect(result.current.transactions).toHaveLength(1);
  });

  it('leaves state and storage unchanged when adding, editing, or deleting a transaction fails', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    act(() => { result.current.addTransaction(expense); });
    const before = localStorage.getItem(TX_KEY);
    const id = result.current.transactions[0].id;
    failWritesTo(TX_KEY);

    let add: ReturnType<typeof result.current.addTransaction> | undefined;
    let update: ReturnType<typeof result.current.updateTransaction> | undefined;
    let remove: ReturnType<typeof result.current.deleteTransaction> | undefined;
    act(() => {
      add = result.current.addTransaction({ ...expense, amount: 999 });
      update = result.current.updateTransaction(id, { ...expense, amount: 1 });
      remove = result.current.deleteTransaction(id);
    });

    for (const outcome of [add, update, remove]) {
      expect(outcome).toMatchObject({ ok: false, message: expect.stringContaining('Your data is unchanged') });
    }
    expect(result.current.transactions).toHaveLength(1);
    expect(result.current.transactions[0].amount).toBe(250);
    expect(localStorage.getItem(TX_KEY)).toBe(before);
  });

  it('keeps categories unchanged when adding, editing, or deleting one fails', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    const count = result.current.categories.length;
    failWritesTo(CAT_KEY);

    let add: ReturnType<typeof result.current.addCategory> | undefined;
    let update: ReturnType<typeof result.current.updateCategory> | undefined;
    let remove: ReturnType<typeof result.current.deleteCategory> | undefined;
    act(() => {
      add = result.current.addCategory({ name: 'Pets', icon: 'DollarSign', color: '#10B981', type: 'expense' });
      update = result.current.updateCategory('transport', { name: 'Travel', icon: 'Car', color: '#3B82F6', type: 'expense' });
      remove = result.current.deleteCategory('transport');
    });

    expect(add).toMatchObject({ ok: false });
    expect(update).toMatchObject({ ok: false });
    expect(remove).toMatchObject({ ok: false, reason: 'storage' });
    expect(result.current.categories).toHaveLength(count);
    expect(result.current.categories.find(c => c.id === 'transport')?.name).toBe('Transport');
  });

  it('imports transactions and their new categories together or not at all', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    const categoriesBefore = localStorage.getItem(CAT_KEY);
    const pets = { id: 'pets', name: 'Pets', icon: 'DollarSign', color: '#10B981', type: 'expense' as const };
    failWritesTo(TX_KEY);

    let outcome: ReturnType<typeof result.current.importTransactions> | undefined;
    act(() => { outcome = result.current.importTransactions([{ ...expense, categoryId: 'pets' }], [pets]); });

    expect(outcome).toMatchObject({ ok: false });
    expect(localStorage.getItem(CAT_KEY)).toBe(categoriesBefore);
    expect(result.current.categories.some(c => c.id === 'pets')).toBe(false);
    expect(result.current.transactions).toHaveLength(0);

    vi.restoreAllMocks();
    act(() => { outcome = result.current.importTransactions([{ ...expense, categoryId: 'pets' }], [pets]); });
    expect(outcome).toEqual({ ok: true, count: 1 });
    expect(result.current.categories.some(c => c.id === 'pets')).toBe(true);
  });

  it('rolls back the adjustment transaction when the reconciliation record cannot be saved', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    const txBefore = localStorage.getItem(TX_KEY);
    failWritesTo(REC_KEY);

    let outcome: ReturnType<typeof result.current.addReconciliation> | undefined;
    act(() => {
      outcome = result.current.addReconciliation({
        month: '2026-10', actualBalance: 1000, expectedBalance: 1500, adjustmentAmount: 500,
      });
    });

    expect(outcome).toMatchObject({ ok: false });
    expect(localStorage.getItem(TX_KEY)).toBe(txBefore);
    expect(result.current.transactions).toHaveLength(0);
    expect(result.current.reconciliations).toHaveLength(0);
  });

  it('reports a failed recurring generation and adds nothing', async () => {
    const startMonth = addMonths(currentMonth(), -2);
    localStorage.setItem(RECURRING_KEY, JSON.stringify([
      { id: 'r1', description: 'Synthetic rent', amount: 1000, categoryId: 'rent', dayOfMonth: 1, active: true, startMonth },
    ]));
    failWritesTo(TX_KEY);

    const { result } = renderHook(() => useFinance(), { wrapper });

    await waitFor(() => expect(result.current.storageError).toMatch(/Recurring expenses could not be added/));
    expect(result.current.transactions).toHaveLength(0);
    expect(result.current.recurringExpenses[0].lastGeneratedMonth).toBeUndefined();
    expect(JSON.parse(localStorage.getItem(RECURRING_KEY) ?? '[]')[0].lastGeneratedMonth).toBeUndefined();
  });

  it('leaves budgets unchanged when add, update, delete, or copy writes fail', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    act(() => { result.current.addBudget({ categoryId: 'groceries', limit: 5000, month: '2026-11' }); });
    const before = localStorage.getItem(BUDGET_KEY);
    const id = result.current.budgets[0].id;
    failWritesTo(BUDGET_KEY);

    let add: ReturnType<typeof result.current.addBudget> | undefined;
    let update: ReturnType<typeof result.current.updateBudget> | undefined;
    let remove: ReturnType<typeof result.current.deleteBudget> | undefined;
    let copy: ReturnType<typeof result.current.transferBudgetsToMonth> | undefined;
    act(() => {
      add = result.current.addBudget({ categoryId: 'rent', limit: 2000, month: '2026-11' });
      update = result.current.updateBudget(id, 1);
      remove = result.current.deleteBudget(id);
      copy = result.current.transferBudgetsToMonth('2026-11', '2026-12');
    });

    for (const outcome of [add, update, remove, copy]) {
      expect(outcome).toMatchObject({ ok: false, message: expect.stringContaining('Your data is unchanged') });
    }
    expect(result.current.budgets[0].limit).toBe(5000);
    expect(result.current.budgets).toHaveLength(1);
    expect(localStorage.getItem(BUDGET_KEY)).toBe(before);
  });

  it('leaves recurring rules unchanged when create, edit, pause, or delete writes fail', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    const rule = {
      description: 'Synthetic rent', amount: 1000, categoryId: 'rent', dayOfMonth: 31,
      active: false, startMonth: '2026-11',
    };
    let add: ReturnType<typeof result.current.addRecurring> | undefined;
    act(() => { add = result.current.addRecurring(rule); });
    expect(add).toEqual({ ok: true });
    const before = localStorage.getItem(RECURRING_KEY);
    const id = result.current.recurringExpenses[0].id;
    failWritesTo(RECURRING_KEY);

    let create: ReturnType<typeof result.current.addRecurring> | undefined;
    let update: ReturnType<typeof result.current.updateRecurring> | undefined;
    let toggle: ReturnType<typeof result.current.toggleRecurringActive> | undefined;
    let remove: ReturnType<typeof result.current.deleteRecurring> | undefined;
    act(() => {
      create = result.current.addRecurring({ ...rule, description: 'Synthetic utilities' });
      update = result.current.updateRecurring(id, { ...rule, amount: 1 });
      toggle = result.current.toggleRecurringActive(id);
      remove = result.current.deleteRecurring(id);
    });

    for (const outcome of [create, update, toggle, remove]) expect(outcome).toMatchObject({ ok: false });
    expect(result.current.recurringExpenses).toHaveLength(1);
    expect(result.current.recurringExpenses[0]).toMatchObject({ id, amount: 1000, active: false });
    expect(localStorage.getItem(RECURRING_KEY)).toBe(before);
  });

  it('does not report savings targets saved when storage rejects the write', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    failWritesTo(SAVINGS_KEY);

    let outcome: ReturnType<typeof result.current.setSavingsGoal> | undefined;
    act(() => {
      outcome = result.current.setSavingsGoal({
        goal: { monthly: 500, annual: 6000 },
        emergency: { monthly: 0, annual: 0 },
      });
    });

    expect(outcome).toMatchObject({ ok: false });
    expect(result.current.savingsGoal.goal).toEqual({ monthly: 0, annual: 0 });
    expect(localStorage.getItem(SAVINGS_KEY)).toBeNull();
  });

  it('generates one transaction with a stable rule/month occurrence key', async () => {
    const month = currentMonth();
    localStorage.setItem(RECURRING_KEY, JSON.stringify([
      { id: 'stable-rule', description: 'Synthetic monthly', amount: 200, categoryId: 'rent', dayOfMonth: 1, active: true, startMonth: month },
    ]));
    const { result, rerender } = renderHook(() => useFinance(), { wrapper });

    await waitFor(() => expect(result.current.transactions).toHaveLength(1));
    expect(result.current.transactions[0]).toMatchObject({ recurringRuleId: 'stable-rule', recurringMonth: month });
    rerender();
    expect(result.current.transactions).toHaveLength(1);
  });
});
