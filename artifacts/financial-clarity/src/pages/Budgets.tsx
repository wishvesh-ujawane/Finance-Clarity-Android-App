import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Check, X, AlertTriangle, ChevronDown, PiggyBank } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon, ICON_OPTIONS } from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';
import { addMonths, formatINR, formatMonthLabel } from '@/lib/finance-utils';
import { SAVINGS_CATEGORY_IDS } from '@/lib/types';

const SAVINGS_CATEGORY_ID_SET: ReadonlySet<string> = new Set(SAVINGS_CATEGORY_IDS);

const COLOR_SWATCHES = [
  '#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444',
  '#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#06B6D4',
  '#84CC16', '#D946EF', '#0EA5E9', '#F43F5E',
];

export default function Budgets() {
  const {
    budgets, categories,
    addBudget, updateBudget, deleteBudget, transferBudgetsToMonth,
    getSpentForCategory, selectedMonth,
    addCategory, updateCategory, deleteCategory,
  } = useFinance();

  const [showAddBudget, setShowAddBudget] = useState(false);
  const [transferMessage, setTransferMessage] = useState('');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [newCatId, setNewCatId] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [editLimit, setEditLimit] = useState('');

  // Category management state
  const [showCatSection, setShowCatSection] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('DollarSign');
  const [editCatColor, setEditCatColor] = useState('#10B981');
  const [editCatType, setEditCatType] = useState<'income' | 'expense' | 'commitment'>('expense');
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('DollarSign');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [newCatType, setNewCatType] = useState<'income' | 'expense' | 'commitment'>('expense');

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

  const startEditCat = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    setEditingCatId(catId);
    setEditCatName(cat.name);
    setEditCatIcon(cat.icon);
    setEditCatColor(cat.color);
    setEditCatType(cat.type === 'both' ? 'expense' : (cat.type as 'income' | 'expense' | 'commitment'));
  };

  const saveEditCat = () => {
    if (!editingCatId || !editCatName.trim()) return;
    updateCategory(editingCatId, { name: editCatName.trim(), icon: editCatIcon, color: editCatColor, type: editCatType });
    setEditingCatId(null);
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    addCategory({ name: newCatName.trim(), icon: newCatIcon, color: newCatColor, type: newCatType });
    setNewCatName('');
    setNewCatIcon('DollarSign');
    setNewCatColor('#10B981');
    setNewCatType('expense');
    setShowAddCat(false);
  };

  const totalBudget = budgetsWithData.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgetsWithData.reduce((s, b) => s + b.spent, 0);

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monthly</p>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Budgets</h1>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                data-testid="transfer-budget-button"
                disabled={currentMonthBudgets.length === 0}
                className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-40"
              >
                Transfer
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
          <button
            data-testid="add-budget-button"
            onClick={() => setShowAddBudget(v => !v)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            <Plus size={15} />
            Add
          </button>
        </div>
      </div>

      {transferMessage && (
        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-4">{transferMessage}</p>
      )}

      {/* Summary */}
      {budgetsWithData.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
            <p className="text-xl font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatINR(totalBudget)}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatMonthLabel(selectedMonth)}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Spent</p>
            <p className={cn('text-xl font-bold', totalSpent > totalBudget ? 'text-red-500' : 'text-foreground')} style={{ fontFamily: 'var(--font-display)' }}>
              {formatINR(totalSpent)}
            </p>
            <p className={cn('text-xs mt-1 font-medium', totalSpent > totalBudget ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400')}>
              {totalSpent > totalBudget ? `${formatINR(totalSpent - totalBudget)} over` : `${formatINR(totalBudget - totalSpent)} remaining`}
            </p>
          </div>
        </div>
      )}

      {/* Add Budget Form */}
      <AnimatePresence>
        {showAddBudget && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <p className="text-sm font-bold text-foreground">New Budget</p>
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
              <div className="flex gap-2">
                <button onClick={() => setShowAddBudget(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
                <button data-testid="budget-save" onClick={handleAddBudget} disabled={!newCatId || !newLimit || parseFloat(newLimit) <= 0} className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50">Save Budget</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Budget List */}
      {budgetsWithData.length === 0 && savingsBudgetsWithData.length === 0 && !showAddBudget && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4"><Plus size={24} /></div>
          <p className="text-sm font-semibold mb-1">No budgets set</p>
          <p className="text-xs text-center max-w-xs">Set monthly spending limits for your categories to track your progress</p>
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
                  setEditingBudgetId(b.id);
                  setEditLimit(String(b.limit));
                }
              }}
              onKeyDown={e => {
                if (editingBudgetId === b.id) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setEditingBudgetId(b.id);
                  setEditLimit(String(b.limit));
                }
              }}
              className={cn('bg-card border rounded-2xl p-5 transition-colors', isOver ? 'border-red-200 dark:border-red-900' : isWarning ? 'border-amber-200 dark:border-amber-900' : 'border-border')}
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
                    <button onClick={() => handleEditBudgetSave(b.id)} className="p-1.5 rounded-lg bg-emerald-500 text-white"><Check size={13} /></button>
                    <button onClick={() => setEditingBudgetId(null)} className="p-1.5 rounded-lg bg-muted text-muted-foreground"><X size={13} /></button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button data-testid={`delete-budget-${b.id}`} aria-label={`Delete ${b.cat?.name || 'Unknown'} budget`} className="p-1.5 rounded-lg bg-destructive/10 text-destructive"><Trash2 size={13} /></button>
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
                      setEditingBudgetId(b.id);
                      setEditLimit(String(b.limit));
                    }
                  }}
                  onKeyDown={e => {
                    if (editingBudgetId === b.id) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setEditingBudgetId(b.id);
                      setEditLimit(String(b.limit));
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

      {/* ── Category Management ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          data-testid="toggle-categories"
          onClick={() => setShowCatSection(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-foreground hover:bg-muted/40 transition-colors"
        >
          <span>Manage Categories</span>
          <div className={cn('transition-transform', showCatSection ? 'rotate-180' : '')}>
            <ChevronDown size={16} className="text-muted-foreground" />
          </div>
        </button>

        <AnimatePresence>
          {showCatSection && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-border">
              <div className="p-4 space-y-2">
                {categories.map(cat => {
                  const isLockedSavings = SAVINGS_CATEGORY_ID_SET.has(cat.id);
                  return (
                  <div key={cat.id}>
                    {editingCatId === cat.id ? (
                      <div className="border border-accent/30 rounded-xl p-3 space-y-2 bg-muted/30">
                        <input
                          value={editCatName}
                          onChange={e => setEditCatName(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-card rounded-lg border border-border outline-none focus:ring-2 focus:ring-accent"
                          placeholder="Name"
                        />
                        {!isLockedSavings && (
                          <div className="flex gap-1.5">
                            {(['expense', 'income', 'commitment'] as const).map(t => (
                              <button key={t} onClick={() => setEditCatType(t)} className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium capitalize', editCatType === t ? 'bg-accent text-white' : 'bg-white dark:bg-card text-muted-foreground border border-border')}>
                                {t}
                              </button>
                            ))}
                          </div>
                        )}
                        {isLockedSavings && (
                          <p className="text-[10px] text-muted-foreground italic">Built-in savings category — type cannot be changed.</p>
                        )}
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_SWATCHES.map(c => (
                            <button key={c} onClick={() => setEditCatColor(c)} className="w-6 h-6 rounded-full relative" style={{ backgroundColor: c }}>
                              {editCatColor === c && <Check size={11} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-8 gap-1">
                          {ICON_OPTIONS.slice(0, 16).map(ico => (
                            <button key={ico} onClick={() => setEditCatIcon(ico)} className={cn('w-8 h-8 rounded-lg flex items-center justify-center', editCatIcon === ico ? 'bg-accent text-white' : 'bg-white dark:bg-card border border-border text-muted-foreground')}>
                              <CategoryIcon icon={ico} size={13} />
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={saveEditCat} className="flex-1 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold"><Check size={12} className="inline mr-1" />Save</button>
                          <button onClick={() => setEditingCatId(null)} className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold"><X size={12} className="inline mr-1" />Cancel</button>
                        </div>
                        {!isLockedSavings && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="w-full py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold">
                                <Trash2 size={12} className="inline mr-1" />Delete Category
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                                <AlertDialogDescription>Are you sure you really want to delete "{cat.name}"? Its associated budget will also be removed. Existing transactions will show as Unknown.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { deleteCategory(cat.id); setEditingCatId(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditCat(cat.id)}
                        className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cat.color + '22' }}>
                          <CategoryIcon icon={cat.icon} color={cat.color} size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{cat.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{cat.type}{isLockedSavings ? ' • built-in' : ''}</p>
                        </div>
                      </button>
                    )}
                  </div>
                  );
                })}

                {/* Add New Category */}
                <AnimatePresence>
                  {showAddCat && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="border border-border rounded-xl p-3 space-y-2 mt-2 bg-muted/20">
                        <p className="text-xs font-bold text-foreground">New Category</p>
                        <input value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full px-3 py-2 text-sm bg-white dark:bg-card rounded-lg border border-border outline-none focus:ring-2 focus:ring-accent" placeholder="Category name" />
                        <div className="flex gap-1.5">
                          {(['expense', 'income', 'commitment'] as const).map(t => (
                            <button key={t} onClick={() => setNewCatType(t)} className={cn('flex-1 py-1.5 rounded-lg text-xs font-medium capitalize', newCatType === t ? 'bg-accent text-white' : 'bg-white dark:bg-card text-muted-foreground border border-border')}>
                              {t}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_SWATCHES.map(c => (
                            <button key={c} onClick={() => setNewCatColor(c)} className="w-6 h-6 rounded-full relative" style={{ backgroundColor: c }}>
                              {newCatColor === c && <Check size={11} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-8 gap-1">
                          {ICON_OPTIONS.slice(0, 16).map(ico => (
                            <button key={ico} onClick={() => setNewCatIcon(ico)} className={cn('w-8 h-8 rounded-lg flex items-center justify-center', newCatIcon === ico ? 'bg-accent text-white' : 'bg-white dark:bg-card border border-border text-muted-foreground')}>
                              <CategoryIcon icon={ico} size={13} />
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleAddCategory} className="flex-1 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold">Create</button>
                          <button onClick={() => setShowAddCat(false)} className="flex-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-semibold">Cancel</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  data-testid="add-category-btn"
                  onClick={() => setShowAddCat(v => !v)}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-accent/40 hover:text-accent transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Add Category
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
