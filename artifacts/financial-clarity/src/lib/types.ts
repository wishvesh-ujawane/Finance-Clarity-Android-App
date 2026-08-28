/**
 * Payment method for a transaction. Enables the SMS auto-import feature to
 * distinguish credit-card purchases (consumption) from credit-card bill
 * payments (transfers, must be excluded from spend totals to avoid
 * double-counting). Legacy rows without a value are treated as consumption.
 */
export type PaymentMethod = 'cash' | 'bank' | 'credit-card' | 'credit-card-payment';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  note: string;
  date: string;
  /** Payment method for auto-import bookkeeping. Optional for backward compat. */
  paymentMethod?: PaymentMethod;
  /** Fingerprint of the SMS this transaction was imported from. Set only by the SMS-import flow. */
  sourceSmsFingerprint?: string;
  /** Merchant / payee inferred from an imported SMS (Swiggy, Uber, etc.). Optional. */
  merchant?: string;
}

/** Valid values for `Transaction.paymentMethod`, exported for runtime validators. */
export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash', 'bank', 'credit-card', 'credit-card-payment',
] as const;

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
  goal: { monthly: number; annual: number; createdAt?: string };
  emergency: { monthly: number; annual: number; createdAt?: string };
}

export type GoalEntry = SavingsGoal['goal'];
