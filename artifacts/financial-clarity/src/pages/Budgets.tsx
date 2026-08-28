import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearch } from 'wouter';
import { motion } from 'framer-motion';
import { Plus, Trash2, Check, X, AlertTriangle, PiggyBank, Pencil, ArrowRightLeft } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useFinance } from '@/context/FinanceContext';
import { useDefaultFabMenu } from '@/hooks/useDefaultFabMenu';
import { CategoryIcon } from '@/components/CategoryIcon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { addMonths, formatDateLabel, formatINR, formatMonthLabel } from '@/lib/finance-utils';
import { parseCurrencyInput } from '@/lib/currency-utils';

export default function Budgets() {
  const {
    budgets, categories, transactions,
    updateBudget, deleteBudget, transferBudgetsToMonth,
    getSpentForCategory, getCarryForward, getTotalIncome, selectedMonth,
    openEditSheet, openBudgetSheet,
  } = useFinance();

  const [transferMessage, setTransferMessage] = useState('');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [highlightedCatId, setHighlightedCatId] = useState<string | null>(null);
  const [usedUpAccordionValue, setUsedUpAccordionValue] = useState<string>('');
  const budgetRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const search = useSearch();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isTxnSheetOpen, setIsTxnSheetOpen] = useState(false);
  const [editLimit, setEditLimit] = useState('');

  const targetMonth = addMonths(selectedMonth, 1);
  const currentMonthBudgets = useMemo(
    () => budgets.filter(b => b.month === selectedMonth),
    [budgets, selectedMonth]
  );

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
  const activeBudgets = useMemo(
    () => budgetsWithData.filter(b => b.pct < 100),
    [budgetsWithData]
  );
  const usedUpBudgets = useMemo(
    () => budgetsWithData.filter(b => b.pct >= 100),
    [budgetsWithData]
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

  const handleTransferBudgets = () => {
    const transferred = transferBudgetsToMonth(selectedMonth, targetMonth);
    setTransferMessage(
      transferred > 0
        ? `Transferred ${transferred} budget${transferred === 1 ? '' : 's'} to ${formatMonthLabel(targetMonth)}.`
        : `No budgets found for ${formatMonthLabel(selectedMonth)}.`
    );
  };

  const handleEditBudgetSave = (id: string) => {
    const val = parseCurrencyInput(editLimit);
    if (val <= 0) return;
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

  useDefaultFabMenu();

  // Handle ?highlight=<categoryId> deep-link from Dashboard alert chips
  useEffect(() => {
    const params = new URLSearchParams(search);
    const target = params.get('highlight');
    if (!target) return;
    // If the highlighted budget is in the used-up group, expand the accordion so
    // scrollIntoView can reach it.
    if (usedUpBudgets.some(b => b.categoryId === target)) {
      setUsedUpAccordionValue('used-up');
    }
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
  }, [search, budgetsWithData.length, usedUpBudgets]);

  const renderBudgetCard = (b: typeof budgetsWithData[number], i: number) => {
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
  };

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

      {/* Add Budget sheet is mounted globally (see <BudgetSheet /> in App.tsx). */}

      {/* Budget List */}
      {budgetsWithData.length === 0 && savingsBudgetsWithData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <motion.button
            type="button"
            data-testid="empty-add-budget"
            onClick={openBudgetSheet}
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

      <div className="space-y-3 mb-3">
        {activeBudgets.map((b, i) => renderBudgetCard(b, i))}
      </div>

      {usedUpBudgets.length > 0 && (
        <Accordion
          type="single"
          collapsible
          value={usedUpAccordionValue}
          onValueChange={setUsedUpAccordionValue}
          className="mb-6"
        >
          <AccordionItem value="used-up" className="border-none">
            <AccordionTrigger
              data-testid="budget-used-up-toggle"
              className="bg-card border border-red-200 dark:border-red-900 rounded-2xl px-5 py-3 hover:no-underline [&[data-state=open]]:mb-3"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500" />
                <span className="text-sm font-semibold text-foreground">Fully used ({usedUpBudgets.length})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0">
              <div className="space-y-3" data-testid="budget-used-up-list">
                {usedUpBudgets.map((b, i) => renderBudgetCard(b, i))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

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
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`budget-category-txn-${t.id}`}
                    aria-label={`Edit transaction on ${formatDateLabel(t.date, { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    onClick={() => {
                      setIsTxnSheetOpen(false);
                      // Delay to let the Radix Sheet finish closing before the
                      // TransactionSheet opens — avoids focus / pointer-events
                      // conflict on Android WebView.
                      setTimeout(() => openEditSheet(t), 200);
                    }}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{formatDateLabel(t.date, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      {t.note && <p className="text-xs text-muted-foreground truncate">{t.note}</p>}
                    </div>
                    <p className={cn('text-sm font-bold whitespace-nowrap', t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500')}>
                      {t.type === 'income' ? '+' : '-'}{formatINR(t.amount)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
