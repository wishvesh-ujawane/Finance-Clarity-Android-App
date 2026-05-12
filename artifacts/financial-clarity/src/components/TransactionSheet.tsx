import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon, ICON_OPTIONS } from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';
import { localDateStr } from '@/lib/finance-utils';

const COLOR_SWATCHES = [
  '#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444',
  '#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#06B6D4',
  '#84CC16', '#D946EF', '#0EA5E9', '#F43F5E', '#A3E635',
];

export function TransactionSheet() {
  const {
    isSheetOpen, closeSheet, categories,
    addTransaction, updateTransaction, addCategory,
    editingTransaction,
  } = useFinance();

  const isEditing = !!editingTransaction;

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(localDateStr(new Date()));
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('DollarSign');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');

  // Pre-fill form when editing
  useEffect(() => {
    if (isSheetOpen) {
      if (editingTransaction) {
        setType(editingTransaction.type);
        setAmount(String(editingTransaction.amount));
        setCategoryId(editingTransaction.categoryId);
        setNote(editingTransaction.note);
        setDate(editingTransaction.date);
      } else {
        setType('expense');
        setAmount('');
        setCategoryId('');
        setNote('');
        setDate(localDateStr(new Date()));
      }
      setShowNewCat(false);
    }
  }, [isSheetOpen, editingTransaction]);

  const filteredCategories = categories.filter(
    c => c.type === type || c.type === 'both'
  );

  const handleSubmit = useCallback(() => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0 || !categoryId) return;

    const payload = { type, amount: parsed, categoryId, note, date };

    if (isEditing && editingTransaction) {
      updateTransaction(editingTransaction.id, payload);
    } else {
      addTransaction(payload);
    }

    closeSheet();
  }, [amount, categoryId, type, note, date, isEditing, editingTransaction, addTransaction, updateTransaction, closeSheet]);

  const handleCreateCategory = useCallback(() => {
    if (!newCatName.trim()) return;
    const cat = addCategory({
      name: newCatName.trim(),
      icon: newCatIcon,
      color: newCatColor,
      type: newCatType,
    });
    setCategoryId(cat.id);
    setShowNewCat(false);
    setNewCatName('');
    setNewCatIcon('DollarSign');
    setNewCatColor('#10B981');
    setNewCatType('expense');
  }, [newCatName, newCatIcon, newCatColor, newCatType, addCategory]);

  const handleClose = () => {
    closeSheet();
    setShowNewCat(false);
  };

  return (
    <AnimatePresence>
      {isSheetOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            data-testid="sheet-backdrop"
          />
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[hsl(222,65%,10%)] rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
            data-testid="transaction-sheet"
          >
            <div className="sticky top-0 bg-white dark:bg-[hsl(222,65%,10%)] z-10 px-6 pt-4 pb-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                  {isEditing ? 'Edit Transaction' : 'Add Transaction'}
                </h2>
                <button
                  data-testid="sheet-close"
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Type Toggle */}
              <div className="flex rounded-xl bg-muted p-1 mb-2" data-testid="type-toggle">
                {(['expense', 'income'] as const).map(t => (
                  <button
                    key={t}
                    data-testid={`type-${t}`}
                    onClick={() => { setType(t); setCategoryId(''); }}
                    className={cn(
                      'flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
                      type === t
                        ? t === 'expense'
                          ? 'bg-red-500 text-white shadow'
                          : 'bg-emerald-500 text-white shadow'
                        : 'text-muted-foreground'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 pb-8 space-y-5">
              {/* Amount */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">₹</span>
                  <input
                    data-testid="amount-input"
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 text-3xl font-bold bg-muted rounded-2xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {filteredCategories.map(cat => (
                    <button
                      key={cat.id}
                      data-testid={`category-${cat.id}`}
                      onClick={() => setCategoryId(cat.id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-xs font-medium',
                        categoryId === cat.id
                          ? 'border-accent bg-accent/10 text-foreground'
                          : 'border-border bg-muted/30 text-muted-foreground hover:border-accent/50'
                      )}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: cat.color + '22' }}
                      >
                        <CategoryIcon icon={cat.icon} color={cat.color} size={16} />
                      </div>
                      <span className="text-center leading-tight">{cat.name}</span>
                    </button>
                  ))}

                  {/* Add new category */}
                  <button
                    data-testid="add-new-category"
                    onClick={() => setShowNewCat(v => !v)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-dashed transition-all text-xs font-medium',
                      showNewCat
                        ? 'border-accent text-accent'
                        : 'border-border text-muted-foreground hover:border-accent/50'
                    )}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-muted">
                      {showNewCat ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    <span>New</span>
                  </button>
                </div>

                {/* New Category Form */}
                <AnimatePresence>
                  {showNewCat && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 p-4 bg-muted/50 rounded-xl space-y-3 border border-border">
                        <p className="text-xs font-bold text-foreground">New Category</p>
                        <input
                          data-testid="new-cat-name"
                          type="text"
                          placeholder="Category name"
                          value={newCatName}
                          onChange={e => setNewCatName(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-card rounded-lg border border-border outline-none focus:ring-2 focus:ring-accent"
                        />

                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Type</p>
                          <div className="flex gap-1.5">
                            {(['expense', 'income'] as const).map(t => (
                              <button
                                key={t}
                                onClick={() => setNewCatType(t)}
                                className={cn(
                                  'flex-1 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                                  newCatType === t ? 'bg-accent text-white' : 'bg-white dark:bg-card text-muted-foreground border border-border'
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Color</p>
                          <div className="flex flex-wrap gap-1.5">
                            {COLOR_SWATCHES.map(c => (
                              <button
                                key={c}
                                onClick={() => setNewCatColor(c)}
                                className="w-7 h-7 rounded-full relative transition-transform hover:scale-110"
                                style={{ backgroundColor: c }}
                              >
                                {newCatColor === c && (
                                  <Check size={12} className="absolute inset-0 m-auto text-white" strokeWidth={3} />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">Icon</p>
                          <div className="grid grid-cols-6 gap-1.5">
                            {ICON_OPTIONS.slice(0, 18).map(ico => (
                              <button
                                key={ico}
                                onClick={() => setNewCatIcon(ico)}
                                className={cn(
                                  'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                                  newCatIcon === ico
                                    ? 'bg-accent text-white'
                                    : 'bg-white dark:bg-card text-muted-foreground border border-border hover:border-accent/50'
                                )}
                              >
                                <CategoryIcon icon={ico} size={14} />
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          data-testid="create-category-submit"
                          onClick={handleCreateCategory}
                          className="w-full py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors"
                        >
                          Create Category
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Date */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Date
                </label>
                <input
                  data-testid="date-input"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground"
                />
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Note (optional)
                </label>
                <input
                  data-testid="note-input"
                  type="text"
                  placeholder="Add a note..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              {/* Submit */}
              <motion.button
                data-testid="submit-transaction"
                onClick={handleSubmit}
                disabled={!amount || parseFloat(amount) <= 0 || !categoryId}
                className={cn(
                  'w-full py-4 rounded-2xl text-base font-bold transition-all',
                  !amount || parseFloat(amount) <= 0 || !categoryId
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : type === 'expense'
                      ? 'bg-red-500 text-white shadow-lg hover:bg-red-600'
                      : 'bg-emerald-500 text-white shadow-lg hover:bg-emerald-600'
                )}
                whileTap={{ scale: 0.97 }}
              >
                {isEditing
                  ? 'Save Changes'
                  : type === 'expense' ? 'Add Expense' : 'Add Income'}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
