import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CreditCard, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useFinance } from '@/context/FinanceContext';
import { cn } from '@/lib/utils';
import { formatAmount, formatAmountFull, formatDateLabel } from '@/lib/format';
import { parseCurrencyInput } from '@/lib/currency-utils';
import { isValidDateStr, localDateStr } from '@/lib/domain/periods';
import { cardActivity, isCardBillPayment } from '@/lib/domain/finance-metrics';
import type { Transaction } from '@/lib/types';

const ACTIVITY_LIMIT = 50;
const FULL_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "On your card" details (PRD FR-04, §6 outstanding card amount): card
 * purchases minus recorded bill payments, a form to record a bill payment,
 * and the card entries behind the amount. Aggregate only; no card account.
 */
export function CardDuesSheet({ open, onOpenChange }: Props) {
  const {
    transactions, categories,
    getOutstandingCardBalance, getCardBillPaymentLimit, recordCardBillPaymentOn, openEditSheet,
  } = useFinance();

  const today = localDateStr(new Date());
  const [amountInput, setAmountInput] = useState('');
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [recorded, setRecorded] = useState<{ amount: number; date: string } | null>(null);
  const submittingRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const pendingEditRef = useRef<Transaction | null>(null);

  useEffect(() => {
    if (!open) return;
    setAmountInput('');
    setDate(localDateStr(new Date()));
    setSaveError('');
    setRecorded(null);
  }, [open]);

  const owed = getOutstandingCardBalance();
  const activity = useMemo(() => cardActivity(transactions), [transactions]);
  const shownActivity = activity.slice(0, ACTIVITY_LIMIT);

  const dateError = !isValidDateStr(date)
    ? 'Choose the date you paid.'
    : date > today
      ? 'The payment date cannot be in the future.'
      : '';
  const limit = dateError ? 0 : getCardBillPaymentLimit(date);

  const hasAmount = amountInput.trim().length > 0;
  const parsed = parseCurrencyInput(amountInput);
  const amountError = !hasAmount
    ? ''
    : !Number.isFinite(parsed) || parsed <= 0
      ? 'Enter an amount greater than zero.'
      : !dateError && parsed > limit
        ? limit < owed
          ? `Only ${formatAmountFull(limit)} was on your card by ${formatDateLabel(date, FULL_DATE)}. Pick a later date or enter up to ${formatAmountFull(limit)}.`
          : `That is more than is on your card (${formatAmountFull(owed)}). Add any missing card purchases first.`
        : '';
  const canRecord = owed > 0 && hasAmount && amountError === '' && dateError === '' && !busy;

  const handleRecord = () => {
    if (!canRecord || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    const result = recordCardBillPaymentOn(date, parsed);
    submittingRef.current = false;
    setBusy(false);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    setSaveError('');
    setRecorded({ amount: parsed, date });
    setAmountInput('');
  };

  const openEntry = (tx: (typeof activity)[number]) => {
    pendingEditRef.current = tx;
    onOpenChange(false);
  };

  const resetFeedback = () => { setSaveError(''); setRecorded(null); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-2xl bg-card p-5"
        data-testid="card-dues-sheet"
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={event => {
          const entry = pendingEditRef.current;
          if (entry || returnFocusRef.current?.isConnected) {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }
          if (entry) {
            pendingEditRef.current = null;
            openEditSheet(entry);
          }
        }}
      >
        <SheetHeader className="text-left pr-8">
          <SheetTitle className="text-base" style={{ fontFamily: 'var(--font-display)' }}>On your card</SheetTitle>
          <SheetDescription>
            Card purchases you logged minus the bill payments you recorded. It is not your bank&rsquo;s statement.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Still to pay</p>
          <p className="mt-1 text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }} data-testid="card-dues-owed">
            {formatAmountFull(owed)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Card purchases already count as spending. Paying the bill is not counted again.
          </p>
        </div>

        <section className="mt-5" aria-labelledby="card-dues-pay-title">
          <h3 id="card-dues-pay-title" className="text-sm font-bold text-foreground">Record a bill payment</h3>
          {owed > 0 ? (
            <>
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor="card-dues-amount" className="mb-1 block text-xs font-semibold text-muted-foreground">
                    Amount paid
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="card-dues-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="e.g. 12000"
                      value={amountInput}
                      onChange={e => { setAmountInput(e.target.value); resetFeedback(); }}
                      aria-invalid={amountError !== ''}
                      aria-describedby={amountError ? 'card-dues-amount-error' : undefined}
                      data-testid="card-dues-amount"
                      className="text-base"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => { setAmountInput(String(limit > 0 ? limit : owed)); resetFeedback(); }}
                      data-testid="card-dues-full"
                    >
                      Paid in full
                    </Button>
                  </div>
                  {amountError && (
                    <p id="card-dues-amount-error" className="mt-2 text-xs font-medium text-destructive" role="alert">
                      {amountError}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="card-dues-date" className="mb-1 block text-xs font-semibold text-muted-foreground">
                    Date paid
                  </label>
                  <Input
                    id="card-dues-date"
                    type="date"
                    value={date}
                    max={today}
                    onChange={e => { setDate(e.target.value); resetFeedback(); }}
                    aria-invalid={dateError !== ''}
                    aria-describedby={dateError ? 'card-dues-date-error' : undefined}
                    data-testid="card-dues-date"
                    className="text-base"
                  />
                  {dateError && (
                    <p id="card-dues-date-error" className="mt-2 text-xs font-medium text-destructive" role="alert">
                      {dateError}
                    </p>
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Month-end review uses this payment when it checks your bank balance. You do not need to enter it again there.
              </p>
              <Button
                type="button"
                className="mt-3 w-full"
                onClick={handleRecord}
                disabled={!canRecord}
                data-testid="card-dues-record"
              >
                <Check className="mr-1 h-4 w-4" aria-hidden="true" />
                {busy ? 'Saving…' : 'Record payment'}
              </Button>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground" data-testid="card-dues-clear">
              Nothing is on your card right now.
            </p>
          )}

          {saveError && (
            <p className="mt-3 text-xs font-medium text-destructive" role="alert" data-testid="card-dues-save-error">
              {saveError}
            </p>
          )}
          {recorded && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-foreground" role="status" data-testid="card-dues-recorded">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span>
                Saved a {formatAmountFull(recorded.amount)} card bill payment on {formatDateLabel(recorded.date, FULL_DATE)}.
                Still to pay: {formatAmountFull(owed)}.
              </span>
            </div>
          )}
        </section>

        <section className="mt-6" aria-labelledby="card-dues-activity-title">
          <h3 id="card-dues-activity-title" className="text-sm font-bold text-foreground">Card entries</h3>
          {activity.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground" data-testid="card-dues-empty">
              No card purchases yet. When you add an expense, tick &ldquo;Paid with credit card&rdquo;.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-muted-foreground">Tap an entry to edit it or untick &ldquo;Paid with credit card&rdquo;.</p>
              <div className="mt-2 divide-y divide-border rounded-xl border border-border overflow-hidden" data-testid="card-dues-activity">
                {shownActivity.map(tx => {
                  const isPayment = isCardBillPayment(tx);
                  const cat = categories.find(c => c.id === tx.categoryId);
                  return (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => openEntry(tx)}
                      className="w-full min-h-12 flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                      data-testid={`card-entry-${tx.id}`}
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                          {isPayment
                            ? <CreditCard size={16} className="text-foreground" aria-hidden="true" />
                            : <CategoryIcon icon={cat?.icon || 'DollarSign'} color={cat?.color || '#6366F1'} size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {isPayment ? 'Card payment' : cat?.name || 'Unknown category'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {formatDateLabel(tx.date, FULL_DATE)}{tx.note && !isPayment ? ` · ${tx.note}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className={cn('text-sm font-bold flex-shrink-0', isPayment ? 'text-foreground' : 'text-destructive')}>
                        {isPayment ? `Paid ${formatAmount(tx.amount)}` : `−${formatAmount(tx.amount)}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              {activity.length > ACTIVITY_LIMIT && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing the latest {ACTIVITY_LIMIT} of {activity.length} card entries. Older ones are in Transactions.
                </p>
              )}
            </>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}
