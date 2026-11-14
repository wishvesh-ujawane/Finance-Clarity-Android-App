import { useMemo } from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, PiggyBank, ShieldCheck, Sparkles } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
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
    <div className="space-y-4" data-testid="month-end-analysis-card">
      {/* Hero */}
      <div className="rounded-2xl border border-accent/15 bg-accent/5 p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
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
          tone={snap.netSaved >= 0 ? 'income' : 'spending'}
          testId="kpi-net-saved"
        />
        <KpiTile
          label="Savings rate"
          value={`${snap.savingsRatePct.toFixed(0)}%`}
          tone={snap.savingsRatePct >= 20 ? 'success' : snap.savingsRatePct >= 10 ? 'warning' : 'muted'}
          testId="kpi-savings-rate"
        />
        <KpiTile
          label="Spend vs last mo."
          value={
            momPct === null
              ? '—'
              : `${momDir === 'up' ? '+' : ''}${momPct.toFixed(0)}%`
          }
          tone={momDir === 'down' ? 'success' : momDir === 'up' ? 'danger' : 'muted'}
          icon={momDir === 'up' ? ArrowUpRight : momDir === 'down' ? ArrowDownRight : undefined}
          testId="kpi-spend-mom"
          hint={momPct === null ? snap.spendMoMLabel : undefined}
        />
      </div>

      {/* Income vs Spent summary strip */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-4">
          <SummaryLine label="Income" value={snap.income} accent="text-income" />
          <SummaryLine label="Spent" value={snap.expenses} accent="text-spending" />
        </div>
      </div>

      {/* Spending breakdown pie chart */}
      {snap.topCategories.length > 0 && (
        <section aria-labelledby="breakdown-heading">
          <h3
            id="breakdown-heading"
            className="mb-2 text-sm font-bold text-foreground"
          >
            Spending breakdown
          </h3>
          <SpendingPie snapExpenses={snap.expenses} topCategories={snap.topCategories} />
        </section>
      )}

      {/* Top categories */}
      <section aria-labelledby="top-cats-heading">
        <div className="mb-2 flex items-center justify-between">
          <h3
            id="top-cats-heading"
            className="text-sm font-bold text-foreground"
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
                      <p className="amount shrink-0 whitespace-nowrap text-sm font-semibold text-foreground">
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
            className="flex items-center gap-1.5 text-sm font-bold text-foreground"
          >
            <AlertCircle className="h-4 w-4 text-warning" />
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
                      <p className="amount shrink-0 whitespace-nowrap text-sm font-semibold text-foreground">
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
        <h3 id="savings-heading" className="mb-2 text-sm font-bold text-foreground">
          Savings this month
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <SavingsTile
            label="Emergency Fund"
            value={snap.savingsEmergency}
            Icon={ShieldCheck}
            tileClass="bg-savings-tint text-savings"
            testId="savings-tile-emergency"
          />
          <SavingsTile
            label="Goal Savings"
            value={snap.savingsGoal}
            Icon={PiggyBank}
            tileClass="bg-savings-tint text-savings"
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
  tone: 'income' | 'spending' | 'success' | 'danger' | 'warning' | 'muted';
  icon?: React.ComponentType<{ className?: string }>;
  hint?: string;
  testId: string;
}

function KpiTile({ label, value, tone, icon: Icon, hint, testId }: KpiTileProps) {
  const toneClass =
    tone === 'income' ? 'text-income'
    : tone === 'spending' ? 'text-spending'
    : tone === 'success' ? 'text-success'
    : tone === 'danger' ? 'text-danger'
    : tone === 'warning' ? 'text-warning'
    : 'text-foreground';
  return (
    <div
      className="rounded-xl border border-border bg-card p-3"
      data-testid={testId}
    >
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className={cn('mt-1 flex items-center gap-1 text-lg font-bold leading-tight', toneClass)}>
        {Icon && <Icon className="h-4 w-4" />}
        <span className="amount whitespace-nowrap">{value}</span>
      </div>
      {hint && (
        <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{hint}</p>
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
      <p className={cn('amount mt-0.5 text-lg font-bold', accent)}>{formatINR(value)}</p>
    </div>
  );
}

interface SavingsTileProps {
  label: string;
  value: number;
  Icon: React.ComponentType<{ className?: string }>;
  tileClass: string;
  testId: string;
}

function SavingsTile({ label, value, Icon, tileClass, testId }: SavingsTileProps) {
  return (
    <div
      className="rounded-xl border border-border bg-card p-3"
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tileClass)}
        >
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      </div>
      <p className="amount mt-2 text-lg font-bold text-foreground">{formatINR(value)}</p>
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

// ─────────────────────────────────────────────────────────────

interface SpendingPieProps {
  snapExpenses: number;
  topCategories: {
    categoryId: string;
    categoryName: string;
    categoryColor: string;
    amount: number;
  }[];
}

function SpendingPie({ snapExpenses, topCategories }: SpendingPieProps) {
  const topSum = topCategories.reduce((s, r) => s + r.amount, 0);
  const otherAmount = Math.max(0, snapExpenses - topSum);
  const pieData = otherAmount > 0
    ? [
        ...topCategories.map(r => ({
          name: r.categoryName,
          value: r.amount,
          color: r.categoryColor,
        })),
        { name: 'Other', value: otherAmount, color: 'hsl(var(--muted-foreground))' },
      ]
    : topCategories.map(r => ({
        name: r.categoryName,
        value: r.amount,
        color: r.categoryColor,
      }));

  return (
    <div
      className="relative rounded-2xl border border-border bg-card p-3"
      data-testid="month-end-spending-pie"
    >
      <div className="relative mx-auto h-[180px] w-full max-w-[260px]">
        <div className="h-full w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={82}
                paddingAngle={2}
                stroke="none"
                isAnimationActive={false}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => formatINR(v)}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total spent
          </p>
          <p className="amount text-base font-bold text-foreground">{formatINR(snapExpenses)}</p>
        </div>
      </div>
      {/* Compact legend */}
      <ul className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1" data-testid="month-end-spending-pie-legend">
        {pieData.map(entry => (
          <li key={entry.name} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: entry.color }}
              aria-hidden="true"
            />
            <span className="truncate">{entry.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
