import { SAVINGS_CATEGORY_IDS } from '@/lib/types';

type Txn = { id: string; type: 'income' | 'expense'; amount: number; date: string; categoryId: string };

export function shiftMonth(month: string, offset: number) {
  const [year, monthNum] = month.split('-').map(Number);
  const shifted = new Date(year, monthNum - 1 + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

export function getLastNMonths(endMonth: string, count: number): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(shiftMonth(endMonth, -i));
  }
  return months;
}

export function monthLabel(month: string) {
  const [year, monthNum] = month.split('-').map(Number);
  return new Date(year, monthNum - 1).toLocaleDateString('en-IN', { month: 'short' });
}

export function getBudgetPill(pct: number) {
  if (pct > 100) {
    return { label: 'Over budget', className: 'bg-red-500/15 text-red-600 dark:text-red-400' };
  }
  if (pct >= 80) {
    return { label: 'Watch', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' };
  }
  return { label: 'On track', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
}

export function getMonthTotal<T extends Txn>(transactions: T[], month: string, type: 'expense' | 'income') {
  return transactions
    .filter(t => t.type === type && t.date.startsWith(month))
    .filter(t => !(type === 'expense' && SAVINGS_CATEGORY_IDS.includes(t.categoryId as typeof SAVINGS_CATEGORY_IDS[number])))
    .reduce((sum, t) => sum + t.amount, 0);
}

export function getMonthSavingsTotal<T extends Txn>(transactions: T[], month: string) {
  return transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(month) && SAVINGS_CATEGORY_IDS.includes(t.categoryId as typeof SAVINGS_CATEGORY_IDS[number]))
    .reduce((sum, t) => sum + t.amount, 0);
}

export function getExpenseMapForMonth<T extends Txn>(transactions: T[], month: string) {
  const map: Record<string, number> = {};
  transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(month))
    .filter(t => !SAVINGS_CATEGORY_IDS.includes(t.categoryId as typeof SAVINGS_CATEGORY_IDS[number]))
    .forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
  return map;
}

export function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function parseLocalDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`);
}

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

export function getDateRangeExpenseTotal<T extends Txn>(transactions: T[], start: Date, end: Date) {
  const startAt = start.getTime();
  const endAt = end.getTime();
  return transactions
    .filter(t => t.type === 'expense' && !SAVINGS_CATEGORY_IDS.includes(t.categoryId as typeof SAVINGS_CATEGORY_IDS[number]))
    .filter(t => {
      const time = parseLocalDate(t.date).getTime();
      return time >= startAt && time <= endAt;
    })
    .reduce((sum, t) => sum + t.amount, 0);
}
