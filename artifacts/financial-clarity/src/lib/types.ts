/** Payment method metadata; legacy rows without a value are treated as consumption. */
export type PaymentMethod = 'cash' | 'bank' | 'credit-card' | 'credit-card-payment';

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  note: string;
  date: string;
  /** Optional payment method metadata retained by backup and restore. */
  paymentMethod?: PaymentMethod;
  /** Rule that generated this recurring expense, when applicable. */
  recurringRuleId?: string;
  /** Month represented by this recurring occurrence (`YYYY-MM`). */
  recurringMonth?: string;
  /** Legacy provenance field retained for transaction and backup compatibility. */
  sourceSmsFingerprint?: string;
  /** Optional merchant / payee retained with legacy transactions. */
  merchant?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'commitment' | 'savings' | 'both';
}

export const SAVINGS_CATEGORY_IDS = ['savings-goal', 'savings-emergency'] as const;

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
