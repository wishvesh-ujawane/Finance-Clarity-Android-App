import { useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { getMonthStatus, localDateStr } from '@/lib/finance-utils';
import { getExpenseMapForMonth, getMonthKey, getMonthTotal, shiftMonth } from '@/lib/analysis-utils';
import { SAVINGS_CATEGORY_IDS } from '@/lib/types';

/**
 * Math shared across two or more Analysis panes. Pane-specific memos stay
 * inside their pane to avoid bloating this hook.
 */
export function useAnalysisShared() {
  const finance = useFinance();
  const { transactions, categories, budgets, selectedMonth, getMonthSummary } = finance;

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => localDateStr(today), [today]);
  const currentMonthKey = useMemo(() => getMonthKey(today), [today]);
  const previousMonth = useMemo(() => shiftMonth(selectedMonth, -1), [selectedMonth]);

  const monthStatus = useMemo(() => getMonthStatus(selectedMonth), [selectedMonth]);
  const isCurrentMonthInProgress = monthStatus === 'current';

  const daysInSelectedMonth = useMemo(() => {
    const [year, monthNum] = selectedMonth.split('-').map(Number);
    return new Date(year, monthNum, 0).getDate();
  }, [selectedMonth]);

  const daysLeftInMonth = useMemo(() => {
    if (selectedMonth < currentMonthKey) return 0;
    if (selectedMonth > currentMonthKey) return daysInSelectedMonth;
    return Math.max(0, daysInSelectedMonth - today.getDate());
  }, [selectedMonth, currentMonthKey, daysInSelectedMonth, today]);

  const elapsedDays = useMemo(() => {
    if (selectedMonth < currentMonthKey) return daysInSelectedMonth;
    if (selectedMonth > currentMonthKey) return 1;
    return Math.max(1, today.getDate());
  }, [selectedMonth, currentMonthKey, daysInSelectedMonth, today]);

  const monthlyIncome = useMemo(() => getMonthTotal(transactions, selectedMonth, 'income'), [transactions, selectedMonth]);
  const monthlyExpenses = useMemo(() => getMonthTotal(transactions, selectedMonth, 'expense'), [transactions, selectedMonth]);
  const previousIncome = useMemo(() => getMonthTotal(transactions, previousMonth, 'income'), [transactions, previousMonth]);
  const previousExpenses = useMemo(() => getMonthTotal(transactions, previousMonth, 'expense'), [transactions, previousMonth]);

  const currentSummary = useMemo(() => getMonthSummary(selectedMonth), [getMonthSummary, selectedMonth]);
  const prevSummary = useMemo(() => getMonthSummary(previousMonth), [getMonthSummary, previousMonth]);

  const monthlyBudgetTotal = useMemo(
    () => budgets.filter(b => b.month === selectedMonth).reduce((sum, b) => sum + b.limit, 0),
    [budgets, selectedMonth]
  );

  const commitmentCategoryIds = useMemo(
    () => new Set(categories.filter(c => c.type === 'commitment').map(c => c.id)),
    [categories]
  );

  const monthlyCommitments = useMemo(
    () => transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(selectedMonth) && commitmentCategoryIds.has(t.categoryId))
      .reduce((sum, t) => sum + t.amount, 0),
    [transactions, selectedMonth, commitmentCategoryIds]
  );

  const monthlyDayToDay = monthlyExpenses - monthlyCommitments;

  // Stamped-only ("to-date") variants — exclude future-dated transactions in
  // the selected month (e.g. pre-materialized recurring expenses). For past
  // months these equal the full-month values; for future months they are 0.
  const monthlyExpensesToDate = useMemo(
    () => transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(selectedMonth) && t.date <= todayStr)
      .filter(t => !SAVINGS_CATEGORY_IDS.includes(t.categoryId as typeof SAVINGS_CATEGORY_IDS[number]))
      .reduce((sum, t) => sum + t.amount, 0),
    [transactions, selectedMonth, todayStr]
  );

  const monthlyIncomeToDate = useMemo(
    () => transactions
      .filter(t => t.type === 'income' && t.date.startsWith(selectedMonth) && t.date <= todayStr)
      .reduce((sum, t) => sum + t.amount, 0),
    [transactions, selectedMonth, todayStr]
  );

  const monthlyCommitmentsToDate = useMemo(
    () => transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(selectedMonth) && t.date <= todayStr && commitmentCategoryIds.has(t.categoryId))
      .reduce((sum, t) => sum + t.amount, 0),
    [transactions, selectedMonth, todayStr, commitmentCategoryIds]
  );

  const monthlyDayToDayToDate = monthlyExpensesToDate - monthlyCommitmentsToDate;

  const monthlyTransactions = useMemo(
    () => transactions.filter(t => t.date.startsWith(selectedMonth)),
    [transactions, selectedMonth]
  );

  const allCategorySpending = useMemo(() => {
    const totals = getExpenseMapForMonth(transactions, selectedMonth);
    return Object.entries(totals)
      .map(([categoryId, amount]) => {
        const category = categories.find(c => c.id === categoryId);
        return {
          categoryId,
          name: category?.name || 'Unknown',
          icon: category?.icon || 'DollarSign',
          color: category?.color || '#94A3B8',
          amount,
          pct: monthlyExpenses > 0 ? (amount / monthlyExpenses) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, selectedMonth, categories, monthlyExpenses]);

  return {
    finance,
    today,
    todayStr,
    currentMonthKey,
    previousMonth,
    monthStatus,
    isCurrentMonthInProgress,
    daysInSelectedMonth,
    daysLeftInMonth,
    elapsedDays,
    monthlyIncome,
    monthlyExpenses,
    previousIncome,
    previousExpenses,
    currentSummary,
    prevSummary,
    monthlyBudgetTotal,
    commitmentCategoryIds,
    monthlyCommitments,
    monthlyDayToDay,
    monthlyExpensesToDate,
    monthlyIncomeToDate,
    monthlyCommitmentsToDate,
    monthlyDayToDayToDate,
    monthlyTransactions,
    allCategorySpending,
  };
}

export type AnalysisShared = ReturnType<typeof useAnalysisShared>;
