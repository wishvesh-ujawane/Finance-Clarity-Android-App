import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMonthEndReview } from '@/context/MonthEndReviewContext';
import { useFinance } from '@/context/FinanceContext';
import { MonthEndAnalysisCard } from './MonthEndAnalysisCard';
import { MonthEndCardBillCard } from './MonthEndCardBillCard';
import { MonthEndReconcileCard } from './MonthEndReconcileCard';
import { MonthEndBudgetCard } from './MonthEndBudgetCard';
import { Confetti } from './Confetti';

type Step = 'look-back' | 'card-bill' | 'reconcile' | 'plan';

const STEP_LABEL: Record<Step, string> = {
  'look-back': 'Look back',
  'card-bill': 'Card bill',
  reconcile: 'Reconcile',
  plan: 'Plan ahead',
};

/**
 * Month-end review modal.
 *  1. Analysis of the just-ended month (top categories, impulse, savings)
 *  2. Card bill — only when the card had an unpaid amount or a bill payment
 *     that month: record how much of the bill was paid
 *  3. Reconcile the month-end balance against the user's real bank
 *  4. Category-by-category budget setup for the next month
 *
 * Skip / X → `useMonthEndReview.skip()` / `.dismiss()` — banner stays up.
 * Finish   → `useMonthEndReview.complete()` — banner hides for that month.
 */
export function MonthEndReviewFlow() {
  const { isOpen, pendingMonth, skip, dismiss, complete } = useMonthEndReview();
  const { getOutstandingCardBalanceAtEndOf, getCardBillPaymentsIn } = useFinance();
  const [step, setStep] = useState<Step>('look-back');
  const [confettiKey, setConfettiKey] = useState(0);

  // Fire opening confetti and reset to the first step every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setStep('look-back');
    setConfettiKey(k => k + 1);
  }, [isOpen]);

  const showCardBill = pendingMonth !== null && (
    getOutstandingCardBalanceAtEndOf(pendingMonth) > 0 || getCardBillPaymentsIn(pendingMonth) > 0
  );
  const steps = useMemo<Step[]>(
    () => (showCardBill ? ['look-back', 'card-bill', 'reconcile', 'plan'] : ['look-back', 'reconcile', 'plan']),
    [showCardBill],
  );

  if (!pendingMonth) return null;

  const stepNumber = steps.indexOf(step) + 1;
  const handleContinueFromLookBack = () => setStep(showCardBill ? 'card-bill' : 'reconcile');
  const handleContinueToReconcile = () => setStep('reconcile');
  const handleContinueToPlan = () => setStep('plan');
  const handleBackToAnalysis = () => setStep('look-back');
  const handleBackFromReconcile = () => setStep(showCardBill ? 'card-bill' : 'look-back');
  const handleBackToReconcile = () => setStep('reconcile');

  const handleBudgetFinished = () => {
    // Fire finale confetti before closing.
    setConfettiKey(k => k + 1);
    // Small delay so the confetti has time to appear behind the modal exit
    // animation. The Radix animation itself is ~200ms.
    window.setTimeout(() => complete(), 300);
  };

  // Any close initiated once the user has reached planning counts as
  // "reviewed" so the banner stops re-prompting. Closing earlier still just
  // dismisses. See Bug #3.
  const closeFromStep = () => {
    if (step === 'plan') complete();
    else dismiss();
  };

  const skipFromStep = () => {
    if (step === 'plan') complete();
    else skip();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) closeFromStep();
  };

  return (
    <>
      <Confetti fireKey={confettiKey} />
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            data-testid="month-end-review-modal"
            className={cn(
              // Full-screen on mobile, centered card on tablet+.
              'fixed inset-0 z-50 flex flex-col bg-background p-0 shadow-lg',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
              'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[min(720px,92vh)] sm:w-[min(560px,92vw)]',
              'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Month-end review
                </p>
                <p className="text-sm font-semibold text-foreground">
                  Step {stepNumber} of {steps.length} · {STEP_LABEL[step]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StepDots current={stepNumber} total={steps.length} />
                <button
                  type="button"
                  onClick={closeFromStep}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Close review"
                  data-testid="month-end-close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden">
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: step === 'look-back' ? -40 : 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: step === 'look-back' ? 40 : -40 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  className="h-full"
                >
                  {step === 'look-back' && (
                    <div className="h-full overflow-y-auto px-4 py-4">
                      <MonthEndAnalysisCard month={pendingMonth} />
                    </div>
                  )}
                  {step === 'card-bill' && (
                    <div className="h-full px-4 py-4">
                      <MonthEndCardBillCard
                        reviewMonth={pendingMonth}
                        onContinue={handleContinueToReconcile}
                        onBack={handleBackToAnalysis}
                      />
                    </div>
                  )}
                  {step === 'reconcile' && (
                    <div className="h-full px-4 py-4">
                      <MonthEndReconcileCard
                        reviewMonth={pendingMonth}
                        onContinue={handleContinueToPlan}
                        onBack={handleBackFromReconcile}
                        onSkip={handleContinueToPlan}
                      />
                    </div>
                  )}
                  {step === 'plan' && (
                    <div className="h-full px-4 py-4">
                      <MonthEndBudgetCard reviewMonth={pendingMonth} onFinished={handleBudgetFinished} />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer only for the first step; later steps own their own controls. */}
            {step === 'look-back' && (
              <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skip}
                  data-testid="month-end-skip"
                >
                  Skip for now
                </Button>
                <Button
                  size="sm"
                  onClick={handleContinueFromLookBack}
                  data-testid="month-end-continue"
                >
                  {showCardBill ? 'Continue → Card bill' : 'Continue → Reconcile'}
                </Button>
              </div>
            )}
            {step === 'plan' && (
              <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToReconcile}
                  data-testid="month-end-back-to-reconcile"
                >
                  ← Back to reconcile
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipFromStep}
                  data-testid="month-end-skip-step-3"
                >
                  Finish
                </Button>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => i + 1).map(n => (
        <span
          key={n}
          className={cn(
            'h-1.5 rounded-full transition-all',
            n === current ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
          )}
        />
      ))}
    </div>
  );
}
