import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Dialog, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMonthEndReview } from '@/context/MonthEndReviewContext';
import { MonthEndAnalysisCard } from './MonthEndAnalysisCard';
import { MonthEndBudgetCard } from './MonthEndBudgetCard';
import { Confetti } from './Confetti';

type Step = 1 | 2;

/**
 * Two-step month-end review modal.
 *  1. Analysis of the just-ended month (top categories, impulse, savings)
 *  2. Category-by-category budget setup for the next month
 *
 * Skip / X → `useMonthEndReview.skip()` / `.dismiss()` — banner stays up.
 * Finish   → `useMonthEndReview.complete()` — banner hides for that month.
 */
export function MonthEndReviewFlow() {
  const { isOpen, pendingMonth, skip, dismiss, complete } = useMonthEndReview();
  const [step, setStep] = useState<Step>(1);
  const [confettiKey, setConfettiKey] = useState(0);

  // Fire opening confetti and reset to step 1 every time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setConfettiKey(k => k + 1);
  }, [isOpen]);

  if (!pendingMonth) return null;

  const handleContinue = () => setStep(2);
  const handleBackToAnalysis = () => setStep(1);

  const handleBudgetFinished = () => {
    // Fire finale confetti before closing.
    setConfettiKey(k => k + 1);
    // Small delay so the confetti has time to appear behind the modal exit
    // animation. The Radix animation itself is ~200ms.
    window.setTimeout(() => complete(), 300);
  };

  // Any close initiated once the user has moved past the analysis step counts
  // as "reviewed" so the banner stops re-prompting. Closing from step 1
  // (before the user saw anything) still just dismisses. See Bug #3.
  const closeFromStep = () => {
    if (step === 2) complete();
    else dismiss();
  };

  const skipFromStep = () => {
    if (step === 2) complete();
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
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Month-end review
                </p>
                <p className="text-sm font-semibold text-foreground">
                  Step {step} of 2 · {step === 1 ? 'Look back' : 'Plan ahead'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StepDots current={step} />
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
                  initial={{ opacity: 0, x: step === 1 ? -40 : 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: step === 1 ? 40 : -40 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  className="h-full"
                >
                  {step === 1 ? (
                    <div className="h-full overflow-y-auto px-4 py-4">
                      <MonthEndAnalysisCard month={pendingMonth} />
                    </div>
                  ) : (
                    <div className="h-full px-4 py-4">
                      <MonthEndBudgetCard reviewMonth={pendingMonth} onFinished={handleBudgetFinished} />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer only for step 1; step 2 owns its own controls. */}
            {step === 1 && (
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
                  onClick={handleContinue}
                  data-testid="month-end-continue"
                >
                  Continue → Plan next month
                </Button>
              </div>
            )}
            {step === 2 && (
              <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToAnalysis}
                  data-testid="month-end-back-to-analysis"
                >
                  ← Back to analysis
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipFromStep}
                  data-testid="month-end-skip-step-2"
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

function StepDots({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {[1, 2].map(n => (
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
