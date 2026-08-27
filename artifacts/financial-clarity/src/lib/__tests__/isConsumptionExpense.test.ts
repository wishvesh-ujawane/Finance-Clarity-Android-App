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
});
