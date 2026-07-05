import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useFinance } from '@/context/FinanceContext';
import {
  getReviewState,
  markReviewCompleted,
  markReviewDismissedForNow,
  markReviewSkipped,
  shouldAutoOpenReview,
  type ReviewState,
} from '@/lib/month-end-review';

interface MonthEndReviewContextValue {
  /** Most recent month awaiting review, or null when nothing to do. */
  pendingMonth: string | null;
  /** Current storage state for `pendingMonth`. */
  pendingState: ReviewState;
  /** True while the modal is visible. */
  isOpen: boolean;
  /** Explicitly open the modal for the pending month. */
  open: () => void;
  /** Close via the header X — same effect as Skip: banner stays up. */
  dismiss: () => void;
  /** Close via footer Skip — banner stays up until user completes review. */
  skip: () => void;
  /** Called by the flow when Step 2 finishes — banner hides for good. */
  complete: () => void;
  /** Whether the auto-open pass should run (suppressed while locked/onboarding). */
  suppressAutoOpen: boolean;
  setSuppressAutoOpen: (v: boolean) => void;
}

const MonthEndReviewContext = createContext<MonthEndReviewContextValue | null>(null);

export function MonthEndReviewProvider({ children }: { children: ReactNode }) {
  const { transactions, lastChangedAt } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const [suppressAutoOpen, setSuppressAutoOpen] = useState(true);
  // Bumped when review state changes locally so the pendingMonth memo re-runs.
  const [reviewRev, setReviewRev] = useState(0);

  // Recompute the pending month whenever transactions change or a review is
  // marked. `lastChangedAt` moves with any FinanceContext mutation.
  const pendingMonth = useMemo(() => {
    const result = shouldAutoOpenReview(transactions);
    return result?.month ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, lastChangedAt, reviewRev]);

  const pendingState: ReviewState = useMemo(() => {
    if (!pendingMonth) return 'completed';
    return getReviewState(pendingMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMonth, reviewRev]);

  // Auto-open once per session when there is a fresh pending review.
  useEffect(() => {
    if (suppressAutoOpen) return;
    if (!pendingMonth) return;
    if (pendingState !== 'pending') return;
    setIsOpen(true);
  }, [suppressAutoOpen, pendingMonth, pendingState]);

  const open = useCallback(() => {
    if (pendingMonth) setIsOpen(true);
  }, [pendingMonth]);

  const dismiss = useCallback(() => {
    if (pendingMonth) markReviewDismissedForNow(pendingMonth);
    setReviewRev(r => r + 1);
    setIsOpen(false);
  }, [pendingMonth]);

  const skip = useCallback(() => {
    if (pendingMonth) markReviewSkipped(pendingMonth);
    setReviewRev(r => r + 1);
    setIsOpen(false);
  }, [pendingMonth]);

  const complete = useCallback(() => {
    if (pendingMonth) markReviewCompleted(pendingMonth);
    setReviewRev(r => r + 1);
    setIsOpen(false);
  }, [pendingMonth]);

  const value: MonthEndReviewContextValue = {
    pendingMonth,
    pendingState,
    isOpen,
    open,
    dismiss,
    skip,
    complete,
    suppressAutoOpen,
    setSuppressAutoOpen,
  };

  return (
    <MonthEndReviewContext.Provider value={value}>
      {children}
    </MonthEndReviewContext.Provider>
  );
}

export function useMonthEndReview(): MonthEndReviewContextValue {
  const ctx = useContext(MonthEndReviewContext);
  if (!ctx) throw new Error('useMonthEndReview must be used within MonthEndReviewProvider');
  return ctx;
}
