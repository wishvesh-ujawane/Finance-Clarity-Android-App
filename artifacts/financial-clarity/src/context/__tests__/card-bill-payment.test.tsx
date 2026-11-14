import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { FinanceProvider, useFinance } from '../FinanceContext';

function wrapper({ children }: { children: ReactNode }) {
  return <FinanceProvider>{children}</FinanceProvider>;
}

const TX_KEY = 'financial-clarity:transactions';
const JULY = '2026-07';

function renderWithCardPurchases() {
  const hook = renderHook(() => useFinance(), { wrapper });
  act(() => {
    hook.result.current.addTransaction({ type: 'income', amount: 50000, categoryId: 'salary', note: 'synthetic', date: '2026-07-01' });
    hook.result.current.addTransaction({ type: 'expense', amount: 8000, categoryId: 'groceries', note: 'synthetic', date: '2026-07-10', paymentMethod: 'credit-card' });
    hook.result.current.addTransaction({ type: 'expense', amount: 2000, categoryId: 'dining', note: 'synthetic', date: '2026-07-12', paymentMethod: 'bank' });
  });
  return hook;
}

describe('month-end card bill payment (owner decision D8)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('records a bill payment on the last day of the month without counting it as spending', () => {
    const { result } = renderWithCardPurchases();
    expect(result.current.getOutstandingCardBalanceAtEndOf(JULY)).toBe(8000);
    expect(result.current.getExpectedBankBalanceAtEndOf(JULY)).toBe(50000 - 10000 + 8000);
    const spendingBefore = result.current.getTotalExpenses(JULY);

    let outcome: ReturnType<typeof result.current.recordCardBillPayment> | undefined;
    act(() => { outcome = result.current.recordCardBillPayment(JULY, 5000); });

    expect(outcome).toEqual({ ok: true });
    const payment = result.current.transactions.find(t => t.paymentMethod === 'credit-card-payment');
    expect(payment).toMatchObject({ type: 'expense', amount: 5000, categoryId: 'other', date: '2026-07-31', note: 'Card bill payment' });
    expect(result.current.getTotalExpenses(JULY)).toBe(spendingBefore);
    expect(result.current.getCumulativeNetBalanceThroughEndOf(JULY)).toBe(40000);
    expect(result.current.getOutstandingCardBalanceAtEndOf(JULY)).toBe(3000);
    expect(result.current.getCardBillPaymentsIn(JULY)).toBe(5000);
    expect(result.current.getExpectedBankBalanceAtEndOf(JULY)).toBe(43000);
  });

  it('refuses zero, invalid, and more than the unpaid amount without saving', () => {
    const { result } = renderWithCardPurchases();
    const before = localStorage.getItem(TX_KEY);
    for (const amount of [0, -5, Number.NaN, 8000.5]) {
      let outcome: ReturnType<typeof result.current.recordCardBillPayment> | undefined;
      act(() => { outcome = result.current.recordCardBillPayment(JULY, amount); });
      expect(outcome).toMatchObject({ ok: false });
    }
    expect(localStorage.getItem(TX_KEY)).toBe(before);
    expect(result.current.getOutstandingCardBalanceAtEndOf(JULY)).toBe(8000);
  });

  it('only counts card purchases made by the end of the reviewed month', () => {
    const { result } = renderWithCardPurchases();
    act(() => {
      result.current.addTransaction({ type: 'expense', amount: 4000, categoryId: 'groceries', note: 'synthetic', date: '2026-08-02', paymentMethod: 'credit-card' });
    });
    let outcome: ReturnType<typeof result.current.recordCardBillPayment> | undefined;
    act(() => { outcome = result.current.recordCardBillPayment(JULY, 9000); });
    expect(outcome).toMatchObject({ ok: false });
    act(() => { outcome = result.current.recordCardBillPayment(JULY, 8000); });
    expect(outcome).toEqual({ ok: true });
    expect(result.current.getOutstandingCardBalanceAtEndOf(JULY)).toBe(0);
    expect(result.current.getOutstandingCardBalance()).toBe(4000);
  });

  it('leaves state unchanged when the save fails', () => {
    const { result } = renderWithCardPurchases();
    const count = result.current.transactions.length;
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === TX_KEY) throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    });
    let outcome: ReturnType<typeof result.current.recordCardBillPayment> | undefined;
    act(() => { outcome = result.current.recordCardBillPayment(JULY, 1000); });
    expect(outcome).toMatchObject({ ok: false });
    expect(result.current.transactions).toHaveLength(count);
    expect(result.current.getOutstandingCardBalanceAtEndOf(JULY)).toBe(8000);
  });
});

describe('card bill payment from the Dashboard card sheet', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('records a payment on the chosen date without counting it as spending', () => {
    const { result } = renderWithCardPurchases();
    const spendingBefore = result.current.getTotalExpenses(JULY);
    let outcome: ReturnType<typeof result.current.recordCardBillPaymentOn> | undefined;
    act(() => { outcome = result.current.recordCardBillPaymentOn('2026-07-20', 3000); });

    expect(outcome).toEqual({ ok: true });
    const payment = result.current.transactions.find(t => t.paymentMethod === 'credit-card-payment');
    expect(payment).toMatchObject({ type: 'expense', amount: 3000, categoryId: 'other', date: '2026-07-20', note: 'Card bill payment' });
    expect(result.current.getTotalExpenses(JULY)).toBe(spendingBefore);
    expect(result.current.getOutstandingCardBalance()).toBe(5000);
    expect(result.current.getExpectedBankBalanceAtEndOf(JULY)).toBe(50000 - 10000 + 5000);
  });

  it('refuses a future, invalid, or too-early date and more than was unpaid on that date', () => {
    const { result } = renderWithCardPurchases();
    const before = localStorage.getItem(TX_KEY);
    const cases: Array<[string, number]> = [
      ['2999-01-01', 1000],
      ['2026-02-30', 1000],
      ['not-a-date', 1000],
      ['2026-07-05', 1000],
      ['2026-07-20', 8000.5],
      ['2026-07-20', 0],
    ];
    for (const [date, amount] of cases) {
      let outcome: ReturnType<typeof result.current.recordCardBillPaymentOn> | undefined;
      act(() => { outcome = result.current.recordCardBillPaymentOn(date, amount); });
      expect(outcome).toMatchObject({ ok: false });
    }
    expect(localStorage.getItem(TX_KEY)).toBe(before);
    expect(result.current.getOutstandingCardBalance()).toBe(8000);
  });

  it('month-end review cannot record a bill again after it was paid later from the Dashboard', () => {
    const { result } = renderWithCardPurchases();
    act(() => { result.current.recordCardBillPaymentOn('2026-08-03', 8000); });

    // July still ends with the card unpaid: the money left the bank in August.
    expect(result.current.getOutstandingCardBalanceAtEndOf(JULY)).toBe(8000);
    expect(result.current.getExpectedBankBalanceAtEndOf(JULY)).toBe(50000 - 10000 + 8000);
    expect(result.current.getCardBillPaymentsAfter('2026-07-31')).toBe(8000);
    expect(result.current.getCardBillPaymentLimit('2026-07-31')).toBe(0);

    let outcome: ReturnType<typeof result.current.recordCardBillPayment> | undefined;
    act(() => { outcome = result.current.recordCardBillPayment(JULY, 1000); });
    expect(outcome).toMatchObject({ ok: false });
    expect(result.current.getCardBillPaymentsIn(JULY)).toBe(0);
    expect(result.current.getOutstandingCardBalance()).toBe(0);
  });
});
