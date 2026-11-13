import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { addMonths, currentMonth } from '@/lib/domain/periods';
import { formatMonthLabel, formatMonthYearShort } from '@/lib/format';

const PICKER_MONTHS = 13;

/**
 * DESIGN §5.3 period selector: previous arrow · month label · next arrow on a
 * muted pill. The label opens the month picker sheet (last 13 months). One
 * component for every month-scoped screen (gap G6).
 */
export function PeriodSelector({ className }: { className?: string }) {
  const { selectedMonth, setSelectedMonth } = useFinance();
  const [pickerOpen, setPickerOpen] = useState(false);
  const thisMonth = useMemo(() => currentMonth(), []);
  const isCurrentMonth = selectedMonth >= thisMonth;
  const options = useMemo(
    () => Array.from({ length: PICKER_MONTHS }, (_, i) => addMonths(thisMonth, -i)),
    [thisMonth],
  );
  const label = formatMonthLabel(selectedMonth);

  return (
    <>
      <div
        className={cn('flex items-center gap-2 rounded-xl bg-muted p-1', className)}
        data-testid="month-selector"
      >
        <button
          type="button"
          data-testid="prev-month"
          onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}
          className="tap-target flex h-8 w-8 items-center justify-center rounded-lg text-foreground hover:bg-card"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid="month-picker-trigger"
          onClick={() => setPickerOpen(true)}
          className="tap-target flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-foreground hover:bg-card"
          aria-haspopup="dialog"
        >
          {/* The accessible name includes the visible label (WCAG 2.5.3). */}
          <span className="sr-only">Change month, selected: </span>
          <span className="hidden min-[400px]:inline">{label}</span>
          <span className="min-[400px]:hidden">{formatMonthYearShort(selectedMonth)}</span>
          <ChevronDown size={14} className="text-muted-foreground" aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid="next-month"
          onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
          disabled={isCurrentMonth}
          className="tap-target flex h-8 w-8 items-center justify-center rounded-lg text-foreground hover:bg-card disabled:opacity-40"
          aria-label="Next month"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto p-6">
          <SheetHeader className="mb-3 pr-10 text-left">
            <SheetTitle>Select month</SheetTitle>
            <SheetDescription>Choose any of the last {PICKER_MONTHS} months.</SheetDescription>
          </SheetHeader>
          <div className="space-y-1">
            {options.map(m => {
              const isActive = m === selectedMonth;
              return (
                <button
                  key={m}
                  type="button"
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => {
                    setSelectedMonth(m);
                    setPickerOpen(false);
                  }}
                  className={cn(
                    'flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left',
                    isActive ? 'border-accent/40 bg-accent/10' : 'border-transparent hover:bg-muted/60',
                  )}
                  data-testid={`month-option-${m}`}
                >
                  <span className={cn('text-sm font-semibold', isActive ? 'text-accent' : 'text-foreground')}>
                    {formatMonthLabel(m)}
                  </span>
                  {m === thisMonth && (
                    <span className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Current
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
