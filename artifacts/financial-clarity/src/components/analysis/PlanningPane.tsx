import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, ArrowRight, CalendarClock, Sparkles, Target, TrendingUp, WalletCards } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';
import { addMonths, formatINR, formatMonthYear, localDateStr, monthsBetween } from '@/lib/finance-utils';
import { getMonthTotal, shiftMonth } from '@/lib/analysis-utils';
import type { AnalysisShared } from './useAnalysisShared';

interface Props {
  shared: AnalysisShared;
}

export default function PlanningPane({ shared }: Props) {
  const {
    finance: { transactions, categories, budgets, selectedMonth, recurringExpenses, savingsGoal, addBudget },
    today,
    todayStr,
    currentMonthKey,
    monthStatus,
    daysLeftInMonth,
    elapsedDays,
    monthlyIncome,
    monthlyExpenses,
    monthlyExpensesToDate,
    monthlyIncomeToDate,
    monthlyBudgetTotal,
    monthlyDayToDay,
    currentSummary,
    allCategorySpending,
  } = shared;

  const [suggestionsApplied, setSuggestionsApplied] = useState(false);

  const isBudgetExceeded = monthlyBudgetTotal > 0 && monthlyDayToDay > monthlyBudgetTotal;

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
        let candidate = new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth);
        if (candidate < cur) {
          candidate = new Date(today.getFullYear(), today.getMonth() + 1, r.dayOfMonth);
        }
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

  const knownFutureExpenses = useMemo(() => {
    if (selectedMonth !== currentMonthKey) return 0;
    return transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(currentMonthKey) && t.date > todayStr)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, selectedMonth, currentMonthKey, todayStr]);

  const projectedBalance = useMemo(() => {
    if (selectedMonth !== currentMonthKey) return null;
    const last3 = [1, 2, 3].map(o => shiftMonth(currentMonthKey, -o));
    const incomes = last3.map(m => getMonthTotal(transactions, m, 'income')).filter(v => v > 0);
    const expectedIncome = incomes.length > 0
      ? incomes.reduce((s, v) => s + v, 0) / incomes.length
      : monthlyIncome;
    const expectedRemainingIncome = Math.max(0, expectedIncome - monthlyIncomeToDate);
    const burnPerDay = monthlyExpensesToDate / Math.max(1, elapsedDays);
    const projectedRemainingSpend = burnPerDay * daysLeftInMonth;
    const value = inHandBalance + expectedRemainingIncome - projectedRemainingSpend - knownFutureExpenses;
    return { value, expectedIncome, projectedRemainingSpend, knownFutureExpenses };
  }, [selectedMonth, currentMonthKey, transactions, monthlyIncome, monthlyIncomeToDate, monthlyExpensesToDate, elapsedDays, daysLeftInMonth, inHandBalance, knownFutureExpenses]);

  const nextMonth = useMemo(() => addMonths(selectedMonth, 1), [selectedMonth]);
  const budgetSuggestions = useMemo(() => {
    return allCategorySpending
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
  }, [allCategorySpending, budgets, nextMonth]);

  const applySuggestions = () => {
    budgetSuggestions.forEach(s => {
      addBudget({ categoryId: s.categoryId, limit: s.suggestedLimit, month: nextMonth });
    });
    setSuggestionsApplied(true);
    setTimeout(() => setSuggestionsApplied(false), 3500);
  };

  const savingsGoalsProgress = useMemo(() => {
    if (!savingsGoal) return [];
    const todayStrLocal = localDateStr(today);
    const targetDateStr = `${today.getFullYear()}-12-31`;
    const entries = [
      { key: 'goal' as const, id: 'savings-goal', name: 'Goal Savings', color: '#0EA5E9', goal: savingsGoal.goal },
      { key: 'emergency' as const, id: 'savings-emergency', name: 'Emergency Fund', color: '#14B8A6', goal: savingsGoal.emergency },
    ];
    return entries.map(e => {
      const annualGoal = e.goal.annual > 0 ? e.goal.annual : e.goal.monthly * 12;
      let createdAt = e.goal.createdAt;
      if (!createdAt) {
        let earliest: string | null = null;
        for (const t of transactions) {
          if (t.type !== 'expense' || t.categoryId !== e.id) continue;
          if (earliest === null || t.date < earliest) earliest = t.date;
        }
        createdAt = earliest ?? todayStrLocal;
      }
      let contrib = 0;
      for (const t of transactions) {
        if (t.type !== 'expense' || t.categoryId !== e.id) continue;
        if (t.date < createdAt) continue;
        contrib += t.amount;
      }
      const totalMonths = Math.max(1, monthsBetween(createdAt, targetDateStr));
      const monthsElapsed = Math.max(0, Math.min(totalMonths, monthsBetween(createdAt, todayStrLocal)));
      const expectedToDate = annualGoal * (monthsElapsed / totalMonths);
      const pct = annualGoal > 0 ? Math.max(0, Math.min(100, (contrib / annualGoal) * 100)) : 0;
      const onTrack = annualGoal > 0 && contrib >= expectedToDate;
      return { ...e, annualGoal, ytdContrib: contrib, pct, onTrack, monthIndex: monthsElapsed, totalMonths };
    });
  }, [savingsGoal, transactions, today]);
  const visibleSavingsGoals = useMemo(() => savingsGoalsProgress.filter(g => g.annualGoal > 0), [savingsGoalsProgress]);

  return (
    <>
      {monthStatus === 'past' && (
        <div className="bg-card border border-border rounded-2xl p-5" data-testid="month-ended-summary">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0">
              <CalendarClock size={17} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Month ended</p>
              <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatMonthYear(selectedMonth)} summary</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Income</p>
              <p className="text-sm font-bold text-foreground">{formatINR(currentSummary.totalIncome)}</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Expenses</p>
              <p className="text-sm font-bold text-foreground">{formatINR(currentSummary.totalExpenses)}</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">To savings</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatINR(currentSummary.totalSavings)}</p>
            </div>
            <div className="rounded-xl bg-muted/50 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Net flow</p>
              <p className={cn('text-sm font-bold', currentSummary.netFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>{formatINR(currentSummary.netFlow)}</p>
            </div>
          </div>
          {monthlyBudgetTotal > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Budget outcome:{' '}
              <span className={cn('font-semibold', isBudgetExceeded ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400')}>
                {isBudgetExceeded ? `Over by ${formatINR(monthlyDayToDay - monthlyBudgetTotal)}` : `Under by ${formatINR(monthlyBudgetTotal - monthlyDayToDay)}`}
              </span>
            </p>
          )}
        </div>
      )}

      {monthStatus === 'future' && (
        <div className="bg-card border border-border rounded-2xl p-5" data-testid="planned-budgets-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <Target size={17} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Planned</p>
              <h2 className="text-sm font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budgets planned for {formatMonthYear(selectedMonth)}</h2>
            </div>
          </div>
          {budgets.filter(b => b.month === selectedMonth).length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">No budgets planned yet for this month. <Link href="/budgets" className="text-accent font-semibold hover:underline">Set budgets</Link>.</p>
          ) : (
            <div className="space-y-2">
              {budgets.filter(b => b.month === selectedMonth).map(b => {
                const cat = categories.find(c => c.id === b.categoryId);
                return (
                  <div key={b.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cat?.color || '#94A3B8'}22` }}>
                        <CategoryIcon icon={cat?.icon || 'DollarSign'} color={cat?.color || '#94A3B8'} size={14} />
                      </div>
                      <span className="text-sm font-medium text-foreground truncate">{cat?.name || 'Unknown'}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">{formatINR(b.limit)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {monthStatus === 'current' && (<>
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
            Based on avg income {formatINR(projectedBalance.expectedIncome)} and projected remaining spend {formatINR(projectedBalance.projectedRemainingSpend)}
            {projectedBalance.knownFutureExpenses > 0 && <> plus scheduled bills {formatINR(projectedBalance.knownFutureExpenses)}</>}.
          </p>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl p-5" data-testid="budget-suggestions-card">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
            <Sparkles size={17} />
          </div>
          <div>
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
      </>)}

      {visibleSavingsGoals.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5" data-testid="savings-goal-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Target size={17} />
            </div>
            <div>
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
          <p className="text-[11px] text-muted-foreground mt-3 text-center">Through month {visibleSavingsGoals[0]?.monthIndex} of {visibleSavingsGoals[0]?.totalMonths} since goal start. <Link href="/settings" className="text-accent font-semibold hover:underline inline-flex items-center gap-0.5">Adjust goals <ArrowRight size={10} /></Link></p>
        </div>
      )}
    </>
  );
}
