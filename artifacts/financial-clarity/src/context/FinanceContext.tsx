import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Transaction, Category, Budget } from '@/lib/types';
import { currentMonth } from '@/lib/finance-utils';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10B981', type: 'expense' },
  { id: 'rent', name: 'Rent', icon: 'Home', color: '#6366F1', type: 'expense' },
  { id: 'leisure', name: 'Leisure', icon: 'Smile', color: '#F59E0B', type: 'expense' },
  { id: 'transport', name: 'Transport', icon: 'Car', color: '#3B82F6', type: 'expense' },
  { id: 'health', name: 'Health', icon: 'Heart', color: '#EF4444', type: 'expense' },
  { id: 'dining', name: 'Dining', icon: 'Utensils', color: '#F97316', type: 'expense' },
  { id: 'salary', name: 'Salary', icon: 'Briefcase', color: '#10B981', type: 'income' },
  { id: 'freelance', name: 'Freelance', icon: 'Laptop', color: '#8B5CF6', type: 'income' },
  { id: 'investment', name: 'Investment', icon: 'TrendingUp', color: '#2563EB', type: 'income' },
];

interface FinanceContextType {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  importTransactions: (items: Omit<Transaction, 'id'>[]) => number;
  updateTransaction: (id: string, updates: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (c: Omit<Category, 'id'>) => Category;
  updateCategory: (id: string, updates: Omit<Category, 'id'>) => void;
  deleteCategory: (id: string) => void;
  addBudget: (b: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, limit: number) => void;
  deleteBudget: (id: string) => void;
  transferBudgetsToMonth: (fromMonth: string, toMonth: string) => number;
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  isSheetOpen: boolean;
  editingTransaction: Transaction | null;
  openSheet: () => void;
  openEditSheet: (t: Transaction) => void;
  closeSheet: () => void;
  getTotalIncome: (month?: string) => number;
  getTotalExpenses: (month?: string) => number;
  getBalance: (month?: string) => number;
  getCarryForward: (month: string) => number;
  getSpentForCategory: (categoryId: string, month: string) => number;
}

const FinanceContext = createContext<FinanceContextType | null>(null);
const skippedInitialStorageWrites = new Set<string>();

function getStorageKey(key: string) {
  return `financial-clarity:${key}`;
}

function getBackupStorageKey(key: string) {
  return `financial-clarity:backup:${key}:${Date.now()}`;
}

function preserveRawStorage(key: string, raw: string): void {
  try {
    localStorage.setItem(getBackupStorageKey(key), raw);
  } catch {
    // ignore
  }
  skippedInitialStorageWrites.add(key);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidTransaction(value: unknown): value is Transaction {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    (value.type === 'income' || value.type === 'expense') &&
    typeof value.amount === 'number' &&
    Number.isFinite(value.amount) &&
    typeof value.categoryId === 'string' &&
    value.categoryId.length > 0 &&
    (value.note === undefined || typeof value.note === 'string') &&
    typeof value.date === 'string' &&
    value.date.length > 0
  );
}

function isValidCategory(value: unknown): value is Category {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.icon === 'string' &&
    typeof value.color === 'string' &&
    (value.type === 'income' || value.type === 'expense' || value.type === 'both')
  );
}

function isValidBudget(value: unknown): value is Budget {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.categoryId === 'string' &&
    value.categoryId.length > 0 &&
    typeof value.limit === 'number' &&
    Number.isFinite(value.limit) &&
    (value.month === undefined || typeof value.month === 'string')
  );
}

function loadArrayFromStorage<T>(key: string, fallback: T[], isValid: (value: unknown) => value is T): T[] {
  try {
    const raw = localStorage.getItem(getStorageKey(key));
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      preserveRawStorage(key, raw);
      return fallback;
    }
    const filtered = parsed.filter(isValid);
    if (filtered.length !== parsed.length) {
      preserveRawStorage(key, raw);
    }
    return filtered;
  } catch {
    try {
      const raw = localStorage.getItem(getStorageKey(key));
      if (raw) preserveRawStorage(key, raw);
    } catch {
      // ignore
    }
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    if (skippedInitialStorageWrites.has(key)) {
      skippedInitialStorageWrites.delete(key);
      return;
    }
    localStorage.setItem(getStorageKey(key), JSON.stringify(value));
  } catch {
    // ignore
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    loadArrayFromStorage('transactions', [], isValidTransaction).map(t => ({ ...t, note: t.note || '' }))
  );
  const [categories, setCategories] = useState<Category[]>(() => {
    const stored = loadArrayFromStorage('categories', [], isValidCategory);
    if (stored.length === 0) return DEFAULT_CATEGORIES;
    return stored;
  });
  const [budgets, setBudgets] = useState<Budget[]>(() =>
    loadArrayFromStorage('budgets', [], isValidBudget).map(b => ({ ...b, month: b.month || currentMonth() }))
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => { saveToStorage('transactions', transactions); }, [transactions]);
  useEffect(() => { saveToStorage('categories', categories); }, [categories]);
  useEffect(() => { saveToStorage('budgets', budgets); }, [budgets]);

  const addTransaction = useCallback((t: Omit<Transaction, 'id'>) => {
    setTransactions(prev => [{ ...t, id: createId() }, ...prev]);
  }, []);

  const importTransactions = useCallback((items: Omit<Transaction, 'id'>[]) => {
    if (items.length === 0) return 0;
    setTransactions(prev => [
      ...items.map(t => ({ ...t, id: createId() })),
      ...prev,
    ]);
    return items.length;
  }, []);

  const updateTransaction = useCallback((id: string, updates: Omit<Transaction, 'id'>) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...updates, id } : t));
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  }, []);

  const addCategory = useCallback((c: Omit<Category, 'id'>): Category => {
    const newCat: Category = { ...c, id: createId() };
    setCategories(prev => [...prev, newCat]);
    return newCat;
  }, []);

  const updateCategory = useCallback((id: string, updates: Omit<Category, 'id'>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...updates, id } : c));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    setBudgets(prev => prev.filter(b => b.categoryId !== id));
  }, []);

  const addBudget = useCallback((b: Omit<Budget, 'id'>) => {
    setBudgets(prev => {
      const month = b.month || selectedMonth;
      const existing = prev.find(x => x.categoryId === b.categoryId && x.month === month);
      if (existing) {
        return prev.map(x => x.id === existing.id ? { ...x, limit: b.limit, month } : x);
      }
      return [...prev, { ...b, month, id: createId() }];
    });
  }, [selectedMonth]);

  const updateBudget = useCallback((id: string, limit: number) => {
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, limit } : b));
  }, []);

  const deleteBudget = useCallback((id: string) => {
    setBudgets(prev => prev.filter(b => b.id !== id));
  }, []);

  const transferBudgetsToMonth = useCallback((fromMonth: string, toMonth: string) => {
    if (fromMonth === toMonth) return 0;

    const sourceBudgets = budgets.filter(b => b.month === fromMonth);
    if (sourceBudgets.length === 0) return 0;

    setBudgets(prev => {
      const next = [...prev];
      sourceBudgets.forEach(source => {
        const existingIndex = next.findIndex(b => b.month === toMonth && b.categoryId === source.categoryId);
        if (existingIndex >= 0) {
          next[existingIndex] = { ...next[existingIndex], limit: source.limit, month: toMonth };
        } else {
          next.push({
            id: createId(),
            categoryId: source.categoryId,
            limit: source.limit,
            month: toMonth,
          });
        }
      });

      return next;
    });

    return sourceBudgets.length;
  }, [budgets]);

  const openSheet = useCallback(() => {
    setEditingTransaction(null);
    setIsSheetOpen(true);
  }, []);

  const openEditSheet = useCallback((t: Transaction) => {
    setEditingTransaction(t);
    setIsSheetOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    setIsSheetOpen(false);
    setEditingTransaction(null);
  }, []);

  const getTransactionsForMonth = useCallback((month?: string) => {
    const m = month || selectedMonth;
    return transactions.filter(t => t.date.startsWith(m));
  }, [transactions, selectedMonth]);

  const getTotalIncome = useCallback((month?: string) => {
    return getTransactionsForMonth(month)
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [getTransactionsForMonth]);

  const getTotalExpenses = useCallback((month?: string) => {
    return getTransactionsForMonth(month)
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [getTransactionsForMonth]);

  const getBalance = useCallback((month?: string) => {
    return getTotalIncome(month) - getTotalExpenses(month);
  }, [getTotalIncome, getTotalExpenses]);

  // Carry forward = cumulative balance of all months BEFORE the given month
  const getCarryForward = useCallback((month: string) => {
    const prevTransactions = transactions.filter(t => t.date < month);
    const income = prevTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = prevTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return income - expenses;
  }, [transactions]);

  const getSpentForCategory = useCallback((categoryId: string, month: string) => {
    return transactions
      .filter(t => t.type === 'expense' && t.categoryId === categoryId && t.date.startsWith(month))
      .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  return (
    <FinanceContext.Provider value={{
      transactions, categories, budgets,
      addTransaction, importTransactions, updateTransaction, deleteTransaction,
      addCategory, updateCategory, deleteCategory,
      addBudget, updateBudget, deleteBudget, transferBudgetsToMonth,
      selectedMonth, setSelectedMonth,
      isSheetOpen, editingTransaction,
      openSheet, openEditSheet, closeSheet,
      getTotalIncome, getTotalExpenses, getBalance, getCarryForward, getSpentForCategory,
    }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance must be used within FinanceProvider');
  return ctx;
}
