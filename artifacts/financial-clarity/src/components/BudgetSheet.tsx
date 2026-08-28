import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useFinance } from '@/context/FinanceContext';
import { formatMonthLabel } from '@/lib/finance-utils';
import { parseCurrencyInput } from '@/lib/currency-utils';

/**
 * Global Add Budget sheet. Mounted once at the app root so any screen can
 * open it via `openBudgetSheet()` from FinanceContext (used by the FAB
 * speed-dial menu and the empty-state tile on the Budgets page).
 *
 * Extracted from Budgets.tsx (was previously inline local state on that
 * screen) so the sheet can live independently of the Budgets route.
 */
export function BudgetSheet() {
  const {
    categories, budgets, addBudget, selectedMonth,
    isBudgetSheetOpen, closeBudgetSheet,
  } = useFinance();

  const [newCatId, setNewCatId] = useState('');
  const [newLimit, setNewLimit] = useState('');

  const currentMonthBudgets = useMemo(
    () => budgets.filter(b => b.month === selectedMonth),
    [budgets, selectedMonth],
  );

  const expenseCategories = useMemo(
    () => categories.filter(c => c.type === 'expense' || c.type === 'commitment' || c.type === 'both'),
    [categories],
  );
  const savingsCategories = useMemo(
    () => categories.filter(c => c.type === 'savings'),
    [categories],
  );
  const budgetableCategories = useMemo(
    () => [...expenseCategories, ...savingsCategories],
    [expenseCategories, savingsCategories],
  );
  const unbudgetedCategories = useMemo(
    () => budgetableCategories
      .filter(c => !currentMonthBudgets.find(b => b.categoryId === c.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name)),
    [budgetableCategories, currentMonthBudgets],
  );

  // Reset form on open/close
  useEffect(() => {
    if (!isBudgetSheetOpen) {
      setNewCatId('');
      setNewLimit('');
    }
  }, [isBudgetSheetOpen]);

  const handleSave = () => {
    const limitValue = parseCurrencyInput(newLimit);
    if (!newCatId || limitValue <= 0) return;
    addBudget({ categoryId: newCatId, limit: limitValue, month: selectedMonth });
    closeBudgetSheet();
  };

  return (
    <Sheet open={isBudgetSheetOpen} onOpenChange={open => { if (!open) closeBudgetSheet(); }}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl flex flex-col">
        <SheetHeader className="text-left">
          <SheetTitle>New Budget</SheetTitle>
          <SheetDescription>Set a monthly limit for {formatMonthLabel(selectedMonth)}.</SheetDescription>
        </SheetHeader>
        <motion.div
          key={isBudgetSheetOpen ? 'open' : 'closed'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut', delay: 0.05 }}
          className="space-y-4 mt-4 flex-1 overflow-y-auto"
        >
          {unbudgetedCategories.length === 0 ? (
            <p
              className="text-sm text-muted-foreground text-center py-6"
              data-testid="budget-no-categories"
            >
              All your categories already have a budget for {formatMonthLabel(selectedMonth)}.
              Add a new category or delete an existing budget first.
            </p>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Category</label>
                <select
                  data-testid="budget-category-select"
                  value={newCatId}
                  onChange={e => setNewCatId(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                >
                  <option value="">Select a category</option>
                  {unbudgetedCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Monthly Limit</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₹</span>
                  <input
                    data-testid="budget-limit-input"
                    type="number"
                    placeholder="0"
                    value={newLimit}
                    onChange={e => setNewLimit(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                  />
                </div>
              </div>
            </>
          )}
        </motion.div>
        <div className="flex gap-2 pt-4 border-t border-border">
          <button
            onClick={closeBudgetSheet}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="budget-save"
            onClick={handleSave}
            disabled={!newCatId || !newLimit || parseCurrencyInput(newLimit) <= 0 || unbudgetedCategories.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            Save Budget
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
