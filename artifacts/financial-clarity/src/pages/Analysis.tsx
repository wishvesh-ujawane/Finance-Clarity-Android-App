import { useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { AlertCircle, AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, ChevronDown, Info, Share2, Sparkles, Target, TrendingUp, WalletCards } from 'lucide-react';
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { addMonths, formatINR, formatShortINR, formatMonthYear, localDateStr } from '@/lib/finance-utils';
import { SAVINGS_CATEGORY_IDS } from '@/lib/types';

function shiftMonth(month: string, offset: number) {
  const [year, monthNum] = month.split('-').map(Number);
  const shifted = new Date(year, monthNum - 1 + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

function getLastNMonths(endMonth: string, count: number): string[] {
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    months.push(shiftMonth(endMonth, -i));
  }
  return months;
}

function monthLabel(month: string) {
  const [year, monthNum] = month.split('-').map(Number);
  return new Date(year, monthNum - 1).toLocaleDateString('en-IN', { month: 'short' });
}

function getBudgetPill(pct: number) {
  if (pct > 100) {
    return { label: 'Over budget', className: 'bg-red-500/15 text-red-600 dark:text-red-400' };
  }
  if (pct >= 80) {
    return { label: 'Watch', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' };
  }
  return { label: 'On track', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
}

function getMonthTotal(
  transactions: ReturnType<typeof useFinance>['transactions'],
  month: string,
  type: 'expense' | 'income'
) {
  return transactions
    .filter(t => t.type === type && t.date.startsWith(month))
    .reduce((sum, t) => sum + t.amount, 0);
}

function getExpenseMapForMonth(transactions: ReturnType<typeof useFinance>['transactions'], month: string) {
  const map: Record<string, number> = {};
  transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(month))
    .forEach(t => {
      map[t.categoryId] = (map[t.categoryId] || 0) + t.amount;
    });
  return map;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseLocalDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`);
}

function startOfWeekMonday(date: Date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() + diff);
  return start;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getDateRangeExpenseTotal(transactions: ReturnType<typeof useFinance>['transactions'], start: Date, end: Date) {
  const startAt = start.getTime();
  const endAt = end.getTime();
  return transactions
    .filter(t => t.type === 'expense')
    .filter(t => {
      const time = parseLocalDate(t.date).getTime();
      return time >= startAt && time <= endAt;
    })
    .reduce((sum, t) => sum + t.amount, 0);
}

function getChangePct(current: number, previous: number) {
  if (previous > 0) return ((current - previous) / previous) * 100;
  if (current > 0) return 100;
  return 0;
}

export default function Analysis() {
  const {
    transactions,
    categories,
    budgets,
    selectedMonth,
    setSelectedMonth,
    openEditSheet,
    recurringExpenses,
    savingsGoal,
    addBudget,
  } = useFinance();
  const [allCategoriesOpen, setAllCategoriesOpen] = useState(false);
  const [selectedPieSlice, setSelectedPieSlice] = useState<string | null>(null);
  const [budgetTooltipOpen, setBudgetTooltipOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null);
  const [suggestionsApplied, setSuggestionsApplied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const overviewRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => localDateStr(today), [today]);
  const currentMonthKey = useMemo(() => getMonthKey(today), [today]);
  const previousMonth = useMemo(() => shiftMonth(selectedMonth, -1), [selectedMonth]);
  const last6Months = useMemo(() => getLastNMonths(selectedMonth, 6), [selectedMonth]);

  const monthlyIncome = useMemo(() => getMonthTotal(transactions, selectedMonth, 'income'), [transactions, selectedMonth]);
  const monthlyExpenses = useMemo(() => getMonthTotal(transactions, selectedMonth, 'expense'), [transactions, selectedMonth]);
  const previousIncome = useMemo(() => getMonthTotal(transactions, previousMonth, 'income'), [transactions, previousMonth]);
  const previousExpenses = useMemo(() => getMonthTotal(transactions, previousMonth, 'expense'), [transactions, previousMonth]);

  const monthlySavings = monthlyIncome - monthlyExpenses;
  const previousSavings = previousIncome - previousExpenses;
  const spentChangePct = getChangePct(monthlyExpenses, previousExpenses);
  const incomeChangePct = getChangePct(monthlyIncome, previousIncome);
  const savingsChangePct = getChangePct(monthlySavings, previousSavings);

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
  const remainingBudget = monthlyBudgetTotal - monthlyDayToDay;
  const spentPct = monthlyBudgetTotal > 0 ? (monthlyDayToDay / monthlyBudgetTotal) * 100 : 0;
  const budgetPill = getBudgetPill(spentPct);
  const isBudgetExceeded = monthlyBudgetTotal > 0 && monthlyDayToDay > monthlyBudgetTotal;

  const monthlyTransactions = useMemo(
    () => transactions.filter(t => t.date.startsWith(selectedMonth)),
    [transactions, selectedMonth]
  );
  const transactionCount = monthlyTransactions.length;
  const avgSpendPerDay = monthlyExpenses / Math.max(1, elapsedDays);

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
  const top5Categories = allCategorySpending.slice(0, 5);

  const spendingTrendData = useMemo(() => {
    return last6Months.map(month => ({
      month: monthLabel(month),
      raw: month,
      spent: getMonthTotal(transactions, month, 'expense'),
      income: getMonthTotal(transactions, month, 'income'),
    }));
  }, [last6Months, transactions]);

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

  const monthlySavingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;
  const previousSavingsRate = previousIncome > 0 ? (previousSavings / previousIncome) * 100 : 0;

  const weeklyInsight = useMemo(() => {
    const thisWeekStart = startOfWeekMonday(today);
    const thisWeekSpend = getDateRangeExpenseTotal(transactions, thisWeekStart, today);
    const previous4WeekTotals = Array.from({ length: 4 }, (_, i) => {
      const end = addDays(thisWeekStart, -1 - i * 7);
      const start = addDays(end, -6);
      return getDateRangeExpenseTotal(transactions, start, end);
    });
    const previous4WeekAvg = previous4WeekTotals.reduce((sum, value) => sum + value, 0) / 4;
    const deltaPct = getChangePct(thisWeekSpend, previous4WeekAvg);

    return {
      thisWeekSpend,
      previous4WeekAvg,
      deltaPct,
    };
  }, [transactions, today]);

  const topCategory = top5Categories[0];

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

  const barChartYMax = useMemo(() => {
    const max = Math.max(
      ...spendingTrendData.map(d => Math.max(d.spent, d.income)),
      0
    );
    if (max <= 0) return 1000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil((max * 1.15) / magnitude) * magnitude;
  }, [spendingTrendData]);

  type InsightSeverity = 'positive' | 'neutral' | 'warning' | 'danger';
  interface InsightItem {
    id: string;
    text: string;
    severity: InsightSeverity;
    href?: string;
  }

  const smartInsightsList = useMemo<InsightItem[]>(() => {
    const items: InsightItem[] = [];

    if (isBudgetExceeded) {
      items.push({
        id: 'budget-exceeded',
        text: `You have exceeded your day-to-day budget by ${formatINR(monthlyDayToDay - monthlyBudgetTotal)}.`,
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

    if (previousExpenses > 0) {
      items.push({
        id: 'spend-vs-last',
        text: `Spending is ${spentChangePct >= 0 ? 'up' : 'down'} ${Math.abs(spentChangePct).toFixed(1)}% vs last month${topCategory ? `, led by ${topCategory.name}.` : '.'}`,
        severity: spentChangePct > 10 ? 'warning' : spentChangePct < -5 ? 'positive' : 'neutral',
      });
    }

    if (previousIncome > 0 || monthlyIncome > 0) {
      items.push({
        id: 'savings-rate',
        text: `Savings rate moved from ${Math.max(0, previousSavingsRate).toFixed(1)}% to ${Math.max(0, monthlySavingsRate).toFixed(1)}% (${savingsChangePct >= 0 ? '+' : ''}${savingsChangePct.toFixed(1)}%).`,
        severity: savingsChangePct >= 0 ? 'positive' : 'warning',
      });
    }

    if (weeklyInsight.previous4WeekAvg > 0) {
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
    monthlyDayToDay,
    monthlyBudgetTotal,
    spentPct,
    previousExpenses,
    spentChangePct,
    topCategory,
    previousIncome,
    monthlyIncome,
    previousSavingsRate,
    monthlySavingsRate,
    savingsChangePct,
    weeklyInsight,
  ]);

  const smartInsights = smartInsightsList;

  const inHandBalance = useMemo(() => {
    return transactions
      .filter(t => t.date <= todayStr)
      .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
  }, [transactions, todayStr]);
  const currentMonthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentMonthDaysLeft = Math.max(1, currentMonthDays - today.getDate() + 1);
  const safeToSpendPerDay = Math.max(0, inHandBalance / currentMonthDaysLeft);

  const upcomingObligations = useMemo(() => {
    const cur = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return recurringExpenses
      .filter(r => r.active)
      .map(r => {
        const cat = categories.find(c => c.id === r.categoryId);
        // Compute next expected date >= today
        let candidate = new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth);
        if (candidate < cur) {
          candidate = new Date(today.getFullYear(), today.getMonth() + 1, r.dayOfMonth);
        }
        // Clamp day to month length
        const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
        if (r.dayOfMonth > lastDay) {
          candidate = new Date(candidate.getFullYear(), candidate.getMonth(), lastDay);
        }
        const dueIn = Math.ceil((candidate.getTime() - cur.getTime()) / 86400000);
        return {
          id: r.id,
          dueIn,
          item: r.description,
          kind: cat?.name || 'Recurring',
          amount: r.amount,
          icon: cat?.icon || 'DollarSign',
          color: cat?.color || '#6366F1',
          expectedDateLabel: candidate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        };
      })
      .sort((a, b) => a.dueIn - b.dueIn || b.amount - a.amount)
      .slice(0, 8);
  }, [recurringExpenses, categories, today]);

  // ─── Planning Card A: Projected month-end balance ──────────────────────
  const projectedBalance = useMemo(() => {
    if (selectedMonth !== currentMonthKey) return null;
    const last3 = [1, 2, 3].map(o => shiftMonth(currentMonthKey, -o));
    const incomes = last3.map(m => getMonthTotal(transactions, m, 'income')).filter(v => v > 0);
    const expectedIncome = incomes.length > 0
      ? incomes.reduce((s, v) => s + v, 0) / incomes.length
      : monthlyIncome;
    const projectedRemainingSpend = (monthlyExpenses / Math.max(1, elapsedDays)) * daysLeftInMonth;
    const value = inHandBalance + Math.max(0, expectedIncome - monthlyIncome) - projectedRemainingSpend;
    return { value, expectedIncome, projectedRemainingSpend };
  }, [selectedMonth, currentMonthKey, transactions, monthlyIncome, monthlyExpenses, elapsedDays, daysLeftInMonth, inHandBalance]);

  // ─── Planning Card B: Next-month budget suggestions ────────────────────
  const nextMonth = useMemo(() => addMonths(selectedMonth, 1), [selectedMonth]);
  const budgetSuggestions = useMemo(() => {
    const suggestions = allCategorySpending
      .filter(c => c.amount > 0)
      .slice(0, 3)
      .map(c => {
        const suggestedLimit = Math.ceil((c.amount * 1.05) / 100) * 100;
        const existing = budgets.find(b => b.month === nextMonth && b.categoryId === c.categoryId);
        return {
          categoryId: c.categoryId,
          name: c.name,
          icon: c.icon,
          color: c.color,
          actual: c.amount,
          suggestedLimit,
          existingLimit: existing?.limit ?? null,
        };
      });
    return suggestions;
  }, [allCategorySpending, budgets, nextMonth]);

  const applySuggestions = () => {
    budgetSuggestions.forEach(s => {
      addBudget({ categoryId: s.categoryId, limit: s.suggestedLimit, month: nextMonth });
    });
    setSuggestionsApplied(true);
    setTimeout(() => setSuggestionsApplied(false), 3500);
  };

  // ─── Planning Card C: Savings goal progress ────────────────────────────
  const savingsGoalsProgress = useMemo(() => {
    if (!savingsGoal) return [];
    const year = today.getFullYear();
    const monthIndex = today.getMonth() + 1;
    const ytdMonthPrefixes: string[] = [];
    for (let m = 0; m <= today.getMonth(); m++) {
      ytdMonthPrefixes.push(`${year}-${String(m + 1).padStart(2, '0')}`);
    }
    const ytdSavingsByCat: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      if (!SAVINGS_CATEGORY_IDS.includes(t.categoryId as typeof SAVINGS_CATEGORY_IDS[number])) continue;
      if (!ytdMonthPrefixes.some(p => t.date.startsWith(p))) continue;
      ytdSavingsByCat[t.categoryId] = (ytdSavingsByCat[t.categoryId] ?? 0) + t.amount;
    }
    const entries = [
      { key: 'goal' as const, id: 'savings-goal', name: 'Goal Savings', color: '#0EA5E9', goal: savingsGoal.goal },
      { key: 'emergency' as const, id: 'savings-emergency', name: 'Emergency Fund', color: '#14B8A6', goal: savingsGoal.emergency },
    ];
    return entries.map(e => {
      const annualGoal = e.goal.annual > 0 ? e.goal.annual : e.goal.monthly * 12;
      const ytdContrib = ytdSavingsByCat[e.id] ?? 0;
      const expectedToDate = annualGoal * (monthIndex / 12);
      const pct = annualGoal > 0 ? Math.max(0, Math.min(100, (ytdContrib / annualGoal) * 100)) : 0;
      const onTrack = annualGoal > 0 && ytdContrib >= expectedToDate;
      return { ...e, annualGoal, ytdContrib, pct, onTrack, monthIndex };
    });
  }, [savingsGoal, transactions, today]);
  const visibleSavingsGoals = useMemo(() => savingsGoalsProgress.filter(g => g.annualGoal > 0), [savingsGoalsProgress]);

  // ─── Trends Chart B: Savings rate trend ────────────────────────────────
  const savingsRateSeries = useMemo(() => {
    return last6Months.map(month => {
      const income = getMonthTotal(transactions, month, 'income');
      const expenses = getMonthTotal(transactions, month, 'expense');
      const rate = income > 0 ? Math.max(-100, Math.min(100, ((income - expenses) / income) * 100)) : 0;
      return { month: monthLabel(month), raw: month, rate: Number(rate.toFixed(1)) };
    });
  }, [last6Months, transactions]);

  // ─── Trends Chart C: Weekday heatmap (selected month) ──────────────────
  const weekdayHeatmap = useMemo(() => {
    // Mon..Sun ordering
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const totals = [0, 0, 0, 0, 0, 0, 0];
    const topByCategory: Record<number, Record<string, number>> = {};
    monthlyTransactions.filter(t => t.type === 'expense').forEach(t => {
      const d = new Date(`${t.date}T00:00:00`);
      const jsDay = d.getDay(); // 0 Sun..6 Sat
      const idx = jsDay === 0 ? 6 : jsDay - 1; // Mon=0..Sun=6
      totals[idx] += t.amount;
      if (!topByCategory[idx]) topByCategory[idx] = {};
      topByCategory[idx][t.categoryId] = (topByCategory[idx][t.categoryId] || 0) + t.amount;
    });
    const max = Math.max(...totals, 0);
    return labels.map((label, idx) => {
      let topCat: { name: string; amount: number } | null = null;
      const cats = topByCategory[idx];
      if (cats) {
        const [catId, amt] = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
        const c = categories.find(cc => cc.id === catId);
        topCat = { name: c?.name || 'Unknown', amount: amt };
      }
      return {
        idx,
        label,
        total: totals[idx],
        intensity: max > 0 ? totals[idx] / max : 0,
        topCategory: topCat,
      };
    });
  }, [monthlyTransactions, categories]);

  // ─── Trends Chart D: Budget burn-down ──────────────────────────────────
  const burndownData = useMemo(() => {
    // Day-to-day budget for selected month (exclude commitment categories)
    const dayToDayBudget = budgets
      .filter(b => b.month === selectedMonth && !commitmentCategoryIds.has(b.categoryId))
      .reduce((s, b) => s + b.limit, 0);

    if (dayToDayBudget <= 0) return { points: [], dayToDayBudget: 0, crossoverDay: null as number | null };

    const dayToDayTxByDay: Record<number, number> = {};
    monthlyTransactions
      .filter(t => t.type === 'expense' && !commitmentCategoryIds.has(t.categoryId))
      .forEach(t => {
        const day = parseInt(t.date.slice(-2), 10);
        dayToDayTxByDay[day] = (dayToDayTxByDay[day] || 0) + t.amount;
      });

    const maxDay = selectedMonth === currentMonthKey ? today.getDate() : daysInSelectedMonth;
    let cumulative = 0;
    let crossoverDay: number | null = null;
    const points: { day: number; actual: number; ideal: number; overActual: number | null }[] = [];

    for (let day = 1; day <= daysInSelectedMonth; day++) {
      const ideal = (dayToDayBudget / daysInSelectedMonth) * day;
      if (day <= maxDay) {
        cumulative += dayToDayTxByDay[day] || 0;
        const isOver = cumulative > ideal;
        if (isOver && crossoverDay === null) crossoverDay = day;
        points.push({
          day,
          actual: Number(cumulative.toFixed(2)),
          ideal: Number(ideal.toFixed(2)),
          overActual: isOver ? Number(cumulative.toFixed(2)) : null,
        });
      } else {
        // Future days: only ideal line
        points.push({ day, actual: null as unknown as number, ideal: Number(ideal.toFixed(2)), overActual: null });
      }
    }
    return { points, dayToDayBudget, crossoverDay };
  }, [budgets, selectedMonth, monthlyTransactions, commitmentCategoryIds, currentMonthKey, today, daysInSelectedMonth]);

  // ─── Month picker options ──────────────────────────────────────────────
  const monthPickerOptions = useMemo(() => {
    const options: string[] = [];
    for (let i = 0; i <= 12; i++) {
      options.push(shiftMonth(currentMonthKey, -i));
    }
    return options;
  }, [currentMonthKey]);

  // ─── Share / export ────────────────────────────────────────────────────
  const handleShare = async () => {
    if (!overviewRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(overviewRef.current, {
        cacheBust: true,
        backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--background') || '#ffffff',
        pixelRatio: 2,
      });

      const filename = `analysis-${selectedMonth}.png`;
      const isCapacitor = typeof (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor !== 'undefined' &&
        (window as unknown as { Capacitor: { isNativePlatform?: () => boolean } }).Capacitor.isNativePlatform?.();

      if (isCapacitor) {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([
          import('@capacitor/filesystem'),
          import('@capacitor/share'),
        ]);
        const base64 = dataUrl.split(',')[1];
        const written = await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Cache,
        });
        await Share.share({
          title: 'Financial Analysis',
          text: `Analysis for ${formatMonthYear(selectedMonth)}`,
          url: written.uri,
          dialogTitle: 'Share analysis',
        });
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        link.click();
      }
    } catch (err) {
      console.error('Share failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Analytics</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Analysis</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="month-picker-trigger"
            onClick={() => setMonthPickerOpen(true)}
            className="px-3 py-1.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
            aria-label="Change month"
          >
            <div className="text-right">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">Month</p>
              <p className="text-sm font-bold text-foreground leading-tight">{formatMonthYear(selectedMonth)}</p>
            </div>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
          <button
            type="button"
            data-testid="analysis-share"
            onClick={handleShare}
            disabled={isExporting}
            className="w-9 h-9 rounded-xl border border-border bg-card text-foreground hover:bg-muted transition-colors flex items-center justify-center disabled:opacity-40"
            aria-label="Share Overview as image"
          >
            <Share2 size={15} />
          </button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full grid grid-cols-3 h-10">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-0">
          <div ref={overviewRef} className="space-y-4">
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
                    Day-to-day spend is over by {formatINR(monthlyDayToDay - monthlyBudgetTotal)}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Review category budgets and trim where possible. <span className="text-red-600 dark:text-red-400 font-semibold inline-flex items-center gap-0.5">Manage <ArrowRight size={11} /></span>
                  </p>
                </div>
              </div>
            </Link>
          )}

          <div className="bg-card border border-border rounded-2xl p-5" data-testid="monthly-budget-health">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Monthly Budget</p>
                  <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budget Health</h2>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setBudgetTooltipOpen(v => !v)}
                    onBlur={() => setTimeout(() => setBudgetTooltipOpen(false), 150)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="What counts as day-to-day spend?"
                  >
                    <Info size={14} />
                  </button>
                  {budgetTooltipOpen && (
                    <div className="absolute z-10 top-full left-0 mt-1 w-64 p-3 rounded-xl bg-popover border border-border shadow-lg text-xs text-foreground">
                      <p className="font-semibold mb-1">Day-to-day vs Commitments</p>
                      <p className="text-muted-foreground leading-relaxed">
                        Budget Health tracks day-to-day spending only. Categories marked as <span className="font-semibold text-foreground">commitments</span> (rent, EMIs, SIPs, subscriptions) are excluded — they are fixed obligations.
                      </p>
                    </div>
                  )}
                </div>
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
              <div className="rounded-xl bg-muted/50 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Day-to-day Budget</p>
                <p className="text-sm font-bold text-foreground">{formatINR(monthlyBudgetTotal)}</p>
              </div>
              <div className="rounded-xl bg-muted/50 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Day-to-day Spend</p>
                <p className={cn('text-sm font-bold', isBudgetExceeded ? 'text-red-500' : 'text-foreground')}>{formatINR(monthlyDayToDay)}</p>
              </div>
              <div className="rounded-xl bg-muted/50 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Commitments</p>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{formatINR(monthlyCommitments)}</p>
              </div>
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
              <p className="text-muted-foreground">Remaining day-to-day budget</p>
              <p className={cn('font-bold', remainingBudget >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                {formatINR(remainingBudget)}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4" data-testid="kpi-total-spent">
              <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
              <p className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatINR(monthlyExpenses)}</p>
              <p className={cn('text-xs mt-2 flex items-center gap-1 font-semibold', spentChangePct <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                {spentChangePct <= 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                {Math.abs(spentChangePct).toFixed(1)}% {spentChangePct >= 0 ? 'increased' : 'decreased'} vs last month
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4" data-testid="kpi-total-income">
              <p className="text-xs text-muted-foreground mb-1">Total Income</p>
              <p className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatINR(monthlyIncome)}</p>
              <p className={cn('text-xs mt-2 flex items-center gap-1 font-semibold', incomeChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                {incomeChangePct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(incomeChangePct).toFixed(1)}% {incomeChangePct >= 0 ? 'increased' : 'decreased'} vs last month
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4" data-testid="kpi-savings">
              <p className="text-xs text-muted-foreground mb-1">Savings</p>
              <p className={cn('text-xl font-bold', monthlySavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')} style={{ fontFamily: 'var(--font-display)' }}>
                {formatINR(monthlySavings)}
              </p>
              <p className={cn('text-xs mt-2 flex items-center gap-1 font-semibold', savingsChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                {savingsChangePct >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(savingsChangePct).toFixed(1)}% {savingsChangePct >= 0 ? 'increased' : 'decreased'} vs last month
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4" data-testid="kpi-transaction-count">
              <p className="text-xs text-muted-foreground mb-1">Transactions</p>
              <p className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{transactionCount}</p>
              <p className="text-xs mt-2 text-muted-foreground">Avg spend/day: <span className="font-semibold text-foreground">{formatINR(avgSpendPerDay)}</span></p>
            </div>
          </div>

          {biggestExpense && (
            <button
              type="button"
              onClick={() => openEditSheet(biggestExpense.transaction)}
              className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:bg-muted/40 transition-colors"
              data-testid="biggest-expense-card"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${biggestExpense.categoryColor}22` }}>
                  <CategoryIcon icon={biggestExpense.categoryIcon} color={biggestExpense.categoryColor} size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Biggest expense this month</p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {biggestExpense.transaction.note || biggestExpense.categoryName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {biggestExpense.categoryName} • {new Date(`${biggestExpense.transaction.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <p className="text-base font-bold text-red-500 flex-shrink-0">{formatINR(biggestExpense.transaction.amount)}</p>
              </div>
            </button>
          )}

          <div className="bg-card border border-border rounded-2xl p-5" data-testid="top-categories-pie">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Category Spend</p>
                <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Top 5 Categories</h2>
              </div>
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

          <div className="bg-card border border-border rounded-2xl p-5" data-testid="six-month-spending-trend-overview">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>6 Month Spending Trend</h2>
              <span className="text-xs text-muted-foreground">Current: <span className="font-semibold text-foreground">{formatINR(monthlyExpenses)}</span></span>
            </div>

            {spendingTrendData.every(d => d.spent === 0) ? (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No spending data to display</div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={spendingTrendData} barSize={28} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 11, fill: 'hsl(215, 16%, 47%)' }} />
                  <YAxis axisLine={false} tickLine={false} domain={[0, barChartYMax]} tickFormatter={formatShortINR} tick={{ fontSize: 10, fill: 'hsl(215, 16%, 47%)' }} width={44} />
                  <Tooltip formatter={(value: number) => [formatINR(value), 'Spent']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '12px' }} />
                  <Bar dataKey="spent" radius={[6, 6, 0, 0]} minPointSize={4}>
                    {spendingTrendData.map(item => (
                      <Cell key={item.raw} fill={item.raw === selectedMonth ? '#EF4444' : '#FCA5A5'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5" data-testid="budget-vs-spent-card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Execution</p>
                <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budget vs Spent</h2>
              </div>
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
        </TabsContent>

        <TabsContent value="planning" className="space-y-4 mt-0">
          {currentMonthDaysLeft <= 2 && selectedMonth === currentMonthKey && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4" data-testid="month-ending-soon">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={17} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Month ending soon</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    Only {currentMonthDaysLeft} day{currentMonthDaysLeft === 1 ? '' : 's'} left this month.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Consider transferring next month's budgets in advance. <Link href="/budgets" className="text-accent font-semibold inline-flex items-center gap-0.5 hover:underline">Go to Budgets <ArrowRight size={11} /></Link>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-[0.9fr_1.4fr] gap-4">
            <div className="bg-card border border-border rounded-2xl p-5" data-testid="daily-safe-spend">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Daily Safe to Spend</p>
                  <h2 className="text-sm font-bold text-foreground mt-1" style={{ fontFamily: 'var(--font-display)' }}>Today</h2>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <WalletCards size={17} />
                </div>
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" style={{ fontFamily: 'var(--font-display)' }}>
                {formatINR(safeToSpendPerDay)}<span className="text-sm text-muted-foreground font-semibold">/day</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Based on {formatINR(inHandBalance)} in hand across {currentMonthDaysLeft} day{currentMonthDaysLeft === 1 ? '' : 's'} left this month.
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5" data-testid="upcoming-obligations">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                    <CalendarClock size={17} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Future Visibility</p>
                    <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Upcoming Recurring Payments</h2>
                  </div>
                </div>
                <Link href="/settings/recurring" className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-0.5">
                  Manage <ArrowRight size={11} />
                </Link>
              </div>
              {upcomingObligations.length === 0 ? (
                <div className="py-5 text-sm text-muted-foreground">
                  No recurring payments configured yet.{' '}
                  <Link href="/settings/recurring" className="text-accent font-semibold hover:underline">Add one</Link> to see upcoming items here.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="grid grid-cols-[90px_1fr_110px] bg-muted/50 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                    <span>Due In</span>
                    <span>Item</span>
                    <span className="text-right">Amount</span>
                  </div>
                  <div className="divide-y divide-border">
                    {upcomingObligations.map(item => (
                      <Link
                        key={item.id}
                        href="/settings/recurring"
                        className="grid w-full grid-cols-[90px_1fr_110px] items-center gap-0 px-3 py-3 text-left hover:bg-muted/40 transition-colors"
                        data-testid={`obligation-${item.id}`}
                      >
                        <span className="text-xs font-semibold text-foreground">
                          {item.dueIn <= 0 ? 'Today' : item.dueIn === 1 ? '1 day' : `${item.dueIn} days`}
                        </span>
                        <span className="min-w-0 pr-3 flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${item.color}22` }}>
                            <CategoryIcon icon={item.icon} color={item.color} size={12} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-foreground">{item.item}</span>
                            <span className="block text-[11px] text-muted-foreground">{item.kind} • Expected {item.expectedDateLabel}</span>
                          </span>
                        </span>
                        <span className="text-right text-sm font-bold text-foreground">{formatINR(item.amount)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {projectedBalance && (
            <div className="bg-card border border-border rounded-2xl p-5" data-testid="projected-balance-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={17} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Projection</p>
                  <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Projected month-end balance</h2>
                </div>
              </div>
              <p className={cn('text-2xl font-bold', projectedBalance.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')} style={{ fontFamily: 'var(--font-display)' }}>
                {formatINR(projectedBalance.value)}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                At your current pace, you'll end the month with {formatINR(projectedBalance.value)}.
                Based on avg income {formatINR(projectedBalance.expectedIncome)} and projected remaining spend {formatINR(projectedBalance.projectedRemainingSpend)}.
              </p>
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl p-5" data-testid="budget-suggestions-card">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                <Sparkles size={17} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Next month</p>
                <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budget suggestions for {formatMonthYear(nextMonth)}</h2>
              </div>
            </div>

            {budgetSuggestions.length === 0 ? (
              <div className="py-5 text-sm text-muted-foreground">No spend in {formatMonthYear(selectedMonth)} yet. Log transactions to receive budget suggestions.</div>
            ) : (
              <>
                <div className="space-y-2">
                  {budgetSuggestions.map(s => (
                    <div key={s.categoryId} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${s.color}22` }}>
                        <CategoryIcon icon={s.icon} color={s.color} size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Actual {formatINR(s.actual)} → suggest {formatINR(s.suggestedLimit)}
                          {s.existingLimit !== null && (
                            <span className="ml-1">(current {formatINR(s.existingLimit)})</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  data-testid="apply-suggestions"
                  onClick={applySuggestions}
                  className="mt-3 w-full py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors"
                >
                  Apply suggestions to {formatMonthYear(nextMonth)}
                </button>
                {suggestionsApplied && (
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-2">
                    Suggestions applied — open the Budgets tab to review.
                  </p>
                )}
              </>
            )}
          </div>

          {visibleSavingsGoals.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5" data-testid="savings-goal-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Target size={17} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Goal Progress</p>
                  <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Savings goals</h2>
                </div>
              </div>
              <div className={cn('grid gap-4', visibleSavingsGoals.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                {visibleSavingsGoals.map(g => (
                  <div key={g.key} className="flex flex-col items-center text-center" data-testid={`savings-goal-${g.key}`}>
                    <div className="relative w-24 h-24 flex-shrink-0">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted" />
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          fill="none"
                          stroke={g.onTrack ? '#10B981' : g.color}
                          strokeWidth="10"
                          strokeLinecap="round"
                          strokeDasharray={`${(g.pct / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-base font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{g.pct.toFixed(0)}%</p>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-foreground mt-2">{g.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatINR(g.ytdContrib)} / {formatINR(g.annualGoal)}
                    </p>
                    <p className={cn('text-[10px] font-semibold mt-0.5', g.onTrack ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                      {g.onTrack ? 'On track' : 'Behind pace'}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 text-center">Year-to-date through month {visibleSavingsGoals[0]?.monthIndex} of 12. <Link href="/settings" className="text-accent font-semibold hover:underline inline-flex items-center gap-0.5">Adjust goals <ArrowRight size={10} /></Link></p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="trends" className="space-y-4 mt-0">
          <div className="bg-card border border-border rounded-2xl p-5" data-testid="income-expense-trend">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Income vs Spend - Last 6 Months</h2>
              <span className="text-xs text-muted-foreground">{formatMonthYear(selectedMonth)}</span>
            </div>

            {spendingTrendData.every(d => d.spent === 0 && d.income === 0) ? (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No trend data to display</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={spendingTrendData} barSize={18} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                    <XAxis dataKey="month" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 11, fill: 'hsl(215, 16%, 47%)' }} />
                    <YAxis axisLine={false} tickLine={false} domain={[0, barChartYMax]} tickFormatter={formatShortINR} tick={{ fontSize: 10, fill: 'hsl(215, 16%, 47%)' }} width={44} />
                    <Tooltip formatter={(value: number, name: string) => [formatINR(value), name === 'spent' ? 'Spent' : 'Income']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '12px' }} />
                    <Bar dataKey="spent" fill="#EF4444" radius={[4, 4, 0, 0]} minPointSize={4} />
                    <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} minPointSize={4} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                    <span className="text-muted-foreground">Spent</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-muted-foreground">Income</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ─── Chart B: Monthly savings rate ─── */}
          <div className="bg-card border border-border rounded-2xl p-5" data-testid="savings-rate-trend">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Monthly savings rate</h2>
              <span className="text-xs text-muted-foreground">Last 6 months</span>
            </div>
            {savingsRateSeries.every(d => d.rate === 0) ? (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No income data for the selected window</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={savingsRateSeries} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 11, fill: 'hsl(215, 16%, 47%)' }} />
                  <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: 'hsl(215, 16%, 47%)' }} width={44} />
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Savings rate']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '12px' }} />
                  <ReferenceLine y={20} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: 'Recommended 20%', fontSize: 10, fill: '#94A3B8', position: 'insideTopRight' }} />
                  <Line type="monotone" dataKey="rate" stroke="#14B8A6" strokeWidth={2.5} dot={{ r: 4, fill: '#14B8A6' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ─── Chart C: Weekday heatmap ─── */}
          <div className="bg-card border border-border rounded-2xl p-5" data-testid="weekday-heatmap">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>When do you spend most?</h2>
              <span className="text-xs text-muted-foreground">{formatMonthYear(selectedMonth)}</span>
            </div>
            {weekdayHeatmap.every(d => d.total === 0) ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">No spend recorded this month</div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-2">
                  {weekdayHeatmap.map(d => {
                    const active = selectedWeekday === d.idx;
                    const bgOpacity = 0.15 + 0.65 * d.intensity;
                    return (
                      <button
                        key={d.idx}
                        type="button"
                        onClick={() => setSelectedWeekday(prev => prev === d.idx ? null : d.idx)}
                        className={cn(
                          'aspect-square rounded-xl flex flex-col items-center justify-center text-[11px] font-semibold transition-all',
                          active ? 'ring-2 ring-accent text-foreground' : 'text-foreground'
                        )}
                        style={{ backgroundColor: `rgba(99, 102, 241, ${bgOpacity})` }}
                        data-testid={`heatmap-${d.label}`}
                      >
                        <span>{d.label}</span>
                        <span className="text-[9px] mt-0.5 opacity-80">{d.total > 0 ? formatShortINR(d.total) : '—'}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedWeekday !== null && (() => {
                  const d = weekdayHeatmap[selectedWeekday];
                  return (
                    <div className="mt-4 p-3 rounded-xl bg-muted/40 border border-border">
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{d.label}s in {formatMonthYear(selectedMonth)}</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">Total spend: {formatINR(d.total)}</p>
                      {d.topCategory && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Top category: <span className="font-semibold text-foreground">{d.topCategory.name}</span> ({formatINR(d.topCategory.amount)})
                        </p>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          {/* ─── Chart D: Budget burn-down ─── */}
          <div className="bg-card border border-border rounded-2xl p-5" data-testid="budget-burndown">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budget usage this month</h2>
              <span className="text-xs text-muted-foreground">Day-to-day only</span>
            </div>
            {burndownData.dayToDayBudget === 0 ? (
              <div className="h-32 flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                No day-to-day budget set for {formatMonthYear(selectedMonth)}.{' '}
                <Link href="/budgets" className="text-accent font-semibold hover:underline ml-1">Set budgets</Link>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={burndownData.points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(215, 16%, 47%)' }} interval={Math.ceil(burndownData.points.length / 8)} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={formatShortINR} tick={{ fontSize: 10, fill: 'hsl(215, 16%, 47%)' }} width={44} />
                    <Tooltip
                      formatter={(value: number, name: string) => [value == null ? '—' : formatINR(value), name === 'actual' ? 'Actual' : name === 'ideal' ? 'Ideal pace' : 'Over budget']}
                      labelFormatter={(day: number) => `Day ${day}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="ideal" stroke="#94A3B8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="actual" stroke="#10B981" strokeWidth={2.5} dot={false} connectNulls={false} />
                    <Line type="monotone" dataKey="overActual" stroke="#EF4444" strokeWidth={2.5} dot={false} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                    <span className="text-muted-foreground">On pace</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-500" />
                    <span className="text-muted-foreground">Over budget</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-1 bg-slate-400" />
                    <span className="text-muted-foreground">Ideal</span>
                  </div>
                </div>
                {burndownData.crossoverDay !== null && (
                  <p className="text-xs text-red-600 dark:text-red-400 font-semibold text-center mt-2">
                    You crossed the ideal pace on day {burndownData.crossoverDay}.
                  </p>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Month picker bottom sheet ─── */}
      <Sheet open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-5 max-h-[60vh] overflow-y-auto">
          <SheetHeader className="text-left mb-3 pr-8">
            <SheetTitle className="text-base" style={{ fontFamily: 'var(--font-display)' }}>Select month</SheetTitle>
            <SheetDescription>Choose any of the last 13 months.</SheetDescription>
          </SheetHeader>
          <div className="space-y-1">
            {monthPickerOptions.map(m => {
              const isActive = m === selectedMonth;
              const isCurrent = m === currentMonthKey;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setSelectedMonth(m); setMonthPickerOpen(false); }}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-colors',
                    isActive ? 'bg-accent/10 border border-accent/40' : 'border border-transparent hover:bg-muted'
                  )}
                  data-testid={`month-option-${m}`}
                >
                  <span className={cn('text-sm font-semibold', isActive ? 'text-accent' : 'text-foreground')}>
                    {formatMonthYear(m)}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Current</span>
                  )}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

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
    </div>
  );
}
