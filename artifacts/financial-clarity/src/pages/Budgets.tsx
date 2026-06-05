import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearch } from 'wouter';
import { motion } from 'framer-motion';
import { Plus, Trash2, Check, X, AlertTriangle, PiggyBank, Pencil, ArrowRightLeft } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useFinance } from '@/context/FinanceContext';
import { useFabAction } from '@/context/FabContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { addMonths, formatDateLabel, formatINR, formatMonthLabel } from '@/lib/finance-utils';

export default function Budgets() {
  const {
    budgets, categories, transactions,
    addBudget, updateBudget, deleteBudget, transferBudgetsToMonth,
    getSpentForCategory, getCarryForward, getTotalIncome, selectedMonth,
  } = useFinance();

  const [showAddBudget, setShowAddBudget] = useState(false);
  const [transferMessage, setTransferMessage] = useState('');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [highlightedCatId, setHighlightedCatId] = useState<string | null>(null);
  const budgetRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const search = useSearch();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isTxnSheetOpen, setIsTxnSheetOpen] = useState(false);
  const [newCatId, setNewCatId] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [editLimit, setEditLimit] = useState('');

  const targetMonth = addMonths(selectedMonth, 1);
  const currentMonthBudgets = useMemo(
    () => budgets.filter(b => b.month === selectedMonth),
    [budgets, selectedMonth]
  );

  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense' || c.type === 'commitment' || c.type === 'both'), [categories]);
  const savingsCategories = useMemo(() => categories.filter(c => c.type === 'savings'), [categories]);
  const budgetableCategories = useMemo(() => [...expenseCategories, ...savingsCategories], [expenseCategories, savingsCategories]);
  const unbudgetedCategories = useMemo(() => budgetableCategories.filter(c => !currentMonthBudgets.find(b => b.categoryId === c.id)), [budgetableCategories, currentMonthBudgets]);

  const allBudgetsWithData = useMemo(() =>
    currentMonthBudgets.map(b => {
      const cat = categories.find(c => c.id === b.categoryId);
      const spent = getSpentForCategory(b.categoryId, selectedMonth);
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      const isSavings = cat?.type === 'savings';
      return { ...b, cat, spent, pct, isSavings };
    }),
    [currentMonthBudgets, categories, getSpentForCategory, selectedMonth]
  );

  const budgetsWithData = useMemo(
    () => allBudgetsWithData.filter(b => !b.isSavings).sort((a, b) => b.pct - a.pct),
    [allBudgetsWithData]
  );
  const savingsBudgetsWithData = useMemo(
    () => allBudgetsWithData.filter(b => b.isSavings).sort((a, b) => b.pct - a.pct),
    [allBudgetsWithData]
  );

  const selectedCategory = useMemo(
    () => categories.find(c => c.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const categoryTransactions = useMemo(() => {
    if (!selectedCategoryId) return [];
    return transactions
      .filter(t => t.categoryId === selectedCategoryId && t.date.startsWith(selectedMonth))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, selectedCategoryId, selectedMonth]);

  const handleAddBudget = () => {
    if (!newCatId || !newLimit || parseFloat(newLimit) <= 0) return;
    addBudget({ categoryId: newCatId, limit: parseFloat(newLimit), month: selectedMonth });
    setNewCatId('');
    setNewLimit('');
    setShowAddBudget(false);
  };

  const handleTransferBudgets = () => {
    const transferred = transferBudgetsToMonth(selectedMonth, targetMonth);
    setTransferMessage(
      transferred > 0
        ? `Transferred ${transferred} budget${transferred === 1 ? '' : 's'} to ${formatMonthLabel(targetMonth)}.`
        : `No budgets found for ${formatMonthLabel(selectedMonth)}.`
    );
  };

  const handleEditBudgetSave = (id: string) => {
    const val = parseFloat(editLimit);
    if (!val || val <= 0) return;
    updateBudget(id, val);
    setEditingBudgetId(null);
  };

  const openCategoryTransactions = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setIsTxnSheetOpen(true);
  };

  const totalBudget = budgetsWithData.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgetsWithData.reduce((s, b) => s + b.spent, 0);
  const totalSavingsBudget = savingsBudgetsWithData.reduce((s, b) => s + b.limit, 0);
  const totalCombinedBudget = totalBudget + totalSavingsBudget;

  const surplusInfo = useMemo(() => {
    const carryForward = getCarryForward(selectedMonth);
    const monthIncome = getTotalIncome(selectedMonth);
    const available = carryForward + monthIncome;
    const totalAllocated = currentMonthBudgets.reduce((s, b) => s + b.limit, 0);
    const surplus = available - totalAllocated;
    const allocatedPct = available > 0
      ? (totalAllocated / available) * 100
      : (totalAllocated > 0 ? 100 : 0);
    return { available, totalAllocated, surplus, allocatedPct };
  }, [getCarryForward, getTotalIncome, selectedMonth, currentMonthBudgets]);

  const surplusBarColor =
    surplusInfo.allocatedPct >= 100 ? 'bg-red-400'
    : surplusInfo.allocatedPct >= 75 ? 'bg-amber-400'
    : 'bg-emerald-400';
  const isOverAllocated = surplusInfo.surplus < 0;

  const { toast } = useToast();

  const openAddBudget = () => {
    if (unbudgetedCategories.length === 0) {
      toast({
        title: 'No categories left for a budget',
        description: 'All your categories already have a budget. Add a new category or delete an existing budget.',
      });
      return;
    }
    setShowAddBudget(true);
  };

  useFabAction(openAddBudget, 'Add budget', 'fab-add-budget');

  // Handle ?highlight=<categoryId> deep-link from Dashboard alert chips
  useEffect(() => {
    const params = new URLSearchParams(search);
    const target = params.get('highlight');
    if (!target) return;
    // Wait for budget cards to mount/animate in
    const timer = window.setTimeout(() => {
      const el = budgetRefs.current[target];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedCatId(target);
        window.setTimeout(() => setHighlightedCatId(null), 2200);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [search, budgetsWithData.length]);

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budgets</h1>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              data-testid="transfer-budget-button"
              disabled={currentMonthBudgets.length === 0}
              className="inline-flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-card"
              aria-label={`Transfer budget to ${formatMonthLabel(targetMonth)}`}
            >
              <ArrowRightLeft size={12} className="text-muted-foreground" />
              <span>Transfer to {formatMonthLabel(targetMonth).split(' ')[0]}</span>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Transfer Budgets?</AlertDialogTitle>
              <AlertDialogDescription>
                Transfer all budgets from {formatMonthLabel(selectedMonth)} to {formatMonthLabel(targetMonth)}. Existing budgets in {formatMonthLabel(targetMonth)} for the same categories will be updated.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleTransferBudgets}>
                Transfer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {transferMessage && (
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-4">{transferMessage}</p>
      )}

      {/* Summary */}
      {budgetsWithData.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{formatMonthLabel(selectedMonth).split(' ')[0]} Month Budget</p>
            <p className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatINR(totalCombinedBudget)}</p>
            {totalSavingsBudget > 0 ? (
              <p className="text-[11px] text-muted-foreground mt-1 font-medium" data-testid="savings-budget-sub">
                {formatINR(totalBudget)} + {formatINR(totalSavingsBudget)} (savings)
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1 font-medium">{formatINR(totalBudget)}</p>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Spent on budgeted</p>
            <p className={cn('text-xl font-bold', totalSpent > totalBudget ? 'text-red-500' : 'text-foreground')} style={{ fontFamily: 'var(--font-display)' }}>
              {formatINR(totalSpent)}
            </p>
            <p className={cn('text-xs mt-1 font-medium', totalSpent > totalBudget ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400')}>
              {totalSpent > totalBudget ? `${formatINR(totalSpent - totalBudget)} over` : `${formatINR(totalBudget - totalSpent)} remaining`}
            </p>
          </div>
        </div>
      )}

      {/* Surplus strip (mirrors Dashboard hero-budget-bar) */}
      <div
        className="rounded-2xl bg-[hsl(222,65%,13%)] text-white px-5 py-4 mb-5"
        data-testid="budget-surplus-bar"
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className={cn('text-[11px]', isOverAllocated ? 'text-red-200' : 'text-white/60')}>
            {isOverAllocated
              ? `Surplus · −${formatINR(Math.abs(surplusInfo.surplus))} (over-allocated)`
              : `Surplus · ${formatINR(surplusInfo.surplus)} of ${formatINR(surplusInfo.available)}`}
          </span>
          <span className="text-[11px] font-semibold text-white/80">{Math.round(surplusInfo.allocatedPct)}%</span>
        </div>
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', surplusBarColor)}
            style={{ width: `${Math.min(surplusInfo.allocatedPct, 100)}%` }}
          />
        </div>
      </div>

      {/* Add Budget Sheet */}
      <Sheet open={showAddBudget} onOpenChange={setShowAddBudget}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl flex flex-col">
          <SheetHeader className="text-left">
            <SheetTitle>New Budget</SheetTitle>
            <SheetDescription>Set a monthly limit for {formatMonthLabel(selectedMonth)}.</SheetDescription>
          </SheetHeader>
          <motion.div
            key={showAddBudget ? 'open' : 'closed'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut', delay: 0.05 }}
            className="space-y-4 mt-4 flex-1 overflow-y-auto"
          >
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
          </motion.div>
          <div className="flex gap-2 pt-4 border-t border-border">
            <button onClick={() => setShowAddBudget(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button data-testid="budget-save" onClick={handleAddBudget} disabled={!newCatId || !newLimit || parseFloat(newLimit) <= 0} className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50">Save Budget</button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Budget List */}
      {budgetsWithData.length === 0 && savingsBudgetsWithData.length === 0 && !showAddBudget && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <motion.button
            type="button"
            data-testid="empty-add-budget"
            onClick={openAddBudget}
            aria-label="Add your first budget"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className="w-16 h-16 rounded-2xl bg-muted hover:bg-muted/80 flex items-center justify-center mb-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={24} />
          </motion.button>
          <p className="text-sm font-semibold mb-1">No budgets set</p>
          <p className="text-xs text-center max-w-xs">Tap the + above (or the floating button) to set monthly spending limits for your categories</p>
        </div>
      )}

      {budgetsWithData.length > 0 && (
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Spending budgets</p>
      )}

      <div className="space-y-3 mb-6">
        {budgetsWithData.map((b, i) => {
          const isOver = b.pct >= 100;
          const isWarning = b.pct >= 75 && b.pct < 100;
          const barColor = isOver ? '#EF4444' : isWarning ? '#F59E0B' : b.cat?.color || '#2563EB';

          const isHighlighted = highlightedCatId === b.categoryId;
          return (
            <motion.div
              key={b.id}
              ref={el => { budgetRefs.current[b.categoryId] = el; }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              role={editingBudgetId === b.id ? undefined : 'button'}
              tabIndex={editingBudgetId === b.id ? undefined : 0}
              onClick={() => {
                if (editingBudgetId !== b.id) {
                  openCategoryTransactions(b.categoryId);
                }
              }}
              onKeyDown={e => {
                if (editingBudgetId === b.id) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openCategoryTransactions(b.categoryId);
                }
              }}
              className={cn(
                'bg-card border rounded-2xl p-5 transition-all',
                isOver ? 'border-red-200 dark:border-red-900' : isWarning ? 'border-amber-200 dark:border-amber-900' : 'border-border',
                isHighlighted && 'ring-2 ring-amber-400 ring-offset-2 ring-offset-background',
              )}
              data-budget-id={b.categoryId}
              data-testid={`budget-${b.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (b.cat?.color || '#6366F1') + '22' }}>
                    <CategoryIcon icon={b.cat?.icon || 'DollarSign'} color={b.cat?.color || '#6366F1'} size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{b.cat?.name || 'Unknown'}</p>
                    <div className="flex items-center gap-1.5">
                      {(isOver || isWarning) && <AlertTriangle size={11} className={isOver ? 'text-red-500' : 'text-amber-500'} />}
                      <p className={cn('text-xs', isOver ? 'text-red-500 font-semibold' : isWarning ? 'text-amber-500 font-semibold' : 'text-muted-foreground')}>
                        {isOver ? `${formatINR(b.spent - b.limit)} over limit` : isWarning ? `${Math.round(b.pct)}% used` : `${formatINR(b.limit - b.spent)} left`}
                      </p>
                    </div>
                  </div>
                </div>
                {editingBudgetId !== b.id && (
                  <button
                    type="button"
                    data-testid={`edit-budget-${b.id}`}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingBudgetId(b.id);
                      setEditLimit(String(b.limit));
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                )}
              </div>

              <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-2">
                <motion.div className="absolute left-0 top-0 h-full rounded-full" style={{ backgroundColor: barColor }} initial={{ width: 0 }} animate={{ width: `${Math.min(b.pct, 100)}%` }} transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 }} />
              </div>

              <div className="flex justify-between items-center">
                {editingBudgetId === b.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                      <input data-testid={`edit-limit-${b.id}`} type="number" value={editLimit} onChange={e => setEditLimit(e.target.value)} className="w-full pl-6 pr-2 py-1.5 text-sm bg-muted rounded-lg border border-border outline-none focus:ring-1 focus:ring-accent" autoFocus />
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleEditBudgetSave(b.id); }} className="p-1.5 rounded-lg bg-emerald-500 text-white"><Check size={13} /></button>
                    <button onClick={e => { e.stopPropagation(); setEditingBudgetId(null); }} className="p-1.5 rounded-lg bg-muted text-muted-foreground"><X size={13} /></button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button onClick={e => e.stopPropagation()} data-testid={`delete-budget-${b.id}`} aria-label={`Delete ${b.cat?.name || 'Unknown'} budget`} className="p-1.5 rounded-lg bg-destructive/10 text-destructive"><Trash2 size={13} /></button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Budget?</AlertDialogTitle>
                          <AlertDialogDescription>Are you sure you really want to delete this budget? Your transactions will not be affected.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => { deleteBudget(b.id); setEditingBudgetId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{formatINR(b.spent)}</span> of {formatINR(b.limit)}</span>
                    <span className={cn('text-xs font-bold', isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-muted-foreground')}>{Math.round(b.pct)}%</span>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Savings Targets ── */}
      {savingsBudgetsWithData.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 mb-2">
            <PiggyBank size={12} className="text-sky-500" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Savings targets</p>
          </div>
          <div className="space-y-3 mb-6">
            {savingsBudgetsWithData.map((b, i) => {
              const isMet = b.pct >= 100;
              const isClose = b.pct >= 70 && b.pct < 100;
              const barColor = isMet ? '#10B981' : isClose ? '#F59E0B' : (b.cat?.color || '#0EA5E9');
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  role={editingBudgetId === b.id ? undefined : 'button'}
                  tabIndex={editingBudgetId === b.id ? undefined : 0}
                  onClick={() => {
                    if (editingBudgetId !== b.id) {
                      openCategoryTransactions(b.categoryId);
                    }
                  }}
                  onKeyDown={e => {
                    if (editingBudgetId === b.id) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openCategoryTransactions(b.categoryId);
                    }
                  }}
                  className={cn('bg-card border rounded-2xl p-5 transition-colors', isMet ? 'border-emerald-200 dark:border-emerald-900' : 'border-border')}
                  data-testid={`savings-budget-${b.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (b.cat?.color || '#0EA5E9') + '22' }}>
                        <CategoryIcon icon={b.cat?.icon || 'PiggyBank'} color={b.cat?.color || '#0EA5E9'} size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{b.cat?.name || 'Unknown'}</p>
                        <p className={cn('text-xs', isMet ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : isClose ? 'text-amber-500 font-semibold' : 'text-muted-foreground')}>
                          {isMet ? 'On target' : isClose ? 'Almost there' : `${formatINR(Math.max(0, b.limit - b.spent))} to go`}
                        </p>
                      </div>
                    </div>
                    {editingBudgetId !== b.id && (
                      <button
                        type="button"
                        data-testid={`edit-savings-budget-${b.id}`}
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingBudgetId(b.id);
                          setEditLimit(String(b.limit));
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>

                  <div className="relative h-2 bg-muted rounded-full overflow-hidden mb-2">
                    <motion.div className="absolute left-0 top-0 h-full rounded-full" style={{ backgroundColor: barColor }} initial={{ width: 0 }} animate={{ width: `${Math.min(b.pct, 100)}%` }} transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 }} />
                  </div>

                  <div className="flex justify-between items-center">
                    {editingBudgetId === b.id ? (
                      <div className="flex items-center gap-2 w-full">
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                          <input data-testid={`edit-savings-limit-${b.id}`} type="number" value={editLimit} onChange={e => setEditLimit(e.target.value)} className="w-full pl-6 pr-2 py-1.5 text-sm bg-muted rounded-lg border border-border outline-none focus:ring-1 focus:ring-accent" autoFocus />
                        </div>
                        <button onClick={() => handleEditBudgetSave(b.id)} className="p-1.5 rounded-lg bg-emerald-500 text-white"><Check size={13} /></button>
                        <button onClick={() => setEditingBudgetId(null)} className="p-1.5 rounded-lg bg-muted text-muted-foreground"><X size={13} /></button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button data-testid={`delete-savings-budget-${b.id}`} aria-label={`Delete ${b.cat?.name || 'Unknown'} target`} className="p-1.5 rounded-lg bg-destructive/10 text-destructive"><Trash2 size={13} /></button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Savings Target?</AlertDialogTitle>
                              <AlertDialogDescription>Remove the monthly savings target for {b.cat?.name || 'this category'}? Your saved transactions will not be affected.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => { deleteBudget(b.id); setEditingBudgetId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{formatINR(b.spent)}</span> saved of {formatINR(b.limit)}</span>
                        <span className={cn('text-xs font-bold', isMet ? 'text-emerald-600 dark:text-emerald-400' : isClose ? 'text-amber-500' : 'text-sky-500')}>{Math.round(b.pct)}%</span>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Category Management moved to Settings → Manage Categories ── */}

      <Sheet open={isTxnSheetOpen} onOpenChange={setIsTxnSheetOpen}>
        <SheetContent side="bottom" className="h-[50vh] max-h-[50vh] rounded-t-2xl px-0 pb-0 pt-5">
          <SheetHeader className="px-5">
            <SheetTitle className="text-base">{selectedCategory?.name || 'Category'} Transactions</SheetTitle>
            <SheetDescription>
              {formatMonthLabel(selectedMonth)} • {categoryTransactions.length} transaction{categoryTransactions.length === 1 ? '' : 's'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 h-[calc(50vh-88px)] overflow-y-auto border-t border-border">
            {categoryTransactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 text-muted-foreground">
                <p className="text-sm font-semibold mb-1">No transactions found</p>
                <p className="text-xs">No records for this category in {formatMonthLabel(selectedMonth)}.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {categoryTransactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{formatDateLabel(t.date, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      {t.note && <p className="text-xs text-muted-foreground truncate">{t.note}</p>}
                    </div>
                    <p className={cn('text-sm font-bold whitespace-nowrap', t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                      {t.type === 'income' ? '+' : '-'}{formatINR(t.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
