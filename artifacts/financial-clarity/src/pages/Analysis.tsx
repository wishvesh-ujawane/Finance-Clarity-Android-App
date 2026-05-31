import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowDownRight, ArrowUpRight, CalendarClock, Sparkles, WalletCards } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatINR, formatShortINR, localDateStr } from '@/lib/finance-utils';

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

function classifyObligation(label: string) {
  const normalized = label.toLowerCase();
  if (/\b(emi|loan|mortgage)\b/.test(normalized)) return 'EMI';
  if (/\b(credit|card|cc|statement)\b/.test(normalized)) return 'Credit card';
  if (/\b(subscription|sub|netflix|prime|spotify|hotstar|youtube|icloud)\b/.test(normalized)) return 'Subscription';
  if (/\b(sip|mutual fund|mf|investment)\b/.test(normalized)) return 'SIP';
  if (/\b(bill|electricity|water|gas|phone|mobile|internet|wifi|broadband|rent)\b/.test(normalized)) return 'Bill';
  return 'Bill';
}

function daysUntil(dateStr: string, today: Date) {
  const target = new Date(`${dateStr}T00:00:00`);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((target.getTime() - start.getTime()) / 86400000);
}

export default function Analysis() {
  const { transactions, categories, budgets, selectedMonth, openEditSheet } = useFinance();
  const [allCategoriesOpen, setAllCategoriesOpen] = useState(false);

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
  const remainingBudget = monthlyBudgetTotal - monthlyExpenses;
  const spentPct = monthlyBudgetTotal > 0 ? (monthlyExpenses / monthlyBudgetTotal) * 100 : 0;

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

  const smartInsights = useMemo(() => {
    const spendingLine = previousExpenses > 0
      ? `Spending is ${spentChangePct >= 0 ? 'up' : 'down'} ${Math.abs(spentChangePct).toFixed(1)}% vs last month${topCategory ? `, led by ${topCategory.name}.` : '.'}`
      : monthlyExpenses > 0
        ? `You started logging spend in ${selectedMonth}; keep tracking to unlock richer trends.`
        : 'No spend logged this month yet. Add transactions to unlock spend insights.';

    const savingsLine = previousIncome > 0 || monthlyIncome > 0
      ? `Savings moved from ${Math.max(0, previousSavingsRate).toFixed(1)}% to ${Math.max(0, monthlySavingsRate).toFixed(1)}% (${savingsChangePct >= 0 ? '+' : ''}${savingsChangePct.toFixed(1)}%).`
      : 'Add income transactions to compute a meaningful savings trend.';

    const weeklyLine = weeklyInsight.previous4WeekAvg > 0
      ? `Weekly spend is ${weeklyInsight.deltaPct >= 0 ? 'up' : 'down'} ${Math.abs(weeklyInsight.deltaPct).toFixed(1)}% vs your previous 4-week average.`
      : weeklyInsight.thisWeekSpend > 0
        ? 'This week has your first recorded spending block in the 5-week window.'
        : 'No weekly spend spike detected yet due to limited recent expense data.';

    return [spendingLine, savingsLine, weeklyLine];
  }, [
    previousExpenses,
    spentChangePct,
    topCategory,
    monthlyExpenses,
    selectedMonth,
    previousIncome,
    monthlyIncome,
    previousSavingsRate,
    monthlySavingsRate,
    savingsChangePct,
    weeklyInsight,
  ]);

  const inHandBalance = useMemo(() => {
    return transactions
      .filter(t => t.date <= todayStr)
      .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
  }, [transactions, todayStr]);
  const currentMonthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currentMonthDaysLeft = Math.max(1, currentMonthDays - today.getDate() + 1);
  const safeToSpendPerDay = Math.max(0, inHandBalance / currentMonthDaysLeft);

  const upcomingObligations = useMemo(() => {
    return transactions
      .filter(t => t.type === 'expense' && t.date >= todayStr)
      .map(t => {
        const category = categories.find(c => c.id === t.categoryId);
        const label = t.note || category?.name || 'Upcoming payment';
        return {
          id: t.id,
          dueIn: daysUntil(t.date, today),
          item: label,
          kind: classifyObligation(`${label} ${category?.name || ''}`),
          amount: t.amount,
          transaction: t,
        };
      })
      .filter(item => item.dueIn >= 0 && item.dueIn <= 45)
      .sort((a, b) => a.dueIn - b.dueIn || b.amount - a.amount)
      .slice(0, 5);
  }, [transactions, categories, todayStr, today]);

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Analytics</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Analysis</h1>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Month</p>
          <p className="text-sm font-bold text-foreground">{selectedMonth}</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full grid grid-cols-3 h-10">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="planning">Planning</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-0">
          <div className="bg-card border border-border rounded-2xl p-5" data-testid="monthly-budget-health">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Monthly Budget</p>
                <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budget Health</h2>
              </div>
              <span className={cn('text-sm font-semibold', monthlyBudgetTotal > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                {monthlyBudgetTotal > 0 ? `${Math.min(spentPct, 999).toFixed(1)}% spent` : 'No budget configured'}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl bg-muted/50 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Total Budget</p>
                <p className="text-sm font-bold text-foreground">{formatINR(monthlyBudgetTotal)}</p>
              </div>
              <div className="rounded-xl bg-muted/50 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Total Expenses</p>
                <p className="text-sm font-bold text-red-500">{formatINR(monthlyExpenses)}</p>
              </div>
              <div className="rounded-xl bg-muted/50 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Total Income</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatINR(monthlyIncome)}</p>
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
              <p className="text-muted-foreground">Remaining budget</p>
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
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={top5Categories} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={86} paddingAngle={2}>
                        {top5Categories.map(item => (
                          <Cell key={item.categoryId} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [formatINR(value), 'Spent']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  {top5Categories.map(item => (
                    <div key={item.categoryId} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
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
                    </div>
                  ))}
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
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(215, 16%, 47%)' }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={formatShortINR} tick={{ fontSize: 10, fill: 'hsl(215, 16%, 47%)' }} width={44} />
                  <Tooltip formatter={(value: number) => [formatINR(value), 'Spent']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '12px' }} />
                  <Bar dataKey="spent" radius={[6, 6, 0, 0]}>
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
              <div className="py-8 text-sm text-muted-foreground">No budgets set for {selectedMonth}. Add budgets to compare category performance.</div>
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
              {smartInsights.map((line, index) => (
                <p key={index} className="text-sm text-foreground leading-relaxed">{line}</p>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="planning" className="space-y-4 mt-0">
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
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                  <CalendarClock size={17} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Future Visibility</p>
                  <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Upcoming Financial Obligations</h2>
                </div>
              </div>
              {upcomingObligations.length === 0 ? (
                <div className="py-5 text-sm text-muted-foreground">No upcoming EMIs, credit card dues, subscriptions, bills, or SIPs found in future transactions.</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="grid grid-cols-[72px_1fr_96px] bg-muted/50 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                    <span>Due In</span>
                    <span>Item</span>
                    <span className="text-right">Amount</span>
                  </div>
                  <div className="divide-y divide-border">
                    {upcomingObligations.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openEditSheet(item.transaction)}
                        className="grid w-full grid-cols-[72px_1fr_96px] items-center gap-0 px-3 py-3 text-left hover:bg-muted/40 transition-colors"
                        data-testid={`obligation-${item.id}`}
                      >
                        <span className="text-xs font-semibold text-foreground">
                          {item.dueIn === 0 ? 'Today' : item.dueIn === 1 ? '1 day' : `${item.dueIn} days`}
                        </span>
                        <span className="min-w-0 pr-3">
                          <span className="block truncate text-sm font-medium text-foreground">{item.item}</span>
                          <span className="block text-[11px] text-muted-foreground">{item.kind}</span>
                        </span>
                        <span className="text-right text-sm font-bold text-foreground">{formatINR(item.amount)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4 mt-0">
          <div className="bg-card border border-border rounded-2xl p-5" data-testid="income-expense-trend">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Income vs Spend - Last 6 Months</h2>
              <span className="text-xs text-muted-foreground">{selectedMonth}</span>
            </div>

            {spendingTrendData.every(d => d.spent === 0 && d.income === 0) ? (
              <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No trend data to display</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={spendingTrendData} barSize={18} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(215, 16%, 47%)' }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={formatShortINR} tick={{ fontSize: 10, fill: 'hsl(215, 16%, 47%)' }} width={44} />
                  <Tooltip formatter={(value: number, name: string) => [formatINR(value), name === 'spent' ? 'Spent' : 'Income']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '12px' }} />
                  <Bar dataKey="spent" fill="#EF4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Sheet open={allCategoriesOpen} onOpenChange={setAllCategoriesOpen}>
        <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto rounded-t-2xl p-5">
          <SheetHeader className="text-left mb-4 pr-8">
            <SheetTitle className="text-base" style={{ fontFamily: 'var(--font-display)' }}>
              Category Spend Breakdown
            </SheetTitle>
            <SheetDescription>
              All categories for {selectedMonth} with spend percentage
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
