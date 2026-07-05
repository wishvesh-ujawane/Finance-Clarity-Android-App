import { forwardRef, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, Sparkles } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatINR, formatMonthYear, getMonthOverMonthChange, type MoMChange } from '@/lib/finance-utils';
import { getBudgetPill, getDateRangeExpenseTotal, addDays, startOfWeekMonday } from '@/lib/analysis-utils';
import { SAVINGS_CATEGORY_IDS } from '@/lib/types';
import type { AnalysisShared } from './useAnalysisShared';

interface Props {
  shared: AnalysisShared;
}

type InsightSeverity = 'positive' | 'neutral' | 'warning' | 'danger';
interface InsightItem {
  id: string;
  text: string;
  severity: InsightSeverity;
  href?: string;
}

const OverviewPane = forwardRef<HTMLDivElement, Props>(({ shared }, ref) => {
  const {
    finance: { transactions, categories, budgets, selectedMonth, openEditSheet },
    today,
    monthlyTransactions,
    monthlyIncome,
    monthlyExpenses,
    previousIncome,
    previousExpenses,
    currentSummary,
    prevSummary,
    isCurrentMonthInProgress,
    monthlyBudgetTotal,
    monthlyCommitments,
    monthlyDayToDay,
    monthlyExpensesToDate,
    monthlyCommitmentsToDate,
    monthlyDayToDayToDate,
    daysLeftInMonth,
    elapsedDays,
    allCategorySpending,
  } = shared;
  const { commitmentCategoryIds } = shared;

  const [allCategoriesOpen, setAllCategoriesOpen] = useState(false);
  const [expenseBreakdownOpen, setExpenseBreakdownOpen] = useState(false);
  const [commitmentsBreakdownOpen, setCommitmentsBreakdownOpen] = useState(false);
  const [selectedPieSlice, setSelectedPieSlice] = useState<string | null>(null);

  const monthlySavings = currentSummary.totalSavings;
  const previousSavings = prevSummary.totalSavings;
  const momOpts = { previousHasData: prevSummary.hasData, currentMonthInProgress: isCurrentMonthInProgress };
  const spentChange: MoMChange = getMonthOverMonthChange(monthlyExpenses, previousExpenses, momOpts);
  const savingsChange: MoMChange = getMonthOverMonthChange(monthlySavings, previousSavings, momOpts);

  const remainingBudget = monthlyBudgetTotal - monthlyDayToDayToDate;
  const spentPct = monthlyBudgetTotal > 0 ? (monthlyDayToDayToDate / monthlyBudgetTotal) * 100 : 0;
  const budgetPill = getBudgetPill(spentPct);
  const isBudgetExceeded = monthlyBudgetTotal > 0 && monthlyDayToDayToDate > monthlyBudgetTotal;

  const avgSpendPerDay = monthlyExpensesToDate / Math.max(1, elapsedDays);
  const top5Categories = allCategorySpending.slice(0, 5);
  const topCategory = top5Categories[0];

  const monthlySavingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  const previousSavingsRate = previousIncome > 0 ? (previousSavings / previousIncome) * 100 : 0;

  const biggestExpense = useMemo(() => {
    const expenses = monthlyTransactions.filter(t => t.type === 'expense');
    if (expenses.length === 0) return null;
    const top = expenses.reduce((max, t) => (t.amount > max.amount ? t : max), expenses[0]);
    const cat = categories.find(c => c.id === top.categoryId);
    return {
      transaction: top,
      categoryName: cat?.name || 'Unknown',
      categoryIcon: cat?.icon || 'DollarSign',
      categoryColor: cat?.color || '#94A3B8',
    };
  }, [monthlyTransactions, categories]);

  const budgetVsSpentRows = useMemo(() => {
    return budgets
      .filter(b => b.month === selectedMonth)
      .map(b => {
        const category = categories.find(c => c.id === b.categoryId);
        const spent = transactions
          .filter(t => t.type === 'expense' && t.categoryId === b.categoryId && t.date.startsWith(selectedMonth))
          .reduce((sum, t) => sum + t.amount, 0);
        const usagePct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
        return {
          id: b.id,
          name: category?.name || 'Unknown',
          spent,
          limit: b.limit,
          usagePct,
        };
      })
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);
  }, [budgets, selectedMonth, categories, transactions]);

  // Day-to-day expense categories (excludes commitments and savings) for the
  // "Expenses this month" tile drill-down. Sum matches `monthlyDayToDay`.
  const dayToDayCategorySpending = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of monthlyTransactions) {
      if (t.type !== 'expense') continue;
      if (commitmentCategoryIds.has(t.categoryId)) continue;
      if (SAVINGS_CATEGORY_IDS.includes(t.categoryId as typeof SAVINGS_CATEGORY_IDS[number])) continue;
      totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
    }
    const total = Array.from(totals.values()).reduce((sum, v) => sum + v, 0);
    return Array.from(totals.entries())
      .map(([categoryId, amount]) => {
        const category = categories.find(c => c.id === categoryId);
        return {
          categoryId,
          name: category?.name || 'Unknown',
          icon: category?.icon || 'DollarSign',
          color: category?.color || '#94A3B8',
          amount,
          pct: total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [monthlyTransactions, categories, commitmentCategoryIds]);

  // Commitment categories only for the "Commitments" tile drill-down. Sum
  // matches `monthlyCommitments`.
  const commitmentCategorySpending = useMemo(() => {
    const totals = new Map<string, number>();
    for (const t of monthlyTransactions) {
      if (t.type !== 'expense') continue;
      if (!commitmentCategoryIds.has(t.categoryId)) continue;
      totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
    }
    const total = Array.from(totals.values()).reduce((sum, v) => sum + v, 0);
    return Array.from(totals.entries())
      .map(([categoryId, amount]) => {
        const category = categories.find(c => c.id === categoryId);
        return {
          categoryId,
          name: category?.name || 'Unknown',
          icon: category?.icon || 'DollarSign',
          color: category?.color || '#94A3B8',
          amount,
          pct: total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [monthlyTransactions, categories, commitmentCategoryIds]);

  const weeklyInsight = useMemo(() => {
    const thisWeekStart = startOfWeekMonday(today);
    const thisWeekSpend = getDateRangeExpenseTotal(transactions, thisWeekStart, today);
    const previous4WeekTotals = Array.from({ length: 4 }, (_, i) => {
      const end = addDays(thisWeekStart, -1 - i * 7);
      const start = addDays(end, -6);
      return getDateRangeExpenseTotal(transactions, start, end);
    });
    const previous4WeekAvg = previous4WeekTotals.reduce((sum, value) => sum + value, 0) / 4;
    const deltaPct = previous4WeekAvg > 0 ? ((thisWeekSpend - previous4WeekAvg) / previous4WeekAvg) * 100 : null;
    return { thisWeekSpend, previous4WeekAvg, deltaPct };
  }, [transactions, today]);

  const smartInsights = useMemo<InsightItem[]>(() => {
    const items: InsightItem[] = [];

    if (isBudgetExceeded) {
      items.push({
        id: 'budget-exceeded',
        text: `You have exceeded your day-to-day budget by ${formatINR(monthlyDayToDayToDate - monthlyBudgetTotal)}.`,
        severity: 'danger',
        href: '/budgets',
      });
    } else if (monthlyBudgetTotal > 0 && spentPct >= 80) {
      items.push({
        id: 'budget-watch',
        text: `You've used ${spentPct.toFixed(0)}% of your day-to-day budget — pace your remaining spend.`,
        severity: 'warning',
        href: '/budgets',
      });
    }

    if (previousExpenses > 0 && spentChange.pct !== null) {
      items.push({
        id: 'spend-vs-last',
        text: `Spending is ${spentChange.pct >= 0 ? 'up' : 'down'} ${Math.abs(spentChange.pct).toFixed(1)}% vs last month${topCategory ? `, led by ${topCategory.name}.` : '.'}`,
        severity: spentChange.pct > 10 ? 'warning' : spentChange.pct < -5 ? 'positive' : 'neutral',
      });
    }

    if ((previousIncome > 0 || monthlyIncome > 0) && savingsChange.pct !== null) {
      items.push({
        id: 'savings-rate',
        text: `Savings rate moved from ${Math.max(0, previousSavingsRate).toFixed(1)}% to ${Math.max(0, monthlySavingsRate).toFixed(1)}% (${savingsChange.pct >= 0 ? '+' : ''}${savingsChange.pct.toFixed(1)}%).`,
        severity: savingsChange.pct >= 0 ? 'positive' : 'warning',
      });
    }

    if (weeklyInsight.previous4WeekAvg > 0 && weeklyInsight.deltaPct !== null) {
      const isSpike = weeklyInsight.deltaPct > 20;
      items.push({
        id: 'weekly-pace',
        text: `Weekly spend is ${weeklyInsight.deltaPct >= 0 ? 'up' : 'down'} ${Math.abs(weeklyInsight.deltaPct).toFixed(1)}% vs your previous 4-week average.`,
        severity: isSpike ? 'warning' : weeklyInsight.deltaPct < -10 ? 'positive' : 'neutral',
        href: '/transactions',
      });
    }

    if (items.length === 0) {
      items.push({
        id: 'empty',
        text: 'No spend logged this month yet. Add transactions to unlock insights.',
        severity: 'neutral',
        href: '/transactions',
      });
    }

    return items;
  }, [
    isBudgetExceeded,
    monthlyDayToDayToDate,
    monthlyBudgetTotal,
    spentPct,
    previousExpenses,
    spentChange,
    topCategory,
    previousIncome,
    monthlyIncome,
    previousSavingsRate,
    monthlySavingsRate,
    savingsChange,
    weeklyInsight,
  ]);

  return (    <>
      <div ref={ref} className="space-y-4">
        {isBudgetExceeded && (
          <Link
            href="/budgets"
            className="block bg-red-500/10 border border-red-500/30 rounded-2xl p-5 hover:bg-red-500/15 transition-colors"
            data-testid="budget-exceeded-hero"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                <AlertCircle size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Budget exceeded</p>
                <h2 className="text-base font-bold text-foreground mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                  Day-to-day spend is over by {formatINR(monthlyDayToDayToDate - monthlyBudgetTotal)}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Review category budgets and trim where possible. <span className="text-red-600 dark:text-red-400 font-semibold inline-flex items-center gap-0.5">Manage <ArrowRight size={11} /></span>
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* Zone 1 — How am I doing this month? */}
        <p className="text-base font-bold text-foreground px-1 pt-1" style={{ fontFamily: 'var(--font-display)' }} data-testid="zone-label-1">How am I doing this month?</p>
        <div className="bg-card border border-border rounded-2xl p-5" data-testid="monthly-budget-health">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budget Health</h2>
            </div>
            <div className="flex items-center gap-2">
              {monthlyBudgetTotal > 0 && (
                <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-full', budgetPill.className)}>
                  {budgetPill.label}
                </span>
              )}
              <span className={cn('text-sm font-semibold', monthlyBudgetTotal > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                {monthlyBudgetTotal > 0 ? `${Math.min(spentPct, 999).toFixed(1)}% spent` : 'No budget configured'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Link
              href="/budgets"
              data-testid="tile-budget"
              aria-label="Open Budgets screen"
              className="rounded-xl bg-muted/50 px-3 py-2 text-left hover:bg-muted/70 active:bg-muted transition-colors flex items-start justify-between gap-1"
            >
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Budget</p>
                <p className="text-sm font-bold text-foreground">{formatINR(monthlyBudgetTotal)}</p>
              </div>
              <ChevronRight size={12} className="text-muted-foreground mt-0.5 flex-shrink-0" />
            </Link>
            <button
              type="button"
              data-testid="tile-expenses-this-month"
              aria-label="View day-to-day expense breakdown"
              onClick={() => setExpenseBreakdownOpen(true)}
              className="rounded-xl bg-muted/50 px-3 py-2 text-left hover:bg-muted/70 active:bg-muted transition-colors flex items-start justify-between gap-1"
            >
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Expenses this month</p>
                <p className={cn('text-sm font-bold', isBudgetExceeded ? 'text-red-500' : 'text-foreground')}>{formatINR(monthlyDayToDay)}</p>
              </div>
              <ChevronRight size={12} className="text-muted-foreground mt-0.5 flex-shrink-0" />
            </button>
            <button
              type="button"
              data-testid="tile-commitments"
              aria-label="View commitment breakdown"
              onClick={() => setCommitmentsBreakdownOpen(true)}
              className="rounded-xl bg-muted/50 px-3 py-2 text-left hover:bg-muted/70 active:bg-muted transition-colors flex items-start justify-between gap-1"
            >
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Commitments</p>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{formatINR(monthlyCommitments)}</p>
              </div>
              <ChevronRight size={12} className="text-muted-foreground mt-0.5 flex-shrink-0" />
            </button>
            <div className="rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Days Left</p>
              <p className="text-sm font-bold text-foreground">{daysLeftInMonth} day{daysLeftInMonth === 1 ? '' : 's'}</p>
            </div>
          </div>

          <div className="h-2 rounded-full overflow-hidden bg-muted mb-3">
            <div
              className={cn('h-full rounded-full', spentPct <= 80 ? 'bg-emerald-500' : spentPct <= 100 ? 'bg-amber-500' : 'bg-red-500')}
              style={{ width: `${Math.min(Math.max(spentPct, 0), 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">Remaining budget</p>
            <p className={cn('font-bold', remainingBudget >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
              {formatINR(remainingBudget)}
            </p>
          </div>
        </div>

        {/* Zone 2 — Key numbers */}
        <p className="text-base font-bold text-foreground px-1 pt-1" style={{ fontFamily: 'var(--font-display)' }} data-testid="zone-label-2">Key numbers</p>
        <div className="grid grid-cols-2 gap-3" data-testid="key-numbers-grid">
          <div className="bg-card border border-border rounded-2xl p-4" data-testid="kpi-total-spent">
            <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
            <p className="text-lg font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatINR(monthlyExpensesToDate)}</p>
            {spentChange.pct !== null && (
              <p className={cn('text-[11px] mt-1 flex items-center gap-0.5 font-semibold', spentChange.pct <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                {spentChange.pct <= 0 ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}
                {Math.abs(spentChange.pct).toFixed(1)}% vs last month
              </p>
            )}
          </div>

          {biggestExpense ? (
            <button
              type="button"
              onClick={() => openEditSheet(biggestExpense.transaction)}
              className="bg-card border border-border rounded-2xl p-4 text-left hover:bg-muted/40 transition-colors"
              data-testid="biggest-expense-card"
            >
              <p className="text-xs text-muted-foreground mb-1">Biggest Expense</p>
              <p className="text-lg font-bold text-red-500" style={{ fontFamily: 'var(--font-display)' }}>{formatINR(biggestExpense.transaction.amount)}</p>
              <p className="text-[11px] text-muted-foreground truncate mt-1">{biggestExpense.categoryName}</p>
            </button>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-4" data-testid="biggest-expense-card">
              <p className="text-xs text-muted-foreground mb-1">Biggest Expense</p>
              <p className="text-lg font-bold text-muted-foreground" style={{ fontFamily: 'var(--font-display)' }}>—</p>
              <p className="text-[11px] text-muted-foreground mt-1">No spend yet</p>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-4" data-testid="kpi-avg-day">
            <p className="text-xs text-muted-foreground mb-1">Avg / day</p>
            <p className="text-lg font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatINR(Math.round(avgSpendPerDay))}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Over {elapsedDays} day{elapsedDays === 1 ? '' : 's'}</p>
          </div>

          <button
            type="button"
            data-testid="kpi-commitments"
            aria-label="View commitment breakdown"
            onClick={() => setCommitmentsBreakdownOpen(true)}
            className="bg-card border border-border rounded-2xl p-4 text-left hover:bg-muted/40 transition-colors"
          >
            <p className="text-xs text-muted-foreground mb-1">Commitments</p>
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400" style={{ fontFamily: 'var(--font-display)' }}>{formatINR(monthlyCommitmentsToDate)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">Paid so far this month</p>
          </button>
        </div>

        {/* Zone 3 — Where did the money go? */}
        <p className="text-base font-bold text-foreground px-1 pt-1" style={{ fontFamily: 'var(--font-display)' }} data-testid="zone-label-3">Where did the money go?</p>

        <div className="bg-card border border-border rounded-2xl p-5" data-testid="top-categories-pie">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Top 5 Categories</h2>
            <button
              type="button"
              onClick={() => setAllCategoriesOpen(true)}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              See All
            </button>
          </div>

          {top5Categories.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No category spending in this month yet</div>
          ) : (
            <div className="grid md:grid-cols-[260px_1fr] gap-4 items-center">
              <div className="h-56 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={top5Categories}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={86}
                      paddingAngle={2}
                      onClick={(slice: { categoryId?: string }) => {
                        if (slice?.categoryId) {
                          setSelectedPieSlice(prev => prev === slice.categoryId ? null : (slice.categoryId ?? null));
                        }
                      }}
                    >
                      {top5Categories.map(item => {
                        const isDimmed = selectedPieSlice !== null && selectedPieSlice !== item.categoryId;
                        return (
                          <Cell
                            key={item.categoryId}
                            fill={item.color}
                            opacity={isDimmed ? 0.3 : 1}
                            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                          />
                        );
                      })}
                    </Pie>
                    <Tooltip formatter={(value: number) => [formatINR(value), 'Spent']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {selectedPieSlice ? (() => {
                    const slice = top5Categories.find(c => c.categoryId === selectedPieSlice);
                    if (!slice) return null;
                    return (
                      <>
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{slice.name}</p>
                        <p className="text-base font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatINR(slice.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">{slice.pct.toFixed(1)}%</p>
                      </>
                    );
                  })() : (
                    <>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total</p>
                      <p className="text-base font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatINR(monthlyExpenses)}</p>
                      <p className="text-[10px] text-muted-foreground">Tap a slice</p>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {top5Categories.map(item => {
                  const isSelected = selectedPieSlice === item.categoryId;
                  const isDimmed = selectedPieSlice !== null && !isSelected;
                  return (
                    <button
                      key={item.categoryId}
                      type="button"
                      onClick={() => setSelectedPieSlice(prev => prev === item.categoryId ? null : item.categoryId)}
                      className={cn(
                        'w-full flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-all',
                        isSelected ? 'border-accent bg-accent/5' : 'border-border hover:bg-muted/40',
                        isDimmed ? 'opacity-50' : ''
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${item.color}22` }}>
                          <CategoryIcon icon={item.icon} color={item.color} size={14} />
                        </div>
                        <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                      </div>
                      <div className="text-right pl-3">
                        <p className="text-sm font-bold text-foreground">{formatINR(item.amount)}</p>
                        <p className="text-[11px] text-muted-foreground">{item.pct.toFixed(1)}%</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5" data-testid="budget-vs-spent-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budget vs Spent</h2>
            <Link href="/budgets" className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors">
              Manage
            </Link>
          </div>

          {budgetVsSpentRows.length === 0 ? (
            <div className="py-8 text-sm text-muted-foreground">No budgets set for {formatMonthYear(selectedMonth)}. Add budgets to compare category performance.</div>
          ) : (
            <div className="space-y-3">
              {budgetVsSpentRows.map(row => (
                <div key={row.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-foreground">{row.name}</p>
                    <p className="text-xs font-semibold text-muted-foreground">{Math.round(row.usagePct)}%</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                    <div className={cn('h-full rounded-full', row.usagePct > 100 ? 'bg-red-500' : row.usagePct > 80 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, Math.max(0, row.usagePct))}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Budget: <span className="font-semibold text-foreground">{formatINR(row.limit)}</span></span>
                    <span className="text-muted-foreground">Spent: <span className="font-semibold text-foreground">{formatINR(row.spent)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zone 4 — What should I do? */}
        <p className="text-base font-bold text-foreground px-1 pt-1" style={{ fontFamily: 'var(--font-display)' }} data-testid="zone-label-4">What should I do?</p>
        <div className="bg-card border border-border rounded-2xl p-5" data-testid="smart-insights-card">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center flex-shrink-0">
              <Sparkles size={17} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Smart Insights</p>
              <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Spends, Savings & Weekly Spikes</h2>
            </div>
          </div>
          <div className="space-y-2">
            {smartInsights.map(item => {
              const severityStyles: Record<typeof item.severity, string> = {
                positive: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
                neutral: 'bg-muted/40 border-border text-foreground',
                warning: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
                danger: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300',
              };
              return (
                <div key={item.id} className={cn('rounded-xl border px-3 py-2.5', severityStyles[item.severity])}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-relaxed">{item.text}</p>
                    {item.href && (
                      <Link href={item.href} className="text-xs font-semibold inline-flex items-center gap-0.5 flex-shrink-0 hover:underline">
                        View <ArrowRight size={11} />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Sheet open={allCategoriesOpen} onOpenChange={setAllCategoriesOpen}>
        <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto rounded-t-2xl p-5">
          <SheetHeader className="text-left mb-4 pr-8">
            <SheetTitle className="text-base" style={{ fontFamily: 'var(--font-display)' }}>
              Category Spend Breakdown
            </SheetTitle>
            <SheetDescription>
              All categories for {formatMonthYear(selectedMonth)} with spend percentage
            </SheetDescription>
          </SheetHeader>

          {allCategorySpending.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">No category spending in this month</div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {allCategorySpending.map(item => (
                <div key={item.categoryId} className="w-full flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${item.color}22` }}>
                      <CategoryIcon icon={item.icon} color={item.color} size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.pct.toFixed(1)}% of monthly spend</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground flex-shrink-0">{formatINR(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={expenseBreakdownOpen} onOpenChange={setExpenseBreakdownOpen}>
        <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto rounded-t-2xl p-5">
          <SheetHeader className="text-left mb-4 pr-8">
            <SheetTitle className="text-base" style={{ fontFamily: 'var(--font-display)' }}>
              Expenses this month
            </SheetTitle>
            <SheetDescription>
              Day-to-day categories for {formatMonthYear(selectedMonth)} • {formatINR(monthlyDayToDay)} total
            </SheetDescription>
          </SheetHeader>

          {dayToDayCategorySpending.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">No day-to-day spending in this month</div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden" data-testid="expense-breakdown-list">
              {dayToDayCategorySpending.map(item => (
                <div key={item.categoryId} className="w-full flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${item.color}22` }}>
                      <CategoryIcon icon={item.icon} color={item.color} size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.pct.toFixed(1)}% of day-to-day spend</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-foreground flex-shrink-0">{formatINR(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={commitmentsBreakdownOpen} onOpenChange={setCommitmentsBreakdownOpen}>
        <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto rounded-t-2xl p-5">
          <SheetHeader className="text-left mb-4 pr-8">
            <SheetTitle className="text-base" style={{ fontFamily: 'var(--font-display)' }}>
              Commitments
            </SheetTitle>
            <SheetDescription>
              Commitment categories for {formatMonthYear(selectedMonth)} • {formatINR(monthlyCommitments)} total
            </SheetDescription>
          </SheetHeader>

          {commitmentCategorySpending.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">No commitments recorded this month</div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden" data-testid="commitments-breakdown-list">
              {commitmentCategorySpending.map(item => (
                <div key={item.categoryId} className="w-full flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${item.color}22` }}>
                      <CategoryIcon icon={item.icon} color={item.color} size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.pct.toFixed(1)}% of commitments</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex-shrink-0">{formatINR(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
});

OverviewPane.displayName = 'OverviewPane';
export default OverviewPane;
