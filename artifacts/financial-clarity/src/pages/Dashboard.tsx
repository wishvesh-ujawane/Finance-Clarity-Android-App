import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Trash2, Pencil, ArrowUpRight, ArrowDownLeft, ArrowRightLeft } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

// Compact formatter for large amounts — keeps cards from overflowing
function formatINRCompact(amount: number) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  return formatINR(amount);
}

function formatMonthLabel(month: string) {
  const [year, m] = month.split('-');
  return new Date(parseInt(year), parseInt(m) - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const yestISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (dateStr === todayISO) return 'Today';
  if (dateStr === yestISO) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function addMonths(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(year, m - 1 + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function prevMonth(month: string): string {
  return addMonths(month, -1);
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const {
    transactions, categories, selectedMonth, setSelectedMonth,
    getTotalIncome, getTotalExpenses, getBalance, getCarryForward,
    deleteTransaction, openEditSheet,
  } = useFinance();

  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const balance = getBalance(selectedMonth);
  const income = getTotalIncome(selectedMonth);
  const expenses = getTotalExpenses(selectedMonth);
  const carryForward = getCarryForward(selectedMonth);
  const netBalance = carryForward + balance;

  const isCurrentMonth = selectedMonth === new Date().toISOString().slice(0, 7);

  const monthTransactions = useMemo(
    () => transactions.filter(t => t.date.startsWith(selectedMonth)),
    [transactions, selectedMonth]
  );

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

  const chartData = useMemo(() => {
    const expenseMap: Record<string, number> = {};
    monthTransactions.filter(t => t.type === 'expense').forEach(t => {
      expenseMap[t.categoryId] = (expenseMap[t.categoryId] || 0) + t.amount;
    });
    return Object.entries(expenseMap)
      .map(([catId, value]) => {
        const cat = categories.find(c => c.id === catId);
        return { name: cat?.name || 'Unknown', value, color: cat?.color || '#6366F1', catId };
      })
      .sort((a, b) => b.value - a.value);
  }, [monthTransactions, categories]);

  const getCategoryById = (id: string) => categories.find(c => c.id === id);

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
        {/* Balance Hero — compact layout for large numbers */}
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
            {formatINRCompact(netBalance)}
          </p>

          {/* Carry Forward */}
          {carryForward !== 0 && (
            <div className="flex items-center gap-1.5 mb-3">
              <ArrowRightLeft size={10} className="text-white/40 flex-shrink-0" />
              <p className="text-[11px] text-white/40 leading-tight">
                Carried from {formatMonthLabel(prevMonth(selectedMonth))}:
                <span className={cn('font-semibold ml-1', carryForward >= 0 ? 'text-emerald-400/80' : 'text-red-400/80')}>
                  {formatINRCompact(carryForward)}
                </span>
              </p>
            </div>
          )}
          {carryForward === 0 && <div className="mb-3" />}

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10">
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <ArrowDownLeft size={10} className="text-emerald-400" />
                <p className="text-[10px] text-white/50">Income</p>
              </div>
              <p className="text-sm font-bold text-emerald-400 truncate" data-testid="income-amount">{formatINRCompact(income)}</p>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <ArrowUpRight size={10} className="text-red-400" />
                <p className="text-[10px] text-white/50">Expenses</p>
              </div>
              <p className="text-sm font-bold text-red-400 truncate" data-testid="expenses-amount">{formatINRCompact(expenses)}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/50 mb-0.5">This Month</p>
              <p className={cn('text-sm font-bold truncate', balance >= 0 ? 'text-white' : 'text-red-400')}>
                {formatINRCompact(balance)}
              </p>
            </div>
          </div>
        </motion.div>

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
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      onMouseEnter={(_, index) => setHoveredCategory(chartData[index]?.catId)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      {chartData.map(entry => (
                        <Cell key={entry.catId} fill={entry.color} opacity={hoveredCategory && hoveredCategory !== entry.catId ? 0.45 : 1} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatINR(value), '']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full md:w-1/2 space-y-2">
                {chartData.map(entry => (
                  <div
                    key={entry.catId}
                    className={cn('flex items-center justify-between transition-opacity', hoveredCategory && hoveredCategory !== entry.catId ? 'opacity-40' : 'opacity-100')}
                    onMouseEnter={() => setHoveredCategory(entry.catId)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">{entry.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground ml-2">{formatINRCompact(entry.value)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-border flex justify-between">
                  <span className="text-xs font-bold text-foreground">Total</span>
                  <span className="text-xs font-bold text-foreground">{formatINRCompact(expenses)}</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Recent Transactions — grouped by date */}
        <motion.div variants={item} className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>Recent Transactions</h2>
          {groupedRecent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <p className="text-sm font-medium">No transactions this month</p>
              <p className="text-xs mt-1">Tap the + button to add your first transaction</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedRecent.map(({ date, transactions: dayTxns }) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{formatDateLabel(date)}</p>
                  <div className="space-y-1">
                    {dayTxns.map(t => {
                      const cat = getCategoryById(t.categoryId);
                      return (
                        <div
                          key={t.id}
                          className="group flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/60 transition-colors"
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
                            <span className={cn('text-sm font-bold', t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
                              {t.type === 'income' ? '+' : '-'}{formatINRCompact(t.amount)}
                            </span>
                            <button
                              data-testid={`edit-${t.id}`}
                              onClick={() => openEditSheet(t)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-accent/10 text-accent transition-all"
                            >
                              <Pencil size={12} />
                            </button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  data-testid={`delete-${t.id}`}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/10 text-destructive transition-all"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you really want to delete this transaction? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteTransaction(t.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
