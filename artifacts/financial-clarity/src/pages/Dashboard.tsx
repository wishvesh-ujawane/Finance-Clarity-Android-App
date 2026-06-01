import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, ArrowRightLeft, Info, PiggyBank,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Tooltip as UITooltip, TooltipTrigger as UITooltipTrigger, TooltipContent as UITooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  addMonths, formatAmount, formatDateLabel, formatMonthLabel, localDateStr,
} from '@/lib/finance-utils';
import { SAVINGS_CATEGORY_IDS } from '@/lib/types';

const SAVINGS_CATEGORY_ID_SET: ReadonlySet<string> = new Set(SAVINGS_CATEGORY_IDS);

function prevMonth(month: string): string {
  return addMonths(month, -1);
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const OTHERS_SLICE_COLOR = '#9CA3AF';
const TOP_SLICE_COUNT = 6;

export default function Dashboard() {
  const {
    transactions, categories, budgets, selectedMonth, setSelectedMonth,
    getTotalIncome, getTotalExpenses, getTotalSavings, getBalance, getCarryForward, getSpentForCategory,
    openEditSheet,
  } = useFinance();

  const [, setLocation] = useLocation();
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [legendExpanded, setLegendExpanded] = useState(false);

  const balance = getBalance(selectedMonth);
  const income = getTotalIncome(selectedMonth);
  const expenses = getTotalExpenses(selectedMonth);
  const savings = getTotalSavings(selectedMonth);
  const carryForward = getCarryForward(selectedMonth);
  const netBalance = carryForward + balance;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;

  const todayKey = localDateStr(new Date());
  const isCurrentMonth = selectedMonth === todayKey.slice(0, 7);
  // Bug 6 / Bug 8: suppress savings figures when the current month has no income yet.
  const hideSavingsForZeroIncome = isCurrentMonth && income === 0;

  const monthTransactions = useMemo(
    () => transactions.filter(t => t.date.startsWith(selectedMonth)),
    [transactions, selectedMonth]
  );

  // Today's spend + avg per day (current month: through today; past months: through last day of month)
  const { todaySpend, avgPerDay } = useMemo(() => {
    const today = isCurrentMonth
      ? monthTransactions
          .filter(t => t.type === 'expense' && t.date === todayKey)
          .reduce((s, t) => s + t.amount, 0)
      : 0;
    const [yStr, mStr] = selectedMonth.split('-').map(Number);
    const monthLastDay = new Date(yStr, mStr, 0).getDate();
    const days = isCurrentMonth ? Math.max(1, new Date().getDate()) : monthLastDay;
    return { todaySpend: today, avgPerDay: expenses / days };
  }, [monthTransactions, isCurrentMonth, todayKey, selectedMonth, expenses]);

  // Income category ids (used for transaction styling + skipping in budget alerts)
  const incomeCategoryIds = useMemo(
    () => new Set(categories.filter(c => c.type === 'income').map(c => c.id)),
    [categories]
  );

  // Aggregate spending per category for the month (used by donut + alerts)
  const chartData = useMemo(() => {
    const expenseMap: Record<string, number> = {};
    monthTransactions
      .filter(t => t.type === 'expense' && !SAVINGS_CATEGORY_ID_SET.has(t.categoryId))
      .forEach(t => {
        expenseMap[t.categoryId] = (expenseMap[t.categoryId] || 0) + t.amount;
      });
    return Object.entries(expenseMap)
      .map(([catId, value]) => {
        const cat = categories.find(c => c.id === catId);
        return { name: cat?.name || 'Unknown', value, color: cat?.color || '#6366F1', catId };
      })
      .sort((a, b) => b.value - a.value);
  }, [monthTransactions, categories]);

  // Donut feed: top 6 + Others
  const donutData = useMemo(() => {
    if (chartData.length <= TOP_SLICE_COUNT) return chartData;
    const top = chartData.slice(0, TOP_SLICE_COUNT);
    const restSum = chartData.slice(TOP_SLICE_COUNT).reduce((s, e) => s + e.value, 0);
    return [...top, { name: 'Others', value: restSum, color: OTHERS_SLICE_COLOR, catId: '__others' }];
  }, [chartData]);

  // Budget totals for hero progress bar
  const budgetTotals = useMemo(() => {
    const monthly = budgets.filter(b => b.month === selectedMonth);
    const limit = monthly.reduce((s, b) => s + b.limit, 0);
    const spent = monthly.reduce((s, b) => s + getSpentForCategory(b.categoryId, selectedMonth), 0);
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    return { limit, spent, pct, count: monthly.length };
  }, [budgets, selectedMonth, getSpentForCategory]);

  // Budget alert chips: per-budget pct > 75
  const budgetAlerts = useMemo(() => {
    return budgets
      .filter(b => b.month === selectedMonth)
      .map(b => {
        const cat = categories.find(c => c.id === b.categoryId);
        const spent = getSpentForCategory(b.categoryId, selectedMonth);
        const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
        return { categoryId: b.categoryId, name: cat?.name || 'Unknown', pct, overspend: spent - b.limit };
      })
      .filter(a => a.pct > 75)
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, selectedMonth, categories, getSpentForCategory]);

  // Group recent transactions by date (last 5 dates)
  const groupedRecent = useMemo(() => {
    const sorted = [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date));
    const dateMap: Record<string, typeof sorted> = {};
    sorted.forEach(t => {
      if (!dateMap[t.date]) dateMap[t.date] = [];
      dateMap[t.date].push(t);
    });
    const dates = Object.keys(dateMap).sort((a, b) => b.localeCompare(a)).slice(0, 5);
    return dates.map(date => ({ date, transactions: dateMap[date] }));
  }, [monthTransactions]);

  const shownTxnCount = useMemo(
    () => groupedRecent.reduce((s, g) => s + g.transactions.length, 0),
    [groupedRecent]
  );

  const getCategoryById = (id: string) => categories.find(c => c.id === id);

  const budgetBarColor =
    budgetTotals.pct > 100 ? 'bg-red-400'
    : budgetTotals.pct >= 75 ? 'bg-amber-400'
    : 'bg-emerald-400';

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Overview</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Dashboard</h1>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-xl px-1 py-1" data-testid="month-selector">
          <button data-testid="prev-month" onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))} className="p-1.5 rounded-lg hover:bg-background transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-semibold text-foreground px-2 min-w-[110px] text-center">{formatMonthLabel(selectedMonth)}</span>
          <button data-testid="next-month" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} disabled={isCurrentMonth} className="p-1.5 rounded-lg hover:bg-background transition-colors disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
        {/* Balance Hero */}
        <motion.div variants={item} className="rounded-2xl bg-[hsl(222,65%,13%)] text-white p-5 relative overflow-hidden" data-testid="balance-card">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -right-4 -bottom-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />

          <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-1">Net Balance</p>
          <p
            className={cn(
              'font-bold mb-1 leading-tight',
              Math.abs(netBalance) >= 10000000 ? 'text-2xl' : Math.abs(netBalance) >= 100000 ? 'text-3xl' : 'text-4xl',
              netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'
            )}
            style={{ fontFamily: 'var(--font-display)' }}
            data-testid="balance-amount"
          >
            {formatAmount(netBalance)}
          </p>

          {/* Today's spend + avg/day */}
          <p className="text-[12px] text-white/65 mb-2 leading-tight">
            Spent {formatAmount(todaySpend)} today · avg {formatAmount(Math.round(avgPerDay))}/day
          </p>

          {/* Carry Forward */}
          {carryForward !== 0 ? (
            <div className="flex items-center gap-1.5 mb-3">
              <ArrowRightLeft size={10} className="text-white/40 flex-shrink-0" />
              <p className="text-[11px] text-white/40 leading-tight">
                Carried from {formatMonthLabel(prevMonth(selectedMonth))}:
                <span className={cn('font-semibold ml-1', carryForward >= 0 ? 'text-emerald-400/80' : 'text-red-400/80')}>
                  {formatAmount(carryForward)}
                </span>
              </p>
            </div>
          ) : (
            <div className="mb-3" />
          )}

          {/* 2×2 stats grid: Income / Expenses / Saved / Net flow (savings rate shown under Saved) */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <ArrowUp size={10} className="text-emerald-400" />
                <p className="text-[10px] text-white/50">Income</p>
              </div>
              <p className="text-sm font-bold text-emerald-400 truncate" data-testid="income-amount">{formatAmount(income)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <ArrowDown size={10} className="text-red-400" />
                <p className="text-[10px] text-white/50">Expenses</p>
              </div>
              <p className="text-sm font-bold text-red-400 truncate" data-testid="expenses-amount">{formatAmount(expenses)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <PiggyBank size={10} className="text-sky-400" />
                <p className="text-[10px] text-white/50">To savings</p>
                <UITooltip>
                  <UITooltipTrigger asChild>
                    <button type="button" className="inline-flex items-center text-white/40 hover:text-white/70" aria-label="What is To savings?">
                      <Info size={10} />
                    </button>
                  </UITooltipTrigger>
                  <UITooltipContent>Transferred to your savings goals this month.</UITooltipContent>
                </UITooltip>
              </div>
              {hideSavingsForZeroIncome ? (
                <>
                  <p className="text-sm font-bold text-white/60 truncate" data-testid="savings-amount">—</p>
                  <p className="text-[10px] mt-0.5 truncate text-white/50">Add income to see savings</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-sky-400 truncate" data-testid="savings-amount">{formatAmount(savings)}</p>
                  {income > 0 ? (
                    <p className={cn('text-[10px] mt-0.5 truncate', savingsRate >= 0 ? 'text-emerald-400/80' : 'text-red-400/80')}>
                      {savingsRate.toFixed(1)}% rate
                    </p>
                  ) : (
                    <p className="text-[10px] mt-0.5 truncate text-white/50">— rate</p>
                  )}
                </>
              )}
            </div>
            <div className={cn('transition-colors', balance < 0 && 'bg-[rgba(226,75,74,0.15)] rounded-lg px-2 py-1 -mx-2 -my-1')}>
              <div className="flex items-center gap-1 mb-0.5">
                {balance > 0
                  ? <ArrowUp size={10} className="text-emerald-400" />
                  : balance < 0
                    ? <ArrowDown size={10} className="text-red-400" />
                    : <ArrowUpDown size={10} className="text-white/50" />}
                <p className="text-[10px] text-white/50">Cash surplus / deficit</p>
                <UITooltip>
                  <UITooltipTrigger asChild>
                    <button type="button" className="inline-flex items-center text-white/40 hover:text-white/70" aria-label="What is Cash surplus / deficit?">
                      <Info size={10} />
                    </button>
                  </UITooltipTrigger>
                  <UITooltipContent>Income minus expenses. Does not include savings transfers.</UITooltipContent>
                </UITooltip>
              </div>
              <p className={cn('text-sm font-bold truncate', balance > 0 ? 'text-emerald-400' : balance < 0 ? 'text-red-400' : 'text-white')}>
                {formatAmount(balance)}
              </p>
            </div>
          </div>

          {hideSavingsForZeroIncome && (
            <p className="text-[10px] text-white/50 mt-3" data-testid="add-income-hint">Add this month's income for accurate figures.</p>
          )}

          {/* Budget progress (only when budgets exist for this month) */}
          {budgetTotals.limit > 0 && (
            <button
              type="button"
              onClick={() => setLocation('/budgets')}
              className="mt-4 w-full text-left group"
              data-testid="hero-budget-bar"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-white/60">
                  Budget · {formatAmount(budgetTotals.spent)} of {formatAmount(budgetTotals.limit)}
                </span>
                <span className="text-[11px] font-semibold text-white/80">{Math.round(budgetTotals.pct)}%</span>
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', budgetBarColor)}
                  style={{ width: `${Math.min(budgetTotals.pct, 100)}%` }}
                />
              </div>
            </button>
          )}
        </motion.div>

        {/* Budget Alert Strip (only if any chip) */}
        {budgetAlerts.length > 0 && (
          <motion.div variants={item} className="-mx-4 px-4 md:mx-0 md:px-0" data-testid="budget-alerts-strip">
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {budgetAlerts.map(alert => {
                const over = alert.pct > 100;
                const chipClass = over
                  ? 'bg-[#FCEBEB] text-[#A32D2D]'
                  : 'bg-[#FAEEDA] text-[#854F0B]';
                const label = over
                  ? `🔴 ${alert.name} +${formatAmount(alert.overspend)}`
                  : `🟡 ${alert.name} ${Math.round(alert.pct)}%`;
                return (
                  <button
                    key={alert.categoryId}
                    type="button"
                    onClick={() => setLocation(`/budgets?highlight=${encodeURIComponent(alert.categoryId)}`)}
                    className={cn(
                      'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap hover:opacity-90 transition-opacity',
                      chipClass,
                    )}
                    data-testid={`budget-alert-${alert.categoryId}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Spending Chart */}
        <motion.div variants={item} className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>Spending by Category</h2>
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm font-medium">No expenses recorded</p>
              <p className="text-xs mt-1">Add a transaction to see your spending breakdown</p>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="w-full md:w-1/2 h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      onMouseEnter={(_, index) => setHoveredCategory(donutData[index]?.catId ?? null)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      {donutData.map(entry => (
                        <Cell key={entry.catId} fill={entry.color} opacity={hoveredCategory && hoveredCategory !== entry.catId ? 0.45 : 1} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatAmount(value), '']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {chartData.slice(0, legendExpanded ? chartData.length : TOP_SLICE_COUNT).map(entry => (
                    <div
                      key={entry.catId}
                      className={cn('flex items-center gap-2 transition-opacity', hoveredCategory && hoveredCategory !== entry.catId ? 'opacity-40' : 'opacity-100')}
                      onMouseEnter={() => setHoveredCategory(entry.catId)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-[13px] text-foreground flex-1 leading-tight">{entry.name}</span>
                      <span className="text-[13px] font-medium text-foreground">{formatAmount(entry.value)}</span>
                    </div>
                  ))}
                </div>
                {chartData.length > TOP_SLICE_COUNT && (
                  <button
                    type="button"
                    onClick={() => setLegendExpanded(v => !v)}
                    className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="legend-toggle"
                  >
                    {legendExpanded ? 'Collapse' : `Expand (${chartData.length - TOP_SLICE_COUNT} more)`}
                  </button>
                )}
                <div className="mt-3 pt-2 border-t border-border flex justify-between">
                  <span className="text-xs font-bold text-foreground">Total</span>
                  <span className="text-xs font-bold text-foreground">{formatAmount(expenses)}</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Recent Transactions — grouped by date */}
        <motion.div variants={item} className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
            Recent Transactions ({monthTransactions.length} this month)
          </h2>
          {groupedRecent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm font-medium">No transactions this month</p>
              <p className="text-xs mt-1">Tap the + button to add your first transaction</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {groupedRecent.map(({ date, transactions: dayTxns }) => (
                  <div key={date}>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{formatDateLabel(date)}</p>
                    <div className="space-y-1">
                      {dayTxns.map(t => {
                        const cat = getCategoryById(t.categoryId);
                        const isIncome = t.type === 'income' || incomeCategoryIds.has(t.categoryId);
                        return (
                          <div
                            key={t.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => openEditSheet(t)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openEditSheet(t);
                              }
                            }}
                            className={cn(
                              'group flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/60 transition-colors cursor-pointer',
                              isIncome && 'border-l-[3px] border-[#1D9E75] bg-[rgba(29,158,117,0.04)]',
                            )}
                            data-testid={`transaction-${t.id}`}
                          >
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: (cat?.color || '#6366F1') + '22' }}
                            >
                              <CategoryIcon icon={cat?.icon || 'DollarSign'} color={cat?.color || '#6366F1'} size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{cat?.name || 'Unknown'}</p>
                              {t.note && <p className="text-xs text-muted-foreground truncate">{t.note}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {(() => {
                                const isSavings = t.type === 'expense' && SAVINGS_CATEGORY_ID_SET.has(t.categoryId);
                                const colorClass = t.type === 'income'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isSavings
                                    ? 'text-sky-600 dark:text-sky-400'
                                    : 'text-red-500 dark:text-red-400';
                                const prefix = t.type === 'income' ? '+' : isSavings ? '↗' : '−';
                                return (
                                  <span className={cn('text-sm font-bold', colorClass)}>
                                    {prefix}{formatAmount(t.amount)}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {monthTransactions.length > shownTxnCount && (
                <button
                  type="button"
                  onClick={() => setLocation('/transactions')}
                  className="block mx-auto mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="view-all-transactions"
                >
                  View all {monthTransactions.length} transactions →
                </button>
              )}
            </>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
