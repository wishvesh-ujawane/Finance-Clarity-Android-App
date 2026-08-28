import { describe, it, expect } from 'vitest';
import { isConsumptionExpense } from '../finance-utils';

describe('isConsumptionExpense', () => {
  it('returns true for regular expense transactions', () => {
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'groceries' })).toBe(true);
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'rent' })).toBe(true);
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'transport' })).toBe(true);
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'dining' })).toBe(true);
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'leisure' })).toBe(true);
  });

  it('returns false for income transactions', () => {
    expect(isConsumptionExpense({ type: 'income', categoryId: 'salary' })).toBe(false);
    expect(isConsumptionExpense({ type: 'income', categoryId: 'freelance' })).toBe(false);
    expect(isConsumptionExpense({ type: 'income', categoryId: 'investment' })).toBe(false);
  });

  it('returns false for savings-category expenses (savings-goal)', () => {
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'savings-goal' })).toBe(false);
  });

  it('returns false for savings-category expenses (savings-emergency)', () => {
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'savings-emergency' })).toBe(false);
  });

  it('handles arbitrary category IDs correctly', () => {
    // Regular expense with custom category
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'custom-category' })).toBe(true);
    // Income with custom category
    expect(isConsumptionExpense({ type: 'income', categoryId: 'custom-income' })).toBe(false);
  });

  it('treats legacy expenses (paymentMethod === undefined) as consumption', () => {
    // Load-bearing invariant: pre-SMS-import data must be counted as spend.
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'dining' })).toBe(true);
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'dining', paymentMethod: undefined })).toBe(true);
  });

  it('counts normal payment methods as consumption', () => {
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'dining', paymentMethod: 'cash' })).toBe(true);
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'dining', paymentMethod: 'bank' })).toBe(true);
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'dining', paymentMethod: 'credit-card' })).toBe(true);
  });

  it('EXCLUDES credit-card-payment transactions (transfer, not consumption)', () => {
    // The load-bearing money-math check. A card bill payment moves money from
    // bank -> card; the underlying purchases are recorded separately, so
    // counting the payment would double-count spend.
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'dining', paymentMethod: 'credit-card-payment' })).toBe(false);
    // Even with a non-savings category, card-payment is still excluded.
    expect(isConsumptionExpense({ type: 'expense', categoryId: 'groceries', paymentMethod: 'credit-card-payment' })).toBe(false);
  });
});
