import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { FinanceProvider, useFinance } from '@/context/FinanceContext';
import { TransactionSheet } from '@/components/TransactionSheet';
import { CardDuesSheet } from '@/components/card/CardDuesSheet';
import { localDateStr } from '@/lib/domain/periods';
import type { Transaction } from '@/lib/types';

const TX_KEY = 'financial-clarity:transactions';
const today = localDateStr(new Date());

function storedTransactions(): Transaction[] {
  return JSON.parse(localStorage.getItem(TX_KEY) ?? '[]') as Transaction[];
}

function SheetOpeners() {
  const { openSheet, openEditSheet, transactions } = useFinance();
  return (
    <>
      <button type="button" onClick={() => openSheet('expense')}>open-add</button>
      {transactions.map(t => (
        <button key={t.id} type="button" onClick={() => openEditSheet(t)}>{`edit-${t.id}`}</button>
      ))}
    </>
  );
}

function renderWithFinance(children: ReactNode) {
  return render(<FinanceProvider>{children}</FinanceProvider>);
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('Paid with credit card checkbox (transaction sheet)', () => {
  it('saves a ticked expense as a card purchase', () => {
    renderWithFinance(<><SheetOpeners /><TransactionSheet /></>);
    fireEvent.click(screen.getByText('open-add'));
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '1500' } });
    fireEvent.click(screen.getByTestId('category-groceries'));
    fireEvent.click(screen.getByTestId('paid-with-card-checkbox'));
    fireEvent.click(screen.getByTestId('submit-transaction'));

    const [saved] = storedTransactions();
    expect(saved).toMatchObject({ type: 'expense', amount: 1500, categoryId: 'groceries', paymentMethod: 'credit-card' });
  });

  it('saves an unticked expense without a payment method', () => {
    renderWithFinance(<><SheetOpeners /><TransactionSheet /></>);
    fireEvent.click(screen.getByText('open-add'));
    fireEvent.change(screen.getByTestId('amount-input'), { target: { value: '200' } });
    fireEvent.click(screen.getByTestId('category-groceries'));
    fireEvent.click(screen.getByTestId('submit-transaction'));

    expect(storedTransactions()[0].paymentMethod).toBeUndefined();
  });

  it('is only offered for expenses', () => {
    renderWithFinance(<><SheetOpeners /><TransactionSheet /></>);
    fireEvent.click(screen.getByText('open-add'));
    expect(screen.getByTestId('paid-with-card')).toBeTruthy();
    fireEvent.click(screen.getByTestId('type-income'));
    expect(screen.queryByTestId('paid-with-card')).toBeNull();
    fireEvent.click(screen.getByTestId('type-save'));
    expect(screen.queryByTestId('paid-with-card')).toBeNull();
  });

  it('unticking on edit restores an earlier cash value and removes the card purchase', () => {
    localStorage.setItem(TX_KEY, JSON.stringify([
      { id: 'cash-1', type: 'expense', amount: 400, categoryId: 'groceries', note: 'synthetic', date: today, paymentMethod: 'cash' },
      { id: 'card-1', type: 'expense', amount: 900, categoryId: 'groceries', note: 'synthetic', date: today, paymentMethod: 'credit-card' },
    ]));
    renderWithFinance(<><SheetOpeners /><TransactionSheet /></>);

    fireEvent.click(screen.getByText('edit-cash-1'));
    const box = screen.getByTestId('paid-with-card-checkbox') as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    fireEvent.click(box);
    fireEvent.click(screen.getByTestId('submit-transaction'));
    expect(storedTransactions().find(t => t.id === 'cash-1')?.paymentMethod).toBe('cash');

    fireEvent.click(screen.getByText('edit-card-1'));
    const cardBox = screen.getByTestId('paid-with-card-checkbox') as HTMLInputElement;
    expect(cardBox.checked).toBe(true);
    fireEvent.click(cardBox);
    fireEvent.click(screen.getByTestId('submit-transaction'));
    expect(storedTransactions().find(t => t.id === 'card-1')?.paymentMethod).toBeUndefined();
  });

  it('shows a bill payment as a payment instead of the checkbox', () => {
    localStorage.setItem(TX_KEY, JSON.stringify([
      { id: 'bill-1', type: 'expense', amount: 500, categoryId: 'other', note: 'Card bill payment', date: today, paymentMethod: 'credit-card-payment' },
    ]));
    renderWithFinance(<><SheetOpeners /><TransactionSheet /></>);
    fireEvent.click(screen.getByText('edit-bill-1'));
    expect(screen.queryByTestId('paid-with-card')).toBeNull();
    expect(screen.getByTestId('bill-payment-note')).toBeTruthy();
  });
});

describe('Card dues sheet (On your card)', () => {
  function seedCardPurchase(amount = 8000) {
    localStorage.setItem(TX_KEY, JSON.stringify([
      { id: 'card-buy', type: 'expense', amount, categoryId: 'groceries', note: 'synthetic', date: today, paymentMethod: 'credit-card' },
    ]));
  }

  it('shows an empty state when there are no card entries', () => {
    renderWithFinance(<CardDuesSheet open onOpenChange={() => undefined} />);
    expect(screen.getByTestId('card-dues-owed').textContent).toMatch(/0/);
    expect(screen.getByTestId('card-dues-clear')).toBeTruthy();
    expect(screen.getByTestId('card-dues-empty')).toBeTruthy();
  });

  it('lists card entries and records a bill payment that lowers the amount', () => {
    seedCardPurchase();
    renderWithFinance(<CardDuesSheet open onOpenChange={() => undefined} />);
    expect(screen.getByTestId('card-dues-owed').textContent).toMatch(/8,000/);
    expect(screen.getByTestId('card-entry-card-buy')).toBeTruthy();

    fireEvent.change(screen.getByTestId('card-dues-amount'), { target: { value: '3000' } });
    act(() => { fireEvent.click(screen.getByTestId('card-dues-record')); });

    expect(screen.getByTestId('card-dues-recorded').textContent).toMatch(/3,000/);
    expect(screen.getByTestId('card-dues-owed').textContent).toMatch(/5,000/);
    expect(storedTransactions().find(t => t.paymentMethod === 'credit-card-payment')).toMatchObject({ amount: 3000, date: today });
    expect((screen.getByTestId('card-dues-amount') as HTMLInputElement).value).toBe('');
  });

  it('refuses more than is on the card and keeps the entered value', () => {
    seedCardPurchase();
    renderWithFinance(<CardDuesSheet open onOpenChange={() => undefined} />);
    fireEvent.change(screen.getByTestId('card-dues-amount'), { target: { value: '9000' } });

    expect(screen.getByRole('alert').textContent).toMatch(/more than is on your card/);
    expect((screen.getByTestId('card-dues-record') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('card-dues-amount') as HTMLInputElement).value).toBe('9000');
    expect(storedTransactions()).toHaveLength(1);
  });

  it('refuses a future payment date', () => {
    seedCardPurchase();
    renderWithFinance(<CardDuesSheet open onOpenChange={() => undefined} />);
    fireEvent.change(screen.getByTestId('card-dues-amount'), { target: { value: '1000' } });
    fireEvent.change(screen.getByTestId('card-dues-date'), { target: { value: '2999-01-01' } });

    expect(screen.getByText('The payment date cannot be in the future.')).toBeTruthy();
    expect((screen.getByTestId('card-dues-record') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the save error and keeps the value when storage fails', () => {
    seedCardPurchase();
    renderWithFinance(<CardDuesSheet open onOpenChange={() => undefined} />);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === TX_KEY) throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    });
    fireEvent.change(screen.getByTestId('card-dues-amount'), { target: { value: '1000' } });
    act(() => { fireEvent.click(screen.getByTestId('card-dues-record')); });

    expect(screen.getByTestId('card-dues-save-error')).toBeTruthy();
    expect((screen.getByTestId('card-dues-amount') as HTMLInputElement).value).toBe('1000');
    expect(screen.getByTestId('card-dues-owed').textContent).toMatch(/8,000/);
    vi.restoreAllMocks();
  });
});
