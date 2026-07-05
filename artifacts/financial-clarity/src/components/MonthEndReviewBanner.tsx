import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMonthYear } from '@/lib/finance-utils';
import { useMonthEndReview } from '@/context/MonthEndReviewContext';

/**
 * Soft home-screen notification prompting the user to run the month-end review.
 * Visible while `pendingMonth` exists and the review is not yet completed.
 * Not dismissible — the only way to make it disappear is to complete the
 * review. This is intentional per the feature spec.
 */
export function MonthEndReviewBanner() {
  const { pendingMonth, pendingState, open } = useMonthEndReview();

  if (!pendingMonth) return null;
  if (pendingState === 'completed') return null;

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-accent/5 p-4"
      role="region"
      aria-label="Month-end review available"
      data-testid="month-end-review-banner"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">
          Ready for your {formatMonthYear(pendingMonth)} review?
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          See how you spent and set next month's budget in two quick steps.
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={open} data-testid="month-end-review-banner-cta">
            Start review
          </Button>
        </div>
      </div>
    </div>
  );
}
