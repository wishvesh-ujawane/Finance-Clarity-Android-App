import { useMemo } from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, PiggyBank, ShieldCheck, Sparkles } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';
import { formatINR, formatMonthYear, formatDateLabel } from '@/lib/finance-utils';
import { useFinance } from '@/context/FinanceContext';
import { computeReviewSnapshot } from '@/lib/month-end-review';

interface Props {
  month: string;
}

export function MonthEndAnalysisCard({ month }: Props) {
  const { transactions, categories } = useFinance();
  const snap = useMemo(
    () => computeReviewSnapshot(month, transactions, categories),
    [month, transactions, categories]
  );

  const momPct = snap.spendMoMChangePct;
  const momDir = momPct === null ? 'flat' : momPct > 0 ? 'up' : momPct < 0 ? 'down' : 'flat';

  return (
    <div className="space-y-5" data-testid="month-end-analysis-card">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 p-5 border border-primary/15">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Your month in numbers
        </div>
        <h2
          className="mt-1 text-2xl font-bold text-foreground"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {formatMonthYear(month)}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's how it went. Scroll down to see top categories, impulse spends, and savings.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <KpiTile
          label="Net saved"
          value={formatINR(snap.netSaved)}
          tone={snap.netSaved >= 0 ? 'emerald' : 'red'}
          testId="kpi-net-saved"
        />
        <KpiTile
          label="Savings rate"
          value={`${snap.savingsRatePct.toFixed(0)}%`}
          tone={snap.savingsRatePct >= 20 ? 'emerald' : snap.savingsRatePct >= 10 ? 'amber' : 'muted'}
          testId="kpi-savings-rate"
        />
        <KpiTile
          label="Spend vs last mo."
          value={
            momPct === null
              ? '—'
              : `${momDir === 'up' ? '+' : ''}${momPct.toFixed(0)}%`
          }
          tone={momDir === 'down' ? 'emerald' : momDir === 'up' ? 'red' : 'muted'}
          icon={momDir === 'up' ? ArrowUpRight : momDir === 'down' ? ArrowDownRight : undefined}
          testId="kpi-spend-mom"
          hint={momPct === null ? snap.spendMoMLabel : undefined}
        />
      </div>

      {/* Income vs Spent summary strip */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-4">
          <SummaryLine label="Income" value={snap.income} accent="text-emerald-500" />
          <SummaryLine label="Spent" value={snap.expenses} accent="text-red-500" />
        </div>
      </div>

      {/* Top categories */}
      <section aria-labelledby="top-cats-heading">
        <div className="mb-2 flex items-center justify-between">
          <h3
            id="top-cats-heading"
            className="text-sm font-semibold text-foreground"
          >
            Top spending categories
          </h3>
          <span className="text-xs text-muted-foreground">Top {snap.topCategories.length}</span>
        </div>
        {snap.topCategories.length === 0 ? (
          <EmptyRow message="No expenses in this month." />
        ) : (
          <ul className="space-y-2" data-testid="top-categories-list">
            {snap.topCategories.map(row => (
              <li
                key={row.categoryId}
                className="rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${row.categoryColor}22` }}
                  >
                    <CategoryIcon icon={row.categoryIcon} color={row.categoryColor} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{row.categoryName}</p>
                      <p className="shrink-0 text-sm font-semibold text-foreground">
                        {formatINR(row.amount)}
                      </p>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, row.pctOfSpend)}%`,
                          backgroundColor: row.categoryColor,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {row.pctOfSpend.toFixed(0)}% of total spend
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Impulse expenses */}
      <section aria-labelledby="impulse-heading">
        <div className="mb-2 flex items-center justify-between">
          <h3
            id="impulse-heading"
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
          >
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Impulse expenses
          </h3>
          <span className="text-xs text-muted-foreground">
            ≥ ₹500, non-commitment
          </span>
        </div>
        {snap.impulseExpenses.length === 0 ? (
          <EmptyRow message="Nice — no impulse spikes this month." />
        ) : (
          <ul className="space-y-2" data-testid="impulse-expenses-list">
            {snap.impulseExpenses.map(row => (
              <li
                key={row.id}
                className="rounded-xl border border-border bg-card p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${row.categoryColor}22` }}
                  >
                    <CategoryIcon icon={row.categoryIcon} color={row.categoryColor} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {row.note || row.categoryName}
                      </p>
                      <p className="shrink-0 text-sm font-semibold text-foreground">
                        {formatINR(row.amount)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {row.categoryName} · {formatDateLabel(row.date)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Savings split */}
      <section aria-labelledby="savings-heading">
        <h3 id="savings-heading" className="mb-2 text-sm font-semibold text-foreground">
          Savings this month
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <SavingsTile
            label="Emergency Fund"
            value={snap.savingsEmergency}
            Icon={ShieldCheck}
            iconColor="#14B8A6"
            testId="savings-tile-emergency"
          />
          <SavingsTile
            label="Goal Savings"
            value={snap.savingsGoal}
            Icon={PiggyBank}
            iconColor="#0EA5E9"
            testId="savings-tile-goal"
          />
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

interface KpiTileProps {
  label: string;
  value: string;
  tone: 'emerald' | 'red' | 'amber' | 'muted';
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  testId: string;
}

function KpiTile({ label, value, tone, icon: Icon, hint, testId }: KpiTileProps) {
  const toneClass =
    tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'red' ? 'text-red-600 dark:text-red-400'
    : tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : 'text-foreground';
  return (
    <div
      className="rounded-xl border border-border bg-card p-3"
      data-testid={testId}
    >
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className={cn('mt-1 flex items-center gap-1 text-lg font-bold leading-tight', toneClass)}>
        {Icon && <Icon className="h-4 w-4" />}
        <span className="truncate">{value}</span>
      </div>
      {hint && (
        <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{hint}</p>
      )}
    </div>
  );
}

interface SummaryLineProps {
  label: string;
  value: number;
  accent: string;
}

function SummaryLine({ label, value, accent }: SummaryLineProps) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-0.5 text-lg font-bold', accent)}>{formatINR(value)}</p>
    </div>
  );
}

interface SavingsTileProps {
  label: string;
  value: number;
  Icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  testId: string;
}

function SavingsTile({ label, value, Icon, iconColor, testId }: SavingsTileProps) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-3"
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${iconColor}22` }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className="mt-2 text-lg font-bold text-foreground">{formatINR(value)}</p>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}
