import { useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, HelpCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFinance } from '@/context/FinanceContext';
import { cn } from '@/lib/utils';
import { formatAmountFull, formatMonthLabel } from '@/lib/format';

function parseBalance(input: string): number | null {
  const value = input.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

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
  const { getExpectedBankBalanceAtEndOf, getSavingsBalanceAtEndOf, getOutstandingCardBalanceAtEndOf, getReconciliationFor, addReconciliation } = useFinance();

  const bankBeforeSavingsCorrection = getExpectedBankBalanceAtEndOf(reviewMonth);
  const trackedSavings = getSavingsBalanceAtEndOf(reviewMonth);
  const unpaidCard = getOutstandingCardBalanceAtEndOf(reviewMonth);
  const existing = getReconciliationFor(reviewMonth);
  const [input, setInput] = useState(() =>
    existing ? String(existing.actualBalance) : '',
  );
  const [confirmed, setConfirmed] = useState(!!existing);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saving = useRef(false);
  const [savingsInput, setSavingsInput] = useState('');
  const [decreaseReason, setDecreaseReason] = useState<'spent' | 'transfer' | ''>('');

  const parsed = useMemo(() => parseBalance(input), [input]);
  const actualSavings = useMemo(() => parseBalance(savingsInput), [savingsInput]);
  const savingsDifference = actualSavings === null ? 0 : actualSavings - trackedSavings;
  const needsReason = actualSavings !== null && savingsDifference < -0.005;
  const hasInput = parsed !== null && actualSavings !== null && (!needsReason || decreaseReason !== '');
  const expected = bankBeforeSavingsCorrection +
    (needsReason && decreaseReason === 'transfer' ? -savingsDifference : 0);
  const gap = parsed !== null ? expected - parsed : 0;
  const absGap = Math.abs(gap);
  const monthLabel = formatMonthLabel(reviewMonth);

  // Last calendar day of the month, for display and the adjustment txn date.
  const [yStr, mStr] = reviewMonth.split('-').map(Number);
  const lastDay = new Date(yStr, mStr, 0).getDate();
  const lastDayLabel = `${monthLabel.split(' ')[0]} ${lastDay}`;

  const saveReconciliation = (adjustBank: boolean) => {
    if (saving.current || !hasInput || parsed === null || actualSavings === null) return;
    saving.current = true;
    setIsSaving(true);
    const result = addReconciliation({
      month: reviewMonth,
      actualBalance: parsed,
      expectedBalance: expected,
      adjustmentAmount: adjustBank ? gap : undefined,
      savings: {
        actualBalance: actualSavings,
        decreaseReason: decreaseReason || undefined,
      },
    });
    if (!result.ok) {
      saving.current = false;
      setIsSaving(false);
      setSaveError(result.message);
      return;
    }
    setIsSaving(false);
    setSaveError('');
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
            compare it and your separate savings accounts with what the app recorded.
          </p>
        </div>

        {existing && !confirmed && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-success/30 bg-success-tint p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div className="text-xs text-success">
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
            onChange={e => { saving.current = false; setInput(e.target.value); setConfirmed(false); }}
            data-testid="reconcile-actual-input"
            className="text-base"
            autoFocus
          />
        </div>

        <div className="mb-5">
          <label htmlFor="reconcile-savings" className="mb-1 block text-xs font-semibold text-muted-foreground">
            Combined savings and emergency-fund balance on {lastDayLabel}
          </label>
          <Input
            id="reconcile-savings"
            type="text"
            inputMode="decimal"
            placeholder="Enter 0 if you have no separate savings"
            value={savingsInput}
            onChange={e => { saving.current = false; setSavingsInput(e.target.value); setDecreaseReason(''); setConfirmed(false); }}
            data-testid="reconcile-savings-input"
            className="text-base"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Recorded savings: {formatAmountFull(trackedSavings)}. Only the difference is recorded; savings remain in lifetime balance.
          </p>
          {actualSavings !== null && Math.abs(savingsDifference) >= 0.005 && (
            <p className="mt-1 text-xs text-muted-foreground" data-testid="reconcile-savings-difference">
              {savingsDifference > 0 ? 'Add' : 'Reduce'} {formatAmountFull(Math.abs(savingsDifference))} in savings when you save.
            </p>
          )}
          {needsReason && (
            <fieldset className="mt-3 space-y-2 text-sm">
              <legend className="mb-1 font-semibold">What happened to the difference?</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="savings-decrease" value="spent" checked={decreaseReason === 'spent'}
                  onChange={() => setDecreaseReason('spent')} />
                Spent or lost
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="savings-decrease" value="transfer" checked={decreaseReason === 'transfer'}
                  onChange={() => setDecreaseReason('transfer')} />
                Transferred back to the bank
              </label>
            </fieldset>
          )}
          {(savingsInput.trim() !== '' && actualSavings === null) && (
            <p className="mt-1 text-xs text-destructive" role="alert">Enter a valid non-negative savings balance.</p>
          )}
          {(input.trim() !== '' && parsed === null) && (
            <p className="mt-1 text-xs text-destructive" role="alert">Enter a valid non-negative bank balance.</p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span className="min-w-0 text-muted-foreground">App calculated</span>
            <span className="amount shrink-0 whitespace-nowrap font-semibold text-foreground" data-testid="reconcile-expected">
              {formatAmountFull(expected)}
            </span>
          </div>
          <p className="pb-1 text-[11px] text-muted-foreground">Excludes savings held in separate accounts.</p>
          {unpaidCard > 0 && (
            <p className="pb-1 text-[11px] text-muted-foreground" data-testid="reconcile-card-note">
              Includes {formatAmountFull(unpaidCard)} of card purchases not yet paid from your bank.
            </p>
          )}
          <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span className="min-w-0 text-muted-foreground">You said</span>
            <span className={cn('amount shrink-0 whitespace-nowrap font-semibold', hasInput ? 'text-foreground' : 'text-muted-foreground/60')} data-testid="reconcile-actual">
              {parsed !== null ? formatAmountFull(parsed) : '—'}
            </span>
          </div>
          <div className={cn(
            'mt-1 flex items-center justify-between gap-2 border-t border-border/70 py-1.5 text-sm',
          )}>
            <span className="font-semibold text-foreground">Gap</span>
            <span
              className={cn(
                'amount shrink-0 whitespace-nowrap font-bold',
                !hasInput ? 'text-muted-foreground/60'
                : absGap < 0.005 ? 'text-success'
                : gap > 0 ? 'text-warning'
                : 'text-info',
              )}
              data-testid="reconcile-gap"
            >
              {hasInput ? formatAmountFull(absGap) : '—'}
              {hasInput && absGap >= 0.005 && (
                <span className="ml-1 text-[11px] font-medium uppercase tracking-wider">
                  {gap > 0 ? 'under-logged' : 'over-logged'}
                </span>
              )}
            </span>
          </div>
        </div>

        {hasInput && absGap >= 0.005 && !confirmed && (
          <div className="mt-4 rounded-xl border border-warning/30 bg-warning-tint p-3 text-xs text-warning">
            <div className="flex items-start gap-2">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                {gap > 0 ? (
                  <>
                    App shows <span className="font-semibold">{formatAmountFull(absGap)}</span> more
                    than your bank balance. If you confirm, the button below records a {' '}
                    <span className="font-semibold">Missed Spend</span> adjustment
                    dated {lastDayLabel} so next month&apos;s carry-forward is
                    accurate.
                  </>
                ) : (
                  <>
                    App shows <span className="font-semibold">{formatAmountFull(absGap)}</span> less
                    than your bank balance. If you confirm, the button below records an {' '}
                    <span className="font-semibold">Over-logged reversal</span> dated
                    {' '}{lastDayLabel} to balance.
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {saveError && (
          <p className="mt-4 text-xs font-medium text-destructive" role="alert" data-testid="reconcile-save-error">
            {saveError}
          </p>
        )}

        {confirmed && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-success/30 bg-success-tint p-3 text-xs text-success">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Saved. Existing transactions remain available.
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-1 py-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="reconcile-back">
          ← Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
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
          {hasInput && absGap >= 0.005 && !confirmed && (
            <Button size="sm" disabled={isSaving} onClick={() => saveReconciliation(true)} data-testid="reconcile-log-adjustment">
              <Check className="mr-1 h-4 w-4" />
              Log {formatAmountFull(absGap)}
            </Button>
          )}
          {hasInput && !confirmed && (
            <Button size="sm" disabled={isSaving} variant={absGap >= 0.005 ? 'outline' : 'default'} onClick={() => saveReconciliation(false)} data-testid="reconcile-mark-done">
              <Check className="mr-1 h-4 w-4" />
              {absGap >= 0.005 ? 'Save without bank adjustment' : 'Mark reconciled'}
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
