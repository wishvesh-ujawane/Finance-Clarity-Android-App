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

/**
 * System categories reserved for the Month-End Review reconciliation step.
 * Hidden from every user-facing category picker (budgets, transaction sheet,
 * analysis chip rows) but still participate in totals so that reconciliation
 * adjustments show up in month balances.
 *
 * - `_adjustment-missed-spend` (expense) — created when the user's actual
 *   bank balance is LOWER than the app's expected balance (they forgot to
 *   log something).
 * - `_adjustment-overlogged` (income) — created when the user's actual
 *   balance is HIGHER than the app's expected balance (an entry was
 *   logged twice or over-counted).
 */
export const SYSTEM_ADJUSTMENT_CATEGORY_IDS = [
  '_adjustment-missed-spend',
  '_adjustment-overlogged',
] as const;
export type SystemAdjustmentCategoryId = typeof SYSTEM_ADJUSTMENT_CATEGORY_IDS[number];

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

/**
 * Reconciliation record created by the Month-End Review flow. Captures
 * the user's actual bank balance at the end of a month and (optionally)
 * the adjustment transaction that was logged to close the gap vs the
 * app's expected balance.
 */
export interface MonthReconciliation {
  /** 'YYYY-MM' — the month this record reconciles. */
  month: string;
  /** User-entered actual bank balance at the end of `month`. */
  actualBalance: number;
  /** App-computed expected balance via `getCumulativeNetBalanceThroughEndOf`. */
  expectedBalance: number;
  /** If the user chose to log the gap, this is the id of the adjustment txn. */
  adjustmentTxnId?: string;
  /** Epoch ms when the user confirmed the reconciliation. */
  reconciledAt: number;
}
