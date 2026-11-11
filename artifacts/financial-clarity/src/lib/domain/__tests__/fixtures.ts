import type { Budget, Category, Transaction } from '@/lib/types';

/**
 * Synthetic dataset shared by the metric and cross-screen tests.
 * "Today" is 2026-11-15. Expected values are worked out by hand in the tests.
 */
export const NOV = '2026-11';
export const FIXTURE_TODAY = '2026-11-15';

export const FIXTURE_CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10B981', type: 'expense' },
  { id: 'rent', name: 'Rent', icon: 'Home', color: '#6366F1', type: 'commitment' },
  { id: 'salary', name: 'Salary', icon: 'Briefcase', color: '#10B981', type: 'income' },
  { id: 'savings-goal', name: 'Goal Savings', icon: 'PiggyBank', color: '#0EA5E9', type: 'savings' },
  { id: 'savings-emergency', name: 'Emergency Fund', icon: 'ShieldCheck', color: '#14B8A6', type: 'savings' },
];

export const FIXTURE_TRANSACTIONS: Transaction[] = [
  // October 2026
  { id: 'oct-salary', type: 'income', amount: 50000, categoryId: 'salary', note: '', date: '2026-10-01' },
  { id: 'oct-rent', type: 'expense', amount: 15000, categoryId: 'rent', note: '', date: '2026-10-05' },
  { id: 'oct-card-buy', type: 'expense', amount: 2000, categoryId: 'groceries', note: '', date: '2026-10-10', paymentMethod: 'credit-card' },
  { id: 'oct-save', type: 'expense', amount: 5000, categoryId: 'savings-goal', note: '', date: '2026-10-20' },
  { id: 'oct-card-bill', type: 'expense', amount: 1500, categoryId: 'groceries', note: '', date: '2026-10-25', paymentMethod: 'credit-card-payment' },
  // November 2026 (rent has no payment method: a legacy row that still counts as consumption)
  { id: 'nov-salary', type: 'income', amount: 60000, categoryId: 'salary', note: '', date: '2026-11-01' },
  { id: 'nov-cash', type: 'expense', amount: 3000, categoryId: 'groceries', note: '', date: '2026-11-03', paymentMethod: 'cash' },
  { id: 'nov-rent', type: 'expense', amount: 15000, categoryId: 'rent', note: '', date: '2026-11-05' },
  { id: 'nov-save', type: 'expense', amount: 4000, categoryId: 'savings-emergency', note: '', date: '2026-11-10' },
  { id: 'nov-card-buy', type: 'expense', amount: 1000, categoryId: 'groceries', note: '', date: '2026-11-15', paymentMethod: 'credit-card' },
  { id: 'nov-card-bill', type: 'expense', amount: 1000, categoryId: 'groceries', note: '', date: '2026-11-15', paymentMethod: 'credit-card-payment' },
  { id: 'nov-future', type: 'expense', amount: 500, categoryId: 'groceries', note: '', date: '2026-11-28', paymentMethod: 'bank' },
  // December 2026 (future month)
  { id: 'dec-salary', type: 'income', amount: 1000, categoryId: 'salary', note: '', date: '2026-12-01' },
];

export const FIXTURE_BUDGETS: Budget[] = [
  { id: 'b-groceries', categoryId: 'groceries', limit: 6000, month: NOV },
  { id: 'b-rent', categoryId: 'rent', limit: 15000, month: NOV },
  { id: 'b-emergency', categoryId: 'savings-emergency', limit: 5000, month: NOV },
];
