/**
 * Recurring expense scheduling (PRD FR-07, D4; DATABASE §6.3; ADR 0004).
 * Pure: given rules, existing transactions, and today's date, it decides which
 * occurrences are due and where each rule's forward-only cursor moves.
 */
import type { RecurringExpense, Transaction } from '@/lib/types';
import { addMonths, lastDateOfMonth, monthOf } from './periods';

/** The rule's day in `month`, clamped to the month's last day (31 → 30, 28, or 29). */
export function getRecurringOccurrenceDate(month: string, dayOfMonth: number): string {
  const last = Number(lastDateOfMonth(month).slice(8));
  return `${month}-${String(Math.min(dayOfMonth, last)).padStart(2, '0')}`;
}

function cursorOf(rule: Pick<RecurringExpense, 'startMonth' | 'lastGeneratedMonth'>): string | undefined {
  return rule.lastGeneratedMonth && rule.lastGeneratedMonth >= rule.startMonth ? rule.lastGeneratedMonth : undefined;
}

/**
 * On resume: the last month whose occurrence fell before `date`, so paused
 * months are skipped (an occurrence due on `date` itself stays due).
 */
export function getLastDueMonthBeforeDate(rule: RecurringExpense, date: string): string | undefined {
  const cursor = cursorOf(rule);
  let month = cursor ? addMonths(cursor, 1) : rule.startMonth;
  let lastResolved = cursor;
  while (month <= monthOf(date)) {
    if (getRecurringOccurrenceDate(month, rule.dayOfMonth) >= date) break;
    lastResolved = month;
    month = addMonths(month, 1);
  }
  return lastResolved;
}

export type GeneratedOccurrence = Omit<Transaction, 'id'> & { recurringRuleId: string; recurringMonth: string };

export interface RecurringPlan {
  /** Occurrences to add, oldest first per rule. */
  occurrences: GeneratedOccurrence[];
  /** New cursor per rule ID; only rules with due months appear. */
  cursors: Record<string, string>;
}

/**
 * Every due, not-yet-generated occurrence of every active rule up to `today`.
 * An occurrence already present (by rule/month key, or for pre-v4 data by an
 * exact scheduled-date match) is skipped but still advances the cursor, so
 * running the plan again after saving it produces nothing.
 */
export function planRecurringGeneration(
  rules: readonly RecurringExpense[],
  transactions: readonly Transaction[],
  today: string,
): RecurringPlan {
  const occurrences: GeneratedOccurrence[] = [];
  const cursors: Record<string, string> = {};
  const currentMonth = monthOf(today);
  const keys = new Set(
    transactions.filter(t => t.recurringRuleId && t.recurringMonth).map(t => `${t.recurringRuleId}|${t.recurringMonth}`),
  );

  for (const rule of rules) {
    if (!rule.active || !rule.startMonth || rule.startMonth > currentMonth) continue;
    const cursor = cursorOf(rule);
    const due: string[] = [];
    for (let month = cursor ? addMonths(cursor, 1) : rule.startMonth; month <= currentMonth; month = addMonths(month, 1)) {
      if (getRecurringOccurrenceDate(month, rule.dayOfMonth) > today) break;
      due.push(month);
    }
    if (due.length === 0) continue;

    const note = rule.description;
    for (const month of due) {
      const date = getRecurringOccurrenceDate(month, rule.dayOfMonth);
      if (keys.has(`${rule.id}|${month}`)) continue;
      const legacyMatch = transactions.some(t =>
        t.recurringRuleId === undefined &&
        t.type === 'expense' &&
        t.date === date &&
        t.amount === rule.amount &&
        (t.note || '').trim().toLowerCase() === note.trim().toLowerCase() &&
        t.categoryId === rule.categoryId,
      );
      if (legacyMatch) continue;
      occurrences.push({
        type: 'expense',
        amount: rule.amount,
        categoryId: rule.categoryId,
        note,
        date,
        recurringRuleId: rule.id,
        recurringMonth: month,
      });
    }
    cursors[rule.id] = due[due.length - 1];
  }

  return { occurrences, cursors };
}
