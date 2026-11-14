import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { formatAmount, formatMonthYear, formatShortINR } from '@/lib/finance-utils';
import { getLastNMonths, monthLabel } from '@/lib/analysis-utils';
import { categorySpendChanges, consumptionByDay, topCategoryTrend, type DateRange } from '@/lib/domain/analysis';
import { consumptionBetween } from '@/lib/domain/finance-metrics';
import { lastDateOfMonth } from '@/lib/domain/periods';
import type { AnalysisShared } from './useAnalysisShared';

interface Props {
  shared: AnalysisShared;
}

const AXIS_TICK = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
const CHANGE_ROWS = 3;

function dayOfMonthLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function TrendsPane({ shared }: Props) {
  const {
    finance: { transactions, categories, selectedMonth, getMonthSummary, openEditSheet },
    todayStr,
    monthStatus,
    previousMonth,
    daysInSelectedMonth,
    monthlyTransactions,
  } = shared;

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

  // Category changes: a month in progress is compared with the same days of
  // the previous month, so a half-finished month is not compared to a full one.
  const changeRanges = useMemo((): { current: DateRange; previous: DateRange } | null => {
    if (monthStatus === 'future') return null;
    if (monthStatus === 'current') {
      const day = Number(todayStr.slice(8, 10));
      const prevLast = lastDateOfMonth(previousMonth);
      const prevEndDay = Math.min(day, Number(prevLast.slice(8, 10)));
      return {
        current: { start: `${selectedMonth}-01`, end: todayStr },
        previous: { start: `${previousMonth}-01`, end: `${previousMonth}-${String(prevEndDay).padStart(2, '0')}` },
      };
    }
    return {
      current: { start: `${selectedMonth}-01`, end: lastDateOfMonth(selectedMonth) },
      previous: { start: `${previousMonth}-01`, end: lastDateOfMonth(previousMonth) },
    };
  }, [monthStatus, todayStr, selectedMonth, previousMonth]);

  const categoryChanges = useMemo(() => {
    if (!changeRanges) return null;
    const previousTotal = consumptionBetween(transactions, changeRanges.previous.start, changeRanges.previous.end);
    const rows = categorySpendChanges(transactions, changeRanges.current, changeRanges.previous);
    return {
      previousTotal,
      increases: rows.filter(r => r.change > 0).slice(0, CHANGE_ROWS),
      decreases: rows.filter(r => r.change < 0).reverse().slice(0, CHANGE_ROWS),
    };
  }, [transactions, changeRanges]);

  const changePeriodLabel = changeRanges
    ? monthStatus === 'current'
      ? `${dayOfMonthLabel(changeRanges.current.start)}–${dayOfMonthLabel(changeRanges.current.end)} vs ${dayOfMonthLabel(changeRanges.previous.start)}–${dayOfMonthLabel(changeRanges.previous.end)}`
      : `${formatMonthYear(selectedMonth)} vs ${formatMonthYear(previousMonth)}`
    : '';

  // Top categories over the months that have any entries (same window as the
  // Income vs Spend chart).
  const categoryTrend = useMemo(() => {
    const months = spendingTrendData.map(d => d.raw);
    const trend = topCategoryTrend(transactions, months);
    return {
      ...trend,
      monthCount: months.length,
      chartData: trend.points.map(p => ({ month: monthLabel(p.month), ...p.values })),
      selectedValues: trend.points.find(p => p.month === selectedMonth)?.values ?? {},
    };
  }, [transactions, spendingTrendData, selectedMonth]);

  const dailySpend = useMemo(
    () => consumptionByDay(monthlyTransactions, selectedMonth),
    [monthlyTransactions, selectedMonth],
  );

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

  return (
    <>
      {/* Daily spending calendar — heatmap of the selected month */}
      <div className="bg-card border border-border rounded-2xl p-5" data-testid="daily-spend-calendar">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Daily spending — {formatMonthYear(selectedMonth)}</h2>
          <span className="text-xs text-muted-foreground">Tap a day</span>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2 text-[11px] font-semibold text-muted-foreground text-center">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(l => <div key={l}>{l}</div>)}
        </div>
        <div data-dense-grid className="grid grid-cols-7 gap-1">
          {calendarCells.map((c, i) => {
            if (c.kind === 'blank') return <div key={`b${i}`} className="aspect-square" />;
            const bg = c.total > 0
              ? `hsl(var(--spending) / ${0.15 + 0.65 * c.intensity})`
              : 'transparent';
            return (
              <button
                key={c.day}
                type="button"
                onClick={() => c.total > 0 && setSelectedCalendarDay(c.day)}
                disabled={c.total === 0}
                className={cn(
                  'aspect-square rounded-lg flex flex-col items-center justify-center text-[11px] font-semibold transition-all border',
                  c.total > 0 ? 'border-spending/20 hover:scale-105 cursor-pointer text-foreground' : 'border-border/40 text-muted-foreground/60'
                )}
                style={{ backgroundColor: bg }}
                data-testid={`cal-day-${c.day}`}
                aria-label={c.total > 0 ? `${c.day} — spent ${formatAmount(c.total)}` : `${c.day} — no spend`}
              >
                <span>{c.day}</span>
                {c.total > 0 && <span className="text-[11px] leading-none opacity-80 mt-0.5">{formatShortINR(c.total)}</span>}
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
                <XAxis dataKey="month" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis axisLine={false} tickLine={false} domain={[0, barChartYMax]} tickFormatter={formatShortINR} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={44} />
                <Tooltip formatter={(value: number, name: string) => [formatAmount(value), name === 'spent' ? 'Spent' : 'Income']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '12px' }} />
                <Bar dataKey="spent" fill="hsl(var(--spending))" radius={[4, 4, 0, 0]} minPointSize={4} />
                <Bar dataKey="income" fill="hsl(var(--income))" radius={[4, 4, 0, 0]} minPointSize={4} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-spending" />
                <span className="text-muted-foreground">Spent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-income" />
                <span className="text-muted-foreground">Income</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Category changes vs the previous month */}
      <div className="bg-card border border-border rounded-2xl p-5" data-testid="category-changes">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>What changed vs last month</h2>
          {changePeriodLabel && <p className="text-xs text-muted-foreground mt-0.5">{changePeriodLabel}</p>}
        </div>
        {!categoryChanges ? (
          <p className="py-6 text-center text-sm text-muted-foreground" data-testid="category-changes-empty">
            Nothing to compare yet for {formatMonthYear(selectedMonth)}.
          </p>
        ) : categoryChanges.previousTotal === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground" data-testid="category-changes-insufficient">
            Not enough history. Add spending for {formatMonthYear(previousMonth)} to see what changed.
          </p>
        ) : categoryChanges.increases.length === 0 && categoryChanges.decreases.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Spending per category is the same as last month.</p>
        ) : (
          <div className="space-y-4">
            {([
              { key: 'up', title: 'Spending more', rows: categoryChanges.increases },
              { key: 'down', title: 'Spending less', rows: categoryChanges.decreases },
            ] as const).filter(group => group.rows.length > 0).map(group => (
              <div key={group.key} data-testid={`category-changes-${group.key}`}>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">{group.title}</p>
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {group.rows.map(row => {
                    const cat = getCategoryById(row.categoryId);
                    const isUp = row.change > 0;
                    return (
                      <div key={row.categoryId} className="flex items-center gap-3 px-3 py-2.5 min-h-12">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                          <CategoryIcon icon={cat?.icon || 'DollarSign'} color={cat?.color || '#6366F1'} size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{cat?.name || 'Unknown category'}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatAmount(row.previous)} → {formatAmount(row.current)}
                          </p>
                        </div>
                        <div className={cn('flex items-center gap-0.5 text-sm font-bold flex-shrink-0', isUp ? 'text-destructive' : 'text-foreground')}>
                          {isUp ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
                          <span>
                            {isUp ? '+' : '−'}{formatAmount(Math.abs(row.change))}
                            <span className="ml-1 text-[11px] font-semibold text-muted-foreground">
                              {row.changePct === null ? 'new' : `${isUp ? '+' : '−'}${Math.abs(row.changePct).toFixed(0)}%`}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top 5 categories over the last 6 months */}
      <div className="bg-card border border-border rounded-2xl p-5" data-testid="top-category-trend">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Top 5 categories</h2>
          <span className="text-xs text-muted-foreground">Last 6 months</span>
        </div>
        {categoryTrend.categoryIds.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground" data-testid="top-category-trend-empty">
            No spending in the last 6 months.
          </p>
        ) : (
          <>
            {categoryTrend.monthCount < 2 ? (
              <p className="mb-3 text-xs text-muted-foreground" data-testid="top-category-trend-insufficient">
                Only one month of entries so far. The trend line appears once you have two months.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={categoryTrend.chartData} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} interval={0} tick={AXIS_TICK} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={formatShortINR} tick={AXIS_TICK} width={44} />
                  <Tooltip
                    formatter={(value: number, id: string) => [formatAmount(value), getCategoryById(id)?.name ?? 'Unknown category']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: '12px' }}
                  />
                  {categoryTrend.categoryIds.map(id => {
                    const color = getCategoryById(id)?.color || '#6366F1';
                    return <Line key={id} type="monotone" dataKey={id} stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} />;
                  })}
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="mt-3 space-y-2" data-testid="top-category-trend-list">
              {categoryTrend.categoryIds.map(id => {
                const cat = getCategoryById(id);
                const avg = categoryTrend.totals[id] / Math.max(1, categoryTrend.monthCount);
                return (
                  <div key={id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat?.color || '#6366F1' }} aria-hidden="true" />
                    <span className="min-w-0 truncate font-semibold text-foreground">{cat?.name || 'Unknown category'}</span>
                    <span className="col-start-2 text-muted-foreground amount">
                      {formatAmount(categoryTrend.selectedValues[id] ?? 0)} this month · avg {formatAmount(avg)}/month
                    </span>
                  </div>
                );
              })}
            </div>
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
                ? `Spent ${formatAmount(dailySpend[selectedCalendarDay].total)} across ${dailySpend[selectedCalendarDay].txns.length} transaction${dailySpend[selectedCalendarDay].txns.length === 1 ? '' : 's'}`
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
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cat?.color || '#94A3B8'}22` }}>
                        <CategoryIcon icon={cat?.icon || 'circle'} color={cat?.color || '#94A3B8'} size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{t.note || cat?.name || 'Expense'}</p>
                        <p className="text-[11px] text-muted-foreground">{cat?.name || 'Uncategorized'}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-spending amount flex-shrink-0 whitespace-nowrap">{formatAmount(t.amount)}</span>
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
