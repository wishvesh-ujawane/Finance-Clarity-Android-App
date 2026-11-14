import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/lib/format';
import type { BudgetBucket, BudgetBucketKey, BudgetSummary } from '@/lib/domain/budgets';

interface Props {
  summary: BudgetSummary;
  /** Month name for the heading, for example "November 2026". */
  monthLabel: string;
  /** Render without the card container, for use inside another card. */
  embedded?: boolean;
  /** Optional control shown at the right of the heading. */
  action?: ReactNode;
  className?: string;
}

const ROWS: Array<{ key: BudgetBucketKey; label: string; verb: string }> = [
  { key: 'dayToDay', label: 'Day-to-day', verb: 'spent' },
  { key: 'commitments', label: 'Commitments', verb: 'paid' },
  { key: 'savings', label: 'Savings', verb: 'saved' },
];

function statusLine(key: BudgetBucketKey, bucket: BudgetBucket): { text: string; over: boolean } {
  const diff = bucket.limit - bucket.spent;
  if (key === 'dayToDay') {
    return diff >= 0
      ? { text: `${formatAmount(diff)} left`, over: false }
      : { text: `${formatAmount(-diff)} over`, over: true };
  }
  // Reaching a commitment or savings limit is never an error (DESIGN §5.9).
  if (diff > 0) return { text: `${formatAmount(diff)} to go`, over: false };
  return { text: key === 'savings' ? 'Target met' : 'Fully paid', over: false };
}

/**
 * One month's budgets by type (DESIGN §5.9 progress rows). The Budgets screen
 * and Analysis Overview both render this from the same domain summary, so the
 * numbers always match. Spending in categories without a budget is shown on
 * its own line so each type still adds up to the Dashboard totals.
 */
export function BudgetSummaryCard({ summary, monthLabel, embedded = false, action, className }: Props) {
  const rows = ROWS.filter(r => summary[r.key].count > 0 || summary[r.key].unbudgeted > 0);
  const totalSpending =
    summary.dayToDay.spent + summary.dayToDay.unbudgeted + summary.commitments.spent + summary.commitments.unbudgeted;

  return (
    <div
      className={cn(!embedded && 'bg-card border border-border rounded-2xl p-5', className)}
      data-testid="budget-summary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            Budgets for {monthLabel}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">What you spent against the limits you set.</p>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground" data-testid="budget-summary-empty">
          No budgets or spending for {monthLabel} yet.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {rows.map(({ key, label, verb }) => {
            const bucket = summary[key];
            const pct = bucket.limit > 0 ? (bucket.spent / bucket.limit) * 100 : 0;
            const status = statusLine(key, bucket);
            return (
              <div key={key} data-testid={`budget-summary-${key}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  {bucket.count > 0 ? (
                    <p className="text-sm text-foreground text-right">
                      <span className="font-bold">{formatAmount(bucket.spent)}</span>
                      <span className="text-muted-foreground"> {verb} of {formatAmount(bucket.limit)}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground text-right">No budget set</p>
                  )}
                </div>
                {bucket.count > 0 && (
                  <>
                    <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                      <div
                        className={cn('h-full rounded-full', status.over ? 'bg-destructive' : 'bg-accent')}
                        style={{ width: `${bucket.spent > 0 ? Math.max(2, Math.min(100, pct)) : 0}%` }}
                      />
                    </div>
                    <p
                      className={cn('mt-1 text-xs font-medium', status.over ? 'text-destructive' : 'text-muted-foreground')}
                      data-testid={`budget-summary-${key}-status`}
                    >
                      {status.text}
                    </p>
                  </>
                )}
                {bucket.unbudgeted > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground" data-testid={`budget-summary-${key}-unbudgeted`}>
                    + {formatAmount(bucket.unbudgeted)} {verb} in categories without a budget
                  </p>
                )}
              </div>
            );
          })}
          <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-muted-foreground">All spending this month</span>
            <span className="text-sm font-bold text-foreground" data-testid="budget-summary-total">
              {formatAmount(totalSpending)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
