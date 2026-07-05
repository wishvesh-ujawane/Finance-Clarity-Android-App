import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, SkipForward, Sparkles, TrendingUp } from 'lucide-react';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { addMonths, formatINR, formatMonthYear } from '@/lib/finance-utils';
import { parseCurrencyInput } from '@/lib/currency-utils';
import { useFinance } from '@/context/FinanceContext';
import { Category } from '@/lib/types';
import { suggestBudgetForCategory } from '@/lib/month-end-review';

interface Props {
  reviewMonth: string;
  onFinished: () => void;
}

interface Step {
  category: Category;
  suggested: number | null;
  existingBudgetId: string | null;
  existingLimit: number | null;
}

const CATEGORY_TYPE_ORDER: Record<Category['type'], number> = {
  commitment: 0,
  expense: 1,
  both: 2,
  savings: 3,
  income: 99,
};

export function MonthEndBudgetCard({ reviewMonth, onFinished }: Props) {
  const { transactions, categories, budgets, addBudget, getTotalIncome } = useFinance();
  const nextMonth = useMemo(() => addMonths(reviewMonth, 1), [reviewMonth]);

  const steps = useMemo<Step[]>(() => {
    const budgetableCats = categories
      .filter(c => c.type === 'expense' || c.type === 'commitment' || c.type === 'both' || c.type === 'savings')
      .slice()
      .sort((a, b) => {
        const t = (CATEGORY_TYPE_ORDER[a.type] ?? 50) - (CATEGORY_TYPE_ORDER[b.type] ?? 50);
        if (t !== 0) return t;
        return a.name.localeCompare(b.name);
      });

    return budgetableCats.map(cat => {
      const existing = budgets.find(b => b.categoryId === cat.id && b.month === nextMonth);
      return {
        category: cat,
        suggested: suggestBudgetForCategory(cat.id, reviewMonth, transactions),
        existingBudgetId: existing?.id ?? null,
        existingLimit: existing?.limit ?? null,
      };
    });
  }, [categories, budgets, transactions, reviewMonth, nextMonth]);

  const total = steps.length;
  const [idx, setIdx] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  // Per-step input value keyed by categoryId. Prefill on first render.
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const s of steps) {
      const prefill = s.existingLimit ?? s.suggested;
      initial[s.category.id] = prefill !== null && prefill > 0 ? String(prefill) : '';
    }
    return initial;
  });

  // Live-updating total of all next-month budgets. Reacts to addBudget writes.
  const budgetedTotal = useMemo(
    () => budgets
      .filter(b => b.month === nextMonth)
      .reduce((sum, b) => sum + b.limit, 0),
    [budgets, nextMonth]
  );

  // Reference denominator for the progress bar — last month's income.
  const referenceIncome = useMemo(() => getTotalIncome(reviewMonth), [getTotalIncome, reviewMonth]);

  // Detect "just saved" deltas so we can flash a +₹X chip and pulse the bar.
  const prevTotalRef = useRef(budgetedTotal);
  const [delta, setDelta] = useState<number>(0);
  useEffect(() => {
    const diff = budgetedTotal - prevTotalRef.current;
    prevTotalRef.current = budgetedTotal;
    if (diff <= 0) return;
    setDelta(diff);
    const t = window.setTimeout(() => setDelta(0), 1400);
    return () => window.clearTimeout(t);
  }, [budgetedTotal]);

  if (total === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No categories to budget. Add some categories first from the Categories screen.
        </p>
        <Button className="mt-4" onClick={onFinished}>Close</Button>
      </div>
    );
  }

  const step = steps[idx];
  const value = values[step.category.id] ?? '';
  const parsed = parseCurrencyInput(value);
  const canSave = parsed > 0;

  const handleSaveAndNext = () => {
    if (canSave) {
      addBudget({ categoryId: step.category.id, limit: parsed, month: nextMonth });
    }
    advance();
  };

  const handleSkip = () => advance();

  const advance = () => {
    if (idx + 1 >= total) {
      onFinished();
      return;
    }
    setDirection(1);
    setIdx(i => i + 1);
  };

  const handleBack = () => {
    if (idx === 0) return;
    setDirection(-1);
    setIdx(i => i - 1);
  };

  return (
    <div className="flex h-full flex-col" data-testid="month-end-budget-card">
      {/* Header + progress */}
      <div className="px-1 pb-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Set budgets for {formatMonthYear(nextMonth)}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          One category at a time. We suggest based on your last 3 months.
        </p>

        {/* Live budget total tracker */}
        <BudgetTotalTracker
          budgetedTotal={budgetedTotal}
          referenceIncome={referenceIncome}
          delta={delta}
        />

        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${((idx + 1) / total) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {idx + 1} / {total}
          </span>
        </div>
      </div>

      {/* Slide */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <motion.div
            key={step.category.id}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="absolute inset-0"
          >
            <BudgetStepCard
              step={step}
              value={value}
              onChange={v => setValues(prev => ({ ...prev, [step.category.id]: v }))}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-2 pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          disabled={idx === 0}
          data-testid="budget-step-back"
          aria-label="Previous category"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSkip}
            data-testid="budget-step-skip"
          >
            <SkipForward className="h-4 w-4" />
            Skip category
          </Button>
          <Button
            size="sm"
            onClick={handleSaveAndNext}
            disabled={!canSave}
            data-testid={idx + 1 >= total ? 'budget-step-finish' : 'budget-step-save-next'}
          >
            {idx + 1 >= total ? (
              <>
                <Check className="h-4 w-4" />
                Save & finish
              </>
            ) : (
              <>
                Save & next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

interface BudgetStepCardProps {
  step: Step;
  value: string;
  onChange: (v: string) => void;
}

function BudgetStepCard({ step, value, onChange }: BudgetStepCardProps) {
  const { category, suggested, existingLimit } = step;
  const showExisting = existingLimit !== null && existingLimit > 0;
  const showSuggested = suggested !== null && suggested > 0 && !showExisting;

  return (
    <div className="flex h-full flex-col items-center justify-center px-4 pb-2 pt-4">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${category.color}22` }}
      >
        <CategoryIcon icon={category.icon} color={category.color} size={30} />
      </div>
      <h3
        className="mt-4 text-xl font-bold text-foreground"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {category.name}
      </h3>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
        {labelForType(category.type)}
      </p>

      <div className="mt-5 w-full max-w-xs">
        <label htmlFor="budget-limit" className="mb-1 block text-xs font-semibold text-muted-foreground">
          Monthly limit (₹)
        </label>
        <Input
          id="budget-limit"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={e => onChange(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder={suggested !== null ? String(suggested) : '0'}
          className="h-12 text-center text-2xl font-bold"
          data-testid="budget-step-input"
          aria-label={`Monthly limit for ${category.name}`}
        />
      </div>

      <div className="mt-4 min-h-[24px] text-center text-xs text-muted-foreground">
        {showExisting && (
          <span className={cn('rounded-full bg-muted px-2.5 py-1 font-medium')}>
            Existing budget: <span className="text-foreground">{formatINR(existingLimit)}</span>
          </span>
        )}
        {showSuggested && (
          <span className={cn('rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary')}>
            Suggested: {formatINR(suggested)} · based on last 3 months
          </span>
        )}
        {!showExisting && !showSuggested && (
          <span>No history yet — enter what feels right for next month.</span>
        )}
      </div>
    </div>
  );
}

function labelForType(t: Category['type']): string {
  if (t === 'commitment') return 'Commitment';
  if (t === 'savings') return 'Savings';
  if (t === 'both') return 'Expense · Commitment';
  return 'Expense';
}

// ─────────────────────────────────────────────────────────────

interface BudgetTotalTrackerProps {
  budgetedTotal: number;
  /** Last month's income — used as the denominator for the ratio bar. */
  referenceIncome: number;
  /** Positive number briefly after a save; drives the +₹X flash chip. */
  delta: number;
}

function BudgetTotalTracker({ budgetedTotal, referenceIncome, delta }: BudgetTotalTrackerProps) {
  const hasReference = referenceIncome > 0;
  const ratioPct = hasReference ? (budgetedTotal / referenceIncome) * 100 : 0;
  const clampedPct = Math.min(100, ratioPct);
  const barColor =
    ratioPct > 100 ? 'bg-red-500'
    : ratioPct >= 90 ? 'bg-amber-500'
    : 'bg-emerald-500';

  return (
    <div
      className="mt-3 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 to-accent/5 p-3"
      data-testid="budget-total-tracker"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-primary" />
            Budget allocated
          </p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <motion.p
              key={budgetedTotal}
              initial={{ scale: 0.94, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              className="text-xl font-bold text-foreground tabular-nums"
              data-testid="budget-total-value"
            >
              {formatINR(budgetedTotal)}
            </motion.p>
            <AnimatePresence>
              {delta > 0 && (
                <motion.span
                  key={`delta-${delta}-${budgetedTotal}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35 }}
                  className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
                  data-testid="budget-total-delta"
                >
                  +{formatINR(delta)}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        {hasReference && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">of income</p>
            <p className="text-xs font-semibold text-foreground tabular-nums">
              {formatINR(referenceIncome)}
            </p>
          </div>
        )}
      </div>

      {hasReference ? (
        <>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className={cn('h-full rounded-full', barColor)}
              animate={{ width: `${clampedPct}%` }}
              transition={{ type: 'spring', stiffness: 200, damping: 28 }}
            />
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {ratioPct > 100
              ? `Over income by ${formatINR(budgetedTotal - referenceIncome)}`
              : `${ratioPct.toFixed(0)}% of last month's income`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[10px] text-muted-foreground">
          No income recorded last month — tracking absolute amount only.
        </p>
      )}
    </div>
  );
}
