import { useMemo, useState } from 'react';
import { ArrowRight, Check, CreditCard, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFinance } from '@/context/FinanceContext';
import { formatAmountFull, formatMonthLabel } from '@/lib/format';
import { lastDateOfMonth } from '@/lib/domain/periods';
import { parseCurrencyInput } from '@/lib/currency-utils';

interface Props {
  /** Month being reviewed, YYYY-MM. */
  reviewMonth: string;
  onContinue: () => void;
  onBack: () => void;
}

/**
 * Month-End Review card-bill step. Card purchases already counted as spending
 * when they were logged; recording how much of the bill was paid lowers the
 * unpaid card amount without counting that spending again (PRD §6, D8).
 */
export function MonthEndCardBillCard({ reviewMonth, onContinue, onBack }: Props) {
  const { getOutstandingCardBalanceAtEndOf, getCardBillPaymentsIn, recordCardBillPayment } = useFinance();

  const owed = getOutstandingCardBalanceAtEndOf(reviewMonth);
  const paidThisMonth = getCardBillPaymentsIn(reviewMonth);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [recorded, setRecorded] = useState<number | null>(null);

  const monthLabel = formatMonthLabel(reviewMonth);
  const dayLabel = useMemo(() => {
    const [, , day] = lastDateOfMonth(reviewMonth).split('-');
    return `${monthLabel.split(' ')[0]} ${Number(day)}`;
  }, [reviewMonth, monthLabel]);

  const hasInput = input.trim().length > 0;
  const parsed = parseCurrencyInput(input);
  const inputError = !hasInput
    ? ''
    : parsed <= 0
      ? 'Enter an amount greater than zero.'
      : parsed > owed
        ? `That is more than the unpaid amount (${formatAmountFull(owed)}). Add any missing card purchases first, or enter up to ${formatAmountFull(owed)}.`
        : '';
  const canRecord = hasInput && inputError === '' && !busy;

  const handleRecord = () => {
    if (!canRecord) return;
    setBusy(true);
    const result = recordCardBillPayment(reviewMonth, parsed);
    setBusy(false);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    setSaveError('');
    setRecorded(parsed);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col" data-testid="month-end-card-bill">
      <div className="flex-1 overflow-y-auto px-1 py-2">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Card bill · {monthLabel}
          </p>
          <h2 className="mt-1 text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
            Did you pay your card bill?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Purchases marked &ldquo;Credit Card&rdquo; already count as spending. Record what you paid
            toward the card by {dayLabel} so the app knows how much you still owe. A bill
            payment is not counted as spending again.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Still unpaid on {dayLabel}
            </span>
            <span className="font-semibold text-foreground" data-testid="card-bill-owed">
              {formatAmountFull(owed)}
            </span>
          </div>
          {paidThisMonth > 0 && (
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-muted-foreground">Bill payments recorded in {monthLabel}</span>
              <span className="font-semibold text-foreground" data-testid="card-bill-paid">
                {formatAmountFull(paidThisMonth)}
              </span>
            </div>
          )}
        </div>

        {owed > 0 ? (
          <div className="mt-5">
            <label htmlFor="card-bill-amount" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Amount you paid toward the card
            </label>
            <div className="flex gap-2">
              <Input
                id="card-bill-amount"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 12000"
                value={input}
                onChange={e => { setInput(e.target.value); setSaveError(''); setRecorded(null); }}
                aria-invalid={inputError !== ''}
                aria-describedby={inputError ? 'card-bill-amount-error' : undefined}
                data-testid="card-bill-amount"
                className="text-base"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => { setInput(String(owed)); setSaveError(''); setRecorded(null); }}
                data-testid="card-bill-full"
              >
                Paid in full
              </Button>
            </div>
            {inputError && (
              <p id="card-bill-amount-error" className="mt-2 text-xs font-medium text-destructive" role="alert">
                {inputError}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground" data-testid="card-bill-clear">
            Nothing is unpaid on your card for {monthLabel}.
          </p>
        )}

        {saveError && (
          <p className="mt-3 text-xs font-medium text-destructive" role="alert" data-testid="card-bill-save-error">
            {saveError}
          </p>
        )}

        {recorded !== null && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-foreground" role="status">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div data-testid="card-bill-recorded">
              Recorded a {formatAmountFull(recorded)} card bill payment dated {dayLabel}. Still unpaid:{' '}
              {formatAmountFull(owed)}.
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border px-1 py-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="card-bill-back">
          ← Back
        </Button>
        <div className="flex items-center gap-2">
          {owed > 0 && (
            <Button size="sm" variant="secondary" onClick={handleRecord} disabled={!canRecord} data-testid="card-bill-record">
              <Check className="mr-1 h-4 w-4" />
              Record payment
            </Button>
          )}
          <Button size="sm" onClick={onContinue} data-testid="card-bill-continue">
            Continue → Reconcile
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
