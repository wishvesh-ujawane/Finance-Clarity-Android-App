import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Check, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useFinance } from '@/context/FinanceContext';
import { CategoryIcon, ICON_OPTIONS } from '@/components/CategoryIcon';
import { cn } from '@/lib/utils';
import { localDateStr } from '@/lib/finance-utils';
import { SAVINGS_CATEGORY_IDS } from '@/lib/types';

const SAVINGS_CATEGORY_ID_SET: ReadonlySet<string> = new Set(SAVINGS_CATEGORY_IDS);

const COLOR_SWATCHES = [
  '#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#EF4444',
  '#F97316', '#8B5CF6', '#EC4899', '#14B8A6', '#06B6D4',
  '#84CC16', '#D946EF', '#0EA5E9', '#F43F5E', '#A3E635',
];

const CALCULATOR_KEYS = ['+', '-', 'x', '/', '='] as const;
const OPERATORS = ['+', '-', 'x', '/'];

function isOperator(value: string) {
  return OPERATORS.includes(value);
}

function formatAmountResult(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function evaluateAmountExpression(expression: string): number | null {
  const source = expression.replace(/\s/g, '').replace(/×/g, 'x').replace(/\*/g, 'x');
  if (!source) return null;

  const tokens: Array<number | string> = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    const prev = tokens[tokens.length - 1];
    const isSignedNumber = (char === '+' || char === '-') && (tokens.length === 0 || typeof prev === 'string');

    if (/\d|\./.test(char) || isSignedNumber) {
      let numberText = char;
      index += 1;
      while (index < source.length && /[\d.]/.test(source[index])) {
        numberText += source[index];
        index += 1;
      }
      // Expression evaluator context: parseFloat is safe here as we validate isFinite
      const value = Number.parseFloat(numberText);
      if (!Number.isFinite(value)) return null;
      tokens.push(value);
      continue;
    }

    if (isOperator(char)) {
      if (tokens.length === 0 || typeof prev === 'string') return null;
      tokens.push(char);
      index += 1;
      continue;
    }

    return null;
  }

  if (tokens.length === 0 || typeof tokens[tokens.length - 1] === 'string') return null;

  const collapsed: Array<number | string> = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token !== 'x' && token !== '/') {
      collapsed.push(token);
      continue;
    }

    const left = collapsed.pop();
    const right = tokens[i + 1];
    if (typeof left !== 'number' || typeof right !== 'number') return null;
    if (token === '/' && right === 0) return null;
    collapsed.push(token === 'x' ? left * right : left / right);
    i += 1;
  }

  let total = collapsed[0];
  if (typeof total !== 'number') return null;
  for (let i = 1; i < collapsed.length; i += 2) {
    const operator = collapsed[i];
    const right = collapsed[i + 1];
    if (typeof operator !== 'string' || typeof right !== 'number') return null;
    total = operator === '+' ? total + right : total - right;
  }

  return Number.isFinite(total) ? total : null;
}

export function TransactionSheet() {
  const {
    isSheetOpen, closeSheet, categories,
    addTransaction, updateTransaction, deleteTransaction, addCategory,
    editingTransaction,
  } = useFinance();

  const isEditing = !!editingTransaction;

  const [mode, setMode] = useState<'expense' | 'income' | 'save'>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(localDateStr(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank' | 'credit-card' | undefined>(undefined);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('DollarSign');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');

  // Pre-fill form when editing
  useEffect(() => {
    if (isSheetOpen) {
      if (editingTransaction) {
        const isSavingsTx = editingTransaction.type === 'expense' && SAVINGS_CATEGORY_ID_SET.has(editingTransaction.categoryId);
        setMode(isSavingsTx ? 'save' : editingTransaction.type);
        setAmount(String(editingTransaction.amount));
        setCategoryId(editingTransaction.categoryId);
        setNote(editingTransaction.note);
        setDate(editingTransaction.date);
        setPaymentMethod(editingTransaction.paymentMethod as 'cash' | 'bank' | 'credit-card' | undefined);
      } else {
        setMode('expense');
        setAmount('');
        setCategoryId('');
        setNote('');
        setDate(localDateStr(new Date()));
        setPaymentMethod(undefined);
      }
      setShowNewCat(false);
    }
  }, [isSheetOpen, editingTransaction]);

  const filteredCategories = mode === 'save'
    ? categories.filter(c => c.type === 'savings')
    : mode === 'expense'
      ? categories.filter(c => c.type === 'expense' || c.type === 'commitment' || c.type === 'both')
      : categories.filter(c => c.type === 'income' || c.type === 'both');

  const calculatedAmount = evaluateAmountExpression(amount);

  const handleSubmit = useCallback(() => {
    const parsed = evaluateAmountExpression(amount);
    if (!parsed || parsed <= 0 || !categoryId) return;

    // 'save' is a UI mode; underlying transaction is an expense whose category is a savings one.
    const storedType: 'expense' | 'income' = mode === 'income' ? 'income' : 'expense';
    const payload = { 
      type: storedType, 
      amount: parsed, 
      categoryId, 
      note, 
      date,
      paymentMethod: paymentMethod || undefined,
    };

    if (isEditing && editingTransaction) {
      updateTransaction(editingTransaction.id, payload);
    } else {
      addTransaction(payload);
    }

    closeSheet();
  }, [amount, categoryId, mode, note, date, paymentMethod, isEditing, editingTransaction, addTransaction, updateTransaction, closeSheet]);

  const handleCalculatorKey = useCallback((key: typeof CALCULATOR_KEYS[number]) => {
    if (key === '=') {
      const result = evaluateAmountExpression(amount);
      if (result !== null && result > 0) {
        setAmount(formatAmountResult(result));
      }
      return;
    }

    setAmount(prev => {
      const trimmed = prev.trim();
      if (!trimmed && key !== '-') return prev;
      if (trimmed && isOperator(trimmed.slice(-1))) {
        return `${trimmed.slice(0, -1)}${key}`;
      }
      return `${trimmed}${key}`;
    });
  }, [amount]);

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

  const handleDelete = () => {
    if (!editingTransaction) return;
    deleteTransaction(editingTransaction.id);
    handleClose();
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
                <div className="flex items-center gap-2">
                  {isEditing && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          data-testid="delete-transaction-in-sheet"
                          aria-label="Delete transaction"
                          className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive/15 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you really want to delete this transaction? This action cannot be undone and will update your balances and budget data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <button
                    data-testid="sheet-close"
                    aria-label="Close transaction sheet"
                    onClick={handleClose}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Type Toggle */}
              <div className="flex rounded-xl bg-muted p-1 mb-2" data-testid="type-toggle">
                {(['expense', 'income', 'save'] as const).map(t => {
                  const label = t === 'save' ? 'Save' : t;
                  const activeBg = t === 'expense'
                    ? 'bg-red-500 text-white shadow'
                    : t === 'income'
                      ? 'bg-emerald-500 text-white shadow'
                      : 'bg-sky-500 text-white shadow';
                  return (
                    <button
                      key={t}
                      data-testid={`type-${t}`}
                      onClick={() => { setMode(t); setCategoryId(''); }}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
                        mode === t ? activeBg : 'text-muted-foreground'
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
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
                    type="text"
                    inputMode="decimal"
                    placeholder="0 or 250+75"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-4 text-3xl font-bold bg-muted rounded-2xl border-0 outline-none focus:ring-2 focus:ring-accent text-foreground placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="grid grid-cols-5 gap-1.5 mt-2" data-testid="amount-calculator">
                  {CALCULATOR_KEYS.map(key => (
                    <button
                      key={key}
                      type="button"
                      data-testid={`calculator-${key === '=' ? 'equals' : key}`}
                      // Prevent the button from stealing focus from the amount input on
                      // pointer/mouse/touch down. This keeps the on-screen keypad open
                      // on Android WebView / mobile browsers while the user chains
                      // operators like 250+75.
                      onPointerDown={e => e.preventDefault()}
                      onMouseDown={e => e.preventDefault()}
                      onTouchStart={e => e.preventDefault()}
                      onClick={() => handleCalculatorKey(key)}
                      className={cn(
                        'h-10 rounded-xl text-sm font-bold transition-colors',
                        key === '='
                          ? 'bg-accent text-white hover:bg-accent/90'
                          : 'bg-muted text-foreground hover:bg-muted/80'
                      )}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Payment Method (Optional)
                </label>
                <div className="flex gap-2">
                  {(['cash', 'bank', 'credit-card'] as const).map((method) => {
                    const label = method === 'cash' ? 'Cash' : method === 'bank' ? 'Bank' : 'Credit Card';
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(paymentMethod === method ? undefined : method)}
                        className={cn(
                          'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all',
                          paymentMethod === method
                            ? 'bg-accent text-white shadow-md'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
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

                  {/* Add new category — disabled for hardcoded savings list */}
                  {mode !== 'save' && (
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
                  )}
                </div>

                {/* New Category Form */}
                <AnimatePresence>
                  {showNewCat && mode !== 'save' && (
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
                disabled={!calculatedAmount || calculatedAmount <= 0 || !categoryId}
                className={cn(
                  'w-full py-4 rounded-2xl text-base font-bold transition-all',
                  !calculatedAmount || calculatedAmount <= 0 || !categoryId
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : mode === 'income'
                      ? 'bg-emerald-500 text-white shadow-lg hover:bg-emerald-600'
                      : mode === 'save'
                        ? 'bg-sky-500 text-white shadow-lg hover:bg-sky-600'
                        : 'bg-red-500 text-white shadow-lg hover:bg-red-600'
                )}
                whileTap={{ scale: 0.97 }}
              >
                {isEditing
                  ? 'Save Changes'
                  : mode === 'income' ? 'Add Income' : mode === 'save' ? 'Add Savings' : 'Add Expense'}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
