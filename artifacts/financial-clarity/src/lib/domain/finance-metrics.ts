/**
 * The approved financial baseline (PRD §6). Every screen-level total comes
 * from these functions; pages and contexts must not re-sum transactions.
 * Pure: no React, no storage. Money stays a positive rupee number whose
 * direction comes from the transaction type (DATABASE §2).
 */
import { SAVINGS_CATEGORY_IDS, type Category, type Transaction } from '@/lib/types';
import { isBeforeMonth, isInMonth, monthOf } from './periods';

export type MetricTransaction = Pick<Transaction, 'type' | 'amount' | 'categoryId' | 'date'> & {
  paymentMethod?: string;
};

type Classifiable = Pick<MetricTransaction, 'type' | 'categoryId' | 'paymentMethod'>;

/** Limits a month total to entries dated on or before `through` (`YYYY-MM-DD`, inclusive). */
export interface MonthScope {
  through?: string;
}

const SAVINGS_CATEGORY_ID_SET: ReadonlySet<string> = new Set(SAVINGS_CATEGORY_IDS);

export function isSavingsCategory(categoryId: string): boolean {
  return SAVINGS_CATEGORY_ID_SET.has(categoryId);
}

export function isIncome(tx: Pick<MetricTransaction, 'type'>): boolean {
  return tx.type === 'income';
}

/**
 * Consumption spending: an expense that is neither a savings contribution nor
 * a credit-card bill payment. The bill payment is a transfer; the card
 * purchases it pays for were already counted, so counting it would double
 * count. Legacy rows without `paymentMethod` count as consumption.
 */
export function isConsumptionExpense(tx: Classifiable): boolean {
  if (tx.type !== 'expense') return false;
  if (tx.paymentMethod === 'credit-card-payment') return false;
  return !isSavingsCategory(tx.categoryId);
}

/** Savings contribution: an expense entry in a reserved savings category. */
export function isSavingsContribution(tx: Classifiable): boolean {
  return tx.type === 'expense' && isSavingsCategory(tx.categoryId);
}

export function commitmentCategoryIds(categories: ReadonlyArray<Pick<Category, 'id' | 'type'>>): Set<string> {
  return new Set(categories.filter(c => c.type === 'commitment').map(c => c.id));
}

function sumWhere<T extends MetricTransaction>(transactions: readonly T[], include: (tx: T) => boolean): number {
  let total = 0;
  for (const tx of transactions) if (include(tx)) total += tx.amount;
  return total;
}

/** Income in an already-filtered list (for example the Transactions search results). */
export function sumIncome(transactions: readonly MetricTransaction[]): number {
  return sumWhere(transactions, isIncome);
}

/** Consumption spending in an already-filtered list. */
export function sumConsumption(transactions: readonly MetricTransaction[]): number {
  return sumWhere(transactions, isConsumptionExpense);
}

function inMonthScope(tx: MetricTransaction, month: string, scope?: MonthScope): boolean {
  return isInMonth(tx.date, month) && (scope?.through === undefined || tx.date <= scope.through);
}

export function totalIncome(transactions: readonly MetricTransaction[], month: string, scope?: MonthScope): number {
  return sumWhere(transactions, tx => isIncome(tx) && inMonthScope(tx, month, scope));
}

export function totalConsumption(transactions: readonly MetricTransaction[], month: string, scope?: MonthScope): number {
  return sumWhere(transactions, tx => isConsumptionExpense(tx) && inMonthScope(tx, month, scope));
}

export function totalSavingsContributions(
  transactions: readonly MetricTransaction[],
  month: string,
  scope?: MonthScope,
): number {
  return sumWhere(transactions, tx => isSavingsContribution(tx) && inMonthScope(tx, month, scope));
}

/** Commitments: consumption in commitment-type categories. */
export function totalCommitments(
  transactions: readonly MetricTransaction[],
  categories: ReadonlyArray<Pick<Category, 'id' | 'type'>>,
  month: string,
  scope?: MonthScope,
): number {
  const ids = commitmentCategoryIds(categories);
  return sumWhere(transactions, tx => isConsumptionExpense(tx) && ids.has(tx.categoryId) && inMonthScope(tx, month, scope));
}

/** Day-to-day: consumption outside commitment categories. */
export function totalDayToDay(
  transactions: readonly MetricTransaction[],
  categories: ReadonlyArray<Pick<Category, 'id' | 'type'>>,
  month: string,
  scope?: MonthScope,
): number {
  return totalConsumption(transactions, month, scope) - totalCommitments(transactions, categories, month, scope);
}

/** Monthly net: income minus consumption minus savings contributions. */
export function monthlyNet(transactions: readonly MetricTransaction[], month: string): number {
  return (
    totalIncome(transactions, month) -
    totalConsumption(transactions, month) -
    totalSavingsContributions(transactions, month)
  );
}

/** Income minus consumption over the included entries. Savings stay in the balance (PRD §6). */
function cumulativeBalance(transactions: readonly MetricTransaction[], include: (tx: MetricTransaction) => boolean): number {
  let balance = 0;
  for (const tx of transactions) {
    if (!include(tx)) continue;
    if (isIncome(tx)) balance += tx.amount;
    else if (isConsumptionExpense(tx)) balance -= tx.amount;
  }
  return balance;
}

/** Carry-forward: cumulative income minus consumption before `month`. */
export function carryForward(transactions: readonly MetricTransaction[], month: string): number {
  return cumulativeBalance(transactions, tx => isBeforeMonth(tx.date, month));
}

/** Lifetime balance: cumulative income minus consumption through `today` (future-dated entries excluded). */
export function lifetimeBalance(transactions: readonly MetricTransaction[], today: string): number {
  return cumulativeBalance(transactions, tx => tx.date <= today);
}

/** Cumulative income minus consumption through the last day of `month` (month-end review). */
export function balanceThroughEndOf(transactions: readonly MetricTransaction[], month: string): number {
  return cumulativeBalance(transactions, tx => monthOf(tx.date) <= month);
}

/** Outstanding card amount: all card purchases minus all bill payments, floored at zero. */
export function outstandingCardAmount(transactions: readonly MetricTransaction[]): number {
  let purchases = 0;
  let payments = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (tx.paymentMethod === 'credit-card') purchases += tx.amount;
    else if (tx.paymentMethod === 'credit-card-payment') payments += tx.amount;
  }
  return Math.max(0, purchases - payments);
}

/**
 * Amount counted against a category's budget in `month`: savings
 * contributions for a savings category, consumption for any other.
 */
export function categorySpent(
  transactions: readonly MetricTransaction[],
  categoryId: string,
  month: string,
  scope?: MonthScope,
): number {
  const counts = isSavingsCategory(categoryId) ? isSavingsContribution : isConsumptionExpense;
  return sumWhere(transactions, tx => tx.categoryId === categoryId && counts(tx) && inMonthScope(tx, month, scope));
}

/** Consumption per category in `month`. */
export function consumptionByCategory(transactions: readonly MetricTransaction[], month: string): Record<string, number> {
  return groupConsumption(transactions, tx => isInMonth(tx.date, month));
}

/** Consumption per category dated from `startDate` to `endDate` inclusive (`YYYY-MM-DD`). */
export function consumptionByCategoryBetween(
  transactions: readonly MetricTransaction[],
  startDate: string,
  endDate: string,
): Record<string, number> {
  return groupConsumption(transactions, tx => tx.date >= startDate && tx.date <= endDate);
}

function groupConsumption(
  transactions: readonly MetricTransaction[],
  include: (tx: MetricTransaction) => boolean,
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const tx of transactions) {
    if (!isConsumptionExpense(tx) || !include(tx)) continue;
    totals[tx.categoryId] = (totals[tx.categoryId] ?? 0) + tx.amount;
  }
  return totals;
}

/** Consumption dated from `startDate` to `endDate` inclusive (`YYYY-MM-DD`). */
export function consumptionBetween(transactions: readonly MetricTransaction[], startDate: string, endDate: string): number {
  return sumWhere(transactions, tx => isConsumptionExpense(tx) && tx.date >= startDate && tx.date <= endDate);
}

/**
 * Per-month summary for screen-level totals.
 * - totalExpenses is consumption spending.
 * - totalSavings is savings contributions.
 * - netFlow is the monthly net.
 * - savingsRate is totalSavings / totalIncome * 100, or 0 when income is 0.
 */
export interface MonthSummary {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  netFlow: number;
  savingsRate: number;
  transactionCount: number;
  hasData: boolean;
}

export function monthSummary(transactions: readonly MetricTransaction[], month: string): MonthSummary {
  const income = totalIncome(transactions, month);
  const expenses = totalConsumption(transactions, month);
  const savings = totalSavingsContributions(transactions, month);
  const transactionCount = transactions.filter(tx => isInMonth(tx.date, month)).length;
  return {
    totalIncome: income,
    totalExpenses: expenses,
    totalSavings: savings,
    netFlow: income - expenses - savings,
    savingsRate: income > 0 ? (savings / income) * 100 : 0,
    transactionCount,
    hasData: transactionCount > 0,
  };
}
