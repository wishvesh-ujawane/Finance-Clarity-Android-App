export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  note: string;
  date: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'commitment' | 'savings' | 'both';
}

export const SAVINGS_CATEGORY_IDS = ['savings-goal', 'savings-emergency'] as const;
export type SavingsCategoryId = typeof SAVINGS_CATEGORY_IDS[number];

export interface Budget {
  id: string;
  categoryId: string;
  limit: number;
  month?: string;
}

export interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  categoryId: string;
  dayOfMonth: number;
  active: boolean;
  startMonth: string;
  lastGeneratedMonth?: string;
}

export interface SavingsGoal {
  goal: { monthly: number; annual: number };
  emergency: { monthly: number; annual: number };
}

export type GoalEntry = SavingsGoal['goal'];
