import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Check, X, AlertTriangle, Edit3 } from 'lucide-react';
import { useLocation } from 'wouter';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon } from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';
import { addMonths, formatINR, formatMonthLabel } from '@/lib/finance-utils';

export default function Budgets() {
  const {
    budgets, categories,
    addBudget, updateBudget, deleteBudget, transferBudgetsToMonth,
    getSpentForCategory, selectedMonth,
  } = useFinance();

  const [, navigate] = useLocation();
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [transferMessage, setTransferMessage] = useState('');
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [newCatId, setNewCatId] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [editLimit, setEditLimit] = useState('');

  const handleBudgetRowClick = (categoryId: string, categoryType: 'expense' | 'income') => {
    // Navigate to analysis view with the selected category filter
    navigate(`/analysis?category=${encodeURIComponent(categoryId)}&view=${categoryType}`);
  };

  const startBudgetEdit = (id: string, limit: number) => {
    setEditingBudgetId(id);
    setEditLimit(String(limit));
  };

  const targetMonth = addMonths(selectedMonth, 1);
  const currentMonthBudgets = useMemo(
    () => budgets.filter(b => b.month === selectedMonth),
    [budgets, selectedMonth]
  );

  const expenseCategories = useMemo(() => categories.filter(c => c.type === 'expense' || c.type === 'both'), [categories]);
  const unbudgetedCategories = useMemo(() => expenseCategories.filter(c => !currentMonthBudgets.find(b => b.categoryId === c.id)), [expenseCategories, currentMonthBudgets]);

  const budgetsWithData = useMemo(() =>
    currentMonthBudgets.map(b => {
      const cat = categories.find(c => c.id === b.categoryId);
      const spent = getSpentForCategory(b.categoryId, selectedMonth);
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      return { ...b, cat, spent, pct };
    }).sort((a, b) => b.pct - a.pct),
    [currentMonthBudgets, categories, getSpentForCategory, selectedMonth]
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

  const totalBudget = currentMonthBudgets.reduce((s, b) => s + b.limit, 0);
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
      {currentMonthBudgets.length > 0 && (
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
      {budgetsWithData.length === 0 && !showAddBudget && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4"><Plus size={24} /></div>
          <p className="text-sm font-semibold mb-1">No budgets set</p>
          <p className="text-xs text-center max-w-xs">Set monthly spending limits for your categories to track your progress</p>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {budgetsWithData.map((b, i) => {
          const isOver = b.pct >= 100;
          const isWarning = b.pct >= 75 && b.pct < 100;
          const barColor = isOver ? '#EF4444' : isWarning ? '#F59E0B' : b.cat?.color || '#2563EB';

          return (
            <motion.button
              key={b.id}
              type="button"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => {
                if (editingBudgetId === b.id) return;
                handleBudgetRowClick(b.categoryId, b.cat?.type === 'income' ? 'income' : 'expense');
              }}
              onKeyDown={e => {
                if (editingBudgetId === b.id) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleBudgetRowClick(b.categoryId, b.cat?.type === 'income' ? 'income' : 'expense');
                }
              }}
              className={cn(
                'w-full text-left bg-card border rounded-2xl p-5 transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/30',
                isOver ? 'border-red-200 dark:border-red-900' : isWarning ? 'border-amber-200 dark:border-amber-900' : 'border-border'
              )}
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

              <div className="flex justify-between items-center gap-3">
                {editingBudgetId === b.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                      <input data-testid={`edit-limit-${b.id}`} type="number" value={editLimit} onChange={e => setEditLimit(e.target.value)} className="w-full pl-6 pr-2 py-1.5 text-sm bg-muted rounded-lg border border-border outline-none focus:ring-1 focus:ring-accent" autoFocus />
                    </div>
                    <button onClick={() => handleEditBudgetSave(b.id)} className="p-2 rounded-xl bg-emerald-500 text-white shadow-sm hover:bg-emerald-600 transition-colors" aria-label="Save budget"><Check size={14} /></button>
                    <button onClick={() => setEditingBudgetId(null)} className="p-2 rounded-xl bg-muted text-muted-foreground shadow-sm hover:bg-muted/80 transition-colors" aria-label="Cancel edit"><X size={14} /></button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button data-testid={`delete-budget-${b.id}`} aria-label={`Delete ${b.cat?.name || 'Unknown'} budget`} className="p-2 rounded-xl bg-destructive/10 text-destructive shadow-sm hover:bg-destructive/20 transition-colors"><Trash2 size={14} /></button>
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
                    <div className="min-w-0">
                      <span className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{formatINR(b.spent)}</span> of {formatINR(b.limit)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-bold', isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-muted-foreground')}>{Math.round(b.pct)}%</span>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          startBudgetEdit(b.id, b.limit);
                        }}
                        className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-muted-foreground shadow-sm transition-colors"
                        aria-label={`Edit budget for ${b.cat?.name || 'category'}`}
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
}
