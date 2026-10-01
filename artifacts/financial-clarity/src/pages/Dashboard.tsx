import { useMemo } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, ArrowRightLeft, CreditCard,
} from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { useDefaultFabMenu } from '@/hooks/useDefaultFabMenu';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ConnectDriveBanner } from '@/components/ConnectDriveBanner';
import { MonthEndReviewBanner } from '@/components/MonthEndReviewBanner';
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

export default function Dashboard() {
  const {
    transactions, categories, budgets, selectedMonth, setSelectedMonth,
    getTotalIncome, getTotalExpenses, getBalance, getCarryForward, getNetBalanceToDate, getOutstandingCardBalance, getSpentForCategory,
    getTotalCommitments, getTotalDayToDay, getTotalSavings,
    openEditSheet, openSheet,
  } = useFinance();

  useDefaultFabMenu();

  const [, setLocation] = useLocation();

  // Pocket cash through today — month-agnostic, identical on every month tab.
  const netBalance = getNetBalanceToDate();
  // Outstanding credit-card balance — never month-scoped. Shown as a chip
  // only when > 0. Scope: as accurate as SMS-tagged / manually-tagged data.
  const cardDebt = getOutstandingCardBalance();
  // Per-month figures (these DO change with the month picker).
  const balance = getBalance(selectedMonth);
  const income = getTotalIncome(selectedMonth);
  const expenses = getTotalExpenses(selectedMonth);
  const carryForward = getCarryForward(selectedMonth);

  const todayKey = localDateStr(new Date());
  const isCurrentMonth = selectedMonth === todayKey.slice(0, 7);

  const monthTransactions = useMemo(
    () => transactions.filter(t => t.date.startsWith(selectedMonth)),
    [transactions, selectedMonth]
  );

  // Today's spend + avg per day (current month: through today; past months: through last day of month)
  // Excludes savings-category transactions — those are transfers, not spend.
  const { todaySpend, avgPerDay } = useMemo(() => {
    const today = isCurrentMonth
      ? monthTransactions
          .filter(t => t.type === 'expense' && !SAVINGS_CATEGORY_ID_SET.has(t.categoryId) && t.date === todayKey)
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

  // Three-bucket outflow breakdown for the "Where did your money go?" card.
  const monthDayToDay = getTotalDayToDay(selectedMonth);
  const monthCommitments = getTotalCommitments(selectedMonth);
  const monthSavings = getTotalSavings(selectedMonth);
  const bucketTotal = monthDayToDay + monthCommitments + monthSavings;
  const bucketRows = useMemo(() => {
    const safePct = (v: number) => (bucketTotal > 0 ? (v / bucketTotal) * 100 : 0);
    return [
      {
        key: 'day-to-day' as const,
        label: 'Day-to-day',
        value: monthDayToDay,
        pct: safePct(monthDayToDay),
        href: '/transactions',
        barClass: 'bg-amber-500',
        dotClass: 'bg-amber-500',
        amountClass: 'text-foreground',
      },
      {
        key: 'commitments' as const,
        label: 'Commitments',
        value: monthCommitments,
        pct: safePct(monthCommitments),
        href: '/transactions',
        barClass: 'bg-indigo-500',
        dotClass: 'bg-indigo-500',
        amountClass: 'text-indigo-600 dark:text-indigo-400',
      },
      {
        key: 'savings' as const,
        label: 'Savings',
        value: monthSavings,
        pct: safePct(monthSavings),
        href: '/transactions',
        barClass: 'bg-sky-500',
        dotClass: 'bg-sky-500',
        amountClass: 'text-sky-600 dark:text-sky-400',
      },
    ];
  }, [monthDayToDay, monthCommitments, monthSavings, bucketTotal]);

  // Budget alert chips: per-budget pct > 75. For commitment and savings
  // categories, hitting 100% is GOOD (fully paid / fully funded) so those
  // chips render green instead of amber/red.
  const budgetAlerts = useMemo(() => {
    return budgets
      .filter(b => b.month === selectedMonth)
      .map(b => {
        const cat = categories.find(c => c.id === b.categoryId);
        const spent = getSpentForCategory(b.categoryId, selectedMonth);
        const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
        return {
          categoryId: b.categoryId,
          name: cat?.name || 'Unknown',
          categoryType: cat?.type,
          pct,
          overspend: spent - b.limit,
        };
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

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <MonthEndReviewBanner />
      <ConnectDriveBanner />
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

          <p className="text-xs text-white/50 font-medium uppercase tracking-wider mb-1">Lifetime balance</p>
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

          {cardDebt > 0 && (
            <div
              className="inline-flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1 mb-2"
              data-testid="card-debt-chip"
            >
              <CreditCard size={11} className="text-white/70" />
              <span className="text-[11px] font-semibold text-white/90">
                {formatAmount(cardDebt)} on your card
              </span>
            </div>
          )}

          {/* Today's spend + avg/day */}
          <p className="text-[12px] text-white/65 mb-3 leading-tight">
            Spent {formatAmount(todaySpend)} today · avg {formatAmount(Math.round(avgPerDay))}/day
          </p>

          {/* 2×2 stats grid: Income / Expenses / Carry-forward / {Month} Balance */}
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
                <ArrowRightLeft size={10} className="text-white/50" />
                <p className="text-[10px] text-white/50">Carry-forward</p>
              </div>
              <p className={cn('text-sm font-bold truncate', carryForward > 0 ? 'text-emerald-400' : carryForward < 0 ? 'text-red-400' : 'text-white/70')}>
                {formatAmount(carryForward)}
              </p>
              <p className="text-[10px] text-white/50 mt-0.5 truncate">from {formatMonthLabel(prevMonth(selectedMonth))}</p>
            </div>
            <div className={cn('transition-colors', balance < 0 && 'bg-[rgba(226,75,74,0.15)] rounded-lg px-2 py-1 -mx-2 -my-1')}>
              <div className="flex items-center gap-1 mb-0.5">
                {balance > 0
                  ? <ArrowUp size={10} className="text-emerald-400" />
                  : balance < 0
                    ? <ArrowDown size={10} className="text-red-400" />
                    : <ArrowUpDown size={10} className="text-white/50" />}
                <p className="text-[10px] text-white/50 truncate">{formatMonthLabel(selectedMonth)} balance</p>
              </div>
              <p
                className={cn('text-sm font-bold truncate', balance > 0 ? 'text-emerald-400' : balance < 0 ? 'text-red-400' : 'text-white')}
                data-testid="month-net-balance-amount"
              >
                {formatAmount(balance)}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Budget Alert Strip (only if any chip) */}
        {budgetAlerts.length > 0 && (
          <motion.div variants={item} className="-mx-4 px-4 md:mx-0 md:px-0" data-testid="budget-alerts-strip">
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {budgetAlerts.map(alert => {
                const over = alert.pct > 100;
                const isGoalBucket = alert.categoryType === 'commitment' || alert.categoryType === 'savings';
                // Commitments/savings at 100% = "fully paid" / "fully funded"
                // = green. At >100% they're still a goal met (never red). For
                // 75–99%, show a neutral "almost there" chip.
                const chipClass = isGoalBucket
                  ? (alert.pct >= 100 ? 'bg-[#E6F4EC] text-[#1D7A4E]' : 'bg-[#EAF0FB] text-[#1E3A8A]')
                  : (over ? 'bg-[#FCEBEB] text-[#A32D2D]' : 'bg-[#FAEEDA] text-[#854F0B]');
                const label = isGoalBucket
                  ? (alert.pct >= 100
                      ? `🟢 ${alert.name} ${alert.categoryType === 'savings' ? 'funded' : 'paid'}`
                      : `🔵 ${alert.name} ${Math.round(alert.pct)}%`)
                  : (over
                      ? `🔴 ${alert.name} +${formatAmount(alert.overspend)}`
                      : `🟡 ${alert.name} ${Math.round(alert.pct)}%`);
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

        {/* Where did your money go? — three buckets (day-to-day / commitments / savings)
            Replaces the former Spending-by-Category donut, which moved to Analysis so
            users can filter it by period. This view keeps the Dashboard focused on the
            three-bucket mental model instead of 10+ category slices. */}
        <motion.div variants={item} className="bg-card border border-border rounded-2xl p-5" data-testid="bucket-breakdown">
          <h2 className="text-sm font-bold text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>
            Where did your money go?
          </h2>
          {bucketTotal === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm font-medium">No outflow recorded this month</p>
              <p className="text-xs mt-1">Add a transaction to see your breakdown</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bucketRows.map(row => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setLocation(row.href)}
                  className="w-full text-left group"
                  data-testid={`bucket-row-${row.key}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', row.dotClass)} aria-hidden />
                      <span className="text-sm font-medium text-foreground truncate">{row.label}</span>
                      <span className="text-[11px] text-muted-foreground flex-shrink-0">{Math.round(row.pct)}%</span>
                    </div>
                    <span className={cn('text-sm font-bold flex-shrink-0', row.amountClass)}>
                      {formatAmount(row.value)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', row.barClass)}
                      style={{ width: `${Math.max(2, Math.min(100, row.pct))}%` }}
                    />
                  </div>
                </button>
              ))}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total outflow</span>
                <span className="text-sm font-bold text-foreground">{formatAmount(bucketTotal)}</span>
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
