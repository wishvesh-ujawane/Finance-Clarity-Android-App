import { addMonths, currentMonth, localDateStr } from '@/lib/domain/periods';
import {
  consumptionBetween,
  consumptionByCategory,
  totalConsumption,
  totalIncome,
  type MetricTransaction,
} from '@/lib/domain/finance-metrics';
import { formatMonthShort } from '@/lib/format';

export const shiftMonth = addMonths;

export function getLastNMonths(endMonth: string, count: number): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(shiftMonth(endMonth, -i));
  }
  return months;
}

export const monthLabel = formatMonthShort;

export function getBudgetPill(pct: number) {
  if (pct > 100) {
    return { label: 'Over budget', className: 'bg-red-500/15 text-red-600 dark:text-red-400' };
  }
  if (pct >= 80) {
    return { label: 'Watch', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' };
  }
  return { label: 'On track', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
}

/** Income, or consumption spending for `'expense'` (PRD §6). */
export function getMonthTotal(transactions: readonly MetricTransaction[], month: string, type: 'expense' | 'income') {
  return type === 'income' ? totalIncome(transactions, month) : totalConsumption(transactions, month);
}

export const getExpenseMapForMonth = consumptionByCategory;

export const getMonthKey = currentMonth;

export function startOfWeekMonday(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() + diff);
  return start;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Consumption dated from `start` to `end`, both inclusive local days. */
export function getDateRangeExpenseTotal(transactions: readonly MetricTransaction[], start: Date, end: Date) {
  return consumptionBetween(transactions, localDateStr(start), localDateStr(end));
}
