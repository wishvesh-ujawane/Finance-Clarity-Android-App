/**
 * Entity validators (DATABASE §6.1): one type guard per entity, shared by
 * storage reads and backup restore.
 */
import type {
  Budget,
  Category,
  MonthReconciliation,
  RecurringExpense,
  SavingsGoal,
  Transaction,
} from '@/lib/types';

type SavingsGoalEntry = SavingsGoal['goal'];

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const VALID_PAYMENT_METHODS = new Set(['cash', 'bank', 'credit-card', 'credit-card-payment']);
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidTransaction(value: unknown): value is Transaction {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    (value.type === 'income' || value.type === 'expense') &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    typeof value.categoryId === 'string' &&
    value.categoryId.length > 0 &&
    (value.note === undefined || typeof value.note === 'string') &&
    typeof value.date === 'string' &&
    value.date.length > 0 &&
    (value.paymentMethod === undefined ||
      (typeof value.paymentMethod === 'string' && VALID_PAYMENT_METHODS.has(value.paymentMethod))) &&
    ((value.recurringRuleId === undefined && value.recurringMonth === undefined) ||
      (value.type === 'expense' && typeof value.recurringRuleId === 'string' && value.recurringRuleId.length > 0 &&
        typeof value.recurringMonth === 'string' && MONTH_PATTERN.test(value.recurringMonth))) &&
    (value.sourceSmsFingerprint === undefined || typeof value.sourceSmsFingerprint === 'string') &&
    (value.merchant === undefined || typeof value.merchant === 'string')
  );
}

export function isValidCategory(value: unknown): value is Category {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.icon === 'string' &&
    typeof value.color === 'string' &&
    (value.type === 'income' || value.type === 'expense' || value.type === 'commitment' || value.type === 'savings' || value.type === 'both')
  );
}

export function isValidBudget(value: unknown): value is Budget {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.categoryId === 'string' &&
    value.categoryId.length > 0 &&
    typeof value.limit === 'number' &&
    Number.isFinite(value.limit) &&
    (value.month === undefined || typeof value.month === 'string')
  );
}

export function isValidRecurring(value: unknown): value is RecurringExpense {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.description === 'string' &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    typeof value.categoryId === 'string' &&
    value.categoryId.length > 0 &&
    typeof value.dayOfMonth === 'number' &&
    value.dayOfMonth >= 1 &&
    value.dayOfMonth <= 31 &&
    typeof value.active === 'boolean' &&
    typeof value.startMonth === 'string' &&
    (value.lastGeneratedMonth === undefined || typeof value.lastGeneratedMonth === 'string')
  );
}

export function isValidReconciliation(value: unknown): value is MonthReconciliation {
  return (
    isObject(value) &&
    typeof value.month === 'string' &&
    /^\d{4}-\d{2}$/.test(value.month) &&
    typeof value.actualBalance === 'number' &&
    Number.isFinite(value.actualBalance) &&
    typeof value.expectedBalance === 'number' &&
    Number.isFinite(value.expectedBalance) &&
    (value.adjustmentTxnId === undefined || typeof value.adjustmentTxnId === 'string') &&
    typeof value.reconciledAt === 'number' &&
    Number.isFinite(value.reconciledAt)
  );
}

export function isValidSavingsGoalEntry(value: unknown): value is SavingsGoalEntry {
  return (
    isObject(value) &&
    typeof value.monthly === 'number' &&
    Number.isFinite(value.monthly) &&
    typeof value.annual === 'number' &&
    Number.isFinite(value.annual) &&
    (value.createdAt === undefined || typeof value.createdAt === 'string')
  );
}

export function isValidSavingsGoal(value: unknown): value is SavingsGoal {
  return isObject(value) && isValidSavingsGoalEntry(value.goal) && isValidSavingsGoalEntry(value.emergency);
}
