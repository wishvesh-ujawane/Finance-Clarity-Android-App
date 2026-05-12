import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';
import { formatINR, formatShortINR } from '@/lib/finance-utils';

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

export default function Analysis() {
  const { transactions, categories } = useFinance();
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');

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
        return { cat, amount, pct: total > 0 ? (amount / total) * 100 : 0 };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, categories, viewType]);

  const totalThisMonth = useMemo(() =>
    transactions.filter(t => t.type === viewType && t.date.startsWith(currentMonth)).reduce((s, t) => s + t.amount, 0),
    [transactions, viewType, currentMonth]
  );
  const totalIncome = useMemo(() => transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalExpenses = useMemo(() => transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [transactions]);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

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
              onClick={() => setViewType(t)}
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

      {/* Bar Chart */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            {viewType === 'expense' ? 'Spending' : 'Income'} — Last 6 Months
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
        <h2 className="text-sm font-bold text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>By Category — All Time</h2>
        {categoryBreakdown.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">No {viewType} transactions recorded</div>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.map(({ cat, amount, pct }, i) => (
              <motion.div key={cat?.id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.04 }} className="space-y-1.5" data-testid={`breakdown-${cat?.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (cat?.color || '#6366F1') + '22' }}>
                      <CategoryIcon icon={cat?.icon || 'DollarSign'} color={cat?.color || '#6366F1'} size={13} />
                    </div>
                    <span className="text-sm text-foreground font-medium">{cat?.name || 'Unknown'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-foreground">{formatINR(amount)}</span>
                    <span className="text-xs text-muted-foreground ml-2">{pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ backgroundColor: cat?.color || accentColor }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 + i * 0.04 }} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
