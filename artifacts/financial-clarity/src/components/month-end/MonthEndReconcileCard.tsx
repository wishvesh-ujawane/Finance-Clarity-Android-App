import { useMemo, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, HelpCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFinance } from '@/context/FinanceContext';
import { cn } from '@/lib/utils';
import { formatINR, formatMonthLabel } from '@/lib/finance-utils';
import { parseCurrencyInput } from '@/lib/currency-utils';

interface Props {
  /** Month being reviewed, YYYY-MM. */
  reviewMonth: string;
  onContinue: () => void;
  onBack: () => void;
  onSkip: () => void;
}

/**
 * Month-End Review step 2 — reconcile the end-of-month balance against the
 * user's real bank balance. One-tap "Log the gap as a Missed Spend" closes
 * drift from forgotten manual entries, keeping the next month's carry-forward
 * accurate.
 */
export function MonthEndReconcileCard({ reviewMonth, onContinue, onBack, onSkip }: Props) {
  const { getCumulativeNetBalanceThroughEndOf, getReconciliationFor, addReconciliation } = useFinance();

  const expected = getCumulativeNetBalanceThroughEndOf(reviewMonth);
  const existing = getReconciliationFor(reviewMonth);
  const [input, setInput] = useState(() =>
    existing ? String(existing.actualBalance) : '',
  );
  const [confirmed, setConfirmed] = useState(!!existing);

  const parsed = useMemo(() => parseCurrencyInput(input), [input]);
  const hasInput = input.trim().length > 0 && Number.isFinite(parsed);
  const gap = hasInput ? expected - parsed : 0;
  const absGap = Math.abs(gap);
  const monthLabel = formatMonthLabel(reviewMonth);

  // Last calendar day of the month, for display and the adjustment txn date.
  const [yStr, mStr] = reviewMonth.split('-').map(Number);
  const lastDay = new Date(yStr, mStr, 0).getDate();
  const lastDayLabel = `${monthLabel.split(' ')[0]} ${lastDay}`;

  const handleLogAdjustment = () => {
    if (!hasInput) return;
    addReconciliation({
      month: reviewMonth,
      actualBalance: parsed,
      expectedBalance: expected,
      adjustmentAmount: gap,
    });
    setConfirmed(true);
  };

  const handleMarkReconciled = () => {
    if (!hasInput) return;
    addReconciliation({
      month: reviewMonth,
      actualBalance: parsed,
      expectedBalance: expected,
    });
    setConfirmed(true);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-1 py-2">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Reconcile {monthLabel}
          </p>
          <h2 className="mt-1 text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            Does your bank match the app?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your actual bank balance at the end of {lastDayLabel}. We&apos;ll
            compare it with what the app recorded and help you close any gap.
          </p>
        </div>

        {existing && !confirmed && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-xs text-emerald-800 dark:text-emerald-200">
              You already reconciled this month on{' '}
              <span className="font-semibold">
                {new Date(existing.reconciledAt).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
              . Update the balance below if anything changed, or continue.
            </div>
          </div>
        )}

        <div className="mb-5">
          <label htmlFor="reconcile-actual" className="mb-1 block text-xs font-semibold text-muted-foreground">
            Actual bank balance on {lastDayLabel}
          </label>
          <Input
            id="reconcile-actual"
            type="text"
            inputMode="decimal"
            placeholder="e.g. 48000"
            value={input}
            onChange={e => { setInput(e.target.value); setConfirmed(false); }}
            data-testid="reconcile-actual-input"
            className="text-base"
            autoFocus
          />
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">App calculated</span>
            <span className="font-semibold text-foreground" data-testid="reconcile-expected">
              {formatINR(expected)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">You said</span>
            <span className={cn('font-semibold', hasInput ? 'text-foreground' : 'text-muted-foreground/60')} data-testid="reconcile-actual">
              {hasInput ? formatINR(parsed) : '—'}
            </span>
          </div>
          <div className={cn(
            'mt-1 flex items-center justify-between border-t border-border/70 py-1.5 text-sm',
          )}>
            <span className="font-semibold text-foreground">Gap</span>
            <span
              className={cn(
                'font-bold',
                !hasInput ? 'text-muted-foreground/60'
                : absGap < 1 ? 'text-emerald-600 dark:text-emerald-400'
                : gap > 0 ? 'text-amber-600 dark:text-amber-400'
                : 'text-sky-600 dark:text-sky-400',
              )}
              data-testid="reconcile-gap"
            >
              {hasInput ? formatINR(absGap) : '—'}
              {hasInput && absGap >= 1 && (
                <span className="ml-1 text-[10px] font-medium uppercase tracking-wider">
                  {gap > 0 ? 'under-logged' : 'over-logged'}
                </span>
              )}
            </span>
          </div>
        </div>

        {hasInput && absGap >= 1 && !confirmed && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
            <div className="flex items-start gap-2">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                {gap > 0 ? (
                  <>
                    App shows <span className="font-semibold">{formatINR(absGap)}</span> more
                    than reality. Likely a few spends you forgot to log. One tap
                    below records a {' '}
                    <span className="font-semibold">Missed Spend</span> adjustment
                    dated {lastDayLabel} so next month&apos;s carry-forward is
                    accurate.
                  </>
                ) : (
                  <>
                    App shows <span className="font-semibold">{formatINR(absGap)}</span> less
                    than reality — probably something was logged twice. One tap
                    below records an {' '}
                    <span className="font-semibold">Over-logged reversal</span> dated
                    {' '}{lastDayLabel} to balance.
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {confirmed && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-100">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Reconciled. {monthLabel} is now sealed and the carry-forward into
              next month reflects your real bank balance.
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-1 py-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="reconcile-back">
          ← Back
        </Button>
        <div className="flex items-center gap-2">
          {!confirmed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              data-testid="reconcile-skip"
            >
              Skip
            </Button>
          )}
          {hasInput && absGap >= 1 && !confirmed && (
            <Button size="sm" onClick={handleLogAdjustment} data-testid="reconcile-log-adjustment">
              <Check className="mr-1 h-4 w-4" />
              Log {formatINR(absGap)}
            </Button>
          )}
          {hasInput && absGap < 1 && !confirmed && (
            <Button size="sm" onClick={handleMarkReconciled} data-testid="reconcile-mark-done">
              <Check className="mr-1 h-4 w-4" />
              Mark reconciled
            </Button>
          )}
          {confirmed && (
            <Button size="sm" onClick={onContinue} data-testid="reconcile-continue">
              Continue → Plan ahead
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
