import { addMonths } from './finance-utils';
import type { RecurringExpense } from './types';

export function getRecurringOccurrenceDate(month: string, dayOfMonth: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const day = Math.min(dayOfMonth, new Date(year, monthNumber, 0).getDate());
  return `${month}-${String(day).padStart(2, '0')}`;
}

/** Returns the last due month before resume day that still needs resolution. */
export function getLastDueMonthBeforeDate(rule: RecurringExpense, date: string): string | undefined {
  const cursor = rule.lastGeneratedMonth && rule.lastGeneratedMonth >= rule.startMonth
    ? rule.lastGeneratedMonth
    : undefined;
  let month = cursor ? addMonths(cursor, 1) : rule.startMonth;
  let lastResolved = cursor;

  while (month <= date.slice(0, 7)) {
    if (getRecurringOccurrenceDate(month, rule.dayOfMonth) >= date) break;
    lastResolved = month;
    month = addMonths(month, 1);
  }

  return lastResolved;
}