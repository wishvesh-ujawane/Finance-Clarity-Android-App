import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Sparkles, WalletCards } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatDateLabel, formatINR, formatShortINR, localDateStr } from '@/lib/finance-utils';

function getLast6Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('en-IN', { month: 'short' });
}

// Shared helper for month-wise totals used across multiple insight widgets.
function getMonthTotal(transactions: ReturnType<typeof useFinance>['transactions'], month: string, type: 'expense' | 'income') {
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
  const { transactions, categories, openEditSheet } = useFinance();
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const last6Months = useMemo(() => getLast6Months(), []);
  const currentMonth = last6Months[last6Months.length - 1];

  const chartData = useMemo(() => {
    return last6Months.map(month => {
      const total = transactions
        .filter(t => t.type === viewType && t.date.startsWith(month))
        .reduce((sum, t) => sum + t.amount, 0);
      return { month: monthLabel(month), value: total, raw: month };
    });
  }, [transactions, viewType, last6Months]);

  const categoryBreakdown = useMemo(() => {
    const allOfType = transactions.filter(t => t.type === viewType);
    const total = allOfType.reduce((s, t) => s + t.amount, 0);
    const map: Record<string, number> = {};
    allOfType.forEach(t => { map[t.categoryId] = (map[t.categoryId] || 0) + t.amount; });
    return Object.entries(map)
      .map(([catId, amount]) => {
        const cat = categories.find(c => c.id === catId);
        return { catId, cat, amount, pct: total > 0 ? (amount / total) * 100 : 0 };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, categories, viewType]);

  const selectedCategory = useMemo(
    () => categories.find(c => c.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const selectedTransactions = useMemo(
    () => selectedCategoryId
      ? transactions
          .filter(t => t.type === viewType && t.categoryId === selectedCategoryId)
          .sort((a, b) => b.date.localeCompare(a.date))
      : [],
    [transactions, selectedCategoryId, viewType]
  );

  const totalThisMonth = useMemo(() =>
    transactions.filter(t => t.type === viewType && t.date.startsWith(currentMonth)).reduce((s, t) => s + t.amount, 0),
    [transactions, viewType, currentMonth]
  );
  const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalExpenses = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions]);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  // Narrative card data comparing current vs previous month and highlighting top expense drivers.
  const monthlyInsight = useMemo(() => {
    const previousMonth = last6Months[last6Months.length - 2];
    const currentExpenses = getMonthTotal(transactions, currentMonth, 'expense');
    const previousExpenses = getMonthTotal(transactions, previousMonth, 'expense');
    const currentIncome = getMonthTotal(transactions, currentMonth, 'income');
    const previousIncome = getMonthTotal(transactions, previousMonth, 'income');
    const currentSavingsRate = currentIncome > 0 ? ((currentIncome - currentExpenses) / currentIncome) * 100 : 0;
    const previousSavingsRate = previousIncome > 0 ? ((previousIncome - previousExpenses) / previousIncome) * 100 : 0;
    const expenseChangePct = previousExpenses > 0
      ? ((currentExpenses - previousExpenses) / previousExpenses) * 100
      : currentExpenses > 0 ? 100 : 0;

    const currentExpenseMap = getExpenseMapForMonth(transactions, currentMonth);
    const previousExpenseMap = getExpenseMapForMonth(transactions, previousMonth);
    const topIncreases = Object.entries(currentExpenseMap)
      .map(([catId, amount]) => ({
        catId,
        amount,
        increase: amount - (previousExpenseMap[catId] || 0),
        category: categories.find(c => c.id === catId),
      }))
      .filter(item => item.increase > 0)
      .sort((a, b) => b.increase - a.increase)
      .slice(0, 2);

    const changeWord = expenseChangePct > 0.5 ? 'increased' : expenseChangePct < -0.5 ? 'decreased' : 'stayed flat';
    const sourceText = topIncreases.length > 0
      ? `Most increase came from ${topIncreases.map(item => item.category?.name || 'Unknown').join(' and ')}.`
      : currentExpenses > 0 ? 'No single category created a major spike this month.' : 'Add this month\'s expenses to unlock category drivers.';

    return {
      currentExpenses,
      previousExpenses,
      currentSavingsRate,
      previousSavingsRate,
      lines: [
        previousExpenses > 0
          ? `Your spending ${changeWord} by ${Math.abs(expenseChangePct).toFixed(0)}% compared to last month.`
          : currentExpenses > 0 ? 'This is your first month with spending data in this comparison window.' : 'No spending recorded this month yet.',
        sourceText,
        previousIncome > 0 || currentIncome > 0
          ? `Your savings rate moved from ${Math.max(0, previousSavingsRate).toFixed(0)}% -> ${Math.max(0, currentSavingsRate).toFixed(0)}%.`
          : 'Add income to calculate your savings rate trend.',
      ],
    };
  }, [transactions, categories, currentMonth, last6Months]);

  // Safe-to-spend is based on money in hand from all recorded history up to today.
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => localDateStr(today), [today]);
  const inHandBalance = useMemo(() => {
    return transactions
      .filter(t => t.date <= todayStr)
      .reduce((sum, t) => sum + (t.type === 'income' ? t.amount : -t.amount), 0);
  }, [transactions, todayStr]);
  const remainingBalance = inHandBalance;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeftInMonth = Math.max(1, daysInMonth - today.getDate() + 1);
  const safeToSpendPerDay = Math.max(0, remainingBalance / daysLeftInMonth);

  // Future obligations are inferred from future-dated expense transactions and note/category keywords.
  const upcomingObligations = useMemo(() => {
    return transactions
      .filter(t => t.type === 'expense' && t.date >= todayStr)
      .map(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        const label = t.note || cat?.name || 'Upcoming payment';
        return {
          id: t.id,
          dueIn: daysUntil(t.date, today),
          item: label,
          kind: classifyObligation(`${label} ${cat?.name || ''}`),
          amount: t.amount,
          transaction: t,
        };
      })
      .filter(item => item.dueIn >= 0 && item.dueIn <= 45)
      .sort((a, b) => a.dueIn - b.dueIn || b.amount - a.amount)
      .slice(0, 5);
  }, [transactions, categories, today, todayStr]);

  const accentColor = viewType === 'expense' ? '#EF4444' : '#10B981';

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Breakdown</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Analysis</h1>
        </div>
        <div className="flex rounded-xl bg-muted p-1" data-testid="analysis-toggle">
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              data-testid={`toggle-${t}`}
              onClick={() => {
                setViewType(t);
                setSelectedCategoryId(null);
              }}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize',
                viewType === t
                  ? t === 'expense' ? 'bg-red-500 text-white shadow' : 'bg-emerald-500 text-white shadow'
                  : 'text-muted-foreground'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Income', value: formatINR(totalIncome), color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Total Expenses', value: formatINR(totalExpenses), color: 'text-red-500 dark:text-red-400' },
          { label: 'Net Savings', value: formatINR(totalIncome - totalExpenses), color: (totalIncome - totalExpenses) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500' },
          { label: 'Savings Rate', value: `${Math.max(0, savingsRate).toFixed(1)}%`, color: savingsRate >= 0 ? 'text-accent' : 'text-red-500' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="bg-card border border-border rounded-2xl p-4" data-testid={`stat-${stat.label.toLowerCase().replace(/ /g, '-')}`}>
            <p className="text-[11px] text-muted-foreground mb-1">{stat.label}</p>
            <p className={cn('text-lg font-bold', stat.color)} style={{ fontFamily: 'var(--font-display)' }}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* This Month Financial Summary */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-2xl p-5 mb-4" data-testid="monthly-ai-summary">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center flex-shrink-0">
            <Sparkles size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">AI Card</p>
            <h2 className="text-sm font-bold text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>This Month Financial Summary</h2>
            <div className="space-y-2">
              {monthlyInsight.lines.map(line => (
                <p key={line} className="text-sm text-foreground leading-relaxed">{line}</p>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid md:grid-cols-[0.9fr_1.4fr] gap-4 mb-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="bg-card border border-border rounded-2xl p-5" data-testid="daily-safe-spend">
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
            Based on {formatINR(remainingBalance)} in hand across {daysLeftInMonth} day{daysLeftInMonth === 1 ? '' : 's'} left this month.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }} className="bg-card border border-border rounded-2xl p-5" data-testid="upcoming-obligations">
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
        </motion.div>
      </div>

      {/* Bar Chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            {viewType === 'expense' ? 'Spending' : 'Income'} - Last 6 Months
          </h2>
          <span className="text-xs text-muted-foreground">
            This month: <span className="font-semibold text-foreground">{formatINR(totalThisMonth)}</span>
          </span>
        </div>
        {chartData.every(d => d.value === 0) ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No {viewType} data to display</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={28} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(215, 16%, 47%)' }} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={formatShortINR} tick={{ fontSize: 10, fill: 'hsl(215, 16%, 47%)' }} width={40} />
              <Tooltip formatter={(value: number) => [formatINR(value), viewType === 'expense' ? 'Spent' : 'Earned']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '12px' }} cursor={{ fill: 'hsl(214, 32%, 91%)', radius: 6 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map(entry => (
                  <Cell key={entry.raw} fill={entry.raw === currentMonth ? accentColor : accentColor + '50'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Category Breakdown */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>By Category - All Time</h2>
        {categoryBreakdown.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">No {viewType} transactions recorded</div>
        ) : (
          <div className="space-y-2 -mx-2">
            {categoryBreakdown.map(({ catId, cat, amount, pct }, i) => (
              <motion.button
                key={catId}
                type="button"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.04 }}
                onClick={() => setSelectedCategoryId(catId)}
                className="w-full space-y-2 text-left rounded-xl px-4 py-3 transition-colors hover:bg-muted/40"
                data-testid={`breakdown-${catId}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (cat?.color || '#6366F1') + '22' }}>
                      <CategoryIcon icon={cat?.icon || 'DollarSign'} color={cat?.color || '#6366F1'} size={14} />
                    </div>
                    <span className="text-[15px] text-foreground font-medium">{cat?.name || 'Unknown'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold text-foreground">{formatINR(amount)}</span>
                    <span className="text-xs text-muted-foreground ml-2">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: cat?.color || accentColor }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 + i * 0.04 }} />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Category transactions now open in a compact bottom sheet instead of inline expansion. */}
      <Sheet open={selectedCategoryId !== null} onOpenChange={open => !open && setSelectedCategoryId(null)}>
        <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto rounded-t-2xl p-5">
          <SheetHeader className="text-left mb-4 pr-8">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (selectedCategory?.color || accentColor) + '22' }}>
                <CategoryIcon icon={selectedCategory?.icon || 'DollarSign'} color={selectedCategory?.color || accentColor} size={16} />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-base truncate" style={{ fontFamily: 'var(--font-display)' }}>
                  {selectedCategory?.name || 'Unknown'} Transactions
                </SheetTitle>
                <SheetDescription className="capitalize">
                  {viewType} - {selectedTransactions.length} record{selectedTransactions.length === 1 ? '' : 's'}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {selectedTransactions.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">No transactions in this category</div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {selectedTransactions.map(transaction => (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => openEditSheet(transaction)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                  data-testid={`analysis-transaction-${transaction.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{formatDateLabel(transaction.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    {transaction.note && <p className="text-xs text-muted-foreground truncate">{transaction.note}</p>}
                  </div>
                  <span className={cn('text-sm font-bold flex-shrink-0', transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                    {transaction.type === 'income' ? '+' : '-'}{formatINR(transaction.amount)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
