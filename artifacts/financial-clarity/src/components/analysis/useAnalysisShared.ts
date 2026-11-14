import { useMemo } from 'react';
import { useFinance } from '@/context/FinanceContext';
import { getMonthStatus, localDateStr } from '@/lib/finance-utils';
import { getExpenseMapForMonth, getMonthKey, getMonthTotal, shiftMonth } from '@/lib/analysis-utils';
import {
  commitmentCategoryIds as getCommitmentCategoryIds,
  totalCommitments,
  totalConsumption,
  totalIncome,
  totalSavingsContributions,
} from '@/lib/domain/finance-metrics';

/**
 * Math shared across two or more Analysis panes. Pane-specific memos stay
 * inside their pane to avoid bloating this hook.
 */
export function useAnalysisShared() {
  const finance = useFinance();
  const { transactions, categories, selectedMonth, getMonthSummary } = finance;

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

  // One budget summary shared with the Budgets screen (day-to-day /
  // commitments / savings, plus spending in categories without a budget).
  const budgetBreakdown = useMemo(
    () => finance.getBudgetBreakdown(selectedMonth),
    [finance, selectedMonth]
  );

  // Shared PRD §6 totals; "to-date" variants exclude future-dated entries in
  // the selected month (for example pre-materialized recurring expenses).
  const commitmentCategoryIds = useMemo(() => getCommitmentCategoryIds(categories), [categories]);

  const monthlyCommitments = useMemo(
    () => totalCommitments(transactions, categories, selectedMonth),
    [transactions, categories, selectedMonth]
  );

  const monthlyDayToDay = monthlyExpenses - monthlyCommitments;

  const monthlyExpensesToDate = useMemo(
    () => totalConsumption(transactions, selectedMonth, { through: todayStr }),
    [transactions, selectedMonth, todayStr]
  );

  const monthlyIncomeToDate = useMemo(
    () => totalIncome(transactions, selectedMonth, { through: todayStr }),
    [transactions, selectedMonth, todayStr]
  );

  const monthlyCommitmentsToDate = useMemo(
    () => totalCommitments(transactions, categories, selectedMonth, { through: todayStr }),
    [transactions, categories, selectedMonth, todayStr]
  );

  const monthlyDayToDayToDate = monthlyExpensesToDate - monthlyCommitmentsToDate;

  const monthlySavings = currentSummary.totalSavings;
  const monthlySavingsToDate = useMemo(
    () => totalSavingsContributions(transactions, selectedMonth, { through: todayStr }),
    [transactions, selectedMonth, todayStr]
  );

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
    budgetBreakdown,
    commitmentCategoryIds,
    monthlyCommitments,
    monthlyDayToDay,
    monthlySavings,
    monthlyExpensesToDate,
    monthlyIncomeToDate,
    monthlyCommitmentsToDate,
    monthlyDayToDayToDate,
    monthlySavingsToDate,
    monthlyTransactions,
    allCategorySpending,
  };
}

export type AnalysisShared = ReturnType<typeof useAnalysisShared>;
