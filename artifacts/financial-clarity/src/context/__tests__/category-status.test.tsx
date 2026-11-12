import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { FinanceProvider, useFinance } from '../FinanceContext';
import { INACTIVE_CATEGORY_MESSAGE } from '@/lib/category-rules';

const TX_KEY = 'financial-clarity:transactions';
const CAT_KEY = 'financial-clarity:categories';

function wrapper({ children }: { children: ReactNode }) {
  return <FinanceProvider>{children}</FinanceProvider>;
}

const leisureExpense = { type: 'expense' as const, amount: 300, categoryId: 'leisure', note: 'synthetic', date: '2026-11-02' };

function renderWithInactiveLeisure() {
  const hook = renderHook(() => useFinance(), { wrapper });
  act(() => { hook.result.current.addTransaction(leisureExpense); });
  act(() => { hook.result.current.setCategoryActive('leisure', false); });
  return hook;
}

describe('category status (PRD FR-03)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('seeds every default category as active', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    expect(result.current.categories.every(c => c.active === true)).toBe(true);
  });

  it('saves a status change and keeps the category on existing records', () => {
    const { result } = renderWithInactiveLeisure();
    const stored = JSON.parse(localStorage.getItem(CAT_KEY) ?? '[]') as Array<{ id: string; active?: boolean }>;
    expect(stored.find(c => c.id === 'leisure')?.active).toBe(false);
    expect(result.current.categories.find(c => c.id === 'leisure')).toBeDefined();
    expect(result.current.transactions[0].categoryId).toBe('leisure');
  });

  it('refuses to make a built-in category inactive', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    let outcome: ReturnType<typeof result.current.setCategoryActive> | undefined;
    act(() => { outcome = result.current.setCategoryActive('savings-goal', false); });
    expect(outcome).toMatchObject({ ok: false });
    act(() => { outcome = result.current.setCategoryActive('other', false); });
    expect(outcome).toMatchObject({ ok: false });
    expect(result.current.categories.find(c => c.id === 'other')?.active).toBe(true);
  });

  it('refuses to make a category inactive while an active recurring expense uses it', () => {
    const { result } = renderHook(() => useFinance(), { wrapper });
    act(() => {
      result.current.addRecurring({ description: 'Gym', amount: 900, categoryId: 'leisure', dayOfMonth: 5, active: true, startMonth: '2026-11' });
    });
    const before = localStorage.getItem(CAT_KEY);
    let outcome: ReturnType<typeof result.current.setCategoryActive> | undefined;
    act(() => { outcome = result.current.setCategoryActive('leisure', false); });
    expect(outcome).toMatchObject({ ok: false });
    expect(outcome && !outcome.ok ? outcome.message : '').toContain('\u201cGym\u201d');
    expect(localStorage.getItem(CAT_KEY)).toBe(before);
    expect(result.current.categories.find(c => c.id === 'leisure')?.active).toBe(true);
    expect(result.current.recurringExpenses[0].active).toBe(true);

    // Once the rule is paused, the category can be made inactive.
    const ruleId = result.current.recurringExpenses[0].id;
    act(() => { result.current.toggleRecurringActive(ruleId); });
    act(() => { outcome = result.current.setCategoryActive('leisure', false); });
    expect(outcome).toEqual({ ok: true });
    expect(result.current.recurringExpenses[0].active).toBe(false);
  });

  it('refuses new transactions, budgets, and recurring rules in an inactive category', () => {
    const { result } = renderWithInactiveLeisure();
    const before = localStorage.getItem(TX_KEY);
    let add: ReturnType<typeof result.current.addTransaction> | undefined;
    let budget: ReturnType<typeof result.current.addBudget> | undefined;
    let rule: ReturnType<typeof result.current.addRecurring> | undefined;
    act(() => {
      add = result.current.addTransaction({ ...leisureExpense, amount: 1 });
      budget = result.current.addBudget({ categoryId: 'leisure', limit: 500, month: '2026-11' });
      rule = result.current.addRecurring({ description: 'Gym', amount: 900, categoryId: 'leisure', dayOfMonth: 5, active: true, startMonth: '2026-11' });
    });
    for (const outcome of [add, budget, rule]) expect(outcome).toEqual({ ok: false, message: INACTIVE_CATEGORY_MESSAGE });
    expect(localStorage.getItem(TX_KEY)).toBe(before);
    expect(result.current.budgets).toHaveLength(0);
    expect(result.current.recurringExpenses).toHaveLength(0);
  });

  it('lets an edited transaction keep its inactive category but not switch to one', () => {
    const { result } = renderWithInactiveLeisure();
    const id = result.current.transactions[0].id;
    let keep: ReturnType<typeof result.current.updateTransaction> | undefined;
    act(() => { keep = result.current.updateTransaction(id, { ...leisureExpense, amount: 350 }); });
    expect(keep).toEqual({ ok: true });

    act(() => { result.current.addTransaction({ ...leisureExpense, categoryId: 'groceries' }); });
    const groceriesId = result.current.transactions.find(t => t.categoryId === 'groceries')?.id ?? '';
    let move: ReturnType<typeof result.current.updateTransaction> | undefined;
    act(() => { move = result.current.updateTransaction(groceriesId, leisureExpense); });
    expect(move).toEqual({ ok: false, message: INACTIVE_CATEGORY_MESSAGE });
  });

  it('keeps the status when a category is renamed', () => {
    const { result } = renderWithInactiveLeisure();
    act(() => { result.current.updateCategory('leisure', { name: 'Fun', icon: 'Smile', color: '#F59E0B', type: 'expense' }); });
    expect(result.current.categories.find(c => c.id === 'leisure')).toMatchObject({ name: 'Fun', active: false });
  });

  it('keeps active category names unique, ignoring case', () => {
    const { result } = renderWithInactiveLeisure();
    let outcome: ReturnType<typeof result.current.addCategory> | undefined;
    act(() => { outcome = result.current.addCategory({ name: ' groceries ', icon: 'X', color: '#000000', type: 'expense' }); });
    expect(outcome).toMatchObject({ ok: false });

    // The inactive "Leisure" does not block a new active "Leisure"...
    act(() => { outcome = result.current.addCategory({ name: 'Leisure', icon: 'X', color: '#000000', type: 'expense' }); });
    expect(outcome).toMatchObject({ ok: true });
    // ...but the old one then cannot be reactivated under the same name.
    let reactivate: ReturnType<typeof result.current.setCategoryActive> | undefined;
    act(() => { reactivate = result.current.setCategoryActive('leisure', true); });
    expect(reactivate).toMatchObject({ ok: false });
    expect(result.current.categories.find(c => c.id === 'leisure')?.active).toBe(false);

    let rename: ReturnType<typeof result.current.updateCategory> | undefined;
    act(() => { rename = result.current.updateCategory('dining', { name: 'GROCERIES', icon: 'X', color: '#000000', type: 'expense' }); });
    expect(rename).toMatchObject({ ok: false });
  });

  it('reactivates a built-in category that was stored as inactive', () => {
    localStorage.setItem(CAT_KEY, JSON.stringify([{ id: 'other', name: 'Other', icon: 'Receipt', color: '#94A3B8', type: 'expense', active: false }]));
    const { result } = renderHook(() => useFinance(), { wrapper });
    expect(result.current.categories.find(c => c.id === 'other')?.active).toBe(true);
  });
});
