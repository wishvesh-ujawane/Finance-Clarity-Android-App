import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Bar, BarChart, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatINR, formatMonthYear, formatShortINR } from '@/lib/finance-utils';
import { SAVINGS_CATEGORY_IDS } from '@/lib/types';
import { getLastNMonths, monthLabel } from '@/lib/analysis-utils';
import type { AnalysisShared } from './useAnalysisShared';

interface Props {
  shared: AnalysisShared;
}

export default function TrendsPane({ shared }: Props) {
  const {
    finance: { transactions, categories, budgets, selectedMonth, recurringExpenses, getMonthSummary, openEditSheet },
    today,
    currentMonthKey,
    daysInSelectedMonth,
    monthlyTransactions,
    commitmentCategoryIds,
  } = shared;

  const [selectedWeekday, setSelectedWeekday] = useState<number | null>(null);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);

  const last6Months = useMemo(() => getLastNMonths(selectedMonth, 6), [selectedMonth]);

  const spendingTrendData = useMemo(() => {
    return last6Months
      .map(month => {
        const summary = getMonthSummary(month);
        return {
          month: monthLabel(month),
          raw: month,
          spent: summary.totalExpenses,
          income: summary.totalIncome,
          hasData: summary.hasData,
        };
      })
      .filter(d => d.hasData);
  }, [last6Months, getMonthSummary]);

  const trendFirstRecordedMonth = spendingTrendData.length > 0 ? spendingTrendData[0].raw : null;
  const trendIsPartial = spendingTrendData.length > 0 && spendingTrendData.length < last6Months.length;

  const barChartYMax = useMemo(() => {
    const max = Math.max(...spendingTrendData.map(d => Math.max(d.spent, d.income)), 0);
    if (max <= 0) return 1000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil((max * 1.15) / magnitude) * magnitude;
  }, [spendingTrendData]);

  const savingsRateSeries = useMemo(() => {
    return last6Months.map(month => {
      const summary = getMonthSummary(month);
      if (!summary.hasData || summary.totalIncome <= 0) {
        return { month: monthLabel(month), raw: month, rate: null as number | null };
      }
      const rate = Math.max(-100, Math.min(100, ((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100));
      return { month: monthLabel(month), raw: month, rate: Number(rate.toFixed(1)) };
    });
  }, [last6Months, getMonthSummary]);

  const weekdayHeatmap = useMemo(() => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const totals = [0, 0, 0, 0, 0, 0, 0];
    const topByCategory: Record<number, Record<string, number>> = {};
    monthlyTransactions.filter(t => t.type === 'expense').forEach(t => {
      const d = new Date(`${t.date}T00:00:00`);
      const jsDay = d.getDay();
      const idx = jsDay === 0 ? 6 : jsDay - 1;
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

  const dailySpend = useMemo(() => {
    const map: Record<number, { total: number; txns: typeof transactions }> = {};
    monthlyTransactions.filter(t => t.type === 'expense').forEach(t => {
      const day = parseInt(t.date.slice(-2), 10);
      if (!map[day]) map[day] = { total: 0, txns: [] };
      map[day].total += t.amount;
      map[day].txns.push(t);
    });
    return map;
  }, [monthlyTransactions]);

  const maxDailySpend = useMemo(() => {
    let max = 0;
    for (const k in dailySpend) max = Math.max(max, dailySpend[k].total);
    return max;
  }, [dailySpend]);

  const calendarCells = useMemo(() => {
    const [year, monthNum] = selectedMonth.split('-').map(Number);
    const firstDayJs = new Date(year, monthNum - 1, 1).getDay();
    const leadingBlanks = firstDayJs === 0 ? 6 : firstDayJs - 1;
    const cells: ({ kind: 'blank' } | { kind: 'day'; day: number; total: number; intensity: number })[] = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push({ kind: 'blank' });
    for (let day = 1; day <= daysInSelectedMonth; day++) {
      const total = dailySpend[day]?.total || 0;
      const intensity = maxDailySpend > 0 ? total / maxDailySpend : 0;
      cells.push({ kind: 'day', day, total, intensity });
    }
    return cells;
  }, [selectedMonth, daysInSelectedMonth, dailySpend, maxDailySpend]);

  const selectedDayTxns = useMemo(() => {
    if (selectedCalendarDay === null) return [];
    const entry = dailySpend[selectedCalendarDay];
    if (!entry) return [];
    return [...entry.txns].sort((a, b) => b.amount - a.amount);
  }, [selectedCalendarDay, dailySpend]);

  const selectedDayDateLabel = useMemo(() => {
    if (selectedCalendarDay === null) return '';
    const [year, monthNum] = selectedMonth.split('-').map(Number);
    return new Date(year, monthNum - 1, selectedCalendarDay).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  }, [selectedCalendarDay, selectedMonth]);

  const getCategoryById = (id: string) => categories.find(c => c.id === id);

  const burndownData = useMemo(() => {
    const dayToDayBudget = budgets
      .filter(b => b.month === selectedMonth && !commitmentCategoryIds.has(b.categoryId))
      .reduce((s, b) => s + b.limit, 0);

    if (dayToDayBudget <= 0) return { points: [], dayToDayBudget: 0, crossoverDay: null as number | null };

    const activeRecurringForMonth = recurringExpenses.filter(r => r.active);
    const recurringMatches = new Set<string>();
    for (const t of monthlyTransactions) {
      if (t.type !== 'expense') continue;
      for (const r of activeRecurringForMonth) {
        if (t.categoryId !== r.categoryId) continue;
        if (Math.abs(t.amount - r.amount) > 1) continue;
        recurringMatches.add(t.id);
        break;
      }
    }

    const dayToDayTxByDay: Record<number, number> = {};
    monthlyTransactions
      .filter(t => t.type === 'expense' && !commitmentCategoryIds.has(t.categoryId))
      .filter(t => !SAVINGS_CATEGORY_IDS.includes(t.categoryId as typeof SAVINGS_CATEGORY_IDS[number]))
      .filter(t => !recurringMatches.has(t.id))
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
        points.push({ day, actual: null as unknown as number, ideal: Number(ideal.toFixed(2)), overActual: null });
      }
    }
    return { points, dayToDayBudget, crossoverDay };
  }, [budgets, selectedMonth, monthlyTransactions, commitmentCategoryIds, recurringExpenses, currentMonthKey, today, daysInSelectedMonth]);

  return (
    <>
      {/* Daily spending calendar — heatmap of the selected month */}
      <div className="bg-card border border-border rounded-2xl p-5" data-testid="daily-spend-calendar">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Daily spending — {formatMonthYear(selectedMonth)}</h2>
          <span className="text-xs text-muted-foreground">Tap a day</span>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2 text-[10px] font-semibold text-muted-foreground text-center">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(l => <div key={l}>{l}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((c, i) => {
            if (c.kind === 'blank') return <div key={`b${i}`} className="aspect-square" />;
            const bg = c.total > 0
              ? `rgba(239, 68, 68, ${0.15 + 0.65 * c.intensity})`
              : 'transparent';
            return (
              <button
                key={c.day}
                type="button"
                onClick={() => c.total > 0 && setSelectedCalendarDay(c.day)}
                disabled={c.total === 0}
                className={cn(
                  'aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] font-semibold transition-all border',
                  c.total > 0 ? 'border-red-500/20 hover:scale-105 cursor-pointer text-foreground' : 'border-border/40 text-muted-foreground/60'
                )}
                style={{ backgroundColor: bg }}
                data-testid={`cal-day-${c.day}`}
                aria-label={c.total > 0 ? `${c.day} — spent ${formatINR(c.total)}` : `${c.day} — no spend`}
              >
                <span>{c.day}</span>
                {c.total > 0 && <span className="text-[8px] opacity-80 mt-0.5">{formatShortINR(c.total)}</span>}
              </button>
            );
          })}
        </div>
        {maxDailySpend === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-3">No expenses recorded for this month.</p>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl p-5" data-testid="income-expense-trend">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Income vs Spend - Last 6 Months</h2>
          <span className="text-xs text-muted-foreground">{formatMonthYear(selectedMonth)}</span>
        </div>

        {spendingTrendData.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No trend data to display</div>
        ) : (
          <>
            {trendIsPartial && trendFirstRecordedMonth && (
              <p className="text-[11px] text-muted-foreground mb-2">Showing data from {formatMonthYear(trendFirstRecordedMonth)}</p>
            )}
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
        {savingsRateSeries.every(d => d.rate === null) ? (
          <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">No income data for the selected window</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={savingsRateSeries} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 11, fill: 'hsl(215, 16%, 47%)' }} />
              <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: 'hsl(215, 16%, 47%)' }} width={44} />
              <Tooltip formatter={(value) => [value == null ? 'No transactions recorded' : `${value}%`, 'Savings rate']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '12px' }} />
              <ReferenceLine y={20} stroke="#94A3B8" strokeDasharray="4 4" label={{ value: 'Recommended 20%', fontSize: 10, fill: '#94A3B8', position: 'insideTopRight' }} />
              <Line type="monotone" dataKey="rate" stroke="#14B8A6" strokeWidth={2.5} dot={{ r: 4, fill: '#14B8A6' }} activeDot={{ r: 6 }} connectNulls={false} />
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
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budget usage this month</h2>
          <span className="text-xs text-muted-foreground">Day-to-day only</span>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">Discretionary spend only — commitments excluded</p>
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

      {/* ─── Day-detail bottom sheet (calendar tap) ─── */}
      <Sheet open={selectedCalendarDay !== null} onOpenChange={(o) => { if (!o) setSelectedCalendarDay(null); }}>
        <SheetContent side="bottom" className="h-[50vh] overflow-y-auto rounded-t-2xl p-5">
          <SheetHeader className="text-left mb-4 pr-8">
            <SheetTitle className="text-base" style={{ fontFamily: 'var(--font-display)' }}>
              {selectedDayDateLabel}
            </SheetTitle>
            <SheetDescription>
              {selectedCalendarDay !== null && dailySpend[selectedCalendarDay]
                ? `Spent ${formatINR(dailySpend[selectedCalendarDay].total)} across ${dailySpend[selectedCalendarDay].txns.length} transaction${dailySpend[selectedCalendarDay].txns.length === 1 ? '' : 's'}`
                : 'No expenses recorded'}
            </SheetDescription>
          </SheetHeader>

          {selectedDayTxns.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">No expenses on this day</div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden" data-testid="day-detail-list">
              {selectedDayTxns.map(t => {
                const cat = getCategoryById(t.categoryId);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedCalendarDay(null);
                      // Delay to let the Radix Sheet finish closing before the
                      // TransactionSheet opens — avoids focus / pointer-events
                      // conflict on Android WebView.
                      setTimeout(() => openEditSheet(t), 200);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                    data-testid={`day-txn-${t.id}`}
                  >
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cat?.color || '#94A3B8'}22` }}>
                        <CategoryIcon icon={cat?.icon || 'circle'} color={cat?.color || '#94A3B8'} size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{t.note || cat?.name || 'Expense'}</p>
                        <p className="text-[11px] text-muted-foreground">{cat?.name || 'Uncategorized'}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-red-500 flex-shrink-0">{formatINR(t.amount)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
